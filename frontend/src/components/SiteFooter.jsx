export default function SiteFooter() {
  return (
    <footer className="footer">
      <p>HashProof is open infrastructure to issue and verify digital credentials.{" "}
        <a href="https://github.com/csacanam/hashproof" target="_blank" rel="noopener noreferrer">
          Source on GitHub
        </a>
      </p>
      <p>
        Questions? <a href="mailto:hi@hashproof.dev">hi@hashproof.dev</a>
      </p>
      <p className="footer-copy">
        © HashProof 2026 · A{" "}
        <a href="https://sakalabs.io" target="_blank" rel="noopener noreferrer">
          Saka Labs
        </a>{" "}
        product
      </p>
    </footer>
  );
}
