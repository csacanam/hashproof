import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  useFetchWithPayment,
  useActiveAccount,
  useActiveWallet,
  useDisconnect,
  useWalletBalance,
  ConnectButton,
} from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { thirdwebClient } from "../thirdweb.js";
import { ACTIVE_CHAINS, PRIMARY_CHAIN_CONFIG } from "../chains.js";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

const PAYMENT_TOKEN = "USDC";
const VERIFICATION_PRICE_USDC = 0.10;

const WALLETS = [
  createWallet("io.metamask"),
  createWallet("com.coinbase.wallet"),
];

export default function Entity() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verifyDialogStep, setVerifyDialogStep] = useState("intro"); // "intro" | "form" | "payment" | "success"
  const [verifyType, setVerifyType] = useState(""); // "" | "individual" | "organization"

  const [selectedNetworkKey, setSelectedNetworkKey] = useState(PRIMARY_CHAIN_CONFIG.key);
  const selectedChainConfig =
    ACTIVE_CHAINS.find((c) => c.key === selectedNetworkKey) ?? PRIMARY_CHAIN_CONFIG;

  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const {
    data: usdcBalance,
    isLoading: isBalanceLoading,
  } = useWalletBalance({
    address: activeAccount?.address,
    chain: selectedChainConfig.chain,
    client: thirdwebClient,
    tokenAddress: selectedChainConfig.usdcAddress,
  });

  const hasSufficientBalance =
    !isBalanceLoading &&
    parseFloat(usdcBalance?.displayValue ?? "0") >= VERIFICATION_PRICE_USDC;

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
  const status = data?.status ?? e.status ?? "unverified";
  const isVerified = data?.is_verified ?? false;

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
    setSelectedNetworkKey(PRIMARY_CHAIN_CONFIG.key);
    setFormError("");
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

  const GENERIC_EMAIL_PROVIDERS = [
    "gmail.com", "outlook.com", "hotmail.com", "yahoo.com",
    "icloud.com", "protonmail.com", "me.com", "live.com",
  ];

  const parseHostname = (raw) => {
    if (!raw) return null;
    const url = raw.includes("://") ? raw : `https://${raw}`;
    try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); }
    catch { return null; }
  };

  const getOrgDomainWarning = () => {
    const website = orgForm.website.trim();
    const email = orgForm.contactEmail.trim();
    if (!email || !email.includes("@")) return null;

    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!emailDomain) return null;

    if (GENERIC_EMAIL_PROVIDERS.includes(emailDomain)) {
      return "Personal email providers are not accepted for organization verification.";
    }

    if (!website) return null;
    const websiteDomain = parseHostname(website);
    if (!websiteDomain) return null;

    if (!emailDomain.endsWith(websiteDomain) && !websiteDomain.endsWith(emailDomain)) {
      return `Email domain (${emailDomain}) does not match the website domain (${websiteDomain}).`;
    }

    return null;
  };

  const isValidUrl = (raw) => {
    if (!raw) return false;
    const url = raw.includes("://") ? raw : `https://${raw}`;
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname;
      const parts = hostname.split(".");
      // Need at least 2 parts, each non-empty, and TLD must be 2+ letters
      return (
        parts.length >= 2 &&
        parts.every((p) => p.length > 0) &&
        /^[a-zA-Z]{2,}$/.test(parts[parts.length - 1])
      );
    }
    catch { return false; }
  };

  const isFormComplete = () => {
    if (!verifyType) return false;
    const evmRegex = /^0x[a-fA-F0-9]{40}$/;
    if (verifyType === "organization") {
      const { orgName, website, contactName, contactEmail, country, role, supportLink, wallets } = orgForm;
      if (!orgName.trim() || !contactName.trim() || !contactEmail.trim() || !country.trim() || !role.trim()) return false;
      if (!isValidUrl(website) || !isValidUrl(supportLink)) return false;
      const list = wallets.split("\n").map((w) => w.trim()).filter(Boolean);
      return list.length > 0 && list.every((w) => evmRegex.test(w));
    }
    const { fullName, profile, email, country, wallets } = indForm;
    if (!fullName.trim() || !email.trim() || !country.trim()) return false;
    if (!isValidUrl(profile)) return false;
    const list = wallets.split("\n").map((w) => w.trim()).filter(Boolean);
    return list.length > 0 && list.every((w) => evmRegex.test(w));
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
        headers: {
          "Content-Type": "application/json",
          "X-Payment-Network": selectedNetworkKey,
        },
        body: JSON.stringify(payload),
      });
      setVerifyDialogStep("success");
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
            <h1>{e.display_name || "Entity"}</h1>
          </div>


          {status === "unverified" && (
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
                <span className={`entity-flag entity-flag--${isVerified ? "verified" : status === "suspended" ? "suspended" : "unverified"}`}>
                  {status.replace(/_/g, " ")}
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
              {/* Step indicator */}
              {verifyDialogStep !== "success" && (
                <p className="modal-step">
                  Step{" "}
                  {verifyDialogStep === "intro" ? "1" : verifyDialogStep === "form" ? "2" : "3"}{" "}
                  of 3
                </p>
              )}

              {/* ── Step 1: Info ── */}
              {verifyDialogStep === "intro" && (
                <>
                  <h2 className="modal-title">Request verification</h2>
                  <p className="modal-text">
                    You are requesting verification for{" "}
                    <strong className="modal-entity-name">{e.display_name || "this entity"}</strong>.
                  </p>
                  <p className="modal-fee">
                    <span className="modal-fee-label">Verification request fee:</span>{" "}
                    <span className="modal-fee-amount">$0.10</span>
                  </p>
                  <p className="modal-text">
                    This fee helps prevent spam and covers the review process.
                    Submitting a request does not guarantee approval.
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
                      onClick={() => setVerifyDialogStep("form")}
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {/* ── Step 2: Form ── */}
              {verifyDialogStep === "form" && (
                <>
                  <h2 className="modal-title">Your details</h2>
                  <p className="modal-text">
                    Choose whether this request is for an organization or an individual.
                  </p>
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="verify-type">
                      Verification type
                    </label>
                    <select
                      id="verify-type"
                      className="modal-select"
                      value={verifyType}
                      onChange={(ev) => {
                        setVerifyType(ev.target.value);
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
                        <label className="modal-label" htmlFor="org-name">Organization name</label>
                        <input id="org-name" className="modal-input" type="text" placeholder="ACME Inc."
                          value={orgForm.orgName}
                          onChange={(ev) => setOrgForm((f) => ({ ...f, orgName: ev.target.value }))} />
                        <p className="modal-help">The name of the organization that issues credentials.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-website">Website</label>
                        <input id="org-website" className="modal-input" type="url" placeholder="https://example.org"
                          value={orgForm.website}
                          onChange={(ev) => setOrgForm((f) => ({ ...f, website: ev.target.value }))} />
                        {orgForm.website.trim() && !isValidUrl(orgForm.website.trim()) && (
                          <p className="modal-error" style={{ marginTop: "0.25rem" }}>Enter a valid URL (e.g. https://example.org).</p>
                        )}
                        <p className="modal-help">The official website of the organization.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-contact-name">Contact full name</label>
                        <input id="org-contact-name" className="modal-input" type="text" placeholder="Full name of the requester"
                          value={orgForm.contactName}
                          onChange={(ev) => setOrgForm((f) => ({ ...f, contactName: ev.target.value }))} />
                        <p className="modal-help">The person requesting verification for this organization.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-contact-email">Contact email</label>
                        <input id="org-contact-email" className="modal-input" type="email" placeholder="you@example.com"
                          value={orgForm.contactEmail}
                          onChange={(ev) => setOrgForm((f) => ({ ...f, contactEmail: ev.target.value }))} />
                        <p className="modal-help">
                          Must match the website domain (e.g. <code>you@yourorg.com</code>). Personal providers like Gmail or Outlook will be rejected.
                        </p>
                        {getOrgDomainWarning() && (
                          <p className="modal-error" style={{ marginTop: "0.25rem" }}>
                            {getOrgDomainWarning()}
                          </p>
                        )}
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-country">Country</label>
                        <input id="org-country" className="modal-input" type="text" placeholder="Country where the organization operates"
                          value={orgForm.country}
                          onChange={(ev) => setOrgForm((f) => ({ ...f, country: ev.target.value }))} />
                        <p className="modal-help">Country where the organization operates.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-role">Role in the organization</label>
                        <input id="org-role" className="modal-input" type="text" placeholder="Your role or relationship with the organization"
                          value={orgForm.role}
                          onChange={(ev) => setOrgForm((f) => ({ ...f, role: ev.target.value }))} />
                        <p className="modal-help">Your role or relationship with the organization.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-support-link">Supporting link</label>
                        <input id="org-support-link" className="modal-input" type="url" placeholder="https://example.org/your-profile"
                          value={orgForm.supportLink}
                          onChange={(ev) => setOrgForm((f) => ({ ...f, supportLink: ev.target.value }))} />
                        {orgForm.supportLink.trim() && !isValidUrl(orgForm.supportLink.trim()) && (
                          <p className="modal-error" style={{ marginTop: "0.25rem" }}>Enter a valid URL (e.g. https://example.org/your-profile).</p>
                        )}
                        <p className="modal-help">
                          A link showing your relationship with the organization — your profile on the organization website,
                          a LinkedIn listing, or an event page where you appear.
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-wallets">Authorized wallets</label>
                        <textarea id="org-wallets" className="modal-input" rows={3}
                          placeholder={"0x1234...abcd\n0x5678...ef01"}
                          value={orgForm.wallets}
                          onChange={(ev) => setOrgForm((f) => ({ ...f, wallets: ev.target.value }))} />
                        <p className="modal-help">
                          The only wallets allowed to sign on behalf of this organization in HashProof (one address per line).
                        </p>
                      </div>
                    </>
                  )}

                  {verifyType === "individual" && (
                    <>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-name">Full name</label>
                        <input id="ind-name" className="modal-input" type="text" placeholder="Full name as issuer"
                          value={indForm.fullName}
                          onChange={(ev) => setIndForm((f) => ({ ...f, fullName: ev.target.value }))} />
                        <p className="modal-help">The name that will appear as the issuer of credentials.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-profile">Public profile or website</label>
                        <input id="ind-profile" className="modal-input" type="url" placeholder="https://your-site-or-profile"
                          value={indForm.profile}
                          onChange={(ev) => setIndForm((f) => ({ ...f, profile: ev.target.value }))} />
                        {indForm.profile.trim() && !isValidUrl(indForm.profile.trim()) && (
                          <p className="modal-error" style={{ marginTop: "0.25rem" }}>Enter a valid URL (e.g. https://linkedin.com/in/yourname).</p>
                        )}
                        <p className="modal-help">A public profile or website where we can verify your identity.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-email">Contact email</label>
                        <input id="ind-email" className="modal-input" type="email" placeholder="you@example.com"
                          value={indForm.email}
                          onChange={(ev) => setIndForm((f) => ({ ...f, email: ev.target.value }))} />
                        <p className="modal-help">We may contact you if additional verification is required.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-country">Country</label>
                        <input id="ind-country" className="modal-input" type="text" placeholder="Country where you are based"
                          value={indForm.country}
                          onChange={(ev) => setIndForm((f) => ({ ...f, country: ev.target.value }))} />
                        <p className="modal-help">Country where you operate or are primarily based.</p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-wallets">Authorized wallets</label>
                        <textarea id="ind-wallets" className="modal-input" rows={3}
                          placeholder={"0x1234...abcd\n0x5678...ef01"}
                          value={indForm.wallets}
                          onChange={(ev) => setIndForm((f) => ({ ...f, wallets: ev.target.value }))} />
                        <p className="modal-help">
                          The only wallets allowed to sign on your behalf as an individual issuer in HashProof (one address per line).
                        </p>
                      </div>
                    </>
                  )}

                  {formError && <p className="modal-error">{formError}</p>}
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setVerifyDialogStep("intro")}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-action"
                      disabled={!isFormComplete() || !!getOrgDomainWarning()}
                      onClick={() => { setFormError(""); setVerifyDialogStep("payment"); }}
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}

              {/* ── Step 3: Payment ── */}
              {verifyDialogStep === "payment" && (
                <>
                  <h2 className="modal-title">Review &amp; pay</h2>
                  <p className="modal-text">
                    You are submitting a{" "}
                    <strong>{verifyType}</strong> verification request for{" "}
                    <strong className="modal-entity-name">{e.display_name || "this entity"}</strong>.
                  </p>
                  <p className="modal-fee">
                    <span className="modal-fee-label">Amount due:</span>{" "}
                    <span className="modal-fee-amount">$0.10 USDC</span>
                  </p>
                  <p className="modal-gasless">⛽ No gas fees for this transaction.</p>

                  <div className="modal-field" style={{ marginTop: "1.25rem" }}>
                    <label className="modal-label" htmlFor="payment-network">Pay with</label>
                    {ACTIVE_CHAINS.length === 1 ? (
                      <p className="modal-help" style={{ marginTop: 0 }}>
                        <strong>{PAYMENT_TOKEN}</strong> on <strong>{selectedChainConfig.name}</strong>
                      </p>
                    ) : (
                      <select
                        id="payment-network"
                        className="modal-select"
                        value={selectedNetworkKey}
                        onChange={(ev) => setSelectedNetworkKey(ev.target.value)}
                      >
                        {ACTIVE_CHAINS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {PAYMENT_TOKEN} on {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {activeAccount && (
                    <div className="modal-wallet-info">
                      <div className="modal-wallet-row">
                        <span className="modal-wallet-label">Wallet</span>
                        <code className="modal-wallet-address">
                          {activeAccount.address.slice(0, 6)}…{activeAccount.address.slice(-4)}
                        </code>
                        <button
                          type="button"
                          className="modal-wallet-disconnect"
                          onClick={() => activeWallet && disconnect(activeWallet)}
                        >
                          Disconnect
                        </button>
                      </div>
                      <div className="modal-wallet-row">
                        <span className="modal-wallet-label">Balance</span>
                        <span>
                          {isBalanceLoading
                            ? "Loading…"
                            : `${usdcBalance?.displayValue ?? "0"} ${PAYMENT_TOKEN}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {activeAccount && !isBalanceLoading && !hasSufficientBalance && (
                    <p className="modal-error" style={{ marginTop: "0.75rem" }}>
                      Insufficient {PAYMENT_TOKEN} balance on {selectedChainConfig.name}.
                      You need at least ${VERIFICATION_PRICE_USDC.toFixed(2)} {PAYMENT_TOKEN} to proceed.
                    </p>
                  )}
                  {formError && <p className="modal-error">{formError}</p>}
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => { setFormError(""); setVerifyDialogStep("form"); }}
                    >
                      Back
                    </button>
                    {!activeAccount ? (
                      <ConnectButton
                        client={thirdwebClient}
                        wallets={WALLETS}
                        connectButton={{
                          label: "Connect Wallet",
                          style: {
                            fontFamily: "inherit",
                            fontSize: "0.9rem",
                            fontWeight: 700,
                            padding: "0.65rem 1.5rem",
                            borderRadius: "10px",
                            border: "none",
                            background: "#fff",
                            color: "#0a0a0b",
                            cursor: "pointer",
                          },
                        }}
                      />
                    ) : (
                      <button
                        type="button"
                        className="btn btn-action"
                        disabled={!hasSufficientBalance || isPaymentPending}
                        onClick={handleSubmitVerify}
                      >
                        {isPaymentPending ? "Processing…" : "Submit & Pay"}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* ── Success ── */}
              {verifyDialogStep === "success" && (
                <>
                  <h2 className="modal-title">Request submitted</h2>
                  <p className="modal-text">
                    Your verification request for{" "}
                    <strong className="modal-entity-name">{e.display_name || "this entity"}</strong>{" "}
                    has been submitted. We will review it and get back to you.
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
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

