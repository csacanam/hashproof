import { useDashboard } from "../useDashboard.js";

/** Where the issued PDF puts the QR code (same rule as the backend renderer). */
function qrBox(pw) {
  const size = Math.round(Math.min(360, Math.max(96, 360 * (pw / 3508))));
  const margin = Math.round(size * 0.4);
  return { x: pw - size - margin, y: margin, size };
}

const pct = (v, total) => `${(v / total) * 100}%`;

/**
 * A template as what it is: fields placed on a page. The background is drawn
 * underneath, and can be any image with the page's proportions — the
 * template's own, or one chosen for an event. `plain` leaves it out, to show
 * the same fields over another design.
 */
export default function TemplateLayout({ template, backgroundUrl, plain = false, className = "" }) {
  const { t } = useDashboard();
  const pw = Number(template?.page_width) || 1;
  const ph = Number(template?.page_height) || 1;
  const qr = qrBox(pw);
  const fields = Array.isArray(template?.fields_json) ? template.fields_json : [];

  const label = (f) => {
    if (typeof f.text === "string") return f.text;
    if (f.key === "holder_name") return t("layout.holder");
    return f.key;
  };

  return (
    <div className={`dash-layout${plain ? " dash-layout--plain" : ""} ${className}`} style={{ aspectRatio: `${pw} / ${ph}` }}>
      {!plain && (backgroundUrl || template?.background_url) && <img src={backgroundUrl || template.background_url} alt="" />}
      <span
        className="dash-layout-qr"
        style={{ left: pct(qr.x, pw), top: pct(qr.y, ph), width: pct(qr.size, pw), height: pct(qr.size, ph) }}
      >
        QR
      </span>
      {fields.map((f, i) => {
        const size = Math.max(6, Number(f.font_size) || 12);
        return (
          <span
            key={`${f.key}-${i}`}
            className="dash-layout-field"
            title={f.key}
            style={{
              left: pct(Number(f.x) || 0, pw),
              top: pct(Number(f.y) || 0, ph),
              width: pct(Number(f.width) || pw - (Number(f.x) || 0) - 20, pw),
              fontSize: `max(7px, calc(${size / pw} * 100cqw))`,
              textAlign: f.align || "left",
              fontWeight: f.bold ? 700 : 400,
            }}
          >
            {label(f)}
          </span>
        );
      })}
    </div>
  );
}
