# AuD Viet Translations — Deploy & Maintain

Static website + an AI audiology translator + an admin CMS. The site is plain
HTML/CSS/JS (no build step). Serverless functions on Vercel hold the secrets:
the Anthropic key (translator) and a Postgres database (the phrasebook, which
Marie edits through a password-protected admin page).

## Architecture at a glance

- **Phrasebook content lives in Postgres** (Neon), table `phrases`
  (`category, subsection, en, vi, note, sort_order`). It is the single source of
  truth for **both** the public phrasebook **and** the AI translator's Tier-1
  validated glossary.
- `GET /api/phrases` — public, returns the grouped phrasebook (rendered by
  `phrasebook.js` on `translations.html`).
- `/admin` — password-gated CMS (`admin.html/js/css`) where Marie adds / edits /
  deletes phrases. Backed by `POST /api/admin/login`, `/logout`, and the
  protected `/api/admin/phrases` CRUD endpoint.
- `api/translate.js` — Claude (Haiku) translator; loads the glossary from the DB
  (cached ~30s) so Marie's edits feed the AI automatically.

## Environment variables

| Var | What | Where it comes from |
|-----|------|---------------------|
| `ANTHROPIC_API_KEY` | Claude key for the translator | console.anthropic.com (set a hard monthly spend cap) |
| `POSTGRES_URL` | Neon connection string | auto-injected by the Neon integration |
| `ADMIN_PASSWORD` | password Marie logs into `/admin` with | you set it (strong value) |
| `ADMIN_SESSION_SECRET` | random key signing the admin session cookie | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

Without `ANTHROPIC_API_KEY` the translator runs in **demo mode** (validated
phrases still return real wording; everything else returns a clearly-labelled
placeholder). Without the DB the phrasebook is empty and the translator loses
its Tier-1 short-circuit but still works in AI mode.

## One-time setup

```sh
npm install
vercel link                                  # link this folder to the project (first time)

# 1. Database (Neon) — provisions + connects + injects POSTGRES_URL:
vercel integration add neon -m region=iad1 -e production -e preview -e development

# 2. Anthropic key:
vercel env add ANTHROPIC_API_KEY production  # paste the key when prompted

# 3. Admin credentials (all environments):
vercel env add ADMIN_PASSWORD production     # choose a strong password
vercel env add ADMIN_SESSION_SECRET production   # paste a random 32-byte hex string

# 4. Seed the phrasebook into the DB (185 starter entries from lib/glossary.js):
vercel env pull .env.local                   # fetch POSTGRES_URL locally
npm run seed

# 5. Deploy:
vercel --prod
```

## Updating the phrasebook (the normal workflow)

Marie does this herself — **no code, no redeploy:**

1. Go to `https://<site>/admin` and log in with `ADMIN_PASSWORD`.
2. Add / edit / delete phrases. Saves are immediate.
3. Changes appear in the admin view instantly, on the public phrasebook within
   ~60s (CDN cache), and in the AI translator within ~30s (glossary cache).

`lib/glossary.js` is now only the **seed** source (used once by `npm run seed`).
`lib/reference-terms.js` is still the static Tier-2 reference list.

## Local development

```sh
npm install
npm test                       # 7 logic tests should pass
vercel env pull .env.local     # POSTGRES_URL + admin vars for local funcs
vercel dev                     # open http://localhost:3000
```

Note: `vercel dev` reliably injects the Neon `POSTGRES_URL` but may not expose
custom vars (`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`) to functions — this is a
local-tooling quirk; those vars work correctly in deployed (preview/prod)
environments. To exercise the admin locally, load `.env.local` into your shell
before starting (`set -a; . ./.env.local; set +a; vercel dev`) if your version
honors it, or just test admin against a preview deploy.

## Installable app + offline (PWA)

`manifest.webmanifest` + `sw.js` (registered in `main.js`). Visitors can
**Install / Add to Home Screen**. The phrasebook works offline — the service
worker caches the last `/api/phrases` response (network-first). The AI
translator and the admin page require a connection.

**Bump the `CACHE` constant in `sw.js`** whenever you change static assets so
installed/offline users pick up the new version (currently `audviet-v3`).

## The translator's audiology knowledge (two tiers + primer)

The AI is "trained up" via grounding, not fine-tuning. Three layers feed its
(prompt-cached) system prompt:

1. **Domain primer** — `lib/domain-context.js`: English audiology knowledge +
   translation guidance. Safe to edit (no Vietnamese, no sign-off needed).
2. **Tier 1 — authoritative glossary** — the `phrases` table (edited via
   `/admin`). Marie-validated; used verbatim; overrides everything.
3. **Tier 2 — reference terms** — `lib/reference-terms.js` (~95 researched
   EN↔VI terms, `status:'pending'`). Secondary guidance, never overrides Tier 1.

**Promotion workflow:** review terms in `lib/reference-terms.js`; for a
confirmed one, add it as a phrase in `/admin` so it becomes Tier-1 authoritative.

## Translator behavior

- **Validated short-circuit:** input matching a DB phrase (accent/case/punct-
  insensitive) returns the exact wording with **no model call** — green
  "✓ Clinician-validated" badge. Otherwise model-generated, amber "AI-assisted".
- **Pronoun helper:** when Vietnamese output contains the `bạn` placeholder, a
  dropdown substitutes the age/relationship pronoun in one tap.
- **Auto-detect** input language, **Copy**, and an **in-session** history
  (memory only — not persisted, for patient privacy).
- `temperature: 0`, few-shot validated examples, prompt-injection-resistant
  `<phrase>` delimiting, output sanitation, per-IP rate limiting.

## Security notes

- Admin auth is a stateless signed cookie (HMAC-SHA256, `HttpOnly; Secure;
  SameSite=Strict`); the password check is constant-time; every admin API call
  is gated server-side. Set a strong `ADMIN_PASSWORD` and keep
  `ADMIN_SESSION_SECRET` private.
- This is an AI communication aid, **not** HIPAA compliance and not a substitute
  for a certified medical interpreter (stated in-app).

## Quality / tests

`npm test` runs `test/logic.test.mjs` — regression coverage for the
accuracy-critical pure logic in `lib/text-utils.js` (validated-match, pronoun
substitution, language detection, sanitation, closest-match). Run before deploy.
