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
    const systemPrompt = `You are a helpful assistant for students. You have access to the following class materials:

  ${context}

  ## Rules
  - Answer questions ONLY using the provided documents.
  - Do NOT use jargon unless the user asks for technical detail.
  - Do NOT assume expert background knowledge.
  - Keep sentences under 20 words when possible.
  - Avoid speculation; say "I'm not sure" if uncertain.
  - Prefer concrete examples over abstract explanations.
  - Be concise and structured.
  - If instructions are ambiguous, ask a clarification question.

  ## Required response format
  Before the final answer, include a short reasoning summary with these headings:
  - Key facts
  - Approach
  - Final answer

  Then return the final answer in this exact XML format:

  <answer>
  <main_point>...</main_point>
  <steps>
  - step 1
  - step 2
  </steps>
  <example>...</example>
  <conclusion>...</conclusion>
  </answer>

  ## Source requirement
  After the XML, include a source block using exact quotes from the documents:
  > "Exact supporting quote from the document."
  > — <document filename>

  If the answer is not in the documents, say: "I don't have that information in the provided materials." and still include the reasoning summary, the XML structure with empty fields, and an empty source block.`;

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
