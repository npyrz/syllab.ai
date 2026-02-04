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
- User persistence and class/document records

**External Services**
- Google OAuth (optional)
- Object storage (S3/R2/GCS)
- Document processing workers (background)
- Groq API (LLM)

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

## 6) Data Model (Updated)
**User**
- `id` (cuid)
- `username` (unique)
- `email` (unique)
- `name`, `image`, `passwordHash`
- `provider`, `lastLoginAt`, `lastSeenAt`
- `createdAt`, `updatedAt`

**Class**
- `id` (cuid)
- `userId` (FK -> User)
- `title`
- `description?`
- `createdAt`, `updatedAt`

**Document**
- `id` (cuid)
- `classId` (FK -> Class)
- `userId` (FK -> User)
- `filename`, `mimeType`, `sizeBytes`
- `storageKey` (object storage key)
- `status` (`pending` | `processing` | `done` | `failed`)
- `textExtracted` (nullable, stored cleaned text)
- `createdAt`, `updatedAt`, `processedAt?`

**Upload** (optional helper)
- `id` (cuid)
- `documentId` (FK -> Document)
- `status` (`pending` | `processing` | `done` | `failed`)
- `createdAt`, `updatedAt`

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

## 8) Document Ingestion & Processing (Updated Plan)
The pipeline accepts uploads, extracts text, and stores cleaned content for AI use.

Proposed high-level workflow:
1. Client requests a presigned upload URL from the API.
2. Client uploads file directly to object storage.
3. API creates a `Document` record with `pending` status (and optional `Upload`).
4. Background worker pulls the object, extracts text (PDF, DOCX, OCR for images).
5. Cleaned text is stored in `Document.textExtracted` (or a separate table later).
6. Status transitions: `pending` → `processing` → `done` (or `failed`).
7. Optionally delete the original file after processing or keep with TTL.

## 9) Security & Privacy
- Authentication required for API access.
- Authorization enforced on every Class/Document access (`userId` ownership).
- Passwords stored as hashes only.
- OAuth secrets and database URL stored in environment variables.
- Object storage credentials server-side only.
- File processing should minimize retention of originals; consider TTL deletes.
- AI requests use cleaned text only; never send secrets or raw files.

## 10) Scalability Considerations
- API routes are stateless and can scale horizontally.
- Document processing should move to background workers to avoid request timeouts.
- Object storage required for large uploads in production.
- Database indexing on `User.email`, `User.username` plus FKs (`userId`, `classId`).

## 11) Observability (Recommended)
- Structured logging for API and auth events.
- Error tracking (Sentry or similar).
- Metrics for upload throughput and processing latency.

## 12) Deployment
- Next.js app deployable to Vercel or a Node.js server.
- PostgreSQL required for Prisma.
- Environment variables: `AUTH_SECRET`, `DATABASE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.

## 13) Known Gaps / Next Steps
- Implement Class/Document models in Prisma.
- Build presigned upload API and ingestion pipeline.
- Add background job system (e.g., BullMQ, Cloud Tasks, or serverless workers).
- Add Groq API integration for class-level summaries using cleaned text.

---

**Document status:** Initial system design aligned to current repo structure and intended roadmap (February 4, 2026).
