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
    const systemPrompt = `You are a helpful AI assistant for students. You have access to the following class materials:

${context}

## Instructions:
- Answer questions ONLY based on the provided documents.
- Format responses to match this style (markdown):

## TL;DR
- ✅ Short key point
- ✅ Short key point

## Details
- ✅ Bullet point with a short explanation
- ✅ Another bullet point

## Source
> "Exact supporting quote from the document."
> — <document filename>

- Use **bold** for key terms.
- Keep lists scannable and concise.
- Use ✅ for confirmed facts, ⏱️ for time-related items.
- If the answer is not in the documents, say: "I don't have that information in the provided materials." and include empty TL;DR, Details, and Source sections.`;

    console.log(`[Chat] Processing query for class ${classId}: "${message}"`);
    console.log(`[Chat] Using context from ${documents.length} document(s)`);

    // Call Groq (via AI SDK)
    const result = await generateText({
      model: groq('llama-3.3-70b-versatile'),
      system: systemPrompt,
      prompt: message,
      temperature: 0.5,
      maxOutputTokens: 2048,
    });

    console.log(`[Chat] Generated response for class ${classId}`);

    return NextResponse.json({
      success: true,
      response: result.text,
      documentsUsed: documents.length,
    });
  } catch (error) {
    console.error('[Chat] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
