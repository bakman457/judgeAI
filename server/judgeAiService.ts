import { randomBytes, createCipheriv, createDecipheriv, createHash, createSecretKey, pbkdf2Sync } from "node:crypto";
import { lookup } from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { TRPCError } from "@trpc/server";
import {
  approveDraft,
  createCaseDocument,
  createCaseReviewSnapshot,
  createDecisionExport,
  createDraftWithSections,
  createKnowledgeDocument,
  createProcessingJob,
  getActiveAiProviderSetting,
  getAiProviderSettingById,
  getCaseDocumentById,
  getCaseReviewSnapshotById,
  getCaseWorkspace,
  getDecisionExportById,
  getDraftById,
  getEffectiveReviewApprovalThreshold,
  getKnowledgeDocumentById,
  getUserById,
  getLatestCaseReviewSnapshotForDraft,
  inferReviewCaseTypeKey,
  listAiProviderSettings,
  listCaseActivity,
  listJudgeStyleJudgments,
  listKnowledgeDocuments,
  listReviewApprovalThresholds,
  logCaseActivity,
  saveAiProviderSetting,
  searchCaseAndKnowledgeDocuments,
  setActiveAiProviderSetting,
  updateCaseDocument,
  updateDecisionExport,
  updateDraftParagraph,
  updateDraftSection,
  updateJudgeStyleProfile,
  updateKnowledgeDocument,
  updateProcessingJob,
  upsertReviewApprovalThreshold,
} from "./db";
import { ENV } from "./_core/env";
import { storageGet, storagePut } from "./storage";
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from "../shared/const";

type ProviderType = "openai" | "azure_openai" | "custom_openai_compatible" | "alibaba_cloud" | "kimi" | "deepseek";

type SaveProviderInput = {
  id?: number;
  name: string;
  providerType: ProviderType;
  endpoint: string;
  model: string;
  apiKey?: string | null;
  azureApiVersion?: string | null;
  defaultSystemPrompt?: string | null;
  draftTemperature?: string | null;
  maxTokens?: number | null;
  isActive?: boolean;
  isArchived?: boolean;
  userId: number;
};

type TestProviderConnectionInput = {
  id?: number;
  providerType: ProviderType;
  endpoint: string;
  model: string;
  apiKey?: string | null;
  azureApiVersion?: string | null;
};

type UploadDocumentInput = {
  userId: number;
  title: string;
  fileName: string;
  mimeType: string;
  base64Content: string;
  metadataJson?: Record<string, unknown> | null;
};

type UploadKnowledgeDocumentInput = UploadDocumentInput & {
  documentType: "statute" | "regulation" | "precedent" | "reference" | "other";
  jurisdictionCode: string;
  courtLevel?: string | null;
  citation?: string | null;
  sourceReference?: string | null;
};

type UploadCaseDocumentInput = UploadDocumentInput & {
  caseId: number;
  documentType: "pleading" | "evidence" | "supporting" | "reference" | "decision" | "other";
};

type BatchUploadFileInput = {
  title?: string | null;
  fileName: string;
  mimeType: string;
  base64Content: string;
  metadataJson?: Record<string, unknown> | null;
};

type InferredCaseDocumentType = "pleading" | "evidence" | "supporting" | "reference" | "decision" | "other";
type InferredKnowledgeDocumentType = "statute" | "regulation" | "precedent" | "reference" | "other";

type DraftSectionKey = "header" | "facts" | "issues" | "reasoning" | "operative_part";
type ReviewTemplateKey = "inheritance";

type DraftAnnotation = {
  sourceType: "case_document" | "knowledge_document" | "statute" | "regulation" | "precedent" | "reference";
  caseDocumentId?: number | null;
  knowledgeDocumentId?: number | null;
  sourceLabel: string;
  sourceLocator?: string | null;
  quotedText?: string | null;
  rationaleNote?: string | null;
  relevanceScore?: string | null;
};

type DraftParagraphOutput = {
  paragraphText: string;
  rationale?: string | null;
  confidenceScore?: string | null;
  annotations?: DraftAnnotation[];
};

type DraftSectionOutput = {
  sectionKey: DraftSectionKey;
  sectionTitle: string;
  sectionText: string;
  paragraphs: DraftParagraphOutput[];
};

type DraftModelOutput = {
  sections: DraftSectionOutput[];
};

type CaseReviewFinding = {
  category: "law" | "evidence" | "procedure" | "reasoning";
  severity: "high" | "medium" | "low";
  issue: string;
  explanation: string;
  supportingSources: string[];
};

type CaseReviewIssue = {
  question: string;
  significance: string;
  supportingSources: string[];
};

type CaseReviewCitationCheck = {
  citation: string;
  status: "verified" | "partially_verified" | "not_verified" | "not_found";
  note: string;
  supportingSources: string[];
};

type CaseReviewCredibilitySignal = {
  sourceLabel: string;
  assessment: "strong" | "mixed" | "weak" | "untested";
  note: string;
  supportingSources: string[];
};

type CaseReviewContradiction = {
  conflict: string;
  impact: string;
  supportingSources: string[];
};

type CaseReviewPrecedent = {
  precedent: string;
  relation: "supports" | "distinguishes" | "conflicts" | "neutral";
  principle: string;
  note: string;
};

type ApprovalThresholdSummary = {
  id?: number | null;
  caseTypeKey: ReviewTemplateKey;
  minimumQualityScore: number;
  requireReadyForSignature: boolean;
  maxHighSeverityFindings: number;
  maxMediumSeverityFindings: number;
};

type CaseReviewOutput = {
  summary: string;
  outcomeAssessment: "supported" | "partially_supported" | "contradicted" | "insufficient_basis";
  confidenceScore: string;
  extractedIssues: CaseReviewIssue[];
  findings: CaseReviewFinding[];
  citationChecks: CaseReviewCitationCheck[];
  missingEvidence: string[];
  missingLaw: string[];
  credibilitySignals: CaseReviewCredibilitySignal[];
  contradictions: CaseReviewContradiction[];
  precedentAnalysis: CaseReviewPrecedent[];
  reasoningStructure: {
    ratioDecidendi: string[];
    obiterDicta: string[];
  };
  jurisdictionAndAdmissibility: {
    status: "clear" | "uncertain" | "problematic";
    note: string;
  };
  proportionalityReview: {
    status: "proportionate" | "possibly_disproportionate" | "insufficient_basis" | "not_applicable";
    note: string;
  };
  decisionQuality: {
    score: number;
    band: "strong" | "adequate" | "fragile" | "critical";
    rationale: string;
  };
  judgeFeedback: string[];
  preSignatureReview: {
    readyForSignature: boolean;
    blockers: string[];
    recommendedActions: string[];
  };
};

const TEXT_PREVIEW_LIMIT = 24_000;
const REQUIRED_SECTIONS: Array<{ key: DraftSectionKey; title: string }> = [
  { key: "header", title: "Header" },
  { key: "facts", title: "Facts" },
  { key: "issues", title: "Issues" },
  { key: "reasoning", title: "Reasoning" },
  { key: "operative_part", title: "Operative Part" },
];

const SUPPORTED_UPLOAD_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/html",
  "application/json",
]);

const MIME_TYPE_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
  html: "text/html",
  htm: "text/html",
  json: "application/json",
};

const LOCAL_DATA_DIR = process.env.JUDGE_AI_DATA_DIR ?? process.cwd();
const ENCRYPTION_SALT_FILE = path.join(LOCAL_DATA_DIR, ".encryption-salt");
const ENCRYPTION_SALT_LENGTH = 32;

/**
 * Get or create a unique encryption salt for this installation.
 * The salt is stored in a file to persist across restarts.
 * This prevents rainbow table attacks and ensures each installation has unique encryption.
 */
function getOrCreateEncryptionSalt(): string {
  try {
    if (fs.existsSync(ENCRYPTION_SALT_FILE)) {
      const existingSalt = fs.readFileSync(ENCRYPTION_SALT_FILE, "utf8").trim();
      if (existingSalt.length === ENCRYPTION_SALT_LENGTH * 2) { // hex string is 2x length
        return existingSalt;
      }
    }
    
    // Generate new random salt
    const newSalt = randomBytes(ENCRYPTION_SALT_LENGTH).toString("hex");
    fs.mkdirSync(path.dirname(ENCRYPTION_SALT_FILE), { recursive: true });
    fs.writeFileSync(ENCRYPTION_SALT_FILE, newSalt, { 
      encoding: "utf8",
      mode: 0o600,  // Owner read/write only
    });
    return newSalt;
  } catch (error) {
    console.error("[Encryption] Failed to manage salt file, using deterministic fallback:", error);
    // Fallback: derive from the provider-encryption secret so it's stable across restarts
    return createHash("sha256")
      .update(`judge-ai-stable-salt-${ENV.providerEncryptionSecret}`)
      .digest("hex");
  }
}

function encryptionKey() {
  const secret = ENV.providerEncryptionSecret;
  if (!secret || secret.length < 32) {
    throw new Error(
      "PROVIDER_ENCRYPTION_SECRET (or JWT_SECRET fallback) must be set and at least 32 characters for encryption",
    );
  }
  const salt = getOrCreateEncryptionSalt();
  const key = pbkdf2Sync(secret, salt, 100_000, 32, "sha256");
  return createSecretKey(key);
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    content: encrypted.toString("base64"),
  });
}

export function decryptSecret(payload?: string | null) {
  if (!payload) return null;
  const parsed = JSON.parse(payload) as { iv: string; authTag: string; content: string };
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(parsed.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(parsed.authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(parsed.content, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

function decryptProviderApiKey(payload?: string | null) {
  try {
    return decryptSecret(payload);
  } catch (error) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The selected AI provider API key can no longer be decrypted. Please save the provider settings again with the API key.",
      cause: error,
    });
  }
}

function userFacingErrorMessage(error: unknown, fallback = "The operation failed. Please check the logs for details.") {
  if (error instanceof TRPCError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (/failed query:|params:/i.test(error.message)) {
      return fallback;
    }
    return error.message;
  }

  return fallback;
}

function formatProviderFetchError(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "The AI provider request timed out. The request took too long — check your network or try a shorter document.";
  }

  if (error instanceof Error) {
    const cause = error.cause;
    const causeCode =
      typeof cause === "object" && cause !== null && "code" in cause
        ? String((cause as { code?: unknown }).code ?? "")
        : "";
    const causeMessage =
      typeof cause === "object" && cause !== null && "message" in cause
        ? String((cause as { message?: unknown }).message ?? "")
        : "";

    if (causeCode === "UND_ERR_SOCKET" || causeCode === "ECONNRESET" || /socket hang up/i.test(error.message)) {
      return "The AI provider closed the connection before returning a response. Check the provider endpoint/model or try again with a shorter document.";
    }

    // undici throws "terminated" when the server abruptly drops the connection
    // or when network issues interrupt the request mid-flight.
    if (error.message === "terminated" || /terminated/i.test(causeMessage)) {
      return `The connection to the AI provider was terminated unexpectedly. This often means the provider is unreachable from your network, or the request was too large. Check internet connectivity to the provider endpoint, or try a smaller document.${causeMessage ? ` (reason: ${causeMessage})` : ""}`;
    }

    if (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN") {
      return "Could not resolve the AI provider hostname. Check your DNS and that the endpoint URL is correct.";
    }

    if (causeCode === "ECONNREFUSED") {
      return "The AI provider refused the connection. Check the endpoint URL and port.";
    }

    if (causeCode === "CERT_HAS_EXPIRED" || /certificate/i.test(causeMessage)) {
      return "TLS/SSL certificate problem when connecting to the AI provider.";
    }

    if (error.message === "fetch failed") {
      return `The AI provider request could not be completed. Check the provider endpoint, network access, and API key.${causeMessage ? ` (reason: ${causeMessage})` : ""}`;
    }

    return error.message;
  }

  return "The AI provider request failed.";
}

/**
 * Streams an OpenAI-compatible chat completion, accumulates content deltas,
 * and returns the final assembled message string.
 *
 * Using stream: true keeps bytes flowing continuously, which prevents
 * middleboxes/proxies from closing the TLS connection as "idle" during
 * long generations — the main cause of the "other side closed" errors
 * with DeepSeek/Kimi from networks outside their home region.
 */
async function postProviderChatCompletionStreaming(
  endpoint: string,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
  timeoutMs = 600_000,
): Promise<string> {
  const streamPayload = { ...payload, stream: true };
  const body = JSON.stringify(streamPayload);
  console.log(`[LLM] POST (stream) ${endpoint} (body size: ${body.length} bytes, model: ${(payload as { model?: string }).model ?? "?"})`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "text/event-stream",
        ...headers,
      },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    clearTimeout(timeoutId);
    console.error("[LLM] Stream fetch error:", {
      endpoint,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCause: error instanceof Error ? error.cause : undefined,
    });
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: formatProviderFetchError(error),
      cause: error,
    });
  }

  if (!response.ok || !response.body) {
    clearTimeout(timeoutId);
    const errorText = await response.text().catch(() => response.statusText);
    console.error(`[LLM] Stream HTTP ${response.status} from ${endpoint}: ${errorText.slice(0, 500)}`);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `AI provider request failed: ${response.status} ${response.statusText} - ${normalizeText(errorText, 1000)}`,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let content = "";
  let truncatedByLength = false;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx).trim();
        buffer = buffer.slice(newlineIdx + 1);
        if (!line.startsWith("data:")) continue;

        const data = line.slice(5).trim();
        if (data === "[DONE]") continue;
        if (!data) continue;

        try {
          const chunk = JSON.parse(data) as {
            choices?: Array<{
              delta?: { content?: string };
              finish_reason?: string | null;
            }>;
          };
          const choice = chunk.choices?.[0];
          const delta = choice?.delta?.content;
          if (typeof delta === "string") content += delta;
          // finish_reason "length" means the model hit max_tokens and the JSON
          // is almost certainly incomplete — treat the whole response as a
          // retryable generation error so the compact-context retry kicks in.
          if (choice?.finish_reason === "length") {
            truncatedByLength = true;
            console.warn("[LLM] Stream finish_reason=length — response was cut at max_tokens");
          }
        } catch {
          // ignore malformed SSE lines
        }
      }
    }
  } catch (error) {
    console.error("[LLM] Stream read error:", {
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCause: error instanceof Error ? error.cause : undefined,
    });
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: formatProviderFetchError(error),
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!content) {
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: "AI provider returned an empty streamed response.",
    });
  }

  if (truncatedByLength) {
    // Throw a retryable error so generateStructuredDraft will re-invoke with
    // compact context. Include the partial content so the caller can log it.
    throw new Error(
      `Provider did not return a valid JSON object (response truncated at max_tokens — ${content.length} chars received)`,
    );
  }

  console.log(`[LLM] Stream complete (${content.length} chars received)`);
  return content;
}

async function postProviderChatCompletion(endpoint: string, headers: Record<string, string>, payload: Record<string, unknown>, timeoutMs = 600_000) {
  let response: Response;

  const body = JSON.stringify(payload);
  console.log(`[LLM] POST ${endpoint} (body size: ${body.length} bytes, model: ${(payload as { model?: string }).model ?? "?"})`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        accept: "application/json",
        ...headers,
      },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    console.error("[LLM] Fetch error details:", {
      endpoint,
      errorName: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : String(error),
      errorCause: error instanceof Error ? error.cause : undefined,
    });
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: formatProviderFetchError(error),
      cause: error,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    console.error(`[LLM] HTTP ${response.status} from ${endpoint}: ${errorText.slice(0, 500)}`);
    throw new TRPCError({
      code: "BAD_GATEWAY",
      message: `AI provider request failed: ${response.status} ${response.statusText} - ${normalizeText(errorText, 1000)}`,
    });
  }

  return response;
}

function isProviderConnectionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("closed the connection") ||
    message.includes("socket hang up") ||
    message.includes("fetch failed") ||
    message.includes("timed out") ||
    message.includes("terminated") ||
    message.includes("other side closed") ||
    message.includes("was terminated unexpectedly")
  );
}

function isRetryableGenerationError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  // SyntaxError is thrown by JSON.parse when the model returned malformed or
  // truncated JSON (e.g. cut at max_tokens, unescaped Greek quotes mid-string).
  // These are always worth retrying with a compact prompt.
  if (error instanceof SyntaxError) return true;
  return (
    isProviderConnectionError(error) ||
    message.includes("unmatched braces") ||
    message.includes("truncated at max_tokens") ||
    message.includes("did not return a valid json") ||
    message.includes("did not return a json object") ||
    message.includes("missing required draft section")
  );
}

function normalizeText(value?: string | null, maxLength = TEXT_PREVIEW_LIMIT) {
  const trimmed = (value ?? "").replace(/\s+/g, " ").trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength)}…` : trimmed;
}

export function normalizeUploadMimeType(fileName: string, mimeType: string) {
  const normalizedMimeType = mimeType.trim().toLowerCase();
  const extension = fileName.split(".").pop()?.trim().toLowerCase();

  // Always trust the file extension when it maps to a known supported type,
  // because browsers/OS can misreport MIME types (e.g. PDF as image/jpeg).
  if (extension) {
    const inferredMimeType = MIME_TYPE_BY_EXTENSION[extension];
    if (inferredMimeType) {
      return inferredMimeType;
    }
  }

  if (normalizedMimeType && normalizedMimeType !== "application/octet-stream") {
    return normalizedMimeType;
  }

  return normalizedMimeType || "application/octet-stream";
}

function assertSupportedMimeType(mimeType: string) {
  if (SUPPORTED_UPLOAD_TYPES.has(mimeType)) return;
  if (mimeType.startsWith("text/")) return;

  throw new TRPCError({
    code: "BAD_REQUEST",
    message: `Unsupported file type: ${mimeType}`,
  });
}

/** Strip a leading data-URL prefix (e.g. "data:application/pdf;base64,") if present. */
function stripDataUrlPrefix(value: string): string {
  const commaIdx = value.indexOf(",");
  if (commaIdx !== -1 && value.slice(0, commaIdx).includes(";base64")) {
    return value.slice(commaIdx + 1);
  }
  return value;
}

/** Validate that a string is a plausible base64 payload before handing it to Buffer. */
function assertValidBase64(value: string): void {
  const trimmed = value.trim();
  // Allow standard and URL-safe base64 characters plus padding.
  // Reject immediately if the trimmed payload contains characters outside that set
  // (Buffer.from silently discards invalid chars, which can mask corrupt uploads).
  if (!/^[A-Za-z0-9+/\-_]+=*$/.test(trimmed)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "The uploaded file content is not valid base64. Please re-select the file and try again.",
    });
  }
}

function decodeBase64Document(base64Content: string) {
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

function normalizeClassifierText(value?: string | null) {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9ά-ώα-ω\s]/gi, " ").replace(/\s+/g, " ").trim();
}

function guessTitleFromFileName(fileName: string) {
  return fileName
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function inferCaseDocumentType(fileName: string, extractedText?: string | null): InferredCaseDocumentType {
  const haystack = normalizeClassifierText(`${fileName} ${extractedText ?? ""}`);

  if (/(judgment|judgement|decision|sentence|ruling|απόφαση|διατακτικό)/.test(haystack)) return "decision";
  if (/(evidence|exhibit|invoice|receipt|photo|photograph|medical|forensic|report|contract|email|message|attachment|proof|αποδεικ|έκθεση|τιμολόγιο|φωτογραφ|σύμβαση)/.test(haystack)) return "evidence";
  if (/(claim|complaint|petition|motion|appeal|application|brief|statement of claim|lawsuit|αγωγ|έφεσ|αίτησ|προσφυγ|υπόμνημα)/.test(haystack)) return "pleading";
  if (/(statute|law|article|directive|regulation|precedent|case law|νομο|άρθρ|κανονισμ|νομολογ)/.test(haystack)) return "reference";
  if (/(annex|appendix|schedule|supporting|certificate|declaration|affidavit|βεβαίωση|παράρτημα|δήλωση)/.test(haystack)) return "supporting";

  return "other";
}

export function inferKnowledgeDocumentType(fileName: string, extractedText?: string | null): InferredKnowledgeDocumentType {
  const haystack = normalizeClassifierText(`${fileName} ${extractedText ?? ""}`);

  if (/(statute|law no|code of|act no|νόμος|κώδικ|άρθρ)/.test(haystack)) return "statute";
  if (/(regulation|directive|ministerial|decree|ordinance|κανονισμ|οδηγί|διάταγμα|υπουργικ)/.test(haystack)) return "regulation";
  if (/(precedent|case law|court of|supreme court|appeal court|νομολογ|δικαστ|αρεοπαγ|συμβουλ)/.test(haystack)) return "precedent";
  if (/(guide|manual|commentary|memo|article|reference|treatise|notice|circular|εγκύκλιο|οδηγ|γνωμοδότηση|σχόλιο)/.test(haystack)) return "reference";

  return "other";
}

async function classifyCaseUploadedDocument(file: BatchUploadFileInput) {
  const normalizedMimeType = normalizeUploadMimeType(file.fileName, file.mimeType);
  assertSupportedMimeType(normalizedMimeType);
  const buffer = decodeBase64Document(file.base64Content);
  const extractedText = await extractSearchableText(file.fileName, normalizedMimeType, buffer);
  const inferredTitle = (file.title?.trim() || guessTitleFromFileName(file.fileName) || file.fileName).slice(0, 255);
  const inferredType: InferredCaseDocumentType = inferCaseDocumentType(file.fileName, extractedText);
  return { inferredTitle, inferredType, extractedText, sizeBytes: buffer.length } as const;
}

async function classifyKnowledgeUploadedDocument(file: BatchUploadFileInput) {
  const normalizedMimeType = normalizeUploadMimeType(file.fileName, file.mimeType);
  assertSupportedMimeType(normalizedMimeType);
  const buffer = decodeBase64Document(file.base64Content);
  const extractedText = await extractSearchableText(file.fileName, normalizedMimeType, buffer);
  const inferredTitle = (file.title?.trim() || guessTitleFromFileName(file.fileName) || file.fileName).slice(0, 255);
  const inferredType: InferredKnowledgeDocumentType = inferKnowledgeDocumentType(file.fileName, extractedText);
  return { inferredTitle, inferredType, extractedText, sizeBytes: buffer.length } as const;
}

export function computeHash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function extractSearchableText(fileName: string, mimeType: string, buffer: Buffer) {
  if (mimeType === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    return normalizeText(parsed.text, 80_000);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const parsed = await mammoth.extractRawText({ buffer });
    return normalizeText(parsed.value, 80_000);
  }

  if (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    fileName.endsWith(".md") ||
    fileName.endsWith(".txt") ||
    fileName.endsWith(".html")
  ) {
    return normalizeText(buffer.toString("utf8"), 80_000);
  }

  return "";
}

function inferKnowledgeTypeLabel(value: string) {
  switch (value) {
    case "statute":
      return "Statute";
    case "regulation":
      return "Regulation";
    case "precedent":
      return "Precedent";
    case "reference":
      return "Reference";
    default:
      return "Document";
  }
}

export function buildProviderEndpoint(input: {
  providerType: ProviderType;
  endpoint: string;
  model: string;
  azureApiVersion?: string | null;
}) {
  const endpoint = input.endpoint.trim().replace(/\/$/, "");

  if (input.providerType === "azure_openai") {
    const apiVersion = input.azureApiVersion?.trim() || "2024-10-21";
    let base = endpoint;
    if (!base.includes("/openai/deployments/")) {
      base = `${endpoint}/openai/deployments/${encodeURIComponent(input.model)}`;
    }
    if (!base.endsWith("/chat/completions")) {
      base = `${base}/chat/completions`;
    }
    const url = new URL(base);
    if (!url.searchParams.get("api-version")) {
      url.searchParams.set("api-version", apiVersion);
    }
    return url.toString();
  }

  if (endpoint.endsWith("/chat/completions")) {
    return endpoint;
  }

  return `${endpoint}/chat/completions`;
}

async function resolveProviderApiKeyForTest(input: TestProviderConnectionInput) {
  const directApiKey = input.apiKey?.trim();
  if (directApiKey) {
    return directApiKey;
  }

  if (!input.id) {
    return null;
  }

  const current = await getAiProviderSettingById(input.id);
  if (!current) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Provider settings not found" });
  }

  return decryptProviderApiKey(current.apiKeyEncrypted);
}

export async function testProviderConnectivity(input: TestProviderConnectionInput) {
  const apiKey = await resolveProviderApiKeyForTest(input);
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Provide an API key or edit a saved provider that already has one.",
    });
  }

  const endpoint = buildProviderEndpoint({
    providerType: input.providerType,
    endpoint: input.endpoint,
    model: input.model,
    azureApiVersion: input.azureApiVersion,
  });

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (input.providerType === "azure_openai") {
    headers["api-key"] = apiKey;
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }

  await assertSafeUrl(endpoint);

  const startedAt = Date.now();
  const response = await postProviderChatCompletion(endpoint, headers, {
    model: input.model.trim(),
    temperature: 0,
    max_tokens: 8,
    messages: [
      { role: "system", content: "You are a provider connectivity test. Reply with the single word OK." },
      { role: "user", content: "Reply with OK." },
    ],
  });

  const elapsedMs = Date.now() - startedAt;
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const responsePreview = normalizeText(body.choices?.[0]?.message?.content, 200) || "Connection successful.";

  return {
    ok: true as const,
    providerType: input.providerType,
    model: input.model.trim(),
    endpoint,
    latencyMs: elapsedMs,
    responsePreview,
    usedSavedApiKey: !input.apiKey?.trim() && Boolean(input.id),
    message: `Connection successful in ${elapsedMs}ms.`,
  };
}

/**
 * Fix two classes of malformed JSON that DeepSeek/Kimi produce with Greek text:
 *
 * 1. Bare control characters (U+0000–U+001F) inside string values — these are
 *    illegal in JSON strings and must be escaped.
 *
 * 2. Unescaped double-quotes that appear *inside* a JSON string value.
 *    DeepSeek occasionally emits Greek text like:
 *      "text": "ο διαθέτης "απεβίωσε" στις 15/03/2026"
 *    where the inner quotes are raw " characters rather than \".  We detect
 *    this by checking whether a " that does not follow a \ is followed by a
 *    character that cannot legally start a new JSON token (i.e. it is not
 *    whitespace, ',', ':', '}', ']', or end-of-input).  If so, it is an
 *    unescaped inner quote and we replace it with \".
 */
function sanitizeJsonControlChars(input: string): string {
  let out = "";
  let inString = false;
  let escape = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (inString) {
      if (escape) {
        out += ch;
        escape = false;
        continue;
      }

      if (ch === "\\") {
        out += ch;
        escape = true;
        continue;
      }

      if (ch === '"') {
        // Look ahead: is the next non-space char a valid JSON structural token?
        // If yes, this quote legitimately ends the string value.
        // If no, it is an unescaped inner quote — escape it.
        let j = i + 1;
        while (j < input.length && /\s/.test(input[j])) j++;
        const next = input[j] ?? "";
        const isStructural = next === "" || next === "," || next === ":" || next === "}" || next === "]";
        if (isStructural) {
          out += ch;
          inString = false;
        } else {
          // Inner unescaped quote — escape it
          out += '\\"';
        }
        continue;
      }

      const code = ch.charCodeAt(0);
      if (code < 0x20) {
        if (ch === "\n") out += "\\n";
        else if (ch === "\r") out += "\\r";
        else if (ch === "\t") out += "\\t";
        else if (ch === "\b") out += "\\b";
        else if (ch === "\f") out += "\\f";
        else out += "\\u" + code.toString(16).padStart(4, "0");
        continue;
      }

      out += ch;
      continue;
    }

    if (ch === '"') inString = true;
    out += ch;
  }

  return out;
}

/**
 * Best-effort repair for JSON objects that were truncated mid-generation
 * (e.g. because the model hit max_tokens).  Closes any unclosed strings,
 * arrays, and objects so that JSON.parse has the best possible chance of
 * succeeding.  The result is semantically incomplete but structurally valid,
 * which lets extractJsonObject + validateAndNormalizeDraftOutput fill in
 * the gaps with fallbacks.
 */
function repairTruncatedJson(raw: string): string {
  let s = raw.trimEnd();

  // Close any unclosed string first
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { if (inString) escape = true; continue; }
    if (ch === '"') inString = !inString;
  }
  if (inString) s += '"';

  // Count unmatched structural brackets/braces
  const stack: string[] = [];
  inString = false;
  escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { if (inString) escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}") { if (stack[stack.length - 1] === "{") stack.pop(); }
    else if (ch === "]") { if (stack[stack.length - 1] === "[") stack.pop(); }
  }

  // Strip trailing commas before we close (avoids ",}" which is also invalid)
  s = s.replace(/,\s*$/, "");

  // Close in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    s += stack[i] === "{" ? "}" : "]";
  }

  return s;
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();

  // Try to extract JSON from markdown code block first
  const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    const inside = codeBlockMatch[1].trim();
    if (inside.startsWith("{")) return inside;
  }

  if (trimmed.startsWith("{")) return trimmed;

  const firstBrace = trimmed.indexOf("{");
  if (firstBrace === -1) {
    throw new Error("Provider did not return a JSON object");
  }

  let inString = false;
  let escape = false;
  let depth = 0;
  for (let i = firstBrace; i < trimmed.length; i++) {
    const char = trimmed[i];
    if (inString) {
      if (escape) escape = false;
      else if (char === "\\") escape = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === "{") depth++;
    else if (char === "}") {
      depth--;
      if (depth === 0) return trimmed.slice(firstBrace, i + 1);
    }
  }

  // depth > 0 means the JSON was truncated mid-object (hit max_tokens).
  // Return everything from the first brace — repairTruncatedJson will close it.
  if (depth > 0) {
    console.warn(`[LLM] extractJsonObject: unmatched braces (depth=${depth}), returning partial for repair`);
    return trimmed.slice(firstBrace);
  }

  throw new Error("Provider did not return a valid JSON object (unmatched braces)");
}

/**
 * Parse a provider JSON response with layered fallbacks:
 *  1. Extract the JSON object substring, sanitize control chars, then parse.
 *  2. On SyntaxError, attempt repairTruncatedJson and retry.
 *  3. If still failing, throw so the caller can trigger a compact retry.
 */
function parseProviderJson<T>(content: string): T {
  const extracted = extractJsonObject(content);
  const sanitized = sanitizeJsonControlChars(extracted);

  try {
    return JSON.parse(sanitized) as T;
  } catch (firstError) {
    // Attempt structural repair (closes truncated strings, arrays, objects)
    try {
      const repaired = repairTruncatedJson(sanitized);
      console.warn("[LLM] parseProviderJson: initial parse failed, succeeded after repair");
      return JSON.parse(repaired) as T;
    } catch {
      // Re-throw the original error so isRetryableGenerationError can see it
      throw firstError;
    }
  }
}

/**
 * Check if an IP address is private/internal
 * Handles both IPv4 and IPv6, including IPv6-mapped IPv4 addresses
 */
function isPrivateIP(address: string): boolean {
  const normalizedAddress = address.toLowerCase();
  
  // Handle IPv6-mapped IPv4 addresses (::ffff:127.0.0.1)
  const ipv4Match = normalizedAddress.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  let checkAddress = normalizedAddress;
  
  if (ipv4Match) {
    checkAddress = ipv4Match[1];
  }
  
  // Check IPv4 private ranges
  if (/^\d+\.\d+\.\d+\.\d+$/.test(checkAddress)) {
    const parts = checkAddress.split(".").map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return true; // Invalid IP, treat as private
    }
    
    // 127.0.0.0/8 (loopback)
    if (parts[0] === 127) return true;
    // 10.0.0.0/8 (private)
    if (parts[0] === 10) return true;
    // 172.16.0.0/12 (private)
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    // 192.168.0.0/16 (private)
    if (parts[0] === 192 && parts[1] === 168) return true;
    // 169.254.0.0/16 (link-local)
    if (parts[0] === 169 && parts[1] === 254) return true;
    // 0.0.0.0/8
    if (parts[0] === 0) return true;
    // 224.0.0.0/4 (multicast)
    if (parts[0] >= 224 && parts[0] <= 239) return true;
    // 240.0.0.0/4 (reserved)
    if (parts[0] >= 240) return true;
    
    return false;
  }
  
  // Check IPv6 special ranges
  if (normalizedAddress === "::1") return true; // Loopback
  if (normalizedAddress === "::") return true; // Unspecified
  if (normalizedAddress.startsWith("fc")) return true; // ULA fc00::/7
  if (normalizedAddress.startsWith("fd")) return true; // ULA
  if (normalizedAddress.startsWith("fe80")) return true; // Link-local
  if (normalizedAddress.startsWith("::ffff:")) return true; // Already handled IPv6-mapped
  if (normalizedAddress === "64:ff9b::" || normalizedAddress.startsWith("64:ff9b:1::")) return true; // NAT64
  if (normalizedAddress.startsWith("2001:db8:")) return true; // Documentation
  if (normalizedAddress.startsWith("2001:")) return true; // Teredo tunneling
  
  // Any other IPv6 is considered potentially public
  // But for SSRF prevention, we're conservative and block unknown patterns
  return normalizedAddress.includes(":");
}

// SSRF prevention: block requests to private/internal IP ranges
async function assertSafeUrl(urlString: string) {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid provider endpoint URL: ${urlString}`);
  }
  
  const hostname = url.hostname.toLowerCase();
  
  // Block known dangerous hosts
  const blockedHosts = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "169.254.169.254",
    "metadata.google.internal",
    "metadata.azure.com",
    "metadata.google.com",
    "instance-data",
    "instance-data.latest",
  ];
  
  // Block exact matches and subdomains
  for (const blocked of blockedHosts) {
    if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
      throw new Error(`Provider endpoint is not allowed: ${hostname}`);
    }
  }
  
  // Block internal TLDs and common cloud metadata patterns
  if (
    hostname.endsWith(".internal") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".lan") ||
    hostname.includes("metadata") ||
    hostname.includes("instance-data")
  ) {
    throw new Error(`Provider endpoint uses blocked hostname pattern: ${hostname}`);
  }
  
  // Resolve DNS and check all returned addresses
  const addresses = await lookup(hostname, { all: true, family: 0 });
  for (const { address } of addresses) {
    if (isPrivateIP(address)) {
      throw new Error(`Private/internal IP address not allowed: ${address}`);
    }
  }
}

export async function invokeConfiguredModel(params: {
  providerId?: number | null;
  systemPrompt: string;
  userPrompt: string;
}) {
  const provider = params.providerId
    ? await getAiProviderSettingById(params.providerId)
    : await getActiveAiProviderSetting();

  if (!provider) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active AI provider is configured",
    });
  }

  const apiKey = decryptProviderApiKey(provider.apiKeyEncrypted);
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The selected AI provider does not have a usable API key",
    });
  }

  const endpoint = buildProviderEndpoint({
    providerType: provider.providerType as ProviderType,
    endpoint: provider.endpoint,
    model: provider.model,
    azureApiVersion: provider.azureApiVersion,
  });

  const outputSchema = {
    type: "json_schema",
    json_schema: {
      name: "judicial_draft",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["sections"],
        properties: {
          sections: {
            type: "array",
            minItems: 5,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["sectionKey", "sectionTitle", "sectionText", "paragraphs"],
              properties: {
                sectionKey: {
                  type: "string",
                  enum: REQUIRED_SECTIONS.map(section => section.key),
                },
                sectionTitle: { type: "string" },
                sectionText: { type: "string" },
                paragraphs: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["paragraphText", "rationale", "confidenceScore", "annotations"],
                    properties: {
                      paragraphText: { type: "string" },
                      rationale: { type: "string" },
                      confidenceScore: { type: "string" },
                      annotations: {
                        type: "array",
                        items: {
                          type: "object",
                          additionalProperties: false,
                          required: ["sourceType", "sourceLabel", "sourceLocator", "quotedText", "rationaleNote", "relevanceScore"],
                          properties: {
                            sourceType: {
                              type: "string",
                              enum: ["case_document", "knowledge_document", "statute", "regulation", "precedent", "reference"],
                            },
                            sourceLabel: { type: "string" },
                            sourceLocator: { type: "string" },
                            quotedText: { type: "string" },
                            rationaleNote: { type: "string" },
                            relevanceScore: { type: "string" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  } as const;

  // Providers that do not support OpenAI strict JSON schema response_format
  const usesPlainJsonInstruction =
    provider.providerType === "alibaba_cloud" ||
    provider.providerType === "kimi" ||
    provider.providerType === "deepseek";

  const plainJsonInstruction = `\n\nYou must respond with a single valid JSON object. Do not wrap the JSON in markdown code blocks. Use this exact structure:\n{\n  "sections": [\n    {\n      "sectionKey": "header",\n      "sectionTitle": "Header Title",\n      "sectionText": "Full section text here.",\n      "paragraphs": [\n        {\n          "paragraphText": "Paragraph text.",\n          "rationale": "Why this paragraph is included.",\n          "confidenceScore": "0.85",\n          "annotations": [\n            {\n              "sourceType": "case_document",\n              "sourceLabel": "Doc 1",\n              "sourceLocator": "page 3",\n              "quotedText": "relevant quote",\n              "rationaleNote": "why this source matters",\n              "relevanceScore": "0.90"\n            }\n          ]\n        }\n      ]\n    },\n    { "sectionKey": "facts", ... },\n    { "sectionKey": "issues", ... },\n    { "sectionKey": "reasoning", ... },\n    { "sectionKey": "operative_part", ... }\n  ]\n}\n\nCRITICAL: sourceType MUST be exactly one of these values: case_document, knowledge_document, statute, regulation, precedent, reference. Do not use any other value.`;

  const systemContent = usesPlainJsonInstruction
    ? `${params.systemPrompt}${plainJsonInstruction}`
    : params.systemPrompt;

  const payload: Record<string, unknown> = {
    model: provider.model,
    temperature: Number(provider.draftTemperature ?? "0.2"),
    max_tokens: provider.maxTokens ?? 8000,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: params.userPrompt },
    ],
  };

  if (!usesPlainJsonInstruction) {
    payload.response_format = outputSchema;
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (provider.providerType === "azure_openai") {
    headers["api-key"] = apiKey;
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }

  await assertSafeUrl(endpoint);

  // Use streaming for providers where middlebox idle-timeouts commonly drop the
  // TLS connection during long generations (DeepSeek/Kimi from outside CN).
  const preferStreaming =
    provider.providerType === "deepseek" ||
    provider.providerType === "kimi" ||
    provider.providerType === "alibaba_cloud";

  let content: string;
  if (preferStreaming) {
    content = await postProviderChatCompletionStreaming(endpoint, headers, payload);
  } else {
    const response = await postProviderChatCompletion(endpoint, headers, payload);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const fetched = body.choices?.[0]?.message?.content;
    if (!fetched) {
      throw new Error("AI provider returned no content");
    }
    content = fetched;
  }

  return {
    provider,
    content,
    parsed: parseProviderJson<DraftModelOutput>(content),
  };
}

/**
 * Simple text-in / text-out AI call without JSON schema enforcement.
 * Useful for general-purpose tasks like text splitting or summarization.
 */
export async function invokeSimpleModel(params: {
  providerId?: number | null;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
}): Promise<string> {
  const provider = params.providerId
    ? await getAiProviderSettingById(params.providerId)
    : await getActiveAiProviderSetting();

  if (!provider) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "No active AI provider is configured" });
  }

  const apiKey = decryptProviderApiKey(provider.apiKeyEncrypted);
  if (!apiKey) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The selected AI provider does not have a usable API key" });
  }

  const endpoint = buildProviderEndpoint({
    providerType: provider.providerType as ProviderType,
    endpoint: provider.endpoint,
    model: provider.model,
    azureApiVersion: provider.azureApiVersion,
  });

  const payload: Record<string, unknown> = {
    model: provider.model,
    temperature: 0.2,
    max_tokens: Math.min(params.maxTokens ?? 4096, provider.maxTokens ?? 8000),
    messages: [
      { role: "system", content: params.systemPrompt },
      { role: "user", content: params.userPrompt },
    ],
  };

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (provider.providerType === "azure_openai") {
    headers["api-key"] = apiKey;
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }

  await assertSafeUrl(endpoint);

  const preferStreaming =
    provider.providerType === "deepseek" ||
    provider.providerType === "kimi" ||
    provider.providerType === "alibaba_cloud";

  let content: string;
  if (preferStreaming) {
    content = await postProviderChatCompletionStreaming(endpoint, headers, payload);
  } else {
    const response = await postProviderChatCompletion(endpoint, headers, payload);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const fetched = body.choices?.[0]?.message?.content;
    if (!fetched) {
      throw new Error("AI provider returned no content");
    }
    content = fetched;
  }

  return content;
}

export function validateAndNormalizeDraftOutput(output: DraftModelOutput) {
  const byKey = new Map(output.sections.map(section => [section.sectionKey, section]));

  const normalizedSections = REQUIRED_SECTIONS.map((required, index) => {
    const section = byKey.get(required.key);
    if (!section) {
      throw new Error(`Missing required draft section: ${required.key}`);
    }

    const VALID_SOURCE_TYPES = ["case_document", "knowledge_document", "statute", "regulation", "precedent", "reference"] as const;

    const normalizedParagraphs = section.paragraphs.length
      ? section.paragraphs.map(paragraph => ({
          paragraphText: paragraph.paragraphText.trim(),
          rationale: normalizeText(paragraph.rationale ?? "", 2_000),
          confidenceScore: paragraph.confidenceScore ?? "0.500",
          annotations: (paragraph.annotations ?? []).map(annotation => ({
            sourceType: VALID_SOURCE_TYPES.includes(annotation.sourceType as any) ? annotation.sourceType : "reference",
            caseDocumentId: null,
            knowledgeDocumentId: null,
            sourceLabel: annotation.sourceLabel,
            sourceLocator: annotation.sourceLocator ?? null,
            quotedText: annotation.quotedText ?? null,
            rationaleNote: annotation.rationaleNote ?? null,
            relevanceScore: annotation.relevanceScore ?? null,
          })),
        }))
      : [
          {
            paragraphText: section.sectionText,
            rationale: "Single-paragraph fallback generated from section text.",
            confidenceScore: "0.500",
            annotations: [],
          },
        ];

    return {
      sectionKey: required.key,
      sectionTitle: section.sectionTitle?.trim() || required.title,
      sectionText: section.sectionText?.trim() || normalizedParagraphs.map(item => item.paragraphText).join("\n\n"),
      paragraphs: normalizedParagraphs,
      sectionOrder: index + 1,
    };
  });

  return normalizedSections;
}

export function buildCasePrompt(
  workspace: NonNullable<Awaited<ReturnType<typeof getCaseWorkspace>>>,
  knowledge: Awaited<ReturnType<typeof listKnowledgeDocuments>>,
  options: { compact?: boolean; styleProfile?: Record<string, unknown> | null } = {},
) {
  const caseDocumentLimit = options.compact ? 5 : Number.POSITIVE_INFINITY;
  const caseDocumentTextLimit = options.compact ? 900 : 3_000;
  const knowledgeDocumentLimit = options.compact ? 3 : 8;
  const knowledgeDocumentTextLimit = options.compact ? 600 : 2_500;
  const caseSummary = [
    `Case number: ${workspace.case.caseNumber}`,
    `Title: ${workspace.case.title}`,
    `Jurisdiction: ${workspace.case.jurisdictionCode}`,
    `Court level: ${workspace.case.courtLevel}`,
    `Case type: ${workspace.case.caseType}`,
    `Status: ${workspace.case.status}`,
    workspace.case.summary ? `Summary: ${workspace.case.summary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const parties = workspace.parties.length
    ? workspace.parties
        .map(
          party =>
            `- ${party.partyType}: ${party.name}${party.representativeName ? ` (Representative: ${party.representativeName})` : ""}`,
        )
        .join("\n")
    : "- No parties recorded";

  const caseDocuments = workspace.documents.length
    ? workspace.documents
        .slice(0, caseDocumentLimit)
        .map(document => {
          const extracted = normalizeText(document.extractedText, caseDocumentTextLimit);
          return [
            `Document ${document.id}: ${document.title}`,
            `Type: ${document.documentType}`,
            extracted ? `Extracted text: ${extracted}` : null,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n")
    : "No case documents are currently attached.";

  const knowledgeDocuments = knowledge.length
    ? knowledge
        .slice(0, knowledgeDocumentLimit)
        .map(document => {
          const extracted = normalizeText(document.extractedText, knowledgeDocumentTextLimit);
          return [
            `${inferKnowledgeTypeLabel(document.documentType)} ${document.id}: ${document.title}`,
            document.citation ? `Citation: ${document.citation}` : null,
            extracted ? `Extracted text: ${extracted}` : null,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n")
    : "No global knowledge-base documents were matched.";

  const lang = workspace.case.languageCode?.toLowerCase();
  const languageInstruction = lang && lang !== "en"
    ? `Generate the entire output in ${lang === "el" || lang === "gr" ? "Greek" : lang.toUpperCase()} language.`
    : "";

  const styleInstructions: string[] = [];
  if (options.styleProfile) {
    const sp = options.styleProfile;
    if (sp.tone) styleInstructions.push(`Match this judicial tone: ${sp.tone}.`);
    if (sp.formalityLevel) styleInstructions.push(`Formality level: ${sp.formalityLevel}.`);
    if (sp.sentenceStructure) styleInstructions.push(`Sentence structure: ${sp.sentenceStructure}.`);
    if (sp.sectionStructure) styleInstructions.push(`Section structure: ${sp.sectionStructure}.`);
    if (sp.reasoningStyle) styleInstructions.push(`Reasoning style: ${sp.reasoningStyle}.`);
    if (sp.depthLevel) styleInstructions.push(`Depth of explanation: ${sp.depthLevel}.`);
    if (sp.argumentFlow) styleInstructions.push(`Argument flow: ${sp.argumentFlow}.`);
    if (Array.isArray(sp.examplePhrases) && sp.examplePhrases.length > 0) {
      styleInstructions.push(`Common phrasing patterns: ${sp.examplePhrases.slice(0, 5).join("; ")}.`);
    }
    if (Array.isArray(sp.terminology) && sp.terminology.length > 0) {
      styleInstructions.push(`Preferred terminology: ${sp.terminology.slice(0, 5).join(", ")}.`);
    }
  }

  const systemPrompt = [
    "You are an expert drafting assistant for Greek inheritance-law (κληρονομικό δίκαιο) decisions.",
    "Produce a structured judicial decision that is precise, neutral, and grounded in the Astikos Kodikas (ΑΚ 1710 κ.ε.) and any cited Areios Pagos / appellate precedent.",
    "When relevant, address: identification of the deceased and the heirs, validity and form of the will (διαθήκη — ιδιόγραφη / δημόσια / μυστική, ΑΚ 1721 κ.ε.), the legitimate share (νόμιμη μοίρα, ΑΚ 1825 κ.ε.) and any reduction (μείωση, ΑΚ 1829 κ.ε.), acceptance or renunciation of the inheritance (αποδοχή / αποποίηση, ΑΚ 1846, 1847, 1848), the inheritance certificate (κληρονομητήριο, ΑΚ 1956), bringing-into-collation (συνεισφορά, ΑΚ 1895 κ.ε.), and the standing of each party.",
    "You must produce exactly five sections with these keys: header, facts, issues, reasoning, operative_part.",
    "Every paragraph must include a rationale and inline source annotations citing specific case documents, AK articles, or precedent.",
    "Do not invent law or evidence. If support is missing, say so clearly in the reasoning.",
    "LEGAL ACCURACY AND CASE FACTS ALWAYS OVERRIDE STYLISTIC PREFERENCES.",
    languageInstruction,
    styleInstructions.length > 0 ? `Style guidance (subordinate to legal accuracy): ${styleInstructions.join(" ")}` : null,
  ].filter(Boolean).join(" ");

  const userPrompt = [
    "Draft a judicial decision using the provided case file and permanent knowledge base.",
    options.compact ? "Use this compact context because the provider rejected the larger request. Keep the draft concise but complete." : null,
    "Return a JSON object matching the requested schema.",
    "Case summary:",
    caseSummary,
    "Parties:",
    parties,
    "Case documents:",
    caseDocuments,
    "Knowledge base materials:",
    knowledgeDocuments,
  ].join("\n\n");

  return { systemPrompt, userPrompt };
}

export function buildCaseReviewPrompt(params: {
  workspace: NonNullable<Awaited<ReturnType<typeof getCaseWorkspace>>>;
  knowledge: Awaited<ReturnType<typeof listKnowledgeDocuments>>;
  judgmentText?: string | null;
  reviewTemplateKey?: ReviewTemplateKey;
  reviewTemplateFocus?: string | null;
}) {
  const caseSummary = [
    `Case number: ${params.workspace.case.caseNumber}`,
    `Title: ${params.workspace.case.title}`,
    `Jurisdiction: ${params.workspace.case.jurisdictionCode}`,
    `Court level: ${params.workspace.case.courtLevel}`,
    `Case type: ${params.workspace.case.caseType}`,
    params.workspace.case.summary ? `Summary: ${params.workspace.case.summary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const evidenceBundle = params.workspace.documents.length
    ? params.workspace.documents
        .map(document => {
          const extracted = normalizeText(document.extractedText, 2_200);
          return [
            `Case document ${document.id}: ${document.title}`,
            `Type: ${document.documentType}`,
            `Status: ${document.uploadStatus}`,
            extracted ? `Extracted text: ${extracted}` : null,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n")
    : "No case documents are currently attached.";

  const knowledgeBundle = params.knowledge.length
    ? params.knowledge
        .slice(0, 10)
        .map(document => {
          const extracted = normalizeText(document.extractedText, 1_800);
          return [
            `${inferKnowledgeTypeLabel(document.documentType)} ${document.id}: ${document.title}`,
            document.citation ? `Citation: ${document.citation}` : null,
            extracted ? `Extracted text: ${extracted}` : null,
          ]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n\n")
    : "No knowledge-base materials are currently available.";

  const latestDraftText = params.workspace.latestDraft?.sections?.length
    ? params.workspace.latestDraft.sections.map(section => `${section.sectionTitle}\n${section.sectionText}`).join("\n\n")
    : null;

  const inferredTemplateKey: ReviewTemplateKey = "inheritance";

  const templateGuidance = {
    inheritance:
      "Focus on Greek inheritance law (κληρονομικό δίκαιο, ΑΚ 1710 κ.ε.): identification of the deceased and the legitimate heirs, validity and form of the will (διαθήκη — ιδιόγραφη / δημόσια / μυστική, ΑΚ 1721 κ.ε.), forced heirship and the legitimate share (νόμιμη μοίρα, ΑΚ 1825 κ.ε.), acceptance and renunciation of the inheritance (αποδοχή / αποποίηση, ΑΚ 1846, 1847, 1848), the inheritance certificate (κληρονομητήριο, ΑΚ 1956), bringing-into-collation (συνεισφορά, ΑΚ 1895 κ.ε.), and the standing of each party. Verify that the operative part matches the established estate composition and that the legal basis for any reduction or invalidation is properly cited.",
  } as const;

  const templateLabels = {
    inheritance: "Greek inheritance-law review template",
  } as const;

  const lang = params.workspace.case.languageCode?.toLowerCase();
  const languageInstruction = lang && lang !== "en"
    ? `Generate the entire output in ${lang === "el" || lang === "gr" ? "Greek" : lang.toUpperCase()} language.`
    : "";

  const systemPrompt = [
    "You are an expert reviewer of Greek inheritance-law decisions (κληρονομικό δίκαιο).",
    "Assess whether the proposed judgment or draft is supported by the available evidence, applicable provisions of the Astikos Kodikas (ΑΚ 1710 κ.ε.), and cited Areios Pagos / appellate precedent.",
    "Extract the decisive legal issues (validity of the will, identification of heirs, νόμιμη μοίρα, αποδοχή/αποποίηση, κληρονομητήριο, συνεισφορά), test jurisdiction and admissibility, verify whether the cited AK articles and case law appear supported by the supplied materials, separate ratio decidendi from obiter dicta, evaluate proportionality of any reduction (μείωση) or invalidation, and identify contradictions, credibility concerns, and reasoning weaknesses.",
    "Flag missing law, missing evidence, unsupported citations, distinguishable precedents, and any blockers that should prevent signature.",
    "Be neutral, rigorous, and suitable for judicial quality control.",
    "Return only the requested JSON schema.",
    languageInstruction,
  ].filter(Boolean).join(" ");

  const judgmentText = normalizeText(params.judgmentText || latestDraftText || "", 9_000) || "No draft or judgment text was provided.";

  const userPrompt = [
    "Review this judicial matter for legal and evidentiary consistency.",
    "Case summary:",
    caseSummary,
    "Selected review template:",
    `${templateLabels[inferredTemplateKey]} — ${templateGuidance[inferredTemplateKey]}`,
    params.reviewTemplateFocus ? `Additional review focus: ${normalizeText(params.reviewTemplateFocus, 1200)}` : null,
    "Case-file materials:",
    evidenceBundle,
    "Applicable law and knowledge base:",
    knowledgeBundle,
    "Judgment or draft to review:",
    judgmentText,
    "Populate every section of the schema, including extracted legal issues, citation verification, contradiction mapping, credibility signals, precedent analysis, ratio decidendi versus obiter dicta, jurisdiction and admissibility, proportionality, decision quality score, and pre-signature blockers.",
    "If the record does not contain enough support, say so explicitly in missing-law, missing-evidence, findings, and pre-signature blockers.",
    "Explain whether the outcome appears supported, only partially supported, contradicted, or insufficiently grounded.",
    "Provide concise but actionable feedback for the judge.",
  ]
    .filter(Boolean)
    .join("\n\n");

  return { systemPrompt, userPrompt };
}

async function invokeConfiguredCaseReview(params: {
  providerId?: number | null;
  systemPrompt: string;
  userPrompt: string;
}) {
  const provider = params.providerId
    ? await getAiProviderSettingById(params.providerId)
    : await getActiveAiProviderSetting();

  if (!provider) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "No active AI provider is configured",
    });
  }

  const apiKey = decryptProviderApiKey(provider.apiKeyEncrypted);
  if (!apiKey) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "The selected AI provider does not have a usable API key",
    });
  }

  const endpoint = buildProviderEndpoint({
    providerType: provider.providerType as ProviderType,
    endpoint: provider.endpoint,
    model: provider.model,
    azureApiVersion: provider.azureApiVersion,
  });

  const outputSchema = {
    type: "json_schema",
    json_schema: {
      name: "case_review",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "summary",
          "outcomeAssessment",
          "confidenceScore",
          "extractedIssues",
          "findings",
          "citationChecks",
          "missingEvidence",
          "missingLaw",
          "credibilitySignals",
          "contradictions",
          "precedentAnalysis",
          "reasoningStructure",
          "jurisdictionAndAdmissibility",
          "proportionalityReview",
          "decisionQuality",
          "judgeFeedback",
          "preSignatureReview",
        ],
        properties: {
          summary: { type: "string" },
          outcomeAssessment: {
            type: "string",
            enum: ["supported", "partially_supported", "contradicted", "insufficient_basis"],
          },
          confidenceScore: { type: "string" },
          extractedIssues: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["question", "significance", "supportingSources"],
              properties: {
                question: { type: "string" },
                significance: { type: "string" },
                supportingSources: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          findings: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["category", "severity", "issue", "explanation", "supportingSources"],
              properties: {
                category: { type: "string", enum: ["law", "evidence", "procedure", "reasoning"] },
                severity: { type: "string", enum: ["high", "medium", "low"] },
                issue: { type: "string" },
                explanation: { type: "string" },
                supportingSources: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          citationChecks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["citation", "status", "note", "supportingSources"],
              properties: {
                citation: { type: "string" },
                status: { type: "string", enum: ["verified", "partially_verified", "not_verified", "not_found"] },
                note: { type: "string" },
                supportingSources: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          missingEvidence: {
            type: "array",
            items: { type: "string" },
          },
          missingLaw: {
            type: "array",
            items: { type: "string" },
          },
          credibilitySignals: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["sourceLabel", "assessment", "note", "supportingSources"],
              properties: {
                sourceLabel: { type: "string" },
                assessment: { type: "string", enum: ["strong", "mixed", "weak", "untested"] },
                note: { type: "string" },
                supportingSources: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          contradictions: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["conflict", "impact", "supportingSources"],
              properties: {
                conflict: { type: "string" },
                impact: { type: "string" },
                supportingSources: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
          precedentAnalysis: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["precedent", "relation", "principle", "note"],
              properties: {
                precedent: { type: "string" },
                relation: { type: "string", enum: ["supports", "distinguishes", "conflicts", "neutral"] },
                principle: { type: "string" },
                note: { type: "string" },
              },
            },
          },
          reasoningStructure: {
            type: "object",
            additionalProperties: false,
            required: ["ratioDecidendi", "obiterDicta"],
            properties: {
              ratioDecidendi: {
                type: "array",
                items: { type: "string" },
              },
              obiterDicta: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
          jurisdictionAndAdmissibility: {
            type: "object",
            additionalProperties: false,
            required: ["status", "note"],
            properties: {
              status: { type: "string", enum: ["clear", "uncertain", "problematic"] },
              note: { type: "string" },
            },
          },
          proportionalityReview: {
            type: "object",
            additionalProperties: false,
            required: ["status", "note"],
            properties: {
              status: { type: "string", enum: ["proportionate", "possibly_disproportionate", "insufficient_basis", "not_applicable"] },
              note: { type: "string" },
            },
          },
          decisionQuality: {
            type: "object",
            additionalProperties: false,
            required: ["score", "band", "rationale"],
            properties: {
              score: { type: "integer", minimum: 0, maximum: 100 },
              band: { type: "string", enum: ["strong", "adequate", "fragile", "critical"] },
              rationale: { type: "string" },
            },
          },
          judgeFeedback: {
            type: "array",
            items: { type: "string" },
          },
          preSignatureReview: {
            type: "object",
            additionalProperties: false,
            required: ["readyForSignature", "blockers", "recommendedActions"],
            properties: {
              readyForSignature: { type: "boolean" },
              blockers: {
                type: "array",
                items: { type: "string" },
              },
              recommendedActions: {
                type: "array",
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
  } as const;

  const usesPlainJsonInstructionReview =
    provider.providerType === "alibaba_cloud" ||
    provider.providerType === "kimi" ||
    provider.providerType === "deepseek";

  const plainReviewJsonInstruction = `\n\nYou must respond with a single valid JSON object. Do not wrap the JSON in markdown code blocks. Use this exact structure:\n{\n  "summary": "Brief summary of findings.",\n  "outcomeAssessment": "supported",\n  "confidenceScore": "0.85",\n  "extractedIssues": [\n    {\n      "question": "What is the main legal question?",\n      "significance": "Why it matters",\n      "supportingSources": ["Source 1"]\n    }\n  ],\n  "findings": [\n    {\n      "category": "law",\n      "severity": "medium",\n      "issue": "Description of the issue",\n      "explanation": "Detailed explanation",\n      "supportingSources": ["Source 1"]\n    }\n  ],\n  "citationChecks": [\n    {\n      "citation": "Citation text",\n      "status": "verified",\n      "note": "Verification note",\n      "supportingSources": ["Source 1"]\n    }\n  ],\n  "missingEvidence": ["List of missing evidence items"],\n  "missingLaw": ["List of missing law items"],\n  "credibilitySignals": [\n    {\n      "sourceLabel": "Source name",\n      "assessment": "strong",\n      "note": "Assessment note",\n      "supportingSources": ["Source 1"]\n    }\n  ],\n  "contradictions": [\n    {\n      "conflict": "Description of contradiction",\n      "impact": "Impact assessment",\n      "supportingSources": ["Source 1"]\n    }\n  ],\n  "precedentAnalysis": [\n    {\n      "precedent": "Precedent name",\n      "relation": "supports",\n      "principle": "Legal principle",\n      "note": "Analysis note"\n    }\n  ],\n  "reasoningStructure": {\n    "ratioDecidendi": ["Reasoning point 1"],\n    "obiterDicta": ["Obiter point 1"]\n  },\n  "jurisdictionAndAdmissibility": {\n    "status": "clear",\n    "note": "Jurisdiction assessment"\n  },\n  "proportionalityReview": {\n    "status": "proportionate",\n    "note": "Proportionality assessment"\n  },\n  "decisionQuality": {\n    "score": 75,\n    "band": "adequate",\n    "rationale": "Quality rationale"\n  },\n  "judgeFeedback": ["Actionable feedback item 1"],\n  "preSignatureReview": {\n    "readyForSignature": false,\n    "blockers": ["Blocker 1"],\n    "recommendedActions": ["Action 1"]\n  }\n}\n\nCRITICAL: outcomeAssessment MUST be exactly one of: supported, partially_supported, contradicted, insufficient_basis. category MUST be exactly one of: law, evidence, procedure, reasoning. severity MUST be exactly one of: high, medium, low. citation status MUST be exactly one of: verified, partially_verified, not_verified, not_found. credibility assessment MUST be exactly one of: strong, mixed, weak, untested. precedent relation MUST be exactly one of: supports, distinguishes, conflicts, neutral. jurisdiction status MUST be exactly one of: clear, uncertain, problematic. proportionality status MUST be exactly one of: proportionate, possibly_disproportionate, insufficient_basis, not_applicable. quality band MUST be exactly one of: strong, adequate, fragile, critical.`;

  const reviewSystemContent = usesPlainJsonInstructionReview
    ? `${params.systemPrompt}${plainReviewJsonInstruction}`
    : params.systemPrompt;

  const payload: Record<string, unknown> = {
    model: provider.model,
    temperature: Number(provider.draftTemperature ?? "0.2"),
    max_tokens: provider.maxTokens ?? 8000,
    messages: [
      { role: "system", content: reviewSystemContent },
      { role: "user", content: params.userPrompt },
    ],
  };

  if (!usesPlainJsonInstructionReview) {
    payload.response_format = outputSchema;
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (provider.providerType === "azure_openai") {
    headers["api-key"] = apiKey;
  } else {
    headers.authorization = `Bearer ${apiKey}`;
  }

  await assertSafeUrl(endpoint);

  const preferStreamingReview =
    provider.providerType === "deepseek" ||
    provider.providerType === "kimi" ||
    provider.providerType === "alibaba_cloud";

  let content: string;
  if (preferStreamingReview) {
    content = await postProviderChatCompletionStreaming(endpoint, headers, payload);
  } else {
    const response = await postProviderChatCompletion(endpoint, headers, payload);
    const body = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const fetched = body.choices?.[0]?.message?.content;
    if (!fetched) {
      throw new Error("AI provider returned no content");
    }
    content = fetched;
  }

  return {
    provider,
    parsed: parseProviderJson<CaseReviewOutput>(content),
  };
}

async function uploadToStorage(scope: "knowledge" | "cases" | "exports" | "judge-style", fileName: string, mimeType: string, buffer: Buffer) {
  const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return storagePut(`judge-ai/${scope}/${Date.now()}-${safeFileName}`, buffer, mimeType);
}

export async function getProviderSettingsForAdmin() {
  return listAiProviderSettings();
}

export async function saveProviderSettings(input: SaveProviderInput) {
  const current = input.id ? await getAiProviderSettingById(input.id) : null;
  const rawKey = input.apiKey?.trim() ?? "";
  const existingKey = current?.apiKeyEncrypted ?? null;

  // Validate API key presence
  if (!rawKey && !existingKey) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "An API key is required. Please provide a valid API key for this provider.",
    });
  }

  // Validate API key format when provided
  if (rawKey) {
    if (rawKey.length < 8) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The API key looks too short. Please provide a valid API key.",
      });
    }
    if (/\s/.test(rawKey)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "The API key contains whitespace. Please paste the key without extra spaces.",
      });
    }
  }

  if (!rawKey && existingKey) {
    decryptProviderApiKey(existingKey);
  }

  const encryptedApiKey = rawKey
    ? encryptSecret(rawKey)
    : existingKey;

  let saved;
  try {
    saved = await saveAiProviderSetting({
      id: input.id,
      name: input.name.trim(),
      providerType: input.providerType,
      endpoint: input.endpoint.trim(),
      model: input.model.trim(),
      apiKeyEncrypted: encryptedApiKey,
      azureApiVersion: input.azureApiVersion?.trim() || null,
      defaultSystemPrompt: input.defaultSystemPrompt?.trim() || null,
      draftTemperature: input.draftTemperature?.trim() || "0.2",
      maxTokens: input.maxTokens ?? current?.maxTokens ?? 8000,
      isActive: input.isActive ?? false,
      isArchived: input.isArchived ?? false,
      updatedBy: input.userId,
      createdBy: current?.createdBy ?? input.userId,
    } as any);
  } catch (error) {
    console.error("[ProviderSettings] Failed to save provider settings:", error);
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: userFacingErrorMessage(
        error,
        "Could not save AI provider settings. The local database schema was repaired; please restart Judge AI and try saving again.",
      ),
      cause: error,
    });
  }

  return saved;
}

export async function activateProviderSettings(providerId: number, userId: number) {
  return setActiveAiProviderSetting(providerId, userId);
}

export async function ingestKnowledgeDocument(input: UploadKnowledgeDocumentInput) {
  // Normalize once for validation and processing; store the raw client-supplied
  // MIME type in the DB row so the original upload metadata is preserved.
  const normalizedMimeType = normalizeUploadMimeType(input.fileName, input.mimeType);
  assertSupportedMimeType(normalizedMimeType);
  const buffer = decodeBase64Document(input.base64Content);
  const fileHash = computeHash(buffer);
  const duplicate = await import("./db").then(mod => mod.findKnowledgeDocumentDuplicate(fileHash));

  if (duplicate) {
    const duplicateRecord = await createKnowledgeDocument({
      title: input.title.trim(),
      documentType: input.documentType,
      jurisdictionCode: input.jurisdictionCode.trim(),
      courtLevel: input.courtLevel?.trim() || null,
      citation: input.citation?.trim() || null,
      sourceReference: input.sourceReference?.trim() || null,
      fileName: input.fileName,
      fileKey: duplicate.fileKey,
      fileUrl: duplicate.fileUrl,
      // Store the raw input MIME — normalizedMimeType is used only for
      // validation/processing above so the original value is preserved.
      mimeType: input.mimeType,
      sizeBytes: buffer.length,
      fileHash,
      processingStatus: "duplicate",
      duplicateOfDocumentId: duplicate.id,
      extractedText: duplicate.extractedText,
      metadataJson: {
        ...(input.metadataJson ?? {}),
        duplicateOfDocumentId: duplicate.id,
        normalizedMimeType,
      },
      uploadedBy: input.userId,
    });

    return {
      document: duplicateRecord,
      duplicateOf: duplicate,
    };
  }

  const upload = await uploadToStorage("knowledge", input.fileName, normalizedMimeType, buffer);
  const extractedText = await extractSearchableText(input.fileName, normalizedMimeType, buffer);
  const summary = normalizeText(extractedText, 2_500);
  const document = await createKnowledgeDocument({
    title: input.title.trim(),
    documentType: input.documentType,
    jurisdictionCode: input.jurisdictionCode.trim(),
    courtLevel: input.courtLevel?.trim() || null,
    citation: input.citation?.trim() || null,
    sourceReference: input.sourceReference?.trim() || null,
    fileName: input.fileName,
    fileKey: upload.key,
    fileUrl: upload.url,
    // Store the raw input MIME — normalizedMimeType is used only for
    // validation/processing above so the original value is preserved.
    mimeType: input.mimeType,
    sizeBytes: buffer.length,
    fileHash,
    processingStatus: "processed",
    extractedText,
    summary,
    metadataJson: input.metadataJson ? { ...input.metadataJson, normalizedMimeType } : { normalizedMimeType },
    uploadedBy: input.userId,
  });

  return {
    document,
    duplicateOf: null,
  };
}

export async function ingestCaseDocument(input: UploadCaseDocumentInput) {
  // Normalize once for validation and processing; store the raw client-supplied
  // MIME type in the DB row so the original upload metadata is preserved.
  const normalizedMimeType = normalizeUploadMimeType(input.fileName, input.mimeType);
  assertSupportedMimeType(normalizedMimeType);
  const buffer = decodeBase64Document(input.base64Content);
  const fileHash = computeHash(buffer);
  const duplicate = await import("./db").then(mod => mod.findCaseDocumentDuplicate(input.caseId, fileHash));

  if (duplicate) {
    const duplicateRecord = await createCaseDocument({
      caseId: input.caseId,
      documentType: input.documentType,
      title: input.title.trim(),
      fileName: input.fileName,
      fileKey: duplicate.fileKey,
      fileUrl: duplicate.fileUrl,
      // Store the raw input MIME — normalizedMimeType is used only for
      // validation/processing above so the original value is preserved.
      mimeType: input.mimeType,
      sizeBytes: buffer.length,
      fileHash,
      uploadStatus: "duplicate",
      duplicateOfDocumentId: duplicate.id,
      extractedText: duplicate.extractedText,
      metadataJson: {
        ...(input.metadataJson ?? {}),
        duplicateOfDocumentId: duplicate.id,
        normalizedMimeType,
      },
      uploadedBy: input.userId,
    });

    await logCaseActivity({
      caseId: input.caseId,
      actorUserId: input.userId,
      actionType: "case_document.duplicate_detected",
      entityType: "case_document",
      entityId: duplicateRecord?.id ?? duplicate.id,
      summary: `Duplicate document detected for ${input.fileName}`,
      detailsJson: { duplicateOfDocumentId: duplicate.id, title: input.title },
    });

    return {
      document: duplicateRecord,
      duplicateOf: duplicate,
    };
  }

  const upload = await uploadToStorage("cases", input.fileName, normalizedMimeType, buffer);
  const extractedText = await extractSearchableText(input.fileName, normalizedMimeType, buffer);
  const document = await createCaseDocument({
    caseId: input.caseId,
    documentType: input.documentType,
    title: input.title.trim(),
    fileName: input.fileName,
    fileKey: upload.key,
    fileUrl: upload.url,
    // Store the raw input MIME — normalizedMimeType is used only for
    // validation/processing above so the original value is preserved.
    mimeType: input.mimeType,
    sizeBytes: buffer.length,
    fileHash,
    uploadStatus: "processed",
    extractedText,
    metadataJson: input.metadataJson ? { ...input.metadataJson, normalizedMimeType } : { normalizedMimeType },
    uploadedBy: input.userId,
  });

  await logCaseActivity({
    caseId: input.caseId,
    actorUserId: input.userId,
    actionType: "case_document.uploaded",
    entityType: "case_document",
    entityId: document?.id ?? 0,
    summary: `Case document ${input.title} uploaded`,
    detailsJson: { documentType: input.documentType, title: input.title },
  });

  return {
    document,
    duplicateOf: null,
  };
}

export async function batchImportCaseDocuments(input: {
  caseId: number;
  userId: number;
  files: BatchUploadFileInput[];
}) {
  if (!input.files.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "At least one document is required for batch import" });
  }

  const results = [] as Array<{
    fileName: string;
    title: string;
    inferredType: InferredCaseDocumentType;
    duplicate: boolean;
    documentId: number | null;
  }>;

  for (const file of input.files.slice(0, 20)) {
    const classification = await classifyCaseUploadedDocument(file);
    const result = await ingestCaseDocument({
      caseId: input.caseId,
      userId: input.userId,
      title: classification.inferredTitle,
      documentType: classification.inferredType,
      fileName: file.fileName,
      mimeType: file.mimeType,
      base64Content: file.base64Content,
      metadataJson: {
        ...(file.metadataJson ?? {}),
        ingestionMode: "batch",
        autoClassification: {
          inferredTitle: classification.inferredTitle,
          inferredType: classification.inferredType,
          extractedPreview: normalizeText(classification.extractedText, 600),
        },
      },
    });

    results.push({
      fileName: file.fileName,
      title: classification.inferredTitle,
      inferredType: classification.inferredType,
      duplicate: Boolean(result.duplicateOf),
      documentId: result.document?.id ?? null,
    });
  }

  await logCaseActivity({
    caseId: input.caseId,
    actorUserId: input.userId,
    actionType: "case_document.uploaded",
    entityType: "case",
    entityId: input.caseId,
    summary: `Batch import completed for ${results.length} case document(s)`,
    detailsJson: { batchResults: results },
  });

  return {
    results,
    importedCount: results.filter(item => !item.duplicate).length,
    duplicateCount: results.filter(item => item.duplicate).length,
  };
}

export async function batchImportKnowledgeDocuments(input: {
  userId: number;
  jurisdictionCode: string;
  files: BatchUploadFileInput[];
  courtLevel?: string | null;
}) {
  if (!input.files.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "At least one document is required for batch import" });
  }

  const results = [] as Array<{
    fileName: string;
    title: string;
    inferredType: InferredKnowledgeDocumentType;
    duplicate: boolean;
    documentId: number | null;
  }>;

  for (const file of input.files.slice(0, 20)) {
    const classification = await classifyKnowledgeUploadedDocument(file);
    const result = await ingestKnowledgeDocument({
      userId: input.userId,
      title: classification.inferredTitle,
      documentType: classification.inferredType,
      jurisdictionCode: input.jurisdictionCode.trim(),
      courtLevel: input.courtLevel?.trim() || null,
      citation: null,
      sourceReference: null,
      fileName: file.fileName,
      mimeType: file.mimeType,
      base64Content: file.base64Content,
      metadataJson: {
        ...(file.metadataJson ?? {}),
        ingestionMode: "batch",
        autoClassification: {
          inferredTitle: classification.inferredTitle,
          inferredType: classification.inferredType,
          extractedPreview: normalizeText(classification.extractedText, 600),
        },
      },
    });

    results.push({
      fileName: file.fileName,
      title: classification.inferredTitle,
      inferredType: classification.inferredType,
      duplicate: Boolean(result.duplicateOf),
      documentId: result.document?.id ?? null,
    });
  }

  // Knowledge documents are not tied to a specific case, so we log to
  // case_activity_logs using caseId = 0 as a sentinel. If strict FK
  // enforcement is needed, create a separate knowledge_activity_logs table.
  try {
    await import("./db").then(mod => mod.logCaseActivity({
      caseId: 0,
      actorUserId: input.userId,
      actionType: "knowledge_document.batch_uploaded",
      entityType: "knowledge",
      entityId: 0,
      summary: `Batch import completed for ${results.length} knowledge document(s)`,
      detailsJson: { batchResults: results, jurisdictionCode: input.jurisdictionCode },
    }));
  } catch {
    // Best-effort logging — do not fail the batch import if audit log fails
  }

  return {
    results,
    importedCount: results.filter(item => !item.duplicate).length,
    duplicateCount: results.filter(item => item.duplicate).length,
  };
}

// ============================================================================
// Judge Style Module
// ============================================================================

export type UploadJudgeStyleJudgmentInput = {
  profileId: number;
  userId: number;
  title: string;
  fileName: string;
  mimeType: string;
  base64Content: string;
  caseType?: string | null;
  jurisdictionCode?: string | null;
  judgmentDate?: Date | null;
  tags?: string[] | null;
  splitMode?: boolean;
};

async function splitDocumentIntoJudgments(extractedText: string): Promise<Array<{ title: string; text: string }>> {
  const systemPrompt = `You are a legal document analyst. Split the provided text into individual judicial decisions/judgments.
Return ONLY a valid JSON array with no markdown formatting.
Each element must have exactly two fields: "title" (case name or short description) and "text" (the full text of that judgment).
If the document contains only one judgment, return an array with one element.
Example: [{"title":"Case A","text":"full text..."},{"title":"Case B","text":"full text..."}]`;

  const userPrompt = `Split the following document into individual judgments and return them as a JSON array:

${extractedText.length > 25_000 ? extractedText.slice(0, 25_000) + "\n...[truncated]" : extractedText}`;

  const raw = await invokeSimpleModel({ systemPrompt, userPrompt, maxTokens: 4096 });

  let parsed: Array<{ title?: string; text?: string }>;
  try {
    parsed = parseProviderJson<Array<{ title?: string; text?: string }>>(raw);
  } catch {
    // Try to extract JSON array directly
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      parsed = JSON.parse(sanitizeJsonControlChars(repairTruncatedJson(match[0]))) as Array<{ title?: string; text?: string }>;
    } else {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse judgment split result" });
    }
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI returned no judgments from the document" });
  }

  return parsed
    .filter(item => item.text && item.text.trim().length > 50)
    .map((item, idx) => ({
      title: item.title?.trim() || `Judgment ${idx + 1}`,
      text: item.text!.trim(),
    }));
}

export async function ingestJudgeStyleJudgment(input: UploadJudgeStyleJudgmentInput) {
  const normalizedMimeType = normalizeUploadMimeType(input.fileName, input.mimeType);
  assertSupportedMimeType(normalizedMimeType);
  const buffer = decodeBase64Document(input.base64Content);
  const upload = await uploadToStorage("judge-style", input.fileName, normalizedMimeType, buffer);
  const extractedText = await extractSearchableText(input.fileName, normalizedMimeType, buffer);

  const { createJudgeStyleJudgment } = await import("./db");

  if (input.splitMode) {
    // AI-split the document into multiple judgments
    const splits = await splitDocumentIntoJudgments(extractedText);
    const created: Awaited<ReturnType<typeof createJudgeStyleJudgment>>[] = [];

    for (const split of splits) {
      const j = await createJudgeStyleJudgment({
        profileId: input.profileId,
        userId: input.userId,
        title: split.title,
        fileKey: upload.key,
        fileUrl: upload.url,
        mimeType: normalizedMimeType,
        extractedText: split.text,
        caseType: input.caseType?.trim() || null,
        jurisdictionCode: input.jurisdictionCode?.trim() || null,
        judgmentDate: input.judgmentDate ?? null,
        tagsJson: input.tags ?? null,
        analysisJson: null,
      });
      created.push(j);
    }

    await updateJudgeStyleProfile(input.profileId, {
      judgmentCount: (await listJudgeStyleJudgments(input.profileId)).length,
    });

    return { count: created.length, judgments: created };
  }

  const judgment = await createJudgeStyleJudgment({
    profileId: input.profileId,
    userId: input.userId,
    title: input.title.trim(),
    fileKey: upload.key,
    fileUrl: upload.url,
    mimeType: normalizedMimeType,
    extractedText,
    caseType: input.caseType?.trim() || null,
    jurisdictionCode: input.jurisdictionCode?.trim() || null,
    judgmentDate: input.judgmentDate ?? null,
    tagsJson: input.tags ?? null,
    analysisJson: null,
  });

  await updateJudgeStyleProfile(input.profileId, {
    judgmentCount: (await listJudgeStyleJudgments(input.profileId)).length,
  });

  return { count: 1, judgments: [judgment] };
}

export async function analyzeJudgeStyleProfile(profileId: number, userId: number, providerId?: number | null) {
  const { getJudgeStyleProfileById } = await import("./db");
  const profile = await getJudgeStyleProfileById(profileId);
  if (!profile || profile.userId !== userId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
  }

  const judgments = await listJudgeStyleJudgments(profileId);
  if (judgments.length < 3) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "At least 3 past judgments are required for style analysis" });
  }

  // Concatenate extracted texts with cap
  const combinedText = judgments
    .map(j => `--- ${j.title} ---\n${j.extractedText ?? ""}`)
    .join("\n\n");
  const truncatedText = combinedText.length > 30_000 ? combinedText.slice(0, 30_000) + "\n...[truncated]" : combinedText;

  const analysisSystemPrompt = [
    "You are a legal writing analyst. Analyze the provided judicial decisions and produce a structured style profile.",
    "Return ONLY a valid JSON object with no markdown formatting.",
    "The JSON must match this exact schema:",
    '{"tone":"string","formalityLevel":"string","sentenceStructure":"string","sectionStructure":"string","reasoningStyle":"string","argumentFlow":"string","depthLevel":"string","commonExpressions":["string"],"terminology":["string"],"examplePhrases":["string"],"confidenceScore":number}'
  ].join(" ");

  const analysisUserPrompt = [
    "Analyze the following judicial decisions and extract the judge's consistent writing style.",
    "Focus on patterns that appear across multiple documents.",
    "Be specific and concrete — include actual phrases the judge uses.",
    "Judgments:\n\n",
    truncatedText,
  ].join("\n\n");

  const result = await invokeConfiguredModel({
    providerId,
    systemPrompt: analysisSystemPrompt,
    userPrompt: analysisUserPrompt,
  });

  let parsed: Record<string, unknown>;
  try {
    parsed = parseProviderJson<Record<string, unknown>>(result.content);
  } catch {
    const jsonMatch = result.content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      parsed = JSON.parse(sanitizeJsonControlChars(repairTruncatedJson(jsonMatch[1])));
    } else {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to parse style analysis result" });
    }
  }

  const confidenceScore = typeof parsed.confidenceScore === "number" ? Math.round(parsed.confidenceScore) : 0;

  await updateJudgeStyleProfile(profileId, {
    profileJson: parsed,
    minConfidenceScore: confidenceScore,
    status: "active",
  });

  return { profileId, confidenceScore, judgmentCount: judgments.length };
}

export async function generateStructuredDraft(input: {
  caseId: number;
  userId: number;
  userRole: "judge" | "admin";
  providerId?: number | null;
  profileId?: number | null;
}) {
  const workspace = await getCaseWorkspace(input.caseId, { id: input.userId, role: input.userRole });
  if (!workspace) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Case was not found" });
  }

  // Fetch judge style profile if specified or if user has an active one
  let styleProfile: Record<string, unknown> | null = null;
  try {
    const { getJudgeStyleProfileById, getActiveJudgeStyleProfile } = await import("./db");
    if (input.profileId) {
      const profile = await getJudgeStyleProfileById(input.profileId);
      if (profile && profile.userId === input.userId && profile.status === "active" && profile.judgmentCount >= 3) {
        styleProfile = (profile.profileJson as Record<string, unknown>) ?? null;
      }
    } else {
      const activeProfile = await getActiveJudgeStyleProfile(input.userId);
      if (activeProfile && activeProfile.judgmentCount >= 3) {
        styleProfile = (activeProfile.profileJson as Record<string, unknown>) ?? null;
      }
    }
  } catch {
    // Best-effort style profile loading — do not fail draft generation if profile loading fails
  }

  const job = await createProcessingJob({
    jobType: "draft_generation",
    targetEntityType: "draft",
    targetEntityId: input.caseId,
    caseId: input.caseId,
    status: "running",
    payloadJson: { providerId: input.providerId ?? null, profileId: input.profileId ?? null, styleActive: Boolean(styleProfile) },
    resultJson: { stage: "preparing", message: "Preparing case workspace and legal context..." },
    createdBy: input.userId,
  });

  // Run the long-running generation in the background so the HTTP response
  // returns immediately. This prevents browser/proxy timeouts from aborting
  // the request while the AI provider is still generating.
  (async () => {
    try {
      const knowledge = await listKnowledgeDocuments({
        jurisdictionCode: workspace.case.jurisdictionCode,
        query: `${workspace.case.caseType} ${workspace.case.title}`,
      });
      await updateProcessingJob(job.id, {
        resultJson: { stage: "analyzing", message: "Analyzing case documents and legal principles..." },
      });
      let prompt = buildCasePrompt(workspace, knowledge, { styleProfile });
      let providerResult;
      await updateProcessingJob(job.id, {
        resultJson: { stage: "generating", message: "Generating structured decision draft..." },
      });
      try {
        providerResult = await invokeConfiguredModel({
          providerId: input.providerId,
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
        });
      } catch (error) {
        if (!isRetryableGenerationError(error)) {
          throw error;
        }

        await updateProcessingJob(job.id, {
          resultJson: { stage: "retrying", message: "Retrying with compact context due to provider output issue..." },
        });
        prompt = buildCasePrompt(workspace, knowledge, { compact: true, styleProfile });
        providerResult = await invokeConfiguredModel({
          providerId: input.providerId,
          systemPrompt: prompt.systemPrompt,
          userPrompt: prompt.userPrompt,
        });
      }

      await updateProcessingJob(job.id, {
        resultJson: { stage: "validating", message: "Validating and structuring draft output..." },
      });
      const sections = validateAndNormalizeDraftOutput(providerResult.parsed);
      await updateProcessingJob(job.id, {
        resultJson: { stage: "saving", message: "Saving draft sections and paragraphs..." },
      });
      const draft = await createDraftWithSections({
        caseId: input.caseId,
        createdBy: input.userId,
        providerSettingId: providerResult.provider.id,
        generationMode: "ai",
        generatedByJobId: job.id,
        generationPromptSnapshot: prompt.userPrompt,
        sections,
      });

      await updateProcessingJob(job.id, {
        status: "completed",
        resultJson: {
          draftId: draft?.id ?? null,
          providerId: providerResult.provider.id,
        },
      });

      await logCaseActivity({
        caseId: input.caseId,
        actorUserId: input.userId,
        actionType: "draft.generated",
        entityType: "draft",
        entityId: draft?.id ?? 0,
        summary: `AI draft version ${draft?.versionNo ?? ""} generated`,
        detailsJson: {
          providerId: providerResult.provider.id,
          model: providerResult.provider.model,
        },
      });
    } catch (error) {
      await updateProcessingJob(job.id, {
        status: "failed",
        errorMessage: userFacingErrorMessage(
          error,
          "Draft generation failed while reading or writing local database records.",
        ),
      });
      console.error("[DraftGeneration] Background generation failed for job", job.id, ":", error);
    }
  })();

  return { jobId: job.id };
}

export async function updateDraftParagraphWithAudit(input: {
  paragraphId: number;
  caseId: number;
  userId: number;
  paragraphText?: string;
  rationale?: string | null;
  confidenceScore?: string | null;
  reviewStatus?: "draft" | "reviewed" | "approved";
  annotations?: DraftAnnotation[];
}) {
  const paragraph = await updateDraftParagraph(input.paragraphId, {
    paragraphText: input.paragraphText,
    rationale: input.rationale,
    confidenceScore: input.confidenceScore,
    reviewStatus: input.reviewStatus,
    editedBy: input.userId,
    annotations: input.annotations,
  });

  await logCaseActivity({
    caseId: input.caseId,
    actorUserId: input.userId,
    actionType: "draft.paragraph_updated",
    entityType: "draft_paragraph",
    entityId: input.paragraphId,
    summary: "Draft paragraph updated",
    detailsJson: {
      reviewStatus: input.reviewStatus ?? null,
      hasAnnotations: Boolean(input.annotations?.length),
    },
  });

  return paragraph;
}

export async function updateDraftSectionReview(input: {
  sectionId: number;
  caseId: number;
  userId: number;
  reviewStatus: "draft" | "reviewed" | "approved";
  sectionText?: string;
}) {
  const section = await updateDraftSection(input.sectionId, {
    sectionText: input.sectionText,
    reviewStatus: input.reviewStatus,
    lastEditedBy: input.userId,
    approvedBy: input.reviewStatus === "approved" ? input.userId : null,
    approvedAt: input.reviewStatus === "approved" ? new Date() : null,
  });

  await logCaseActivity({
    caseId: input.caseId,
    actorUserId: input.userId,
    actionType: "draft.section_status_changed",
    entityType: "draft_section",
    entityId: input.sectionId,
    summary: `Draft section marked as ${input.reviewStatus}`,
    detailsJson: { reviewStatus: input.reviewStatus },
  });

  return section;
}

export async function approveDraftAndLog(input: {
  draftId: number;
  caseId: number;
  userId: number;
  userRole: "judge" | "admin";
}) {
  const workspace = await getCaseWorkspace(input.caseId, { id: input.userId, role: input.userRole });
  if (!workspace) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
  }

  const draftRecord = await getDraftById(input.draftId);
  if (!draftRecord || draftRecord.caseId !== input.caseId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found in this case" });
  }

  const user = await getUserById(input.userId);
  const autoApprove = Boolean(user?.autoApprove);

  const reviewSnapshot = await getLatestCaseReviewSnapshotForDraft(input.draftId);
  if (!reviewSnapshot && !autoApprove) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "Run and save a judicial-quality review for this draft before approval.",
    });
  }

  const approvalThreshold = await getEffectiveReviewApprovalThreshold(
    input.userId,
    inferReviewCaseTypeKey(workspace.case.caseType),
  );

  if (!autoApprove) {
    const thresholdEvaluation = evaluateReviewAgainstThreshold(
      {
        qualityScore: reviewSnapshot!.qualityScore,
        readyForSignature: reviewSnapshot!.readyForSignature,
        highSeverityCount: reviewSnapshot!.highSeverityCount,
        mediumSeverityCount: reviewSnapshot!.mediumSeverityCount,
      },
      approvalThreshold,
    );

    if (!thresholdEvaluation.passed) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Approval blocked: ${thresholdEvaluation.blockers.join(" ")}`,
      });
    }
  }

  const approvedDraft = await approveDraft(input.draftId, input.userId);
  await logCaseActivity({
    caseId: input.caseId,
    actorUserId: input.userId,
    actionType: "draft.approved",
    entityType: "draft",
    entityId: input.draftId,
    summary: "Draft approved for export",
    detailsJson: {
      draftId: input.draftId,
      reviewSnapshotId: reviewSnapshot.id,
      approvalThreshold,
    },
  });

  return {
    ...approvedDraft,
    reviewSnapshotId: reviewSnapshot.id,
    approvalThreshold,
  };
}

export function renderDraftToDocx(params: {
  draft: NonNullable<Awaited<ReturnType<typeof getDraftById>>>;
  caseNumber: string;
}) {
  const { draft, caseNumber } = params;
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: `Draft Version ${draft.versionNo}`,
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Case Number: ${caseNumber}`, italics: true })],
      spacing: { after: 200 },
    }),
  ];

  for (const section of draft.sections) {
    paragraphs.push(
      new Paragraph({
        children: [new TextRun({ text: section.sectionTitle, bold: true })],
        spacing: { before: 240, after: 120 },
      }),
    );

    for (const paragraph of section.paragraphs) {
      paragraphs.push(
        new Paragraph({
          children: [new TextRun(paragraph.paragraphText)],
          spacing: { after: 160 },
        }),
      );
    }
  }

  return new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
}

export function countReviewFindingsBySeverity(review: CaseReviewOutput) {
  return {
    highSeverityCount: review.findings.filter(item => item.severity === "high").length,
    mediumSeverityCount: review.findings.filter(item => item.severity === "medium").length,
  };
}

export function evaluateReviewAgainstThreshold(
  review: {
    qualityScore: number;
    readyForSignature: boolean;
    highSeverityCount: number;
    mediumSeverityCount: number;
  },
  threshold: ApprovalThresholdSummary,
) {
  const blockers: string[] = [];

  if (review.qualityScore < threshold.minimumQualityScore) {
    blockers.push(
      `Quality score ${review.qualityScore} is below the ${threshold.caseTypeKey} threshold of ${threshold.minimumQualityScore}.`,
    );
  }
  if (threshold.requireReadyForSignature && !review.readyForSignature) {
    blockers.push("The saved pre-signature review has not marked this draft ready for signature.");
  }
  if (review.highSeverityCount > threshold.maxHighSeverityFindings) {
    blockers.push(
      `High-severity findings (${review.highSeverityCount}) exceed the allowed limit of ${threshold.maxHighSeverityFindings}.`,
    );
  }
  if (review.mediumSeverityCount > threshold.maxMediumSeverityFindings) {
    blockers.push(
      `Medium-severity findings (${review.mediumSeverityCount}) exceed the allowed limit of ${threshold.maxMediumSeverityFindings}.`,
    );
  }

  return {
    passed: blockers.length === 0,
    blockers,
  };
}

export async function reviewCaseAgainstEvidence(input: {
  caseId: number;
  userId: number;
  userRole: "judge" | "admin";
  judgmentText?: string | null;
  providerId?: number | null;
  reviewTemplateKey?: ReviewTemplateKey;
  reviewTemplateFocus?: string | null;
}) {
  const workspace = await getCaseWorkspace(input.caseId, { id: input.userId, role: input.userRole });
  if (!workspace) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
  }

  const knowledge = (await listKnowledgeDocuments({
    jurisdictionCode: workspace.case.jurisdictionCode,
  })).slice(0, 12);

  const job = await createProcessingJob({
    jobType: "section_regeneration",
    targetEntityType: "draft",
    targetEntityId: workspace.latestDraft?.id ?? input.caseId,
    caseId: input.caseId,
    status: "running",
    payloadJson: {
      providerId: input.providerId ?? null,
      operation: "case_review",
      reviewTemplateKey: input.reviewTemplateKey ?? null,
    },
    createdBy: input.userId,
  });

  try {
    const prompt = buildCaseReviewPrompt({
      workspace,
      knowledge,
      judgmentText: input.judgmentText,
      reviewTemplateKey: input.reviewTemplateKey,
      reviewTemplateFocus: input.reviewTemplateFocus,
    });
    const review = await invokeConfiguredCaseReview({
      providerId: input.providerId,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
    });
    const latestDraftText =
      workspace.latestDraft?.sections
        .map(section => section.sectionText)
        .filter(sectionText => Boolean(sectionText?.trim().length))
        .join("\n\n") ?? null;
    const caseTypeKey = input.reviewTemplateKey ?? inferReviewCaseTypeKey(workspace.case.caseType);
    const severityCounts = countReviewFindingsBySeverity(review.parsed);
    const approvalThreshold = await getEffectiveReviewApprovalThreshold(input.userId, caseTypeKey);
    const thresholdEvaluation = evaluateReviewAgainstThreshold(
      {
        qualityScore: review.parsed.decisionQuality.score,
        readyForSignature: review.parsed.preSignatureReview.readyForSignature,
        ...severityCounts,
      },
      approvalThreshold,
    );
    const snapshot = await createCaseReviewSnapshot({
      caseId: input.caseId,
      draftId: workspace.latestDraft?.id ?? null,
      draftVersionNo: workspace.latestDraft?.versionNo ?? null,
      reviewTemplateKey: caseTypeKey,
      reviewTemplateFocus: input.reviewTemplateFocus ?? null,
      judgmentTextSnapshot: input.judgmentText?.trim() || latestDraftText || null,
      outcomeAssessment: review.parsed.outcomeAssessment,
      confidenceScore: review.parsed.confidenceScore,
      qualityScore: review.parsed.decisionQuality.score,
      readyForSignature: review.parsed.preSignatureReview.readyForSignature,
      highSeverityCount: severityCounts.highSeverityCount,
      mediumSeverityCount: severityCounts.mediumSeverityCount,
      providerSettingId: review.provider.id,
      resultJson: review.parsed as unknown as Record<string, unknown>,
      createdBy: input.userId,
    });

    await updateProcessingJob(job?.id ?? 0, {
      status: "completed",
      resultJson: {
        reviewSnapshotId: snapshot?.id ?? null,
        outcomeAssessment: review.parsed.outcomeAssessment,
        findingsCount: review.parsed.findings.length,
        qualityScore: review.parsed.decisionQuality.score,
        readyForSignature: review.parsed.preSignatureReview.readyForSignature,
        providerId: review.provider.id,
        thresholdPassed: thresholdEvaluation.passed,
      },
    });

    await logCaseActivity({
      caseId: input.caseId,
      actorUserId: input.userId,
      actionType: "case.review_generated",
      entityType: "case",
      entityId: input.caseId,
      summary: `Case review generated with assessment ${review.parsed.outcomeAssessment}`,
      detailsJson: {
        reviewSnapshotId: snapshot?.id ?? null,
        reviewedDraftId: workspace.latestDraft?.id ?? null,
        reviewedDraftVersionNo: workspace.latestDraft?.versionNo ?? null,
        providerId: review.provider.id,
        findingsCount: review.parsed.findings.length,
        qualityScore: review.parsed.decisionQuality.score,
        readyForSignature: review.parsed.preSignatureReview.readyForSignature,
        thresholdPassed: thresholdEvaluation.passed,
      },
    });

    return {
      ...review.parsed,
      reviewSnapshotId: snapshot?.id ?? null,
      reviewedDraftId: workspace.latestDraft?.id ?? null,
      reviewedDraftVersionNo: workspace.latestDraft?.versionNo ?? null,
      approvalThreshold,
      thresholdEvaluation,
    };
  } catch (error) {
    await updateProcessingJob(job?.id ?? 0, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Case review failed",
    });
    throw error;
  }
}

export async function exportDraftAsDocx(input: { draftId: number; caseId: number; userId: number; userRole?: "judge" | "admin" }) {
  const draft = await getDraftById(input.draftId);
  if (!draft || draft.caseId !== input.caseId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Draft not found in this case" });
  }

  const user = await getUserById(input.userId);
  const autoApprove = Boolean(user?.autoApprove);

  if (draft.status !== "approved") {
    if (!autoApprove) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Only approved drafts can be exported to DOCX",
      });
    }
    // Auto-approve the draft before exporting
    await approveDraft(input.draftId, input.userId);
  }

  const exportRecord = await createDecisionExport({
    caseId: input.caseId,
    draftId: input.draftId,
    format: "docx",
    status: "queued",
    requestedBy: input.userId,
  });

  const job = await createProcessingJob({
    jobType: "docx_export",
    targetEntityType: "decision_export",
    targetEntityId: exportRecord?.id ?? 0,
    caseId: input.caseId,
    status: "running",
    payloadJson: { draftId: input.draftId, exportId: exportRecord?.id ?? null },
    createdBy: input.userId,
  });

  try {
    const caseRecord = await import("./db").then(mod => mod.getCaseByIdForUser(draft.caseId, { id: input.userId, role: "admin" as const }));
    const caseNumber = caseRecord?.caseNumber ?? `Case ${draft.caseId}`;
    const document = renderDraftToDocx({ draft, caseNumber });
    const buffer = await Packer.toBuffer(document);
    const upload = await uploadToStorage(
      "exports",
      `case-${draft.caseId}-draft-${draft.versionNo}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
    );

    const updatedExport = await updateDecisionExport(exportRecord?.id ?? 0, {
      status: "ready",
      fileKey: upload.key,
      fileUrl: upload.url,
      completedAt: new Date(),
    });

    await updateProcessingJob(job?.id ?? 0, {
      status: "completed",
      resultJson: { exportId: updatedExport?.id ?? null, fileUrl: upload.url },
    });

    await logCaseActivity({
      caseId: input.caseId,
      actorUserId: input.userId,
      actionType: "decision.exported",
      entityType: "decision_export",
      entityId: updatedExport?.id ?? 0,
      summary: "Approved draft exported as DOCX",
      detailsJson: { exportId: updatedExport?.id ?? null },
    });

    return updatedExport;
  } catch (error) {
    await updateDecisionExport(exportRecord?.id ?? 0, {
      status: "failed",
    });
    await updateProcessingJob(job?.id ?? 0, {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "DOCX export failed",
    });
    throw error;
  }
}

function formatReviewTemplateLabel(_reviewTemplateKey: ReviewTemplateKey) {
  return "Greek inheritance law";
}

function formatTimestamp(value?: Date | string | null) {
  if (!value) return "Not recorded";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "Not recorded" : date.toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function listParagraphs(items: string[], fallback: string) {
  if (!items.length) {
    return [
      new Paragraph({
        children: [new TextRun(fallback)],
        spacing: { after: 120 },
      }),
    ];
  }

  return items.map(item =>
    new Paragraph({
      text: item,
      bullet: { level: 0 },
      spacing: { after: 120 },
    }),
  );
}

type ReviewReportRenderParams = {
  caseNumber: string;
  caseTitle: string;
  caseType: string;
  courtLevel: string;
  snapshotId: number;
  draftVersionNo?: number | null;
  reviewTemplateKey: ReviewTemplateKey;
  createdAt?: Date | string | null;
  review: CaseReviewOutput;
  signerName?: string | null;
  signerRoleLabel?: string | null;
  exportedAt?: Date | string | null;
};

function buildReviewReportAttestation(params: ReviewReportRenderParams) {
  const signerName = params.signerName?.trim() || "Authorized judicial reviewer";
  const signerRoleLabel = params.signerRoleLabel?.trim() || "judge";
  const exportedAt = params.exportedAt ?? new Date();
  const signatureToken = createHash("sha256")
    .update(
      JSON.stringify({
        snapshotId: params.snapshotId,
        draftVersionNo: params.draftVersionNo ?? null,
        signerName,
        signerRoleLabel,
        exportedAt: formatTimestamp(exportedAt),
        qualityScore: params.review.decisionQuality?.score ?? 0,
        readyForSignature: params.review.preSignatureReview?.readyForSignature ?? false,
        findings: params.review.findings,
      }),
    )
    .digest("hex")
    .slice(0, 24)
    .toUpperCase();

  return {
    signerName,
    signerRoleLabel,
    exportedAt,
    signatureToken,
  };
}

export function renderCaseReviewReportToDocx(params: ReviewReportRenderParams) {
  const attestation = buildReviewReportAttestation(params);
  const paragraphs: Paragraph[] = [
    new Paragraph({
      text: "Judge AI Review Report",
      heading: HeadingLevel.HEADING_1,
      spacing: { after: 240 },
    }),
    new Paragraph({
      children: [new TextRun({ text: `Case: ${params.caseTitle} (${params.caseNumber})`, bold: true })],
      spacing: { after: 120 },
    }),
    new Paragraph({
      text: `Case type: ${params.caseType} | Court level: ${params.courtLevel}`,
      spacing: { after: 120 },
    }),
    new Paragraph({
      text: `Review snapshot: #${params.snapshotId} | Draft version: ${params.draftVersionNo ?? "Manual text"}`,
      spacing: { after: 120 },
    }),
    new Paragraph({
      text: `Review template: ${formatReviewTemplateLabel(params.reviewTemplateKey)} | Generated: ${formatTimestamp(params.createdAt)}`,
      spacing: { after: 240 },
    }),
    new Paragraph({ text: "Executive Summary", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    new Paragraph({ text: params.review.summary, spacing: { after: 160 } }),
    new Paragraph({
      text: `Outcome assessment: ${params.review.outcomeAssessment} | Confidence: ${params.review.confidenceScore}`,
      spacing: { after: 160 },
    }),
    new Paragraph({
      text: `Decision quality: ${params.review.decisionQuality.score}/100 (${params.review.decisionQuality.band})`,
      spacing: { after: 160 },
    }),
    new Paragraph({ text: params.review.decisionQuality.rationale, spacing: { after: 220 } }),
    new Paragraph({ text: "Extracted Issues", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    ...listParagraphs(
      params.review.extractedIssues.map(item => `${item.question} — ${item.significance}`),
      "No extracted issues were recorded.",
    ),
    new Paragraph({ text: "Findings", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    ...listParagraphs(
      params.review.findings.map(item => `[${item.severity.toUpperCase()}] ${item.issue} — ${item.explanation}`),
      "No findings were recorded.",
    ),
    new Paragraph({ text: "Missing Evidence", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    ...listParagraphs(params.review.missingEvidence, "No missing evidence gaps were identified."),
    new Paragraph({ text: "Missing Law", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    ...listParagraphs(params.review.missingLaw, "No missing-law gaps were identified."),
    new Paragraph({ text: "Citation Verification", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    ...listParagraphs(
      params.review.citationChecks.map(item => `${item.citation} — ${item.status}: ${item.note}`),
      "No citation checks were recorded.",
    ),
    new Paragraph({ text: "Ratio Decidendi", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    ...listParagraphs(params.review.reasoningStructure.ratioDecidendi, "No ratio decidendi points were extracted."),
    new Paragraph({ text: "Obiter Dicta", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    ...listParagraphs(params.review.reasoningStructure.obiterDicta, "No obiter dicta points were extracted."),
    new Paragraph({ text: "Pre-signature Review", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    new Paragraph({
      text: params.review.preSignatureReview.readyForSignature ? "Ready for signature" : "Not ready for signature",
      spacing: { after: 120 },
    }),
    ...listParagraphs(params.review.preSignatureReview.blockers, "No blockers were recorded."),
    new Paragraph({ text: "Recommended Actions", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    ...listParagraphs(params.review.preSignatureReview.recommendedActions, "No recommended actions were recorded."),
    new Paragraph({ text: "Electronic Signature", heading: HeadingLevel.HEADING_2, spacing: { before: 160, after: 120 } }),
    new Paragraph({ text: `Signed by: ${attestation.signerName} (${attestation.signerRoleLabel})`, spacing: { after: 120 } }),
    new Paragraph({ text: `Signed at: ${formatTimestamp(attestation.exportedAt)}`, spacing: { after: 120 } }),
    new Paragraph({ text: `Signature token: ${attestation.signatureToken}`, spacing: { after: 120 } }),
  ];

  return new Document({
    sections: [
      {
        properties: {},
        children: paragraphs,
      },
    ],
  });
}

export async function renderCaseReviewReportToPdf(params: ReviewReportRenderParams) {
  const attestation = buildReviewReportAttestation(params);
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 48;
  const minY = 52;
  const baseColor = rgb(0.16, 0.16, 0.18);
  const mutedColor = rgb(0.35, 0.37, 0.41);
  let page = pdf.addPage(pageSize);
  let cursorY = pageSize[1] - margin;

  const wrapText = (text: string, size: number, font = regularFont, width = pageSize[0] - margin * 2) => {
    const lines: string[] = [];

    for (const rawParagraph of text.split(/\n/)) {
      const paragraph = rawParagraph.trim();
      if (!paragraph) {
        lines.push("");
        continue;
      }

      const words = paragraph.split(/\s+/);
      let currentLine = words.shift() ?? "";

      for (const word of words) {
        const nextLine = currentLine ? `${currentLine} ${word}` : word;
        if (font.widthOfTextAtSize(nextLine, size) <= width) {
          currentLine = nextLine;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    return lines.length ? lines : [""];
  };

  const ensureSpace = (height: number) => {
    if (cursorY - height < minY) {
      page = pdf.addPage(pageSize);
      cursorY = pageSize[1] - margin;
    }
  };

  const drawTextBlock = (
    text: string,
    options?: {
      font?: typeof regularFont;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      gapAfter?: number;
    },
  ) => {
    const font = options?.font ?? regularFont;
    const size = options?.size ?? 10;
    const color = options?.color ?? baseColor;
    const indent = options?.indent ?? 0;
    const gapAfter = options?.gapAfter ?? 8;
    const width = pageSize[0] - margin * 2 - indent;
    const lines = wrapText(text, size, font, width);
    const lineHeight = size + 4;
    ensureSpace(Math.max(1, lines.length) * lineHeight + gapAfter);

    for (const line of lines) {
      page.drawText(line || " ", {
        x: margin + indent,
        y: cursorY,
        size,
        font,
        color,
      });
      cursorY -= lineHeight;
    }

    cursorY -= gapAfter;
  };

  const drawBulletSection = (heading: string, items: string[], fallback: string) => {
    drawTextBlock(heading, { font: boldFont, size: 13, gapAfter: 8 });
    const rows = items.length ? items : [fallback];
    for (const row of rows) {
      drawTextBlock(`• ${row}`, { size: 10, indent: 10, gapAfter: 4 });
    }
    cursorY -= 6;
  };

  drawTextBlock("Judge AI Review Report", { font: boldFont, size: 18, gapAfter: 12 });
  drawTextBlock(`Case: ${params.caseTitle} (${params.caseNumber})`, { font: boldFont, size: 11, gapAfter: 6 });
  drawTextBlock(`Case type: ${params.caseType} | Court level: ${params.courtLevel}`, { color: mutedColor, gapAfter: 4 });
  drawTextBlock(`Review snapshot: #${params.snapshotId} | Draft version: ${params.draftVersionNo ?? "Manual text"}`, { color: mutedColor, gapAfter: 4 });
  drawTextBlock(`Review template: ${formatReviewTemplateLabel(params.reviewTemplateKey)} | Generated: ${formatTimestamp(params.createdAt)}`, { color: mutedColor, gapAfter: 14 });

  drawTextBlock("Executive Summary", { font: boldFont, size: 13, gapAfter: 8 });
  drawTextBlock(params.review.summary, { gapAfter: 8 });
  drawTextBlock(`Outcome assessment: ${params.review.outcomeAssessment} | Confidence: ${params.review.confidenceScore}`, { gapAfter: 6 });
  drawTextBlock(`Decision quality: ${params.review.decisionQuality.score}/100 (${params.review.decisionQuality.band})`, { gapAfter: 6 });
  drawTextBlock(params.review.decisionQuality.rationale, { gapAfter: 12 });

  drawBulletSection(
    "Extracted Issues",
    params.review.extractedIssues.map(item => `${item.question} — ${item.significance}`),
    "No extracted issues were recorded.",
  );
  drawBulletSection(
    "Findings",
    params.review.findings.map(item => `[${item.severity.toUpperCase()}] ${item.issue} — ${item.explanation}`),
    "No findings were recorded.",
  );
  drawBulletSection("Missing Evidence", params.review.missingEvidence, "No missing evidence gaps were identified.");
  drawBulletSection("Missing Law", params.review.missingLaw, "No missing-law gaps were identified.");
  drawBulletSection(
    "Citation Verification",
    params.review.citationChecks.map(item => `${item.citation} — ${item.status}: ${item.note}`),
    "No citation checks were recorded.",
  );
  drawBulletSection("Ratio Decidendi", params.review.reasoningStructure.ratioDecidendi, "No ratio decidendi points were extracted.");
  drawBulletSection("Obiter Dicta", params.review.reasoningStructure.obiterDicta, "No obiter dicta points were extracted.");
  drawBulletSection(
    "Pre-signature Blockers",
    params.review.preSignatureReview.blockers,
    params.review.preSignatureReview.readyForSignature ? "No blockers were recorded. Draft is ready for signature." : "No blockers were recorded.",
  );
  drawBulletSection(
    "Recommended Actions",
    params.review.preSignatureReview.recommendedActions,
    "No recommended actions were recorded.",
  );

  drawTextBlock("Electronic Signature", { font: boldFont, size: 13, gapAfter: 8 });
  drawTextBlock(`Signed by: ${attestation.signerName} (${attestation.signerRoleLabel})`, { gapAfter: 4 });
  drawTextBlock(`Signed at: ${formatTimestamp(attestation.exportedAt)}`, { gapAfter: 4 });
  drawTextBlock(`Signature token: ${attestation.signatureToken}`, { gapAfter: 4 });

  return Buffer.from(await pdf.save());
}

export async function getReviewApprovalThresholds(userId: number) {
  return listReviewApprovalThresholds(userId);
}

export async function saveReviewApprovalThreshold(input: {
  userId: number;
  caseTypeKey: ReviewTemplateKey;
  minimumQualityScore: number;
  requireReadyForSignature: boolean;
  maxHighSeverityFindings: number;
  maxMediumSeverityFindings: number;
}) {
  return upsertReviewApprovalThreshold({
    ownerUserId: input.userId,
    caseTypeKey: input.caseTypeKey,
    minimumQualityScore: input.minimumQualityScore,
    requireReadyForSignature: input.requireReadyForSignature,
    maxHighSeverityFindings: input.maxHighSeverityFindings,
    maxMediumSeverityFindings: input.maxMediumSeverityFindings,
  });
}

export async function exportCaseReviewReport(input: {
  caseId: number;
  reviewSnapshotId: number;
  userId: number;
  userRole: "judge" | "admin";
  format?: "docx" | "pdf";
  signerName?: string | null;
  signerRoleLabel?: string | null;
}) {
  const workspace = await getCaseWorkspace(input.caseId, { id: input.userId, role: input.userRole });
  if (!workspace) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
  }

  const snapshot = await getCaseReviewSnapshotById(input.reviewSnapshotId);
  if (!snapshot || snapshot.caseId !== input.caseId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Review snapshot not found" });
  }

  const review = snapshot.resultJson as unknown as CaseReviewOutput | null;
  if (!review) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Saved review data is unavailable for export" });
  }

  const requestedFormat = input.format ?? "docx";
  const renderParams: ReviewReportRenderParams = {
    caseNumber: workspace.case.caseNumber,
    caseTitle: workspace.case.title,
    caseType: workspace.case.caseType,
    courtLevel: workspace.case.courtLevel,
    snapshotId: snapshot.id,
    draftVersionNo: snapshot.draftVersionNo,
    reviewTemplateKey: snapshot.reviewTemplateKey as ReviewTemplateKey,
    createdAt: snapshot.createdAt,
    review,
    signerName: input.signerName ?? `User ${input.userId}`,
    signerRoleLabel: input.signerRoleLabel ?? input.userRole,
    exportedAt: new Date(),
  };

  let buffer: Buffer;
  let fileName: string;
  let mimeType: string;
  let activitySummary: string;

  if (requestedFormat === "pdf") {
    buffer = await renderCaseReviewReportToPdf(renderParams);
    fileName = `case-${input.caseId}-review-${snapshot.id}.pdf`;
    mimeType = "application/pdf";
    activitySummary = "Saved review report exported as signed PDF";
  } else {
    const document = renderCaseReviewReportToDocx(renderParams);
    buffer = await Packer.toBuffer(document);
    fileName = `case-${input.caseId}-review-${snapshot.id}.docx`;
    mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    activitySummary = "Saved review report exported as DOCX";
  }

  const upload = await uploadToStorage("exports", fileName, mimeType, buffer);

  await logCaseActivity({
    caseId: input.caseId,
    actorUserId: input.userId,
    actionType: "case.review_report_exported",
    entityType: "case_review",
    entityId: snapshot.id,
    summary: activitySummary,
    detailsJson: { reviewSnapshotId: snapshot.id, fileUrl: upload.url, format: requestedFormat },
  });

  return {
    reviewSnapshotId: snapshot.id,
    fileKey: upload.key,
    fileUrl: upload.url,
    format: requestedFormat,
  };
}

export async function getCaseTimeline(caseId: number) {
  return listCaseActivity(caseId);
}

export async function runSearch(caseId: number, query: string) {
  return searchCaseAndKnowledgeDocuments(caseId, query);
}

export async function getDownloadUrlForCaseDocument(documentId: number, caseId: number) {
  const document = await getCaseDocumentById(documentId);
  if (!document?.fileKey || document.caseId !== caseId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
  }
  return storageGet(document.fileKey);
}

export async function getDownloadUrlForKnowledgeDocument(documentId: number) {
  const document = await getKnowledgeDocumentById(documentId);
  if (!document?.fileKey) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Knowledge document not found" });
  }
  return storageGet(document.fileKey);
}

export async function getDownloadUrlForDecisionExport(exportId: number) {
  const exportRecord = await getDecisionExportById(exportId);
  if (!exportRecord?.fileKey) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Decision export not found" });
  }
  return storageGet(exportRecord.fileKey);
}

const GREEK_INHERITANCE_KNOWLEDGE_SEED: Array<{
  title: string;
  documentType: "statute" | "regulation" | "precedent" | "reference" | "other";
  citation: string;
  summary: string;
  text: string;
}> = [
  {
    title: "Αστικός Κώδικας — Έναρξη της κληρονομικής διαδοχής (ΑΚ 1710)",
    documentType: "statute",
    citation: "ΑΚ 1710",
    summary: "Με τον θάνατο του προσώπου η περιουσία του ως σύνολο (κληρονομία) μεταβιβάζεται από τον νόμο ή από διαθήκη σε ένα ή περισσότερα πρόσωπα (κληρονόμοι).",
    text: "Άρθρο 1710 ΑΚ — Με τον θάνατο προσώπου η περιουσία του ως σύνολο (κληρονομία) περιέρχεται από τον νόμο ή από διαθήκη σε ένα ή περισσότερα πρόσωπα (κληρονόμους). Η κληρονομική διαδοχή χωρεί είτε από τον νόμο (εξ αδιαθέτου διαδοχή) είτε από διαθήκη. Ο κληρονόμος υπεισέρχεται αυτοδικαίως στα δικαιώματα και στις υποχρεώσεις του κληρονομουμένου, εκτός από εκείνες που είναι αυστηρά προσωποπαγείς.",
  },
  {
    title: "Αστικός Κώδικας — Είδη διαθήκης (ΑΚ 1721)",
    documentType: "statute",
    citation: "ΑΚ 1721",
    summary: "Είδη διαθήκης κατά τον Αστικό Κώδικα: ιδιόγραφη, δημόσια και μυστική. Κάθε είδος έχει διακριτές τυπικές προϋποθέσεις εγκυρότητας.",
    text: "Άρθρο 1721 ΑΚ — Η διαθήκη συντάσσεται είτε ιδιογράφως (ιδιόγραφη διαθήκη), είτε ενώπιον συμβολαιογράφου με την παρουσία τριών μαρτύρων ή δύο συμβολαιογράφων και ενός μάρτυρα (δημόσια διαθήκη), είτε με παράδοση σφραγισμένου εγγράφου σε συμβολαιογράφο με την παρουσία τριών μαρτύρων (μυστική διαθήκη). Η ιδιόγραφη διαθήκη γράφεται ολόκληρη με το χέρι του διαθέτη, χρονολογείται και υπογράφεται από αυτόν επί ποινή ακυρότητας. Η δημόσια διαθήκη συντάσσεται με δήλωση της τελευταίας βούλησης του διαθέτη ενώπιον συμβολαιογράφου.",
  },
  {
    title: "Αστικός Κώδικας — Νόμιμη μοίρα (ΑΚ 1825)",
    documentType: "statute",
    citation: "ΑΚ 1825",
    summary: "Οι κατιόντες, οι γονείς και ο επιζών σύζυγος του κληρονομουμένου ως αναγκαίοι κληρονόμοι έχουν δικαίωμα νόμιμης μοίρας ίσης με το ήμισυ της εξ αδιαθέτου μερίδας.",
    text: "Άρθρο 1825 ΑΚ — Οι κατιόντες, οι γονείς του κληρονομουμένου, καθώς και ο σύζυγος που επιζεί, οι οποίοι θα είχαν κληθεί ως εξ αδιαθέτου κληρονόμοι, έχουν δικαίωμα νόμιμης μοίρας στην κληρονομία. Η νόμιμη μοίρα είναι το ήμισυ της εξ αδιαθέτου μερίδας. Ο νόμιμος μεριδούχος συμμετέχει ως κληρονόμος κατά το ποσοστό της νόμιμης μοίρας του. Κάθε περιορισμός που του επιβάλλεται με διαθήκη θεωρείται μη γραμμένος ως προς το ποσοστό αυτό.",
  },
  {
    title: "Αστικός Κώδικας — Μέμψη άστοργης δωρεάς και μείωση (ΑΚ 1829)",
    documentType: "statute",
    citation: "ΑΚ 1829",
    summary: "Δωρεές που έγιναν εν ζωή από τον κληρονομούμενο και θίγουν τη νόμιμη μοίρα μειώνονται στον αναγκαίο βαθμό για την αποκατάσταση του μεριδούχου.",
    text: "Άρθρο 1829 ΑΚ — Αν η νόμιμη μοίρα δεν καλύπτεται από την κληρονομία που απομένει, ο μεριδούχος μπορεί να ζητήσει την ανατροπή ή τη μείωση των δωρεών που έκανε εν ζωή ο κληρονομούμενος, εφόσον αυτές προσβάλλουν τη νόμιμη μοίρα. Οι δωρεές μειώνονται με αντίστροφη χρονολογική σειρά, αρχίζοντας από την πιο πρόσφατη. Ο μεριδούχος δικαιούται να αξιώσει την απόδοση της αξίας που θίγει τη νόμιμη μοίρα του.",
  },
  {
    title: "Αστικός Κώδικας — Αποδοχή και αποποίηση κληρονομίας (ΑΚ 1846, 1847, 1848)",
    documentType: "statute",
    citation: "ΑΚ 1846-1848",
    summary: "Ο κληρονόμος αποκτά την κληρονομία αυτοδικαίως. Η αποποίηση πρέπει να γίνει εντός τεσσάρων μηνών από τότε που ο κληρονόμος έλαβε γνώση της επαγωγής και του λόγου της.",
    text: "Άρθρο 1846 ΑΚ — Ο κληρονόμος αποκτά αυτοδικαίως την κληρονομία με τον θάνατο του κληρονομουμένου, με την επιφύλαξη του δικαιώματος αποποίησης. Άρθρο 1847 ΑΚ — Ο κληρονόμος μπορεί να αποποιηθεί την κληρονομία εντός τεσσάρων μηνών από τη στιγμή που έμαθε για την επαγωγή της κληρονομίας και τον λόγο αυτής. Η προθεσμία επεκτείνεται σε ένα έτος αν ο κληρονομούμενος είχε την τελευταία κατοικία του στην αλλοδαπή ή αν ο κληρονόμος έμαθε την επαγωγή ενώ διέμενε στην αλλοδαπή. Άρθρο 1848 ΑΚ — Η αποποίηση γίνεται με δήλωση στον γραμματέα του δικαστηρίου της κληρονομίας.",
  },
  {
    title: "Αστικός Κώδικας — Συνεισφορά μεταξύ κατιόντων (ΑΚ 1895)",
    documentType: "statute",
    citation: "ΑΚ 1895",
    summary: "Οι κατιόντες που καλούνται ως εξ αδιαθέτου κληρονόμοι υποχρεούνται να συνεισφέρουν στην κληρονομική μάζα τις παροχές που έλαβαν εν ζωή από τον κληρονομούμενο, εφόσον αυτές χαρακτηρίζονται ως προικοδοτήσεις.",
    text: "Άρθρο 1895 ΑΚ — Οι κατιόντες που γίνονται κληρονόμοι εξ αδιαθέτου ή που λαμβάνουν τη νόμιμη μοίρα οφείλουν να συνεισφέρουν προς όφελος της κληρονομικής μάζας ό,τι έλαβαν από τον κληρονομούμενο ως προίκα ή για άλλον σκοπό προικοδότησης, εκτός αν ο κληρονομούμενος όρισε ρητά το αντίθετο. Η συνεισφορά υπολογίζεται κατά την αξία που είχε η παροχή κατά τον χρόνο που δόθηκε, με αναπροσαρμογή ως τον χρόνο της κληρονομικής διαδοχής.",
  },
  {
    title: "Αστικός Κώδικας — Κληρονομητήριο (ΑΚ 1956)",
    documentType: "statute",
    citation: "ΑΚ 1956",
    summary: "Το κληρονομητήριο εκδίδεται από το ειρηνοδικείο της κληρονομίας και πιστοποιεί την ιδιότητα του κληρονόμου, την κληρονομική του μερίδα και τις τυχόν επιβαρύνσεις της κληρονομίας.",
    text: "Άρθρο 1956 ΑΚ — Με αίτηση του κληρονόμου, ο δικαστής του δικαστηρίου της κληρονομίας εκδίδει πιστοποιητικό (κληρονομητήριο) που βεβαιώνει την ιδιότητα του κληρονόμου, τη μερίδα στην κληρονομία και τις τυχόν επιβαρύνσεις και περιορισμούς που προβλέπονται από τη διαθήκη ή τον νόμο. Το κληρονομητήριο αποτελεί τίτλο νομιμοποίησης έναντι τρίτων και δημιουργεί τεκμήριο υπέρ του προσώπου που αναφέρεται σε αυτό ως κληρονόμος.",
  },
];

export async function seedGreekInheritanceKnowledgeBase(uploadedBy: number | null) {
  const existing = await listKnowledgeDocuments({ jurisdictionCode: "GR" });
  const existingTitles = new Set(existing.map(doc => doc.title));

  let createdCount = 0;
  for (const entry of GREEK_INHERITANCE_KNOWLEDGE_SEED) {
    if (existingTitles.has(entry.title)) continue;

    const buffer = Buffer.from(entry.text, "utf8");
    const fileHash = computeHash(buffer);
    const safeName = `${entry.citation.replace(/[^A-Za-z0-9]+/g, "_")}.txt`;
    const upload = await uploadToStorage("knowledge", safeName, "text/plain", buffer);

    await createKnowledgeDocument({
      title: entry.title,
      documentType: entry.documentType,
      jurisdictionCode: "GR",
      courtLevel: null,
      citation: entry.citation,
      sourceReference: "Αστικός Κώδικας — Βιβλίο Πέμπτο: Κληρονομικό Δίκαιο",
      languageCode: "el",
      fileName: safeName,
      fileKey: upload.key,
      fileUrl: upload.url,
      mimeType: "text/plain",
      sizeBytes: buffer.length,
      fileHash,
      processingStatus: "processed",
      extractedText: entry.text,
      summary: entry.summary,
      tags: ["inheritance", "Astikos Kodikas"],
      uploadedBy,
    });
    createdCount += 1;
  }

  return { createdCount, totalSeedEntries: GREEK_INHERITANCE_KNOWLEDGE_SEED.length };
}
