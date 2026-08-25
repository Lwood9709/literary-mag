# Literary Mag

A small full-stack literary magazine — publish and browse poems, prose, essays, stories
and recipes through a rich-text editor.

**Live:** https://literary-mag.vercel.app

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
│   └── src/pages/      # Home, PiecePage, Admin
├── scripts/
│   ├── setup-db.mjs    # one-time schema creation (+ optional seed)
│   └── smoke-test.mts  # end-to-end API tests against a local libSQL file
└── vercel.json         # build config + rewrites
```

---

## Local Development

**Prerequisites:** Node.js (LTS), and the [Vercel CLI](https://vercel.com/docs/cli)
(`npm i -g vercel`).

```bash
npm install
cp .env.example .env.local     # then fill in the values
npm run setup-db               # create the schema in Turso
npm run dev                    # vercel dev — client + API on one origin
```

`vercel dev` serves the Vite app and the `api/` function together, so local development
matches production: same origin, relative `/api/...` paths, no CORS.

### Environment Variables

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | libSQL connection URL. Accepts `file:./local.db` for offline work. |
| `TURSO_AUTH_TOKEN` | Turso database token. Not needed for `file:` URLs. |
| `ADMIN_PASSWORD` | Shared secret required for writes. **Unset disables writes entirely** — the API fails closed rather than open. |

Set all three in the Vercel dashboard for the deployed environment.

### Tests

```bash
npm run test:api
```

Runs the full API surface — routing, auth, validation, filters, CRUD — against a
throwaway local libSQL file. No network or Turso account required; it calls `app.fetch()`
directly, the same entry point Vercel uses.

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

`type` is one of `poem`, `prose`, `essay`, `story`, `recipe`.

Writes require an `x-admin-password` header matching `ADMIN_PASSWORD`; without it the API
returns `401`. The comparison is constant-time (`crypto.timingSafeEqual`).

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

`vercel.json` rewrites `/api/*` into the function and everything else into `index.html`
so client-side routes (`/admin`, `/piece/:id`) resolve instead of 404ing. Order matters:
the API rule must come first, or the SPA catch-all would swallow API requests.

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
