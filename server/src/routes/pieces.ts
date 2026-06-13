import { Hono } from 'hono'
import db from '../db/database.js'

type Piece = {
  id: number
  title: string
  body: string
  type: string
  tags: string
  is_ai_generated: number
  published_at: string
}

const pieces = new Hono()

pieces.get('/', (c) => {
  const { type, tag } = c.req.query()
  let query = 'SELECT * FROM pieces'
  const conditions: string[] = []
  const params: string[] = []

  if (type) {
    conditions.push('type = ?')
    params.push(type)
  }
  if (tag) {
    conditions.push('tags LIKE ?')
    params.push(`%${tag}%`)
  }
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY published_at DESC'

  const rows = db.prepare(query).all(...params) as Piece[]
  return c.json(rows)
})

pieces.get('/:id', (c) => {
  const id = c.req.param('id')
  const piece = db.prepare('SELECT * FROM pieces WHERE id = ?').get(id) as Piece | undefined
  if (!piece) return c.json({ error: 'Not found' }, 404)
  return c.json(piece)
})

pieces.post('/', async (c) => {
  const body = await c.req.json<Omit<Piece, 'id' | 'published_at'>>()
  const { title, body: text, type, tags = '', is_ai_generated = 0 } = body

  if (!title || !text || !type) {
    return c.json({ error: 'title, body, and type are required' }, 400)
  }

  const result = db
    .prepare(
      'INSERT INTO pieces (title, body, type, tags, is_ai_generated) VALUES (?, ?, ?, ?, ?)'
    )
    .run(title, text, type, tags, is_ai_generated ? 1 : 0)

  const created = db.prepare('SELECT * FROM pieces WHERE id = ?').get(result.lastInsertRowid) as Piece
  return c.json(created, 201)
})

pieces.put('/:id', async (c) => {
  const id = c.req.param('id')
  const existing = db.prepare('SELECT * FROM pieces WHERE id = ?').get(id) as Piece | undefined
  if (!existing) return c.json({ error: 'Not found' }, 404)

  const body = await c.req.json<Partial<Omit<Piece, 'id' | 'published_at'>>>()
  const title = body.title ?? existing.title
  const text = body.body ?? existing.body
  const type = body.type ?? existing.type
  const tags = body.tags ?? existing.tags
  const is_ai_generated = body.is_ai_generated ?? existing.is_ai_generated

  db.prepare(
    'UPDATE pieces SET title = ?, body = ?, type = ?, tags = ?, is_ai_generated = ? WHERE id = ?'
  ).run(title, text, type, tags, is_ai_generated, id)

  const updated = db.prepare('SELECT * FROM pieces WHERE id = ?').get(id) as Piece
  return c.json(updated)
})

pieces.delete('/:id', (c) => {
  const id = c.req.param('id')
  const existing = db.prepare('SELECT * FROM pieces WHERE id = ?').get(id)
  if (!existing) return c.json({ error: 'Not found' }, 404)
  db.prepare('DELETE FROM pieces WHERE id = ?').run(id)
  return c.json({ success: true })
})

export default pieces
