/**
 * Vercel serverless function — GET /api/tts?lang=vi|en&text=...
 *
 * Real neural Vietnamese (and English) speech via Azure AI Speech. The
 * subscription key lives ONLY here (env var), never in the browser. Returns
 * MP3 audio the client plays directly. Deterministic by (lang,text,voice),
 * so it is aggressively cached on Vercel's CDN — the fixed phrasebook
 * effectively synthesizes each phrase once, then serves from cache.
 *
 * If Azure isn't configured the client falls back to the browser voice,
 * so nothing breaks before the key is added.
 */

import { buildSsml, TTS_VOICES } from '../lib/text-utils.js';

const MAX_CHARS = 1000;

/* Best-effort per-IP rate limit (cost guard; pair with an Azure quota). */
const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_WINDOW = 120; // higher than translate: phrasebook taps repeat
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) hits.clear();
  return arr.length > MAX_PER_WINDOW;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const url = new URL(req.url, 'http://x');
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'vi';
  const text = (url.searchParams.get('text') || '').toString().trim();

  if (!text) return res.status(400).json({ error: 'Missing "text".' });
  if (text.length > MAX_CHARS) {
    return res.status(400).json({ error: `Text too long (max ${MAX_CHARS}).` });
  }

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!key || !region) {
    // Not configured → tell the client to use its local fallback voice.
    return res
      .status(503)
      .json({ error: 'Neural voice not configured.', fallback: true });
  }

  const ip =
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';
  if (rateLimited(ip)) {
    return res.status(429).json({ error: 'Too many requests.', fallback: true });
  }

  try {
    const resp = await fetch(
      `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': key,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
          'User-Agent': 'aud-viet-translations',
        },
        body: buildSsml(text, lang),
      }
    );

    if (!resp.ok) {
      const detail = await resp.text().catch(() => '');
      console.error('Azure TTS error', resp.status, detail.slice(0, 200));
      return res
        .status(502)
        .json({ error: 'Voice service unavailable.', fallback: true });
    }

    const audio = Buffer.from(await resp.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    // Deterministic output → cache hard (CDN + browser + service worker).
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.setHeader('X-Voice', TTS_VOICES[lang].voice);
    return res.status(200).send(audio);
  } catch (err) {
    console.error('TTS error:', err?.message || err);
    return res
      .status(502)
      .json({ error: 'Voice service unavailable.', fallback: true });
  }
}
