import Database, { type Database as DB } from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(__dirname, '..', '..', 'literary.db')

const db = new Database(dbPath)

db.exec(`
  CREATE TABLE IF NOT EXISTS pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('poem', 'prose', 'essay', 'story')),
    tags TEXT NOT NULL DEFAULT '',
    is_ai_generated INTEGER NOT NULL DEFAULT 0,
    published_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`)

export default db as DB
