import { prisma } from '@/lib/prisma';
import { extractText } from '@/lib/text-extraction';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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

    console.log(`[Worker] Extracting text from: ${document.filename} (${document.mimeType})`);

    if (!document.storageKey) {
      throw new Error('Storage key is missing for this document');
    }

    let buffer: Buffer;
    if (document.storageKey.startsWith('local://')) {
      const relativePath = document.storageKey.replace('local://', '');
      const absolutePath = path.join(process.cwd(), 'uploads', relativePath);
      console.log(`[Worker] Reading local file: ${absolutePath}`);
      buffer = await readFile(absolutePath);
    } else {
      console.log(`[Worker] Downloading from blob: ${document.storageKey.substring(0, 50)}...`);
      const response = await fetch(document.storageKey);
      if (!response.ok) {
        throw new Error(`Failed to download blob: ${response.status} ${response.statusText}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }
    
    console.log(`[Worker] Downloaded ${buffer.length} bytes, extracting text...`);
    const extractedText = await extractText(buffer, document.mimeType);

    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Text extraction resulted in empty content');
    }

    console.log(
      `[Worker] Extracted ${extractedText.length} characters from ${document.filename}`
    );
    console.log(`[Worker] Text preview:\n${extractedText.substring(0, 300)}...\n`);

    // If this is a schedule document, extract weekly schedule info
    let weeklyInfo: string | undefined = undefined;
    if (document.docType === 'schedule') {
      const schedule = extractWeeklySchedule(extractedText);
      // Only save if we found any schedule data
      if (Object.values(schedule).some(day => day.length > 0)) {
        weeklyInfo = JSON.stringify(schedule);
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

    console.log(`[Worker] Successfully processed document: ${documentId}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Worker] Error processing document ${documentId}: ${errorMsg}`);

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
