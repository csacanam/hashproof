import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api, publicApi } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import { formatNumber } from "../format.js";
import { decodeCsv, digest, fillTags, guessColumn, parseCsv, toCsv } from "../csv.js";
import BuyLink from "../components/BuyLink.jsx";

const CONTEXT_TYPES = ["event", "course", "diploma", "training", "certification", "membership", "other"];
const CREDENTIAL_TYPES = ["attendance", "completion", "achievement", "participation", "membership", "certification"];
const CONCURRENCY = 4;
const TEXT_MODE = "__text__";

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

function buildInput(common, row, notify) {
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
    ...(notify?.on && row.holder_email && { notify_holder: true, notify_locale: notify.locale }),
  };
}

function SingleIssue({ common, extraFields, ready }) {
  const { t, locale, orgPath, refreshOverview } = useDashboard();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notify, setNotify] = useState(true);
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
        body: {
          input: buildInput(common, { holder_name: name, holder_email: email, values }, { on: notify, locale }),
          idempotency_key: keyRef.current,
        },
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
              {t("issue.map.field", { field: f.key })}
              {f.required ? " *" : ""}
            </span>
            <input required={f.required} value={values[f.key] || ""} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
          </label>
        ))}
      </div>
      {email && (
        <label className="dash-toggle">
          <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
          <span>
            <strong>{t("issue.notifyOne")}</strong>
            <small className="dash-muted">{t("issue.notifyHelp")}</small>
          </span>
        </label>
      )}
      <p className="dash-muted">{t("issue.costOne")}</p>
      {state?.phase === "failed" && (
        <p className="dash-error">
          {state.error || state.job?.error || t("issue.failed")}{" "}
          {state.code === "insufficient_credits" && <BuyLink />}
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
  const { t, locale, orgPath, overview, refreshOverview } = useDashboard();
  const [file, setFile] = useState(null); // {name, text, headers, rows}
  const [map, setMap] = useState({ name: "", email: "", fields: {} });
  const [validation, setValidation] = useState(null);
  const [run, setRun] = useState(null); // {results: [{status, url, id, error}], running}
  const [zip, setZip] = useState(null); // {done, total} while the ZIP is being built
  const [dragging, setDragging] = useState(false);
  const [notify, setNotify] = useState(true);
  const abortRef = useRef(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  function onFile(e) {
    loadFile(e.target.files?.[0]);
    e.target.value = "";
  }


  const inputs = useMemo(() => {
    if (!file || !map.name) return [];
    return file.rows.map((r) =>
      buildInput(common, {
        holder_name: r[map.name],
        holder_email: map.email ? r[map.email] : "",
        values: Object.fromEntries(
          Object.entries(map.fields)
            .filter(([, src]) => src)
            .map(([k, src]) => [k, typeof src === "string" ? r[src] : fillTags(src.text, r)]),
        ),
      }, { on: notify, locale }),
    );
  }, [file, map, common, notify, locale]);

  // One button: check every row first (free), and only issue if all pass.
  async function checkAndIssue() {
    setValidation({ loading: true });
    let result;
    try {
      result = await api(orgPath("/issue/validate"), { method: "POST", body: { rows: inputs } });
    } catch (err) {
      setValidation({ error: err.message });
      return;
    }
    setValidation(result);
    if (!result.errors?.length) start();
  }

  async function loadFile(f) {
    if (!f) return;
    const text = decodeCsv(await f.arrayBuffer());
    const parsed = parseCsv(text);
    setFile({ name: f.name, text, ...parsed });
    const fields = {};
    for (const fld of extraFields) fields[fld.key] = parsed.headers.find((h) => h.toLowerCase() === fld.key.toLowerCase()) ?? "";
    setMap({ name: guessColumn(parsed.headers, "name"), email: guessColumn(parsed.headers, "email"), fields });
    setValidation(null);
    setRun(null);
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
        update(
          i,
          job.status === "completed"
            ? { status: "completed", url: job.credential.verification_url, id: job.credential.id }
            : { status: "failed", error: job.error },
        );
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

  /**
   * One PDF per person in a ZIP — what an organizer hands out or attaches to
   * emails. Fetched from the API (it allows cross-origin reads), a few at a
   * time. Names are made safe for every OS and de-duplicated, since two people
   * can share a name.
   */
  async function downloadZip() {
    const done = run.results.map((r, i) => ({ ...r, i })).filter((r) => r.status === "completed" && r.id);
    if (!done.length) return;
    setZip({ done: 0, total: done.length });
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    const used = new Map();
    const missing = [];
    let next = 0;
    let finished = 0;
    async function worker() {
      while (next < done.length) {
        const r = done[next++];
        const base =
          String(file.rows[r.i][map.name] || `certificado-${r.i + 1}`)
            .normalize("NFC")
            .replace(/[\\/:*?"<>|]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80) || `certificado-${r.i + 1}`;
        const n = (used.get(base) || 0) + 1;
        used.set(base, n);
        // The public PDF route allows 60 reads a minute: on 429, wait as told
        // and try again, so a large batch comes out complete, only slower.
        for (let attempt = 0; attempt < 8; attempt++) {
          try {
            const res = await publicApi(`/verify/${r.id}/pdf`);
            if (res.status === 429) {
              const wait = Number(res.headers.get("retry-after")) || 15;
              await new Promise((ok) => setTimeout(ok, wait * 1000));
              continue;
            }
            if (res.ok) zip.file(`${base}${n > 1 ? ` (${n})` : ""}.pdf`, await res.arrayBuffer());
            else missing.push(base);
          } catch {
            missing.push(base);
          }
          break;
        }
        finished++;
        setZip({ done: finished, total: done.length });
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    // Say what is not in the ZIP instead of handing over a silently short one.
    if (missing.length) zip.file("FALTANTES.txt", `${missing.join("\n")}\n`);
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${file.name.replace(/\.csv$/i, "")}-certificados.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    setZip(null);
  }

  const count = inputs.length;
  const balance = overview?.balance ?? 0;
  const counts = run?.results.reduce((acc, r) => ((acc[r.status] = (acc[r.status] || 0) + 1), acc), {}) ?? {};

  const previewRows = run ? inputs : inputs.slice(0, 5);
  const fieldKeys = extraFields.map((f) => f.key);
  const busy = validation?.loading || run?.running;

  return (
    <section className="dash-card dash-csv">
      {/* 1. File */}
      <div className="dash-step">
        <span className="dash-step-n">1</span>
        <div className="dash-step-body">
          <h3>{t("issue.step.file")}</h3>
          {!file ? (
            <label
              className={`dash-drop${dragging ? " is-over" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                loadFile(e.dataTransfer.files?.[0]);
              }}
            >
              <input type="file" accept=".csv,text/csv" onChange={onFile} disabled={run?.running} />
              <strong>{t("issue.drop.title")}</strong>
              <span className="dash-muted">{t("issue.csvHelp")}</span>
            </label>
          ) : (
            <div className="dash-file">
              <span className="dash-file-icon" aria-hidden>CSV</span>
              <div>
                <strong>{file.name}</strong>
                <div className="dash-muted dash-small">{t("issue.rows", { n: formatNumber(file.rows.length) })}</div>
              </div>
              {!run?.running && (
                <label className="dash-link dash-file-change">
                  {t("issue.changeFile")}
                  <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
                </label>
              )}
            </div>
          )}
        </div>
      </div>

      {file && (
        <>
          {/* 2. Columns */}
          <div className="dash-step">
            <span className="dash-step-n">2</span>
            <div className="dash-step-body">
              <h3>{t("issue.step.columns")}</h3>
              <div className="dash-mapping">
                <span className="dash-mapping-label">{t("issue.map.name")}</span>
                <select value={map.name} onChange={(e) => setMap({ ...map, name: e.target.value })}>
                  <option value="">—</option>
                  {file.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>

                <span className="dash-mapping-label">{t("issue.map.email")}</span>
                <select value={map.email} onChange={(e) => setMap({ ...map, email: e.target.value })}>
                  <option value="">{t("issue.none")}</option>
                  {file.headers.map((h) => (
                    <option key={h}>{h}</option>
                  ))}
                </select>

                {extraFields.map((f) => (
                  <Fragment key={f.key}>
                    <span className="dash-mapping-label">
                      {t("issue.map.field", { field: f.key })}
                      {f.required ? " *" : ""}
                    </span>
                    <div className="dash-mapping-value">
                      <select
                        value={typeof map.fields[f.key] === "object" ? TEXT_MODE : map.fields[f.key] || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          const next = v === TEXT_MODE ? { text: map.fields[f.key]?.text ?? "" } : v;
                          setMap({ ...map, fields: { ...map.fields, [f.key]: next } });
                        }}
                      >
                        <option value="">{t("issue.none")}</option>
                        {file.headers.map((h) => (
                          <option key={h}>{h}</option>
                        ))}
                        <option value={TEXT_MODE}>{t("issue.textWithTags")}</option>
                      </select>
                      {typeof map.fields[f.key] === "object" && (
                        <>
                          <textarea
                            rows={2}
                            value={map.fields[f.key].text}
                            placeholder={t("issue.textPh", { tag: `{${file.headers[2] || file.headers[1] || file.headers[0]}}` })}
                            onChange={(e) => setMap({ ...map, fields: { ...map.fields, [f.key]: { text: e.target.value } } })}
                          />
                          <div className="dash-tags">
                            <span className="dash-muted dash-small">{t("issue.insertTag")}</span>
                            {file.headers.map((h) => (
                              <button
                                key={h}
                                type="button"
                                className="dash-chip"
                                onClick={() =>
                                  setMap({ ...map, fields: { ...map.fields, [f.key]: { text: `${map.fields[f.key].text}{${h}}` } } })
                                }
                              >
                                {`{${h}}`}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* 3. Options */}
          {map.email && (
            <div className="dash-step">
              <span className="dash-step-n">3</span>
              <div className="dash-step-body">
                <h3>{t("issue.step.options")}</h3>
                <label className="dash-toggle">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  <span>
                    <strong>{t("issue.notifyAll")}</strong>
                    <small className="dash-muted">{t("issue.notifyHelp")}</small>
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* 4. Preview and issue */}
          {map.name && (
            <div className="dash-step">
              <span className="dash-step-n">{map.email ? 4 : 3}</span>
              <div className="dash-step-body">
                <h3>{t("issue.step.review")}</h3>
                <div className="dash-table-wrap dash-preview">
                  <table className="dash-table dash-table--compact">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t("credentials.col.holder")}</th>
                        {map.email && <th>{t("issue.map.email")}</th>}
                        {fieldKeys.map((k) => (
                          <th key={k}>{k}</th>
                        ))}
                        {(run || validation?.errors?.length > 0) && <th>{t("credentials.col.status")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((inp, i) => {
                        const r = run?.results[i];
                        const v = validation?.errors?.find((e) => e.row === i);
                        return (
                          <tr key={i} className={v ? "is-invalid" : undefined}>
                            <td className="dash-muted">{i + 1}</td>
                            <td>{inp.holder_name || <span className="dash-error">—</span>}</td>
                            {map.email && <td className="dash-muted">{inp.holder_email}</td>}
                            {fieldKeys.map((k) => (
                              <td key={k} className="dash-cell-text">
                                {inp.values?.[k] || <span className="dash-muted">—</span>}
                              </td>
                            ))}
                            {(run || validation?.errors?.length > 0) && (
                              <td>
                                {r ? (
                                  r.url ? (
                                    <a href={r.url} target="_blank" rel="noreferrer">
                                      {t(`run.${r.status}`)} ↗
                                    </a>
                                  ) : (
                                    <span className={r.status === "failed" ? "dash-error" : "dash-muted"} title={r.error}>
                                      {t(`run.${r.status}`)}
                                    </span>
                                  )
                                ) : v ? (
                                  <span className="dash-error">{v.error}</span>
                                ) : null}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!run && inputs.length > 5 && (
                    <p className="dash-muted dash-small dash-preview-more">{t("issue.andMore", { n: formatNumber(inputs.length - 5) })}</p>
                  )}
                </div>

                {validation?.errors?.length > 0 && (
                  <p className="dash-note dash-note--danger">{t("issue.invalidRows", { n: validation.errors.length })}</p>
                )}
                {validation?.error && <p className="dash-error">{validation.error}</p>}

                {!run && (
                  <div className="dash-issue-bar">
                    <div>
                      <strong>{t("issue.summary", { n: formatNumber(count) })}</strong>
                      <div className={count > balance ? "dash-error dash-small" : "dash-muted dash-small"}>
                        {t("issue.cost", { n: formatNumber(count), balance: formatNumber(balance) })}{" "}
                        {count > balance && <BuyLink />}
                      </div>
                      {!ready && <div className="dash-muted dash-small">{t("issue.fillCommon")}</div>}
                    </div>
                    <button type="button" className="dash-btn" disabled={!ready || !count || count > balance || busy} onClick={checkAndIssue}>
                      {validation?.loading ? t("common.checking") : t("issue.issueAll", { n: formatNumber(count) })}
                    </button>
                  </div>
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
                        {t("issue.stoppedCredits")} <BuyLink />
                      </p>
                    )}
                    {!run.running && (
                      <div className="dash-row">
                        {counts.completed > 0 && (
                          <button type="button" className="dash-btn" onClick={downloadZip} disabled={Boolean(zip)}>
                            {zip ? t("issue.zipProgress", { done: zip.done, total: zip.total }) : t("issue.downloadZip")}
                          </button>
                        )}
                        <button type="button" className="dash-btn dash-btn--ghost" onClick={downloadResults}>
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
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
