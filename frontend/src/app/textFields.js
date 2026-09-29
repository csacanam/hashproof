/**
 * Text zones in a template: fixed wording with {tags}, like
 * "Por su participación en {evento} con una intensidad de {horas} horas".
 *
 * The template stores the wording (field.text); the dashboard resolves it for
 * each credential and sends the result as that field's value, so the renderer
 * never sees a tag. Three tags are always known; any other is a variable the
 * dashboard asks for when issuing (a form field, or a CSV column).
 */

const BUILTINS = {
  nombre: "holder",
  name: "holder",
  evento: "context",
  event: "context",
  curso: "context",
  course: "context",
  fecha: "date",
  date: "date",
};

export const BUILTIN_TAGS = ["{nombre}", "{evento}", "{fecha}"];

const TAG_RE = /\{([^{}]+)\}/g;

function norm(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function isBuiltin(tag) {
  return Object.prototype.hasOwnProperty.call(BUILTINS, norm(tag));
}

/** The variables a template's text zones need, in order of appearance, without duplicates or built-ins. */
export function templateVariables(fields) {
  const seen = new Map();
  for (const f of fields || []) {
    if (typeof f.text !== "string") continue;
    for (const [, raw] of f.text.matchAll(TAG_RE)) {
      const tag = raw.trim();
      if (!tag || isBuiltin(tag) || seen.has(norm(tag))) continue;
      seen.set(norm(tag), tag);
    }
  }
  return [...seen.values()];
}

/**
 * The final wording for one credential. Unknown or empty tags are left as
 * written, so a missing value shows up in the preview instead of leaving a
 * silent gap on a certificate.
 */
export function resolveText(text, { holder, context, date, variables = {} }) {
  const byNorm = new Map(Object.entries(variables).map(([k, v]) => [norm(k), v]));
  const builtin = { holder, context, date };
  return String(text || "")
    .replace(TAG_RE, (m, raw) => {
      const tag = norm(raw);
      const value = isBuiltin(tag) ? builtin[BUILTINS[tag]] : byNorm.get(tag);
      return value === undefined || value === null || String(value).trim() === "" ? m : String(value).trim();
    })
    .trim();
}

/** Today's date as it reads on a certificate. */
export function issueDate(locale) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-CO" : "en-US", { dateStyle: "long" }).format(new Date());
}
