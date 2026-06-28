/* Vercel serverless function — /api/admin/audio  (PROTECTED)
 *
 * Uploads Marie's own Vietnamese audio recordings to Vercel Blob and returns
 * the public URL (stored on a phrase as `audio_url`). Every request requires a
 * valid admin session.
 *
 *   POST   /api/admin/audio?filename=hello.mp3   (raw audio body) → { url }
 *   DELETE /api/admin/audio?url=<blob url>                         → { ok }
 *
 * Short clinical phrases are tiny (a few seconds), so the default Vercel body
 * limit (~4.5 MB) is plenty; we cap at 4 MB to be safe.
 */

import crypto from 'node:crypto';
import { put, del } from '@vercel/blob';
import { verifySession } from '../../lib/auth.js';

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

// Allowed audio content types → file extension.
const TYPE_EXT = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/wave': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
};

/* Read the raw request bytes, however Vercel surfaced the body. */
async function readBytes(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'binary');
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (!verifySession(req)) {
    return res.status(401).json({ error: 'Not authorized.' });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(500).json({ error: 'Audio storage is not configured.' });
  }

  try {
    if (req.method === 'DELETE') {
      const url = (req.query?.url ?? '').toString();
      if (!url) return res.status(400).json({ error: 'url is required.' });
      // del() ignores unknown URLs; only act on our own blob host.
      try {
        await del(url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch (e) {
        // Non-fatal: the phrase reference is cleared regardless.
        console.error('Blob delete failed:', e?.message || e);
      }
      return res.status(200).json({ ok: true });
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST, DELETE');
      return res.status(405).json({ error: 'Method not allowed.' });
    }

    const contentType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const ext = TYPE_EXT[contentType];
    if (!ext) {
      return res.status(400).json({
        error: 'Unsupported audio type. Use MP3, M4A, WAV, OGG, or WebM.',
      });
    }

    // Early size guard from the header (defence in depth).
    const declared = Number.parseInt(req.headers['content-length'] || '0', 10);
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      return res.status(413).json({ error: 'Audio file is too large (max 4 MB).' });
    }

    const bytes = await readBytes(req);
    if (!bytes.length) return res.status(400).json({ error: 'Empty upload.' });
    if (bytes.length > MAX_BYTES) {
      return res.status(413).json({ error: 'Audio file is too large (max 4 MB).' });
    }

    const pathname = `audio/${crypto.randomUUID()}.${ext}`;
    const blob = await put(pathname, bytes, {
      access: 'public',
      contentType,
      token: process.env.BLOB_READ_WRITE_TOKEN,
      addRandomSuffix: false,
      cacheControlMaxAge: 31536000, // immutable; unique name per upload
    });

    return res.status(201).json({ url: blob.url });
  } catch (err) {
    console.error('/api/admin/audio error:', err?.message || err);
    return res.status(500).json({ error: 'Audio upload failed.' });
  }
}
