/* Vercel serverless function — POST /api/admin/login
 *
 * Body: { password }. On success, issues the signed session cookie. Rate-
 * limited per IP to blunt brute-force attempts. Responses never reveal whether
 * an admin password is even configured.
 */

import { checkPassword, makeSessionCookie } from '../../lib/auth.js';
import { rateLimit } from '../../lib/rate-limit.js';

const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const { ok, retryAfter } = rateLimit(`login:${ip}`, {
    max: MAX_ATTEMPTS,
    windowMs: WINDOW_MS,
  });
  if (!ok) {
    res.setHeader('Retry-After', String(retryAfter));
    return res
      .status(429)
      .json({ error: 'Too many attempts. Please wait and try again.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body.' });
    }
  }

  const password = (body?.password ?? '').toString();

  if (checkPassword(password)) {
    res.setHeader('Set-Cookie', makeSessionCookie());
    return res.status(200).json({ ok: true });
  }

  // Same response whether the password is wrong or unset — no oracle.
  return res.status(401).json({ error: 'Incorrect password.' });
}
