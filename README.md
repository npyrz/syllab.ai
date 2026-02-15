# syllab.ai

## Current Features

- **Authentication System**
	- Email/password signup at `/signup` with username, name (optional), email, and password
	- Sign-in at `/signin` supporting both credentials and Google OAuth
	- Persistent sessions with NextAuth
	- Auto-generated usernames for OAuth users
-- **UI Layout**
	- Marketing-style home UI with persistent sidebar + header layout
	- Authenticated home chat view with class buttons
	- Class detail page with documents list + chat input
	- Protected routes with authentication checks
- **Routes**
	- `/` - Landing page (Home component)
	- `/home` - Authenticated chat-style home
	- `/signin` - Sign-in page
	- `/signup` - Sign-up page
	- `/classes/new` - Create new class
	- `/classes/[id]` - Class details + documents list
-- **Backend API**: `GET`/`POST` at `/api/classes`, `GET`/`POST` at `/api/documents`, `POST` at `/api/chat`
	- `GET /api/classes` returns the user’s classes
	- `POST /api/classes` creates a class
	- `GET /api/documents` returns the user’s documents (optional class filter)
	- `POST /api/documents` uploads a document to Vercel Blob and extracts text
	- `POST /api/chat` answers questions using only extracted class documents

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Auth + Database

This project uses:

- NextAuth (custom sign-in UI at `/signin`, `/signup`)
- Prisma 7 + PostgreSQL (`DATABASE_URL` configured in `prisma.config.ts`)

### Environment variables

Add these to `.env.local`:

- `AUTH_SECRET`
- `DATABASE_URL`
- `AUTH_GOOGLE_ID` (optional, enables Google login)
- `AUTH_GOOGLE_SECRET` (optional, enables Google login)
- `GROQ_API_KEY` (Groq model access)

### Prisma

```bash
npx prisma migrate dev
npx prisma generate
npx prisma studio  # View/edit database with GUI
```

### User Model

Each user has:
- `username` (required, unique) - auto-generated from email for OAuth users, manually set during signup
- `email` (required, unique)
- `name` (optional)
- `passwordHash` (for credentials auth)
- `provider` (tracks sign-in method: "credentials" or "google")
- `lastLoginAt`, `lastSeenAt` timestamps

### User storage behavior

- **Email/password signup** (`/signup`): creates a `User` with username, email, name (optional), and hashed password
- **OAuth sign-in** (Google): auto-generates username from email (e.g., `user@example.com` → `user`), ensures uniqueness by appending numbers if needed
- **Credentials sign-in** (`/signin`): authenticates against stored passwordHash
- All sign-ins update `lastLoginAt` and `lastSeenAt` timestamps

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
- **Prisma 7** configuration:
	- Schema: `prisma/schema.prisma`
	- Config: `prisma.config.ts` (datasource URL configuration)
	- Migrations: `prisma/migrations/`
- **Models**:
	- `User`: username (unique), email (unique), name, passwordHash, provider, timestamps
	- `Class`: userId, title, description, timestamps
	- `Document`: classId, userId, filename, mimeType, size, status, extracted text, storage key (nullable)
	- Example: `app/api/classes/route.ts` maps to `/api/classes`

Typical pattern as the backend grows:

- Keep request/response handling in `app/api/.../route.ts`
- Move business logic into plain TypeScript modules (e.g. `src/server/*` or `src/lib/*`), then import those from the route handlers

### Database Layer

Prisma schema lives in `prisma/schema.prisma`.

## Scripts

- `npm run dev` — start dev server
- `npm run lint` — run ESLint
- `npm run build` — production build
- `npm run prisma:migrate` — run Prisma migrations (dev)
- `npm run prisma:generate` — generate Prisma client
- `npm run prisma:studio` — open Prisma Studio


## Game Plan
- Improve chat responses (TL;DR, details, sources, clean formatting)
- UI fixes for classes
- Manage documents on the class tab
- Upload lecture slides and materials to create study material
- Update class view to show upcoming assignments and this-week items
- Add AI usage quotas (payments later)
- Theme: faster class management, instant Q&A, and learning-first AI use

## Notes
- Document originals are stored in Vercel Blob during processing and cleared after extraction
- Chat only uses each user's class documents (no cross-user context)

app/api/uploads/route.ts (accept upload, create upload record)
src/server/extract/* (parsers + OCR + chunking)
src/server/jobs/* (process upload, update status)
A DB adapter later (Prisma/Drizzle) to persist document text and status.
If you tell me your deployment target (Vercel? a VPS?) and which file types you want first (PDF only vs PDF+DOCX+images), I can recommend the exact extraction approach and where to run it (route handler vs background job).
