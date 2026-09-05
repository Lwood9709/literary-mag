/**
 * Adds (or removes) the sample pieces in scripts/sample-pieces.mjs.
 *
 *   node scripts/seed-samples.mjs           # dry run, prints what it would do
 *   node scripts/seed-samples.mjs --write   # insert
 *   node scripts/seed-samples.mjs --undo --write
 *
 * Undo matches on exact title, so it removes only what this script added and
 * leaves anything you wrote yourself alone.
 *
 * Reads TURSO_DATABASE_URL from the environment or .env.local. That is the
 * production database, so --write is required to touch anything and the
 * target URL is printed before every run.
 */

import { createClient } from '@libsql/client'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { SAMPLE_PIECES } from './sample-pieces.mjs'
import { toSearchText } from './schema.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '..', '.env.local')

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
if (!url) {
  console.error('TURSO_DATABASE_URL is not set. Add it to .env.local.')
  process.exit(1)
}

const undo = process.argv.includes('--undo')
const write = process.argv.includes('--write')
const titles = SAMPLE_PIECES.map((p) => p.title)

console.log(`Database: ${url}`)
console.log(`Action:   ${undo ? 'remove' : 'insert'} ${titles.length} sample pieces`)
if (!write) {
  console.log('\nDry run. Nothing was changed. Re-run with --write to apply.\n')
  for (const t of titles) console.log(`  ${undo ? '-' : '+'} ${t}`)
  process.exit(0)
}

const db = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN })
const placeholders = titles.map(() => '?').join(', ')

if (undo) {
  const result = await db.execute({
    sql: `DELETE FROM pieces WHERE title IN (${placeholders})`,
    args: titles,
  })
  console.log(`\nRemoved ${result.rowsAffected} piece(s).`)
} else {
  // Skip titles already present so a second run doesn't duplicate the set.
  const { rows } = await db.execute({
    sql: `SELECT title FROM pieces WHERE title IN (${placeholders})`,
    args: titles,
  })
  const present = new Set(rows.map((r) => String(r.title)))
  const pending = SAMPLE_PIECES.filter((p) => !present.has(p.title))

  if (present.size) console.log(`Skipping ${present.size} already present.`)

  for (const p of pending) {
    await db.execute({
      sql: `INSERT INTO pieces (title, body, type, tags, search_text)
            VALUES (?, ?, ?, ?, ?)`,
      args: [p.title, p.body, p.type, p.tags, toSearchText(p.title, p.body, p.tags)],
    })
  }
  console.log(`\nInserted ${pending.length} piece(s).`)
}

const { rows } = await db.execute('SELECT COUNT(*) AS n FROM pieces')
console.log(`${rows[0].n} piece(s) now in the database.`)
