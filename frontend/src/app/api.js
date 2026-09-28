/**
 * Client for the dashboard API (/app on the backend).
 *
 * The session is the pair of tokens Supabase issued at sign-in, kept in
 * localStorage. Access tokens last an hour; this refreshes one shortly before it
 * expires, and once more on a 401, so a dashboard left open keeps working.
 */

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4022";

const STORAGE_KEY = "hp.session";
const REFRESH_MARGIN_S = 120;

let session = load();
let refreshing = null;
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(next) {
  session = next;
  try {
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* private mode: the session lives for this tab only */
  }
  listeners.forEach((fn) => fn(session));
}

export function getSession() {
  return session;
}

export function setSession(next) {
  save(next);
}

export function signOut() {
  save(null);
}

export function onSessionChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

async function refresh() {
  if (!session?.refresh_token) return null;
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/app/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    })
      .then(async (res) => {
        if (!res.ok) {
          save(null);
          return null;
        }
        const next = await res.json();
        save(next);
        return next;
      })
      .catch(() => null)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function accessToken() {
  if (!session) return null;
  const now = Math.floor(Date.now() / 1000);
  if (session.expires_at && session.expires_at - now < REFRESH_MARGIN_S) await refresh();
  return session?.access_token ?? null;
}

export class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.status = status;
    this.code = body?.code;
    this.body = body;
  }
}

/**
 * Call the dashboard API. `path` is relative to /app. JSON in, JSON out; pass
 * `raw` to send a Blob/File body with its own content type.
 */
export async function api(path, { method = "GET", body, raw, retry = true } = {}) {
  const token = await accessToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (raw) {
    headers["Content-Type"] = raw.type;
    payload = raw;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_URL}/app${path}`, { method, headers, body: payload });
  if (res.status === 401 && retry && session?.refresh_token) {
    const next = await refresh();
    if (next) return api(path, { method, body, raw, retry: false });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) save(null);
    throw new ApiError(data?.error || `Request failed (${res.status})`, res.status, data);
  }
  return data;
}

/** The public API (verification, previews, job status). */
export async function publicApi(path, init) {
  return fetch(`${API_URL}${path}`, init);
}
