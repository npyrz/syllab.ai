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


## Ideas & Notes
- For updates just have it as a popup notication
- https://www.cookiebot.com/us/privacy-policy-generator/?trc_gcmp_id=23257159802&trc_gag_id=188256882869&trc_gad_id=783888474695&utm_source=google&utm_medium=cpc&utm_campaign=cb_src_us_en_generic_mof_cmp&utm_content=us_ppg_exact&utm_term={searchterm}&utm_device=c&gad_source=1&gad_campaignid=23257159802&gbraid=0AAAAABYXPmVW_IMv_Nx6BbAg3IzQU2AX3&gclid=Cj0KCQiA1JLLBhCDARIsAAVfy7jGQnvzMMbF3uywp3_285hNEz2ArxEtGtWcgFtVHlaK7CLQ22j7Dp0aAtmYEALw_wcB 


- CORE FEATURES:
- ADD CLASS
- UPLOAD DOCUMENTS TO CLASS
- AI TRAINS OF THAT INFORMATION AND IT PRODUCES POPULAR INFO ABOUT UR CLASS AND WE JUST SCAN THE DOCUMENTS AND FIND FROM KEY WORDS
- IN FUTURE CREATE OUR OWN MODEL TO DO THIS
- CHAT FEATURE TO ASK ABOUT DOCUMENTS UPLOADED
- NOTES FEATURE THAT YOU CAN UPLOAD LECTURE NOTES AND GET SUMMARY, VIDEO, OR LESSON
-  BE ABLE TO SAVE NOTES
- MAKE IT CLEAR IT WONT SOLVE HOMEWORK PROBELSM AND STUDENTS SHOULD LEARN

## PLAN AND TODO
- ADD DB
- STORE LOGIN AND AUTH IN DB
- STORE CLASSES PER USER
- WORK ON .TXT TRANSFER OF DOCUEMNTS
- GET AWS SYSTEM FOR FILE STORAGE
- BEGIN RESEARCH ON AI CONNECTION


## UPLOAD SYSTEM
1) User uploads a document
In the UI (your drag/drop zones on /classes/new), the browser selects one or more files.
The client sends the file bytes to your backend, typically via:
POST /api/uploads (multipart form-data), or
a direct-to-storage upload (S3/R2) + then notify your backend with the file URL.
Key point: you must receive the bytes somewhere to extract text.

2) Backend stores the file temporarily
You have two common patterns:

A. Temp on disk (simple locally)

Save to something like /tmp/<upload-id> (or a serverless temp directory if supported).
Good for local/dev and simple deployments.
B. Temp in object storage (best for production)

Upload to a private bucket location like uploads/tmp/<upload-id>/<filename>.
This avoids “disk” issues on serverless and scales better.
You also create an Upload record (DB) with status:

pending → processing → done or failed
and metadata: userId, classId, filename, mimeType, size, createdAt
3) Text extraction pipeline runs
A worker/job (or the request itself for small files) does:

Detect file type

PDF, DOCX, image, etc.
Extract text

PDF (text-based): parse embedded text
PDF (scanned): run OCR
DOCX: extract text from document structure
Images: OCR
Normalize + clean

Remove repeated headers/footers
Fix hyphenated line breaks
Normalize whitespace
Keep page/section boundaries if helpful
Chunking (recommended)

Split text into smaller chunks (e.g., 500–1500 tokens/words) for search/AI.
Store chunk metadata (page number, source filename).
4) Persist only derived data (not the raw file)
Store in your DB (or vector DB later):

Document record: title, classId, userId, type, createdAt
DocumentText (or DocumentChunks): extracted text + chunk boundaries
Optional: embeddings for retrieval (later)
What you don’t keep (by default):

the original PDF/DOCX/image bytes
5) Delete the original file (immediately or with TTL)
Once extraction succeeds (or even on failure, depending on policy):

Delete from temp disk or from uploads/tmp/... storage
Mark upload record done
Retention variants

Immediate delete: best privacy posture
Short TTL (e.g., 1–24 hours): easier debugging/retries
User-controlled retention: “Keep originals” toggle (off by default)
6) UI feedback to the user
Client polls or subscribes to status:
“Uploading…” → “Processing…” → “Ready”
When ready, show extracted info (class name suggestions, schedule detection, key dates, etc.) and enable chat/search.
Why this is usually the best MVP choice
Works with any file type you can parse/OCR.
Doesn’t require heavy in-browser processing.
You can confidently say: “We don’t store your originals (we delete them after processing)”—but be precise that files are processed transiently.
Implementation note for your repo
Given your App Router setup, the typical pieces are:

app/api/uploads/route.ts (accept upload, create upload record)
src/server/extract/* (parsers + OCR + chunking)
src/server/jobs/* (process upload, update status)
A DB adapter later (Prisma/Drizzle) to persist document text and status.
If you tell me your deployment target (Vercel? a VPS?) and which file types you want first (PDF only vs PDF+DOCX+images), I can recommend the exact extraction approach and where to run it (route handler vs background job).
