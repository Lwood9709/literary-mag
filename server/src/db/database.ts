import Database, { type Database as DB } from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', '..', 'literary.db')

const db = new Database(dbPath)

// Single source of truth for the table's shape. `type` is restricted to a
// fixed set of categories at the database level via a CHECK constraint.
const PIECES_COLUMNS = `
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('poem', 'prose', 'essay', 'story', 'recipe')),
  tags TEXT NOT NULL DEFAULT '',
  is_ai_generated INTEGER NOT NULL DEFAULT 0,
  published_at TEXT NOT NULL DEFAULT (datetime('now'))
`

// Fresh installs get the up-to-date table immediately.
db.exec(`CREATE TABLE IF NOT EXISTS pieces (${PIECES_COLUMNS})`)

// Migration: databases created before 'recipe' existed still carry the old
// CHECK constraint, and SQLite can't ALTER a CHECK in place. So if the stored
// table definition doesn't mention 'recipe', rebuild the table: copy the rows
// into a correctly-shaped table, then swap it in. Wrapped in a transaction so
// it either fully succeeds or rolls back — the DB is never left half-migrated.
const existing = db
  .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'pieces'`)
  .get() as { sql: string } | undefined

if (existing && !existing.sql.includes("'recipe'")) {
  const migrate = db.transaction(() => {
    db.exec(`CREATE TABLE pieces_migrated (${PIECES_COLUMNS})`)
    db.exec(`INSERT INTO pieces_migrated SELECT * FROM pieces`)
    db.exec(`DROP TABLE pieces`)
    db.exec(`ALTER TABLE pieces_migrated RENAME TO pieces`)
  })
  migrate()
}

export default db as DB
