import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import type { Piece } from '../types'
import { api } from '../api'

export default function PiecePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [piece, setPiece] = useState<Piece | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(api(`/api/pieces/${id}`))
      .then((r) => {
        if (!r.ok) throw new Error('Not found')
        return r.json()
      })
      .then((data: Piece) => setPiece(data))
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading)
    return <div className="max-w-2xl mx-auto px-6 py-16 text-muted text-sm">Loading…</div>
  if (!piece) return null

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-sage hover:text-sage-dark mb-10">
        ← Back
      </Link>

      <h1 className="text-4xl md:text-5xl font-serif text-forest leading-tight mb-4">{piece.title}</h1>

      <div className="flex items-center gap-3 text-xs text-muted mb-2">
        <span className="uppercase tracking-wide">{piece.type}</span>
        {piece.is_ai_generated === 1 && (
          <span className="text-[10px] uppercase tracking-wide text-blush-dark bg-blush-light px-1.5 py-0.5 rounded">
            AI
          </span>
        )}
        <span>{new Date(piece.published_at).toLocaleDateString()}</span>
      </div>

      {piece.tags && (
        <div className="flex gap-1.5 mb-10 flex-wrap">
          {piece.tags.split(',').filter(Boolean).map((tag) => (
            <span
              key={tag.trim()}
              className="text-xs text-sage-dark bg-sage-light px-2 py-0.5 rounded-full"
            >
              {tag.trim()}
            </span>
          ))}
        </div>
      )}

      <article
        className="prose prose-botanical max-w-none font-serif text-lg leading-relaxed"
        dangerouslySetInnerHTML={{ __html: piece.body }}
      />

      <div className="mt-14 flex flex-col items-center gap-6">
        <span className="text-sage text-2xl" aria-hidden>❦</span>
        <Link to={`/admin?edit=${piece.id}`} className="text-xs text-muted hover:text-sage">
          Edit this piece
        </Link>
      </div>
    </main>
  )
}
