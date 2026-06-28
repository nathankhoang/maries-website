/* Seed the `phrases` table from lib/glossary.js.
 *
 * Idempotent: ensures the schema, TRUNCATEs the table, then re-inserts every
 * glossary entry with sort_order = its array index (so the curated order is
 * preserved exactly). Order maps directly to the source-of-truth array.
 *
 * Run with:  npm run seed   (needs POSTGRES_URL in env — e.g. after
 * `vercel env pull`). Do NOT run without a provisioned database.
 */

import { sql } from '@vercel/postgres';
import GLOSSARY from '../lib/glossary.js';
import { ensureSchema, createPhrase } from '../lib/db.js';

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error(
      'POSTGRES_URL is not set. Run `vercel env pull` (or export it) first.'
    );
    process.exit(1);
  }

  console.log('Ensuring schema…');
  await ensureSchema();

  console.log(`Truncating phrases and seeding ${GLOSSARY.length} entries…`);
  await sql`TRUNCATE TABLE phrases`;

  let count = 0;
  for (let i = 0; i < GLOSSARY.length; i++) {
    const r = GLOSSARY[i];
    await createPhrase({
      category: r.category ?? '',
      subsection: r.subsection ?? '',
      en: r.en ?? '',
      vi: r.vi ?? '',
      note: r.note ?? null,
      sort_order: i, // preserve glossary array order
    });
    count++;
  }

  console.log(`Done. Seeded ${count} phrases.`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Seed failed:', err?.message || err);
  process.exit(1);
});
