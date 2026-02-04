# System Design: syllab.ai

## 1) Overview
syllab.ai is a Next.js App Router application that provides authenticated access to class creation and document upload workflows. The current implementation includes authentication (credentials + Google OAuth), a classes creation UI, and a stubbed classes API. The intended future system extracts text from uploaded documents to power class summaries and AI-assisted insights.

## 2) Goals
- Provide secure authentication and protected routes.
- Allow users to create classes and submit associated files.
- Prepare the backend for document ingestion and text extraction.
- Maintain a scalable, modular architecture for future AI features.

Non-goals (current scope):
- Full production-grade document processing pipeline.
- Vector search, embeddings, or custom model hosting.

## 3) High-Level Architecture
**Client (Browser)**
- Next.js React UI (App Router, client components)
- Form-driven workflows for class creation and uploads

**Application Server (Next.js)**
- API routes under `app/api/*` for server-side handling
- NextAuth-based auth handler with DB-backed user records

**Database (PostgreSQL + Prisma)**
- User persistence and future class/document records

**External Services**
- Google OAuth (optional)
- Future: Object storage (S3/R2) and document processing workers

```
Browser
  └─> Next.js App Router
       ├─ UI Routes (app/*)
       ├─ API Routes (app/api/*)
       └─ Auth (NextAuth)
             └─ Prisma Client
                  └─ PostgreSQL
```

## 4) Current Components
### 4.1 Frontend
- Root layout and shared shell (sidebar + header).
- Routes:
  - `/` and `/home` (landing + dashboard UI)
  - `/signin`, `/signup` (custom auth UI)
  - `/classes/new` (class creation form)
- Key components:
  - `CreateClassForm` (client form, file selection, post to API)

### 4.2 Backend
- Auth handler at `app/api/auth/[...nextauth]/route.ts` via `auth.ts` configuration.
- Classes API at `app/api/classes/route.ts` (authenticated `GET` and `POST`).

### 4.3 Data Layer
- Prisma schema in `prisma/schema.prisma`.
- `User` model is the primary model in use.
- `Post` is present as a placeholder/example model.

## 5) Authentication & Authorization
- NextAuth configured with:
  - Credentials provider for email/password
  - Google OAuth provider (optional, controlled by environment variables)
- User creation and updates occur in JWT callback after successful sign-in.
- Session includes the `user.id` persisted from the DB.
- API routes enforce auth by calling `auth()` and checking session.

## 6) Data Model (Current)
**User**
- `id` (cuid)
- `username` (unique)
- `email` (unique)
- `name`, `image`, `passwordHash`
- `provider`, `lastLoginAt`, `lastSeenAt`
- `createdAt`, `updatedAt`

**Post** (example)
- Not currently used by application logic.

## 7) Key Flows
### 7.1 Sign-in (Credentials)
1. User submits email/password on `/signin`.
2. NextAuth verifies via `prisma.user.findUnique` and password hash.
3. JWT callback persists user metadata and session includes `user.id`.

### 7.2 Sign-in (Google OAuth)
1. User completes OAuth flow.
2. JWT callback finds or creates a user:
   - Username derived from email and de-duplicated.
3. Session includes `user.id`.

### 7.3 Create Class (Current Stub)
1. User fills out `/classes/new` and selects files.
2. Client submits JSON to `POST /api/classes`.
3. API currently echoes payload and redirects user to `/home`.

## 8) Planned Document Ingestion (Target Design)
A future pipeline is planned to accept uploaded files, extract text, and store derived data.

Proposed high-level workflow:
1. Client uploads files to API route or directly to object storage.
2. API creates an `Upload` record with `pending` status.
3. Background worker extracts text (PDF, DOCX, OCR for images).
4. Text is cleaned, chunked, and stored (DB or vector DB later).
5. Original file is deleted after processing or after a TTL.
6. Client polls for `processing` → `done` status and surfaces insights.

## 9) Security & Privacy
- Authentication required for API access.
- Passwords stored as hashes only.
- OAuth secrets and database URL stored in environment variables.
- Future file processing should minimize retention of original files.

## 10) Scalability Considerations
- API routes are stateless and can scale horizontally.
- Document processing should move to background workers to avoid request timeouts.
- Object storage recommended for large uploads in production.
- Database indexing on `User.email`, `User.username` already in place.

## 11) Observability (Recommended)
- Structured logging for API and auth events.
- Error tracking (Sentry or similar).
- Metrics for upload throughput and processing latency.

## 12) Deployment
- Next.js app deployable to Vercel or a Node.js server.
- PostgreSQL required for Prisma.
- Environment variables: `AUTH_SECRET`, `DATABASE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

## 13) Known Gaps / Next Steps
- Implement classes and document models in Prisma.
- Build upload API and ingestion pipeline.
- Add background job system (e.g., BullMQ, Cloud Tasks, or serverless workers).
- Introduce document search and AI summarization.

---

**Document status:** Initial system design aligned to current repo structure and intended roadmap (February 2, 2026).
