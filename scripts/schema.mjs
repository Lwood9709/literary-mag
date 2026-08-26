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
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
`
