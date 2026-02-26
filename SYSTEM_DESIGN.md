# System Design: syllab.ai

## 1) Overview

syllab.ai is a Next.js App Router application for student class management. Users authenticate, create classes, upload course documents, and receive AI-powered answers and weekly schedule dashboards generated from extracted class materials.

The platform is user-scoped by design: data retrieval and AI context construction are filtered by authenticated `userId` and (for chat) selected `classId`.

## 2) Product Goals

- Provide secure authentication and route/API protection.
- Let users manage classes and documents in one workflow.
- Extract and store text from uploaded files for downstream AI use.
- Deliver class-specific AI chat and weekly planning views.
- Track and enforce AI usage limits to control spend.
- Keep architecture modular for future improvements.

## 3) High-Level Architecture

### Client Layer

- React components under Next.js App Router (`app/*`)
- Server components for data-backed pages
- Client components for uploads, chat, and interactive controls

### Application Layer

- Route handlers under `app/api/*/route.ts`
- NextAuth configuration in `auth.ts`
- Server actions for small user profile updates (timezone/theme/lastSeen)

### Data Layer

- Prisma ORM with PostgreSQL
- Core entities: users, classes, documents, weekly schedules, usage counters

### External Services

- Groq (AI inference via AI SDK)
- Vercel Blob (temporary uploaded file storage before extraction)

## 4) Current UI/UX Surface

### Primary Routes

- `/` and `/home`
  - Landing view for signed-out users
  - If signed-in with existing classes, renders class chat hub
- `/signin`
  - Credentials + optional Google OAuth sign-in
  - Includes timezone capture field for credentials flow
- `/signup`
  - Credentials account creation with username + timezone
- `/classes/new`
  - Create class + upload syllabus/schedule/misc docs
  - Shows current week verifier when schedule-like docs are uploaded
- `/classes/[id]`
  - Class detail view with:
    - Weekly dashboard (This Week + Upcoming)
    - Extracted highlights from processed docs
    - Document list + delete
    - Document uploader
    - Class delete action

### Persistent Shell

- Global layout with sidebar and header
- Sidebar class quick links
- Theme toggle (light/dark)
- Profile menu + sign out
- Background sync components:
  - `LastSeenPing`
  - `TimezoneSync`

## 5) Authentication & Session Model

Implemented with NextAuth v5 beta:

- Providers
  - Credentials provider (email/password)
  - Google provider when `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` exist
- Credentials authorize flow
  - Verifies user/password hash
  - Validates timezone and updates user timezone when provided
- JWT/session callbacks
  - On sign-in, upserts/updates DB user metadata
  - For new OAuth users, auto-generates unique username from email prefix
  - Persists DB user id to token and `session.user.id`

## 6) API Surface (Current)

### Auth

- `GET/POST /api/auth/[...nextauth]`

### Classes

- `GET /api/classes`
  - Returns session user’s classes with document counts
- `POST /api/classes`
  - Creates class
- `DELETE /api/classes`
  - Deletes owned class (cascade deletes related entities via DB relations)
- `PATCH /api/classes`
  - Updates `currentWeek` (bounded 1..20)
  - Sets `currentWeekSetAt`
  - Primes current week schedule cache in background

### Documents

- `GET /api/documents`
  - Lists owned docs, optional `classId` filter
- `POST /api/documents`
  - Validates ownership, file type, and max size
  - Uploads to Vercel Blob
  - Creates `Document` row with inferred/explicit `docType`
  - If schedule doc, writes `Class.scheduleId`
  - Triggers `processDocument(documentId)`
- `DELETE /api/documents`
  - Deletes owned doc by id
- `GET /api/documents/[id]`
  - Returns owned single doc

### Chat

- `POST /api/chat`
  - Requires auth + class ownership
  - Loads class-scoped processed document text
  - Builds system prompt with document context
  - Calls Groq model via AI SDK
  - Applies request/token quota checks (user daily + global daily)
  - Stores usage increments after response
  - Returns response + ranked source filenames

### Schedule Refresh (Cron)

- `POST /api/schedules/refresh`
  - Optional bearer auth via `CRON_SECRET`
  - Precomputes next week schedule for active classes

## 7) Document Ingestion & Processing Pipeline

1. Client uploads file via `/api/documents`.
2. Route stores blob and creates `Document(status=pending)`.
3. `processDocument` updates to `processing`.
4. Downloads blob, extracts text:
   - PDF -> `pdfjs-dist`
   - DOC/DOCX -> `mammoth`
5. Optional schedule-specific metadata extraction to `weeklyInfo`.
6. Deletes original blob object (best effort).
7. Updates document:
   - `textExtracted`
   - `storageKey = null`
   - `status = done` or `failed`
8. If doc is syllabus/schedule, attempts schedule priming.

## 8) Weekly Schedule Generation Design

### Inputs

- Class `currentWeek` + anchor date (`currentWeekSetAt` / `createdAt`)
- Schedule document text (preferred from `Class.scheduleId`, fallback by doc type/filename)
- Optional syllabus hints

### Generation Strategy

- Compute effective week with Sunday-boundary rollover.
- Parse structured week rows from schedule text.
- Call Groq model with strict JSON schema expectation.
- Normalize/fallback if model output is partial or invalid.
- Persist schedule to `WeekSchedule` table keyed by fingerprints:
  - `scheduleFingerprint`
  - `syllabusFingerprint`

### Output Used by UI

- `days[]` for “This week” cards
- `upcoming[]` for top upcoming items

## 9) Chat & Quota Enforcement

### Context Isolation

- Fetches only documents where:
  - `userId = session.user.id`
  - `classId = selected class`
  - `status = done`
  - `textExtracted IS NOT NULL`

### Quota Model

- User daily counters (`ApiUsageDaily`) keyed by `(userId, windowStart)` where `windowStart` is user timezone day start
- Global daily counters (`ApiUsageGlobalDaily`) keyed by UTC day start
- Limits currently enforced:
  - User requests/day: 1000
  - User tokens/day: 200,000
  - Global requests/day: 1000
  - Global tokens/day: 200,000

## 10) Data Model (Prisma)

### User

- Identity + auth metadata (`username`, `email`, `passwordHash`, `provider`)
- Preferences (`theme`, `timezone`)
- Activity timestamps (`lastLoginAt`, `lastSeenAt`)

### Class

- Owned by user
- Core fields: `title`, `description`
- Week state: `currentWeek`, `currentWeekSetAt`
- Optional schedule pointer: `scheduleId`

### Document

- Linked to class + user
- Metadata: filename, type, size, `docType`
- Processing state: `status`, `processedAt`
- Extracted content: `textExtracted`
- Optional schedule metadata/cache fields: `weeklyInfo`, `scheduleCache`

### WeekSchedule

- Materialized weekly dashboard cache by class/week/fingerprint
- Stores normalized `days` and `upcoming` JSON payloads
- Includes generation model + timestamp fields

### Usage Counters

- `ApiUsageDaily`
- `ApiUsageGlobalDaily`

## 11) Security & Isolation

- Auth required on protected API routes.
- Ownership checks enforced for class/document reads and writes.
- Chat only includes class + user scoped documents.
- Secrets remain server-side in env vars.
- Passwords hashed with `bcryptjs`.

## 12) Runtime & Deployment Notes

- Stateless API routes (horizontal scaling friendly)
- Prisma for DB abstraction
- Build/deploy target: Next.js production runtime
- Optional cron integration for schedule precomputation via `/api/schedules/refresh`

## 13) Environment Variables

- Required:
  - `AUTH_SECRET`
  - `DATABASE_URL`
  - `GROQ_API_KEY`
- Optional feature/config vars:
  - `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - `GROQ_CHAT_MODEL`
  - `GROQ_SCHEDULE_MODEL`
  - `GROQ_MODEL`
  - `GROQ_FALLBACK_MODEL`
  - `CRON_SECRET`
  - `BLOB_READ_WRITE_TOKEN` (for local/non-managed blob auth scenarios)

## 14) Known Constraints (Current)

- Document processing is currently invoked inline from upload route (not queue-backed yet).
- Chat context is raw concatenated extracted text (no vector retrieval yet).
- Quota thresholds are fixed constants in route logic.

## 15) Upcoming Features Roadmap

### 15.1 Lecture Notes -> Readable Notes

- Goal: allow uploading lecture notes and generate cleaner, more readable study notes.
- Planned approach:
  - Add a notes transformation stage after extraction.
  - Store normalized/rewritten notes as class-linked artifacts.
  - Surface readable notes in class detail UI.

### 15.2 Lecture Material -> Quizzes & Flashcards

- Goal: generate active-recall study tools from lecture materials.
- Planned approach:
  - Add a generation pipeline that produces quiz items and flashcards.
  - Persist generated items per class/week/topic for reuse.
  - Expose review UI for practicing and regenerating sets.

### 15.3 Personal Notes

- Goal: let users add their own notes to each class.
- Planned approach:
  - Add CRUD support for personal notes scoped by `userId` + `classId`.
  - Include user notes as optional context in AI responses.
  - Keep personal notes visually separate from uploaded document extracts.

### 15.4 Weekly Web Resource Discovery

- Goal: when syllabus/schedule highlights weekly material, find useful external resources.
- Planned approach:
  - Detect highlighted weekly topics from schedule/syllabus extraction.
  - Run a web discovery pass for trusted learning resources.
  - Store curated links with summary metadata per week/class.
  - Present suggested resources in the weekly dashboard alongside “This week” and “Upcoming”.
