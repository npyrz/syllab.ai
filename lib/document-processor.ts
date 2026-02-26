import { prisma } from '@/lib/prisma';
import { extractText } from '@/lib/text-extraction';
import { del } from '@vercel/blob';
import { primeCurrentWeekScheduleForClass } from '@/lib/weekly-schedule-sync';

const BLOB_FETCH_TIMEOUT_MS = 30_000;
const TEXT_EXTRACTION_TIMEOUT_MS = 60_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * Extract weekly schedule from document text
 * Identifies days of week and associated events
 */
function extractWeeklySchedule(text: string): Record<string, Array<{ label: string; time?: string }>> {
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const schedule: Record<string, Array<{ label: string; time?: string }>> = {};

  // Initialize empty arrays for each day
  days.forEach(day => {
    schedule[day] = [];
  });

  const lines = text.split(/\r?\n/).filter(line => line.trim());
  
  let currentDay: string | null = null;
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Check if line starts with a day of the week
    const dayMatch = days.find(day => 
      trimmed.toLowerCase().startsWith(day.toLowerCase())
    );
    
    if (dayMatch) {
      currentDay = dayMatch;
      // Check if there's time info on the same line as the day
      const timeMatch = trimmed.match(/(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))/);
      if (timeMatch) {
        const eventText = trimmed.replace(dayMatch, '').replace(timeMatch[0], '').trim();
        if (eventText) {
          schedule[currentDay].push({
            label: eventText.replace(/^[-–—:]+/, '').trim(),
            time: timeMatch[0]
          });
        }
      }
    } else if (currentDay && trimmed && trimmed.length > 3) {
      // This line is likely an event for the current day
      // Check for time patterns
      const timeMatch = trimmed.match(/^(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm))?[\s–—:-]*(.*)/);
      
      if (timeMatch) {
        const time = timeMatch[1];
        const eventLabel = timeMatch[2].trim();
        
        if (eventLabel && !eventLabel.match(/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i)) {
          schedule[currentDay].push({
            label: eventLabel,
            time: time?.trim()
          });
        }
      }
    }
  }

  return schedule;
}

/**
 * Extract deadline-related items from schedule document text
 * Looks for keywords like "due", "deadline", "exam", "quiz", "test"
 */
function extractScheduleDeadlines(text: string): Array<{ line: string; hasDeadlineKeyword: boolean }> {
  const deadlineKeywords = [
    /\b(due|deadline|exam|quiz|test|midterm|final|project|submission|homework|assignment|paper|report)\b/i
  ];
  
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  return lines
    .filter(line => line.trim().length >= 6 && line.trim().length <= 150)
    .map(line => ({
      line: line.trim(),
      hasDeadlineKeyword: deadlineKeywords.some(pattern => pattern.test(line))
    }))
    .filter(item => item.hasDeadlineKeyword);
}

/**
 * Process a document: extract text and update database
 * @param documentId - Document ID to process
 */
export async function processDocument(documentId: string): Promise<void> {
  console.log(`[Worker] Starting processing for document: ${documentId}`);

  try {
    // Update status to processing
    await prisma.document.update({
      where: { id: documentId },
      data: { status: 'processing' },
    });

    // Fetch document details
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    console.log(`[Worker] Extracting text from: ${document.filename}`);

    if (!document.storageKey) {
      throw new Error('Storage key is missing for this document');
    }

    // Extract text from the blob
    const response = await fetch(document.storageKey, {
      signal: AbortSignal.timeout(BLOB_FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Failed to download blob: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const extractedText = await withTimeout(
      extractText(buffer, document.mimeType),
      TEXT_EXTRACTION_TIMEOUT_MS,
      'Text extraction'
    );

    console.log(
      `[Worker] Extracted ${extractedText.length} characters from ${document.filename}`
    );
    console.log(`[Worker] Text preview:\n${extractedText.substring(0, 500)}...\n`);

    // If this is a schedule document, extract basic weekly schedule info
    let weeklyInfo: string | undefined = undefined;
    
    if (document.docType === 'schedule') {
      // Extract basic weekly schedule info
      const schedule = extractWeeklySchedule(extractedText);
      if (Object.values(schedule).some(day => day.length > 0)) {
        weeklyInfo = JSON.stringify(schedule);
      }
    }

    // Delete the blob file from Vercel Blob storage
    if (document.storageKey) {
      try {
        await del(document.storageKey);
        console.log(`[Worker] Deleted blob: ${document.storageKey}`);
      } catch (deleteError) {
        console.warn(`[Worker] Failed to delete blob ${document.storageKey}:`, deleteError);
        // Continue even if delete fails
      }
    }

    // Update document with extracted text
    await prisma.document.update({
      where: { id: documentId },
      data: {
        textExtracted: extractedText,
        storageKey: null,
        status: 'done',
        processedAt: new Date(),
        ...(weeklyInfo && { weeklyInfo }),
      },
    });

    if (document.docType === 'schedule' || document.docType === 'syllabus') {
      try {
        await primeCurrentWeekScheduleForClass({
          classId: document.classId,
          userId: document.userId,
        });
      } catch (primeError) {
        console.error(`[Worker] Failed to prime weekly schedule for class ${document.classId}:`, primeError);
      }
    }

    console.log(`[Worker] Successfully processed document: ${documentId}`);
  } catch (error) {
    console.error(`[Worker] Error processing document ${documentId}:`, error);

    // Update status to failed
    await prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'failed',
        processedAt: new Date(),
      },
    });

    throw error;
  }
}

/**
 * Process multiple documents in sequence
 * @param documentIds - Array of document IDs to process
 */
export async function processDocuments(documentIds: string[]): Promise<void> {
  console.log(`[Worker] Processing ${documentIds.length} documents...`);

  for (const documentId of documentIds) {
    try {
      await processDocument(documentId);
    } catch (error) {
      console.error(`[Worker] Failed to process ${documentId}, continuing...`);
    }
  }

  console.log(`[Worker] Finished processing all documents`);
}
