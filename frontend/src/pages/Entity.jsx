import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";
import { getPreferredLocale, createTranslator } from "../i18n.js";
import { entityMessages } from "../locales/entity.js";
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
  const locale = useMemo(() => getPreferredLocale(), []);
  const t = useMemo(() => createTranslator(entityMessages, locale), [locale]);
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verifyDialogStep, setVerifyDialogStep] = useState("intro"); // "intro" | "form" | "payment" | "success"
  const [verifyType, setVerifyType] = useState(""); // "" | "individual" | "organization"

  const [selectedNetworkKey, setSelectedNetworkKey] = useState(
    PRIMARY_CHAIN_CONFIG.key,
  );
  const selectedChainConfig =
    ACTIVE_CHAINS.find((c) => c.key === selectedNetworkKey) ??
    PRIMARY_CHAIN_CONFIG;

  const activeAccount = useActiveAccount();
  const activeWallet = useActiveWallet();
  const { disconnect } = useDisconnect();
  const { data: usdcBalance, isLoading: isBalanceLoading } = useWalletBalance({
    address: activeAccount?.address,
    chain: selectedChainConfig.chain,
    client: thirdwebClient,
    tokenAddress: selectedChainConfig.usdcAddress,
  });

  const hasSufficientBalance =
    !isBalanceLoading &&
    parseFloat(usdcBalance?.displayValue ?? "0") >= VERIFICATION_PRICE_USDC;

  const { fetchWithPayment, isPending: isPaymentPending } =
    useFetchWithPayment(thirdwebClient);
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
        if (!res.ok)
          throw new Error(
            res.status === 404
              ? "entity.state.notFound"
              : "entity.state.fetchFailed",
          );
        return res.json();
      })
      .then(setData)
      // The thrown message is a translation key; anything else is a network fault.
      .catch((err) =>
        setError(
          err.message?.startsWith("entity.")
            ? err.message
            : "entity.state.fetchFailed",
        ),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const loadProofs = useCallback(() => {
    if (!id) return;
    fetch(`${API_URL}/entities/${id}/proofs`)
      .then((res) => (res.ok ? res.json() : { proofs: [] }))
      .then((d) => setProofs(d.proofs ?? []))
      .catch(() => setProofs([]));
  }, [id]);

  useEffect(() => {
    loadProofs();
  }, [loadProofs]);

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
      if (!res.ok)
        throw new Error(
          body.message || body.error || t("entity.dns.addFailed"),
        );
      setPendingProof(body);
      setCheckOutcome(body.verified ? "verified" : "missing");
      if (body.verified) {
        loadProofs();
        setPendingProof(null);
      }
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
          <title>{t("entity.meta.titleGeneric")}</title>
          <meta name="description" content={t("entity.meta.description")} />
          <meta property="og:type" content="website" />
          <meta
            property="og:url"
            content={`https://hashproof.dev/entities/${id || ""}`}
          />
          <meta property="og:title" content={t("entity.meta.titleGeneric")} />
          <meta
            property="og:description"
            content={t("entity.meta.description")}
          />
          <meta
            property="og:image"
            content="https://hashproof.dev/thumbnail.png"
          />
          <meta name="twitter:card" content="summary_large_image" />
          <meta
            name="twitter:url"
            content={`https://hashproof.dev/entities/${id || ""}`}
          />
          <meta name="twitter:title" content={t("entity.meta.titleGeneric")} />
          <meta
            name="twitter:description"
            content={t("entity.meta.description")}
          />
          <meta
            name="twitter:image"
            content="https://hashproof.dev/thumbnail.png"
          />
        </Helmet>
        <main className="verify-main">
          <div className="verify-loader">
            <div className="verify-loader__spinner" />
            <p className="verify-loader__text">{t("entity.state.loading")}</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page verify-page">
        <Helmet>
          <title>{t("entity.meta.notFoundTitle")}</title>
          <meta name="description" content={t("entity.meta.description")} />
          <meta property="og:type" content="website" />
          <meta
            property="og:url"
            content={`https://hashproof.dev/entities/${id || ""}`}
          />
          <meta property="og:title" content={t("entity.meta.notFoundTitle")} />
          <meta
            property="og:description"
            content={t("entity.meta.description")}
          />
          <meta
            property="og:image"
            content="https://hashproof.dev/thumbnail.png"
          />
          <meta name="twitter:card" content="summary_large_image" />
          <meta
            name="twitter:url"
            content={`https://hashproof.dev/entities/${id || ""}`}
          />
          <meta name="twitter:title" content={t("entity.meta.notFoundTitle")} />
          <meta
            name="twitter:description"
            content={t("entity.meta.description")}
          />
          <meta
            name="twitter:image"
            content="https://hashproof.dev/thumbnail.png"
          />
        </Helmet>
        <SiteHeader plain />
        <main className="verify-main">
          <p className="verify-error">{t(error)}</p>
          <Link to="/" className="link-back">
            {t("entity.back")}
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
      return new URL(
        site.includes("://") ? site : `https://${site}`,
      ).hostname.replace(/^www\./, "");
    } catch {
      return null;
    }
  })();

  const verificationLevel = data?.verification_level ?? "none";

  const entityName = e.display_name || e.slug || "Entity";
  const metaTitle = t("entity.meta.title").replace("{name}", entityName);
  const metaDescription = t("entity.meta.description");
  const dateLocale = locale === "es" ? "es-ES" : "en-US";
  const status = data?.status ?? e.status ?? "unverified";

  const createdAt = e.created_at
    ? new Date(e.created_at).toLocaleDateString(dateLocale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : "—";
  const lastVerified = e.last_verified_at
    ? new Date(e.last_verified_at).toLocaleDateString(dateLocale, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
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
    "gmail.com",
    "outlook.com",
    "hotmail.com",
    "yahoo.com",
    "icloud.com",
    "protonmail.com",
    "me.com",
    "live.com",
  ];

  const parseHostname = (raw) => {
    if (!raw) return null;
    const url = raw.includes("://") ? raw : `https://${raw}`;
    try {
      return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    } catch {
      return null;
    }
  };

  const getOrgDomainWarning = () => {
    const website = orgForm.website.trim();
    const email = orgForm.contactEmail.trim();
    if (!email || !email.includes("@")) return null;

    const emailDomain = email.split("@")[1]?.toLowerCase();
    if (!emailDomain) return null;

    if (GENERIC_EMAIL_PROVIDERS.includes(emailDomain)) {
      return t("entity.error.personalEmail");
    }

    if (!website) return null;
    const websiteDomain = parseHostname(website);
    if (!websiteDomain) return null;

    if (
      !emailDomain.endsWith(websiteDomain) &&
      !websiteDomain.endsWith(emailDomain)
    ) {
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
    } catch {
      return false;
    }
  };

  const isFormComplete = () => {
    if (!verifyType) return false;
    const evmRegex = /^0x[a-fA-F0-9]{40}$/;
    if (verifyType === "organization") {
      const {
        orgName,
        website,
        contactName,
        contactEmail,
        country,
        role,
        supportLink,
        wallets,
      } = orgForm;
      if (
        !orgName.trim() ||
        !contactName.trim() ||
        !contactEmail.trim() ||
        !country.trim() ||
        !role.trim()
      )
        return false;
      if (!isValidUrl(website) || !isValidUrl(supportLink)) return false;
      const list = wallets
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean);
      return list.length > 0 && list.every((w) => evmRegex.test(w));
    }
    const { fullName, profile, email, country, wallets } = indForm;
    if (!fullName.trim() || !email.trim() || !country.trim()) return false;
    if (!isValidUrl(profile)) return false;
    const list = wallets
      .split("\n")
      .map((w) => w.trim())
      .filter(Boolean);
    return list.length > 0 && list.every((w) => evmRegex.test(w));
  };

  const handleSubmitVerify = async () => {
    setFormError("");
    if (!verifyType) {
      setFormError(t("entity.error.selectType"));
      return;
    }

    if (verifyType === "organization") {
      const {
        orgName,
        website,
        contactName,
        contactEmail,
        country,
        role,
        supportLink,
        wallets,
      } = orgForm;
      if (
        !orgName.trim() ||
        !website.trim() ||
        !contactName.trim() ||
        !contactEmail.trim() ||
        !country.trim() ||
        !role.trim() ||
        !supportLink.trim()
      ) {
        setFormError(t("entity.error.completeFields"));
        return;
      }
      const walletList = wallets
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean);
      if (walletList.length === 0) {
        setFormError(t("entity.error.oneWallet"));
        return;
      }
      const evmRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletList.every((w) => evmRegex.test(w))) {
        setFormError(t("entity.error.walletFormat"));
        return;
      }
    } else {
      const { fullName, profile, email, country, wallets } = indForm;
      if (
        !fullName.trim() ||
        !profile.trim() ||
        !email.trim() ||
        !country.trim()
      ) {
        setFormError(t("entity.error.completeFields"));
        return;
      }
      const walletList = wallets
        .split("\n")
        .map((w) => w.trim())
        .filter(Boolean);
      if (walletList.length === 0) {
        setFormError(t("entity.error.oneWallet"));
        return;
      }
      const evmRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!walletList.every((w) => evmRegex.test(w))) {
        setFormError(t("entity.error.walletFormat"));
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
            `Please add ${PAYMENT_TOKEN} on ${ACTIVE_CHAINS.map((c) => c.name).join(", ")} and try again.`,
        );
      } else {
        setFormError(msg || t("entity.error.requestFailed"));
      }
    }
  };

  return (
    <div className="page verify-page">
      <Helmet>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDescription} />
        <meta property="og:type" content="website" />
        <meta
          property="og:url"
          content={`https://hashproof.dev/entities/${id || ""}`}
        />
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta
          property="og:image"
          content="https://hashproof.dev/thumbnail.png"
        />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:url"
          content={`https://hashproof.dev/entities/${id || ""}`}
        />
        <meta name="twitter:title" content={metaTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta
          name="twitter:image"
          content="https://hashproof.dev/thumbnail.png"
        />
      </Helmet>
      <SiteHeader plain />

      <main className="verify-main">
        <div className="verify-card">
          <div className="verify-header entity-header">
            <h1>{entityName}</h1>
            <span
              className={`entity-flag entity-flag--${
                verificationLevel === "verified"
                  ? "verified"
                  : status === "suspended"
                    ? "suspended"
                    : verificationLevel === "reviewed"
                      ? "reviewed"
                      : "unverified"
              }`}
            >
              {status === "suspended"
                ? t("entity.flag.suspended")
                : verificationLevel === "verified"
                  ? t("entity.flag.verified")
                  : verificationLevel === "reviewed"
                    ? t("entity.flag.reviewed")
                    : t("entity.flag.unverified")}
            </span>
          </div>

          {/* What this issuer has done. An issuer with thousands of credentials
              over months reads differently from one registered yesterday, and
              that context belonged on the page as much as our checks do. */}
          {typeof data?.credentials_issued === "number" &&
            data.credentials_issued > 0 && (
              <p className="entity-activity">
                <strong>
                  {data.credentials_issued.toLocaleString(dateLocale)}
                </strong>{" "}
                {data.credentials_issued === 1
                  ? t("entity.activity.one")
                  : t("entity.activity.many")}
                {data.first_issued_at && (
                  <>
                    {" "}
                    {t("entity.activity.since").replace(
                      "{date}",
                      new Date(data.first_issued_at).toLocaleDateString(
                        dateLocale,
                        { month: "long", year: "numeric" },
                      ),
                    )}
                  </>
                )}
              </p>
            )}

          {status === "unverified" && (
            <div className="verify-section">
              <p className="verify-card-description">
                {t("entity.request.lead")}
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
                {t("entity.request.button")}
              </button>
            </div>
          )}

          <div className="verify-section proofs-section">
            <h2 className="proofs-title">{t("entity.verified.title")}</h2>

            <div className="entity-check">
              <span
                className={`entity-check-mark entity-check-mark--${verificationLevel === "none" ? "pending" : "ok"}`}
                aria-hidden
              >
                {verificationLevel === "none" ? "○" : "✓"}
              </span>
              <div>
                <strong>{t("entity.verified.identity")}</strong>
                <span className="proofs-record-hint">
                  {verificationLevel === "none"
                    ? t("entity.verified.identityNone")
                    : lastVerified !== "—"
                      ? t("entity.verified.identityDoneOn").replace(
                          "{date}",
                          lastVerified,
                        )
                      : t("entity.verified.identityDone")}
                </span>
              </div>
            </div>

            <div className="entity-check">
              <span
                className={`entity-check-mark entity-check-mark--${proofs.length ? "ok" : "pending"}`}
                aria-hidden
              >
                {proofs.length ? "✓" : "○"}
              </span>
              <div>
                <strong>{t("entity.verified.domain")}</strong>
                <span className="proofs-record-hint">
                  {t("entity.verified.domainBody")}
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
                          <summary>{t("entity.dns.check")}</summary>
                          <p className="proofs-record-hint">
                            {t("entity.dns.checkBody")}
                          </p>
                          <code className="proofs-record">
                            dig +short TXT {p.resource}
                          </code>
                          <code className="proofs-record">
                            {p.expected_record}
                          </code>
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
                    {proofBusy
                      ? t("entity.dns.checking")
                      : t("entity.dns.verifyThis")}
                  </button>
                </div>
              )
            ) : (
              <p className="proofs-empty">{t("entity.verified.noDomainYet")}</p>
            )}

            {proofError && <p className="proofs-error">{proofError}</p>}

            {checkOutcome === "verified" && (
              <p className="proofs-success">{t("entity.dns.verifiedNow")}</p>
            )}

            {pendingProof && !pendingProof.verified && (
              <div className="proofs-instructions">
                <p>
                  {t("entity.dns.add")} <strong>{pendingProof.resource}</strong>
                  {t("entity.dns.thenCheck")}
                </p>

                {/* The value alone is not enough to act on — a DNS form asks for
                    three things, and the host is the one people get wrong. */}
                <dl className="proofs-record-spec">
                  <div>
                    <dt>{t("entity.dns.type")}</dt>
                    <dd>
                      <code>TXT</code>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("entity.dns.name")}</dt>
                    <dd>
                      <code>@</code>
                      <span className="proofs-record-hint">
                        {t("entity.dns.nameHint").replace(
                          "{domain}",
                          pendingProof.resource,
                        )}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt>{t("entity.dns.value")}</dt>
                    <dd>
                      <div className="proofs-record-row">
                        <code>{pendingProof.expected_record}</code>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => {
                            navigator.clipboard
                              .writeText(pendingProof.expected_record)
                              .then(
                                () => {
                                  setCopiedRecord(true);
                                  setTimeout(
                                    () => setCopiedRecord(false),
                                    2000,
                                  );
                                },
                                () => {},
                              );
                          }}
                        >
                          {copiedRecord
                            ? t("entity.dns.copied")
                            : t("entity.dns.copy")}
                        </button>
                      </div>
                    </dd>
                  </div>
                </dl>

                <p className="proofs-record-hint">{t("entity.dns.coexists")}</p>
                <button
                  type="button"
                  className="btn btn-action"
                  disabled={proofBusy}
                  onClick={() => submitDomain(pendingProof.resource)}
                >
                  {proofBusy
                    ? t("entity.dns.checking")
                    : t("entity.dns.checkAgain")}
                </button>

                {checkOutcome === "missing" && (
                  <p className="proofs-pending">{t("entity.dns.missing")}</p>
                )}
              </div>
            )}
          </div>

          <dl className="verify-details">
            <div className="verify-detail">
              <dt>{t("entity.details.website")}</dt>
              <dd>
                {e.website ? (
                  <a
                    href={e.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="verify-explorer-link"
                  >
                    {e.website}
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>

            <div className="verify-detail">
              <dt>{t("entity.details.createdAt")}</dt>
              <dd>{createdAt}</dd>
            </div>

            <div className="verify-detail">
              <dt>{t("entity.details.entityId")}</dt>
              <dd>{e.id || id}</dd>
            </div>
          </dl>
        </div>

        {showVerifyDialog && (
          <div className="modal-backdrop" onClick={resetVerifyDialog}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="modal-close"
                aria-label={t("entity.modal.close")}
                onClick={resetVerifyDialog}
              >
                ×
              </button>
              {/* Step indicator */}
              {verifyDialogStep !== "success" && (
                <p className="modal-step">
                  {t("entity.modal.step").replace(
                    "{n}",
                    verifyDialogStep === "intro"
                      ? "1"
                      : verifyDialogStep === "form"
                        ? "2"
                        : "3",
                  )}
                </p>
              )}

              {/* ── Step 1: Info ── */}
              {verifyDialogStep === "intro" && (
                <>
                  <h2 className="modal-title">{t("entity.request.button")}</h2>
                  <p className="modal-text">
                    {t("entity.modal.intro.requesting")}{" "}
                    <strong className="modal-entity-name">
                      {e.display_name || t("entity.modal.thisEntity")}
                    </strong>
                    .
                  </p>
                  <p className="modal-fee">
                    <span className="modal-fee-label">
                      {t("entity.modal.fee")}
                    </span>{" "}
                    <span className="modal-fee-amount">$49</span>
                  </p>
                  <p className="modal-text">{t("entity.modal.intro.spam")}</p>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={resetVerifyDialog}
                    >
                      {t("entity.modal.cancel")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-action"
                      onClick={() => setVerifyDialogStep("form")}
                    >
                      {t("entity.modal.continue")}
                    </button>
                  </div>
                </>
              )}

              {/* ── Step 2: Form ── */}
              {verifyDialogStep === "form" && (
                <>
                  <h2 className="modal-title">
                    {t("entity.modal.details.title")}
                  </h2>
                  <p className="modal-text">{t("entity.modal.intro.body")}</p>
                  <div className="modal-field">
                    <label className="modal-label" htmlFor="verify-type">
                      {t("entity.modal.type")}
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
                      <option value="">
                        {t("entity.modal.typePlaceholder")}
                      </option>
                      <option value="individual">
                        {t("entity.modal.individual")}
                      </option>
                      <option value="organization">
                        {t("entity.modal.organization")}
                      </option>
                    </select>
                  </div>

                  {verifyType === "organization" && (
                    <>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-name">
                          {t("entity.form.orgName")}
                        </label>
                        <input
                          id="org-name"
                          className="modal-input"
                          type="text"
                          placeholder={t("entity.form.orgNamePlaceholder")}
                          value={orgForm.orgName}
                          onChange={(ev) =>
                            setOrgForm((f) => ({
                              ...f,
                              orgName: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.orgNameHelp")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-website">
                          {t("entity.details.website")}
                        </label>
                        <input
                          id="org-website"
                          className="modal-input"
                          type="url"
                          placeholder={t("entity.form.websitePlaceholder")}
                          value={orgForm.website}
                          onChange={(ev) =>
                            setOrgForm((f) => ({
                              ...f,
                              website: ev.target.value,
                            }))
                          }
                        />
                        {orgForm.website.trim() &&
                          !isValidUrl(orgForm.website.trim()) && (
                            <p
                              className="modal-error"
                              style={{ marginTop: "0.25rem" }}
                            >
                              {t("entity.form.invalidUrl")}
                            </p>
                          )}
                        <p className="modal-help">
                          {t("entity.form.websiteHelp")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label
                          className="modal-label"
                          htmlFor="org-contact-name"
                        >
                          {t("entity.form.contactName")}
                        </label>
                        <input
                          id="org-contact-name"
                          className="modal-input"
                          type="text"
                          placeholder={t("entity.form.contactNamePlaceholder")}
                          value={orgForm.contactName}
                          onChange={(ev) =>
                            setOrgForm((f) => ({
                              ...f,
                              contactName: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.contactNameHelp")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label
                          className="modal-label"
                          htmlFor="org-contact-email"
                        >
                          {t("entity.form.contactEmail")}
                        </label>
                        <input
                          id="org-contact-email"
                          className="modal-input"
                          type="email"
                          placeholder={t("entity.form.contactEmailPlaceholder")}
                          value={orgForm.contactEmail}
                          onChange={(ev) =>
                            setOrgForm((f) => ({
                              ...f,
                              contactEmail: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.emailMustMatch")}{" "}
                          <code>{t("entity.form.emailExample")}</code>
                          {t("entity.form.emailRejected")}
                        </p>
                        {getOrgDomainWarning() && (
                          <p
                            className="modal-error"
                            style={{ marginTop: "0.25rem" }}
                          >
                            {getOrgDomainWarning()}
                          </p>
                        )}
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-country">
                          {t("entity.form.country")}
                        </label>
                        <input
                          id="org-country"
                          className="modal-input"
                          type="text"
                          placeholder={t("entity.form.countryPlaceholderOrg")}
                          value={orgForm.country}
                          onChange={(ev) =>
                            setOrgForm((f) => ({
                              ...f,
                              country: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.countryHelpOrg")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-role">
                          {t("entity.form.role")}
                        </label>
                        <input
                          id="org-role"
                          className="modal-input"
                          type="text"
                          placeholder={t("entity.form.rolePlaceholder")}
                          value={orgForm.role}
                          onChange={(ev) =>
                            setOrgForm((f) => ({ ...f, role: ev.target.value }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.roleHelp")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label
                          className="modal-label"
                          htmlFor="org-support-link"
                        >
                          {t("entity.form.supportLink")}
                        </label>
                        <input
                          id="org-support-link"
                          className="modal-input"
                          type="url"
                          placeholder={t("entity.form.supportLinkPlaceholder")}
                          value={orgForm.supportLink}
                          onChange={(ev) =>
                            setOrgForm((f) => ({
                              ...f,
                              supportLink: ev.target.value,
                            }))
                          }
                        />
                        {orgForm.supportLink.trim() &&
                          !isValidUrl(orgForm.supportLink.trim()) && (
                            <p
                              className="modal-error"
                              style={{ marginTop: "0.25rem" }}
                            >
                              {t("entity.form.invalidProfileUrl")}
                            </p>
                          )}
                        <p className="modal-help">
                          {t("entity.form.supportLinkHelp")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="org-wallets">
                          {t("entity.form.wallets")}
                        </label>
                        <textarea
                          id="org-wallets"
                          className="modal-input"
                          rows={3}
                          placeholder={"0x1234...abcd\n0x5678...ef01"}
                          value={orgForm.wallets}
                          onChange={(ev) =>
                            setOrgForm((f) => ({
                              ...f,
                              wallets: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.walletsHelpOrg")}
                        </p>
                      </div>
                    </>
                  )}

                  {verifyType === "individual" && (
                    <>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-name">
                          {t("entity.form.fullName")}
                        </label>
                        <input
                          id="ind-name"
                          className="modal-input"
                          type="text"
                          placeholder={t("entity.form.fullNamePlaceholder")}
                          value={indForm.fullName}
                          onChange={(ev) =>
                            setIndForm((f) => ({
                              ...f,
                              fullName: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.fullNameHelp")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-profile">
                          {t("entity.form.profile")}
                        </label>
                        <input
                          id="ind-profile"
                          className="modal-input"
                          type="url"
                          placeholder={t("entity.form.profilePlaceholder")}
                          value={indForm.profile}
                          onChange={(ev) =>
                            setIndForm((f) => ({
                              ...f,
                              profile: ev.target.value,
                            }))
                          }
                        />
                        {indForm.profile.trim() &&
                          !isValidUrl(indForm.profile.trim()) && (
                            <p
                              className="modal-error"
                              style={{ marginTop: "0.25rem" }}
                            >
                              {t("entity.form.invalidLinkedin")}
                            </p>
                          )}
                        <p className="modal-help">
                          {t("entity.form.profileHelp")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-email">
                          {t("entity.form.contactEmail")}
                        </label>
                        <input
                          id="ind-email"
                          className="modal-input"
                          type="email"
                          placeholder={t("entity.form.contactEmailPlaceholder")}
                          value={indForm.email}
                          onChange={(ev) =>
                            setIndForm((f) => ({
                              ...f,
                              email: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.emailContactHelp")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-country">
                          {t("entity.form.country")}
                        </label>
                        <input
                          id="ind-country"
                          className="modal-input"
                          type="text"
                          placeholder={t(
                            "entity.form.countryPlaceholderIndividual",
                          )}
                          value={indForm.country}
                          onChange={(ev) =>
                            setIndForm((f) => ({
                              ...f,
                              country: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.countryHelpIndividual")}
                        </p>
                      </div>
                      <div className="modal-field">
                        <label className="modal-label" htmlFor="ind-wallets">
                          {t("entity.form.wallets")}
                        </label>
                        <textarea
                          id="ind-wallets"
                          className="modal-input"
                          rows={3}
                          placeholder={"0x1234...abcd\n0x5678...ef01"}
                          value={indForm.wallets}
                          onChange={(ev) =>
                            setIndForm((f) => ({
                              ...f,
                              wallets: ev.target.value,
                            }))
                          }
                        />
                        <p className="modal-help">
                          {t("entity.form.walletsHelpIndividual")}
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
                      {t("entity.modal.back")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-action"
                      disabled={!isFormComplete() || !!getOrgDomainWarning()}
                      onClick={() => {
                        setFormError("");
                        setVerifyDialogStep("payment");
                      }}
                    >
                      {t("entity.modal.continue")}
                    </button>
                  </div>
                </>
              )}

              {/* ── Step 3: Payment ── */}
              {verifyDialogStep === "payment" && (
                <>
                  <h2 className="modal-title">{t("entity.modal.pay.title")}</h2>
                  <p className="modal-text">
                    {t("entity.modal.pay.submittingPrefix")}{" "}
                    <strong>
                      {t(`entity.modal.${verifyType}`).toLowerCase()}
                    </strong>{" "}
                    {t("entity.modal.pay.submittingMid")}{" "}
                    <strong className="modal-entity-name">
                      {e.display_name || t("entity.modal.thisEntity")}
                    </strong>
                    .
                  </p>
                  <p className="modal-fee">
                    <span className="modal-fee-label">
                      {t("entity.modal.pay.amount")}
                    </span>{" "}
                    <span className="modal-fee-amount">$49 USDC</span>
                  </p>
                  <p className="modal-gasless">
                    {t("entity.modal.pay.gasless")}
                  </p>

                  <p className="modal-help modal-next-step">
                    <strong>{t("entity.modal.pay.nextStep")}</strong>{" "}
                    {t("entity.modal.pay.nextStepBody").replace(
                      "{domain}",
                      orgForm.website.trim() ||
                        t("entity.modal.pay.yourDomain"),
                    )}
                  </p>

                  <div className="modal-field" style={{ marginTop: "1.25rem" }}>
                    <label className="modal-label" htmlFor="payment-network">
                      {t("entity.modal.pay.payWith")}
                    </label>
                    {ACTIVE_CHAINS.length === 1 ? (
                      <p className="modal-help" style={{ marginTop: 0 }}>
                        <strong>{PAYMENT_TOKEN}</strong>{" "}
                        {t("entity.modal.pay.on")}{" "}
                        <strong>{selectedChainConfig.name}</strong>
                      </p>
                    ) : (
                      <select
                        id="payment-network"
                        className="modal-select"
                        value={selectedNetworkKey}
                        onChange={(ev) =>
                          setSelectedNetworkKey(ev.target.value)
                        }
                      >
                        {ACTIVE_CHAINS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {PAYMENT_TOKEN} {t("entity.modal.pay.on")} {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {activeAccount && (
                    <div className="modal-wallet-info">
                      <div className="modal-wallet-row">
                        <span className="modal-wallet-label">
                          {t("entity.modal.pay.wallet")}
                        </span>
                        <code className="modal-wallet-address">
                          {activeAccount.address.slice(0, 6)}…
                          {activeAccount.address.slice(-4)}
                        </code>
                        <button
                          type="button"
                          className="modal-wallet-disconnect"
                          onClick={() =>
                            activeWallet && disconnect(activeWallet)
                          }
                        >
                          {t("entity.modal.pay.disconnect")}
                        </button>
                      </div>
                      <div className="modal-wallet-row">
                        <span className="modal-wallet-label">
                          {t("entity.modal.pay.balance")}
                        </span>
                        <span>
                          {isBalanceLoading
                            ? t("entity.modal.pay.loadingBalance")
                            : `${usdcBalance?.displayValue ?? "0"} ${PAYMENT_TOKEN}`}
                        </span>
                      </div>
                    </div>
                  )}

                  {activeAccount &&
                    !isBalanceLoading &&
                    !hasSufficientBalance && (
                      <p
                        className="modal-error"
                        style={{ marginTop: "0.75rem" }}
                      >
                        {t("entity.modal.pay.insufficient")
                          .replaceAll("{token}", PAYMENT_TOKEN)
                          .replace("{chain}", selectedChainConfig.name)
                          .replace(
                            "{amount}",
                            VERIFICATION_PRICE_USDC.toFixed(2),
                          )}
                      </p>
                    )}
                  {formError && <p className="modal-error">{formError}</p>}
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        setFormError("");
                        setVerifyDialogStep("form");
                      }}
                    >
                      {t("entity.modal.back")}
                    </button>
                    {!activeAccount ? (
                      <ConnectButton
                        client={thirdwebClient}
                        wallets={WALLETS}
                        connectButton={{
                          label: t("entity.modal.pay.connect"),
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
                        {isPaymentPending
                          ? t("entity.modal.pay.processing")
                          : t("entity.modal.pay.submit")}
                      </button>
                    )}
                  </div>
                </>
              )}

              {/* ── Success ── */}
              {verifyDialogStep === "success" && (
                <>
                  <h2 className="modal-title">
                    {t("entity.modal.submitted.title")}
                  </h2>
                  <p className="modal-text">
                    {t("entity.modal.submitted.prefix")}{" "}
                    <strong className="modal-entity-name">
                      {e.display_name || t("entity.modal.thisEntity")}
                    </strong>{" "}
                    {t("entity.modal.submitted.suffix")}
                  </p>
                  <div className="modal-actions">
                    <button
                      type="button"
                      className="btn btn-action"
                      onClick={resetVerifyDialog}
                    >
                      {t("entity.modal.done")}
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
