import Anthropic from '@anthropic-ai/sdk'
import { db } from './db.js'

const MODEL = 'claude-haiku-4-5'
const MAX_TOKENS = 800
const DAILY_CAP = 3

/** True if a generation is still allowed within the rolling 24h window. */
export async function checkRateLimit(): Promise<boolean> {
  const { rows } = await db.execute(
    `SELECT COUNT(*) AS n FROM ai_generations WHERE created_at > datetime('now', '-1 day')`
  )
  return Number(rows[0]?.n ?? 0) < DAILY_CAP
}

/** Records one generation attempt that reached Claude. Call only on success. */
export async function logGeneration(): Promise<void> {
  await db.execute('INSERT INTO ai_generations DEFAULT VALUES')
}

const SYSTEM_PROMPT = `You write original short pieces for a literary magazine. Given a
piece type and an optional mood or theme, write one complete, publication-ready piece in
that type — genuinely creative, not a placeholder or an outline.

Respond with nothing but a single JSON object, no surrounding prose or code fences:
{"title": "...", "body": "..."}

"body" must be HTML using only these tags: <p>, <br>, <h2>, <h3>, <strong>, <em>,
<blockquote>, <ul>, <ol>, <li>. No other tags, no markdown, no attributes.`

export class GenerationError extends Error {}

/**
 * Calls Claude to draft one piece. Constructs the client lazily, on call —
 * not at module load — so an unrelated route (or a test that only imports
 * api/index.ts) never fails just because ANTHROPIC_API_KEY isn't set. Only
 * this function actually needs it.
 */
export async function generatePiece(
  type: string,
  mood?: string
): Promise<{ title: string; body: string }> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new GenerationError('ANTHROPIC_API_KEY is not set')
  }

  const client = new Anthropic()

  const userPrompt = mood
    ? `Type: ${type}\nMood or theme: ${mood}`
    : `Type: ${type}`

  let response
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
  } catch (err) {
    throw new GenerationError(`Claude API call failed: ${(err as Error).message}`)
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new GenerationError('Claude returned no text content')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    throw new GenerationError('Claude response was not valid JSON')
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as Record<string, unknown>).title !== 'string' ||
    typeof (parsed as Record<string, unknown>).body !== 'string'
  ) {
    throw new GenerationError('Claude response was missing title or body')
  }

  const { title, body } = parsed as { title: string; body: string }
  return { title, body }
}
