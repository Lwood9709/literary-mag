import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { z } from 'zod'
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
that type — genuinely creative, not a placeholder or an outline. If provided, the mood or theme should meaningfully influence the piece. 
Do not be too literal or on the nose, but rather use the mood or theme to inspire the piece.

"body" must be HTML using only these tags: <p>, <br>, <h2>, <h3>, <strong>, <em>,
<blockquote>, <ul>, <ol>, <li>. No other tags, no markdown, no attributes.`

// Enforced by the API itself (output_config.format below) rather than by
// asking nicely in the prompt — a prompted-JSON approach failed in practice:
// Haiku would sometimes wrap the object in markdown fences or add a stray
// sentence, breaking JSON.parse. Structured outputs constrain the response
// at the API level, so malformed output isn't possible to begin with.
const PieceSchema = z.object({
  title: z.string(),
  body: z.string(),
})

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
    response = await client.messages.parse({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: zodOutputFormat(PieceSchema) },
    })
  } catch (err) {
    throw new GenerationError(`Claude API call failed: ${(err as Error).message}`)
  }

  if (!response.parsed_output) {
    throw new GenerationError('Claude response did not match the expected shape')
  }

  return response.parsed_output
}
