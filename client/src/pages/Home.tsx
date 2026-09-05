import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Piece, PieceList, PieceType } from '../types'

const TYPES: PieceType[] = ['poem', 'prose', 'essay', 'story', 'recipe', 'found']

export default function Home() {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(10)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [searchParams, setSearchParams] = useSearchParams()

  const activeType = searchParams.get('type') ?? ''
  const activeTag = searchParams.get('tag') ?? ''
  const query = searchParams.get('q') ?? ''
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1)

  // Kept separate from the URL so typing does not refetch on every keystroke.
  // The URL moves on submit, which also keeps browser history usable.
  const [draftQuery, setDraftQuery] = useState(query)
  useEffect(() => { setDraftQuery(query) }, [query])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setFailed(false)

    const params = new URLSearchParams()
    if (activeType) params.set('type', activeType)
    if (activeTag) params.set('tag', activeTag)
    if (query) params.set('q', query)
    params.set('page', String(requestedPage))

    fetch(`/api/pieces?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`GET /api/pieces returned ${r.status}`)
        return r.json()
      })
      .then((data: PieceList) => {
        if (ignore) return
        setPieces(data.pieces)
        setTotal(data.total)
        setPageSize(data.pageSize)
      })
      .catch(() => {
        if (ignore) return
        setPieces([])
        setTotal(0)
        setFailed(true)
      })
      .finally(() => { if (!ignore) setLoading(false) })

    return () => { ignore = true }
  }, [activeType, activeTag, query, requestedPage])

  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, lastPage)
  const filtering = Boolean(activeType || activeTag || query)

  /**
   * Every navigation rebuilds the whole param set rather than editing it in
   * place, so page is dropped unless a caller asks to keep it. Landing on
   * page 4 of a filter with two pages would render an empty list.
   */
  function navigate(next: { type?: string; tag?: string; q?: string; page?: number }) {
    const params = new URLSearchParams()
    if (next.type) params.set('type', next.type)
    if (next.tag) params.set('tag', next.tag)
    if (next.q) params.set('q', next.q)
    if (next.page && next.page > 1) params.set('page', String(next.page))
    setSearchParams(params)
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <header className="mb-10">
        <h1 className="text-5xl font-serif text-forest tracking-tight">Literary Mag</h1>
        <div className="mt-6 flex items-center gap-3 text-sage">
          <span className="h-px w-10 bg-sage/40" />
          <span aria-hidden>❧</span>
          <span className="h-px flex-1 bg-sage/20" />
        </div>
      </header>

      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault()
          navigate({ type: activeType, tag: activeTag, q: draftQuery.trim() })
        }}
        className="flex items-center gap-2 mb-6"
      >
        <input
          type="search"
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          placeholder="Search the collection"
          aria-label="Search the collection"
          className="flex-1 text-sm border-b border-sage/30 py-2 outline-none focus:border-sage bg-transparent placeholder:text-muted/60"
        />
        <button
          type="submit"
          className="px-4 py-1.5 rounded-full text-xs tracking-wide border border-sage/40 text-forest-soft hover:bg-sage-light hover:border-sage transition-colors"
        >
          Search
        </button>
      </form>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() =>
              navigate({ type: t === activeType ? '' : t, tag: activeTag, q: query })
            }
            className={`px-4 py-1.5 rounded-full text-xs tracking-wide transition-colors border ${
              activeType === t
                ? 'bg-sage text-white border-sage'
                : 'border-sage/40 text-forest-soft hover:bg-sage-light hover:border-sage'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {filtering && !loading && !failed && (
        <p className="text-xs text-muted mb-8 flex items-center gap-2 flex-wrap">
          <span>
            {total} {total === 1 ? 'piece' : 'pieces'}
            {query && <> matching "{query}"</>}
            {activeTag && <> tagged "{activeTag}"</>}
            {activeType && <> in {activeType}</>}
          </span>
          <button
            onClick={() => navigate({})}
            className="text-sage hover:text-sage-dark underline underline-offset-2"
          >
            clear
          </button>
        </p>
      )}

      {loading && <p className="text-muted text-sm">Loading…</p>}

      {!loading && failed && (
        <p className="text-sm text-blush-dark">
          Could not load the collection. Try again in a moment.
        </p>
      )}

      {!loading && !failed && pieces.length === 0 && (
        <p className="text-muted text-sm">
          {filtering ? (
            <>Nothing here matches. Try a different word.</>
          ) : (
            <>
              No pieces yet.{' '}
              <Link to="/admin" className="text-sage underline underline-offset-2">
                Add one.
              </Link>
            </>
          )}
        </p>
      )}

      <ul className="space-y-8">
        {pieces.map((p) => (
          <li key={p.id} className="group border-b border-sage-light pb-8">
            <Link to={`/piece/${p.id}`}>
              <h2 className="text-2xl font-serif text-forest transition-colors group-hover:text-sage">
                {p.title}
              </h2>
            </Link>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted">
              <span className="uppercase tracking-wide">{p.type}</span>
              {p.is_ai_generated === 1 && (
                <span className="text-[10px] uppercase tracking-wide text-blush-dark bg-blush-light px-1.5 py-0.5 rounded">
                  AI
                </span>
              )}
              <span>{new Date(p.published_at).toLocaleDateString()}</span>
            </div>
            {p.tags && (
              <div className="flex gap-1.5 mt-3 flex-wrap">
                {p.tags.split(',').filter(Boolean).map((raw) => {
                  const tag = raw.trim()
                  return (
                    <button
                      key={tag}
                      onClick={() => navigate({ tag })}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                        activeTag.toLowerCase() === tag.toLowerCase()
                          ? 'bg-sage text-white'
                          : 'text-sage-dark bg-sage-light hover:bg-sage hover:text-white'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            )}
          </li>
        ))}
      </ul>

      {!loading && !failed && lastPage > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between">
          <button
            onClick={() => navigate({ type: activeType, tag: activeTag, q: query, page: page - 1 })}
            disabled={page <= 1}
            className="text-sm text-sage hover:text-sage-dark disabled:text-muted/40 disabled:cursor-default"
          >
            ← Newer
          </button>
          <span className="text-xs text-muted tracking-wide">
            Page {page} of {lastPage}
          </span>
          <button
            onClick={() => navigate({ type: activeType, tag: activeTag, q: query, page: page + 1 })}
            disabled={page >= lastPage}
            className="text-sm text-sage hover:text-sage-dark disabled:text-muted/40 disabled:cursor-default"
          >
            Older →
          </button>
        </nav>
      )}

      <footer className="mt-16 pt-6 border-t border-sage-light flex gap-4">
        <Link to="/colophon" className="text-xs text-muted hover:text-sage">
          Colophon
        </Link>
        <Link to="/demo" className="text-xs text-muted hover:text-sage">
          Try the editor
        </Link>
      </footer>
    </main>
  )
}
