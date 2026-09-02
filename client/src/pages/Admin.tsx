import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import type { Piece, PieceList, PieceType } from '../types'
import PieceEditor, { type PieceFields } from '../components/PieceEditor'

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
  const [pieces, setPieces] = useState<Piece[]>([])
  const [editingFields, setEditingFields] = useState<PieceFields | undefined>(undefined)
  const [loadingEdit, setLoadingEdit] = useState(false)

  // pageSize=100 because this sidebar is a nav list, not a feed. Home
  // paginates at 10; the editor wants every piece reachable in one click.
  useEffect(() => {
    let ignore = false
    fetch('/api/pieces?pageSize=100')
      .then((r) => r.json())
      .then((data: PieceList) => { if (!ignore) setPieces(data.pieces) })
    return () => { ignore = true }
  }, [])

  useEffect(() => {
    if (!editId) {
      setEditingFields(undefined)
      return
    }
    let ignore = false
    setLoadingEdit(true)
    fetch(`/api/pieces/${editId}`)
      .then((r) => r.json())
      .then((p: Piece) => {
        if (ignore) return
        setEditingFields({
          title: p.title,
          body: p.body,
          type: p.type,
          tags: p.tags,
          is_ai_generated: p.is_ai_generated,
        })
      })
      .finally(() => { if (!ignore) setLoadingEdit(false) })
    return () => { ignore = true }
  }, [editId])

  function unlock(value: string) {
    store.set(value)
    setPassword(value)
    setAuthError('')
  }

  function lock() {
    store.set('')
    setPassword('')
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

  async function handleGenerate(type: PieceType, mood?: string) {
    const res = await authedFetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, mood }),
    })
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      throw new Error(
        res.status === 429
          ? 'Daily AI generation limit reached — try again tomorrow.'
          : data?.error ?? 'Generation failed — try again.'
      )
    }
    return res.json() as Promise<{ title: string; body: string }>
  }

  async function handlePublish(fields: PieceFields) {
    const res = await authedFetch(
      editId ? `/api/pieces/${editId}` : '/api/pieces',
      {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      }
    )
    if (res.ok) {
      const saved = (await res.json()) as Piece
      navigate(`/piece/${saved.id}`)
    }
  }

  /** Immediate and unrecoverable, so it asks first. */
  async function deletePiece(id: number, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    const res = await authedFetch(`/api/pieces/${id}`, { method: 'DELETE' })
    if (!res.ok) return
    setPieces((ps) => ps.filter((p) => p.id !== id))
    if (String(id) === editId) {
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
                  onClick={() => deletePiece(p.id, p.title)}
                  aria-label={`Delete ${p.title}`}
                  title={`Delete ${p.title}`}
                  className="text-xs text-muted hover:text-blush-dark ml-2 px-1 rounded transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-blush-dark"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="col-span-2">
          {editId && loadingEdit ? (
            <p className="text-muted text-sm">Loading…</p>
          ) : (
            <PieceEditor
              key={editId ?? 'new'}
              initialFields={editingFields}
              publishLabel={editId ? 'Update' : 'Publish'}
              onGenerate={handleGenerate}
              onPublish={handlePublish}
              onDelete={
                editId
                  ? () => deletePiece(Number(editId), editingFields?.title ?? 'this piece')
                  : undefined
              }
            />
          )}
        </div>
      </div>
    </main>
  )
}
