import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, publicApi } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatNumber } from "../format.js";
import { digest, guessColumn, parseCsv, toCsv } from "../csv.js";

const CONTEXT_TYPES = ["event", "course", "diploma", "training", "certification", "membership", "other"];
const CREDENTIAL_TYPES = ["attendance", "completion", "achievement", "participation", "membership", "certification"];
const CONCURRENCY = 4;
const POLL_MS = 3000;

/** Poll a job until it finishes. */
async function waitForJob(jobId, { signal } = {}) {
  for (;;) {
    if (signal?.aborted) return null;
    const res = await publicApi(`/issuanceJobs/${jobId}`);
    const job = await res.json().catch(() => null);
    if (job && (job.status === "completed" || job.status === "failed")) return job;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
}

export default function Issue() {
  const { t, org, orgPath, overview } = useDashboard();
  const [templates, setTemplates] = useState(null);
  const [mode, setMode] = useState("single");
  const [common, setCommon] = useState({
    template_slug: "",
    context_type: "event",
    context_title: "",
    credential_type: "attendance",
    title: "",
    expires_at: "",
  });

  useEffect(() => {
    if (!org) return;
    api(orgPath("/templates"))
      .then((list) => {
        setTemplates(list);
        setCommon((c) => ({ ...c, template_slug: c.template_slug || list.find((x) => x.own)?.slug || "hashproof" }));
      })
      .catch(() => setTemplates([]));
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const template = templates?.find((x) => x.slug === common.template_slug) ?? null;
  // Fields the person fills per credential, besides the name (filled from the holder).
  const extraFields = useMemo(
    () => (template?.fields_json || []).filter((f) => f.key !== "holder_name"),
    [template],
  );

  const commonReady = common.context_title.trim() && common.title.trim() && common.template_slug;

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>{t("issue.title")}</h1>
          <p className="dash-muted">{t("issue.subtitle", { balance: formatNumber(overview?.balance ?? 0) })}</p>
        </div>
      </header>

      <section className="dash-card">
        <h2>{t("issue.what")}</h2>
        <div className="dash-grid-2">
          <label className="dash-field">
            <span>{t("issue.template")}</span>
            <select value={common.template_slug} onChange={(e) => setCommon({ ...common, template_slug: e.target.value })}>
              {templates === null && <option>{t("common.loading")}</option>}
              {templates?.some((x) => x.own) && (
                <optgroup label={t("issue.yourTemplates")}>
                  {templates.filter((x) => x.own).map((x) => (
                    <option key={x.id} value={x.slug}>
                      {x.name}
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label={t("issue.catalog")}>
                {templates?.filter((x) => !x.own).map((x) => (
                  <option key={x.id} value={x.slug}>
                    {x.name}
                  </option>
                ))}
              </optgroup>
            </select>
            <small>
              <Link to="/app/templates/new">{t("issue.newTemplate")}</Link>
            </small>
          </label>
          <label className="dash-field">
            <span>{t("issue.contextTitle")}</span>
            <input value={common.context_title} onChange={(e) => setCommon({ ...common, context_title: e.target.value })} placeholder={t("issue.contextTitlePh")} />
          </label>
          <label className="dash-field">
            <span>{t("issue.contextType")}</span>
            <select value={common.context_type} onChange={(e) => setCommon({ ...common, context_type: e.target.value })}>
              {CONTEXT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(`contextType.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="dash-field">
            <span>{t("issue.credentialType")}</span>
            <select value={common.credential_type} onChange={(e) => setCommon({ ...common, credential_type: e.target.value })}>
              {CREDENTIAL_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(`credentialType.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="dash-field">
            <span>{t("issue.credTitle")}</span>
            <input value={common.title} onChange={(e) => setCommon({ ...common, title: e.target.value })} placeholder={t("issue.credTitlePh")} />
            <small className="dash-muted">{t("issue.credTitleHelp")}</small>
          </label>
          <label className="dash-field">
            <span>{t("issue.expires")}</span>
            <input type="date" value={common.expires_at} onChange={(e) => setCommon({ ...common, expires_at: e.target.value })} />
          </label>
        </div>
      </section>

      <div className="dash-tabs" role="tablist">
        <button role="tab" aria-selected={mode === "single"} className={mode === "single" ? "is-active" : ""} onClick={() => setMode("single")}>
          {t("issue.single")}
        </button>
        <button role="tab" aria-selected={mode === "csv"} className={mode === "csv" ? "is-active" : ""} onClick={() => setMode("csv")}>
          {t("issue.csv")}
        </button>
      </div>

      {mode === "single" ? (
        <SingleIssue common={common} extraFields={extraFields} ready={Boolean(commonReady)} />
      ) : (
        <CsvIssue common={common} extraFields={extraFields} ready={Boolean(commonReady)} />
      )}
    </div>
  );
}

function buildInput(common, row) {
  return {
    template_slug: common.template_slug,
    context_type: common.context_type,
    context_title: common.context_title,
    credential_type: common.credential_type,
    title: common.title,
    ...(common.expires_at && { expires_at: new Date(`${common.expires_at}T23:59:59`).toISOString() }),
    holder_name: row.holder_name,
    holder_email: row.holder_email || undefined,
    values: row.values,
  };
}

function SingleIssue({ common, extraFields, ready }) {
  const { t, orgPath, refreshOverview } = useDashboard();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [values, setValues] = useState({});
  const [state, setState] = useState(null); // {phase, job, error}
  // One key per form: a double click, or a retry after a network blip, yields one credential.
  const keyRef = useRef(crypto.randomUUID());

  async function submit(e) {
    e.preventDefault();
    setState({ phase: "queueing" });
    try {
      const out = await api(orgPath("/issue"), {
        method: "POST",
        body: { input: buildInput(common, { holder_name: name, holder_email: email, values }), idempotency_key: keyRef.current },
      });
      setState({ phase: "waiting" });
      refreshOverview();
      const job = await waitForJob(out.job_id);
      setState({ phase: job?.status === "completed" ? "done" : "failed", job });
    } catch (err) {
      setState({ phase: "failed", error: err.message, code: err.code });
    }
  }

  function reset() {
    setName("");
    setEmail("");
    setValues({});
    setState(null);
    keyRef.current = crypto.randomUUID();
  }

  if (state?.phase === "done") {
    const cred = state.job.credential;
    return (
      <section className="dash-card dash-success">
        <h2>{t("issue.done.title")}</h2>
        <p>{t("issue.done.body", { name })}</p>
        <div className="dash-row">
          <a href={cred.verification_url} target="_blank" rel="noreferrer" className="dash-btn">
            {t("issue.done.view")}
          </a>
          <a href={cred.pdf_url} target="_blank" rel="noreferrer" className="dash-btn dash-btn--ghost">
            PDF
          </a>
          <button type="button" className="dash-btn dash-btn--ghost" onClick={reset}>
            {t("issue.done.another")}
          </button>
        </div>
      </section>
    );
  }

  const busy = state?.phase === "queueing" || state?.phase === "waiting";
  return (
    <form className="dash-card dash-form" onSubmit={submit}>
      <div className="dash-grid-2">
        <label className="dash-field">
          <span>{t("issue.holderName")}</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="dash-field">
          <span>{t("issue.holderEmail")}</span>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <small className="dash-muted">{t("issue.holderEmailHelp")}</small>
        </label>
        {extraFields.map((f) => (
          <label className="dash-field" key={f.key}>
            <span>
              {f.key}
              {f.required ? " *" : ""}
            </span>
            <input required={f.required} value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          </label>
        ))}
      </div>
      <p className="dash-muted">{t("issue.costOne")}</p>
      {state?.phase === "failed" && (
        <p className="dash-error">
          {state.error || state.job?.error || t("issue.failed")}{" "}
          {state.code === "insufficient_credits" && <Link to="/app/developers#buy">{t("nav.buyCredits")}</Link>}
        </p>
      )}
      <button className="dash-btn" disabled={!ready || busy}>
        {state?.phase === "waiting" ? t("issue.waiting") : busy ? t("common.sending") : t("issue.issueOne")}
      </button>
      {!ready && <small className="dash-muted">{t("issue.fillCommon")}</small>}
    </form>
  );
}

function CsvIssue({ common, extraFields, ready }) {
  const { t, orgPath, overview, refreshOverview } = useDashboard();
  const [file, setFile] = useState(null); // {name, text, headers, rows}
  const [map, setMap] = useState({ name: "", email: "", fields: {} });
  const [validation, setValidation] = useState(null);
  const [run, setRun] = useState(null); // {results: [{status, url, error}], running}
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  async function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const text = await f.text();
    const parsed = parseCsv(text);
    setFile({ name: f.name, text, ...parsed });
    const fields = {};
    for (const fld of extraFields) fields[fld.key] = parsed.headers.find((h) => h.toLowerCase() === fld.key.toLowerCase()) ?? "";
    setMap({ name: guessColumn(parsed.headers, "name"), email: guessColumn(parsed.headers, "email"), fields });
    setValidation(null);
    setRun(null);
  }

  const inputs = useMemo(() => {
    if (!file || !map.name) return [];
    return file.rows.map((r) =>
      buildInput(common, {
        holder_name: r[map.name],
        holder_email: map.email ? r[map.email] : "",
        values: Object.fromEntries(Object.entries(map.fields).filter(([, col]) => col).map(([k, col]) => [k, r[col]])),
      }),
    );
  }, [file, map, common]);

  async function validate() {
    setValidation({ loading: true });
    try {
      setValidation(await api(orgPath("/issue/validate"), { method: "POST", body: { rows: inputs } }));
    } catch (err) {
      setValidation({ error: err.message });
    }
  }

  async function start() {
    const controller = new AbortController();
    abortRef.current = controller;
    // Same file + same settings → same keys. Running it again after a crash or a
    // closed tab resumes: rows already queued come back as they were, uncharged.
    const batch = await digest(JSON.stringify({ text: file.text, common, map }));
    const results = inputs.map(() => ({ status: "pending" }));
    setRun({ results: [...results], running: true });
    const update = (i, patch) => {
      results[i] = { ...results[i], ...patch };
      setRun((r) => ({ ...r, results: [...results] }));
    };

    let next = 0;
    let stopFor = null;
    async function worker() {
      while (next < inputs.length && !controller.signal.aborted && !stopFor) {
        const i = next++;
        try {
          const out = await api(orgPath("/issue"), {
            method: "POST",
            body: { input: inputs[i], idempotency_key: `csv:${batch}:${i}` },
          });
          update(i, { status: "queued", job: out.job_id });
        } catch (err) {
          update(i, { status: "failed", error: err.message });
          if (err.code === "insufficient_credits") stopFor = "credits";
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    refreshOverview();

    // Now wait for the queued ones to be sealed on-chain.
    await Promise.all(
      results.map(async (r, i) => {
        if (r.status !== "queued") return;
        const job = await waitForJob(r.job, { signal: controller.signal });
        if (!job) return;
        update(i, job.status === "completed" ? { status: "completed", url: job.credential.verification_url } : { status: "failed", error: job.error });
      }),
    );
    setRun((r) => ({ ...r, running: false, stoppedFor: stopFor }));
    refreshOverview();
  }

  function downloadResults() {
    const rows = file.rows.map((r, i) => ({
      name: r[map.name],
      email: map.email ? r[map.email] : "",
      status: run.results[i]?.status,
      verification_url: run.results[i]?.url || "",
      error: run.results[i]?.error || "",
    }));
    const blob = new Blob([toCsv(["name", "email", "status", "verification_url", "error"], rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${file.name.replace(/\.csv$/i, "")}-results.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const count = inputs.length;
  const balance = overview?.balance ?? 0;
  const counts = run?.results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {}) ?? {};

  return (
    <section className="dash-card dash-form">
      <p className="dash-muted">{t("issue.csvHelp")}</p>
      <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={run?.running} />

      {file && (
        <>
          <p>
            <strong>{file.name}</strong> — {t("issue.rows", { n: formatNumber(file.rows.length) })}
          </p>
          <div className="dash-grid-2">
            <label className="dash-field">
              <span>{t("issue.colName")}</span>
              <select value={map.name} onChange={(e) => setMap({ ...map, name: e.target.value })}>
                <option value="">—</option>
                {file.headers.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
            <label className="dash-field">
              <span>{t("issue.colEmail")}</span>
              <select value={map.email} onChange={(e) => setMap({ ...map, email: e.target.value })}>
                <option value="">{t("issue.none")}</option>
                {file.headers.map((h) => (
                  <option key={h}>{h}</option>
                ))}
              </select>
            </label>
            {extraFields.map((f) => (
              <label className="dash-field" key={f.key}>
                <span>
                  {t("issue.colField", { field: f.key })}
                  {f.required ? " *" : ""}
                </span>
                <select value={map.fields[f.key] || ""} onChange={(e) => setMap({ ...map, fields: { ...map.fields, [f.key]: e.target.value } })}>
                  <option value="">{t("issue.none")}</option>
                  {file.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {map.name && (
            <div className="dash-table-wrap">
              <table className="dash-table dash-table--compact">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t("credentials.col.holder")}</th>
                    <th>{t("issue.holderEmail")}</th>
                    <th>{t("credentials.col.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {inputs.slice(0, run ? inputs.length : 5).map((inp, i) => {
                    const r = run?.results[i];
                    const v = validation?.errors?.find((e) => e.row === i);
                    return (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td>{inp.holder_name}</td>
                        <td>{inp.holder_email}</td>
                        <td>
                          {r ? (
                            r.url ? (
                              <a href={r.url} target="_blank" rel="noreferrer">
                                {t(`run.${r.status}`)}
                              </a>
                            ) : (
                              <span className={r.status === "failed" ? "dash-error" : ""} title={r.error}>
                                {t(`run.${r.status}`)}
                                {r.error ? `: ${r.error}` : ""}
                              </span>
                            )
                          ) : v ? (
                            <span className="dash-error">{v.error}</span>
                          ) : (
                            ""
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!run && inputs.length > 5 && <p className="dash-muted dash-small">{t("issue.andMore", { n: formatNumber(inputs.length - 5) })}</p>}
            </div>
          )}

          {!run && (
            <>
              <p className={count > balance ? "dash-error" : "dash-muted"}>
                {t("issue.cost", { n: formatNumber(count), balance: formatNumber(balance) })}{" "}
                {count > balance && <Link to="/app/developers#buy">{t("nav.buyCredits")}</Link>}
              </p>
              {validation?.errors?.length > 0 && (
                <div className="dash-note dash-note--danger">
                  {t("issue.invalidRows", { n: validation.errors.length })}
                  <ul>
                    {validation.errors.slice(0, 10).map((e) => (
                      <li key={e.row}>
                        {t("issue.row", { n: e.row + 1 })}: {e.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {validation?.error && <p className="dash-error">{validation.error}</p>}
              <div className="dash-row">
                <button type="button" className="dash-btn dash-btn--ghost" disabled={!ready || !map.name || !count} onClick={validate}>
                  {validation?.loading ? t("common.checking") : t("issue.validate")}
                </button>
                <button
                  type="button"
                  className="dash-btn"
                  disabled={!ready || !validation || validation.loading || validation.errors?.length > 0 || validation.error || count > balance}
                  onClick={start}
                >
                  {t("issue.issueAll", { n: formatNumber(count) })}
                </button>
              </div>
              {!ready && <small className="dash-muted">{t("issue.fillCommon")}</small>}
            </>
          )}

          {run && (
            <div className="dash-progress">
              <progress max={count} value={(counts.completed || 0) + (counts.failed || 0)} />
              <p>
                {t("issue.progress", {
                  done: formatNumber(counts.completed || 0),
                  total: formatNumber(count),
                  failed: formatNumber(counts.failed || 0),
                })}
              </p>
              {run.running && <p className="dash-muted">{t("issue.keepOpen")}</p>}
              {run.stoppedFor === "credits" && (
                <p className="dash-error">
                  {t("issue.stoppedCredits")} <Link to="/app/developers#buy">{t("nav.buyCredits")}</Link>
                </p>
              )}
              {!run.running && (
                <div className="dash-row">
                  <button type="button" className="dash-btn" onClick={downloadResults}>
                    {t("issue.download")}
                  </button>
                  {counts.failed > 0 && (
                    <button type="button" className="dash-btn dash-btn--ghost" onClick={start}>
                      {t("issue.retryFailed")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
