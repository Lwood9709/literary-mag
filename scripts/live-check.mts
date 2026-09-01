/**
 * Verifies a real, configured stack end-to-end — real database, real auth.
 *
 *   npm run check              # against local config (.env.local + api/ directly)
 *   npm run check -- <url>     # against a deployment, e.g. https://foo.vercel.app
 *
 * Creates one test piece and deletes it again. Safe to run against production,
 * but it does write, so it needs ADMIN_PASSWORD.
 */
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const envPath = path.join(root, '.env.local')

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m || process.env[m[1]]) continue
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const target = process.argv[2]
const password = process.env.ADMIN_PASSWORD ?? ''

let send: (method: string, p: string, opts?: { body?: unknown; password?: string }) => Promise<{ status: number; json: any; text: string }>

if (target) {
  const base = target.replace(/\/$/, '')
  console.log(`Checking deployment: ${base}\n`)
  send = async (method, p, opts = {}) => {
    const headers: Record<string, string> = {}
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
    if (opts.password !== undefined) headers['x-admin-password'] = opts.password
    const res = await fetch(base + p, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
    const text = await res.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, json, text }
  }
} else {
  console.log('Checking local config against the real database\n')
  const app = (await import('../api/index.js')).default
  send = async (method, p, opts = {}) => {
    const headers: Record<string, string> = {}
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
    if (opts.password !== undefined) headers['x-admin-password'] = opts.password
    const res = await app.fetch(new Request('http://localhost' + p, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    }))
    const text = await res.text()
    let json: any = null
    try { json = JSON.parse(text) } catch { /* not json */ }
    return { status: res.status, json, text }
  }
}

let pass = 0
let fail = 0
function check(name: string, ok: boolean, detail = '') {
  if (ok) { pass++; console.log(`  ok    ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}  ${detail}`) }
}

let r = await send('GET', '/api/pieces')
check('GET /api/pieces reaches the database', r.status === 200, `got ${r.status}: ${r.text.slice(0, 200)}`)
check('returns a paged envelope', Array.isArray(r.json?.pieces), r.text.slice(0, 200))
const before = typeof r.json?.total === 'number' ? r.json.total : -1
console.log(`        (${before} piece(s) currently stored)`)

r = await send('POST', '/api/pieces', { body: { title: 'x', body: '<p>x</p>', type: 'poem' } })
check('write without password is rejected', r.status === 401, `got ${r.status} — WRITES ARE OPEN`)

if (!password) {
  console.log('\n  ADMIN_PASSWORD not available locally; skipping write tests.')
} else {
  const draft = { title: '__live_check__', body: '<p>temporary</p>', type: 'prose', tags: 'tmp' }
  r = await send('POST', '/api/pieces', { body: draft, password })
  check('write with password succeeds', r.status === 201, `got ${r.status}: ${r.text.slice(0, 200)}`)
  const id = r.json?.id

  if (typeof id === 'number') {
    r = await send('GET', `/api/pieces/${id}`)
    check('the new piece reads back', r.status === 200 && r.json?.title === '__live_check__', `got ${r.status}`)

    r = await send('DELETE', `/api/pieces/${id}`, { password })
    check('cleanup: test piece deleted', r.status === 200, `got ${r.status}`)

    r = await send('GET', `/api/pieces/${id}`)
    check('cleanup verified: it is gone', r.status === 404, `got ${r.status}`)
  }
}

r = await send('GET', '/api/pieces')
const after = typeof r.json?.total === 'number' ? r.json.total : -1
check('database left as found', after === before, `before ${before}, after ${after}`)

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail === 0 ? 0 : 1)
