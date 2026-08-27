import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PieceType } from '../types'
import PieceEditor, { type PieceFields } from '../components/PieceEditor'
import { pickRandomDemoPiece } from '../lib/demoContent'

/** Small delay so the mocked generator feels like a real call, not a flicker. */
function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export default function Demo() {
  const [preview, setPreview] = useState<PieceFields | null>(null)
  const [lastGenerated, setLastGenerated] = useState<string | undefined>(undefined)

  // Never calls the real Claude API — see lib/demoContent.ts for why.
  async function mockGenerate(_type: PieceType, _mood?: string) {
    await wait(600)
    const piece = pickRandomDemoPiece(lastGenerated)
    setLastGenerated(piece.title)
    return piece
  }

  // Never calls POST /api/pieces — this is the one guarantee this page makes.
  async function fakePublish(fields: PieceFields) {
    await wait(300)
    setPreview(fields)
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-sage hover:text-sage-dark mb-10">
        ← Back
      </Link>

      <p className="eyebrow text-xs font-semibold text-sage uppercase tracking-wide mb-2">
        Try it yourself
      </p>
      <h1 className="text-4xl font-serif text-forest mb-2">The editor, unlocked</h1>
      <p className="text-muted text-sm mb-6 max-w-lg">
        This is the same authoring surface used to write everything in the collection —
        the rich-text editor, the PoetryDB import, the AI draft button. Nothing you do
        here is published: "Publish" renders a preview below instead of saving anything.
      </p>

      <Link
        to="/"
        className="inline-block mb-10 px-4 py-2 rounded-full text-sm bg-sage text-white hover:bg-sage-dark transition-colors"
      >
        See the real magazine →
      </Link>

      <PieceEditor onGenerate={mockGenerate} onPublish={fakePublish} publishLabel="Publish (demo)" />

      {preview && (
        <div className="mt-12 rounded-lg border-2 border-dashed border-blush/60 bg-blush-light/40 p-6">
          <p className="text-xs font-semibold text-blush-dark uppercase tracking-wide mb-6">
            Demo preview — nothing was published
          </p>

          <h2 className="text-3xl font-serif text-forest leading-tight mb-3">{preview.title}</h2>

          <div className="flex items-center gap-3 text-xs text-muted mb-6">
            <span className="uppercase tracking-wide">{preview.type}</span>
            {preview.is_ai_generated === 1 && (
              <span className="text-[10px] uppercase tracking-wide text-blush-dark bg-blush-light px-1.5 py-0.5 rounded">
                AI
              </span>
            )}
          </div>

          {preview.tags && (
            <div className="flex gap-1.5 mb-6 flex-wrap">
              {preview.tags.split(',').filter(Boolean).map((tag) => (
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
            dangerouslySetInnerHTML={{ __html: preview.body }}
          />
        </div>
      )}
    </main>
  )
}
