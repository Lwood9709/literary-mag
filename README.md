# Literary Mag

A small full-stack literary magazine — publish and browse poems, prose, essays, and stories through a rich-text editor. Built as a portfolio/demo project.

**Live demo**
- Frontend: https://literary-mag.vercel.app
- API: https://literary-mag-production.up.railway.app/api/pieces

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
| Fonts | Fraunces (serif) + Inter (sans) via Google Fonts |

### Backend (`server/`)
| Concern | Choice |
| --- | --- |
| Runtime | Node.js |
| Web framework | [Hono](https://hono.dev/) (`@hono/node-server`) |
| Database | SQLite via [`better-sqlite3`](https://github.com/WiseLibs/better-sqlite3) |
| Language | TypeScript (compiled with `tsc`; `tsx` for local dev) |

---

## Project Structure

```
literary-mag/
├── client/                 # React + Vite frontend
│   ├── src/
│   │   ├── pages/          # Home, PiecePage, Admin
│   │   ├── api.ts          # API base-URL helper (reads VITE_API_URL)
│   │   └── ...
│   ├── vercel.json         # SPA rewrite rules for client-side routing
│   └── vite.config.ts      # Dev proxy: /api -> localhost:3000
└── server/                 # Hono + SQLite backend
    ├── src/
    │   ├── index.ts        # App entry, CORS, server bootstrap
    │   ├── routes/pieces.ts
    │   └── db/database.ts  # SQLite connection + schema
    └── literary.db         # SQLite database file
```

---

## Local Development

**Prerequisites:** Node.js (LTS) and npm.

Run the backend and frontend in two terminals.

```bash
# Terminal 1 — API on http://localhost:3000
cd server
npm install
npm run dev

# Terminal 2 — app on http://localhost:5173
cd client
npm install
npm run dev
```

In development, Vite proxies `/api/*` requests to the backend (see `client/vite.config.ts`), so no extra configuration is needed.

### Environment Variables

| Location | Variable | Purpose |
| --- | --- | --- |
| `client` | `VITE_API_URL` | Base URL of the API. **Leave empty in dev** (the Vite proxy handles it); set to the deployed API URL in production. |
| `server` | `PORT` | Port the server listens on. Defaults to `3000`; the host platform sets this automatically in production. |

See `client/.env.example` and `server/.env.example`.

---

## API Reference

Base path: `/api/pieces`

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/pieces` | List pieces. Optional `?type=` and `?tag=` filters. |
| `GET` | `/api/pieces/:id` | Fetch a single piece. |
| `POST` | `/api/pieces` | Create a piece. Body: `{ title, body, type, tags?, is_ai_generated? }`. |
| `PUT` | `/api/pieces/:id` | Update a piece. |
| `DELETE` | `/api/pieces/:id` | Delete a piece. |

`type` is one of `poem`, `prose`, `essay`, `story`.

---

## Deployment Pipeline

The app is split across two platforms, both deploying automatically on push to `main`.

```
                       git push origin main
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                     ▼
   ┌──────────────────────┐            ┌──────────────────────┐
   │  Railway             │            │  Vercel              │
   │  (server/)           │            │  (client/)           │
   │                      │  VITE_API_URL                     │
   │  Hono + SQLite API   │◀───────────│  Static React build  │
   │  …up.railway.app     │   (CORS)   │  literary-mag.app    │
   └──────────────────────┘            └──────────────────────┘
```

### Backend → Railway

Railway builds the server from the `server/` directory using Railpack (Nixpacks-style).

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm install && npm run build` (runs `tsc` → `dist/`) |
| Start command | `npm start` (runs `node dist/index.js`) |
| Networking | Public domain generated; **target port `8080`** (Railway injects `PORT=8080`) |

**Notes / gotchas baked into the config:**
- TypeScript compiles to plain JavaScript (`npm run build`) so the runtime needs no dev tooling — avoids `tsx: Permission denied` errors in the build container.
- `typescript` lives in `dependencies` (not `devDependencies`) because Railpack sets `NODE_ENV=production` and skips dev deps during install — `tsc` must still be available at build time.
- `node_modules/` is git-ignored. Committing it ships Windows binaries with broken Linux execute permissions, which breaks the build.
- The server reads `process.env.PORT`; the generated domain must target that same port (`8080`).

### Frontend → Vercel

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Build command | `npm run build` (Vite, auto-detected) |
| Output | `dist/` |
| Env var | `VITE_API_URL` = the Railway API URL (no trailing slash) |

**Notes:**
- `client/vercel.json` rewrites all routes to `/index.html` so client-side routes (`/admin`, `/piece/:id`) resolve instead of 404ing.
- `VITE_API_URL` is baked into the bundle at build time, so a redeploy is required after changing it.

### CORS

The API enables CORS for the Vercel origin in `server/src/index.ts`. If the frontend domain changes, update the allowed origin there.

---

## Known Limitations

- **Database persistence:** `literary.db` lives on Railway's ephemeral filesystem, so pieces created in production reset to the committed seed data on each redeploy. To persist data, attach a Railway volume or migrate to a hosted SQLite service such as [Turso](https://turso.tech/).
