import { prisma } from '@/lib/prisma';
import { extractText } from '@/lib/text-extraction';
import { promises as fs } from 'fs';
import path from 'path';

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

    // Extract text from the file
    const filePath = path.join(process.cwd(), document.storageKey);
    const extractedText = await extractText(filePath, document.mimeType);

    console.log(
      `[Worker] Extracted ${extractedText.length} characters from ${document.filename}`
    );
    console.log(`[Worker] Text preview:\n${extractedText.substring(0, 500)}...\n`);

    // Save extracted text as .txt file for reference
    const txtPath = filePath.replace(/\.[^.]+$/, '.txt');
    await fs.writeFile(txtPath, extractedText, 'utf-8');
    console.log(`[Worker] Saved extracted text to: ${txtPath}`);

    // Update document with extracted text
    await prisma.document.update({
      where: { id: documentId },
      data: {
        textExtracted: extractedText,
        status: 'done',
        processedAt: new Date(),
      },
    });

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
