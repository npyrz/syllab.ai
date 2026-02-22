import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { processDocument } from '@/lib/document-processor';

/**
 * POST /api/documents/retry-processing
 * Retry processing for documents that are stuck in pending state
 * This can be called by the client to manually trigger processing
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { documentId } = await req.json();

    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId is required' },
        { status: 400 }
      );
    }

    // Verify document ownership
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        userId: true,
        filename: true,
        status: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Only allow retrying pending or failed documents
    if (document.status !== 'pending' && document.status !== 'failed') {
      return NextResponse.json(
        {
          error: `Document is already ${document.status}. Cannot retry.`,
        },
        { status: 400 }
      );
    }

    console.log(`[API] Retrying processing for document: ${documentId}`);

    // Process the document
    await processDocument(documentId);

    // Fetch the updated document
    const updatedDocument = await prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        filename: true,
        status: true,
        createdAt: true,
        processedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Document processing started',
      document: updatedDocument,
    });
  } catch (error) {
    console.error('[API] Retry processing failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Processing failed',
      },
      { status: 500 }
    );
  }
}
