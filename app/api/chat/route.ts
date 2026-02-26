import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

const CHAT_MODEL = process.env.GROQ_CHAT_MODEL;

const USER_DAILY_REQUEST_LIMIT = 1000;
const USER_DAILY_TOKEN_LIMIT = 200_000;
const GLOBAL_DAILY_REQUEST_LIMIT = 1000;
const GLOBAL_DAILY_TOKEN_LIMIT = 200_000;

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
    const { classId, message } = await req.json();

    if (!classId || !message) {
      return NextResponse.json(
        { error: 'classId and message are required' },
        { status: 400 }
      );
    }

    // Verify class ownership
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classRecord || classRecord.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Class not found or unauthorized' },
        { status: 403 }
      );
    }

    // Fetch only documents for this class (only processed ones with extracted text)
    const documents = await prisma.document.findMany({
      where: {
        classId: classId,
        userId: session.user.id,
        status: 'done',
        textExtracted: { not: null },
      },
      select: {
        id: true,
        filename: true,
        textExtracted: true,
      },
    });

    // Build context from documents
    const context = documents
      .map(
        (doc) =>
          `[Document: ${doc.filename}]\n${doc.textExtracted}`
      )
      .join('\n\n---\n\n');

    if (!context) {
      return NextResponse.json(
        {
          error: 'No documents found for this class. Upload and process documents first.',
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
    console.log(`[Chat] Using context from ${documents.length} document(s)`);

    const userRecord = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { timezone: true },
    });

    const now = new Date();
    const userTimeZone = userRecord?.timezone ?? 'UTC';
    const userDayStart = getDayStartForTimeZone(now, userTimeZone);
    const globalDayStart = getUtcDayStart(now);

    const [userUsage, globalUsage] = await Promise.all([
      prisma.apiUsageDaily.upsert({
        where: {
          userId_windowStart: {
            userId: session.user.id,
            windowStart: userDayStart,
          },
        },
        create: {
          userId: session.user.id,
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

    if (userUsage.requestCount >= USER_DAILY_REQUEST_LIMIT) {
      return NextResponse.json(
        { error: 'Daily request limit reached. Try again tomorrow.' },
        { status: 429 }
      );
    }

    if (userUsage.tokenCount >= USER_DAILY_TOKEN_LIMIT) {
      return NextResponse.json(
        { error: 'Daily token limit reached. Try again tomorrow.' },
        { status: 429 }
      );
    }

    if (globalUsage.requestCount >= GLOBAL_DAILY_REQUEST_LIMIT) {
      return NextResponse.json(
        { error: 'Global request limit reached. Try again tomorrow.' },
        { status: 429 }
      );
    }

    if (globalUsage.tokenCount >= GLOBAL_DAILY_TOKEN_LIMIT) {
      return NextResponse.json(
        { error: 'Global token limit reached. Try again tomorrow.' },
        { status: 429 }
      );
    }

    // Call Groq (via AI SDK)
    const result = await generateText({
      model: groq(CHAT_MODEL),
      system: systemPrompt,
      prompt: message,
      temperature: 0.5,
      maxOutputTokens: 2048,
    });

    const totalTokens = result.usage?.totalTokens ?? 0;

    await Promise.all([
      prisma.apiUsageDaily.update({
        where: {
          userId_windowStart: {
            userId: session.user.id,
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

    // Collect source filenames for attribution (only relevant files)
    const sources = getRelevantSources({
      response: result.text,
      documents,
    });

    return NextResponse.json({
      success: true,
      response: result.text,
      documentsUsed: sources.length,
      sources,
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
