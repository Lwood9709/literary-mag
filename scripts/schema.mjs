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
