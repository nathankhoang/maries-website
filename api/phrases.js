/* Vercel serverless function — GET /api/phrases  (PUBLIC, read-only)
 *
 * Returns the grouped phrasebook for the front end. Backed by Postgres, but
 * fronted by two caches: a short module-level in-memory cache (survives across
 * requests on a warm Fluid Compute instance) and an HTTP CDN cache via
 * Cache-Control. Together they keep the DB nearly idle under normal traffic.
 */

import { ensureSchema, getGroupedPhrases } from '../lib/db.js';

const TTL_MS = 30 * 1000; // in-memory cache lifetime
let cache = { at: 0, data: null };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  // CDN cache: serve cached for 60s, allow stale for 5 min while revalidating.
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=60, stale-while-revalidate=300'
  );

  try {
    const now = Date.now();
    if (cache.data && now - cache.at < TTL_MS) {
      return res.status(200).json(cache.data);
    }

    await ensureSchema();
    const data = await getGroupedPhrases();
    cache = { at: now, data };
    return res.status(200).json(data);
  } catch (err) {
    console.error('GET /api/phrases error:', err?.message || err);
    return res.status(500).json({ error: 'Could not load phrases.' });
  }
}
