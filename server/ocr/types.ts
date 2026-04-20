/**
 * OCR Provider Interface
 *
 * Designed to support multiple OCR backends:
 * - Tesseract.js (local, open-source)
 * - Azure Document Intelligence (cloud)
 * - Google Cloud Vision API (cloud)
 *
 * To add a new provider, implement this interface and register it in OcrService.
 */

export interface OcrProvider {
  readonly name: string;

  /** Extract text from a single image buffer (PNG/JPEG/etc.) */
  extractText(imageBuffer: Buffer): Promise<string>;

  /** Optional cleanup — called on shutdown */
  destroy?(): Promise<void>;
}

export interface OcrServiceOptions {
  /** Minimum character count to consider a PDF as "digital" (has embedded text) */
  digitalTextThreshold?: number;

  /** Scale factor for PDF → image conversion (higher = better OCR quality, slower) */
  pdfRenderScale?: number;

  /** Max pages to OCR from a single PDF (safety limit) */
  maxPagesToOcr?: number;
}

export const DEFAULT_OCR_OPTIONS: Required<OcrServiceOptions> = {
  digitalTextThreshold: 200,
  pdfRenderScale: 2.0,
  maxPagesToOcr: 50,
};
