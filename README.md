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
  - Timeout guardrails for blob fetch + extraction to avoid stuck processing
  - Resilient PDF extraction with invalid-page early stop and reduced warning noise
  - Document status lifecycle: `pending -> processing -> done/failed`
  - Original blob reference cleared after extraction (`storageKey` set to `null`)
  - Document delete API + class-scoped document list UI (ready docs shown)
  - Unified uploader-owned loading state until processing completes
- AI class chat (`/api/chat`)
  - Uses only authenticated user + selected class documents
  - Native Groq SDK streaming call with model from `GROQ_CHAT_MODEL` (fallback: `llama-3.3-70b-versatile`)
  - Chat tuning via env: `GROQ_CHAT_TEMPERATURE`, `GROQ_CHAT_REASONING_EFFORT`
  - Daily usage quotas (per-user + global) enforced in DB
  - Source filename attribution streamed via end-of-response metadata marker
- Weekly schedule dashboard
  - AI-generated “This week” + “Upcoming” cards from schedule/syllabus text
  - Schedule tuning via env: `GROQ_SCHEDULE_TEMPERATURE`, `GROQ_SCHEDULE_REASONING_EFFORT`
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
- Groq SDK

## Important Implementation Notes

- Authorization is enforced in API routes using `auth()` + ownership checks.
- Chat context is built only from `Document` rows matching `(userId, classId, status=done)`.
- Daily quota windows are timezone-aware for users and UTC-based globally.
- Schedule uploads can trigger week verification UI to set the class current week.
- Weekly schedule records are fingerprinted to avoid unnecessary regeneration.

## Upcoming Features

- Phone-friendly chat and class experience
  - Improve responsive layout and controls for mobile screens.
- Token usage visibility in chat UI
  - Show per-message output token usage and daily usage feedback in the interface.
- Chat UI polish
  - Improve message spacing, readability, and interaction flow.
- Chat response quality improvements
  - Improve prompts/context handling for clearer, more accurate answers.
- Auto-detect current week from document dates
  - Remove manual “what week are you in?” step and infer week from syllabus/schedule date anchors.
- Open uploaded files directly in the app
  - Let users view submitted files from the website without leaving the product.
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
