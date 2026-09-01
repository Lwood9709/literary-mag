/**
 * Self-contained server for Cypress: serves the built client and the real
 * api/ Hono app together on one origin, exactly like production, but backed
 * by a throwaway local libSQL file instead of Turso.
 *
 *   npm run test:server
 *
 * Never touches production Turso — no secrets needed, safe to run in CI.
 */
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { createClient } from '@libsql/client'
import { Hono } from 'hono'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PIECES_COLUMNS, AI_GENERATIONS_COLUMNS } from './schema.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DB_FILE = path.join(root, '.cypress.db').replace(/\\/g, '/')
const DIST_DIR = path.join(root, 'client', 'dist').replace(/\\/g, '/')
const PORT = 4173

export const TEST_PASSWORD = 'cypress-test-password'

rmSync(DB_FILE, { force: true })

// Set before importing api/index.ts — api/db.ts reads process.env at module
// load, so the order here matters (same constraint documented in
// scripts/smoke-test.mts).
process.env.TURSO_DATABASE_URL = 'file:' + DB_FILE
process.env.ADMIN_PASSWORD = TEST_PASSWORD

const db = createClient({ url: 'file:' + DB_FILE })

// The first ten exist so the public list has more than one page at the
// default page size of 10. They are inserted first, so the four named
// fixtures below keep the highest ids and stay on page 1, where
// reading.cy.ts expects to find them.
const FILLER = Array.from({ length: 10 }, (_, i) => ({
  title: `Filler Piece ${String(i + 1).padStart(2, '0')}`,
  body: `<p>Placeholder body number ${i + 1}.</p>`,
  type: 'prose',
  tags: 'filler',
}))

const FIXTURES = [
  ...FILLER,
  {
    title: 'The Quiet Hour',
    body: '<p>Light moves slowly across the floor.</p>',
    type: 'poem',
    tags: 'evening, light',
  },
  {
    title: 'A Note on Bread',
    body: '<p>Flour, water, salt, time.</p>',
    type: 'essay',
    tags: 'food',
  },
  {
    title: 'Winter Soup',
    body: '<ul><li><p>Onion</p></li><li><p>Stock</p></li></ul>',
    type: 'recipe',
    tags: 'dinner',
  },
  {
    title: 'A Found Sonnet',
    body: '<p>Borrowed lines, kept whole.</p><p><em>— Test Author, via PoetryDB</em></p>',
    type: 'found',
    tags: 'Test Author, poetrydb',
  },
]

async function reseed() {
  await db.execute('DELETE FROM pieces')
  for (const f of FIXTURES) {
    await db.execute({
      sql: 'INSERT INTO pieces (title, body, type, tags) VALUES (?, ?, ?, ?)',
      args: [f.title, f.body, f.type, f.tags],
    })
  }
}

await db.execute(`CREATE TABLE IF NOT EXISTS pieces (${PIECES_COLUMNS})`)
await db.execute(`CREATE TABLE IF NOT EXISTS ai_generations (${AI_GENERATIONS_COLUMNS})`)
await reseed()

// Imported after env is set and the schema exists.
const apiApp = (await import('../api/index.js')).default

const app = new Hono()

// apiApp already declares routes under basePath('/api'), so a full request
// (path included) can be handed to it directly — no prefix stripping needed.
app.all('/api/*', (c) => apiApp.fetch(c.req.raw))

// Test-only route. Lives here, in the harness, never in api/index.ts — so no
// test affordance ever ships to production.
app.post('/__test__/reset', async (c) => {
  await reseed()
  return c.json({ ok: true })
})

app.use('/*', serveStatic({ root: DIST_DIR }))
app.get('*', serveStatic({ path: path.join(DIST_DIR, 'index.html') }))

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`Test server ready on http://localhost:${PORT}`)
})
