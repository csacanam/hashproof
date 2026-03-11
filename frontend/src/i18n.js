/**
 * Simple i18n: detects browser language (no geolocation).
 * Supported locales: en, es (add more in SUPPORTED_LOCALES and in each locale file).
 */

const SUPPORTED_LOCALES = ["en", "es"];
const DEFAULT_LOCALE = "en";

/**
 * Returns the preferred locale from the browser (navigator.language / navigator.languages).
 * Does not use geolocation; only language preferences.
 * @returns {string} One of SUPPORTED_LOCALES, default 'en'
 */
export function getPreferredLocale() {
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;
  const languages = navigator.languages && navigator.languages.length
    ? navigator.languages
    : [navigator.language, navigator.userLanguage].filter(Boolean);
  for (const lang of languages) {
    const code = lang.toLowerCase().split("-")[0];
    if (SUPPORTED_LOCALES.includes(code)) return code;
  }
  return DEFAULT_LOCALE;
}

/**
 * Returns a translator for the given locale with fallback to default locale.
 * @param {Record<string, Record<string, string>>} messages - { en: { key: "..." }, es: { ... } }
 * @param {string} [locale] - Optional locale; if not passed, uses getPreferredLocale()
 * @returns {(key: string) => string}
 */
export function createTranslator(messages, locale = getPreferredLocale()) {
  const localeMessages = messages[locale] || messages[DEFAULT_LOCALE] || {};
  const defaultMessages = messages[DEFAULT_LOCALE] || {};
  return (key) => localeMessages[key] ?? defaultMessages[key] ?? key;
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE };
