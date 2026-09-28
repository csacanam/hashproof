import { getPreferredLocale } from "../i18n.js";

const locale = getPreferredLocale() === "es" ? "es-CO" : "en-US";

export function formatNumber(n) {
  return new Intl.NumberFormat(locale).format(Number(n) || 0);
}

export function formatUsd(cents) {
  return new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format((Number(cents) || 0) / 100);
}

export function formatDate(iso, withTime = false) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    ...(withTime && { timeStyle: "short" }),
  }).format(new Date(iso));
}
