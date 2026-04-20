import { createWorker, type Worker } from "tesseract.js";
import type { OcrProvider } from "./types";

/**
 * Tesseract.js OCR Provider
 *
 * Runs entirely locally — no cloud dependency, no data leaves the server.
 * Downloads trained language data on first use (~10–20 MB per language).
 * Supports Greek (ell), English (eng), or combined "ell+eng".
 */
export class TesseractOcrProvider implements OcrProvider {
  readonly name = "tesseract";

  private worker: Worker | null = null;
  private language: string;
  private initializing = false;

  constructor(language = "ell+eng") {
    this.language = language;
  }

  private async initialize(): Promise<void> {
    if (this.worker || this.initializing) return;
    this.initializing = true;
    try {
      this.worker = await createWorker(this.language, 1, {
        logger: m => {
          if (m.status === "recognizing text") {
            // Optional: can emit progress events here if needed
          }
        },
      });
    } finally {
      this.initializing = false;
    }
  }

  async extractText(imageBuffer: Buffer): Promise<string> {
    await this.initialize();
    if (!this.worker) {
      throw new Error("Tesseract worker failed to initialize");
    }
    const result = await this.worker.recognize(imageBuffer);
    return result.data.text ?? "";
  }

  async destroy(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
