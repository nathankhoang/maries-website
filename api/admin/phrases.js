/* Vercel serverless function — /api/admin/phrases  (PROTECTED CRUD)
 *
 * Every method requires a valid admin session cookie. Backs the admin CMS:
 *   GET    → flat list of all phrases (for the editor table)
 *   POST   → create a phrase
 *   PUT    → update a phrase by id
 *   DELETE → delete a phrase by id (?id= or body { id })
 */

import { verifySession } from '../../lib/auth.js';
import {
  ensureSchema,
  getAllPhrases,
  createPhrase,
  updatePhrase,
  deletePhrase,
} from '../../lib/db.js';

const MAX_LONG = 2000; // en / vi / note
const MAX_SHORT = 200; // category / subsection
const MAX_URL = 1000; // audio_url

/* Parse a possibly-stringified JSON body. */
function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return undefined;
    }
  }
  return body || {};
}

/* Trim + length-cap a string field. Returns '' for null/undefined. */
function clean(val, max) {
  return (val ?? '').toString().trim().slice(0, max);
}

/* Coerce sort_order to a finite integer (defaults to 0). */
function toSortOrder(val) {
  const n = Number.parseInt(val, 10);
  return Number.isFinite(n) ? n : 0;
}

export default async function handler(req, res) {
  // Gate EVERY request behind a valid session.
  if (!verifySession(req)) {
    return res.status(401).json({ error: 'Not authorized.' });
  }

  try {
    await ensureSchema();

    switch (req.method) {
      case 'GET': {
        const rows = await getAllPhrases();
        return res.status(200).json({ phrases: rows });
      }

      case 'POST': {
        const body = parseBody(req);
        if (body === undefined) {
          return res.status(400).json({ error: 'Invalid JSON body.' });
        }
        const category = clean(body.category, MAX_SHORT);
        const vi = clean(body.vi, MAX_LONG);
        if (!category) {
          return res.status(400).json({ error: 'Category is required.' });
        }
        if (!vi) {
          return res.status(400).json({ error: 'Vietnamese (vi) is required.' });
        }
        const noteRaw = body.note;
        const row = await createPhrase({
          category,
          subsection: clean(body.subsection, MAX_SHORT),
          en: clean(body.en, MAX_LONG),
          vi,
          note: noteRaw == null || noteRaw === '' ? null : clean(noteRaw, MAX_LONG),
          audio_url: body.audio_url ? clean(body.audio_url, MAX_URL) : null,
          sort_order: toSortOrder(body.sort_order),
        });
        return res.status(201).json({ phrase: row });
      }

      case 'PUT': {
        const body = parseBody(req);
        if (body === undefined) {
          return res.status(400).json({ error: 'Invalid JSON body.' });
        }
        const id = (body.id ?? '').toString();
        if (!id) {
          return res.status(400).json({ error: 'id is required.' });
        }

        // Build a whitelisted, cleaned patch from only the provided fields.
        const fields = {};
        if ('category' in body) fields.category = clean(body.category, MAX_SHORT);
        if ('subsection' in body)
          fields.subsection = clean(body.subsection, MAX_SHORT);
        if ('en' in body) fields.en = clean(body.en, MAX_LONG);
        if ('vi' in body) fields.vi = clean(body.vi, MAX_LONG);
        if ('note' in body)
          fields.note =
            body.note == null || body.note === ''
              ? null
              : clean(body.note, MAX_LONG);
        if ('sort_order' in body) fields.sort_order = toSortOrder(body.sort_order);
        if ('audio_url' in body)
          fields.audio_url = body.audio_url ? clean(body.audio_url, MAX_URL) : null;

        // Reject updates that would blank out a required column.
        if ('category' in fields && !fields.category) {
          return res.status(400).json({ error: 'Category cannot be empty.' });
        }
        if ('vi' in fields && !fields.vi) {
          return res.status(400).json({ error: 'Vietnamese (vi) cannot be empty.' });
        }

        const row = await updatePhrase(id, fields);
        if (!row) return res.status(404).json({ error: 'Phrase not found.' });
        return res.status(200).json({ phrase: row });
      }

      case 'DELETE': {
        let id = (req.query?.id ?? '').toString();
        if (!id) {
          const body = parseBody(req);
          id = (body?.id ?? '').toString();
        }
        if (!id) {
          return res.status(400).json({ error: 'id is required.' });
        }
        const removed = await deletePhrase(id);
        if (!removed) return res.status(404).json({ error: 'Phrase not found.' });
        return res.status(200).json({ ok: true });
      }

      default:
        res.setHeader('Allow', 'GET, POST, PUT, DELETE');
        return res.status(405).json({ error: 'Method not allowed.' });
    }
  } catch (err) {
    console.error('/api/admin/phrases error:', err?.message || err);
    return res.status(500).json({ error: 'Server error.' });
  }
}
