import { createClient, type Row } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN

if (!url) {
  throw new Error(
    'TURSO_DATABASE_URL is not set. Add it to .env.local for local dev, ' +
      'and to the Vercel project environment variables for deploys.'
  )
}

// @libsql/client talks to Turso over HTTP using only `fetch` — no native
// modules, which is what makes it work in a serverless function. The old
// better-sqlite3 driver needed a real filesystem and a long-lived process.
export const db = createClient({ url, authToken })

export type Piece = {
  id: number
  title: string
  body: string
  type: string
  tags: string
  is_ai_generated: number
  published_at: string
}

/**
 * libSQL returns loosely-typed rows (values can be string | number | bigint |
 * ArrayBuffer | null). Narrow them into our Piece shape at the boundary so the
 * rest of the code works with real types.
 */
export function toPiece(row: Row): Piece {
  return {
    id: Number(row.id),
    title: String(row.title),
    body: String(row.body),
    type: String(row.type),
    tags: row.tags == null ? '' : String(row.tags),
    is_ai_generated: Number(row.is_ai_generated),
    published_at: String(row.published_at),
  }
}
