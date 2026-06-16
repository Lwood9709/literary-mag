import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Piece, PieceType } from '../types'
import { api } from '../api'

const TYPES: PieceType[] = ['poem', 'prose', 'essay', 'story']

export default function Home() {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeType = searchParams.get('type') ?? ''

  useEffect(() => {
    setLoading(true)
    const params = activeType ? `?type=${activeType}` : ''
    fetch(api(`/api/pieces${params}`))
      .then((r) => r.json())
      .then((data: Piece[]) => setPieces(data))
      .finally(() => setLoading(false))
  }, [activeType])

  function setFilter(type: string) {
    if (type === activeType) {
      setSearchParams({})
    } else {
      setSearchParams({ type })
    }
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

      {!loading && pieces.length === 0 && (
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
    </main>
  )
}
