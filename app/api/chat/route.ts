import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

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

    // Call Groq (via AI SDK)
    const result = await generateText({
      model: groq('openai/gpt-oss-120b'),
      system: systemPrompt,
      prompt: message,
      temperature: 0.5,
      maxOutputTokens: 2048,
    });

    console.log(`[Chat] Generated response for class ${classId}`);

    // Collect source filenames for attribution
    const sources = documents.map((doc) => doc.filename);

    return NextResponse.json({
      success: true,
      response: result.text,
      documentsUsed: documents.length,
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
