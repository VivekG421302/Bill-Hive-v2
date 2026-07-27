# Bill Hive — Project Context (API Gateway)

This file exists so any future Claude/Claude Code session has context on the
backend-gateway work without needing to re-derive it from the diff history.

## What exists today

Bill Hive is a React + Vite billing/inventory app. Until this work, all data
lived in the browser only, via `src/db/indexedDB.js` (IndexedDB wrapper,
`dbGet`/`dbSet`/`dbGetAll`/`dbRemove`/`dbClearAll`/`exportAllData`/`importAllData`).
There is no real backend — the "Database Configuration" card in Settings was a
non-functional placeholder.

## What was added: `src/api/api.js`

A single gateway module that **every page now imports instead of
`src/db/indexedDB.js` directly**. It exposes the same function shapes
(`apiGet`, `apiSet`, `apiRemove`, `apiClearAll`, `apiExportAllData`,
`apiImportAllData`, plus `apiGetAll`) and internally routes each call to one
of two backends based on a runtime mode:

- **`internal`** (default, and the only option in production builds) — calls
  straight through to `src/db/indexedDB.js` / IndexedDB. Fully offline.
- **`external`** (dev builds only) — calls a REST API at `VITE_API_BASE_URL`
  via `fetch`.

The mode is stored in `localStorage` under `billhive:api-mode` and is toggled
from **Settings → Developer Setting** (only rendered when
`import.meta.env.DEV` is true; the card is entirely absent from production
builds, and `setApiMode` is a no-op outside dev regardless of what's in
storage). The card has exactly two controls: a **Base URL** text field and
the on/off toggle — nothing else. Flipping the toggle fires
`window.dispatchEvent(new Event('billhive:api-mode-changed'))` and the
Settings page reloads the app so every store re-reads from the new source.

**Base URL** can be set two ways, in priority order:
1. Typed into **Settings → Developer Setting → Base URL** — saved to
   `localStorage` (`billhive:api-base-url`) on blur/Enter, no rebuild needed.
2. `VITE_API_BASE_URL` in `.env.local` — a machine-level fallback if the UI
   field is empty.
3. Falls back to `http://localhost:4000/api` if neither is set.

**Every page/component that used to import `dbGet`/`dbSet`/etc. from
`../db/indexedDB` now imports `apiGet`/`apiSet`/etc. from `../api/api`
instead** — call signatures are identical, so this was a straight swap, not a
rewrite. `src/db/indexedDB.js` itself is untouched and is still what runs
under the hood in internal mode.

## Docs page in the sidebar

`public/api-docs.html` (served at `/api-docs.html`) is linked from the
sidebar as **API Docs**. It's shown whenever `import.meta.env.DEV` is true —
regardless of which mode (internal/external) is currently selected — so it's
always one click away while developing, and never shows up in a production
build.

## Route contract for external mode

Full reference with fields/params/JSON examples per store: **`public/api-docs.html`**
(served at `/api-docs.html`, linked from the sidebar in dev builds — see
"Docs page in the sidebar" below).

Short version: almost every store in `STORE_NAMES` (see `src/db/indexedDB.js`)
holds one record under a fixed key `"value"`, so the external routes are
clean, no key in the URL for the common case:

```
GET    /{store}          -> whole record/array for that store
PUT    /{store}          -> replace it (body = the record/array)
DELETE /{store}          -> remove it
```

The one exception is `authTokens`, which is keyed per-token, so its routes
carry the key: `GET /authTokens/{token}`, etc. (`src/api/api.js`'s
`storePath()` helper handles this — pass a non-default `key` and it appends
it to the path.)

Whole-database operations:
```
GET  /export     -> full backup (mirrors Settings → Export All Data)
POST /import     -> restore a backup
POST /clear-all  -> erase everything (mirrors Settings → Erase All Data)
```

Any backend that implements these routes, with the field shapes documented
in `public/api-docs.html`, works — just point `VITE_API_BASE_URL` at it. No
code changes needed on the frontend side. **CORS**: since the Vite dev server
and your backend will be on different ports, the backend needs to send
`Access-Control-Allow-Origin` (or an equivalent CORS setup) for `fetch` calls
from the app to succeed.

## Env vars

Set in `.env.local` (git-ignored — see `.env.example` for the template):
```
VITE_API_BASE_URL=http://localhost:4000/api
VITE_API_KEY=
```
`VITE_API_KEY`, if set, is sent as `Authorization: Bearer <key>` on every
external request. It's optional — omit it and no header is sent. Note Vite
inlines `VITE_`-prefixed vars into the client bundle at build time, so this
is only appropriate for a local dev key against your own backend, not a
production secret.

## Not implemented yet (stubbed in `src/api/api.js`)

- `auth` — JWT login/register/logout/verify. Auth today still runs entirely
  through `src/context/AuthContext.jsx` + `src/utils/auth.js` (local account,
  password hash, cookie token, all stored in IndexedDB via the gateway).
- `notifications` — send/list.
- `mail` — SMTP send (e.g. emailing an invoice).

Routes for all three are sketched in `public/api-docs.html` under their own
sections so the shape is agreed on before the code lands.

## If you're the one building the backend

1. Pick any stack — the frontend doesn't care.
2. Implement the routes in `public/api-docs.html` for the stores you care
   about first (`items`, `customers`, `bills` are the ones exercised most by
   normal use).
3. Run the frontend (`npm run dev`), open **Settings → Developer Setting**,
   type your backend's URL into **Base URL** (e.g. `http://localhost:4000/api`),
   flip the toggle to external, reload.
4. Use the app normally — every read/write for a store you've implemented
   now round-trips through your backend. Stores you haven't implemented yet
   will 404/error on that page; that's expected until you add them.
