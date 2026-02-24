import mammoth from 'mammoth';
import path from 'path';
import { pathToFileURL } from 'url';

// Preload the worker URL so Next.js bundles the asset for both node and edge runtimes
const pdfWorkerUrlPromise = import('pdfjs-dist/legacy/build/pdf.worker.mjs?url')
  .then(mod => mod.default)
  .catch(() => null);

// pdfjs expects a handful of DOM APIs that are missing in the serverless runtime; provide light stubs
function ensurePdfDomPolyfills() {
  const g: any = globalThis as any;

  if (!g.DOMMatrix) {
    class SimpleDOMMatrix {
      a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
      constructor(init?: any) {
        if (init && typeof init === 'object') {
          this.a = init.a ?? this.a;
          this.b = init.b ?? this.b;
          this.c = init.c ?? this.c;
          this.d = init.d ?? this.d;
          this.e = init.e ?? this.e;
          this.f = init.f ?? this.f;
        }
      }
      multiplySelf() { return this; }
      preMultiplySelf() { return this; }
      translateSelf() { return this; }
      scaleSelf() { return this; }
      rotateSelf() { return this; }
      invertSelf() { return this; }
    }
    g.DOMMatrix = SimpleDOMMatrix;
  }

  if (!g.Path2D) {
    g.Path2D = class Path2D { constructor(_: any = undefined) {} };
  }

  if (!g.ImageData) {
    g.ImageData = class ImageData {
      data: Uint8ClampedArray;
      width: number;
      height: number;
      constructor(data: Uint8ClampedArray | number, width?: number, height?: number) {
        if (data instanceof Uint8ClampedArray && typeof width === 'number' && typeof height === 'number') {
          this.data = data;
          this.width = width;
          this.height = height;
        } else if (typeof data === 'number' && typeof width === 'number' && typeof height === 'number') {
          this.data = new Uint8ClampedArray(data * width * height);
          this.width = width;
          this.height = height;
        } else {
          this.data = new Uint8ClampedArray(0);
          this.width = 0;
          this.height = 0;
        }
      }
    };
  }
}

/**
 * Extract text from PDF or DOCX files
 * @param buffer - File contents
 * @param mimeType - MIME type of the file
 * @returns Extracted text content
 */
export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  try {
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
  ensurePdfDomPolyfills();

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const workerUrl = await pdfWorkerUrlPromise;

  if (pdfjsLib.GlobalWorkerOptions) {
    if (workerUrl) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
    } else {
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
  }

  const loadingTask = (pdfjsLib as any).getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    isEvalSupported: false,
    useSystemFonts: true,
    disableFontFace: true,
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
