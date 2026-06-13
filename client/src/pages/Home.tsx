import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { Piece, PieceType } from '../types'

const TYPES: PieceType[] = ['poem', 'prose', 'essay', 'story']

export default function Home() {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [loading, setLoading] = useState(true)
  const [searchParams, setSearchParams] = useSearchParams()
  const activeType = searchParams.get('type') ?? ''

  useEffect(() => {
    setLoading(true)
    const params = activeType ? `?type=${activeType}` : ''
    fetch(`/api/pieces${params}`)
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
    <main className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-4xl font-serif mb-2">Literary Mag</h1>
      <p className="text-stone-500 mb-8 text-sm">A personal collection</p>

      <div className="flex gap-2 mb-8 flex-wrap">
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`px-3 py-1 rounded-full text-xs border transition-colors ${
              activeType === t
                ? 'bg-stone-800 text-white border-stone-800'
                : 'border-stone-300 text-stone-600 hover:border-stone-500'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {loading && <p className="text-stone-400 text-sm">Loading...</p>}

      {!loading && pieces.length === 0 && (
        <p className="text-stone-400 text-sm">No pieces yet. <Link to="/admin" className="underline">Add one.</Link></p>
      )}

      <ul className="space-y-6">
        {pieces.map((p) => (
          <li key={p.id} className="border-b border-stone-100 pb-6">
            <Link to={`/piece/${p.id}`} className="group">
              <h2 className="text-xl font-serif group-hover:underline">{p.title}</h2>
            </Link>
            <div className="flex gap-3 mt-1 text-xs text-stone-400">
              <span>{p.type}</span>
              {p.is_ai_generated === 1 && <span className="italic">AI generated</span>}
              <span>{new Date(p.published_at).toLocaleDateString()}</span>
            </div>
            {p.tags && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {p.tags.split(',').filter(Boolean).map((tag) => (
                  <span key={tag.trim()} className="text-xs text-stone-400 bg-stone-50 px-2 py-0.5 rounded">
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
