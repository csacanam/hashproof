/**
 * Error classification for API responses.
 *
 * Two audiences, two needs:
 *
 * - The caller needs to know what to DO. "wait for transaction timeout
 *   (code=TIMEOUT, version=6.16.0)" tells an integrator nothing, and leaks our
 *   dependency versions. They need: is this my fault or yours, and should I
 *   retry?
 * - Whoever debugs it later needs the raw detail. That goes to the logs, keyed
 *   by a request id that the caller is given, so a support message like "I got
 *   error r_k3f9x2" maps straight to the log line.
 *
 * The response keeps `error` as a plain string so existing integrations that
 * read it keep working; `code`, `retryable` and `request_id` are additive.
 */

/** Stable machine-readable codes. Safe to branch on from client code. */
export const ErrorCode = {
  INVALID_PAYLOAD: "invalid_payload",
  TEMPLATE_CONFLICT: "template_conflict",
  NOT_FOUND: "not_found",
  UNAUTHORIZED: "unauthorized",
  ENTITY_SUSPENDED: "entity_suspended",
  INSUFFICIENT_CREDITS: "insufficient_credits",
  QUEUE_FULL: "queue_full",
  CHAIN_UNAVAILABLE: "chain_unavailable",
  STORAGE_UNAVAILABLE: "storage_unavailable",
  DATABASE_UNAVAILABLE: "database_unavailable",
  SERVICE_MISCONFIGURED: "service_misconfigured",
  INTERNAL_ERROR: "internal_error",
};

// Matched in order; first hit wins. Patterns are matched against the raw error
// message, which is why they live next to the code that produces them.
const RULES = [
  {
    test: /required|does not match|provide only one of|must be|invalid|is required/i,
    status: 400,
    code: ErrorCode.INVALID_PAYLOAD,
    retryable: false,
    // The underlying message is already precise and actionable here.
    passthrough: true,
  },
  {
    test: /template already exists/i,
    status: 400,
    code: ErrorCode.TEMPLATE_CONFLICT,
    retryable: false,
    passthrough: true,
  },
  {
    test: /not found/i,
    status: 404,
    code: ErrorCode.NOT_FOUND,
    retryable: false,
    passthrough: true,
  },
  {
    test: /suspended/i,
    status: 403,
    code: ErrorCode.ENTITY_SUSPENDED,
    retryable: false,
    passthrough: true,
  },
  {
    test: /not authorized|unauthorized/i,
    status: 403,
    code: ErrorCode.UNAUTHORIZED,
    retryable: false,
    passthrough: true,
  },
  {
    test: /insufficient credits|no credits/i,
    status: 402,
    code: ErrorCode.INSUFFICIENT_CREDITS,
    retryable: false,
    message: "This API key has no credits left. Top it up and retry.",
  },
  {
    // Celo RPC down, tx never confirmed, wallet out of gas. All transient from
    // the caller's side and all worth retrying.
    test: /timeout|rpc|nonce|underpriced|reverted|insufficient funds|gas|celo|chain|transaction/i,
    status: 503,
    code: ErrorCode.CHAIN_UNAVAILABLE,
    retryable: true,
    retryAfter: 10,
    message:
      "Could not register the credential on-chain right now. This is temporary — retry in a few seconds.",
  },
  {
    test: /pinata|ipfs/i,
    status: 503,
    code: ErrorCode.STORAGE_UNAVAILABLE,
    retryable: true,
    retryAfter: 10,
    message: "Could not store the credential on IPFS right now. Retry in a few seconds.",
  },
  {
    test: /missing|not configured/i,
    status: 500,
    code: ErrorCode.SERVICE_MISCONFIGURED,
    retryable: false,
    message: "HashProof is misconfigured for this operation. Contact support.",
  },
  {
    test: /supabase|postgres|database|prepare_credential|finalize_credential|connection/i,
    status: 503,
    code: ErrorCode.DATABASE_UNAVAILABLE,
    retryable: true,
    retryAfter: 5,
    message: "A temporary storage problem prevented this operation. Retry in a few seconds.",
  },
];

const FALLBACK = {
  status: 500,
  code: ErrorCode.INTERNAL_ERROR,
  retryable: true,
  retryAfter: 10,
  message: "Unexpected error. If it persists, contact support with the request_id.",
};

/**
 * Map an error onto a status, a stable code, and a message safe to show a caller.
 * @param {Error|string} err
 */
export function classifyError(err) {
  const raw = (typeof err === "string" ? err : err?.message) || "";
  const rule = RULES.find((r) => r.test.test(raw)) || FALLBACK;
  return {
    status: rule.status,
    code: rule.code,
    retryable: rule.retryable,
    retryAfter: rule.retryAfter,
    // passthrough keeps messages that are already user-facing and specific
    // (missing fields); everything else gets a curated message so internals
    // like ethers versions or RPC URLs never reach a client.
    message: rule.passthrough ? raw : rule.message,
  };
}

/**
 * Send a classified error, and log the raw detail against the request id so it
 * can be traced later.
 *
 * @param {import('express').Response} res
 * @param {Error} err - original error, logged in full
 * @param {object} [context] - extra fields worth having when debugging
 */
export function sendError(res, err, context = {}) {
  const { status, code, retryable, retryAfter, message } = classifyError(err);
  const requestId = res.req?.id;

  // Full detail server-side: this is what you read when someone reports an id.
  const logLine = {
    request_id: requestId,
    code,
    status,
    path: res.req?.originalUrl,
    method: res.req?.method,
    message: err?.message,
    ...context,
  };
  const log = status >= 500 ? console.error : console.warn;
  log(`[error] ${JSON.stringify(logLine)}`);
  if (status >= 500 && err?.stack) console.error(err.stack);

  if (retryAfter) res.setHeader("Retry-After", String(retryAfter));

  return res.status(status).json({
    error: message,
    code,
    retryable,
    ...(requestId && { request_id: requestId }),
  });
}
