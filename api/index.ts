import { Hono, type MiddlewareHandler } from 'hono'
import { timingSafeEqual } from 'node:crypto'
import { db, toPiece, type Piece } from './db.js'

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

  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  const sql = `SELECT * FROM pieces${where} ORDER BY published_at DESC`

  const { rows } = await db.execute({ sql, args })
  return c.json(rows.map(toPiece))
})

app.get('/pieces/:id', async (c) => {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM pieces WHERE id = ?',
    args: [c.req.param('id')],
  })
  if (!rows[0]) return c.json({ error: 'Not found' }, 404)
  return c.json(toPiece(rows[0]))
})

app.post('/pieces', async (c) => {
  const body = await c.req.json<Partial<Piece>>()
  const { title, body: text, type, tags = '', is_ai_generated = 0 } = body

  if (!title || !text || !type) {
    return c.json({ error: 'title, body, and type are required' }, 400)
  }

  const result = await db.execute({
    sql: 'INSERT INTO pieces (title, body, type, tags, is_ai_generated) VALUES (?, ?, ?, ?, ?)',
    args: [title, text, type, tags, is_ai_generated ? 1 : 0],
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

  await db.execute({
    sql: 'UPDATE pieces SET title = ?, body = ?, type = ?, tags = ?, is_ai_generated = ? WHERE id = ?',
    args: [
      patch.title ?? current.title,
      patch.body ?? current.body,
      patch.type ?? current.type,
      patch.tags ?? current.tags,
      patch.is_ai_generated ?? current.is_ai_generated,
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
