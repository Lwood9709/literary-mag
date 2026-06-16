import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useReducer, useState } from 'react'
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

function Toolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null

  const cls = (active: boolean) =>
    `px-2.5 py-1 rounded text-sm leading-none transition-colors ${
      active ? 'bg-sage-light text-forest' : 'text-muted hover:text-forest hover:bg-stone-100'
    }`

  const divider = <span className="mx-1 h-5 w-px bg-sage/20" />

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-sage/20 bg-oat/60 px-2 py-1.5">
      <button type="button" className={cls(editor.isActive('heading', { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </button>
      <button type="button" className={cls(editor.isActive('heading', { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </button>
      {divider}
      <button type="button" className={cls(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </button>
      <button type="button" className={cls(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="font-serif italic">I</span>
      </button>
      {divider}
      <button type="button" className={cls(editor.isActive('blockquote'))} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        ❝
      </button>
      <button type="button" className={cls(editor.isActive('bulletList'))} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        • List
      </button>
      <button type="button" className={cls(editor.isActive('orderedList'))} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        1. List
      </button>
    </div>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [fields, setFields] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

  const editor = useEditor({
    extensions: [StarterKit],
    content: fields.body,
    onUpdate({ editor }) {
      setFields((f) => ({ ...f, body: editor.getHTML() }))
    },
  })

  // Keep toolbar active-states in sync with cursor/selection changes
  useEffect(() => {
    if (!editor) return
    editor.on('transaction', forceUpdate)
    return () => {
      editor.off('transaction', forceUpdate)
    }
  }, [editor])

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
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-serif text-forest">Admin</h1>
        <Link to="/" className="text-xs text-muted hover:text-sage">← Home</Link>
      </div>

      <div className="grid grid-cols-3 gap-8">
        <aside className="col-span-1">
          <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-3">Pieces</h2>
          <ul className="space-y-1">
            <li>
              <Link to="/admin" className="text-sm text-sage hover:text-sage-dark block py-1">
                + New piece
              </Link>
            </li>
            {pieces.map((p) => (
              <li key={p.id} className="flex items-center justify-between group">
                <Link
                  to={`/admin?edit=${p.id}`}
                  className={`text-sm py-1 flex-1 truncate ${editId === String(p.id) ? 'text-forest font-medium' : 'text-forest-soft hover:text-forest'}`}
                >
                  {p.title}
                </Link>
                <button
                  onClick={() => deletePiece(p.id)}
                  className="text-xs text-stone-300 hover:text-blush-dark ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="col-span-2 space-y-5">
          <input
            type="text"
            placeholder="Title"
            value={fields.title}
            onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
            className="w-full text-2xl font-serif text-forest border-b border-sage/30 py-2 outline-none focus:border-sage bg-transparent placeholder:text-muted/50"
          />

          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setFields((f) => ({ ...f, type: t }))}
                className={`px-4 py-1.5 rounded-full text-xs tracking-wide border transition-colors ${
                  fields.type === t
                    ? 'bg-sage text-white border-sage'
                    : 'border-sage/40 text-forest-soft hover:bg-sage-light hover:border-sage'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="rounded-lg border border-sage/30 bg-white/50 overflow-hidden transition-colors focus-within:border-sage">
            <Toolbar editor={editor} />
            <div className="prose prose-botanical max-w-none font-serif p-4 [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-44">
              <EditorContent editor={editor} />
            </div>
          </div>

          <input
            type="text"
            placeholder="Tags (comma separated)"
            value={fields.tags}
            onChange={(e) => setFields((f) => ({ ...f, tags: e.target.value }))}
            className="w-full text-sm border-b border-sage/30 py-2 outline-none focus:border-sage bg-transparent text-forest-soft placeholder:text-muted/50"
          />

          <div className="flex justify-end">
            <button
              onClick={save}
              disabled={saving || !fields.title || !fields.body}
              className="px-5 py-2 bg-sage text-white text-sm rounded-full hover:bg-sage-dark disabled:opacity-40 transition-colors"
            >
              {saving ? 'Saving…' : editId ? 'Update' : 'Publish'}
            </button>
          </div>
        </section>
      </div>
    </main>
  )
}
