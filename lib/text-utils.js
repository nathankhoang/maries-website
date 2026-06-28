/* Shared pure text logic — used by BOTH the server (api/translate.js, Node
 * ESM) and the browser (translator.js via <script type="module">), and
 * exercised by test/logic.test.mjs. No DOM, no Node APIs — keep it pure so
 * it stays testable and identical on both sides.
 */

/* Accent/punctuation-insensitive normalization (matches the site search). */
export function normalize(s) {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip Vietnamese tone/diacritic marks
    .replace(/đ/g, 'd')
    .replace(/[.,!?;:"'’“”()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* Vietnamese-specific letters (đ + vowels that only exist with VN diacritics). */
const VI_CHARS =
  /[ăâêôơưđàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;

/* Detect translation direction from the input text. */
export function detectDirection(text) {
  return VI_CHARS.test(text || '') ? 'vi2en' : 'en2vi';
}

/* Replace standalone "bạn"/"Bạn" tokens with a chosen pronoun, preserving
 * sentence-initial capitalization and never matching "bạn" inside a word. */
const BAN_RE = /(^|[^\p{L}\p{M}])([Bb])ạn(?=$|[^\p{L}\p{M}])/gu;
export function applyPronoun(text, lower, cap) {
  if (!lower || lower === 'bạn') return text;
  return text.replace(BAN_RE, (_m, pre, b) => pre + (b === 'B' ? cap || lower : lower));
}
export function hasBan(text) {
  return /(^|[^\p{L}\p{M}])[Bb]ạn(?=$|[^\p{L}\p{M}])/u.test(text || '');
}

/* Defensive cleanup of model output (strip code fences, a leading
 * "Translation:" label, and wrapping quotes). */
export function sanitize(out) {
  let t = (out || '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/\s*```$/i, '').trim();
  t = t.replace(/^(translation|vietnamese|english|vi|en)\s*[:\-–]\s*/i, '').trim();
  if (t.length >= 2) {
    const a = t[0];
    const b = t[t.length - 1];
    const pairs = { '"': '"', "'": "'", '“': '”', '‘': '’', '«': '»' };
    if (pairs[a] === b) t = t.slice(1, -1).trim();
  }
  return t;
}

/* ── Neural TTS (Azure Speech) ─────────────────────────────────────────
 * Voice map + safe SSML construction. Pure so the server builds requests
 * and tests can verify XML escaping (prevents SSML injection / breakage).
 */
export const TTS_VOICES = {
  vi: { voice: 'vi-VN-HoaiMyNeural', locale: 'vi-VN' },
  en: { voice: 'en-US-JennyNeural', locale: 'en-US' },
};

export function escapeXml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildSsml(text, lang) {
  const v = TTS_VOICES[lang] || TTS_VOICES.vi;
  return (
    `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${v.locale}">` +
    `<voice name="${v.voice}"><prosody rate="-8%">${escapeXml(text)}</prosody></voice>` +
    `</speak>`
  );
}

/* ── Tier-1 validated index (Marie's expert phrasebook) ────────────────
 * Pronoun rows are excluded — "I"/"We" are not translatable phrases.
 */
export function buildValidatedIndex(glossary) {
  const en = new Map(); // normalized English  -> validated Vietnamese
  const vi = new Map(); // normalized Vietnamese -> validated English
  for (const r of glossary) {
    if (r.category === 'pronouns') continue;
    const ne = normalize(r.en);
    if (ne && !en.has(ne)) en.set(ne, r.vi);
    for (const alt of String(r.vi).split('/')) {
      const nv = normalize(alt);
      if (nv && !vi.has(nv)) vi.set(nv, r.en);
    }
  }
  return { en, vi };
}

export function lookupValidated(index, text, direction) {
  const key = normalize(text);
  if (!key) return null;
  return direction === 'en2vi'
    ? index.en.get(key) || null
    : index.vi.get(key) || null;
}

/* ── Closest validated phrase (token Jaccard) ──────────────────────────
 * For an AI/demo result, surface the nearest clinician-validated phrase so
 * the clinician has a trusted fallback. Compares against the SOURCE-language
 * field. Returns null below `threshold` or on an exact match (that path is
 * already handled deterministically upstream).
 */
function tokenSet(s) {
  return new Set(normalize(s).split(' ').filter(Boolean));
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

export function closestValidated(glossary, text, direction, threshold = 0.5) {
  const q = tokenSet(text);
  if (q.size === 0) return null;
  let best = null;
  for (const r of glossary) {
    if (r.category === 'pronouns') continue;
    const sourceField = direction === 'en2vi' ? r.en : r.vi;
    for (const alt of String(sourceField).split('/')) {
      const score = jaccard(q, tokenSet(alt));
      if (score >= 1) return null; // exact-ish → handled by validated path
      if (score >= threshold && (!best || score > best.score)) {
        best = {
          score,
          phrase: alt.trim(),
          translation: (direction === 'en2vi' ? r.vi : r.en).trim(),
        };
      }
    }
  }
  return best;
}
