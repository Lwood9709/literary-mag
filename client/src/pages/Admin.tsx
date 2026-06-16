import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import type { Piece, PieceType } from '../types'
import { api } from '../api'

const TYPES: PieceType[] = ['poem', 'prose', 'essay', 'story']

const EMPTY: Omit<Piece, 'id' | 'published_at' | 'is_ai_generated'> = {
  title: '',
  body: '',
  type: 'poem',
  tags: '',
}

export default function Admin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [fields, setFields] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [pieces, setPieces] = useState<Piece[]>([])

  const editor = useEditor({
    extensions: [StarterKit],
    content: fields.body,
    onUpdate({ editor }) {
      setFields((f) => ({ ...f, body: editor.getHTML() }))
    },
  })

  useEffect(() => {
    fetch(api('/api/pieces'))
      .then((r) => r.json())
      .then((data: Piece[]) => setPieces(data))
  }, [])

  useEffect(() => {
    if (!editId) {
      setFields(EMPTY)
      editor?.commands.setContent('')
      return
    }
    fetch(api(`/api/pieces/${editId}`))
      .then((r) => r.json())
      .then((p: Piece) => {
        setFields({ title: p.title, body: p.body, type: p.type, tags: p.tags })
        editor?.commands.setContent(p.body)
      })
  }, [editId, editor])

  async function save() {
    setSaving(true)
    const method = editId ? 'PUT' : 'POST'
    const url = editId ? api(`/api/pieces/${editId}`) : api('/api/pieces')
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    })
    setSaving(false)
    if (res.ok) {
      const saved = await res.json() as Piece
      navigate(`/piece/${saved.id}`)
    }
  }

  async function deletePiece(id: number) {
    await fetch(api(`/api/pieces/${id}`), { method: 'DELETE' })
    setPieces((ps) => ps.filter((p) => p.id !== id))
    if (String(id) === editId) {
      setFields(EMPTY)
      editor?.commands.setContent('')
      navigate('/admin')
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-serif">Admin</h1>
        <Link to="/" className="text-xs text-stone-400 hover:text-stone-700">← Home</Link>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <aside className="col-span-1">
          <h2 className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3">Pieces</h2>
          <ul className="space-y-1">
            <li>
              <Link
                to="/admin"
                className="text-sm text-stone-500 hover:text-stone-800 block py-1"
              >
                + New piece
              </Link>
            </li>
            {pieces.map((p) => (
              <li key={p.id} className="flex items-center justify-between group">
                <Link
                  to={`/admin?edit=${p.id}`}
                  className={`text-sm py-1 flex-1 truncate ${editId === String(p.id) ? 'text-stone-900 font-medium' : 'text-stone-500 hover:text-stone-800'}`}
                >
                  {p.title}
                </Link>
                <button
                  onClick={() => deletePiece(p.id)}
                  className="text-xs text-stone-300 hover:text-red-400 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="col-span-2 space-y-4">
          <input
            type="text"
            placeholder="Title"
            value={fields.title}
            onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
            className="w-full text-2xl font-serif border-b border-stone-200 py-2 outline-none focus:border-stone-500 bg-transparent"
          />

          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFields((f) => ({ ...f, type: t }))}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                  fields.type === t
                    ? 'bg-stone-800 text-white border-stone-800'
                    : 'border-stone-300 text-stone-600 hover:border-stone-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="border border-stone-200 rounded min-h-48 p-3 prose prose-stone max-w-none font-serif [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-40">
            <EditorContent editor={editor} />
          </div>

          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={fields.tags}
            onChange={(e) => setFields((f) => ({ ...f, tags: e.target.value }))}
            className="w-full text-sm border-b border-stone-200 py-2 outline-none focus:border-stone-500 bg-transparent text-stone-600"
          />

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving || !fields.title || !fields.body}
              className="px-4 py-2 bg-stone-800 text-white text-sm rounded hover:bg-stone-700 disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving...' : editId ? 'Update' : 'Publish'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
