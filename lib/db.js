/* Data layer for the `phrases` table (Neon Postgres via @vercel/postgres).
 *
 * @vercel/postgres reads POSTGRES_URL from the environment (injected by the
 * Vercel Neon integration; pull locally with `vercel env pull`). All queries
 * use the tagged-template `sql` helper, which parameterizes interpolations —
 * so values are never string-concatenated into SQL (no injection surface).
 */

import { sql } from '@vercel/postgres';

/* Fixed display order for the public, grouped view. Any category not listed
 * here is appended afterwards in alphabetical order. */
const CATEGORY_ORDER = [
  'pronouns',
  'greetings',
  'history',
  'testing',
  'diagnoses',
  'results',
];

/* Columns a client is allowed to set/update. Anything else is ignored —
 * guards against mass-assignment (e.g. id, created_at, updated_at). */
const WRITABLE_FIELDS = [
  'category',
  'subsection',
  'en',
  'vi',
  'note',
  'sort_order',
];

/* Canonical UUID shape. Lets us treat a malformed id as "not found" instead of
 * letting Postgres throw "invalid input syntax for type uuid". */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Create the `phrases` table if it doesn't already exist. Idempotent. */
export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS phrases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      category text NOT NULL,
      subsection text NOT NULL DEFAULT '',
      en text NOT NULL DEFAULT '',
      vi text NOT NULL,
      note text,
      sort_order int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

/**
 * Flat list of all rows for the admin table.
 * @returns {Promise<Array<{id,category,subsection,en,vi,note,sort_order}>>}
 */
export async function getAllPhrases() {
  const { rows } = await sql`
    SELECT id, category, subsection, en, vi, note, sort_order
    FROM phrases
    ORDER BY category, sort_order, created_at
  `;
  return rows;
}

/**
 * Grouped, ordered view for the public phrasebook.
 * @returns {Promise<{ categories: Array<{ key, subsections: Array<{ title, rows: Array<{id,en,vi,note}> }> }> }>}
 *
 * Category order: the fixed CATEGORY_ORDER list first, then any other
 * categories alphabetically. Within a category, subsections are ordered by
 * their minimum sort_order; rows within a subsection by sort_order.
 */
export async function getGroupedPhrases() {
  const { rows } = await sql`
    SELECT id, category, subsection, en, vi, note, sort_order
    FROM phrases
    ORDER BY category, sort_order, created_at
  `;

  // category -> subsection -> { rows, minSort }
  const byCategory = new Map();

  for (const r of rows) {
    if (!byCategory.has(r.category)) byCategory.set(r.category, new Map());
    const subs = byCategory.get(r.category);
    const title = r.subsection || '';
    if (!subs.has(title)) subs.set(title, { rows: [], minSort: r.sort_order });
    const entry = subs.get(title);
    entry.rows.push({ id: r.id, en: r.en, vi: r.vi, note: r.note });
    if (r.sort_order < entry.minSort) entry.minSort = r.sort_order;
  }

  // Order categories: fixed list first (only those present), then the rest A→Z.
  const present = [...byCategory.keys()];
  const ordered = [
    ...CATEGORY_ORDER.filter((c) => byCategory.has(c)),
    ...present.filter((c) => !CATEGORY_ORDER.includes(c)).sort(),
  ];

  const categories = ordered.map((key) => {
    const subs = [...byCategory.get(key).entries()]
      .sort((a, b) => a[1].minSort - b[1].minSort)
      .map(([title, { rows: r }]) => ({ title, rows: r }));
    return { key, subsections: subs };
  });

  return { categories };
}

/** Insert a new phrase. Returns the created row. */
export async function createPhrase({
  category,
  subsection = '',
  en = '',
  vi,
  note = null,
  sort_order = 0,
}) {
  const { rows } = await sql`
    INSERT INTO phrases (category, subsection, en, vi, note, sort_order)
    VALUES (${category}, ${subsection}, ${en}, ${vi}, ${note}, ${sort_order})
    RETURNING id, category, subsection, en, vi, note, sort_order, created_at, updated_at
  `;
  return rows[0];
}

/**
 * Update whitelisted fields of a phrase. Sets updated_at=now().
 * @returns the updated row, or null if no such id (or no valid fields given).
 */
export async function updatePhrase(id, fields) {
  if (!UUID_RE.test(String(id || ''))) return null;
  // Whitelist + build an ordered list of (column, value) pairs.
  const entries = Object.entries(fields || {}).filter(([k]) =>
    WRITABLE_FIELDS.includes(k)
  );
  if (entries.length === 0) return null;

  // Build a parameterized SET clause. We use sql.query (the low-level escape
  // hatch) because column names can't be tagged-template params; the column
  // names are drawn ONLY from the WRITABLE_FIELDS whitelist above, never from
  // user input, so they're safe to interpolate. Values are still $N params.
  const setParts = [];
  const values = [];
  let i = 1;
  for (const [col, val] of entries) {
    setParts.push(`${col} = $${i++}`);
    values.push(val);
  }
  setParts.push('updated_at = now()');
  values.push(id); // final param = WHERE id

  const text = `
    UPDATE phrases
    SET ${setParts.join(', ')}
    WHERE id = $${i}
    RETURNING id, category, subsection, en, vi, note, sort_order, created_at, updated_at
  `;
  const { rows } = await sql.query(text, values);
  return rows[0] || null;
}

/** Delete a phrase by id. Returns true if a row was removed. */
export async function deletePhrase(id) {
  if (!UUID_RE.test(String(id || ''))) return false;
  const { rowCount } = await sql`DELETE FROM phrases WHERE id = ${id}`;
  return rowCount > 0;
}
