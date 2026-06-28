# AuD Viet Translations — Deploy & Maintain

Static website + an AI audiology translator. The site is plain HTML/CSS/JS;
the translator calls one Vercel serverless function that holds the Anthropic
API key (never in the browser) and injects Marie's curated glossary.

## One-time setup

1. **Anthropic key:** create an account at https://console.anthropic.com, make
   an API key, and **set a hard monthly spend cap** (Billing → Limits).
2. **Vercel:** create a free account at https://vercel.com and install the CLI
   (`npm i -g vercel`).
3. **Azure AI Speech (real Vietnamese voice):** in the Azure portal create a
   **Speech service** resource (free tier F0 ≈ 500k chars/month). Copy
   **KEY 1** and the **Region**, and set env vars `AZURE_SPEECH_KEY` and
   `AZURE_SPEECH_REGION` (e.g. `eastus`). Optional — without it the app uses
   the basic browser voice automatically.

## Deploy

```sh
npm install                 # installs @anthropic-ai/sdk (+ cheerio for the build tool)
vercel link                 # link this folder to a Vercel project (first time)
vercel env add ANTHROPIC_API_KEY production   # paste the key when prompted
vercel --prod               # deploy
```

Static files are served at the root; `api/translate.js` runs as the function.

## Try it now without a key (demo mode)

You don't need an Anthropic key to click through the whole experience:

```sh
npm install
npm test            # 7 logic tests should pass
vercel dev          # or any static server; open the site, go to AI Translator
```

With **no key configured**, the API runs in **demo mode**:
- Phrases Marie already validated still return her **real** wording (green
  "Clinician-validated" badge — this path never needs a key).
- Anything else returns a clearly-labelled grey **"Demo mode — not a real
  translation"** placeholder plus the closest validated phrase, so you can
  exercise the full UI (badges, pronoun helper, copy, history, speech).

Add the key (below) to turn on live AI translation — demo mode auto-disables
the moment `ANTHROPIC_API_KEY` is set.

For local testing with a key: copy `.env.example` → `.env.local`, set the key,
run `vercel dev`.

## Updating the phrasebook / glossary

`translations.html` is the single source of truth for both the on-site library
**and** the AI translator's approved terminology.

1. Edit phrase rows in `translations.html` (keep the table structure).
2. Regenerate the AI glossary: `npm run extract-glossary`
   (rewrites `lib/glossary.js` — currently 185 entries).
3. **Bump the `CACHE` constant in `sw.js`** (e.g. `audviet-v1` → `-v2`) so
   installed/offline users get the new content instead of a stale copy.
4. `vercel --prod` to redeploy.

## Installable app + offline (PWA)

The site is a Progressive Web App: `manifest.webmanifest` + `sw.js` (service
worker registered in `main.js`).

- Visitors can **Install / Add to Home Screen** on phone/tablet — it opens
  full-screen like an app (delivers the "feels like an app" goal, no stores).
- The curated **phrasebook works fully offline**; the AI translator needs a
  connection (its `/api/*` calls are intentionally never cached).
- Icons are generated dependency-free: `npm run make-icons` (only needed if
  you change the design in `scripts/make-icons.mjs`).
- **Always bump `CACHE` in `sw.js` when assets change** (see step 3 above) —
  this is the one easy-to-forget gotcha with offline caching.

## Quality / tests

`npm test` runs `test/logic.test.mjs` — regression coverage for the
accuracy-critical pure logic in `lib/text-utils.js` (validated-match,
pronoun substitution, language detection, sanitation, closest-match), shared
by both the server and browser. Run it before every deploy.

## The translator's audiology knowledge (two tiers + primer)

The AI is "trained up" via grounding, not model fine-tuning. Three layers feed
its system prompt (all prompt-cached, ~5K tokens):

1. **Domain primer** — `lib/domain-context.js`: established English audiology
   knowledge (anatomy, hearing-loss types/degrees, tests, conditions, devices)
   + translation guidance. Source-grounded (ASHA, NIH/NCBI, NIDCD). Safe to
   edit freely — no clinician sign-off needed (no Vietnamese in it).
2. **Tier 1 — authoritative glossary** — `lib/glossary.js` (185 entries, from
   `translations.html`). Marie-validated. The model uses it verbatim and it
   overrides everything else.
3. **Tier 2 — reference terms** — `lib/reference-terms.js` (95 researched
   audiology/medical EN↔VI terms, `status:'pending'`). Used as secondary
   guidance, explicitly flagged to the model as not-yet-clinician-approved and
   never allowed to override Tier 1.

**Validation / promotion workflow (Marie or Tram):**
- Review each `vi` in `lib/reference-terms.js`. Fix any wording you wouldn't
  actually say to a patient.
- For a confirmed term, either set its `status:'validated'`, or — better —
  add it as a row in `translations.html` so it becomes Tier 1 authoritative,
  then re-run `npm run extract-glossary`.
- To grow coverage, add more entries to `lib/reference-terms.js` (no rebuild
  step needed for that file) and redeploy.

## How it fits together

- `translations.html` — curated bilingual library (search + speak via the
  browser; no audio files needed).
- `translator.html` + `translator.js` — AI translator UI; POSTs to
  `/api/translate`. Speech is browser-native (`speechSynthesis` /
  `SpeechRecognition`), best in Chrome/Edge.
- `api/translate.js` — Claude (Haiku) + domain primer + Tier 1 glossary +
  Tier 2 reference terms, with Anthropic prompt caching, per-IP rate
  limiting, and the secret key.
- `lib/domain-context.js`, `lib/reference-terms.js` — see the two-tier
  knowledge section above.
- `scripts/extract-glossary.mjs` — build tool, run on your machine only.

## Translator behavior

- **Validated short-circuit:** if the input (accent/case/punctuation-
  insensitive) matches a phrase in Marie's Tier-1 glossary, the API returns
  her exact wording with **no model call** — instant, free, guaranteed —
  and the UI shows a green **"✓ Clinician-validated phrase"** badge.
  Otherwise it's model-generated and badged amber **"AI-assisted — verify."**
- **Pronoun helper:** when Vietnamese output contains the `bạn` placeholder,
  a dropdown (from Marie's validated pronoun table) substitutes the correct
  age/relationship pronoun in one tap; Listen/Copy use the substituted text.
- **Auto-detect** input language, **Copy** button, and an **in-session**
  history (memory only — intentionally not persisted, for patient privacy).
- Model calls use `temperature: 0`, few-shot examples from validated phrases,
  prompt-injection-resistant `<phrase>` delimiting, and output sanitation.
- **Neural voice:** "Listen" (translator + phrasebook) uses Azure
  `vi-VN-HoaiMyNeural` / `en-US-JennyNeural` via `/api/tts`, served as MP3.
  Output is deterministic so it's cached on the CDN, in the browser, and by
  the service worker — the fixed phrasebook synthesizes each phrase once.
  Offline / not-yet-configured / error → automatic graceful fallback to the
  browser's built-in voice. To change voices edit `TTS_VOICES` in
  `lib/text-utils.js`.

## Notes / limitations

- This is an AI communication aid, **not** formal HIPAA compliance and not a
  substitute for a certified medical interpreter (stated in-app).
- Vietnamese browser TTS quality varies by OS/device; Chrome/Edge recommended.
- Have Marie validate translator output and glossary terminology periodically;
  promote confirmed Tier-2 terms into `translations.html`.
