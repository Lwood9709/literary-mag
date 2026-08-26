# Literary Mag

[![CI](https://github.com/Lwood9709/literary-mag/actions/workflows/ci.yml/badge.svg)](https://github.com/Lwood9709/literary-mag/actions/workflows/ci.yml)

A small full-stack literary magazine — publish and browse poems, prose, essays, stories
and recipes through a rich-text editor.

**Live:** https://literary-mag.vercel.app · **How it's built:** [/colophon](https://literary-mag.vercel.app/colophon)

Client and API are served from a single origin on Vercel. The API runs as a serverless
function, so there is no always-on server: it costs nothing at rest and is available
whenever someone opens the link.

---

## Tech Stack

### Frontend (`client/`)
| Concern | Choice |
| --- | --- |
| Framework | [React 19](https://react.dev/) + TypeScript |
| Build tool | [Vite](https://vite.dev/) |
| Styling | [Tailwind CSS](https://tailwindcss.com/) + `@tailwindcss/typography` |
| Rich-text editor | [TipTap](https://tiptap.dev/) (StarterKit) |
| Routing | [React Router](https://reactrouter.com/) |
| Fonts | Fraunces (serif) + Inter (sans) |

### API (`api/`)
| Concern | Choice |
| --- | --- |
| Runtime | Vercel Function (Node.js) |
| Web framework | [Hono](https://hono.dev/) |
| Database | [Turso](https://turso.tech/) (hosted libSQL / SQLite) |
| Driver | [`@libsql/client`](https://docs.turso.tech/sdk/ts/reference) — `fetch`-based, no native modules |

---

## Project Structure

```
literary-mag/
├── api/
│   ├── index.ts        # Hono app + routes + auth; default export is the Vercel function
│   └── db.ts           # Turso client and row mapping
├── client/             # React + Vite frontend
│   ├── src/pages/      # Home, PiecePage, Admin, Colophon
│   └── public/tests/   # results.json + suite.mp4 — committed, read by /colophon
├── cypress/
│   ├── e2e/            # browser specs (reading, admin, import, race-condition, colophon)
│   └── support/        # custom commands (resetPieces, unlockAdmin)
├── scripts/
│   ├── schema.mjs       # single source of truth for the pieces table shape
│   ├── setup-db.mjs     # one-time schema creation (+ optional seed)
│   ├── smoke-test.mts   # API tests against a local libSQL file, no browser
│   ├── test-server.mts  # serves client + api/ together for Cypress
│   └── live-check.mts   # verifies a real configured stack, local or deployed
├── cypress.config.ts    # baseUrl, video, and the after:run results/video writer
├── vercel.json          # build config + rewrites
└── .github/workflows/ci.yml
```

---

## Local Development

**Prerequisites:** Node.js (LTS), and the [Vercel CLI](https://vercel.com/docs/cli)
(`npm i -g vercel`).

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run setup-db               # create the schema in Turso
vercel link                    # first time only, links this folder to the Vercel project
vercel dev                     # client + API on one origin
```

Run `vercel dev` directly, not through an npm script. Vercel's CLI refuses to start if a
root `package.json` "dev" script literally reads `vercel dev`, since that would call
itself. `vercel.json`'s `devCommand` tells it what to run instead
(`cd client && npm run dev`, Vite's own dev server), and `vercel dev` proxies that
alongside the `api/` function, so local development matches production: same origin,
relative `/api/...` paths, no CORS.

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | libSQL connection URL. Accepts `file:./local.db` for offline work. |
| `TURSO_AUTH_TOKEN` | Turso database token. Not needed for `file:` URLs. |
| `ADMIN_PASSWORD` | Shared secret required for writes. **Unset disables writes entirely** — the API fails closed rather than open. |

Set all three in the Vercel dashboard for the deployed environment.

### Tests

```bash
npm run test:api                                  # offline, no Turso needed
npm run check                                     # against your real database
npm run check -- https://literary-mag.vercel.app  # against the deployment
```

`test:api` runs the full API surface — routing, auth, validation, filters, CRUD —
against a throwaway local libSQL file. No network or Turso account required; it calls
`app.fetch()` directly, the same entry point Vercel uses.

`check` verifies a real, configured stack: that credentials work, that unauthenticated
writes are refused, and that a create/read/delete round trip succeeds. It cleans up after
itself and asserts the database is left as it was found, so it is safe to run against
production.

### Browser tests (Cypress)

```bash
npm run test:e2e         # headless, builds nothing for you — run `cd client && npm run build` first
npm run test:e2e:open    # interactive runner, same server
```

`scripts/test-server.mts` serves the built client and the real `api/` app together on
`localhost:4173`, backed by a throwaway `file:` libSQL database — no Turso account, no
secrets, safe to run anywhere including CI. `cypress/e2e/race-condition.cy.ts` is a
genuine regression test: it forces an earlier request to resolve after a later one via
`cy.intercept`, and fails if the `ignore`-flag cleanup in `Home.tsx` is ever removed.

Each `npm run test:e2e` run regenerates `client/public/tests/results.json` and
`suite.mp4`, which the `/colophon` page reads to show real, current test results — not a
hand-maintained list. Commit those two files after a run you want reflected there; they
are not auto-updated by CI.

> **Windows note:** if Cypress fails with `bad option: --smoke-test` or a Windows DLL
> error, check for `ELECTRON_RUN_AS_NODE` in your shell (`echo $env:ELECTRON_RUN_AS_NODE`
> in PowerShell). Some Electron-hosted terminals (VS Code's extension host among them) set
> it for their own child processes, and it leaks into anything launched from that shell —
> including Cypress's own Electron binary, which then can't start normally. Clear it
> (`Remove-Item Env:\ELECTRON_RUN_AS_NODE`) before running Cypress commands.

---

## API Reference

Base path: `/api/pieces`

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/pieces` | public | List pieces. Optional `?type=` and `?tag=` filters. |
| `GET` | `/api/pieces/:id` | public | Fetch a single piece. |
| `POST` | `/api/pieces` | password | Create. Body: `{ title, body, type, tags?, is_ai_generated? }`. |
| `PUT` | `/api/pieces/:id` | password | Update. Omitted fields keep their current value. |
| `DELETE` | `/api/pieces/:id` | password | Delete. |

`type` is one of `poem`, `prose`, `essay`, `story`, `recipe`, `found`.

Writes require an `x-admin-password` header matching `ADMIN_PASSWORD`; without it the API
returns `401`. The comparison is constant-time (`crypto.timingSafeEqual`).

### Importing poems (PoetryDB)

`/admin` has a "Find a poem" import row backed by [PoetryDB](https://poetrydb.org), a free
public-domain poetry API. It fetches a poem matching an optional one-word mood/theme
(matched as a substring anywhere in the poem's text) and a max line count, then loads it
into the editor for review — nothing is saved until you click Publish.

Imported poems are saved as `type: 'found'`, kept distinct from original writing, and
carry the original author both in the piece body and in the tags. The client
(`client/src/lib/poetrydb.ts`) calls PoetryDB directly — it allows all origins via CORS, so
no server-side proxy is needed.

---

## Deployment

One Vercel project builds and serves everything.

```
                        git push origin main
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  Vercel                │
                    │                        │
                    │  client/  →  static    │
                    │  api/     →  function  │──── HTTPS ───▶  Turso
                    │                        │                 (libSQL)
                    │  one origin, no CORS   │
                    └────────────────────────┘
```

| Setting | Value |
| --- | --- |
| Root directory | `.` (repository root) |
| Build command | `cd client && npm install && npm run build` (from `vercel.json`) |
| Output directory | `client/dist` |
| Environment | `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_PASSWORD` |

`vercel.json` rewrites `/api/*` into the function, and sends extensionless paths to
`index.html` so client-side routes (`/admin`, `/piece/:id`) resolve instead of 404ing.

Two details in that second rule are load-bearing:

- **Order.** The API rule must come first, or the SPA rule would swallow API requests.
- **`/((?!api/|@)[^.]*)`, not `/(.*)`.** A plain catch-all also matches the requests
  Vite's dev server makes under `vercel dev` (`/src/main.tsx`, `/@vite/client`), handing
  the browser HTML where it expects a JavaScript module. Vite then fails with
  *"Failed to parse source for import analysis"*. Excluding `@`-prefixed paths and
  anything containing a dot lets real files through and leaves only SPA routes rewritten.

### Why serverless

The original deployment ran a persistent Node container with `better-sqlite3` writing to a
local file. That required an always-on host, and the SQLite file lived on an ephemeral
disk that reset on every redeploy. Moving to a Vercel Function plus Turso removed both
problems: nothing runs between requests, and the database is durable and separate from the
deployment.

The port itself was small because Hono targets Web-standard `Request`/`Response` and
`@libsql/client` uses only `fetch`. The main change was that every database call became
asynchronous — `better-sqlite3` is synchronous by design.

---

## Design Notes

- **Schema setup is a script, not startup code.** A serverless function is invoked
  per-request, so running `CREATE TABLE IF NOT EXISTS` on every cold start would be wasted
  work. Schema changes are a deploy-time concern.
- **`dangerouslySetInnerHTML`** renders piece bodies, which are HTML from the TipTap
  editor. Safe because only the password-holder can write; if submissions were ever opened
  up, that HTML would need sanitising first.
- **Auth is a single shared password**, not user accounts — appropriate for a
  single-author site. There are no sessions and no rate limiting on the password check.
- **Stale-response guarding.** Fetches in `Home.tsx` and `PiecePage.tsx` use an `ignore`
  flag in the Effect cleanup so a slow earlier request cannot overwrite newer data.
