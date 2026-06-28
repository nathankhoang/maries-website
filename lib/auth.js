/* Session auth for the admin CMS.
 *
 * Design: a stateless, signed cookie. There's no session store — the cookie
 * itself carries an expiry and an HMAC-SHA256 signature keyed by
 * ADMIN_SESSION_SECRET. The server can verify it without any DB lookup, and a
 * client can't forge or extend it without the secret.
 *
 * Secrets come from the environment (never hardcoded):
 *   - ADMIN_PASSWORD        the single admin password (login check)
 *   - ADMIN_SESSION_SECRET  HMAC key for signing/verifying session cookies
 *
 * Everything fails CLOSED: if a required secret is unset, auth is denied
 * rather than bypassed. Uses Node's built-in `crypto` only.
 */

import crypto from 'node:crypto';

const COOKIE_NAME = 'admin_session';
const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days
// Shared cookie attributes. Secure + HttpOnly + SameSite=Strict so the cookie
// is HTTPS-only, invisible to JS (XSS can't read it), and never sent
// cross-site (CSRF mitigation).
const COOKIE_ATTRS = 'HttpOnly; Secure; SameSite=Strict; Path=/';

/* ── Password check ────────────────────────────────────────────────────── */

/**
 * Constant-time comparison of a candidate password against ADMIN_PASSWORD.
 * Returns false if ADMIN_PASSWORD is unset (fail closed). Uses HMAC over both
 * sides with a random key so the comparison is constant-time even when the
 * two inputs differ in length (timingSafeEqual itself requires equal-length
 * buffers and would otherwise leak length).
 * @param {string} input
 * @returns {boolean}
 */
export function checkPassword(input) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false; // no password configured → deny
  if (typeof input !== 'string') return false;

  // HMAC both values with a single random per-call key, then compare the
  // fixed-length digests. This avoids leaking length and is constant-time.
  const key = crypto.randomBytes(32);
  const a = crypto.createHmac('sha256', key).update(input).digest();
  const b = crypto.createHmac('sha256', key).update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/* ── Token helpers ─────────────────────────────────────────────────────── */

/* Sign a payload-base64url string with HMAC-SHA256, hex-encoded. */
function sign(payloadB64, secret) {
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
}

/* Token format: `<payloadB64url>.<hmacHex>` where payload is JSON({ exp }). */
function makeToken(exp, secret) {
  const payloadB64 = Buffer.from(JSON.stringify({ exp }), 'utf8').toString(
    'base64url'
  );
  return `${payloadB64}.${sign(payloadB64, secret)}`;
}

/* ── Cookie issuance ───────────────────────────────────────────────────── */

/**
 * Build a Set-Cookie string carrying a fresh signed session token.
 * @param {number} [now] current time in ms (injectable for tests).
 * @returns {string} full Set-Cookie header value.
 */
export function makeSessionCookie(now = Date.now()) {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  const exp = now + MAX_AGE_SECONDS * 1000; // absolute expiry, ms
  const token = makeToken(exp, secret);
  return `${COOKIE_NAME}=${token}; ${COOKIE_ATTRS}; Max-Age=${MAX_AGE_SECONDS}`;
}

/** Build a Set-Cookie string that immediately clears the session cookie. */
export function clearSessionCookie() {
  return `${COOKIE_NAME}=; ${COOKIE_ATTRS}; Max-Age=0`;
}

/* ── Verification ──────────────────────────────────────────────────────── */

/* Parse a single cookie value out of a Cookie header. */
function readCookie(cookieHeader, name) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) return part.slice(idx + 1).trim();
  }
  return null;
}

/**
 * Verify the admin_session cookie on a request.
 * Recomputes the HMAC and compares in constant time, then checks expiry.
 * Fails closed if ADMIN_SESSION_SECRET is unset or the token is malformed.
 * @param {{ headers?: { cookie?: string } }} req
 * @param {number} [now] current time in ms (injectable for tests).
 * @returns {boolean}
 */
export function verifySession(req, now = Date.now()) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return false; // no signing key → can't trust anything

  const token = readCookie(req?.headers?.cookie, COOKIE_NAME);
  if (!token) return false;

  const dot = token.indexOf('.');
  if (dot === -1) return false;
  const payloadB64 = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);
  if (!payloadB64 || !sigHex) return false;

  // Recompute the expected signature and compare in constant time.
  const expectedHex = sign(payloadB64, secret);
  let sigBuf;
  let expBuf;
  try {
    sigBuf = Buffer.from(sigHex, 'hex');
    expBuf = Buffer.from(expectedHex, 'hex');
  } catch {
    return false;
  }
  if (sigBuf.length !== expBuf.length) return false;
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return false;

  // Signature is valid → trust the payload. Check expiry.
  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (typeof payload?.exp !== 'number') return false;
  return payload.exp > now;
}
