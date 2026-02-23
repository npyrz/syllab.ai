import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { processDocument } from '@/lib/document-processor';

/**
 * GET /api/cron/process-documents
 * Background job to process pending documents
 * Can be called by external services, manual triggers, or self-ping mechanism
 */
export async function GET(req: NextRequest) {
  // Verify request security
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const expectedAuth = cronSecret ? `Bearer ${cronSecret}` : `Bearer development`;
  
  if (authHeader !== expectedAuth) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  console.log('[Cron] Starting document processing job');

  try {
    // Find all pending documents
    const pendingDocuments = await prisma.document.findMany({
      where: {
        status: 'pending',
      },
      select: {
        id: true,
        filename: true,
      },
      take: 10, // Process max 10 documents per cron run to avoid timeout
    });

    if (pendingDocuments.length === 0) {
      console.log('[Cron] No pending documents to process');
      return NextResponse.json(
        { success: true, processed: 0, message: 'No pending documents' },
        { status: 200 }
      );
    }

    console.log(`[Cron] Found ${pendingDocuments.length} pending documents`);

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Process each document
    for (const doc of pendingDocuments) {
      try {
        console.log(`[Cron] Processing document: ${doc.id} (${doc.filename})`);
        await processDocument(doc.id);
        results.success++;
        console.log(`[Cron] Successfully processed: ${doc.id}`);
      } catch (error) {
        results.failed++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push(`${doc.id}: ${errorMsg}`);
        console.error(`[Cron] Failed to process ${doc.id}:`, errorMsg);
      }
    }

    console.log(
      `[Cron] Job complete. Success: ${results.success}, Failed: ${results.failed}`
    );

    return NextResponse.json(
      {
        success: true,
        processed: results.success,
        failed: results.failed,
        errors: results.errors,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Cron] Job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler for manual triggering (for testing)
 */
export async function POST(req: NextRequest) {
  // Only allow in development or with auth
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  // Delegate to GET handler
  return GET(req);
}
