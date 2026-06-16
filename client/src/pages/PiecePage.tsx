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

  if (loading) return <div className="max-w-2xl mx-auto px-6 py-12 text-stone-400 text-sm">Loading...</div>
  if (!piece) return null

  return (
    <main className="max-w-2xl mx-auto px-6 py-12">
      <Link to="/" className="text-xs text-stone-400 hover:text-stone-700 mb-8 block">← Back</Link>

      <h1 className="text-4xl font-serif mb-3">{piece.title}</h1>

      <div className="flex gap-3 text-xs text-stone-400 mb-1">
        <span>{piece.type}</span>
        {piece.is_ai_generated === 1 && <span className="italic">AI generated</span>}
        <span>{new Date(piece.published_at).toLocaleDateString()}</span>
      </div>

      {piece.tags && (
        <div className="flex gap-1 mb-8 flex-wrap">
          {piece.tags.split(',').filter(Boolean).map((tag) => (
            <span key={tag.trim()} className="text-xs text-stone-400 bg-stone-50 px-2 py-0.5 rounded">
              {tag.trim()}
            </span>
          ))}
        </div>
      )}

      <div
        className="prose prose-stone max-w-none font-serif text-lg leading-relaxed"
        dangerouslySetInnerHTML={{ __html: piece.body }}
      />

      <div className="mt-12 pt-6 border-t border-stone-100">
        <Link to={`/admin?edit=${piece.id}`} className="text-xs text-stone-400 hover:text-stone-700">
          Edit this piece
        </Link>
      </div>
    </main>
  )
}
