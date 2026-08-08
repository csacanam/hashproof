import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
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
const VERIFICATION_PRICE_USDC = 49;

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

  // Domain proofs. Anyone may claim a domain — a claim is worthless without
  // control of it — so only proofs that currently resolve are ever listed.
  const [proofs, setProofs] = useState([]);
  const [pendingProof, setPendingProof] = useState(null);
  const [proofBusy, setProofBusy] = useState(false);
  const [proofError, setProofError] = useState("");
  const [copiedRecord, setCopiedRecord] = useState(false);
  // Distinguishes "just asked for the record" from "asked again and it is still
  // not there". Without it a failed check changed nothing on screen, which reads
  // as the button doing nothing at all.
  const [checkOutcome, setCheckOutcome] = useState(null);

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

  const loadProofs = useCallback(() => {
    if (!id) return;
    fetch(`${API_URL}/entities/${id}/proofs`)
      .then((res) => (res.ok ? res.json() : { proofs: [] }))
      .then((d) => setProofs(d.proofs ?? []))
      .catch(() => setProofs([]));
  }, [id]);

  useEffect(() => { loadProofs(); }, [loadProofs]);

  // Declaring is idempotent and re-checks DNS, so the same call serves both
  // "claim this domain" and "I published the record, look again".
  const submitDomain = async (domain) => {
    setProofBusy(true);
    setProofError("");
    setCheckOutcome(null);
    try {
      const res = await fetch(`${API_URL}/entities/${id}/proofs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message || body.error || "Could not add the domain");
      setPendingProof(body);
      setCheckOutcome(body.verified ? "verified" : "missing");
      if (body.verified) { loadProofs(); setPendingProof(null); }
    } catch (err) {
      setProofError(err.message);
    } finally {
      setProofBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="page verify-page verify-page--loading">
        <Helmet>
          <title>Entity profile | HashProof</title>
          <meta
            name="description"
            content="View a public entity profile on HashProof. Entities on HashProof can issue or manage verifiable credentials with an API."
          />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={`https://hashproof.dev/entities/${id || ""}`} />
          <meta property="og:title" content="Entity profile | HashProof" />
          <meta
            property="og:description"
            content="View a public entity profile on HashProof. Entities on HashProof can issue or manage verifiable credentials with an API."
          />
          <meta property="og:image" content="https://hashproof.dev/thumbnail.png" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content={`https://hashproof.dev/entities/${id || ""}`} />
          <meta name="twitter:title" content="Entity profile | HashProof" />
          <meta
            name="twitter:description"
            content="View a public entity profile on HashProof. Entities on HashProof can issue or manage verifiable credentials with an API."
          />
          <meta name="twitter:image" content="https://hashproof.dev/thumbnail.png" />
        </Helmet>
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
        <Helmet>
          <title>Entity not found | HashProof</title>
          <meta
            name="description"
            content="View a public entity profile on HashProof. Entities on HashProof can issue or manage verifiable credentials with an API."
          />
          <meta property="og:type" content="website" />
          <meta property="og:url" content={`https://hashproof.dev/entities/${id || ""}`} />
          <meta property="og:title" content="Entity not found | HashProof" />
          <meta
            property="og:description"
            content="View a public entity profile on HashProof. Entities on HashProof can issue or manage verifiable credentials with an API."
          />
          <meta property="og:image" content="https://hashproof.dev/thumbnail.png" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:url" content={`https://hashproof.dev/entities/${id || ""}`} />
          <meta name="twitter:title" content="Entity not found | HashProof" />
          <meta
            name="twitter:description"
            content="View a public entity profile on HashProof. Entities on HashProof can issue or manage verifiable credentials with an API."
          />
          <meta name="twitter:image" content="https://hashproof.dev/thumbnail.png" />
        </Helmet>
        <SiteHeader plain />
        <main className="verify-main">
          <p className="verify-error">{error}</p>
          <Link to="/" className="link-back">
            ← Back to home
          </Link>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const e = data?.entity ?? data ?? {};
  // Derived from the website on record, never typed. That is the one domain
  // this issuer can prove without credentials, so offering a free-text field
  // only invited entering something that would be refused.
  const claimableDomain = (() => {
    const site = e.website;
    if (!site) return null;
    try {
      return new URL(site.includes("://") ? site : `https://${site}`).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  const verificationLevel = data?.verification_level ?? "none";

  const entityName = e.display_name || e.slug || "Entity";
  const metaTitle = `${entityName} on HashProof`;
  const metaDescription = `View the public profile of ${entityName} on HashProof. Entities on HashProof can issue or manage verifiable credentials with an API.`;
  const status = data?.status ?? e.status ?? "unverified";

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
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`https://hashproof.dev/entities/${id || ""}`} />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:image" content="https://hashproof.dev/thumbnail.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:url" content={`https://hashproof.dev/entities/${id || ""}`} />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content="https://hashproof.dev/thumbnail.png" />
      </Helmet>
      <SiteHeader plain />

      <main className="verify-main">
        <div className="verify-card">
          <div className="verify-header entity-header">
            <h1>{e.display_name || "Entity"}</h1>
            <span className={`entity-flag entity-flag--${
              verificationLevel === "verified" ? "verified"
                : status === "suspended" ? "suspended"
                : verificationLevel === "reviewed" ? "reviewed"
                : "unverified"
            }`}>
              {status === "suspended" ? "suspended"
                : verificationLevel === "verified" ? "verified"
                : verificationLevel === "reviewed" ? "reviewed — domain pending"
                : "unverified"}
            </span>
          </div>

          {/* What this issuer has done. An issuer with thousands of credentials
              over months reads differently from one registered yesterday, and
              that context belonged on the page as much as our checks do. */}
          {typeof data?.credentials_issued === "number" && data.credentials_issued > 0 && (
            <p className="entity-activity">
              <strong>{data.credentials_issued.toLocaleString()}</strong>{" "}
              {data.credentials_issued === 1 ? "credential issued" : "credentials issued"}
              {data.first_issued_at && (
                <> since {new Date(data.first_issued_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}</>
              )}
            </p>
          )}


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

          <div className="verify-section proofs-section">
            <h2 className="proofs-title">What we verified</h2>

            <div className="entity-check">
              <span className={`entity-check-mark entity-check-mark--${verificationLevel === "none" ? "pending" : "ok"}`} aria-hidden>
                {verificationLevel === "none" ? "○" : "✓"}
              </span>
              <div>
                <strong>Organization identity</strong>
                <span className="proofs-record-hint">
                  {verificationLevel === "none"
                    ? "Not reviewed yet."
                    : `Reviewed by HashProof${lastVerified !== "—" ? ` on ${lastVerified}` : ""} — that the organization is real and this domain is theirs.`}
                </span>
              </div>
            </div>

            <div className="entity-check">
              <span className={`entity-check-mark entity-check-mark--${proofs.length ? "ok" : "pending"}`} aria-hidden>
                {proofs.length ? "✓" : "○"}
              </span>
              <div>
                <strong>Domain control</strong>
                <span className="proofs-record-hint">
                  Proven by a DNS record, checked live — the half anyone can confirm
                  without trusting us, and which lapses on its own if the domain moves.
                </span>

                {proofs.length > 0 && (
                  <ul className="proofs-list">
                    {proofs.map((p) => (
                      <li key={p.resource} className="proofs-item">
                        <div className="proofs-item-head">
                          <a
                            href={`https://${p.resource}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="proofs-domain"
                          >
                            {p.resource}
                          </a>
                        </div>

                        {/* Behind a disclosure: the value is what makes this checkable
                            without us, but 64 characters of hash beside every domain
                            buries the one thing the row is meant to say. */}
                        <details className="proofs-detail">
                          <summary>Check it yourself</summary>
                          <p className="proofs-record-hint">
                            Resolve the domain's TXT records and look for this value — no
                            need to take our word for it.
                          </p>
                          <code className="proofs-record">dig +short TXT {p.resource}</code>
                          <code className="proofs-record">{p.expected_record}</code>
                        </details>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {claimableDomain ? (
              !proofs.some((p) => p.resource === claimableDomain) && (
                <div className="proofs-claim">
                  <span className="proofs-claim-domain">{claimableDomain}</span>
                  <button
                    type="button"
                    className="btn btn-action"
                    disabled={proofBusy}
                    onClick={() => submitDomain(claimableDomain)}
                  >
                    {proofBusy ? "Checking…" : "Verify this domain"}
                  </button>
                </div>
              )
            ) : (
              <p className="proofs-empty">
                The domain is established when the organization is verified, so there is
                nothing to prove here yet.
              </p>
            )}

            {proofError && <p className="proofs-error">{proofError}</p>}

            {checkOutcome === "verified" && (
              <p className="proofs-success">✓ Domain verified. It now appears on every credential this issuer signs.</p>
            )}

            {pendingProof && !pendingProof.verified && (
              <div className="proofs-instructions">
                <p>
                  Add this record in the DNS settings for <strong>{pendingProof.resource}</strong>,
                  then check again. Changes can take a few minutes to propagate.
                </p>

                {/* The value alone is not enough to act on — a DNS form asks for
                    three things, and the host is the one people get wrong. */}
                <dl className="proofs-record-spec">
                  <div>
                    <dt>Type</dt>
                    <dd><code>TXT</code></dd>
                  </div>
                  <div>
                    <dt>Name</dt>
                    <dd>
                      <code>@</code>
                      <span className="proofs-record-hint">
                        the root domain — some providers want {pendingProof.resource} instead, or leave it blank
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>Value</dt>
                    <dd>
                      <div className="proofs-record-row">
                        <code>{pendingProof.expected_record}</code>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(pendingProof.expected_record).then(
                              () => { setCopiedRecord(true); setTimeout(() => setCopiedRecord(false), 2000); },
                              () => {}
                            );
                          }}
                        >
                          {copiedRecord ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </dd>
                  </div>
                </dl>

                <p className="proofs-record-hint">
                  It sits alongside any TXT records you already have, such as email.
                </p>
                <button
                  type="button"
                  className="btn btn-action"
                  disabled={proofBusy}
                  onClick={() => submitDomain(pendingProof.resource)}
                >
                  {proofBusy ? "Checking…" : "Check again"}
                </button>

                {checkOutcome === "missing" && (
                  <p className="proofs-pending">
                    Not visible yet. We just looked and the record is not there — if you
                    have only added it, DNS usually takes a few minutes to propagate, so
                    check again shortly. If it has been longer, confirm the value matches
                    exactly and that it is on the root domain.
                  </p>
                )}
              </div>
            )}
          </div>

          <dl className="verify-details">
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
                    <span className="modal-fee-amount">$49</span>
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
                        <p className="modal-help">
                          The official website of the organization. This is the domain you
                          will prove control of by DNS — verification is not complete
                          until you do.
                        </p>
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
                    <span className="modal-fee-amount">$49 USDC</span>
                  </p>
                  <p className="modal-gasless">⛽ No gas fees for this transaction.</p>

                  <p className="modal-help modal-next-step">
                    <strong>One more step after this.</strong> Reviewing your organization
                    is half of it. To be shown as verified you also publish a TXT record on{" "}
                    <strong>{orgForm.website.trim() || "your domain"}</strong>, which is what
                    lets anyone confirm the domain is yours without taking our word for it.
                    We hand you the record once the review is approved.
                  </p>

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
      <SiteFooter />
    </div>
  );
}

