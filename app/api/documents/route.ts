import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';
import { processDocument } from '@/lib/document-processor';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

function inferDocType(
  filename: string,
  requestedType?: string | null
): 'syllabus' | 'schedule' | 'other' {
  if (requestedType === 'syllabus' || requestedType === 'schedule' || requestedType === 'other') {
    return requestedType;
  }

  const normalized = filename.toLowerCase();
  if (normalized.includes('syllabus')) return 'syllabus';
  if (
    normalized.includes('schedule') ||
    normalized.includes('calendar') ||
    normalized.includes('week') ||
    normalized.includes('timetable')
  ) {
    return 'schedule';
  }
  return 'other';
}

/**
 * GET /api/documents
 * Fetch all documents for the authenticated user
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get('classId');

  const whereClause: any = { userId: session.user.id };
  if (classId) {
    whereClause.classId = classId;
  }

  const documents = await prisma.document.findMany({
    where: whereClause,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      filename: true,
      mimeType: true,
      sizeBytes: true,
      status: true,
      createdAt: true,
      processedAt: true,
      classId: true,
      class: {
        select: {
          title: true,
        },
      },
    },
  });

  return NextResponse.json({ documents });
}

/**
 * POST /api/documents
 * Upload a document and create a database record
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const classId = formData.get('classId') as string;
    const requestedDocType = formData.get('docType')?.toString() ?? null;

    // Validate inputs
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!classId) {
      return NextResponse.json({ error: 'Class ID is required' }, { status: 400 });
    }

    // Verify class ownership
    const classRecord = await prisma.class.findUnique({
      where: { id: classId },
    });

    if (!classRecord || classRecord.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Class not found or unauthorized' },
        { status: 404 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF and DOCX files are allowed.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB.' },
        { status: 400 }
      );
    }

    // Generate unique blob name
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const blobName = `users/${session.user.id}/classes/${classId}/${timestamp}_${safeName}`;

    // Upload to Vercel Blob (or local filesystem fallback in development)
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    let storageKey: string;
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(blobName, buffer, {
        access: 'public',
        contentType: file.type,
      });
      storageKey = blob.url;
      console.log(`[Upload] Stored blob: ${storageKey}`);
    } else {
      const relativePath = blobName.replace(/\\/g, '/');
      const absolutePath = path.join(process.cwd(), 'uploads', relativePath);
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, buffer);
      storageKey = `local://${relativePath}`;
      console.log(`[Upload] Stored local file: ${storageKey}`);
    }

    // Create document record
    const document = await prisma.document.create({
      data: {
        userId: session.user.id,
        classId: classId,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        storageKey,
        docType: inferDocType(file.name, requestedDocType),
        status: 'pending',
      },
    });

    if (document.docType === 'schedule') {
      await prisma.class.update({
        where: { id: classId },
        data: { scheduleId: document.id },
      });
    }

    console.log(`[Upload] Created document record: ${document.id}`);

    // Queue document for background processing
    // Use fire-and-forget async processing via fetch to avoid blocking
    if (process.env.VERCEL_ENV === 'production') {
      // In production, trigger processing asynchronously without waiting
      // This ensures the upload endpoint returns quickly while processing happens in background
      const baseUrl = req.headers.get('x-forwarded-proto') && req.headers.get('x-forwarded-host')
        ? `${req.headers.get('x-forwarded-proto')}://${req.headers.get('x-forwarded-host')}`
        : `${req.nextUrl.protocol}//${req.nextUrl.host}`;
      
      fetch(`${baseUrl}/api/cron/process-documents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.CRON_SECRET || 'development'}`,
        },
      }).catch((err) => {
        console.error('[Upload] Failed to queue background processing:', err);
      });
      
      console.log(`[Upload] Document queued for async background processing`);
    } else {
      // In development, process synchronously for testing
      try {
        await processDocument(document.id);
      } catch (error) {
        console.error('[Upload] Background processing failed (dev mode):', error);
      }
    }

    // Fetch updated document
    const updatedDocument = await prisma.document.findUnique({
      where: { id: document.id },
      select: {
        id: true,
        filename: true,
        mimeType: true,
        sizeBytes: true,
        docType: true,
        status: true,
        createdAt: true,
        processedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      document: updatedDocument,
      classId,
    });
  } catch (error) {
    console.error('[Upload] Error:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/documents
 * Delete a document owned by the authenticated user
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    const document = await prisma.document.findUnique({
      where: { id },
      select: { id: true, userId: true },
    });

    if (!document || document.userId !== session.user.id) {
      return NextResponse.json(
        { error: 'Document not found or unauthorized' },
        { status: 404 }
      );
    }

    await prisma.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Documents] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
