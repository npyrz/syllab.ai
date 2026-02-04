# System Design: syllab.ai

## 1) Overview
syllab.ai is a Next.js App Router application that provides authenticated access to class creation, document upload, and AI-powered class insights. Users upload documents (syllabi, schedules, etc.), system extracts and stores the text, and Groq API generates responses based **only** on that user's documents. Each user has isolated document context for privacy and accuracy.

## 2) Goals
- Provide secure authentication and protected routes.
- Allow users to create classes and upload associated files.
- Extract and store document text linked to the user.
- Enable user-scoped AI insights via Groq API (model only accesses that user's documents).
- Maintain privacy: no cross-user data leakage.
- Scalable, modular architecture for future enhancements.

Non-goals (current scope):
- Vector embeddings or semantic search (store raw extracted text for now).
- Advanced document processing (PDF/DOCX extraction only).

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

## 8) Document Ingestion & Processing Pipeline
**Core Principle:** Extract text, link to user, serve context-specific AI responses.

High-level workflow:
1. **Upload**: User uploads document to `POST /api/documents` (authenticated).
2. **Store**: API creates `Document` record with `status: pending` and saves file to object storage with `storageKey`.
3. **Extract** (background worker):
  - Pull file from storage.
  - Extract text (PDF, DOCX via `pdf-parse`, `docx` libraries or call external service).
  - Clean/normalize text (remove headers, footers, extra whitespace).
  - Store in `Document.textExtracted`.
  - Update `status: done` or `status: failed`.
4. **Cache**: User's extracted text lives in DB, indexed by `userId` for fast retrieval.
5. **Delete Original**: After successful extraction, delete from object storage (optional TTL).

**Privacy Guarantee:** Every API query to Groq is scoped by `userId`:
- Fetch all `Document` records where `userId = sessionUser.id`.
- Concatenate their `textExtracted` into a context string.
- Pass to Groq with system prompt: *"You are a helpful assistant for this user's class materials. Only reference information from the provided documents."*
- Return response to user only.

## 9) AI Query Flow (Groq API)
1. User submits query in UI (e.g., "Summarize the syllabus").
2. Client calls `POST /api/ai/query` (authenticated).
3. API retrieves session `user.id` and fetches all their documents:
  ```sql
  SELECT textExtracted FROM Document WHERE userId = $1 AND status = 'done'
  ```
4. Concatenate texts into context (limit size to fit Groq token limits).
5. Call Groq with:
  - System prompt: "You are a helpful assistant. Only use the provided documents."
  - User message: Query + concatenated document text.
6. Return Groq response to client.
7. Log query + response for auditing (optional).

**Key Security:** No user can see another user's documents or context. Queries are always filtered by `userId`.

## 10) Security & Privacy
- **Authentication**: Required on all API routes. Check `auth()` session.
- **Authorization**: Every query checks `userId` ownership:
  - `GET /api/documents` → only return docs where `userId = session.user.id`.
  - `POST /api/ai/query` → only use docs where `userId = session.user.id`.
- **Data Isolation**: Groq context includes only that user's extracted text.
- **Credential Safety**: Groq API key stored in env vars, server-side only.
- **File Retention**: Delete original files after extraction or set TTL to minimize storage.
- **Passwords**: Hashed with bcryptjs.
- **OAuth Secrets**: Stored in env vars, never logged.

## 11) Scalability Considerations
- **Stateless API**: All routes can scale horizontally on Vercel or K8s.
- **Background Processing**: Use workers (BullMQ, Vercel Functions, or Trigger.dev) to avoid blocking uploads.
- **Database Indexes**: `Document(userId, status)` for fast doc retrieval in AI queries.
- **Text Storage**: Store in DB for simplicity. For large corpora, migrate to vector DB later.
- **Groq Rate Limits**: Implement user-level request throttling to avoid quota issues.

## 12) Data Model Details
**User** (no changes to auth model)
- All fields as defined in Prisma schema.

**Class** (scoped per user)
- User can only see/modify classes where `userId = session.user.id`.

**Document** (scoped per user)
- `textExtracted`: Raw or cleaned text from the file (stored in DB for now).
- `storageKey`: Reference to original file in S3/R2 (for recovery/audit).
- `status`: Controls whether text is used in AI queries (`done` only).
- Index: `(userId, status)` for fast `SELECT textExtracted WHERE userId = ? AND status = 'done'`.

## 13) Deployment & Infrastructure
- **Next.js**: Vercel (or self-hosted Node.js).
- **PostgreSQL**: Managed service (AWS RDS, Heroku, Railway, etc.).
- **Object Storage**: Cloudflare R2 or AWS S3 (presigned URLs for client uploads).
- **Background Jobs**: Vercel Functions, Trigger.dev, or BullMQ with Redis.
- **Groq API Key**: Store in Vercel environment variables.
- **Environment Variables**:
  - `AUTH_SECRET`, `DATABASE_URL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - `GROQ_API_KEY`
  - `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (or R2 equivalents)

## 14) Next Steps
1. 🔲 Build `POST /api/documents` (create document, upload to storage).
2. 🔲 Build background extraction worker (PDF/DOCX text parsing).
3. 🔲 Build `POST /api/ai/query` with Groq integration and user-scoped context.
4. 🔲 Add UI for document upload feedback (processing status).
5. 🔲 Add UI for AI query interface (chat with your documents).
6. 🔲 Rate limiting + audit logging.
7. 🔲 Tests + error handling.

---
**Document status:** Updated system design with user-scoped document extraction and AI queries (February 4, 2026).
=