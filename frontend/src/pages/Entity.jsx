import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useFetchWithPayment,
  useActiveAccount,
  useWalletBalance,
  ConnectButton,
} from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { thirdwebClient } from "../thirdweb.js";
import { ACTIVE_CHAINS, PRIMARY_CHAIN_CONFIG } from "../chains.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

const PAYMENT_TOKEN = "USDC";

const SUPPORTED_PAYMENT_NETWORK_LABELS = ACTIVE_CHAINS.map((c) => c.name);

const WALLETS = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

function formatNetworkList(labels) {
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} or ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} or ${
    labels[labels.length - 1]
  }`;
}

export default function Entity() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verifyDialogStep, setVerifyDialogStep] = useState("intro"); // "intro" | "type"
  const [verifyType, setVerifyType] = useState(""); // "" | "individual" | "organization"
  const [requestSubmitted, setRequestSubmitted] = useState(false);

  const activeAccount = useActiveAccount();
  const {
    data: usdcBalance,
    isLoading: isBalanceLoading,
  } = useWalletBalance({
    address: activeAccount?.address,
    chain: PRIMARY_CHAIN_CONFIG.chain,
    client: thirdwebClient,
    tokenAddress: PRIMARY_CHAIN_CONFIG.usdcAddress,
  });

  const { fetchWithPayment, isPending: isPaymentPending } = useFetchWithPayment(thirdwebClient);
  const [orgForm, setOrgForm] = useState({
    orgName: "",
    website: "",
    contactName: "",
    contactEmail: "",
    country: "",
    role: "",
    supportLink: "",
    wallets: "",
  });
  const [indForm, setIndForm] = useState({
    fullName: "",
    profile: "",
    email: "",
    country: "",
    wallets: "",
  });
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`${API_URL}/entities/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Entity not found" : "Failed to fetch");
        return res.json();
      })
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="page verify-page verify-page--loading">
        <main className="verify-main">
          <div className="verify-loader">
            <div className="verify-loader__spinner" />
            <p className="verify-loader__text">Loading entity…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page verify-page">
        <header className="header header--verify">
          <Link to="/" className="logo">
            HashProof
          </Link>
          <p className="header-subtitle">Entity Status</p>
        </header>
        <main className="verify-main">
          <p className="verify-error">{error}</p>
          <Link to="/" className="link-back">
            ← Back to home
          </Link>
        </main>
      </div>
    );
  }

  const e = data?.entity ?? data ?? {};
  const status = data?.status ?? e.status ?? "active";

  const createdAt = e.created_at
    ? new Date(e.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";
  const lastVerified = e.last_verified_at
    ? new Date(e.last_verified_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "—";

  const resetVerifyDialog = () => {
    setOrgForm({
      orgName: "",
      website: "",
      contactName: "",
      contactEmail: "",
      country: "",
      role: "",
      supportLink: "",
      wallets: "",
    });
    setIndForm({
      fullName: "",
      profile: "",
      email: "",
      country: "",
      wallets: "",
    });
    setShowVerifyDialog(false);
    setVerifyDialogStep("intro");
    setVerifyType("");
    setFormError("");
    setRequestSubmitted(false);
  };

  const getFormPayload = () => {
    if (verifyType === "organization") {
      return {
        type: "organization",
        form: {
          orgName: orgForm.orgName.trim(),
          website: orgForm.website.trim(),
          contactName: orgForm.contactName.trim(),
          contactEmail: orgForm.contactEmail.trim(),
          country: orgForm.country.trim(),
          role: orgForm.role.trim(),
          supportLink: orgForm.supportLink.trim(),
          wallets: orgForm.wallets
            .split("\n")
            .map((w) => w.trim())
            .filter(Boolean),
        },
      };
    }
    return {
      type: "individual",
      form: {
        fullName: indForm.fullName.trim(),
        profile: indForm.profile.trim(),
        email: indForm.email.trim(),
        country: indForm.country.trim(),
        wallets: indForm.wallets
          .split("\n")
          .map((w) => w.trim())
          .filter(Boolean),
      },
    };
  };

  const handleSubmitVerify = async () => {
    setFormError("");
    if (!verifyType) {
      setFormError("Please select a verification type.");
      return;
    }

    if (verifyType === "organization") {
      const { orgName, website, contactName, contactEmail, country, role, supportLink, wallets } = orgForm;
      if (
        !orgName.trim() ||
        !website.trim() ||
        !contactName.trim() ||
        !contactEmail.trim() ||
        !country.trim() ||
        !role.trim() ||
        !supportLink.trim()
      ) {
        setFormError("Please complete all fields before continuing.");
        return;
      }
      const walletList = wallets
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean);
      if (walletList.length === 0) {
        setFormError("Please add at least one authorized wallet address.");
        return;
      }
      const evmRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletList.every((w) => evmRegex.test(w))) {
        setFormError("Authorized wallets must be valid EVM addresses (0x...) with one address per line.");
        return;
      }
    } else {
      const { fullName, profile, email, country, wallets } = indForm;
      if (!fullName.trim() || !profile.trim() || !email.trim() || !country.trim()) {
        setFormError("Please complete all fields before continuing.");
        return;
      }
      const walletList = wallets
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean);
      if (walletList.length === 0) {
        setFormError("Please add at least one authorized wallet address.");
        return;
      }
      const evmRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletList.every((w) => evmRegex.test(w))) {
        setFormError("Authorized wallets must be valid EVM addresses (0x...) with one address per line.");
        return;
      }
    }

    try {
      const url = `${API_URL}/entities/${id}/verificationRequests`;
      const payload = getFormPayload();
      await fetchWithPayment(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      setRequestSubmitted(true);
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("no usable x402 payment requirements")) {
        setFormError(
          `Payment setup issue: we couldn't find enough ${PAYMENT_TOKEN} on any supported network in your connected wallet. ` +
          `Please add ${PAYMENT_TOKEN} on ${ACTIVE_CHAINS.map((c) => c.name).join(", ")} and try again.`
        );
      } else {
        setFormError(msg || "Request failed. Please try again.");
      }
    }
  };

  return (
    <div className="page verify-page">
      <header className="header header--verify">
        <Link to="/" className="logo">
          HashProof
        </Link>
        <p className="header-subtitle">Credential Verification Service</p>
      </header>

      <main className="verify-main">
        <div className="verify-card">
          <div className="verify-header">
            <div>
              <h1>{e.display_name || "Entity"}</h1>
            </div>
            <span className={`verify-status verify-status--${status}`}>
              {status}
            </span>
          </div>


          {!e.kyb_verified && (
            <div className="verify-section">
              <p className="verify-card-description">
                Verify this issuer to increase trust in your credentials.
              </p>
              <button
                type="button"
                className="btn btn-action"
                onClick={() => {
                  setOrgForm((f) => ({
                    ...f,
                    orgName: e.display_name || "",
                  }));
                  setVerifyDialogStep("intro");
                  setShowVerifyDialog(true);
                }}
              >
                Request verification
              </button>
            </div>
          )}

          <dl className="verify-details">
            <div className="verify-detail">
              <dt>Status</dt>
              <dd>
                <span className={`entity-flag entity-flag--${e.kyb_verified ? "verified" : "unverified"}`}>
                  {e.kyb_verified ? "verified" : "unverified"}
                </span>
              </dd>
            </div>

            <div className="verify-detail">
              <dt>Website</dt>
              <dd>
                {e.website ? (
                  <a href={e.website} target="_blank" rel="noopener noreferrer" className="verify-explorer-link">
                    {e.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>

            <div className="verify-detail">
              <dt>Last verified at</dt>
              <dd>
                {e.last_verified_at ? (
                  lastVerified
                ) : (
                  "—"
                )}
              </dd>
            </div>

            <div className="verify-detail">
              <dt>Created at</dt>
              <dd>{createdAt}</dd>
            </div>

            <div className="verify-detail">
              <dt>Entity ID</dt>
              <dd>
                {e.id || id}
              </dd>
            </div>
          </dl>
        </div>

        {showVerifyDialog && (
          <div
            className="modal-backdrop"
            onClick={resetVerifyDialog}
          >
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="modal-close"
                aria-label="Close"
                onClick={resetVerifyDialog}
              >
                ×
              </button>
              {verifyDialogStep === "intro" && (
                <>
                  <h2 className="modal-title">Request verification</h2>
                  <p className="modal-text">
                    You are requesting verification for <strong>{e.display_name || "this entity"}</strong>.
                  </p>
                  <p className="modal-fee">
                    <span className="modal-fee-label">Verification request fee:</span>{" "}
                    <span className="modal-fee-amount">$0.10</span>
                  </p>
                  <p className="modal-text">
                    This fee helps prevent spam and covers the manual review process.{" "}
                    <strong>Verification is not guaranteed.</strong>
                  </p>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetVerifyDialog}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-action"
                      onClick={() => setVerifyDialogStep("type")}
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {verifyDialogStep === "type" && (
                <>
                  {requestSubmitted ? (
                    <>
                      <h2 className="modal-title">Request submitted</h2>
                      <p className="modal-text">
                        Your verification request has been submitted. We will review it and get back to you.
                      </p>
                      <div className="modal-actions">
                        <button
                          type="button"
                          className="btn btn-action"
                          onClick={resetVerifyDialog}
                        >
                          Done
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                  <h2 className="modal-title">Who are you verifying?</h2>
                  <p className="modal-text">
                    Choose whether this verification request is for an organization or for an individual.
                  </p>
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="verify-type">
                      Verification type
                    </label>
                    <select
                      id="verify-type"
                      className="modal-select"
                      value={verifyType}
                      onChange={(e) => {
                        setVerifyType(e.target.value);
                        setFormError("");
                      }}
                    >
                      <option value="">Select type</option>
                      <option value="individual">Individual</option>
                      <option value="organization">Organization</option>
                    </select>
                  </div>
                  {verifyType === "organization" && (
                    <>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-name">
                          Organization name
                        </label>
                        <input
                          id="org-name"
                          className="modal-input"
                          type="text"
                          placeholder="ACME Inc."
                          value={orgForm.orgName}
                          onChange={(e) => setOrgForm((f) => ({ ...f, orgName: e.target.value }))}
                        />
                        <p className="modal-help">
                          The name of the organization that issues credentials.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-website">
                          Website
                        </label>
                        <input
                          id="org-website"
                          className="modal-input"
                          type="url"
                          placeholder="https://example.org"
                          value={orgForm.website}
                          onChange={(e) => setOrgForm((f) => ({ ...f, website: e.target.value }))}
                        />
                        <p className="modal-help">
                          The official website of the organization.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-contact-name">
                          Contact full name
                        </label>
                        <input
                          id="org-contact-name"
                          className="modal-input"
                          type="text"
                          placeholder="Full name of the requester"
                          value={orgForm.contactName}
                          onChange={(e) => setOrgForm((f) => ({ ...f, contactName: e.target.value }))}
                        />
                        <p className="modal-help">
                          The person requesting verification for this organization.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-contact-email">
                          Contact email
                        </label>
                        <input
                          id="org-contact-email"
                          className="modal-input"
                          type="email"
                          placeholder="you@example.com"
                          value={orgForm.contactEmail}
                          onChange={(e) => setOrgForm((f) => ({ ...f, contactEmail: e.target.value }))}
                        />
                        <p className="modal-help">
                          Please use your organizational email address (personal email providers like Gmail or Outlook will be rejected).
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-country">
                          Country
                        </label>
                        <input
                          id="org-country"
                          className="modal-input"
                          type="text"
                          placeholder="Country where the organization operates"
                          value={orgForm.country}
                          onChange={(e) => setOrgForm((f) => ({ ...f, country: e.target.value }))}
                        />
                        <p className="modal-help">
                          Country where the organization operates.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-role">
                          Role in the organization
                        </label>
                        <input
                          id="org-role"
                          className="modal-input"
                          type="text"
                          placeholder="Your role or relationship with the organization"
                          value={orgForm.role}
                          onChange={(e) => setOrgForm((f) => ({ ...f, role: e.target.value }))}
                        />
                        <p className="modal-help">
                          Your role or relationship with the organization.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-support-link">
                          Supporting link
                        </label>
                        <input
                          id="org-support-link"
                          className="modal-input"
                          type="url"
                          placeholder="https://example.org/your-profile"
                          value={orgForm.supportLink}
                          onChange={(e) => setOrgForm((f) => ({ ...f, supportLink: e.target.value }))}
                        />
                        <p className="modal-help">
                          A link that shows your relationship with the organization. For example: your profile on the
                          organization website, a LinkedIn profile listing the organization, or an event page where you
                          are listed.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-wallets">
                          Authorized wallets
                        </label>
                        <textarea
                          id="org-wallets"
                          className="modal-input"
                          rows={3}
                          placeholder={"0x1234...abcd\n0x5678...ef01"}
                          value={orgForm.wallets}
                          onChange={(e) => setOrgForm((f) => ({ ...f, wallets: e.target.value }))}
                        />
                        <p className="modal-help">
                          These will be the only wallets allowed to sign transactions on behalf of this organization in
                          HashProof (one address per line).
                        </p>
                      </div>
                    </>
                  )}
                  {verifyType === "individual" && (
                    <>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-name">
                          Full name
                        </label>
                        <input
                          id="ind-name"
                          className="modal-input"
                          type="text"
                          placeholder="Full name as issuer"
                          value={indForm.fullName}
                          onChange={(e) => setIndForm((f) => ({ ...f, fullName: e.target.value }))}
                        />
                        <p className="modal-help">
                          The name that will appear as the issuer of credentials.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-profile">
                          Public profile or website
                        </label>
                        <input
                          id="ind-profile"
                          className="modal-input"
                          type="url"
                          placeholder="https://your-site-or-profile"
                          value={indForm.profile}
                          onChange={(e) => setIndForm((f) => ({ ...f, profile: e.target.value }))}
                        />
                        <p className="modal-help">
                          A public profile or website where we can verify your identity.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-email">
                          Contact email
                        </label>
                        <input
                          id="ind-email"
                          className="modal-input"
                          type="email"
                          placeholder="you@example.com"
                          value={indForm.email}
                          onChange={(e) => setIndForm((f) => ({ ...f, email: e.target.value }))}
                        />
                        <p className="modal-help">
                          We may contact you if additional verification is required.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-country">
                          Country
                        </label>
                        <input
                          id="ind-country"
                          className="modal-input"
                          type="text"
                          placeholder="Country where you are based"
                          value={indForm.country}
                          onChange={(e) => setIndForm((f) => ({ ...f, country: e.target.value }))}
                        />
                        <p className="modal-help">
                          Country where you operate or are primarily based.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-wallets">
                          Authorized wallets
                        </label>
                        <textarea
                          id="ind-wallets"
                          className="modal-input"
                          rows={3}
                          placeholder={"0x1234...abcd\n0x5678...ef01"}
                          value={indForm.wallets}
                          onChange={(e) => setIndForm((f) => ({ ...f, wallets: e.target.value }))}
                        />
                        <p className="modal-help">
                          These will be the only wallets allowed to sign transactions on your behalf as an individual
                          issuer in HashProof (one address per line).
                        </p>
                      </div>
                    </>
                  )}
                  <div className="modal-field">
                    {activeAccount ? (
                      <p className="modal-help">
                        Connected wallet:{" "}
                        <code>
                          {activeAccount.address.slice(0, 6)}…
                          {activeAccount.address.slice(-4)}
                        </code>{" "}
                        — {PAYMENT_TOKEN} on {PRIMARY_CHAIN_CONFIG.name}:{" "}
                        {isBalanceLoading
                          ? "Loading..."
                          : usdcBalance?.displayValue ?? "0"}
                      </p>
                    ) : (
                      <>
                        <p className="modal-help">
                          Connect a wallet on {PRIMARY_CHAIN_CONFIG.name} to pay in{" "}
                          {PAYMENT_TOKEN}.
                        </p>
                        <ConnectButton client={thirdwebClient} wallets={WALLETS} />
                      </>
                    )}
                  </div>
                  <p className="modal-text" style={{ marginTop: "0.25rem" }}>
                    Payment accepted in <strong>{PAYMENT_TOKEN}</strong> on:{" "}
                    <strong>{formatNetworkList(SUPPORTED_PAYMENT_NETWORK_LABELS)}</strong>.
                  </p>
                  {formError && <p className="modal-error">{formError}</p>}
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetVerifyDialog}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="btn btn-action"
                      onClick={handleSubmitVerify}
                      disabled={isPaymentPending}
                    >
                      {isPaymentPending ? "Processing…" : "Submit & Pay"}
                    </button>
                  </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

