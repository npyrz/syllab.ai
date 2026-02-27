import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import Groq from 'groq-sdk';

const CHAT_MODEL = process.env.GROQ_CHAT_MODEL?.trim() || 'llama-3.3-70b-versatile';
const CHAT_TEMPERATURE = Number.parseFloat(process.env.GROQ_CHAT_TEMPERATURE ?? '0.7');
const CHAT_REASONING_EFFORT =
  (process.env.GROQ_CHAT_REASONING_EFFORT?.trim() || 'medium') as 'none' | 'low' | 'medium' | 'high';
const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
const CHAT_META_PREFIX = '\n<<__CHAT_META__';
const CHAT_META_SUFFIX = '__>>';

const USER_DAILY_REQUEST_LIMIT = 1000;
const USER_DAILY_TOKEN_LIMIT = 200_000;
const GLOBAL_DAILY_REQUEST_LIMIT = 1000;
const GLOBAL_DAILY_TOKEN_LIMIT = 200_000;
const IS_DEV = process.env.NODE_ENV === 'development';

const SOURCE_STOP_WORDS = new Set([
  'the', 'and', 'that', 'with', 'this', 'from', 'your', 'you', 'for', 'are', 'was', 'were',
  'have', 'has', 'had', 'about', 'into', 'also', 'than', 'then', 'when', 'what', 'where', 'which',
  'will', 'would', 'should', 'could', 'there', 'their', 'them', 'they', 'been', 'being', 'because',
  'while', 'using', 'used', 'into', 'over', 'under', 'more', 'most', 'some', 'such', 'only', 'just',
  'very', 'much', 'many', 'each', 'other', 'than', 'make', 'made', 'does', 'did', 'done', 'its',
]);

function getRelevantSources(params: {
  response: string;
  documents: Array<{ filename: string; textExtracted: string | null }>;
}) {
  const candidateTerms = Array.from(
    new Set(
      params.response
        .toLowerCase()
        .match(/[a-z][a-z0-9]{3,}/g) ?? []
    )
  ).filter((term) => !SOURCE_STOP_WORDS.has(term));

  if (candidateTerms.length === 0) return [] as string[];

  const scored = params.documents
    .map((doc) => {
      const text = (doc.textExtracted ?? '').toLowerCase();
      if (!text) return { filename: doc.filename, score: 0 };

      let score = 0;
      for (const term of candidateTerms) {
        if (text.includes(term)) score += 1;
      }

      return { filename: doc.filename, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [] as string[];

  const maxScore = scored[0].score;
  const threshold = Math.max(2, Math.floor(maxScore * 0.35));

  return scored
    .filter((entry) => entry.score >= threshold)
    .slice(0, 4)
    .map((entry) => entry.filename);
}

function getUtcDayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function getDayStartForTimeZone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = Number(parts.find((part) => part.type === 'year')?.value ?? '0');
    const month = Number(parts.find((part) => part.type === 'month')?.value ?? '1');
    const day = Number(parts.find((part) => part.type === 'day')?.value ?? '1');

    return new Date(Date.UTC(year, month - 1, day));
  } catch {
    return getUtcDayStart(date);
  }
}

function quotaResponse(params: {
  message: string;
  code:
    | 'USER_DAILY_REQUEST_LIMIT'
    | 'USER_DAILY_TOKEN_LIMIT'
    | 'GLOBAL_DAILY_REQUEST_LIMIT'
    | 'GLOBAL_DAILY_TOKEN_LIMIT';
  retryAt: Date;
}) {
  const now = Date.now();
  const retryAtMs = params.retryAt.getTime();
  const retryAfterSeconds = Math.max(1, Math.ceil((retryAtMs - now) / 1000));

  return NextResponse.json(
    {
      error: params.message,
      code: params.code,
      retryAt: params.retryAt.toISOString(),
      retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

function clampTemperature(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(2, Math.max(0, value));
}

function supportsReasoningEffort(modelName: string) {
  const normalized = modelName.toLowerCase();
  return normalized.includes('gpt-oss') || normalized.includes('qwen3') || normalized.includes('deepseek-r1');
}

/**
 * POST /api/chat
 * Chat endpoint that only uses documents from the selected class
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { classId, message, includeNotes } = await req.json();

    if (!classId || !message) {
      return NextResponse.json(
        { error: 'classId and message are required' },
        { status: 400 }
      );
    }

    const userId = session.user.id as string;
    const shouldIncludeNotes = Boolean(includeNotes);

    // Verify class ownership
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classRecord || classRecord.userId !== userId) {
      return NextResponse.json(
        { error: 'Class not found or unauthorized' },
        { status: 403 }
      );
    }

    // Fetch only documents for this class (only processed ones with extracted text)
    const documents = await prisma.document.findMany({
      where: {
        classId: classId,
        userId: userId,
        status: 'done',
        textExtracted: { not: null },
      },
      select: {
        id: true,
        filename: true,
        textExtracted: true,
      },
    });

    const notes = shouldIncludeNotes
      ? await prisma.note.findMany({
          where: {
            classId: classId,
            userId: userId,
          },
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            title: true,
            content: true,
          },
        })
      : [];

    const documentContext = documents
      .map(
        (doc) =>
          `[Document: ${doc.filename}]\n${doc.textExtracted}`
      )
      .join('\n\n---\n\n');

    const notesContext = notes
      .filter((note) => note.content.trim().length > 0)
      .map((note) => `[Note: ${note.title}]\n${note.content}`)
      .join('\n\n---\n\n');

    const contextParts = [documentContext];
    if (notesContext) {
      contextParts.push(notesContext);
    }
    const context = contextParts.filter(Boolean).join('\n\n---\n\n');

    if (!context) {
      return NextResponse.json(
        {
          error: shouldIncludeNotes
            ? 'No context found for this class. Upload documents or add class notes first.'
            : 'No documents found for this class. Upload and process documents first.',
        },
        { status: 400 }
      );
    }

    // Build the system prompt with document context
    const systemPrompt = `You are a friendly, knowledgeable study assistant. You have access to the student's class materials below.

${context}

## How to respond
- Be conversational, warm, and helpful — like a smart classmate explaining things.
- Use clean **Markdown** formatting: headings (##), **bold** for key terms, bullet lists, and numbered steps where they help.
- Keep answers concise but complete. Avoid walls of text.
- Paraphrase and synthesize — do NOT copy-paste from the documents.
- Use concrete examples and plain language. Avoid unnecessary jargon.
- If the answer isn't in the documents, say so honestly.
- Do NOT include source citations or document references in your response — those are handled separately by the app.
- Never output XML tags, raw document text, or reasoning scaffolding. Just give a clean, readable answer.`;

    console.log(`[Chat] Processing query for class ${classId}: "${message}"`);
    console.log(
      `[Chat] Using context from ${documents.length} document(s)` +
        (shouldIncludeNotes ? ` and ${notes.length} note(s)` : '')
    );

    const userRecord = await prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const now = new Date();
    const userTimeZone = userRecord?.timezone ?? 'UTC';
    const userDayStart = getDayStartForTimeZone(now, userTimeZone);
    const globalDayStart = getUtcDayStart(now);
    const userRetryAt = new Date(userDayStart.getTime() + 24 * 60 * 60 * 1000);
    const globalRetryAt = new Date(globalDayStart.getTime() + 24 * 60 * 60 * 1000);

    const [userUsage, globalUsage] = await Promise.all([
      prisma.apiUsageDaily.upsert({
        where: {
          userId_windowStart: {
            userId: userId,
            windowStart: userDayStart,
          },
        },
        create: {
          userId: userId,
          windowStart: userDayStart,
        },
        update: {},
      }),
      prisma.apiUsageGlobalDaily.upsert({
        where: { windowStart: globalDayStart },
        create: { windowStart: globalDayStart },
        update: {},
      }),
    ]);

    if (!IS_DEV) {
      if (userUsage.requestCount >= USER_DAILY_REQUEST_LIMIT) {
        return quotaResponse({
          message: 'Daily request limit reached. Try again tomorrow.',
          code: 'USER_DAILY_REQUEST_LIMIT',
          retryAt: userRetryAt,
        });
      }

      if (userUsage.tokenCount >= USER_DAILY_TOKEN_LIMIT) {
        return quotaResponse({
          message: 'Daily token limit reached. Try again tomorrow.',
          code: 'USER_DAILY_TOKEN_LIMIT',
          retryAt: userRetryAt,
        });
      }

      if (globalUsage.requestCount >= GLOBAL_DAILY_REQUEST_LIMIT) {
        return quotaResponse({
          message: 'Global request limit reached. Try again tomorrow.',
          code: 'GLOBAL_DAILY_REQUEST_LIMIT',
          retryAt: globalRetryAt,
        });
      }

      if (globalUsage.tokenCount >= GLOBAL_DAILY_TOKEN_LIMIT) {
        return quotaResponse({
          message: 'Global token limit reached. Try again tomorrow.',
          code: 'GLOBAL_DAILY_TOKEN_LIMIT',
          retryAt: globalRetryAt,
        });
      }
    }

    const completion = await groqClient.chat.completions.create({
      model: CHAT_MODEL,
      temperature: clampTemperature(CHAT_TEMPERATURE, 0.7),
      max_completion_tokens: 2048,
      ...(supportsReasoningEffort(CHAT_MODEL)
        ? { reasoning_effort: CHAT_REASONING_EFFORT }
        : {}),
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    const encoder = new TextEncoder();
    let fullResponse = '';
    let totalTokens = 0;

    let isClosed = false;
    let isCancelled = false;

    const stream = new ReadableStream({
      async start(controller) {

        const safeEnqueue = (value: string) => {
          if (isClosed || isCancelled) return false;
          try {
            controller.enqueue(encoder.encode(value));
            return true;
          } catch (enqueueError) {
            if (!isCancelled) {
              console.warn('[Chat] Stream enqueue failed:', enqueueError);
            }
            isClosed = true;
            return false;
          }
        };

        const safeClose = () => {
          if (isClosed) return;
          isClosed = true;
          try {
            controller.close();
          } catch (closeError) {
            console.warn('[Chat] Stream close failed:', closeError);
          }
        };

        const onAbort = () => {
          isCancelled = true;
          safeClose();
        };

        req.signal.addEventListener('abort', onAbort);

        try {
          for await (const chunk of completion) {
            if (isCancelled) return;

            const token = chunk.choices?.[0]?.delta?.content ?? '';
            if (!token) continue;

            fullResponse += token;
            if (!safeEnqueue(token)) {
              return;
            }
          }

          if (totalTokens <= 0) {
            const estimatedPromptTokens = Math.ceil(message.length / 4);
            const estimatedCompletionTokens = Math.ceil(fullResponse.length / 4);
            totalTokens = estimatedPromptTokens + estimatedCompletionTokens;
          }

          await Promise.all([
            prisma.apiUsageDaily.update({
              where: {
                userId_windowStart: {
                  userId: userId,
                  windowStart: userDayStart,
                },
              },
              data: {
                requestCount: { increment: 1 },
                tokenCount: { increment: totalTokens },
              },
            }),
            prisma.apiUsageGlobalDaily.update({
              where: { windowStart: globalDayStart },
              data: {
                requestCount: { increment: 1 },
                tokenCount: { increment: totalTokens },
              },
            }),
          ]);

          console.log(`[Chat] Generated response for class ${classId}`);

          const sources = getRelevantSources({
            response: fullResponse,
            documents,
          });

          const metaPayload = JSON.stringify({ sources });
          safeEnqueue(`${CHAT_META_PREFIX}${metaPayload}${CHAT_META_SUFFIX}`);

          safeClose();
        } catch (streamError) {
          console.error('[Chat] Streaming error:', streamError);
          safeClose();
        } finally {
          req.signal.removeEventListener('abort', onAbort);
        }
      },
      cancel() {
        isCancelled = true;
        isClosed = true;
        console.warn('[Chat] Stream cancelled by client');
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
