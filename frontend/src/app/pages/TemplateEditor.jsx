import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, publicApi } from "../api.js";
import { useDashboard } from "../useDashboard.js";
import Modal from "../components/Modal.jsx";
import PdfViewer from "../../components/PdfViewer.jsx";
import { qrCornerBusyness, qrZone } from "../qr.js";

function overlapsQr(f, pageWidth) {
  const q = qrZone(pageWidth);
  const h = f.font_size * 1.3;
  return f.x < q.x + q.size && f.x + f.width > q.x && f.y < q.y + q.size && f.y + h > q.y;
}

const SAMPLE = { holder_name: "María Fernanda Gómez", details: "Por su participación en el evento" };

function newField(key, page) {
  const fontSize = Math.round(page.page_height * 0.05);
  return {
    key,
    x: Math.round(page.page_width * 0.1),
    y: Math.round(page.page_height * 0.45),
    width: Math.round(page.page_width * 0.8),
    font_size: fontSize,
    font_color: "#000000",
    align: "center",
    required: key === "holder_name",
    bold: key === "holder_name",
  };
}

export default function TemplateEditor() {
  const { t, org, orgPath, canManage } = useDashboard();
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const isNew = !id;

  const [name, setName] = useState("");
  const [bg, setBg] = useState(null); // {url, width, height}
  const [fields, setFields] = useState([]);
  const [samples, setSamples] = useState(SAMPLE);
  const [selected, setSelected] = useState(0);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loaded, setLoaded] = useState(isNew && !search.get("from"));
  const [qrBusy, setQrBusy] = useState(null); // share of the QR corner that is not plain background
  const [dragging, setDragging] = useState(false);

  // Load the template being edited, or the one being duplicated.
  useEffect(() => {
    const source = id || search.get("from");
    if (!org || !source) return;
    api(orgPath("/templates"))
      .then((list) => {
        const tpl = list.find((x) => x.id === source);
        if (!tpl) throw new Error(t("editor.notFound"));
        setName(id ? tpl.name : `${tpl.name} (copy)`);
        setBg({ url: tpl.background_url, width: tpl.page_width, height: tpl.page_height });
        setFields(tpl.fields_json.map((f) => ({ ...f })));
        setLoaded(true);
      })
      .catch((err) => setError({ message: err.message }));
  }, [org?.id, id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Look at the image itself: a seal or signature in the QR corner is painted
  // into the background, so no field check would catch it.
  useEffect(() => {
    if (!bg?.url) return;
    let cancelled = false;
    qrCornerBusyness(bg.url, bg.width).then((share) => {
      if (!cancelled) setQrBusy(share);
    });
    return () => {
      cancelled = true;
    };
  }, [bg?.url, bg?.width]);

  if (!canManage) return <div className="dash-page"><p className="dash-muted">{t("common.managersOnly")}</p></div>;

  const page = bg ? { page_width: bg.width, page_height: bg.height } : null;
  const field = fields[selected];

  function onPick(e) {
    uploadFile(e.target.files?.[0]);
    e.target.value = "";
  }

  async function uploadFile(file) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setError({ message: t("editor.backgroundType") });
      return;
    }
    setBusy("upload");
    setError(null);
    try {
      const out = await api(orgPath("/backgrounds"), { method: "POST", raw: file });
      const next = { url: out.url, width: out.width, height: out.height };
      // Keep the layout proportionally when the new image has another size.
      if (bg && (bg.width !== next.width || bg.height !== next.height)) {
        const sx = next.width / bg.width;
        const sy = next.height / bg.height;
        setFields((fs) =>
          fs.map((f) => ({
            ...f,
            x: Math.round(f.x * sx),
            y: Math.round(f.y * sy),
            width: Math.round(f.width * sx),
            font_size: Math.max(6, Math.min(200, Math.round(f.font_size * sx))),
          })),
        );
      }
      setBg(next);
      if (!fields.length) setFields([newField("holder_name", { page_width: next.width, page_height: next.height })]);
    } catch (err) {
      setError({ message: err.message });
    } finally {
      setBusy("");
    }
  }

  function patch(i, p) {
    setFields((fs) => fs.map((f, j) => (j === i ? { ...f, ...p } : f)));
  }

  function addField() {
    const used = new Set(fields.map((f) => f.key));
    const key = !used.has("holder_name") ? "holder_name" : !used.has("details") ? "details" : `field_${fields.length + 1}`;
    const f = newField(key, page);
    f.y = Math.min(page.page_height - f.font_size * 2, f.y + fields.length * f.font_size * 1.6);
    setFields([...fields, f]);
    setSelected(fields.length);
  }

  async function showPreview() {
    setBusy("preview");
    setError(null);
    try {
      const res = await publicApi("/template-previews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          background_url: bg.url,
          ...page,
          fields_json: fields,
          values: Object.fromEntries(fields.map((f) => [f.key, samples[f.key] ?? f.key])),
          locale: navigator.language?.startsWith("es") ? "es" : "en",
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || t("editor.previewFailed"));
      setPreview(await res.blob());
    } catch (err) {
      setError({ message: err.message });
    } finally {
      setBusy("");
    }
  }

  async function save() {
    setBusy("save");
    setError(null);
    try {
      const body = { name, background_url: bg.url, ...page, fields_json: fields };
      if (isNew) {
        await api(orgPath("/templates"), { method: "POST", body });
      } else {
        await api(orgPath(`/templates/${id}`), { method: "PUT", body });
      }
      navigate("/app/templates");
    } catch (err) {
      setError({ message: err.message, code: err.code });
    } finally {
      setBusy("");
    }
  }

  const qrWarnings = page ? fields.filter((f) => overlapsQr(f, page.page_width)).map((f) => f.key) : [];

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <Link to="/app/templates" className="dash-muted">
            ← {t("templates.title")}
          </Link>
          <h1>{isNew ? t("editor.newTitle") : t("editor.editTitle")}</h1>
        </div>
        <div className="dash-row">
          <button type="button" className="dash-btn dash-btn--ghost" disabled={!bg || !fields.length || busy} onClick={showPreview}>
            {busy === "preview" ? t("common.loading") : t("editor.preview")}
          </button>
          <button type="button" className="dash-btn" disabled={!bg || !fields.length || !name.trim() || busy} onClick={save}>
            {busy === "save" ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </header>

      {error && (
        <p className="dash-error">
          {error.message}{" "}
          {error.code === "template_in_use" && <Link to={`/app/templates/new?from=${id}`}>{t("templates.duplicate")}</Link>}
        </p>
      )}

      {!loaded ? (
        <p className="dash-muted">{t("common.loading")}</p>
      ) : (
        <div className="dash-editor">
          <div className="dash-editor-canvas-col">
            <div className="dash-card dash-form">
              <label className="dash-field">
                <span>{t("editor.name")}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("editor.namePh")} />
              </label>
              <div className="dash-field">
                <span>{t("editor.background")}</span>
                {!bg ? (
                  <label
                    className={`dash-drop${dragging ? " is-over" : ""}${busy === "upload" ? " is-busy" : ""}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      uploadFile(e.dataTransfer.files?.[0]);
                    }}
                  >
                    <input type="file" accept="image/png,image/jpeg" onChange={onPick} disabled={busy === "upload"} />
                    <strong>{busy === "upload" ? t("editor.uploading") : t("editor.drop")}</strong>
                    <span className="dash-muted">{t("editor.backgroundHelp")}</span>
                  </label>
                ) : (
                  <div className="dash-file">
                    <img className="dash-file-thumb" src={bg.url} alt="" />
                    <div>
                      <strong>{t("editor.backgroundSet")}</strong>
                      <div className="dash-muted dash-small">
                        {bg.width} × {bg.height} px · {t("editor.backgroundQr")}
                      </div>
                    </div>
                    <label className="dash-link dash-file-change">
                      {busy === "upload" ? t("editor.uploading") : t("editor.changeImage")}
                      <input type="file" accept="image/png,image/jpeg" onChange={onPick} disabled={busy === "upload"} hidden />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {bg && (
              <Canvas
                bg={bg}
                fields={fields}
                samples={samples}
                selected={selected}
                onSelect={setSelected}
                onMove={(i, p) => patch(i, p)}
              />
            )}
            {qrWarnings.length > 0 && <p className="dash-note dash-note--danger">{t("editor.qrOverlap", { fields: qrWarnings.join(", ") })}</p>}
            {qrBusy !== null && qrBusy > 0.03 && <p className="dash-note dash-note--danger">{t("editor.qrBackground")}</p>}
            {bg && <p className="dash-muted dash-small">{t("editor.hint")}</p>}
          </div>

          {bg && (
            <aside className="dash-card dash-editor-panel">
              <div className="dash-card-head">
                <h2>{t("editor.fields")}</h2>
                <button type="button" className="dash-btn dash-btn--small" onClick={addField} disabled={fields.length >= 20}>
                  + {t("editor.addField")}
                </button>
              </div>
              <div className="dash-field-list">
                {fields.map((f, i) => (
                  <button key={i} type="button" className={`dash-chip${i === selected ? " is-active" : ""}`} onClick={() => setSelected(i)}>
                    {f.key}
                  </button>
                ))}
              </div>

              {field && (
                <div className="dash-form">
                  <label className="dash-field">
                    <span>{t("editor.key")}</span>
                    <input
                      value={field.key}
                      onChange={(e) => patch(selected, { key: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "_") })}
                    />
                    <small className="dash-muted">{t("editor.keyHelp")}</small>
                  </label>
                  <label className="dash-field">
                    <span>{t("editor.sample")}</span>
                    <input value={samples[field.key] ?? ""} onChange={(e) => setSamples({ ...samples, [field.key]: e.target.value })} />
                  </label>
                  <div className="dash-grid-3">
                    <label className="dash-field">
                      <span>X</span>
                      <input type="number" value={field.x} onChange={(e) => patch(selected, { x: Number(e.target.value) })} />
                    </label>
                    <label className="dash-field">
                      <span>Y</span>
                      <input type="number" value={field.y} onChange={(e) => patch(selected, { y: Number(e.target.value) })} />
                    </label>
                    <label className="dash-field">
                      <span>{t("editor.width")}</span>
                      <input type="number" value={field.width} onChange={(e) => patch(selected, { width: Number(e.target.value) })} />
                    </label>
                  </div>
                  <div className="dash-grid-3">
                    <label className="dash-field">
                      <span>{t("editor.fontSize")}</span>
                      <input type="number" min={6} max={200} value={field.font_size} onChange={(e) => patch(selected, { font_size: Number(e.target.value) })} />
                    </label>
                    <label className="dash-field">
                      <span>{t("editor.color")}</span>
                      <input type="color" value={field.font_color || "#000000"} onChange={(e) => patch(selected, { font_color: e.target.value })} />
                    </label>
                    <label className="dash-field">
                      <span>{t("editor.align")}</span>
                      <select value={field.align || "left"} onChange={(e) => patch(selected, { align: e.target.value })}>
                        <option value="left">{t("editor.left")}</option>
                        <option value="center">{t("editor.center")}</option>
                        <option value="right">{t("editor.right")}</option>
                      </select>
                    </label>
                  </div>
                  <div className="dash-row">
                    <label className="dash-check">
                      <input type="checkbox" checked={field.bold === true} onChange={(e) => patch(selected, { bold: e.target.checked })} /> {t("editor.bold")}
                    </label>
                    <label className="dash-check">
                      <input type="checkbox" checked={field.italic === true} onChange={(e) => patch(selected, { italic: e.target.checked })} /> {t("editor.italic")}
                    </label>
                    <label className="dash-check">
                      <input type="checkbox" checked={field.required === true} onChange={(e) => patch(selected, { required: e.target.checked })} /> {t("editor.required")}
                    </label>
                  </div>
                  <button
                    type="button"
                    className="dash-link dash-link--danger"
                    onClick={() => {
                      setFields(fields.filter((_, j) => j !== selected));
                      setSelected(0);
                    }}
                  >
                    {t("editor.removeField")}
                  </button>
                </div>
              )}
            </aside>
          )}
        </div>
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={t("editor.preview")} wide>
        <PdfViewer pdfBlob={preview} />
      </Modal>
    </div>
  );
}

/**
 * The background with each field drawn where the renderer will put it: x/y is
 * the top-left of the text box, in page pixels. Drag a field to move it; drag
 * its right edge to change its width.
 */
function Canvas({ bg, fields, samples, selected, onSelect, onMove }) {
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0);
  const drag = useRef(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / bg.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [bg.width]);

  function onPointerDown(e, i, mode) {
    e.preventDefault();
    e.stopPropagation();
    onSelect(i);
    const f = fields[i];
    drag.current = { i, mode, startX: e.clientX, startY: e.clientY, x: f.x, y: f.y, width: f.width };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    const d = drag.current;
    if (!d || !scale) return;
    const dx = (e.clientX - d.startX) / scale;
    const dy = (e.clientY - d.startY) / scale;
    const f = fields[d.i];
    if (d.mode === "move") {
      onMove(d.i, {
        x: Math.round(Math.max(0, Math.min(bg.width - f.width, d.x + dx))),
        y: Math.round(Math.max(0, Math.min(bg.height - f.font_size, d.y + dy))),
      });
    } else {
      onMove(d.i, { width: Math.round(Math.max(20, Math.min(bg.width - f.x, d.width + dx))) });
    }
  }

  const q = qrZone(bg.width);

  return (
    <div ref={wrapRef} className="dash-canvas" style={{ aspectRatio: `${bg.width} / ${bg.height}` }} onPointerMove={onPointerMove} onPointerUp={() => (drag.current = null)}>
      <img src={bg.url} alt="" draggable={false} />
      {scale > 0 && (
        <div
          className="dash-canvas-qr"
          style={{ left: q.x * scale, top: q.y * scale, width: q.size * scale, height: q.size * scale }}
          title="QR"
        >
          QR
        </div>
      )}
      {scale > 0 &&
        fields.map((f, i) => (
          <div
            key={i}
            className={`dash-canvas-field${i === selected ? " is-selected" : ""}`}
            style={{
              left: f.x * scale,
              top: f.y * scale,
              width: f.width * scale,
              fontSize: f.font_size * scale,
              color: f.font_color || "#000",
              textAlign: f.align || "left",
              fontWeight: f.bold ? 700 : 400,
              fontStyle: f.italic ? "italic" : "normal",
            }}
            onPointerDown={(e) => onPointerDown(e, i, "move")}
          >
            {samples[f.key] || f.key}
            <span className="dash-canvas-handle" onPointerDown={(e) => onPointerDown(e, i, "resize")} />
          </div>
        ))}
    </div>
  );
}
