/**
 * End-to-end smoke test for the serverless API.
 *
 *   npm run test:api
 *
 * Runs against a throwaway local libSQL file — no Turso account or network
 * needed. Calls `app.fetch()` directly, the same entry point Vercel uses, so
 * routing, auth and SQL are all exercised without starting a server.
 */
import { createClient } from '@libsql/client'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PIECES_COLUMNS, AI_GENERATIONS_COLUMNS, FTS_STATEMENTS } from './schema.mjs'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DB_FILE = path.join(root, '.smoke-test.db').replace(/\\/g, '/')
const PASSWORD = 'test-password-123'

rmSync(DB_FILE, { force: true })

process.env.TURSO_DATABASE_URL = 'file:' + DB_FILE
process.env.ADMIN_PASSWORD = PASSWORD

const setup = createClient({ url: 'file:' + DB_FILE })
await setup.execute(`CREATE TABLE IF NOT EXISTS pieces (${PIECES_COLUMNS})`)
await setup.execute(`CREATE TABLE IF NOT EXISTS ai_generations (${AI_GENERATIONS_COLUMNS})`)
for (const sql of FTS_STATEMENTS) await setup.execute(sql)

// Imported after env is set: api/_lib/db.ts reads process.env at module load.
const app = (await import('../api/index.js')).default

const BASE = 'http://localhost'
let pass = 0
let fail = 0

function check(name: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ok    ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`) }
}

async function call(
  method: string,
  urlPath: string,
  opts: { body?: unknown; password?: string } = {}
) {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.password !== undefined) headers['x-admin-password'] = opts.password
  const res = await app.fetch(
    new Request(BASE + urlPath, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  )
  const text = await res.text()
  let json: any = null
  try { json = JSON.parse(text) } catch { /* not json */ }
  return { status: res.status, json, text }
}

console.log('\nreads are public')
let r = await call('GET', '/api/pieces')
check('GET /api/pieces -> 200', r.status === 200, `got ${r.status} ${r.text}`)
check('returns a paged envelope', Array.isArray(r.json?.pieces), JSON.stringify(r.json))
check('starts empty', r.json?.pieces.length === 0)
check('total starts at zero', r.json?.total === 0)
check('defaults to page 1', r.json?.page === 1)
check('defaults to a page size of 10', r.json?.pageSize === 10)

console.log('\nwrites require the password')
const draft = { title: 'Test Piece', body: '<p>hello</p>', type: 'recipe', tags: 'a,b' }

r = await call('POST', '/api/pieces', { body: draft })
check('POST no password -> 401', r.status === 401, `got ${r.status}`)

r = await call('POST', '/api/pieces', { body: draft, password: 'wrong' })
check('POST wrong password -> 401', r.status === 401, `got ${r.status}`)

r = await call('POST', '/api/pieces', { body: draft, password: 'a-completely-different-length' })
check('POST wrong-length password -> 401, no crash', r.status === 401, `got ${r.status}`)

r = await call('POST', '/api/pieces', { body: draft, password: PASSWORD })
check('POST correct password -> 201', r.status === 201, `got ${r.status} ${r.text}`)
check('created row has an id', typeof r.json?.id === 'number', JSON.stringify(r.json))
check('recipe type accepted', r.json?.type === 'recipe')
const id = r.json?.id

const foundDraft = {
  title: 'Found Poem',
  body: '<p>found text</p><p><em>— Some Author, via PoetryDB</em></p>',
  type: 'found',
  tags: 'Some Author, poetrydb',
}
r = await call('POST', '/api/pieces', { body: foundDraft, password: PASSWORD })
check('POST type=found -> 201', r.status === 201, `got ${r.status} ${r.text}`)
check('found type accepted', r.json?.type === 'found')
const foundId = r.json?.id

r = await call('GET', '/api/pieces?type=found')
check('?type=found finds it', r.json?.pieces.length === 1, JSON.stringify(r.json))

r = await call('DELETE', `/api/pieces/${foundId}`, { password: PASSWORD })
check('cleanup: found piece deleted', r.status === 200, `got ${r.status}`)

console.log('\nvalidation')
r = await call('POST', '/api/pieces', { body: { title: 'x' }, password: PASSWORD })
check('POST missing fields -> 400', r.status === 400, `got ${r.status}`)

console.log('\nread back')
r = await call('GET', `/api/pieces/${id}`)
check('GET by id -> 200', r.status === 200, `got ${r.status}`)
check('title round-trips', r.json?.title === 'Test Piece')
check('is_ai_generated is a number', typeof r.json?.is_ai_generated === 'number')

r = await call('GET', '/api/pieces/99999')
check('GET missing id -> 404', r.status === 404, `got ${r.status}`)

console.log('\nfilters')
r = await call('GET', '/api/pieces?type=recipe')
check('?type=recipe finds it', r.json?.pieces.length === 1, JSON.stringify(r.json))
r = await call('GET', '/api/pieces?type=poem')
check('?type=poem excludes it', r.json?.pieces.length === 0)
check('total tracks the filter, not the table', r.json?.total === 0)
r = await call('GET', '/api/pieces?tag=b')
check('?tag=b finds it', r.json?.pieces.length === 1)

console.log('\nsearch')
r = await call('GET', '/api/pieces?q=hello')
check('?q= matches body text', r.json?.pieces.length === 1, JSON.stringify(r.json))
check('echoes the query back', r.json?.query === 'hello')

r = await call('GET', '/api/pieces?q=Test')
check('?q= matches the title', r.json?.pieces.length === 1)

r = await call('GET', '/api/pieces?q=zzyzx')
check('?q= with no match is empty, not an error', r.status === 200 && r.json?.pieces.length === 0)

// The body is <p>hello</p>. If the raw HTML were indexed, "p" would match.
r = await call('GET', '/api/pieces?q=p')
check('HTML tag names are not indexed', r.json?.pieces.length === 0, JSON.stringify(r.json))

r = await call('GET', '/api/pieces?q=hello&type=poem')
check('search composes with ?type=', r.json?.pieces.length === 0)
r = await call('GET', '/api/pieces?q=hello&type=recipe')
check('search composes with a matching ?type=', r.json?.pieces.length === 1)

// FTS5 rejects these outright; the route retries them as a quoted phrase
// rather than handing a 500 to someone mid-keystroke.
for (const bad of ['"unbalanced', 'trailing AND', 'NEAR', '*', '((']) {
  r = await call('GET', `/api/pieces?q=${encodeURIComponent(bad)}`)
  check(`malformed query ${JSON.stringify(bad)} -> 200`, r.status === 200, `got ${r.status}`)
}

console.log('\nupdate')
r = await call('PUT', `/api/pieces/${id}`, { body: { title: 'Renamed' } })
check('PUT no password -> 401', r.status === 401, `got ${r.status}`)

r = await call('PUT', `/api/pieces/${id}`, { body: { title: 'Renamed' }, password: PASSWORD })
check('PUT -> 200', r.status === 200, `got ${r.status}`)
check('title updated', r.json?.title === 'Renamed')
check('untouched field preserved', r.json?.tags === 'a,b', JSON.stringify(r.json))

r = await call('PUT', '/api/pieces/99999', { body: { title: 'x' }, password: PASSWORD })
check('PUT missing id -> 404', r.status === 404, `got ${r.status}`)

console.log('\ndelete')
r = await call('DELETE', `/api/pieces/${id}`)
check('DELETE no password -> 401', r.status === 401, `got ${r.status}`)

r = await call('DELETE', `/api/pieces/${id}`, { password: PASSWORD })
check('DELETE -> 200', r.status === 200, `got ${r.status}`)

r = await call('GET', `/api/pieces/${id}`)
check('gone afterwards -> 404', r.status === 404, `got ${r.status}`)

r = await call('DELETE', `/api/pieces/${id}`, { password: PASSWORD })
check('DELETE again -> 404', r.status === 404, `got ${r.status}`)

// AI generation: only the auth/validation/rate-limit paths are exercised here,
// never a real Claude call. Those checks all run before generatePiece() is
// ever invoked, so no ANTHROPIC_API_KEY or network access is needed.
console.log('\nAI generation (auth, validation, and rate limit only — never calls Claude)')

r = await call('POST', '/api/generate', { body: { type: 'poem' } })
check('POST /api/generate no password -> 401', r.status === 401, `got ${r.status}`)

r = await call('POST', '/api/generate', { body: {}, password: PASSWORD })
check('POST /api/generate missing type -> 400', r.status === 400, `got ${r.status}`)

// Fill the daily cap directly, bypassing the route entirely, then confirm
// the next request is rejected before it would ever reach Claude.
for (let i = 0; i < 3; i++) {
  await setup.execute(`INSERT INTO ai_generations DEFAULT VALUES`)
}
r = await call('POST', '/api/generate', { body: { type: 'poem' }, password: PASSWORD })
check('POST /api/generate at daily cap -> 429', r.status === 429, `got ${r.status} ${r.text}`)

console.log(`\n${pass} passed, ${fail} failed\n`)

// The scratch database is deleted at the start of each run rather than here:
// on Windows the file handle can outlive close(), so unlinking now is
// unreliable. It is gitignored either way.
setup.close()
process.exit(fail === 0 ? 0 : 1)
