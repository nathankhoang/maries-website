/* In-memory per-key rate limiter — factored out of api/translate.js.
 *
 * Best-effort only: state lives in a module-level Map, so it resets on cold
 * start and is NOT shared across serverless instances. It's a cheap guard
 * against a single IP hammering an endpoint, not a hard security control —
 * pair with Vercel-level limits for anything that must be enforced globally.
 */

const buckets = new Map(); // key -> array of request timestamps (ms)

/**
 * Sliding-window limiter.
 * @param {string} key            Identity to limit on (typically client IP).
 * @param {object} opts
 * @param {number} opts.max       Max requests allowed per window.
 * @param {number} opts.windowMs  Window length in milliseconds.
 * @returns {{ ok: boolean, retryAfter: number }}
 *   ok=false when the limit is exceeded; retryAfter is seconds until the
 *   oldest in-window hit ages out (0 when ok).
 */
export function rateLimit(key, { max, windowMs }) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  buckets.set(key, arr);

  // Crude memory bound — drop everything if the map grows unbounded.
  if (buckets.size > 5000) buckets.clear();

  if (arr.length > max) {
    const oldest = arr[0];
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    return { ok: false, retryAfter };
  }
  return { ok: true, retryAfter: 0 };
}
