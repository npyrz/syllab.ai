# syllab.ai

## Current Features

- Marketing-style home UI with persistent sidebar + header layout
- Routes:
	- `/` (renders the main `Home` component)
	- `/home` (currently renders the same `Home` component)
- Backend API (stub): `GET`/`POST` at `/api/classes`
	- `GET /api/classes` returns `{ classes: [] }`
	- `POST /api/classes` echoes the JSON payload

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Filesystem Guide

This repo uses the Next.js **App Router**, so both UI routes and API routes live under `app/`.

### Frontend (UI)

- `app/layout.tsx`
	- Root layout (fonts, global styles, app shell)
	- Renders persistent UI chrome: `Sidebar` + `Header`
- `app/page.tsx`
	- `/` route
- `app/home/page.tsx`
	- `/home` route (currently the same content as `/`)
- `app/components/*`
	- Reusable UI components used by routes/layout (e.g. `Header`, `Sidebar`, `Home`)
- `app/globals.css`
	- Tailwind import + global theme variables

### Backend (API)

- `app/api/*/route.ts`
	- Next.js Route Handlers (server-side endpoints)
	- Example: `app/api/classes/route.ts` maps to `/api/classes`

Typical pattern as the backend grows:

- Keep request/response handling in `app/api/.../route.ts`
- Move business logic into plain TypeScript modules (e.g. `src/server/*` or `src/lib/*`), then import those from the route handlers

### Future Database Layer (recommended shape)

There is no database wired up yet. When you add one, a clean Next.js-friendly structure is:

- `prisma/schema.prisma` (if using Prisma)
- `src/db/client.ts` (singleton DB client)
- `src/db/migrations/*` (if your tooling uses migrations)

Then API routes call into `src/db/*` via a service layer rather than talking to the database directly.

## Scripts

- `npm run dev` — start dev server
- `npm run lint` — run ESLint
- `npm run build` — production build
