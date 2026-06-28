/* Vercel serverless function — POST /api/admin/logout
 * Clears the session cookie. No auth required (clearing your own cookie is
 * harmless).
 */

import { clearSessionCookie } from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(200).json({ ok: true });
}
