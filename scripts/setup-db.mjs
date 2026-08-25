/**
 * One-time Turso database setup.
 *
 *   node scripts/setup-db.mjs          # create the schema
 *   node scripts/setup-db.mjs --seed   # schema + a starter piece
 *
 * Reads TURSO_DATABASE_URL and TURSO_AUTH_TOKEN from the environment
 * (or from .env.local in this directory).
 *
 * Deliberately a script, not startup code: a serverless function is invoked
 * per-request, so running CREATE TABLE on every cold start would be wasted
 * work. Schema changes are a deploy-time concern, not a request-time one.
 */

import { createClient } from '@libsql/client'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

// Minimal .env.local reader so this script needs no extra dependency.
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^["']|["']$/g, '')
  }
}

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  console.error('TURSO_DATABASE_URL is not set.')
  console.error('Create .env.local with TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.')
  process.exit(1)
}

const db = createClient({ url, authToken })

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS pieces (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('poem', 'prose', 'essay', 'story', 'recipe')),
    tags TEXT NOT NULL DEFAULT '',
    is_ai_generated INTEGER NOT NULL DEFAULT 0,
    published_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`

console.log(`Connecting to ${url}`)
await db.execute(SCHEMA)
console.log('Schema ready.')

if (process.argv.includes('--seed')) {
  const { rows } = await db.execute('SELECT COUNT(*) AS n FROM pieces')
  if (Number(rows[0].n) > 0) {
    console.log(`Skipping seed: ${rows[0].n} piece(s) already present.`)
  } else {
    await db.execute({
      sql: 'INSERT INTO pieces (title, body, type, tags) VALUES (?, ?, ?, ?)',
      args: [
        'A Note on Beginnings',
        '<p>Every collection starts with a blank page. This one starts here.</p>',
        'prose',
        'meta',
      ],
    })
    console.log('Seeded one starter piece.')
  }
}

const { rows } = await db.execute('SELECT id, title, type FROM pieces ORDER BY id')
console.log(`\n${rows.length} piece(s) in the database:`)
for (const row of rows) console.log(`  ${row.id}  ${row.type.padEnd(7)} ${row.title}`)
