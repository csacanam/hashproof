/**
 * Telegram alerts for HashProof monitoring.
 *
 * Setup:
 * 1. Create a bot via @BotFather → copy token
 * 2. Get your chat ID (e.g. @userinfobot or send any message to your bot)
 * 3. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env
 *
 * If not configured, alerts are skipped silently (no errors).
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const TELEGRAM_API_BASE = "https://api.telegram.org";

/**
 * Send a Telegram message to the configured chat.
 *
 * @param {string} _alertKey - Identifier for logging/debugging
 * @param {string} text - Message body (HTML supported)
 * @returns {Promise<boolean>}
 */
export async function sendTelegramAlert(_alertKey, text) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return false;

  try {
    const url = `${TELEGRAM_API_BASE}/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      console.error("[notify] Telegram error:", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[notify] Telegram send failed:", err.message);
    return false;
  }
}
