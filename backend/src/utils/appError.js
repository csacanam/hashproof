/**
 * An error whose status and code are known where it is thrown. The dashboard
 * routes send these as they are, instead of guessing from the message.
 */
export function appError(message, status = 400, code = "invalid_payload", extra = {}) {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  Object.assign(err, extra);
  return err;
}
