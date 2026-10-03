import {
  getCaseByIdForUser,
  getCaseDocumentById,
  getCaseWorkspace,
  getKnowledgeDocumentById,
  getLatestProcessingJobForCase,
  getUserByOpenId,
  listCases,
} from "../db";
import {
  generateStructuredDraft,
  reviewCaseAgainstEvidence,
  runCrossCaseSearch,
  runSearch,
} from "../judgeAiService";
import { ENV } from "../_core/env";

export type IntegrationUser = {
  id: number;
  role: "judge" | "admin";
  name: string | null;
  email: string | null;
};

export class IntegrationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly code: string = "integration_error",
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}

const MAX_DOCUMENT_CHARS = 20_000;
const DEFAULT_DOCUMENT_CHARS = 12_000;
const MAX_SEARCH_RESULTS_PER_SOURCE = 10;
const SEARCH_EXCERPT_CHARS = 2_400;

function integrationOpenId() {
  return process.env.JUDGE_AI_INTEGRATION_OPEN_ID?.trim() || ENV.ownerOpenId;
}

export async function resolveIntegrationUser(): Promise<IntegrationUser> {
  const openId = integrationOpenId();
  const user = await getUserByOpenId(openId);
  if (!user) {
    throw new IntegrationError(
      503,
      `Integration user "${openId}" does not exist. Start Judge AI once or configure JUDGE_AI_INTEGRATION_OPEN_ID.`,
      "integration_user_missing",
    );
  }
  if (user.status !== "active") {
    throw new IntegrationError(403, "The configured integration user is suspended.", "integration_user_suspended");
  }
  if (user.role !== "judge" && user.role !== "admin") {
    throw new IntegrationError(403, "The configured integration user has an unsupported role.", "integration_user_invalid_role");
  }
  return {
    id: user.id,
    role: user.role,
    name: user.name ?? null,
    email: user.email ?? null,
  };
}

export async function assertIntegrationCaseAccess(caseId: number, user: IntegrationUser) {
  const record = await getCaseByIdForUser(caseId, user);
  if (!record) {
    throw new IntegrationError(404, "Case was not found or is not accessible.", "case_not_found");
  }
  return record;
}

function clampDocumentWindow(offset?: number, maxChars?: number) {
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.floor(offset!)) : 0;
  const requested = Number.isFinite(maxChars) ? Math.floor(maxChars!) : DEFAULT_DOCUMENT_CHARS;
  return {
    offset: safeOffset,
    maxChars: Math.min(MAX_DOCUMENT_CHARS, Math.max(500, requested)),
  };
}

function excerptAroundQuery(text: string | null | undefined, query: string) {
  if (!text) return "";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const lower = text.toLocaleLowerCase();
  const hit = normalizedQuery ? lower.indexOf(normalizedQuery) : -1;
  const start = hit >= 0
    ? Math.max(0, hit - Math.floor(SEARCH_EXCERPT_CHARS / 3))
    : 0;
  const end = Math.min(text.length, start + SEARCH_EXCERPT_CHARS);
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`;
}

function documentMetadata(document: any) {
  if (!document) return document;
  const {
    extractedText: _extractedText,
    base64Content: _base64Content,
    ...safe
  } = document;
  return safe;
}

function draftSummary(draft: any) {
  if (!draft) return null;
  return {
    id: draft.id,
    caseId: draft.caseId,
    versionNo: draft.versionNo,
    status: draft.status,
    generationMode: draft.generationMode,
    providerSettingId: draft.providerSettingId,
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    approvedAt: draft.approvedAt,
    sectionCount: Array.isArray(draft.sections) ? draft.sections.length : 0,
  };
}

function reviewSummary(review: any) {
  if (!review) return null;
  return {
    id: review.id,
    caseId: review.caseId,
    qualityScore: review.qualityScore,
    readyForSignature: review.readyForSignature,
    providerSettingId: review.providerSettingId,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}

export async function integrationHealth() {
  const user = await resolveIntegrationUser();
  return {
    ok: true,
    service: "judge-ai",
    integrationUser: {
      id: user.id,
      role: user.role,
      name: user.name,
    },
    transports: {
      http: "/api/external/v1",
      mcp: "/mcp",
      trpc: "/api/trpc",
    },
  };
}

export async function listIntegrationCases(filters: {
  query?: string;
  status?: "created" | "document_review" | "drafting" | "under_review" | "approved" | "archived";
  jurisdictionCode?: string;
  caseType?: string;
  includeArchived?: boolean;
} = {}) {
  const user = await resolveIntegrationUser();
  const rows = await listCases(user, filters);
  return rows.map(record => ({
    id: record.id,
    caseNumber: record.caseNumber,
    title: record.title,
    jurisdictionCode: record.jurisdictionCode,
    courtLevel: record.courtLevel,
    caseType: record.caseType,
    languageCode: record.languageCode,
    status: record.status,
    summary: record.summary,
    assignedJudgeId: record.assignedJudgeId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }));
}

export async function getIntegrationCaseOverview(caseId: number) {
  const user = await resolveIntegrationUser();
  await assertIntegrationCaseAccess(caseId, user);
  const workspace = await getCaseWorkspace(caseId, user);
  if (!workspace) {
    throw new IntegrationError(404, "Case workspace was not found.", "case_not_found");
  }

  return {
    case: workspace.case,
    parties: workspace.parties,
    documents: workspace.documents.map(documentMetadata),
    latestDraft: draftSummary(workspace.latestDraft),
    latestReview: reviewSummary(workspace.reviewHistory?.[0]),
    reviewThresholds: workspace.reviewThresholds,
    currentReviewThreshold: workspace.currentReviewThreshold,
  };
}

export async function getIntegrationCurrentDraft(caseId: number) {
  const user = await resolveIntegrationUser();
  await assertIntegrationCaseAccess(caseId, user);
  const workspace = await getCaseWorkspace(caseId, user);
  if (!workspace) {
    throw new IntegrationError(404, "Case workspace was not found.", "case_not_found");
  }
  return workspace.latestDraft ?? null;
}

export async function getIntegrationCaseDocument(
  caseId: number,
  documentId: number,
  options: { offset?: number; maxChars?: number } = {},
) {
  const user = await resolveIntegrationUser();
  await assertIntegrationCaseAccess(caseId, user);
  const document = await getCaseDocumentById(documentId);
  if (!document || document.caseId !== caseId) {
    throw new IntegrationError(404, "Document was not found in this case.", "document_not_found");
  }

  const text = document.extractedText ?? "";
  const window = clampDocumentWindow(options.offset, options.maxChars);
  const end = Math.min(text.length, window.offset + window.maxChars);

  return {
    document: documentMetadata(document),
    text: text.slice(window.offset, end),
    offset: window.offset,
    nextOffset: end < text.length ? end : null,
    totalChars: text.length,
    truncated: end < text.length,
  };
}

export async function getIntegrationKnowledgeDocument(
  documentId: number,
  options: { offset?: number; maxChars?: number } = {},
) {
  const user = await resolveIntegrationUser();
  if (user.role !== "admin") {
    throw new IntegrationError(403, "Knowledge-document retrieval requires the integration user to be an admin.", "forbidden");
  }
  const document = await getKnowledgeDocumentById(documentId);
  if (!document) {
    throw new IntegrationError(404, "Knowledge document was not found.", "knowledge_document_not_found");
  }

  const text = document.extractedText ?? "";
  const window = clampDocumentWindow(options.offset, options.maxChars);
  const end = Math.min(text.length, window.offset + window.maxChars);

  return {
    document: documentMetadata(document),
    text: text.slice(window.offset, end),
    offset: window.offset,
    nextOffset: end < text.length ? end : null,
    totalChars: text.length,
    truncated: end < text.length,
  };
}

export async function searchIntegrationCase(caseId: number, query: string) {
  const user = await resolveIntegrationUser();
  await assertIntegrationCaseAccess(caseId, user);
  const result = await runSearch(caseId, query);

  return {
    caseDocuments: result.caseDocuments.slice(0, MAX_SEARCH_RESULTS_PER_SOURCE).map((document: any) => ({
      ...documentMetadata(document),
      excerpt: excerptAroundQuery(document.extractedText, query),
    })),
    knowledgeDocuments: result.knowledgeDocuments.slice(0, MAX_SEARCH_RESULTS_PER_SOURCE).map((document: any) => ({
      ...documentMetadata(document),
      excerpt: excerptAroundQuery(document.extractedText, query),
    })),
  };
}

export async function searchIntegrationCases(query: string) {
  const user = await resolveIntegrationUser();
  const result = await runCrossCaseSearch(user.id, user.role, query);
  return {
    caseDocuments: result.caseDocuments.slice(0, MAX_SEARCH_RESULTS_PER_SOURCE).map((document: any) => ({
      ...documentMetadata(document),
      excerpt: excerptAroundQuery(document.extractedText, query),
    })),
    knowledgeDocuments: result.knowledgeDocuments.slice(0, MAX_SEARCH_RESULTS_PER_SOURCE).map((document: any) => ({
      ...documentMetadata(document),
      excerpt: excerptAroundQuery(document.extractedText, query),
    })),
  };
}

export async function getIntegrationGenerationStatus(caseId: number) {
  const user = await resolveIntegrationUser();
  await assertIntegrationCaseAccess(caseId, user);
  const job = await getLatestProcessingJobForCase(caseId, "draft_generation");
  if (!job) return null;
  return {
    id: job.id,
    status: job.status,
    stage: (job.resultJson as any)?.stage ?? "preparing",
    message: (job.resultJson as any)?.message ?? "",
    streamedChars: (job.resultJson as any)?.streamedChars ?? null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    errorMessage: job.errorMessage,
  };
}

export async function generateIntegrationDecision(input: {
  caseId: number;
  instructions?: string | null;
  providerId?: number | null;
  profileId?: number | null;
}) {
  const user = await resolveIntegrationUser();
  await assertIntegrationCaseAccess(input.caseId, user);
  const instructions = input.instructions?.trim() || null;
  if (instructions && instructions.length > 8_000) {
    throw new IntegrationError(400, "Generation instructions must be 8,000 characters or fewer.", "invalid_instructions");
  }

  return generateStructuredDraft({
    caseId: input.caseId,
    userId: user.id,
    userRole: user.role,
    providerId: input.providerId ?? null,
    profileId: input.profileId ?? null,
    reviewContext: instructions,
  });
}

export async function reviewIntegrationDecision(input: {
  caseId: number;
  judgmentText?: string | null;
  providerId?: number | null;
  reviewFocus?: string | null;
}) {
  const user = await resolveIntegrationUser();
  await assertIntegrationCaseAccess(input.caseId, user);
  if (input.judgmentText && input.judgmentText.length > 12_000) {
    throw new IntegrationError(400, "Judgment text must be 12,000 characters or fewer.", "invalid_judgment_text");
  }
  if (input.reviewFocus && input.reviewFocus.length > 1_200) {
    throw new IntegrationError(400, "Review focus must be 1,200 characters or fewer.", "invalid_review_focus");
  }

  return reviewCaseAgainstEvidence({
    caseId: input.caseId,
    userId: user.id,
    userRole: user.role,
    judgmentText: input.judgmentText ?? null,
    providerId: input.providerId ?? null,
    reviewTemplateKey: "inheritance",
    reviewTemplateFocus: input.reviewFocus ?? null,
  });
}
