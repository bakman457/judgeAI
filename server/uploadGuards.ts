import { TRPCError } from "@trpc/server";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "../shared/const";

/**
 * Magic-byte sniffer. Validates the first few bytes of an uploaded buffer
 * against the declared MIME type to catch files whose extension lies about
 * their contents (e.g. a renamed executable labeled "report.pdf").
 */
export function assertMagicBytesMatchMimeType(buffer: Buffer, mimeType: string) {
  if (buffer.length < 4) return;

  const head4 = buffer.slice(0, 4);
  const startsWith = (sig: number[]) => sig.every((b, i) => buffer[i] === b);

  if (mimeType === "application/pdf") {
    if (head4.toString("latin1") !== "%PDF") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "File is not a valid PDF (magic bytes mismatch)." });
    }
    return;
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "File is not a valid DOCX (magic bytes mismatch)." });
    }
    return;
  }

  if (mimeType === "image/jpeg") {
    if (!(buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "File is not a valid JPEG." });
    }
    return;
  }
  if (mimeType === "image/png") {
    if (!startsWith([0x89, 0x50, 0x4e, 0x47])) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "File is not a valid PNG." });
    }
    return;
  }
  if (mimeType === "image/gif") {
    if (head4.toString("latin1") !== "GIF8") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "File is not a valid GIF." });
    }
    return;
  }

  // Audio is validated later by ffmpeg; plain text/JSON by downstream parsers.
}

/** Strip a leading data-URL prefix (e.g. "data:application/pdf;base64,") if present. */
export function stripDataUrlPrefix(value: string): string {
  const commaIdx = value.indexOf(",");
  if (commaIdx !== -1 && value.slice(0, commaIdx).includes(";base64")) {
    return value.slice(commaIdx + 1);
  }
  return value;
}

/**
 * Validate that a string is a plausible base64 payload before handing it to
 * `Buffer.from`. `Buffer.from` silently discards invalid characters, which
 * can mask corrupt uploads instead of rejecting them.
 */
export function assertValidBase64(value: string): void {
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9+/\-_]+=*$/.test(trimmed)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The uploaded file content is not valid base64. Please re-select the file and try again.",
    });
  }
}

export function decodeBase64Document(base64Content: string) {
  const cleaned = stripDataUrlPrefix(base64Content).trim();
  assertValidBase64(cleaned);
  const buffer = Buffer.from(cleaned, "base64");
  if (!buffer.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Uploaded file is empty" });
  }
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Uploaded file exceeds the ${MAX_UPLOAD_MB}MB limit`,
    });
  }
  return buffer;
}
