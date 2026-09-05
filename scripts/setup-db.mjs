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
import {
  PIECES_COLUMNS,
  AI_GENERATIONS_COLUMNS,
  FTS_STATEMENTS,
  toSearchText,
} from './schema.mjs'

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

console.log(`Connecting to ${url}`)

// Fresh databases get the up-to-date table immediately.
await db.execute(`CREATE TABLE IF NOT EXISTS pieces (${PIECES_COLUMNS})`)
await db.execute(`CREATE TABLE IF NOT EXISTS ai_generations (${AI_GENERATIONS_COLUMNS})`)

// Migration: databases created before 'found' existed still carry the old
// CHECK constraint, and SQLite can't ALTER a CHECK in place. So if the stored
// table definition doesn't mention 'found', rebuild the table: copy the rows
// into a correctly-shaped table, then swap it in. Wrapped in a batch so it
// either fully succeeds or rolls back — the DB is never left half-migrated.
const { rows: schemaRows } = await db.execute(
  `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'pieces'`
)
const existingSql = schemaRows[0]?.sql

if (existingSql && !String(existingSql).includes("'found'")) {
  console.log("Migrating schema to allow the 'found' piece type...")
  await db.batch(
    [
      `CREATE TABLE pieces_migrated (${PIECES_COLUMNS})`,
      `INSERT INTO pieces_migrated SELECT * FROM pieces`,
      `DROP TABLE pieces`,
      `ALTER TABLE pieces_migrated RENAME TO pieces`,
    ],
    'write'
  )
  console.log('Migration complete.')
}

// Databases created before search existed have no search_text column.
// SQLite can ALTER TABLE ADD COLUMN in place, unlike changing a CHECK.
const { rows: cols } = await db.execute('PRAGMA table_info(pieces)')
if (!cols.some((c) => String(c.name) === 'search_text')) {
  console.log('Adding search_text column...')
  await db.execute("ALTER TABLE pieces ADD COLUMN search_text TEXT NOT NULL DEFAULT ''")
}

// Backfill happens in JS because stripping HTML is not something SQLite can
// do. Only rows whose stored text is stale get written.
const { rows: allRows } = await db.execute('SELECT id, title, body, tags, search_text FROM pieces')
const stale = allRows
  .map((r) => ({ id: Number(r.id), want: toSearchText(r.title, r.body, r.tags), have: String(r.search_text ?? '') }))
  .filter((r) => r.want !== r.have)

if (stale.length) {
  console.log(`Backfilling search_text for ${stale.length} piece(s)...`)
  await db.batch(
    stale.map((r) => ({
      sql: 'UPDATE pieces SET search_text = ? WHERE id = ?',
      args: [r.want, r.id],
    })),
    'write'
  )
}

for (const sql of FTS_STATEMENTS) await db.execute(sql)

// 'rebuild' regenerates the whole index from the content table. Idempotent,
// so re-running this script always leaves the index matching the rows rather
// than depending on what state it was already in.
await db.execute("INSERT INTO pieces_fts(pieces_fts) VALUES('rebuild')")

const { rows: idx } = await db.execute('SELECT COUNT(*) AS n FROM pieces_fts')
console.log(`Search index ready (${idx[0].n} row(s) indexed).`)

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
