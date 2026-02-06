import mammoth from 'mammoth';
import { promises as fs } from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

/**
 * Extract text from PDF or DOCX files
 * @param filePath - Full path to the file
 * @param mimeType - MIME type of the file
 * @returns Extracted text content
 */
export async function extractText(
  filePath: string,
  mimeType: string
): Promise<string> {
  try {
    const buffer = await fs.readFile(filePath);

    if (mimeType === 'application/pdf') {
      return await extractPdfText(buffer);
    }

    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return cleanText(result.value);
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
  } catch (error) {
    console.error('Text extraction error:', error);
    throw new Error(
      `Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Extract text from PDF using pdfjs-dist
 * @param buffer - PDF file buffer
 * @returns Extracted text content
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  if (pdfjsLib.GlobalWorkerOptions) {
    const workerPath = path.join(
      process.cwd(),
      'node_modules',
      'pdfjs-dist',
      'legacy',
      'build',
      'pdf.worker.mjs'
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).toString();
  }

  const loadingTask = (pdfjsLib as any).getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
  });
  const pdf = await loadingTask.promise;
  let text = '';

  for (let i = 0; i < pdf.numPages; i++) {
    const page = await pdf.getPage(i + 1);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join('');
    text += pageText + '\n';
  }

  return cleanText(text);
}

/**
 * Clean extracted text by removing extra whitespace, normalizing line breaks
 * @param text - Raw extracted text
 * @returns Cleaned text
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\n{3,}/g, '\n\n') // Remove excessive line breaks
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .trim(); // Remove leading/trailing whitespace
}
