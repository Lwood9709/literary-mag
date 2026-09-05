import { Hono, type MiddlewareHandler } from 'hono'
import { timingSafeEqual } from 'node:crypto'
import { db, toPiece, type Piece } from './_lib/db.js'
import { checkRateLimit, logGeneration, generatePiece, GenerationError } from './_lib/generate.js'
import { toSearchText } from '../scripts/schema.mjs'

// basePath('/api') means routes are declared relative to /api, matching the
// public URLs. vercel.json rewrites every /api/* request into this function.
const app = new Hono().basePath('/api')

/**
 * Password gate for writes. Reads stay public so anyone with the link can
 * browse the magazine; only create/update/delete need the shared secret.
 *
 * This is a shared password, not user accounts — appropriate for a
 * single-author demo, not for anything multi-user.
 */
const requireAdmin: MiddlewareHandler = async (c, next) => {
  const expected = process.env.ADMIN_PASSWORD

  // Fail closed: with no password configured, writes are disabled entirely
  // rather than left open.
  if (!expected) {
    return c.json({ error: 'Writes are disabled: ADMIN_PASSWORD is not set' }, 503)
  }

  const given = c.req.header('x-admin-password') ?? ''
  const a = Buffer.from(given)
  const b = Buffer.from(expected)

  // timingSafeEqual throws on length mismatch, so check length first. Compared
  // this way so response time doesn't leak how much of the password matched.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  await next()
}

app.on(['POST', 'PUT', 'DELETE'], '/pieces/*', requireAdmin)

app.on(['POST', 'PUT', 'DELETE'], '/pieces', requireAdmin)

// Costs real money per call, so it gets the same gate as writes even though
// it doesn't itself touch the pieces table.
app.on(['POST'], '/generate', requireAdmin)

const DEFAULT_PAGE_SIZE = 10
const MAX_PAGE_SIZE = 100

/**
 * Query params arrive as strings and can be anything at all. Parse to a
 * positive integer, fall back when absent or junk, clamp so a caller can't
 * ask for the whole table with ?pageSize=100000.
 */
function positiveInt(raw: string | undefined, fallback: number, max: number): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return fallback
  return Math.min(n, max)
}

app.get('/pieces', async (c) => {
  const { type, tag } = c.req.query()
  const conditions: string[] = []
  const args: string[] = []

  if (type) {
    conditions.push('type = ?')
    args.push(type)
  }
  if (tag) {
    conditions.push('tags LIKE ?')
    args.push(`%${tag}%`)
  }

  const q = (c.req.query('q') ?? '').trim()

  // With a query, rows come through the FTS index and are ordered by
  // relevance. Without one, straight off the table, newest first.
  const from = q
    ? 'pieces p JOIN pieces_fts f ON p.id = f.rowid'
    : 'pieces p'
  if (q) conditions.unshift('pieces_fts MATCH ?')

  const scoped = conditions.map((cond) =>
    cond.startsWith('pieces_fts') ? cond : `p.${cond}`
  )
  const where = scoped.length ? ` WHERE ${scoped.join(' AND ')}` : ''
  // `id DESC` is not decoration. published_at has second granularity, so
  // pieces saved in the same second tie, and OFFSET over an unstable sort can
  // skip or repeat rows between pages. The id breaks every tie.
  const order = q ? 'f.rank' : 'p.published_at DESC, p.id DESC'

  const pageSize = positiveInt(c.req.query('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE)
  const rawPage = positiveInt(c.req.query('page'), 1, Number.MAX_SAFE_INTEGER)

  async function run(matchTerm: string | null) {
    const queryArgs = matchTerm === null ? args : [matchTerm, ...args]

    const { rows: countRows } = await db.execute({
      sql: `SELECT COUNT(*) AS n FROM ${from}${where}`,
      args: queryArgs,
    })
    const total = Number(countRows[0]?.n ?? 0)
    const lastPage = Math.max(1, Math.ceil(total / pageSize))
    // Clamped rather than 404'd: asking past the end lands on the last page.
    const page = Math.min(rawPage, lastPage)

    const { rows } = await db.execute({
      sql: `SELECT p.* FROM ${from}${where} ORDER BY ${order} LIMIT ? OFFSET ?`,
      args: [...queryArgs, pageSize, (page - 1) * pageSize],
    })

    return { pieces: rows.map(toPiece), total, page, pageSize, query: q }
  }

  if (!q) return c.json(await run(null))

  try {
    return c.json(await run(q))
  } catch {
    // FTS5 rejects malformed queries: an unbalanced quote, a trailing AND,
    // a bare NEAR. Rather than 400 on a half-typed search box, retry the
    // whole thing as one quoted phrase, which always parses.
    try {
      return c.json(await run(`"${q.replace(/"/g, '')}"`))
    } catch {
      return c.json({ error: 'That search could not be parsed' }, 400)
    }
  }
})

app.get('/pieces/:id', async (c) => {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM pieces WHERE id = ?',
    args: [c.req.param('id')],
  })
  if (!rows[0]) return c.json({ error: 'Not found' }, 404)
  return c.json(toPiece(rows[0]))
})

app.post('/generate', async (c) => {
  if (!(await checkRateLimit())) {
    return c.json({ error: 'Daily generation limit reached' }, 429)
  }

  const { type, mood } = await c.req.json<{ type?: string; mood?: string }>()
  if (!type) {
    return c.json({ error: 'type is required' }, 400)
  }

  try {
    const piece = await generatePiece(type, mood)
    await logGeneration()
    return c.json(piece)
  } catch (err) {
    const message = err instanceof GenerationError ? err.message : 'Generation failed'
    return c.json({ error: message }, 502)
  }
})

app.post('/pieces', async (c) => {
  const body = await c.req.json<Partial<Piece>>()
  const { title, body: text, type, tags = '', is_ai_generated = 0 } = body

  if (!title || !text || !type) {
    return c.json({ error: 'title, body, and type are required' }, 400)
  }

  const result = await db.execute({
    sql: `INSERT INTO pieces (title, body, type, tags, is_ai_generated, search_text)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [title, text, type, tags, is_ai_generated ? 1 : 0, toSearchText(title, text, tags)],
  })

  const { rows } = await db.execute({
    sql: 'SELECT * FROM pieces WHERE id = ?',
    args: [Number(result.lastInsertRowid)],
  })
  return c.json(toPiece(rows[0]!), 201)
})

app.put('/pieces/:id', async (c) => {
  const id = c.req.param('id')

  const existing = await db.execute({
    sql: 'SELECT * FROM pieces WHERE id = ?',
    args: [id],
  })
  if (!existing.rows[0]) return c.json({ error: 'Not found' }, 404)

  const current = toPiece(existing.rows[0])
  const patch = await c.req.json<Partial<Piece>>()

  // Merged first, then indexed. Deriving search_text from the patch alone
  // would drop whichever fields this request left out.
  const merged = {
    title: patch.title ?? current.title,
    body: patch.body ?? current.body,
    type: patch.type ?? current.type,
    tags: patch.tags ?? current.tags,
    is_ai_generated: patch.is_ai_generated ?? current.is_ai_generated,
  }

  await db.execute({
    sql: `UPDATE pieces SET title = ?, body = ?, type = ?, tags = ?,
          is_ai_generated = ?, search_text = ? WHERE id = ?`,
    args: [
      merged.title,
      merged.body,
      merged.type,
      merged.tags,
      merged.is_ai_generated,
      toSearchText(merged.title, merged.body, merged.tags),
      id,
    ],
  })

  const { rows } = await db.execute({
    sql: 'SELECT * FROM pieces WHERE id = ?',
    args: [id],
  })
  return c.json(toPiece(rows[0]!))
})

app.delete('/pieces/:id', async (c) => {
  const result = await db.execute({
    sql: 'DELETE FROM pieces WHERE id = ?',
    args: [c.req.param('id')],
  })
  if (result.rowsAffected === 0) return c.json({ error: 'Not found' }, 404)
  return c.json({ success: true })
})

// Vercel's Node runtime accepts an object with a `fetch` method as the default
// export. A Hono app already is one.
export default app
