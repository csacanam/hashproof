import { Link } from "react-router-dom";
import SiteHeader from "../components/SiteHeader.jsx";
import SiteFooter from "../components/SiteFooter.jsx";

export default function EntityVerification() {
  return (
    <div className="page ev-page">
      <SiteHeader />

      <main className="ev-main">

        {/* Hero */}
        <section className="ev-hero">
          <div className="ev-badge">Entity Verification</div>
          <h1 className="ev-h1">Get verified on HashProof</h1>
          <p className="ev-lead">
            A verified badge on every credential you issue — so recipients and verifiers
            know your identity has been reviewed by HashProof.
          </p>
        </section>

        {/* Why it matters */}
        <section className="ev-section">
          <h2 className="ev-h2">Why verify?</h2>
          <div className="ev-cards">
            <div className="ev-card">
              <span className="ev-card-icon">✅</span>
              <h3>Verified badge on every credential</h3>
              <p>Your credentials show a verified issuer badge when anyone scans the QR code or visits the verification URL.</p>
            </div>
            <div className="ev-card">
              <span className="ev-card-icon">🔐</span>
              <h3>Authorized wallets</h3>
              <p>Only wallets you declare can issue credentials on your behalf — no one can impersonate your organization.</p>
            </div>
            <div className="ev-card">
              <span className="ev-card-icon">🤝</span>
              <h3>Trust for your recipients</h3>
              <p>Anyone who scans a credential you issued can see that HashProof has reviewed and approved your identity — not just a self-declared name.</p>
            </div>
          </div>
        </section>

        {/* Types */}
        <section className="ev-section">
          <h2 className="ev-h2">Types of verification</h2>
          <div className="ev-types">
            <div className="ev-type">
              <div className="ev-type-header">
                <span className="ev-type-label ev-type-label--individual">Individual</span>
              </div>
              <p className="ev-type-desc">For freelancers, educators, or professionals issuing credentials as a person.</p>
              <ul className="ev-type-list">
                <li>Full legal name</li>
                <li>Public profile or website</li>
                <li>Contact email</li>
                <li>Country</li>
                <li>Authorized EVM wallet addresses</li>
              </ul>
            </div>
            <div className="ev-type">
              <div className="ev-type-header">
                <span className="ev-type-label ev-type-label--org">Organization</span>
              </div>
              <p className="ev-type-desc">For companies, schools, DAOs, or platforms issuing on behalf of an institution.</p>
              <ul className="ev-type-list">
                <li>Legal organization name</li>
                <li>Corporate website</li>
                <li>Contact person's name and role</li>
                <li>Contact email (domain must match website)</li>
                <li>Country</li>
                <li>Supporting link (your profile on the organization's site)</li>
                <li>Authorized EVM wallet addresses</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Process */}
        <section className="ev-section">
          <h2 className="ev-h2">How it works</h2>
          <ol className="ev-steps">
            <li>
              <span className="ev-step-num">1</span>
              <div>
                <strong>Find your entity page</strong>
                <p>Go to <code>hashproof.dev/entities/your-slug</code>. If your entity doesn't exist yet, it's created automatically the first time you issue a credential with your slug.</p>
              </div>
            </li>
            <li>
              <span className="ev-step-num">2</span>
              <div>
                <strong>Click "Request verification"</strong>
                <p>Fill the form for individual or organization. Provide your contact info, website, and the EVM wallet address authorized to issue credentials.</p>
              </div>
            </li>
            <li>
              <span className="ev-step-num">3</span>
              <div>
                <strong>Pay $0.10 USDC</strong>
                <p>The verification request is submitted on-chain via x402. Payment is made with USDC on Base or Celo — no gas fees on your end.</p>
              </div>
            </li>
            <li>
              <span className="ev-step-num">4</span>
              <div>
                <strong>HashProof reviews your request</strong>
                <p>We manually review submissions within a few business days. We check that your email domain matches your website and that the entity is legitimate.</p>
              </div>
            </li>
            <li>
              <span className="ev-step-num">5</span>
              <div>
                <strong>You're verified</strong>
                <p>Your entity is marked as verified and your authorized wallets are activated. All credentials you issue from that point on show the verified badge.</p>
              </div>
            </li>
          </ol>
        </section>

        {/* CTA */}
        <section className="ev-cta-section">
          <h2 className="ev-h2">Ready to get verified?</h2>

          <div className="ev-cta-block">
            <div className="ev-cta-option">
              <p className="ev-cta-option-label">Already issued credentials?</p>
              <p className="ev-cta-option-desc">
                Your entity page is at{" "}
                <code>hashproof.dev/entities/your-slug</code>.
                Open it and click <strong>Request verification</strong>.
              </p>
            </div>
            <div className="ev-cta-option">
              <p className="ev-cta-option-label">New to HashProof?</p>
              <p className="ev-cta-option-desc">
                Your entity is created automatically the first time you issue a credential.
                Start there, then come back to request verification.
              </p>
              <Link to="/docs" className="btn btn-primary" style={{ marginTop: "0.75rem", display: "inline-block" }}>
                Issue your first credential →
              </Link>
            </div>
          </div>

        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
