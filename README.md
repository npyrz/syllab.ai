# syllab.ai

AI-powered class management built with Next.js App Router, NextAuth, Prisma, and Groq.

## Current Features

- Authentication with custom `/signin` and `/signup` pages
  - Email/password credentials login
  - Optional Google OAuth login when env vars are configured
  - Auto user creation for OAuth users with unique username generation
  - `lastLoginAt` and `lastSeenAt` tracking
- Persistent app shell
  - Shared sidebar + header layout across pages
  - Profile menu with sign-out
  - Theme toggle (light/dark) persisted to DB + local storage
  - Timezone sync from browser to user profile
- Class management
  - Create class
  - List classes (sidebar + home)
  - Delete class
  - Set/adjust current week (1–20) for weekly schedule generation
- Document pipeline
  - Upload class documents (`pdf`, `docx`, `doc`) up to 10MB
  - Blob storage upload via Vercel Blob
  - Server-side text extraction (PDF via `pdfjs-dist`, DOCX via `mammoth`)
  - Document status lifecycle: `pending -> processing -> done/failed`
  - Original blob reference cleared after extraction (`storageKey` set to `null`)
  - Document delete API + class-scoped document list UI
- AI class chat (`/api/chat`)
  - Uses only authenticated user + selected class documents
  - Groq AI SDK call with model from `GROQ_CHAT_MODEL` (fallback: `llama-3.3-70b-versatile`)
  - Daily usage quotas (per-user + global) enforced in DB
  - Source filename attribution returned to UI (ranked relevance)
- Weekly schedule dashboard
  - AI-generated “This week” + “Upcoming” cards from schedule/syllabus text
  - Week cache persisted in `WeekSchedule` table with fingerprints
  - Auto week rollover via Sunday boundary based on `currentWeekSetAt`
  - Primed after schedule/syllabus processing and when current week is updated
  - Optional refresh endpoint for cron-based precompute of next week

## App Routes

- `/` - landing page or chat hub (if signed in and classes exist)
- `/home` - same Home entry behavior as `/`
- `/signin` - sign in
- `/signup` - sign up
- `/classes/new` - create class + upload initial docs
- `/classes/[id]` - class details, documents, weekly dashboard

## API Routes

- `GET /api/auth/[...nextauth]`
- `POST /api/auth/[...nextauth]`
- `GET /api/classes` - list classes for session user
- `POST /api/classes` - create class
- `DELETE /api/classes` - delete class by id
- `PATCH /api/classes` - update class `currentWeek` (+ anchor timestamp)
- `GET /api/documents?classId=...` - list documents (optional class filter)
- `POST /api/documents` - upload + process document
- `DELETE /api/documents` - delete document by id
- `GET /api/documents/[id]` - get single owned document
- `POST /api/chat` - class-scoped AI Q&A
- `POST /api/schedules/refresh` - precompute next-week schedules (cron-friendly)

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- NextAuth v5 beta
- Prisma 7 + PostgreSQL
- Vercel Blob
- AI SDK + Groq provider

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

Create `.env.local` with:

- `AUTH_SECRET`
- `DATABASE_URL`
- `GROQ_API_KEY`
- `GROQ_CHAT_MODEL` (optional, chat model override)
- `GROQ_SCHEDULE_MODEL` (optional, weekly schedule model override)
- `GROQ_MODEL` (optional generic fallback used by schedule logic)
- `GROQ_FALLBACK_MODEL` (optional fallback for legacy/alternate schedule pipeline)
- `AUTH_GOOGLE_ID` (optional, enables Google sign-in)
- `AUTH_GOOGLE_SECRET` (optional, enables Google sign-in)
- `CRON_SECRET` (optional, protects `/api/schedules/refresh`)
- `BLOB_READ_WRITE_TOKEN` (required for Vercel Blob in non-Vercel local/dev setups)

## Database & Prisma

```bash
npx prisma migrate dev
npx prisma generate
npx prisma studio
```

Main models:

- `User`
- `Class`
- `Document`
- `WeekSchedule`
- `ApiUsageDaily`
- `ApiUsageGlobalDaily`

## Important Implementation Notes

- Authorization is enforced in API routes using `auth()` + ownership checks.
- Chat context is built only from `Document` rows matching `(userId, classId, status=done)`.
- Daily quota windows are timezone-aware for users and UTC-based globally.
- Schedule uploads can trigger week verification UI to set the class current week.
- Weekly schedule records are fingerprinted to avoid unnecessary regeneration.

## Upcoming Features

- Lecture notes ingestion + readability pass
  - Upload lecture notes and auto-convert into cleaner, easier-to-read study notes.
- Study material generation from lecture content
  - Generate quiz questions and flashcards from uploaded lecture materials.
- Personal notes support
  - Add and store user-authored notes per class for blended AI context.
- Weekly web resource recommendations
  - If syllabus/schedule includes highlighted weekly topics, scan the web for helpful supporting resources.
  - Return curated links/summaries tied to the current week’s material.

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run start` - run built app
- `npm run lint` - run ESLint
- `npm run prisma:generate` - generate Prisma client
- `npm run prisma:migrate` - run Prisma migrations (dev)
- `npm run prisma:studio` - open Prisma Studio
