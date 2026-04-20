import { pdfToPng, type PngPageOutput } from "pdf-to-png-converter";
import { PDFParse } from "pdf-parse";
import type { OcrProvider, OcrServiceOptions } from "./types";
import { DEFAULT_OCR_OPTIONS } from "./types";

/**
 * OCR Service
 *
 * Orchestrates text extraction from scanned documents:
 * 1. For digital PDFs/DOCX/text files → uses existing extraction (bypass OCR)
 * 2. For image files → direct OCR
 * 3. For scanned PDFs (no embedded text) → renders pages to images → OCR each page
 *
 * Designed to accept any OcrProvider implementation, making it easy to swap
 * Tesseract for a cloud provider (Azure DI, Google Vision) in the future.
 */
export class OcrService {
  private provider: OcrProvider;
  private options: Required<OcrServiceOptions>;

  constructor(provider: OcrProvider, options: OcrServiceOptions = {}) {
    this.provider = provider;
    this.options = { ...DEFAULT_OCR_OPTIONS, ...options };
  }

  /**
   * Extract text from any document buffer.
   * Automatically detects whether OCR is needed based on MIME type and content.
   * @param skipOcr - When true, only extracts embedded text (no OCR fallback). Used when OCR is disabled in settings.
   */
  async extractText(buffer: Buffer, mimeType: string, skipOcr = false): Promise<string> {
    try {
      // Images: direct OCR (unless disabled)
      if (mimeType.startsWith("image/")) {
        if (skipOcr) return "";
        return await this.provider.extractText(buffer);
      }

      // PDFs: embedded text first, OCR fallback for scanned pages (unless disabled)
      if (mimeType === "application/pdf") {
        return await this.extractFromPdf(buffer, skipOcr);
      }

      // Other types (DOCX, TXT, etc.) should be handled by the caller
      return "";
    } catch (error) {
      console.error(`[OcrService] Extraction failed for ${mimeType}:`, error);
      return "";
    }
  }

  /**
   * Check whether a PDF is scanned (image-based) or digital (text-based)
   * without performing full OCR.
   */
  async isScannedPdf(buffer: Buffer): Promise<boolean> {
    try {
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      return (parsed.text?.trim().length ?? 0) < this.options.digitalTextThreshold;
    } catch {
      return true; // If parsing fails, assume scanned
    }
  }

  private async extractFromPdf(buffer: Buffer, skipOcr = false): Promise<string> {
    // Step 1: try embedded text extraction
    const embeddedText = await this.extractEmbeddedPdfText(buffer);

    if (embeddedText.trim().length >= this.options.digitalTextThreshold) {
      return embeddedText;
    }

    if (skipOcr) {
      return embeddedText;
    }

    // Step 2: render pages to images and OCR
    console.log(`[OcrService] PDF appears scanned (embedded text: ${embeddedText.trim().length} chars). Running OCR...`);
    const images = await this.pdfToImages(buffer);
    const texts: string[] = [];

    for (const image of images) {
      const text = await this.provider.extractText(image);
      if (text.trim()) texts.push(text);
    }

    return texts.join("\n\n");
  }

  private async extractEmbeddedPdfText(buffer: Buffer): Promise<string> {
    try {
      const parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      return parsed.text ?? "";
    } catch {
      return "";
    }
  }

  private async pdfToImages(buffer: Buffer): Promise<Buffer[]> {
    const pngPages: PngPageOutput[] = await pdfToPng(buffer, {
      viewportScale: this.options.pdfRenderScale,
      returnPageContent: true,
      processPagesInParallel: false, // sequential to control memory
    });

    // Safety cap
    const capped = pngPages.slice(0, this.options.maxPagesToOcr);
    if (pngPages.length > this.options.maxPagesToOcr) {
      console.warn(`[OcrService] PDF has ${pngPages.length} pages; capping OCR to first ${this.options.maxPagesToOcr} pages.`);
    }

    return capped.map(page => Buffer.from(page.content ?? []));
  }

  async destroy(): Promise<void> {
    await this.provider.destroy?.();
  }
}
