/**
 * Single source of truth for the pieces table shape. Imported by setup-db.mjs,
 * smoke-test.mts, and test-server.mts so the three never drift out of sync.
 *
 * `type` is restricted to a fixed set of categories at the database level via
 * a CHECK constraint.
 */
export const PIECES_COLUMNS = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('poem', 'prose', 'essay', 'story', 'recipe', 'found')),
  tags TEXT NOT NULL DEFAULT '',
  is_ai_generated INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL DEFAULT (datetime('now')),
  search_text TEXT NOT NULL DEFAULT ''
`

/**
 * Rate-limit log for AI generation. One row per generation that actually
 * reaches Claude (inserted after a successful call, not before — a failed
 * call shouldn't burn a cap slot). Checked against a rolling 24h window,
 * independent of the password gate, so a leaked password or a bug can't
 * run up API spend unnoticed.
 */
export const AI_GENERATIONS_COLUMNS = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
`

/**
 * Full-text search index over `pieces`.
 *
 * `content='pieces'` makes this an external-content table: FTS5 stores only
 * the inverted index and reads the original text back from `pieces`, so the
 * body is not duplicated on disk.
 *
 * The three triggers are the point. If the API maintained this index instead,
 * every other writer — the seed script, a migration, a manual INSERT — would
 * silently skip it and search results would drift from the collection. The
 * database keeps it in sync no matter who writes.
 *
 * The 'delete' row on the update/delete triggers is FTS5's required incantation
 * for retracting an already-indexed row; it is not an ordinary INSERT.
 */
export const FTS_STATEMENTS = [
  `CREATE VIRTUAL TABLE IF NOT EXISTS pieces_fts USING fts5(
     search_text,
     content='pieces',
     content_rowid='id',
     tokenize='porter unicode61'
   )`,
  `CREATE TRIGGER IF NOT EXISTS pieces_fts_insert AFTER INSERT ON pieces BEGIN
     INSERT INTO pieces_fts(rowid, search_text) VALUES (new.id, new.search_text);
   END`,
  `CREATE TRIGGER IF NOT EXISTS pieces_fts_delete AFTER DELETE ON pieces BEGIN
     INSERT INTO pieces_fts(pieces_fts, rowid, search_text)
     VALUES ('delete', old.id, old.search_text);
   END`,
  `CREATE TRIGGER IF NOT EXISTS pieces_fts_update AFTER UPDATE ON pieces BEGIN
     INSERT INTO pieces_fts(pieces_fts, rowid, search_text)
     VALUES ('delete', old.id, old.search_text);
     INSERT INTO pieces_fts(rowid, search_text) VALUES (new.id, new.search_text);
   END`,
]

/**
 * Builds the text that gets indexed for one piece.
 *
 * `body` is TipTap HTML, so the tags have to come out before indexing.
 * Leaving them in would make a search for "strong" match every bolded piece
 * and a search for "p" match everything, which looks fine right up until
 * someone searches a common word.
 *
 * Lives here, next to the schema, because the API, the seeder, the test
 * server and the backfill all have to derive this identically.
 */
export function toSearchText(title, body, tags) {
  const plain = String(body ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')

  return [title ?? '', tags ?? '', plain]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim()
}
