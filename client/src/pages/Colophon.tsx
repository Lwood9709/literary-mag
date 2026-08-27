import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

type TestResult = {
  title: string
  state: string
  duration: number | null
}

type SpecResult = {
  spec: string
  tests: TestResult[]
}

type TestSummary = {
  generatedAt: string
  totalTests: number
  totalPassed: number
  totalFailed: number
  totalDuration: number
  specs: SpecResult[]
}

export default function Colophon() {
  const [summary, setSummary] = useState<TestSummary | null>(null)

  useEffect(() => {
    let ignore = false
    fetch('/tests/results.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TestSummary | null) => { if (!ignore) setSummary(data) })
      .catch(() => { if (!ignore) setSummary(null) })
    return () => { ignore = true }
  }, [])

  return (
    <main className="max-w-2xl mx-auto px-6 py-16">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-sage hover:text-sage-dark mb-10">
        ← Back
      </Link>

      <h1 className="text-4xl font-serif text-forest mb-2">Colophon</h1>
      <p className="text-muted font-serif italic text-lg mb-10">A note on how this was made</p>

      <article className="prose prose-botanical max-w-none font-serif text-base leading-relaxed space-y-6">
        <p>
          This is a publishing platform for poems, essays, and a small contributed-recipe
          section, built around a{' '}
          <a href="https://tiptap.dev" target="_blank" rel="noreferrer">TipTap</a> rich-text
          editor on one side and a plain, typography-first reading view on the other. The
          same tool that drafts a piece is the one that publishes it.
        </p>
        <p>
          Some pieces are typed by hand. Others begin as a prompt to Claude, or arrive from{' '}
          <a href="https://poetrydb.org" target="_blank" rel="noreferrer">PoetryDB</a>'s
          catalogue of public-domain poetry. Either way, nothing goes live without a human
          reviewing it first, and the collection marks which is which rather than blurring
          the line.
        </p>
        <p>
          The frontend is a typed React and TypeScript app talking to a{' '}
          <a href="https://hono.dev" target="_blank" rel="noreferrer">Hono</a> API on a single
          Vercel Function; the database is{' '}
          <a href="https://turso.tech" target="_blank" rel="noreferrer">Turso</a>, a hosted
          libSQL store. Client and API share one origin, so there is no CORS to configure,
          and nothing runs or costs anything between requests. Every push builds and deploys
          through a Git-based CI/CD pipeline before it reaches the live site.
        </p>
      </article>

      <div className="mt-12 pt-8 border-t border-sage-light">
        <h2 className="text-xs font-semibold text-muted uppercase tracking-wide mb-4">Testing</h2>

        {!summary && (
          <p className="text-sm text-muted">Test results are unavailable right now.</p>
        )}

        {summary && (
          <>
            <p className="text-sm text-forest-soft mb-6">
              <span className="text-sage font-medium">{summary.totalPassed}</span> of{' '}
              {summary.totalTests} browser tests passing · last run{' '}
              {new Date(summary.generatedAt).toLocaleDateString()}
            </p>

            <div className="space-y-5 mb-10">
              {summary.specs.map((spec) => (
                <div key={spec.spec}>
                  <p className="text-xs font-mono text-muted mb-1.5">{spec.spec}</p>
                  <ul className="space-y-1">
                    {spec.tests.map((t) => (
                      <li key={t.title} className="flex items-start gap-2 text-sm">
                        <span
                          className={
                            t.state === 'passed'
                              ? 'text-sage mt-0.5'
                              : 'text-blush-dark mt-0.5'
                          }
                          aria-hidden
                        >
                          {t.state === 'passed' ? '✓' : '✕'}
                        </span>
                        <span className="text-forest-soft">{t.title}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <video
              controls
              preload="none"
              className="w-full rounded-lg border border-sage/30"
              src="/tests/suite.mp4"
            >
              Your browser does not support embedded video.
            </video>
          </>
        )}

        <p className="text-xs text-muted mt-6">
          Run in{' '}
          <a
            href="https://github.com/Lwood9709/literary-mag/actions"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-sage"
          >
            GitHub Actions
          </a>{' '}
          on every push, against a throwaway local database — never against the live site.
        </p>
      </div>
    </main>
  )
}
