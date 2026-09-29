import { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatDate } from "../format.js";

export default function Team() {
  const { t, locale, org, orgPath, canManage, role, user, reloadMe } = useDashboard();
  const [members, setMembers] = useState(null);
  const [email, setEmail] = useState("");
  const [newRole, setNewRole] = useState("issuer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    if (!org) return;
    try {
      setMembers(await api(orgPath("/members")));
    } catch (err) {
      setError(err.message);
    }
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  async function invite(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const out = await api(orgPath("/members"), { method: "POST", body: { email, role: newRole, locale } });
      setNotice(t("team.added", { email: out.email }));
      setEmail("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(m) {
    setError("");
    try {
      await api(orgPath(`/members/${m.user_id}`), { method: "DELETE" });
      if (m.user_id === user?.id) await reloadMe();
      else load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>{t("team.title")}</h1>
          <p className="dash-muted">{t("team.subtitle")}</p>
        </div>
      </header>

      {canManage && (
        <form className="dash-card dash-form dash-inline-form" onSubmit={invite}>
          <label className="dash-field">
            <span>{t("login.email")}</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@organization.com" />
          </label>
          <label className="dash-field">
            <span>{t("team.role")}</span>
            <select value={newRole} onChange={(e) => setNewRole(e.target.value)}>
              <option value="issuer">{t("role.issuer")}</option>
              <option value="admin">{t("role.admin")}</option>
              {role === "owner" && <option value="owner">{t("role.owner")}</option>}
            </select>
          </label>
          <button className="dash-btn" disabled={busy}>
            {busy ? t("common.sending") : t("team.invite")}
          </button>
        </form>
      )}
      {notice && <p className="dash-ok">{notice}</p>}
      {error && <p className="dash-error">{error}</p>}

      <div className="dash-card dash-card--flush">
        <table className="dash-table">
          <thead>
            <tr>
              <th>{t("login.email")}</th>
              <th>{t("team.role")}</th>
              <th>{t("team.since")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.user_id}>
                <td>
                  {m.email}
                  {m.user_id === user?.id && <span className="dash-muted"> ({t("team.you")})</span>}
                </td>
                <td>{t(`role.${m.role}`)}</td>
                <td>{formatDate(m.created_at)}</td>
                <td className="dash-actions">
                  {(role === "owner" || m.user_id === user?.id) && (
                    <button className="dash-link dash-link--danger" onClick={() => remove(m)}>
                      {m.user_id === user?.id ? t("team.leave") : t("team.remove")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="dash-card">
        <h2>{t("team.roles")}</h2>
        <ul className="dash-roles">
          <li>
            <strong>{t("role.owner")}</strong> — {t("role.ownerHelp")}
          </li>
          <li>
            <strong>{t("role.admin")}</strong> — {t("role.adminHelp")}
          </li>
          <li>
            <strong>{t("role.issuer")}</strong> — {t("role.issuerHelp")}
          </li>
        </ul>
      </section>
    </div>
  );
}
