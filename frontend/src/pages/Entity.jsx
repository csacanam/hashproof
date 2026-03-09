import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

export default function Entity() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      </main>
    </div>
  );
}

