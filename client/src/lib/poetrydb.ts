/**
 * Client for poetrydb.org — fetches a public-domain poem, semi-randomly,
 * for the admin "Find a poem" import flow. CORS is open on their end
 * (Access-Control-Allow-Origin: *), so this calls the API directly from
 * the browser; nothing routes through our own server.
 */

export type FoundPoem = {
  title: string
  author: string
  html: string
  linecount: number
}

type RawPoem = {
  title: string
  author: string
  lines: string[]
  linecount: string
}

/**
 * A poem not found comes back as `{"status":404,"reason":"Not found"}` with
 * an HTTP 200 — not an array, not an error status. Every response has to be
 * checked with Array.isArray() rather than res.ok.
 */
type PoetryDbResponse = RawPoem[] | { status: number; reason: string }

const BASE = 'https://poetrydb.org'
const BATCH_SIZE = 10

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * PoetryDB's `lines` field marks stanza breaks with empty strings. Turn that
 * into paragraphs (one per stanza) with <br> between lines within a stanza.
 */
function linesToHtml(lines: string[]): string {
  const stanzas: string[][] = [[]]
  for (const line of lines) {
    if (line === '') {
      if (stanzas[stanzas.length - 1].length > 0) stanzas.push([])
      continue
    }
    stanzas[stanzas.length - 1].push(line)
  }
  return stanzas
    .filter((stanza) => stanza.length > 0)
    .map((stanza) => `<p>${stanza.map(escapeHtml).join('<br>')}</p>`)
    .join('')
}

function toFoundPoem(raw: RawPoem): FoundPoem {
  const author = raw.author.trim()
  const body = linesToHtml(raw.lines) + `<p><em>— ${escapeHtml(author)}, via PoetryDB</em></p>`
  return {
    title: raw.title.trim(),
    author,
    html: body,
    linecount: Number(raw.linecount),
  }
}

/**
 * Fetches one poem, optionally constrained by a mood (matched as a
 * case-insensitive substring against poem text) and a maximum line count.
 *
 * PoetryDB only supports an *exact* linecount filter, not a range, so this
 * fetches a batch and filters client-side — falling back to the shortest
 * result in the batch if none fit the cap.
 *
 * Returns null if nothing matches the mood, or the request fails.
 */
export async function fetchPoem(opts: {
  mood?: string
  maxLines?: number
} = {}): Promise<FoundPoem | null> {
  const mood = opts.mood?.trim()
  const path = mood
    ? `/lines,random/${encodeURIComponent(mood)};${BATCH_SIZE}`
    : `/random/${BATCH_SIZE}`

  let res: Response
  try {
    res = await fetch(BASE + path)
  } catch {
    return null
  }
  if (!res.ok) return null

  let data: PoetryDbResponse
  try {
    data = await res.json()
  } catch {
    return null
  }
  if (!Array.isArray(data) || data.length === 0) return null

  const maxLines = opts.maxLines
  if (maxLines) {
    const fits = data.filter((p) => Number(p.linecount) <= maxLines)
    if (fits.length > 0) {
      return toFoundPoem(fits[Math.floor(Math.random() * fits.length)])
    }
    const shortest = [...data].sort((a, b) => Number(a.linecount) - Number(b.linecount))[0]
    return toFoundPoem(shortest)
  }

  return toFoundPoem(data[Math.floor(Math.random() * data.length)])
}
