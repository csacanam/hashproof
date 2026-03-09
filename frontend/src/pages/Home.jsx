import { Link } from "react-router-dom";

export default function Home() {
  return (
    <div className="page">
      <header className="header">
        <Link to="/" className="logo">
          HashProof
        </Link>
      </header>

      <main>
        <section className="hero">
          <h1>Generate verifiable credentials with a single API call</h1>
          <p className="hero-lead">
            HashProof allows developers, applications, and AI agents to issue
            credentials that anyone can verify.
          </p>
          <p>
            Pay programmatically using x402 when calling the API.
          </p>
        </section>

        <section className="section">
          <h2>What you can issue</h2>
          <p>
            HashProof lets software generate credentials such as:
          </p>
          <ul>
            <li>Certificates of participation</li>
            <li>Certificates of completion</li>
            <li>Attendance records</li>
            <li>Course or program credentials</li>
            <li>Any custom credential issued by software</li>
          </ul>
          <p>
            Each credential receives a unique ID and becomes publicly verifiable.
          </p>
        </section>

        <section className="section">
          <h2>How it works</h2>

          <h3>1. Issue a credential</h3>
          <p>
            Your application sends credential data to the HashProof API.
          </p>
          <p>Example payload:</p>
          <pre>
{`{
  "recipient_name": "Juan Perez",
  "credential_name": "Blockchain for Developers",
  "issuer": "Example Organization"
}`}
          </pre>

          <h3>2. Receive a credential ID</h3>
          <p>
            The API returns a unique identifier for the credential.
          </p>

          <h3>3. Share the credential</h3>
          <p>
            You can deliver the credential to the recipient or store the ID in your system.
          </p>

          <h3>4. Verify it</h3>
          <p>
            Anyone can verify the credential using the verification page:
          </p>
          <p>
            <code>/verify/:credential_id</code>
          </p>
        </section>

        <section className="section">
          <h2>Payments</h2>
          <p>HashProof uses x402 for API payments.</p>
          <p>
            Instead of creating accounts or managing billing dashboards, clients can pay
            directly when invoking the API.
          </p>
          <p>This enables:</p>
          <ul>
            <li>programmatic payments</li>
            <li>machine-to-machine usage</li>
            <li>AI agents paying for API calls</li>
            <li>simple integration without account management</li>
          </ul>
        </section>

        <section className="section">
          <h2>Verification</h2>
          <p>
            Every credential issued through HashProof can be verified publicly.
          </p>
          <p>A verifier only needs the credential ID.</p>
          <p>Example:</p>
          <p><code>/verify/abc123</code></p>
          <p>
            The verification page displays the credential data and confirms
            whether the credential exists and matches the original issued record.
          </p>
        </section>
      </main>

      <footer className="footer">
        <p>
          HashProof is an API for issuing and verifying digital credentials.
        </p>
        <p>
          Credentials can be generated programmatically and verified through a public verification page.
        </p>
        <p className="footer-copy">
          © HashProof 2026 · Built by{" "}
          <a href="https://x.com/camilosaka" target="_blank" rel="noopener noreferrer">
            @camilosaka
          </a>
        </p>
      </footer>
    </div>
  );
}
