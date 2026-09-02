import { useEditor, EditorContent } from '@tiptap/react'
import type { Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { useEffect, useReducer, useState } from 'react'
import type { Piece, PieceType } from '../types'
import { fetchPoem } from '../lib/poetrydb'

export type PieceFields = Omit<Piece, 'id' | 'published_at'>

const TYPES: PieceType[] = ['poem', 'prose', 'essay', 'story', 'recipe', 'found']

const MAX_LINES_OPTIONS = [
  { label: '20 lines', value: 20 },
  { label: '40 lines', value: 40 },
  { label: 'any length', value: 0 },
]

export const EMPTY_PIECE: PieceFields = {
  title: '',
  body: '',
  type: 'poem',
  tags: '',
  is_ai_generated: 0,
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

export type PieceEditorProps = {
  /** Loads an existing piece into the form. Omit for a blank draft. */
  initialFields?: PieceFields
  /** Throw an Error with a user-facing message on failure. */
  onGenerate: (type: PieceType, mood?: string) => Promise<{ title: string; body: string }>
  /** Whatever happens next (navigate, show a preview, ...) is the caller's job. */
  onPublish: (fields: PieceFields) => Promise<void>
  /** Omit to hide the delete control entirely. /demo never passes one. */
  onDelete?: () => Promise<void>
  publishLabel?: string
}

/**
 * The actual authoring surface — title, type, TipTap editor, tags, the
 * PoetryDB/AI import row, and the publish button. Used both by the real
 * password-gated /admin and the public, no-login /demo sandbox; the two
 * differ only in what onGenerate/onPublish actually do.
 */
export default function PieceEditor({
  initialFields,
  onGenerate,
  onPublish,
  onDelete,
  publishLabel = 'Publish',
}: PieceEditorProps) {
  const [fields, setFields] = useState<PieceFields>(initialFields ?? EMPTY_PIECE)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
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

  // Reflects initialFields into the editor once it's ready. Callers that
  // need a full reset (switching which piece is being edited) should remount
  // this component with a fresh `key` rather than relying on this effect —
  // it only handles the editor not existing yet on first render.
  useEffect(() => {
    if (editor && initialFields) {
      editor.commands.setContent(initialFields.body)
    }
  }, [editor])

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

  async function generateWithAI() {
    const hasDraft = fields.title.trim() || editor?.getText().trim()
    if (hasDraft && !window.confirm('Replace the current draft with an AI-generated piece?')) {
      return
    }

    setGenerating(true)
    setGenerateError('')
    try {
      const piece = await onGenerate(fields.type, mood || undefined)
      setFields((f) => ({ ...f, title: piece.title, body: piece.body, is_ai_generated: 1 }))
      editor?.commands.setContent(piece.body)
    } catch (err) {
      setGenerateError((err as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  async function save() {
    setSaving(true)
    await onPublish(fields)
    setSaving(false)
  }

  return (
    <section className="space-y-5">
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
          optional prompt.
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
        {onDelete ? (
          <button
            onClick={async () => {
              setDeleting(true)
              try { await onDelete() } finally { setDeleting(false) }
            }}
            disabled={saving || deleting}
            className="text-sm text-muted hover:text-blush-dark transition-colors disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete this piece'}
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={save}
          disabled={saving || !fields.title || !fields.body}
          className="px-5 py-2 bg-sage text-white text-sm rounded-full hover:bg-sage-dark disabled:opacity-40 transition-colors"
        >
          {saving ? 'Saving…' : publishLabel}
        </button>
      </div>
    </section>
  )
}
