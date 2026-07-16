# syllab.ai — Product & Codebase Review

*Written July 16, 2026 — roughly 6 weeks before the fall semester starts.*

This document reviews the current state of syllab.ai, what's working, what's broken or missing, what to build (and cut) before a public launch for the new school year, whether this can become a startup, and how to fix the AI scaling problem (everything currently runs through one Groq account).

---

## 1. What's Good

**The core product idea is strong and differentiated.** "Upload your syllabus, get a week-by-week dashboard plus a chat assistant that only knows *your* class materials" is a real, focused student problem. Most competitors are either generic flashcard/AI-study tools or manual planners — the syllabus-driven automation is the wedge.

**The stack is modern and appropriate.** Next.js 16 App Router, React 19, TypeScript, Prisma 7 + Postgres, NextAuth v5, Vercel Blob. Nothing exotic, nothing legacy. Deploys to Vercel, scales horizontally, cheap to run at low volume.

**Security fundamentals are mostly right.**
- Every API route checks `auth()` and enforces ownership (`userId` scoping) before touching data — verified consistent across classes, documents, notes, chat.
- Chat context is strictly class + user scoped ([app/api/chat/route.ts:166-178](app/api/chat/route.ts#L166-L178)) — no cross-user leakage path.
- Passwords hashed with bcrypt; secrets stay server-side.
- Uploaded blobs are deleted after text extraction (`storageKey = null`) — good for both privacy and storage cost.

**Cost-consciousness is built in early.** Daily per-user and global usage quotas in the DB, fingerprint-keyed caching of generated weekly schedules (`WeekSchedule` unique on `[classId, week, scheduleFingerprint, syllabusFingerprint]`) so the AI isn't re-called for unchanged inputs, and a cron-friendly precompute endpoint. Most solo projects don't think about this until the bill arrives.

**The document pipeline is defensively written.** Timeout guards on blob fetch and extraction, tolerant PDF page handling, a proper `pending → processing → done/failed` status lifecycle, and a week-verification UI after schedule upload.

**Documentation is unusually good.** README and SYSTEM_DESIGN.md accurately describe the system, including known constraints. This matters for onboarding collaborators or presenting to investors/accelerators.

---

## 2. What's Bad

### Product-level problems

| # | Problem | Where | Severity |
|---|---------|-------|----------|
| 1 | **Chat has no memory.** Only the latest message is sent to the model ([HomeChat.tsx:122-126](app/components/HomeChat.tsx#L122-L126), [chat/route.ts:322-325](app/api/chat/route.ts#L322-L325)). "What about the second one?" fails. This makes the flagship feature feel broken. | chat | Critical |
| 2 | **One global daily cap shared by all users.** 1,000 requests / 200K tokens per day *product-wide*. ~15 active students chatting normally exhausts it and everyone gets a 429 until midnight UTC. | chat route constants | Critical for launch |
| 3 | **No RAG / no context management in chat.** Every processed document is concatenated raw into the system prompt with no truncation at all. A class with several long PDFs will blow past model context or per-minute token limits, and every single message pays for the full corpus. | [chat/route.ts:195-211](app/api/chat/route.ts#L195-L211) | High |
| 4 | **Not mobile-friendly.** Students live on phones; already on your roadmap but it's launch-blocking, not polish. | UI | High |
| 5 | **Resource curation can hallucinate URLs.** The model invents links; the trusted-domain regex filter ([lecture-resource-curator.ts:10](lib/lecture-resource-curator.ts#L10)) catches wrong *domains* but not dead paths — a khanacademy.org URL that 404s passes the filter. No HEAD-check validation. | resources | Medium |
| 6 | **Manual "what week are you in?" step** adds friction where the product's promise is automation. (Already roadmapped as auto-detect.) | onboarding | Medium |

### Engineering-level problems

| # | Problem | Where | Severity |
|---|---------|-------|----------|
| 7 | **Zero tests, no CI.** Nothing catches regressions in the 1,000-line schedule parser or auth flows. | repo-wide | High |
| 8 | **Auth is missing table-stakes features:** no email verification, no password reset, no password strength rule (any non-empty string is accepted — [signup/page.tsx:68](app/signup/page.tsx#L68)), no rate limiting on sign-in/sign-up (credential-stuffing target). | auth.ts, signup | High (launch-blocking) |
| 9 | **Document processing is fire-and-forget in a serverless runtime.** `void processDocument(...)` ([documents/route.ts:183](app/api/documents/route.ts#L183)) — on Vercel the function can be killed after the response returns, leaving documents stuck in `processing` forever. Needs `waitUntil()`, a queue (Inngest/QStash/Trigger.dev), or a Vercel background function. | documents | High |
| 10 | **Token accounting is always an estimate.** `totalTokens` is never populated from Groq's actual usage payload, so it always falls back to `length/4` ([chat/route.ts:330,382-386](app/api/chat/route.ts#L330)) — and it estimates only the user message, ignoring the (huge) document context. Quotas are therefore enforced against numbers ~10-50x too low. Also: if the client aborts mid-stream, usage is never recorded at all. | chat | High |
| 11 | **Quota check is not atomic.** Read-then-act with the increment happening after the stream finishes — N parallel requests all pass the check. Fine today, exploitable at scale. Use a conditional `updateMany` increment-first pattern. | chat | Medium |
| 12 | **`week-schedule-service.ts` is a 1,000-line regex fortress.** The schedule-parsing heuristics will be the #1 source of "it didn't work with my syllabus" complaints, and it's untested. Real-world syllabi are far messier than your test files. | lib | Medium |
| 13 | **Quota limits, model names, and prompt text are scattered constants** across route files and libs (four different `GROQ_*_MODEL` env vars, three `supportsReasoningEffort` copies). No single AI service layer. | lib, routes | Medium |
| 14 | Migrations with empty names (`20260301034601/`), uncommitted WIP on `development`, `.env.local` in the repo directory (gitignored, but `VERCEL_OIDC_TOKEN` etc. — double-check nothing was ever committed). | repo hygiene | Low |

---

## 3. Feature Changes: Add / Fix / Cut

### Must-fix before launch (blocking)

1. **Multi-turn chat.** Send the last N messages (or a summarized history) to the API. This is a ~1-day change (client sends `messages[]`, server maps them into the Groq call) with the single biggest perceived-quality payoff in the whole app.
2. **Fix the AI limit architecture** (see §6) — paid Groq tier + real per-user quotas + accurate token accounting.
3. **Auth hardening:** password minimum + email verification + password reset + rate limiting (Upstash Ratelimit or similar on auth routes). You cannot take real users' course data without a way to recover accounts.
4. **Reliable document processing:** move `processDocument` to `waitUntil()` at minimum, ideally a queue with retry + a "stuck > 5 min → failed, offer retry" sweep.
5. **Mobile-responsive core flows:** sign up → create class → upload → dashboard → chat.
6. **Legal minimum:** Terms of Service, Privacy Policy, and a data-deletion path (account delete button). You're storing students' course materials.

### High-value adds (do if time permits before September)

- **Auto-detect current week from syllabus dates** — removes the most awkward onboarding step and you already store the anchors.
- **Retrieval (RAG) for chat** — chunk `textExtracted` into a `DocumentChunk` table with pgvector embeddings; retrieve top-k per question. Cuts cost 10-30x, raises quality, and removes the context-overflow failure mode. This is also *the* enabler for cheap scaling (§6).
- **Token/usage visibility in UI** (already roadmapped) — pairs with real per-user quotas so limits feel fair instead of mysterious.
- **URL validation for curated resources** — a `fetch(url, {method: 'HEAD'})` pass before returning links.
- **Onboarding polish:** an example/demo class so a new user sees value before uploading anything.

### Defer until after launch

- Quizzes & flashcards generation (great retention feature, but a whole product surface — v1.1)
- Unified all-classes calendar (correctly already marked post-beta)
- In-app document viewer
- Readable-notes transformation (schema exists; ship when chat + dashboard are solid)

### Consider cutting or demoting

- **Weekly web-resource recommendations** — this is the feature you yourself flagged as unreliable, it burns AI budget on speculative output, and hallucinated/dead links actively damage trust. Either gate it behind link validation + a quality threshold, or hide it for launch. A missing feature is better than a bad one.
- **Reasoning-effort plumbing for models you don't use** (`gpt-oss`, `qwen3`, `deepseek-r1` checks in three files) — dead flexibility; simplify to the models you actually run.

---

## 4. Release Checklist for the New School Year

Working backwards from ~Sept 1 (6 weeks):

**Weeks 1–2 (now):** multi-turn chat; accurate token accounting; per-user quota tiers + paid Groq tier; auth hardening (verification, reset, rate limits, password rules); `waitUntil`/queue for processing.

**Weeks 3–4:** mobile responsiveness; auto week detection; RAG for chat context; error monitoring (Sentry), product analytics (PostHog), uptime alerts; ToS/Privacy/account deletion.

**Week 5:** closed beta with 10–20 real students using *their actual syllabi* — this will surface schedule-parser failures nothing else will. Add a "parsing failed → let me set it up manually" fallback path so a bad syllabus never dead-ends a user.

**Week 6:** landing page with clear value prop, demo video/GIF, waitlist-to-invite flow (protects your AI budget), launch to a limited cohort (one campus / one subreddit / club mailing lists). Don't do a big public launch on day one — the global-quota and parser risks make a controlled ramp the right call.

**Explicitly acceptable to launch without:** flashcards, calendar, document viewer, weekly web recommendations.

---

## 5. Can This Be a Startup?

**Yes — it's a credible startup wedge, with honest caveats.**

**For it:**
- Clear ICP (college students), acute recurring pain (semester chaos), natural virality moment (syllabus week, twice a year), and a product that gets *more* valuable as the semester progresses (retention loop).
- Comparable traction exists: tools like Quizlet, StudyFetch, Knowt, and Shovel show students pay for study/planning tools; none owns "syllabus → living semester dashboard + class-grounded AI" as the core loop.
- Costs are viable: with RAG + paid inference, COGS per active student is cents/month against a $4–8/month price point.

**Against it (know these going in):**
- **Thin moat.** The defensibility isn't the AI call — it's (a) the best-in-market syllabus/schedule parser across thousands of messy formats, and (b) becoming the default home for a student's semester. Treat the parser as the crown jewel: log every parse failure (with consent), build a labeled corpus, improve weekly.
- **Brutal seasonality.** Acquisition happens in ~3-week windows (late Aug/Sept, January). Missing a window costs half a year — which is why the September launch matters so much.
- **ChatGPT is the free alternative.** Your answer is workflow + persistence + structure (the dashboard, the week model, the class scoping), not chat quality alone.

**What's needed to make it a real business:**
1. **Entity & basics:** LLC/C-corp, ToS + Privacy Policy (you're handling student data — plan for FERPA-adjacent questions if you ever sell to institutions; COPPA if you ever allow under-13, which you shouldn't), support email, business bank account.
2. **Monetization:** freemium via Stripe. Free: 2 classes, ~20 AI messages/day, weekly dashboard. Pro (~$5/mo or ~$25/semester — students think in semesters): unlimited classes, high message cap, flashcards/quizzes when they ship. Your per-user quota system becomes the plan-tier enforcement (see §6).
3. **Distribution:** campus-by-campus beachhead (ambassadors, club partnerships, syllabus-week TikTok/IG demos), referral perk ("give a week of Pro, get a week of Pro").
4. **Metrics to prove the startup case:** W1→W4 retention, % of uploads that parse successfully (target >85%), messages/user/week, free→paid conversion. These four numbers are your seed-round story.
5. **Later options:** LMS integrations (Canvas/Blackboard syllabus import is a huge unlock and a moat), study-group/shared-class features (network effects — multiple students in the same class = shared parsed schedule, zero marginal AI cost).

---

## 6. Fixing the AI Problem (the "one Groq account" issue)

### Why it breaks today

Everything — chat, schedule generation, resource curation, note rewriting — funnels through one free-tier Groq key. Groq's free plan for `llama-3.3-70b-versatile` is roughly **30 requests/min, 1,000 requests/day, 12K tokens/min, 100K tokens/day** — your hard-coded global caps (1,000 req / 200K tokens per day) mirror this, meaning the *entire product* has one free account's worth of daily capacity, and your 200K token cap is actually double what Groq will really allow. Note the 12K **tokens-per-minute** limit too: a single chat request that stuffs a few large PDFs into context can exceed it on its own. Do **not** work around this with multiple free accounts — it violates Groq's terms and is a dead end operationally.

### Step 1 — Pay for inference (immediate, cheap)

Upgrade to Groq's **Developer tier**: daily caps disappear, limits rise to ~1,000 RPM / 250K–300K TPM, and `llama-3.3-70b-versatile` costs **$0.59/M input + $0.79/M output**. Even with today's wasteful full-context prompts (~8K input + 500 output tokens per message), that's about **half a cent per chat message** — 1,000 students sending 10 messages/day ≈ **$50/day worst case, and ~10-30x less after RAG**. This is a business cost, not a technical problem, and it's the single highest-leverage fix.

### Step 2 — Make quotas per-plan, not one global fuse

- Replace the global cap with **per-user daily/monthly quotas keyed to plan tier** (free vs pro) — the `ApiUsageDaily` table already supports this; the limits just need to come from the user's plan instead of constants.
- Keep a global cap only as a circuit-breaker (set well above expected load) to bound a runaway bill, alerting you instead of silently 429-ing users.
- **Fix token accounting to use real usage:** read the usage object Groq returns on the final stream chunk instead of the `length/4` estimate that ignores the document context entirely. You can't enforce or price quotas on numbers that are off by an order of magnitude.
- Make the quota reservation atomic (increment-first with a conditional update, refund on failure) so parallel requests can't slip past the check.

### Step 3 — Stop paying for the whole class on every message (RAG)

The real cost/limit problem isn't Groq — it's that every chat message re-sends every document. Chunk documents at processing time, embed into pgvector (Postgres extension — no new infra), retrieve the top ~6 chunks per question. Effects: input tokens drop from ~8K+ to ~1.5K per message, per-minute token limits stop being a ceiling, answers improve (less noise), and large classes stop failing outright. This one change makes every downstream provider 10-30x cheaper.

### Step 4 — A provider abstraction layer + tiered routing

Consolidate the four `GROQ_*` model configs and duplicated helpers into one `lib/ai.ts` with a single `complete()`/`stream()` interface, per-task model config, retry-with-backoff on 429s, and real usage capture. Then route by task value:

| Task | Model tier | Why |
|------|-----------|-----|
| Schedule parsing, fingerprinted one-time jobs | Cheap/fast (Groq `llama-3.3-70b` or smaller) | Structured extraction, cached by fingerprint, runs rarely |
| Student-facing chat | Quality tier | This is the product experience; worth a premium |
| Weekly precompute (cron) | Batch/cheap | Latency-insensitive |

**Where Claude fits:** for the chat tier specifically, Claude Haiku 4.5 ($1/M input, $5/M output) is price-competitive once RAG shrinks your prompts, and two Anthropic features map unusually well onto your architecture: **prompt caching** (your class-document context is a stable prefix reused across every message in a session — cache reads bill at ~0.1× input price, so repeated chat against the same class gets ~90% off the context cost even *without* RAG) and the **Batch API** (50% off for your cron-style weekly schedule precompute). A second provider behind the abstraction layer is also your resilience story when Groq has an outage or repricing.

### Step 5 — Protect the budget at the edges

- Waitlist/invite codes at launch (capacity control doubles as marketing scarcity).
- Cap message length and context size server-side; reject absurd inputs before they hit the API.
- Per-IP rate limits on unauthenticated routes.
- A spend dashboard (even a daily cron that emails you yesterday's token totals from `ApiUsageGlobalDaily`) so cost surprises can't run for a week unnoticed.

### Improving AI *quality* (the other half of "improving the AI")

1. Multi-turn history (§3) — the largest perceived-quality gap.
2. RAG (above) — grounding beats a bigger model.
3. Structured outputs / JSON-mode for schedule parsing instead of regex-parsing free text where the provider supports it — would let you shrink much of `week-schedule-service.ts` and raise the parse success rate.
4. A tiny eval set: 15-20 real syllabi + expected week tables, run on every parser change. This converts "I think I improved it" into a number, and it's your moat metric.

---

## TL;DR

The foundation is genuinely good — right idea, right stack, disciplined security and caching. The launch blockers are: chat memory, the single shared AI quota, auth account-recovery basics, mobile, and fragile document processing. The AI limit fix is: pay Groq (~$0.005/message), move quotas to per-user plan tiers with *real* token accounting, add RAG so you stop resending entire classes every message, and put all AI calls behind one service layer so you can mix providers (Groq for cheap structured work, Claude Haiku + prompt caching for chat). As a startup it's viable with a real wedge and honest risks (seasonality, thin moat) — the parser success rate and week-4 retention are the two numbers that decide everything. Ship a controlled beta by mid-August or the window closes until January.
