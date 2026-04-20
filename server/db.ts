import type { MySql2Database } from "drizzle-orm/mysql2";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  like,
  max,
  ne,
  or,
  sql,
} from "drizzle-orm";
import { createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/mysql2";
import {
  aiProviderSettings,
  caseActivityLogs,
  caseDocuments,
  caseParties,
  caseReviewSnapshots,
  cases,
  decisionExports,
  draftParagraphs,
  draftSections,
  drafts,
  InsertAiProviderSetting,
  InsertCase,
  InsertCaseActivityLog,
  InsertCaseDocument,
  InsertCaseParty,
  InsertCaseReviewSnapshot,
  InsertDecisionExport,
  InsertDraft,
  InsertJudgeStyleJudgment,
  InsertJudgeStyleProfile,
  InsertKnowledgeDocument,
  InsertOcrSetting,
  InsertParagraphAnnotation,
  InsertProcessingJob,
  InsertReviewApprovalThreshold,
  InsertUser,
  judgeStyleJudgments,
  judgeStyleProfiles,
  knowledgeDocuments,
  ocrSettings,
  paragraphAnnotations,
  processingJobs,
  reviewApprovalThresholds,
  User,
  users,
  userSessions,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

type CaseAccessUser = Pick<User, "id" | "role">;

type PartyInput = {
  partyType:
    | "claimant"
    | "defendant"
    | "respondent"
    | "appellant"
    | "appellee"
    | "interested_party"
    | "other";
  name: string;
  representativeName?: string | null;
  identifier?: string | null;
  address?: string | null;
  isOrganization?: boolean;
};

type CaseInput = Pick<
  InsertCase,
  "caseNumber" | "title" | "jurisdictionCode" | "courtLevel" | "caseType" | "languageCode" | "summary"
> & {
  createdBy: number;
  assignedJudgeId?: number | null;
  parties?: PartyInput[];
};

type CaseFilters = {
  query?: string;
  status?: "created" | "document_review" | "drafting" | "under_review" | "approved" | "archived";
  jurisdictionCode?: string;
  caseType?: string;
  includeArchived?: boolean;
};

type KnowledgeFilters = {
  query?: string;
  documentType?: "statute" | "regulation" | "precedent" | "reference" | "other";
  jurisdictionCode?: string;
  processingStatus?: "uploaded" | "processing" | "processed" | "failed" | "duplicate";
};

type ReviewCaseTypeKey = "inheritance";

type ReviewApprovalThresholdInput = {
  ownerUserId: number;
  caseTypeKey: ReviewCaseTypeKey;
  minimumQualityScore: number;
  requireReadyForSignature: boolean;
  maxHighSeverityFindings: number;
  maxMediumSeverityFindings: number;
};

const DEFAULT_REVIEW_THRESHOLDS: Record<ReviewCaseTypeKey, Omit<ReviewApprovalThresholdInput, "ownerUserId" | "caseTypeKey">> = {
  inheritance: {
    minimumQualityScore: 74,
    requireReadyForSignature: true,
    maxHighSeverityFindings: 0,
    maxMediumSeverityFindings: 2,
  },
};

type DraftSectionInput = {
  sectionKey: "header" | "facts" | "issues" | "reasoning" | "operative_part";
  sectionTitle: string;
  sectionText: string;
  sectionOrder: number;
  paragraphs: Array<{
    paragraphText: string;
    rationale?: string | null;
    confidenceScore?: string | null;
    annotations?: Array<{
      sourceType:
        | "case_document"
        | "knowledge_document"
        | "statute"
        | "regulation"
        | "precedent"
        | "reference";
      caseDocumentId?: number | null;
      knowledgeDocumentId?: number | null;
      sourceLabel: string;
      sourceLocator?: string | null;
      quotedText?: string | null;
      rationaleNote?: string | null;
      relevanceScore?: string | null;
    }>;
  }>;
};

type DraftInput = {
  caseId: number;
  createdBy: number;
  providerSettingId?: number | null;
  generationMode?: "ai" | "manual" | "hybrid";
  generationPromptSnapshot?: string | null;
  generatedByJobId?: number | null;
  sections: DraftSectionInput[];
};

const DEFAULT_JUDGE_ROLE: User["role"] = "judge";

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function ensureDb() {
  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }
  return db;
}

/**
 * Escape special characters for SQL LIKE patterns.
 * In MySQL/MariaDB, backslash is the escape character and must itself be escaped.
 * % matches any sequence of characters, _ matches any single character.
 */
function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, match => {
    if (match === "\\") return "\\\\";  // Escape backslash first
    return `\\${match}`;  // Escape % and _
  });
}

function makeSearchPattern(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return null;
  return `%${escapeLike(normalized)}%`;
}

function caseAccessCondition(user: CaseAccessUser) {
  if (user.role === "admin") {
    return undefined;
  }

  return or(eq(cases.createdBy, user.id), eq(cases.assignedJudgeId, user.id));
}

async function insertAndGetId<T extends { id: number }>(
  promise: PromiseLike<Array<T>>,
): Promise<number> {
  const result = await promise;
  const inserted = result[0];
  if (inserted?.id === undefined || inserted?.id === null) {
    throw new Error("Insert did not return an id");
  }
  return inserted.id;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await ensureDb();
  const updateSet: Record<string, unknown> = {};
  const values: InsertUser = {
    openId: user.openId,
  };

  const textFields = ["name", "email", "loginMethod", "title"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    values[field] = value ?? null;
    updateSet[field] = value ?? null;
  }

  if (user.status !== undefined) {
    values.status = user.status;
    updateSet.status = user.status;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  const resolvedRole = user.role ?? (user.openId === ENV.ownerOpenId ? "admin" : DEFAULT_JUDGE_ROLE);
  values.role = resolvedRole;
  updateSet.role = resolvedRole;

  if (!values.lastSignedIn) {
    values.lastSignedIn = new Date();
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await ensureDb();
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(userId: number) {
  const db = await ensureDb();
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function getUserBySessionToken(sessionToken: string) {
  const db = await ensureDb();
  const sessionTokenHash = createHash("sha256").update(sessionToken).digest("hex");
  
  const now = new Date();
  const result = await db
    .select({
      user: users,
      session: userSessions,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      and(
        eq(userSessions.sessionTokenHash, sessionTokenHash),
        gt(userSessions.expiresAt, now),
        isNull(userSessions.revokedAt),
      ),
    )
    .limit(1);
  
  if (!result[0]) {
    return null;
  }
  
  // Update lastSeenAt for active sessions
  await db
    .update(userSessions)
    .set({ lastSeenAt: new Date() })
    .where(eq(userSessions.id, result[0].session.id));
  
  return result[0].user;
}

export async function createUserSession(input: {
  userId: number;
  sessionTokenHash: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
}) {
  const db = await ensureDb();
  const result = await db.insert(userSessions).values({
    userId: input.userId,
    sessionTokenHash: input.sessionTokenHash,
    userAgent: input.userAgent ?? null,
    ipAddress: input.ipAddress ?? null,
    expiresAt: input.expiresAt,
  }).$returningId();
  
  return result[0]?.id;
}

export async function listUsers() {
  const db = await ensureDb();
  return db.select().from(users).orderBy(asc(users.name), asc(users.email), asc(users.id));
}

export async function updateUserRoleAndStatus(
  userId: number,
  updates: { role?: User["role"]; status?: "active" | "suspended"; title?: string | null; autoApprove?: boolean },
) {
  const db = await ensureDb();
  const updateSet: Record<string, unknown> = {};
  if (updates.role) updateSet.role = updates.role;
  if (updates.status) updateSet.status = updates.status;
  if (updates.title !== undefined) updateSet.title = updates.title;
  if (updates.autoApprove !== undefined) updateSet.autoApprove = updates.autoApprove;

  if (Object.keys(updateSet).length === 0) {
    throw new Error("No user updates were provided");
  }

  await db.update(users).set(updateSet).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function listAiProviderSettings() {
  const db = await ensureDb();
  return db.select().from(aiProviderSettings).where(eq(aiProviderSettings.isArchived, false)).orderBy(desc(aiProviderSettings.isActive), asc(aiProviderSettings.name));
}

export async function getAiProviderSettingById(id: number) {
  const db = await ensureDb();
  const result = await db.select().from(aiProviderSettings).where(eq(aiProviderSettings.id, id)).limit(1);
  return result[0];
}

export async function getActiveAiProviderSetting() {
  const db = await ensureDb();
  const result = await db
    .select()
    .from(aiProviderSettings)
    .where(and(eq(aiProviderSettings.isActive, true), eq(aiProviderSettings.isArchived, false)))
    .limit(1);

  return result[0];
}

export async function saveAiProviderSetting(input: InsertAiProviderSetting) {
  const db = await ensureDb();

  return db.transaction(async tx => {
    if (input.isActive) {
      await tx.update(aiProviderSettings)
        .set({ isActive: false })
        .where(input.id ? ne(aiProviderSettings.id, input.id) : sql`1=1`);
    }

    if (input.id) {
      await tx.update(aiProviderSettings).set({
        name: input.name,
        providerType: input.providerType,
        endpoint: input.endpoint,
        model: input.model,
        apiKeyEncrypted: input.apiKeyEncrypted,
        azureApiVersion: input.azureApiVersion,
        defaultSystemPrompt: input.defaultSystemPrompt,
        draftTemperature: input.draftTemperature,
        maxTokens: input.maxTokens,
        isActive: input.isActive ?? false,
        isArchived: input.isArchived ?? false,
        updatedBy: input.updatedBy,
      }).where(eq(aiProviderSettings.id, input.id));

      return getAiProviderSettingById(input.id);
    }

    const insertedId = await insertAndGetId(
      tx.insert(aiProviderSettings).values(input).$returningId(),
    );
    return getAiProviderSettingById(insertedId);
  });
}

export async function setActiveAiProviderSetting(id: number, updatedBy: number) {
  const db = await ensureDb();
  await db.transaction(async tx => {
    await tx.update(aiProviderSettings)
      .set({ isActive: false, updatedBy })
      .where(ne(aiProviderSettings.id, id));
    await tx.update(aiProviderSettings)
      .set({ isActive: true, updatedBy })
      .where(eq(aiProviderSettings.id, id));
  });
  return getAiProviderSettingById(id);
}

export async function getOcrSettings() {
  const db = await ensureDb();
  const result = await db.select().from(ocrSettings).limit(1);
  return result[0] ?? null;
}

export async function updateOcrSettings(updates: Partial<InsertOcrSetting>) {
  const db = await ensureDb();
  const existing = await getOcrSettings();
  if (existing) {
    await db.update(ocrSettings).set(updates).where(eq(ocrSettings.id, existing.id));
    return getOcrSettings();
  }
  // Fallback: create default row if somehow missing
  const id = await insertAndGetId(db.insert(ocrSettings).values({ provider: "tesseract", enabled: true, language: "ell+eng", ...updates }).$returningId());
  return db.select().from(ocrSettings).where(eq(ocrSettings.id, id)).limit(1).then(r => r[0]);
}

export async function findKnowledgeDocumentDuplicate(fileHash: string) {
  const db = await ensureDb();
  const result = await db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.fileHash, fileHash))
    .orderBy(desc(knowledgeDocuments.createdAt))
    .limit(1);

  return result[0];
}

export async function createKnowledgeDocument(input: InsertKnowledgeDocument) {
  const db = await ensureDb();
  const insertedId = await insertAndGetId(
    db.insert(knowledgeDocuments).values(input).$returningId(),
  );
  return getKnowledgeDocumentById(insertedId);
}

export async function updateKnowledgeDocument(
  documentId: number,
  updates: Partial<InsertKnowledgeDocument>,
) {
  const db = await ensureDb();
  await db.update(knowledgeDocuments).set(updates).where(eq(knowledgeDocuments.id, documentId));
  return getKnowledgeDocumentById(documentId);
}

export async function getKnowledgeDocumentById(documentId: number) {
  const db = await ensureDb();
  const result = await db
    .select()
    .from(knowledgeDocuments)
    .where(eq(knowledgeDocuments.id, documentId))
    .limit(1);

  return result[0];
}

export async function listKnowledgeDocuments(filters: KnowledgeFilters = {}) {
  const db = await ensureDb();
  const searchPattern = makeSearchPattern(filters.query);
  const scopedConditions: any[] = [];

  if (filters.documentType) {
    scopedConditions.push(eq(knowledgeDocuments.documentType, filters.documentType));
  }
  if (filters.jurisdictionCode) {
    scopedConditions.push(eq(knowledgeDocuments.jurisdictionCode, filters.jurisdictionCode));
  }
  if (filters.processingStatus) {
    scopedConditions.push(eq(knowledgeDocuments.processingStatus, filters.processingStatus));
  }
  if (searchPattern) {
    scopedConditions.push(
      or(
        like(knowledgeDocuments.title, searchPattern),
        like(knowledgeDocuments.citation, searchPattern),
        like(knowledgeDocuments.summary, searchPattern),
        like(knowledgeDocuments.extractedText, searchPattern),
      ),
    );
  }

  return db
    .select()
    .from(knowledgeDocuments)
    .where(scopedConditions.length ? and(...scopedConditions) : undefined)
    .orderBy(desc(knowledgeDocuments.createdAt));
}

export async function getKnowledgeDocumentsByIds(ids: number[]) {
  if (ids.length === 0) return [];
  const db = await ensureDb();
  return db.select().from(knowledgeDocuments).where(inArray(knowledgeDocuments.id, ids));
}

export async function createCase(input: CaseInput) {
  const db = await ensureDb();

  return db.transaction(async tx => {
    const caseId = await insertAndGetId(
      tx.insert(cases).values({
        caseNumber: input.caseNumber,
        title: input.title,
        jurisdictionCode: input.jurisdictionCode,
        courtLevel: input.courtLevel,
        caseType: input.caseType,
        languageCode: input.languageCode ?? "en",
        summary: input.summary ?? null,
        createdBy: input.createdBy,
        assignedJudgeId: input.assignedJudgeId ?? input.createdBy,
      }).$returningId(),
    );

    if (input.parties?.length) {
      await tx.insert(caseParties).values(
        input.parties.map((party): InsertCaseParty => ({
          caseId,
          partyType: party.partyType,
          name: party.name,
          representativeName: party.representativeName ?? null,
          identifier: party.identifier ?? null,
          address: party.address ?? null,
          isOrganization: party.isOrganization ?? false,
        })),
      );
    }

    await tx.insert(caseActivityLogs).values({
      caseId,
      actorUserId: input.createdBy,
      actionType: "case.created",
      entityType: "case",
      entityId: caseId,
      summary: `Case ${input.caseNumber} was created`,
      detailsJson: {
        title: input.title,
        jurisdictionCode: input.jurisdictionCode,
        courtLevel: input.courtLevel,
        caseType: input.caseType,
      },
    });

    const createdCase = await tx.select().from(cases).where(eq(cases.id, caseId)).limit(1);
    return createdCase[0];
  });
}

export async function listCases(user: CaseAccessUser, filters: CaseFilters = {}) {
  const db = await ensureDb();
  const accessCondition = caseAccessCondition(user);
  const searchPattern = makeSearchPattern(filters.query);
  const conditions: any[] = [];

  if (accessCondition) conditions.push(accessCondition);
  if (!filters.includeArchived) conditions.push(isNull(cases.archivedAt));
  if (filters.status) conditions.push(eq(cases.status, filters.status));
  if (filters.jurisdictionCode) conditions.push(eq(cases.jurisdictionCode, filters.jurisdictionCode));
  if (filters.caseType) conditions.push(eq(cases.caseType, filters.caseType));
  if (searchPattern) {
    conditions.push(
      or(
        like(cases.caseNumber, searchPattern),
        like(cases.title, searchPattern),
        like(cases.summary, searchPattern),
      ),
    );
  }

  return db
    .select()
    .from(cases)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(cases.updatedAt), desc(cases.createdAt));
}

export async function getCaseByIdForUser(caseId: number, user: CaseAccessUser) {
  const db = await ensureDb();
  const accessCondition = caseAccessCondition(user);
  const conditions = [eq(cases.id, caseId)];
  if (accessCondition) conditions.push(accessCondition);

  const result = await db.select().from(cases).where(and(...conditions)).limit(1);
  return result[0];
}

export async function getCaseParties(caseId: number) {
  const db = await ensureDb();
  return db.select().from(caseParties).where(eq(caseParties.caseId, caseId)).orderBy(asc(caseParties.id));
}

export async function updateCaseStatus(caseId: number, status: typeof cases.$inferInsert.status, actorUserId: number) {
  const db = await ensureDb();
  await db.update(cases).set({ status }).where(eq(cases.id, caseId));
  await logCaseActivity({
    caseId,
    actorUserId,
    actionType: "case.status_changed",
    entityType: "case",
    entityId: caseId,
    summary: `Case status changed to ${status}`,
    detailsJson: { status },
  });
  return getCaseByIdForUser(caseId, { id: actorUserId, role: "admin" });
}

export async function archiveCase(caseId: number, actorUserId: number) {
  const db = await ensureDb();
  const archivedAt = new Date();
  await db.update(cases).set({ status: "archived", archivedAt }).where(eq(cases.id, caseId));
  await logCaseActivity({
    caseId,
    actorUserId,
    actionType: "case.archived",
    entityType: "case",
    entityId: caseId,
    summary: "Case archived",
    detailsJson: { archivedAt: archivedAt.toISOString() },
  });
}

export async function updateCase(
  caseId: number,
  input: Pick<InsertCase, "caseNumber" | "title" | "jurisdictionCode" | "courtLevel" | "caseType" | "languageCode" | "summary"> & { assignedJudgeId?: number | null },
  actorUserId: number,
) {
  const db = await ensureDb();
  await db
    .update(cases)
    .set({
      caseNumber: input.caseNumber,
      title: input.title,
      jurisdictionCode: input.jurisdictionCode,
      courtLevel: input.courtLevel,
      caseType: input.caseType,
      languageCode: input.languageCode,
      summary: input.summary,
      assignedJudgeId: input.assignedJudgeId,
    })
    .where(eq(cases.id, caseId));
  await logCaseActivity({
    caseId,
    actorUserId,
    actionType: "case.updated",
    entityType: "case",
    entityId: caseId,
    summary: `Case ${input.caseNumber} was updated`,
    detailsJson: { title: input.title },
  });
  return getCaseByIdForUser(caseId, { id: actorUserId, role: "admin" });
}

export async function deleteCase(caseId: number, actorUserId: number) {
  const db = await ensureDb();
  const caseToDelete = await getCaseByIdForUser(caseId, { id: actorUserId, role: "admin" });
  if (!caseToDelete) return null;
  await db.delete(cases).where(eq(cases.id, caseId));
  return caseToDelete;
}

export async function findCaseDocumentDuplicate(caseId: number, fileHash: string) {
  const db = await ensureDb();
  const result = await db
    .select()
    .from(caseDocuments)
    .where(and(eq(caseDocuments.caseId, caseId), eq(caseDocuments.fileHash, fileHash)))
    .orderBy(desc(caseDocuments.createdAt))
    .limit(1);

  return result[0];
}

export async function createCaseDocument(input: InsertCaseDocument) {
  const db = await ensureDb();
  const documentId = await insertAndGetId(db.insert(caseDocuments).values(input).$returningId());
  return getCaseDocumentById(documentId);
}

export async function updateCaseDocument(documentId: number, updates: Partial<InsertCaseDocument>) {
  const db = await ensureDb();
  await db.update(caseDocuments).set(updates).where(eq(caseDocuments.id, documentId));
  return getCaseDocumentById(documentId);
}

export async function listCaseDocuments(caseId: number) {
  const db = await ensureDb();
  return db.select().from(caseDocuments).where(eq(caseDocuments.caseId, caseId)).orderBy(desc(caseDocuments.createdAt));
}

export async function getCaseDocumentById(documentId: number) {
  const db = await ensureDb();
  const result = await db.select().from(caseDocuments).where(eq(caseDocuments.id, documentId)).limit(1);
  return result[0];
}

export async function createProcessingJob(input: InsertProcessingJob) {
  const db = await ensureDb();
  const jobId = await insertAndGetId(db.insert(processingJobs).values(input).$returningId());
  return getProcessingJobById(jobId);
}

export async function updateProcessingJob(jobId: number, updates: Partial<InsertProcessingJob>) {
  const db = await ensureDb();
  await db.update(processingJobs).set(updates).where(eq(processingJobs.id, jobId));
  return getProcessingJobById(jobId);
}

export async function getProcessingJobById(jobId: number) {
  const db = await ensureDb();
  const result = await db.select().from(processingJobs).where(eq(processingJobs.id, jobId)).limit(1);
  return result[0];
}

export async function cleanupOrphanedProcessingJobs() {
  const db = await ensureDb();
  await db
    .update(processingJobs)
    .set({
      status: "failed",
      errorMessage: "Server restarted — generation was interrupted. Please try again.",
    })
    .where(eq(processingJobs.status, "running"));
}

export async function getLatestProcessingJobForCase(caseId: number, jobType?: string) {
  const db = await ensureDb();
  const conditions = [eq(processingJobs.caseId, caseId)];
  if (jobType) {
    conditions.push(eq(processingJobs.jobType, jobType as any));
  }
  const result = await db
    .select()
    .from(processingJobs)
    .where(and(...conditions))
    .orderBy(desc(processingJobs.createdAt))
    .limit(1);
  return result[0] ?? null;
}

export async function getLatestDraftForCase(caseId: number) {
  const db = await ensureDb();
  const result = await db
    .select()
    .from(drafts)
    .where(eq(drafts.caseId, caseId))
    .orderBy(desc(drafts.versionNo), desc(drafts.createdAt))
    .limit(1);

  return result[0];
}

export async function getNextDraftVersion(caseId: number, tx?: MySql2Database<any>) {
  const db = tx ?? await ensureDb();
  const result = await db
    .select({ currentMax: max(drafts.versionNo) })
    .from(drafts)
    .where(eq(drafts.caseId, caseId));

  const current = Number(result[0]?.currentMax ?? 0);
  return current + 1;
}

export async function createDraftWithSections(input: DraftInput) {
  const db = await ensureDb();
  return db.transaction(async tx => {
    // Lock the parent case row to serialize draft creation per case.
    // Why: getNextDraftVersion uses SELECT MAX() which is not gap-locked on its own;
    // without this, two concurrent inserts for the same case can compute the same
    // versionNo and collide on the drafts_case_version_unique index.
    await tx
      .select({ id: cases.id })
      .from(cases)
      .where(eq(cases.id, input.caseId))
      .for("update");
    const versionNo = await getNextDraftVersion(input.caseId, tx);
    const draftId = await insertAndGetId(
      tx.insert(drafts).values({
        caseId: input.caseId,
        versionNo,
        status: input.generationMode === "manual" ? "judge_edited" : "system_generated",
        generationMode: input.generationMode ?? "ai",
        providerSettingId: input.providerSettingId ?? null,
        generationPromptSnapshot: input.generationPromptSnapshot ?? null,
        generatedByJobId: input.generatedByJobId ?? null,
        createdBy: input.createdBy,
      }).$returningId(),
    );

    for (const section of input.sections) {
      const sectionId = await insertAndGetId(
        tx.insert(draftSections).values({
          draftId,
          sectionKey: section.sectionKey,
          sectionTitle: section.sectionTitle,
          sectionOrder: section.sectionOrder,
          sectionText: section.sectionText,
          reviewStatus: "draft",
          lastEditedBy: input.createdBy,
        }).$returningId(),
      );

      for (let paragraphIndex = 0; paragraphIndex < section.paragraphs.length; paragraphIndex += 1) {
        const paragraph = section.paragraphs[paragraphIndex]!;
        const paragraphId = await insertAndGetId(
          tx.insert(draftParagraphs).values({
            sectionId,
            paragraphOrder: paragraphIndex + 1,
            paragraphText: paragraph.paragraphText,
            rationale: paragraph.rationale ?? null,
            confidenceScore: paragraph.confidenceScore ?? null,
            reviewStatus: "draft",
            editedBy: input.createdBy,
          }).$returningId(),
        );

        if (paragraph.annotations?.length) {
          await tx.insert(paragraphAnnotations).values(
            paragraph.annotations.map((annotation): InsertParagraphAnnotation => ({
              paragraphId,
              sourceType: annotation.sourceType,
              caseDocumentId: annotation.caseDocumentId ?? null,
              knowledgeDocumentId: annotation.knowledgeDocumentId ?? null,
              sourceLabel: annotation.sourceLabel,
              sourceLocator: annotation.sourceLocator ?? null,
              quotedText: annotation.quotedText ?? null,
              rationaleNote: annotation.rationaleNote ?? null,
              relevanceScore: annotation.relevanceScore ?? null,
            })),
          );
        }
      }
    }

    await tx.insert(caseActivityLogs).values({
      caseId: input.caseId,
      actorUserId: input.createdBy,
      actionType: "draft.created",
      entityType: "draft",
      entityId: draftId,
      summary: `Draft version ${versionNo} created`,
      detailsJson: {
        generationMode: input.generationMode ?? "ai",
        providerSettingId: input.providerSettingId ?? null,
      },
    });

    return getDraftById(draftId, tx);
  });
}

export async function getDraftById(draftId: number, tx?: MySql2Database<any>) {
  const db = tx ?? await ensureDb();
  const draftRows = await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1);
  const draft = draftRows[0];
  if (!draft) return undefined;

  const sections = await db.select().from(draftSections).where(eq(draftSections.draftId, draftId)).orderBy(asc(draftSections.sectionOrder));
  const sectionIds = sections.map(section => section.id);
  const paragraphs = sectionIds.length
    ? await db.select().from(draftParagraphs).where(inArray(draftParagraphs.sectionId, sectionIds)).orderBy(asc(draftParagraphs.sectionId), asc(draftParagraphs.paragraphOrder))
    : [];
  const paragraphIds = paragraphs.map(paragraph => paragraph.id);
  const annotations = paragraphIds.length
    ? await db.select().from(paragraphAnnotations).where(inArray(paragraphAnnotations.paragraphId, paragraphIds)).orderBy(asc(paragraphAnnotations.id))
    : [];

  return {
    ...draft,
    sections: sections.map(section => ({
      ...section,
      paragraphs: paragraphs
        .filter(paragraph => paragraph.sectionId === section.id)
        .map(paragraph => ({
          ...paragraph,
          annotations: annotations.filter(annotation => annotation.paragraphId === paragraph.id),
        })),
    })),
  };
}

export async function getDraftParagraphCaseId(paragraphId: number) {
  const db = await ensureDb();
  const result = await db
    .select({ caseId: drafts.caseId })
    .from(draftParagraphs)
    .innerJoin(draftSections, eq(draftSections.id, draftParagraphs.sectionId))
    .innerJoin(drafts, eq(drafts.id, draftSections.draftId))
    .where(eq(draftParagraphs.id, paragraphId))
    .limit(1);
  return result[0]?.caseId;
}

export async function getDraftSectionCaseId(sectionId: number) {
  const db = await ensureDb();
  const result = await db
    .select({ caseId: drafts.caseId })
    .from(draftSections)
    .innerJoin(drafts, eq(drafts.id, draftSections.draftId))
    .where(eq(draftSections.id, sectionId))
    .limit(1);
  return result[0]?.caseId;
}

export async function updateDraftParagraph(
  paragraphId: number,
  updates: {
    paragraphText?: string;
    rationale?: string | null;
    confidenceScore?: string | null;
    reviewStatus?: "draft" | "reviewed" | "approved";
    editedBy: number;
    annotations?: DraftSectionInput["paragraphs"][number]["annotations"];
  },
) {
  const db = await ensureDb();
  return db.transaction(async tx => {
    await tx.update(draftParagraphs).set({
      paragraphText: updates.paragraphText,
      rationale: updates.rationale,
      confidenceScore: updates.confidenceScore,
      reviewStatus: updates.reviewStatus,
      editedBy: updates.editedBy,
    }).where(eq(draftParagraphs.id, paragraphId));

    if (updates.annotations) {
      await tx.delete(paragraphAnnotations).where(eq(paragraphAnnotations.paragraphId, paragraphId));
      if (updates.annotations.length) {
        await tx.insert(paragraphAnnotations).values(
          updates.annotations.map((annotation): InsertParagraphAnnotation => ({
            paragraphId,
            sourceType: annotation.sourceType,
            caseDocumentId: annotation.caseDocumentId ?? null,
            knowledgeDocumentId: annotation.knowledgeDocumentId ?? null,
            sourceLabel: annotation.sourceLabel,
            sourceLocator: annotation.sourceLocator ?? null,
            quotedText: annotation.quotedText ?? null,
            rationaleNote: annotation.rationaleNote ?? null,
            relevanceScore: annotation.relevanceScore ?? null,
          })),
        );
      }
    }

    const paragraphRows = await tx.select().from(draftParagraphs).where(eq(draftParagraphs.id, paragraphId)).limit(1);
    const paragraph = paragraphRows[0];
    const annotationRows = await tx.select().from(paragraphAnnotations).where(eq(paragraphAnnotations.paragraphId, paragraphId)).orderBy(asc(paragraphAnnotations.id));
    return {
      ...paragraph,
      annotations: annotationRows,
    };
  });
}

export async function updateDraftSection(
  sectionId: number,
  updates: {
    sectionText?: string;
    reviewStatus?: "draft" | "reviewed" | "approved";
    lastEditedBy?: number | null;
    approvedBy?: number | null;
    approvedAt?: Date | null;
  },
) {
  const db = await ensureDb();
  await db.update(draftSections).set(updates).where(eq(draftSections.id, sectionId));
  const result = await db.select().from(draftSections).where(eq(draftSections.id, sectionId)).limit(1);
  return result[0];
}

export async function approveDraft(draftId: number, approvedBy: number) {
  const db = await ensureDb();
  const approvedAt = new Date();
  await db.transaction(async tx => {
    await tx.update(drafts).set({ status: "approved", approvedBy, approvedAt }).where(eq(drafts.id, draftId));
    await tx.update(draftSections).set({ reviewStatus: "approved", approvedBy, approvedAt }).where(eq(draftSections.draftId, draftId));
  });

  return getDraftById(draftId);
}

function buildDefaultReviewThreshold(ownerUserId: number, caseTypeKey: ReviewCaseTypeKey): InsertReviewApprovalThreshold {
  return {
    ownerUserId,
    caseTypeKey,
    ...DEFAULT_REVIEW_THRESHOLDS[caseTypeKey],
  };
}

export function inferReviewCaseTypeKey(_caseType?: string | null): ReviewCaseTypeKey {
  return "inheritance";
}

export async function listReviewApprovalThresholds(ownerUserId: number) {
  const db = await ensureDb();
  const stored = await db
    .select()
    .from(reviewApprovalThresholds)
    .where(eq(reviewApprovalThresholds.ownerUserId, ownerUserId))
    .orderBy(asc(reviewApprovalThresholds.caseTypeKey));

  const byType = new Map(stored.map(item => [item.caseTypeKey as ReviewCaseTypeKey, item]));
  return (["inheritance"] as ReviewCaseTypeKey[]).map(caseTypeKey => {
    return byType.get(caseTypeKey) ?? {
      id: 0,
      createdAt: null,
      updatedAt: null,
      ...buildDefaultReviewThreshold(ownerUserId, caseTypeKey),
    };
  });
}

export async function getEffectiveReviewApprovalThreshold(ownerUserId: number, caseTypeKey: ReviewCaseTypeKey) {
  const db = await ensureDb();
  const result = await db
    .select()
    .from(reviewApprovalThresholds)
    .where(and(eq(reviewApprovalThresholds.ownerUserId, ownerUserId), eq(reviewApprovalThresholds.caseTypeKey, caseTypeKey)))
    .limit(1);

  return result[0] ?? {
    id: 0,
    createdAt: null,
    updatedAt: null,
    ...buildDefaultReviewThreshold(ownerUserId, caseTypeKey),
  };
}

export async function upsertReviewApprovalThreshold(input: ReviewApprovalThresholdInput) {
  const db = await ensureDb();
  const existing = await db
    .select({ id: reviewApprovalThresholds.id })
    .from(reviewApprovalThresholds)
    .where(and(eq(reviewApprovalThresholds.ownerUserId, input.ownerUserId), eq(reviewApprovalThresholds.caseTypeKey, input.caseTypeKey)))
    .limit(1);

  if (existing[0]?.id) {
    await db
      .update(reviewApprovalThresholds)
      .set({
        minimumQualityScore: input.minimumQualityScore,
        requireReadyForSignature: input.requireReadyForSignature,
        maxHighSeverityFindings: input.maxHighSeverityFindings,
        maxMediumSeverityFindings: input.maxMediumSeverityFindings,
      })
      .where(eq(reviewApprovalThresholds.id, existing[0].id));
  } else {
    await db.insert(reviewApprovalThresholds).values(input);
  }

  return getEffectiveReviewApprovalThreshold(input.ownerUserId, input.caseTypeKey);
}

export async function createCaseReviewSnapshot(input: InsertCaseReviewSnapshot) {
  const db = await ensureDb();
  const reviewId = await insertAndGetId(db.insert(caseReviewSnapshots).values(input).$returningId());
  return getCaseReviewSnapshotById(reviewId);
}

export async function getCaseReviewSnapshotById(reviewId: number) {
  const db = await ensureDb();
  const result = await db.select().from(caseReviewSnapshots).where(eq(caseReviewSnapshots.id, reviewId)).limit(1);
  return result[0];
}

export async function listCaseReviewSnapshots(caseId: number) {
  const db = await ensureDb();
  return db
    .select()
    .from(caseReviewSnapshots)
    .where(eq(caseReviewSnapshots.caseId, caseId))
    .orderBy(desc(caseReviewSnapshots.createdAt), desc(caseReviewSnapshots.id));
}

export async function getLatestCaseReviewSnapshotForDraft(draftId: number) {
  const db = await ensureDb();
  const result = await db
    .select()
    .from(caseReviewSnapshots)
    .where(eq(caseReviewSnapshots.draftId, draftId))
    .orderBy(desc(caseReviewSnapshots.createdAt), desc(caseReviewSnapshots.id))
    .limit(1);

  return result[0];
}

export async function createDecisionExport(input: InsertDecisionExport) {
  const db = await ensureDb();
  const exportId = await insertAndGetId(db.insert(decisionExports).values(input).$returningId());
  return getDecisionExportById(exportId);
}

export async function updateDecisionExport(exportId: number, updates: Partial<InsertDecisionExport>) {
  const db = await ensureDb();
  await db.update(decisionExports).set(updates).where(eq(decisionExports.id, exportId));
  return getDecisionExportById(exportId);
}

export async function getDecisionExportById(exportId: number) {
  const db = await ensureDb();
  const result = await db.select().from(decisionExports).where(eq(decisionExports.id, exportId)).limit(1);
  return result[0];
}

export async function listCaseActivity(caseId: number) {
  const db = await ensureDb();
  return db.select().from(caseActivityLogs).where(eq(caseActivityLogs.caseId, caseId)).orderBy(desc(caseActivityLogs.createdAt), desc(caseActivityLogs.id));
}

export async function logCaseActivity(input: InsertCaseActivityLog) {
  const db = await ensureDb();
  const activityId = await insertAndGetId(db.insert(caseActivityLogs).values(input).$returningId());
  const result = await db.select().from(caseActivityLogs).where(eq(caseActivityLogs.id, activityId)).limit(1);
  return result[0];
}

export async function searchCaseAndKnowledgeDocuments(caseId: number, query: string) {
  const db = await ensureDb();
  const searchPattern = makeSearchPattern(query);
  if (!searchPattern) {
    return { caseDocuments: [], knowledgeDocuments: [] };
  }

  try {
    const caseRelevance = sql<number>`MATCH(${caseDocuments.title}, ${caseDocuments.extractedText}) AGAINST (${query} IN NATURAL LANGUAGE MODE)`;
    const knowledgeRelevance = sql<number>`MATCH(${knowledgeDocuments.title}, ${knowledgeDocuments.citation}, ${knowledgeDocuments.summary}, ${knowledgeDocuments.extractedText}) AGAINST (${query} IN NATURAL LANGUAGE MODE)`;

    const [caseDocumentRows, knowledgeDocumentRows] = await Promise.all([
      db
        .select()
        .from(caseDocuments)
        .where(and(eq(caseDocuments.caseId, caseId), sql`${caseRelevance} > 0`))
        .orderBy(desc(caseRelevance), desc(caseDocuments.updatedAt))
        .limit(25),
      db
        .select()
        .from(knowledgeDocuments)
        .where(sql`${knowledgeRelevance} > 0`)
        .orderBy(desc(knowledgeRelevance), desc(knowledgeDocuments.updatedAt))
        .limit(25),
    ]);

    return {
      caseDocuments: caseDocumentRows,
      knowledgeDocuments: knowledgeDocumentRows,
    };
  } catch (error) {
    console.warn("[Search] Full-text search unavailable; falling back to LIKE search.", error);
  }

  const [caseDocumentRows, knowledgeDocumentRows] = await Promise.all([
    db
      .select()
      .from(caseDocuments)
      .where(
        and(
          eq(caseDocuments.caseId, caseId),
          or(
            like(caseDocuments.title, searchPattern),
            like(caseDocuments.extractedText, searchPattern),
          ),
        ),
      )
      .orderBy(desc(caseDocuments.updatedAt))
      .limit(25),
    db
      .select()
      .from(knowledgeDocuments)
      .where(
        or(
          like(knowledgeDocuments.title, searchPattern),
          like(knowledgeDocuments.citation, searchPattern),
          like(knowledgeDocuments.summary, searchPattern),
          like(knowledgeDocuments.extractedText, searchPattern),
        ),
      )
      .orderBy(desc(knowledgeDocuments.updatedAt))
      .limit(25),
  ]);

  return {
    caseDocuments: caseDocumentRows,
    knowledgeDocuments: knowledgeDocumentRows,
  };
}

export async function getCaseWorkspace(caseId: number, user: CaseAccessUser) {
  const caseRecord = await getCaseByIdForUser(caseId, user);
  if (!caseRecord) {
    return undefined;
  }

  const [parties, documents, latestDraft, activity, reviewHistory, reviewThresholds] = await Promise.all([
    getCaseParties(caseId),
    listCaseDocuments(caseId),
    getLatestDraftForCase(caseId),
    listCaseActivity(caseId),
    listCaseReviewSnapshots(caseId),
    listReviewApprovalThresholds(user.id),
  ]);

  const draft = latestDraft ? await getDraftById(latestDraft.id) : null;
  const currentReviewThreshold = reviewThresholds.find(item => item.caseTypeKey === inferReviewCaseTypeKey(caseRecord.caseType)) ?? null;

  return {
    case: caseRecord,
    parties,
    documents,
    latestDraft: draft,
    activity,
    reviewHistory,
    reviewThresholds,
    currentReviewThreshold,
  };
}

// ============================================================================
// Judge Style Profiles
// ============================================================================

export async function createJudgeStyleProfile(input: InsertJudgeStyleProfile) {
  const db = await ensureDb();
  const id = await insertAndGetId(db.insert(judgeStyleProfiles).values(input).$returningId());
  return db.select().from(judgeStyleProfiles).where(eq(judgeStyleProfiles.id, id)).limit(1).then(r => r[0]);
}

export async function getJudgeStyleProfileById(id: number) {
  const db = await ensureDb();
  const result = await db.select().from(judgeStyleProfiles).where(eq(judgeStyleProfiles.id, id)).limit(1);
  return result[0];
}

export async function listJudgeStyleProfiles(userId: number) {
  const db = await ensureDb();
  return db.select().from(judgeStyleProfiles).where(eq(judgeStyleProfiles.userId, userId)).orderBy(desc(judgeStyleProfiles.updatedAt));
}

export async function getActiveJudgeStyleProfile(userId: number) {
  const db = await ensureDb();
  const result = await db
    .select()
    .from(judgeStyleProfiles)
    .where(and(eq(judgeStyleProfiles.userId, userId), eq(judgeStyleProfiles.status, "active")))
    .orderBy(desc(judgeStyleProfiles.updatedAt))
    .limit(1);
  return result[0] ?? null;
}

export async function updateJudgeStyleProfile(id: number, updates: Partial<InsertJudgeStyleProfile>) {
  const db = await ensureDb();
  await db.update(judgeStyleProfiles).set(updates).where(eq(judgeStyleProfiles.id, id));
  return getJudgeStyleProfileById(id);
}

export async function deleteJudgeStyleProfile(id: number) {
  const db = await ensureDb();
  await db.delete(judgeStyleProfiles).where(eq(judgeStyleProfiles.id, id));
}

// ============================================================================
// Judge Style Judgments
// ============================================================================

export async function createJudgeStyleJudgment(input: InsertJudgeStyleJudgment) {
  const db = await ensureDb();
  const id = await insertAndGetId(db.insert(judgeStyleJudgments).values(input).$returningId());
  return db.select().from(judgeStyleJudgments).where(eq(judgeStyleJudgments.id, id)).limit(1).then(r => r[0]);
}

export async function listJudgeStyleJudgments(profileId: number) {
  const db = await ensureDb();
  return db.select().from(judgeStyleJudgments).where(eq(judgeStyleJudgments.profileId, profileId)).orderBy(desc(judgeStyleJudgments.createdAt));
}

export async function getJudgeStyleJudgmentById(id: number) {
  const db = await ensureDb();
  const result = await db
    .select({
      judgment: judgeStyleJudgments,
      profile: judgeStyleProfiles,
    })
    .from(judgeStyleJudgments)
    .innerJoin(judgeStyleProfiles, eq(judgeStyleProfiles.id, judgeStyleJudgments.profileId))
    .where(eq(judgeStyleJudgments.id, id))
    .limit(1);

  return result[0] ?? null;
}

export async function deleteJudgeStyleJudgment(id: number) {
  const db = await ensureDb();
  await db.transaction(async tx => {
    const existing = await tx
      .select({ profileId: judgeStyleJudgments.profileId })
      .from(judgeStyleJudgments)
      .where(eq(judgeStyleJudgments.id, id))
      .limit(1);
    const profileId = existing[0]?.profileId;

    await tx.delete(judgeStyleJudgments).where(eq(judgeStyleJudgments.id, id));
    if (profileId) {
      await tx
        .update(judgeStyleProfiles)
        .set({ judgmentCount: sql`GREATEST(${judgeStyleProfiles.judgmentCount} - 1, 0)` })
        .where(eq(judgeStyleProfiles.id, profileId));
    }
  });
}

export type ResetSystemScope = "factory" | "program_data" | "settings";

export async function resetSystemData(scope: ResetSystemScope, actorUserId: number) {
  const db = await ensureDb();
  const counts = {
    cases: 0,
    drafts: 0,
    knowledge: 0,
    providers: 0,
    styleProfiles: 0,
    thresholds: 0,
  };

  await db.transaction(async tx => {
    if (scope === "factory" || scope === "program_data") {
      const [caseCountRow] = await tx.select({ c: sql<number>`count(*)` }).from(cases);
      counts.cases = Number(caseCountRow?.c ?? 0);
      const [draftCountRow] = await tx.select({ c: sql<number>`count(*)` }).from(drafts);
      counts.drafts = Number(draftCountRow?.c ?? 0);
      const [kbCountRow] = await tx.select({ c: sql<number>`count(*)` }).from(knowledgeDocuments);
      counts.knowledge = Number(kbCountRow?.c ?? 0);
      const [profileCountRow] = await tx.select({ c: sql<number>`count(*)` }).from(judgeStyleProfiles);
      counts.styleProfiles = Number(profileCountRow?.c ?? 0);

      await tx.delete(paragraphAnnotations);
      await tx.delete(draftParagraphs);
      await tx.delete(draftSections);
      await tx.delete(decisionExports);
      await tx.delete(caseReviewSnapshots);
      await tx.delete(drafts);
      await tx.delete(processingJobs);
      await tx.delete(caseDocuments);
      await tx.delete(caseParties);
      await tx.delete(caseActivityLogs);
      await tx.delete(cases);
      await tx.delete(knowledgeDocuments);
      await tx.delete(judgeStyleJudgments);
      await tx.delete(judgeStyleProfiles);
    }

    if (scope === "factory" || scope === "settings") {
      const [providerCountRow] = await tx.select({ c: sql<number>`count(*)` }).from(aiProviderSettings);
      counts.providers = Number(providerCountRow?.c ?? 0);
      const [thresholdCountRow] = await tx.select({ c: sql<number>`count(*)` }).from(reviewApprovalThresholds);
      counts.thresholds = Number(thresholdCountRow?.c ?? 0);

      await tx.delete(aiProviderSettings);
      await tx.delete(reviewApprovalThresholds);
      await tx
        .update(users)
        .set({ autoApprove: false })
        .where(eq(users.autoApprove, true));
    }

    if (scope === "factory") {
      await tx.delete(userSessions).where(ne(userSessions.userId, actorUserId));
    }
  });

  return { scope, counts };
}

export async function purgeUploadsDirectory(): Promise<number> {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { getLocalUploadsDir } = await import("./storage");
  const dir = getLocalUploadsDir();
  if (!fs.existsSync(dir)) return 0;
  let removed = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const target = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        fs.rmSync(target, { recursive: true, force: true });
      } else {
        fs.unlinkSync(target);
      }
      removed += 1;
    } catch {
      // swallow per-entry errors, continue purging
    }
  }
  return removed;
}
