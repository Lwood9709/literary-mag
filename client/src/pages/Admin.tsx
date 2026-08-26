import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useReducer, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import type { Piece, PieceType } from '../types'
import { fetchPoem } from '../lib/poetrydb'

const TYPES: PieceType[] = ['poem', 'prose', 'essay', 'story', 'recipe', 'found']

const MAX_LINES_OPTIONS = [
  { label: '20 lines', value: 20 },
  { label: '40 lines', value: 40 },
  { label: 'any length', value: 0 },
]

const EMPTY: Omit<Piece, 'id' | 'published_at'> = {
  title: '',
  body: '',
  type: 'poem',
  tags: '',
  is_ai_generated: 0,
}

const PASSWORD_KEY = 'literary-mag:admin-password'

// sessionStorage throws in some privacy modes — never let that break the page.
const store = {
  get(): string {
    try {
      return sessionStorage.getItem(PASSWORD_KEY) ?? ''
    } catch {
      return ''
    }
  },
  set(value: string) {
    try {
      if (value) sessionStorage.setItem(PASSWORD_KEY, value)
      else sessionStorage.removeItem(PASSWORD_KEY)
    } catch {
      /* ignore — the in-memory state still works for this session */
    }
  },
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

function Lock({ onUnlock }: { onUnlock: (password: string) => void }) {
  const [value, setValue] = useState('')

  return (
    <main className="max-w-sm mx-auto px-6 py-24">
      <h1 className="text-2xl font-serif text-forest mb-1">Admin</h1>
      <p className="text-sm text-muted mb-6">
        Reading is open to everyone. Publishing needs the password.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (value) onUnlock(value)
        }}
        className="space-y-4"
      >
        <input
          type="password"
          autoFocus
          placeholder="Password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full text-sm border-b border-sage/30 py-2 outline-none focus:border-sage bg-transparent placeholder:text-muted/50"
        />
        <div className="flex items-center justify-between">
          <Link to="/" className="text-xs text-muted hover:text-sage">← Home</Link>
          <button
            type="submit"
            disabled={!value}
            className="px-5 py-2 bg-sage text-white text-sm rounded-full hover:bg-sage-dark disabled:opacity-40 transition-colors"
          >
            Unlock
          </button>
        </div>
      </form>
    </main>
  )
}

export default function Admin() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const editId = searchParams.get('edit')

  const [password, setPassword] = useState(store.get)
  const [authError, setAuthError] = useState('')
  const [fields, setFields] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [pieces, setPieces] = useState<Piece[]>([])
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0)

  const [mood, setMood] = useState('')
  const [maxLines, setMaxLines] = useState(20)
  const [importing, setImporting] = useState(false)
  const [importError, setImportError] = useState('')

  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState('')

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
    let ignore = false
    fetch('/api/pieces')
      .then((r) => r.json())
      .then((data: Piece[]) => { if (!ignore) setPieces(data) })
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (!editId) {
      setFields(EMPTY)
      editor?.commands.setContent('')
      return
    }
    let ignore = false
    fetch(`/api/pieces/${editId}`)
      .then((r) => r.json())
      .then((p: Piece) => {
        if (ignore) return
        setFields({
          title: p.title,
          body: p.body,
          type: p.type,
          tags: p.tags,
          is_ai_generated: p.is_ai_generated,
        })
        editor?.commands.setContent(p.body)
      })
    return () => { ignore = true }
  }, [editId, editor])

  function unlock(value: string) {
    store.set(value)
    setPassword(value)
    setAuthError('')
  }

  function lock() {
    store.set('')
    setPassword('')
  }

  async function findPoem() {
    const hasDraft = fields.title.trim() || editor?.getText().trim()
    if (hasDraft && !window.confirm('Replace the current draft with an imported poem?')) {
      return
    }

    setImporting(true)
    setImportError('')
    const poem = await fetchPoem({ mood, maxLines: maxLines || undefined })
    setImporting(false)

    if (!poem) {
      setImportError(
        mood
          ? `No poems found for "${mood}" — try another word.`
          : 'Could not reach PoetryDB — try again.'
      )
      return
    }

    // Author names can contain commas ("George Gordon, Lord Byron"), which
    // would split into bogus extra tags in the comma-separated tags field.
    const authorTag = poem.author.replace(/,/g, '')
    setFields({
      title: poem.title,
      body: poem.html,
      type: 'found',
      tags: [authorTag, 'poetrydb'].filter(Boolean).join(', '),
      is_ai_generated: 0,
    })
    editor?.commands.setContent(poem.html)
  }

  /** Writes carry the shared secret; a 401 means it was wrong, so re-prompt. */
  async function authedFetch(url: string, init: RequestInit) {
    const res = await fetch(url, {
      ...init,
      headers: { ...init.headers, 'x-admin-password': password },
    })
    if (res.status === 401) {
      store.set('')
      setPassword('')
      setAuthError('That password was not accepted.')
    }
    return res
  }

  async function generateWithAI() {
    const hasDraft = fields.title.trim() || editor?.getText().trim()
    if (hasDraft && !window.confirm('Replace the current draft with an AI-generated piece?')) {
      return
    }

    setGenerating(true)
    setGenerateError('')
    const res = await authedFetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: fields.type, mood: mood || undefined }),
    })
    setGenerating(false)

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setGenerateError(
        res.status === 429
          ? 'Daily AI generation limit reached — try again tomorrow.'
          : data?.error ?? 'Generation failed — try again.'
      )
      return
    }

    const piece = (await res.json()) as { title: string; body: string }
    setFields((f) => ({ ...f, title: piece.title, body: piece.body, is_ai_generated: 1 }))
    editor?.commands.setContent(piece.body)
  }

  async function save() {
    setSaving(true)
    const res = await authedFetch(
      editId ? `/api/pieces/${editId}` : '/api/pieces',
      {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }
    )
    setSaving(false)
    if (res.ok) {
      const saved = (await res.json()) as Piece
      navigate(`/piece/${saved.id}`)
    }
  }

  async function deletePiece(id: number) {
    const res = await authedFetch(`/api/pieces/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setPieces((ps) => ps.filter((p) => p.id !== id))
    if (String(id) === editId) {
      setFields(EMPTY)
      editor?.commands.setContent('')
      navigate('/admin')
    }
  }

  if (!password) {
    return (
      <>
        {authError && (
          <p className="text-center text-xs text-blush-dark pt-6">{authError}</p>
        )}
        <Lock onUnlock={unlock} />
      </>
    )
  }

  return (
    <main className="max-w-3xl mx-auto px-6 py-16">
      <div className="flex items-center justify-between mb-10">
        <h1 className="text-3xl font-serif text-forest">Admin</h1>
        <div className="flex items-center gap-4">
          <button onClick={lock} className="text-xs text-muted hover:text-sage">
            Lock
          </button>
          <Link to="/" className="text-xs text-muted hover:text-sage">← Home</Link>
        </div>
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
          <div className="rounded-lg border border-dashed border-sage/40 bg-sage-light/40 p-3 space-y-2">
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                placeholder="mood or theme — e.g. moon, winter, sorrow"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') findPoem() }}
                className="flex-1 min-w-40 text-sm border-b border-sage/30 py-1.5 outline-none focus:border-sage bg-transparent placeholder:text-muted/50"
              />
              <select
                value={maxLines}
                onChange={(e) => setMaxLines(Number(e.target.value))}
                className="text-xs border-b border-sage/30 bg-transparent text-forest-soft outline-none focus:border-sage"
              >
                {MAX_LINES_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={findPoem}
                disabled={importing}
                className="px-4 py-1.5 rounded-full text-xs tracking-wide border border-sage/40 text-forest-soft hover:bg-sage hover:text-white hover:border-sage disabled:opacity-40 transition-colors"
              >
                {importing ? 'Searching…' : 'Find a poem'}
              </button>
              <button
                type="button"
                onClick={generateWithAI}
                disabled={generating || fields.type === 'found'}
                title={fields.type === 'found' ? '"found" is reserved for real PoetryDB imports' : undefined}
                className="px-4 py-1.5 rounded-full text-xs tracking-wide border border-sage/40 text-forest-soft hover:bg-sage hover:text-white hover:border-sage disabled:opacity-40 transition-colors"
              >
                {generating ? 'Generating…' : 'Generate with AI'}
              </button>
            </div>
            <p className="text-xs text-muted">
              <strong>Find a poem</strong> pulls public-domain text from{' '}
              <a href="https://poetrydb.org" target="_blank" rel="noreferrer" className="underline hover:text-sage">
                PoetryDB
              </a>
              , attributed to its original author. <strong>Generate with AI</strong> drafts an
              original piece of the selected type with Claude, using the mood above as an
              optional prompt — capped at 3 generations a day.
            </p>
            {importError && <p className="text-xs text-blush-dark">{importError}</p>}
            {generateError && <p className="text-xs text-blush-dark">{generateError}</p>}
          </div>

          <input
            type="text"
            placeholder="Title"
            value={fields.title}
            onChange={(e) => setFields((f) => ({ ...f, title: e.target.value }))}
            className="w-full text-2xl font-serif text-forest border-b border-sage/30 py-2 outline-none focus:border-sage bg-transparent placeholder:text-muted/50"
          />

          <div className="flex gap-2 flex-wrap">
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

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-forest-soft cursor-pointer">
              <input
                type="checkbox"
                checked={fields.is_ai_generated === 1}
                onChange={(e) =>
                  setFields((f) => ({ ...f, is_ai_generated: e.target.checked ? 1 : 0 }))
                }
                className="accent-sage"
              />
              Mark as AI-generated
            </label>

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
