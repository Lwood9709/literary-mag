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
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1)

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setFailed(false)

    const params = new URLSearchParams()
    if (activeType) params.set('type', activeType)
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
  }, [activeType, requestedPage])

  const lastPage = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(requestedPage, lastPage)

  function setFilter(type: string) {
    // Dropping every param also drops ?page, so changing the filter always
    // lands on page 1. Staying on page 4 of a filter with two pages would
    // render an empty list.
    if (type === activeType) setSearchParams({})
    else setSearchParams({ type })
  }

  function goToPage(next: number) {
    const params = new URLSearchParams()
    if (activeType) params.set('type', activeType)
    if (next > 1) params.set('page', String(next))
    setSearchParams(params)
    window.scrollTo({ top: 0 })
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <header className="mb-10">
        <h1 className="text-5xl font-serif text-forest tracking-tight">Literary Mag</h1>
        <p className="mt-2 text-muted font-serif italic text-lg">A personal collection</p>
        <div className="mt-6 flex items-center gap-3 text-sage">
          <span className="h-px w-10 bg-sage/40" />
          <span aria-hidden>❧</span>
          <span className="h-px flex-1 bg-sage/20" />
        </div>
      </header>

      <div className="flex gap-2 mb-10 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
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

      {loading && <p className="text-muted text-sm">Loading…</p>}

      {!loading && failed && (
        <p className="text-sm text-blush-dark">
          Could not load the collection. Try again in a moment.
        </p>
      )}

      {!loading && !failed && pieces.length === 0 && (
        <p className="text-muted text-sm">
          No pieces yet.{' '}
          <Link to="/admin" className="text-sage underline underline-offset-2">
            Add one.
          </Link>
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
                {p.tags.split(',').filter(Boolean).map((tag) => (
                  <span
                    key={tag.trim()}
                    className="text-xs text-sage-dark bg-sage-light px-2 py-0.5 rounded-full"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {!loading && !failed && lastPage > 1 && (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between">
          <button
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            className="text-sm text-sage hover:text-sage-dark disabled:text-muted/40 disabled:cursor-default"
          >
            ← Newer
          </button>
          <span className="text-xs text-muted tracking-wide">
            Page {page} of {lastPage}
          </span>
          <button
            onClick={() => goToPage(page + 1)}
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
