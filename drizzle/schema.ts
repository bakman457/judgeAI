import {
  boolean,
  decimal,
  index,
  int,
  foreignKey,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable(
  "users",
  {
    id: int("id").autoincrement().primaryKey(),
    openId: varchar("openId", { length: 64 }).notNull().unique(),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 320 }),
    loginMethod: varchar("loginMethod", { length: 64 }),
    role: mysqlEnum("role", ["judge", "admin"]).default("judge").notNull(),
    status: mysqlEnum("status", ["active", "suspended"]).default("active").notNull(),
    title: varchar("title", { length: 120 }),
    autoApprove: boolean("autoApprove").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  },
  table => ({
    roleIdx: index("users_role_idx").on(table.role),
    statusIdx: index("users_status_idx").on(table.status),
    emailIdx: index("users_email_idx").on(table.email),
  }),
);

export const userSessions = mysqlTable(
  "user_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sessionTokenHash: varchar("sessionTokenHash", { length: 128 }).notNull(),
    userAgent: varchar("userAgent", { length: 500 }),
    ipAddress: varchar("ipAddress", { length: 64 }),
    expiresAt: timestamp("expiresAt").notNull(),
    lastSeenAt: timestamp("lastSeenAt").defaultNow().notNull(),
    revokedAt: timestamp("revokedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    tokenUnique: uniqueIndex("user_sessions_token_unique").on(table.sessionTokenHash),
    userIdx: index("user_sessions_user_idx").on(table.userId),
    expiresIdx: index("user_sessions_expires_idx").on(table.expiresAt),
  }),
);

export const aiProviderSettings = mysqlTable(
  "ai_provider_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    providerType: mysqlEnum("providerType", ["openai", "azure_openai", "custom_openai_compatible", "alibaba_cloud", "kimi", "deepseek"]).notNull(),
    endpoint: varchar("endpoint", { length: 500 }).notNull(),
    model: varchar("model", { length: 180 }).notNull(),
    apiKeyEncrypted: text("apiKeyEncrypted"),
    azureApiVersion: varchar("azureApiVersion", { length: 80 }),
    defaultSystemPrompt: text("defaultSystemPrompt"),
    draftTemperature: decimal("draftTemperature", { precision: 3, scale: 2 }).default("0.20").notNull(),
    maxTokens: int("maxTokens").default(8000).notNull(),
    isActive: boolean("isActive").default(false).notNull(),
    isArchived: boolean("isArchived").default(false).notNull(),
    // Lower numbers run earlier. When the active provider fails with a
    // retryable error (timeout, 5xx, empty stream, etc.), the next enabled
    // provider in ascending fallbackOrder is tried automatically.
    fallbackOrder: int("fallbackOrder").default(100).notNull(),
    createdBy: int("createdBy").references(() => users.id, { onDelete: "set null" }),
    updatedBy: int("updatedBy").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    activeIdx: index("ai_provider_settings_active_idx").on(table.isActive),
    providerIdx: index("ai_provider_settings_provider_idx").on(table.providerType),
    fallbackOrderIdx: index("ai_provider_settings_fallback_order_idx").on(table.fallbackOrder),
  }),
);

export const aiUsageEvents = mysqlTable(
  "ai_usage_events",
  {
    id: int("id").autoincrement().primaryKey(),
    providerId: int("providerId").references(() => aiProviderSettings.id, { onDelete: "set null" }),
    providerName: varchar("providerName", { length: 180 }),
    model: varchar("model", { length: 180 }),
    caseId: int("caseId").references(() => cases.id, { onDelete: "set null" }),
    userId: int("userId").references(() => users.id, { onDelete: "set null" }),
    kind: varchar("kind", { length: 32 }).notNull(), // "draft" | "review" | "simple" | "failover_fallback"
    promptTokens: int("promptTokens").default(0).notNull(),
    completionTokens: int("completionTokens").default(0).notNull(),
    totalTokens: int("totalTokens").default(0).notNull(),
    cachedTokens: int("cachedTokens").default(0).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    createdAtIdx: index("ai_usage_events_created_at_idx").on(table.createdAt),
    providerIdx: index("ai_usage_events_provider_idx").on(table.providerId),
    caseIdx: index("ai_usage_events_case_idx").on(table.caseId),
  }),
);

export type AiUsageEvent = typeof aiUsageEvents.$inferSelect;
export type InsertAiUsageEvent = typeof aiUsageEvents.$inferInsert;

export const ocrSettings = mysqlTable(
  "ocr_settings",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull().default("tesseract"),
    enabled: boolean("enabled").default(true).notNull(),
    language: varchar("language", { length: 32 }).notNull().default("ell+eng"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    providerIdx: index("ocr_settings_provider_idx").on(table.provider),
  }),
);

export const knowledgeDocuments = mysqlTable(
  "knowledge_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    documentType: mysqlEnum("documentType", ["statute", "regulation", "precedent", "reference", "other"]).notNull(),
    jurisdictionCode: varchar("jurisdictionCode", { length: 50 }).notNull(),
    courtLevel: varchar("courtLevel", { length: 120 }),
    citation: varchar("citation", { length: 255 }),
    sourceReference: varchar("sourceReference", { length: 500 }),
    languageCode: varchar("languageCode", { length: 16 }).default("en").notNull(),
    tags: json("tags").$type<string[] | null>(),
    summary: text("summary"),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    fileKey: varchar("fileKey", { length: 500 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    fileHash: varchar("fileHash", { length: 128 }).notNull(),
    processingStatus: mysqlEnum("processingStatus", ["uploaded", "processing", "processed", "failed", "duplicate"]).default("uploaded").notNull(),
    duplicateOfDocumentId: int("duplicateOfDocumentId"),
    extractedText: text("extractedText"),
    metadataJson: json("metadataJson").$type<Record<string, unknown> | null>(),
    uploadedBy: int("uploadedBy").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    hashIdx: index("knowledge_documents_hash_idx").on(table.fileHash),
    typeIdx: index("knowledge_documents_type_idx").on(table.documentType),
    statusIdx: index("knowledge_documents_status_idx").on(table.processingStatus),
    jurisdictionIdx: index("knowledge_documents_jurisdiction_idx").on(table.jurisdictionCode),
    titleIdx: index("knowledge_documents_title_idx").on(table.title),
    uploadedByIdx: index("knowledge_documents_uploaded_by_idx").on(table.uploadedBy),
    duplicateFk: foreignKey({
      columns: [table.duplicateOfDocumentId],
      foreignColumns: [table.id],
      name: "knowledge_documents_duplicate_fk",
    }).onDelete("set null"),
  }),
);

export const cases = mysqlTable(
  "cases",
  {
    id: int("id").autoincrement().primaryKey(),
    caseNumber: varchar("caseNumber", { length: 120 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    jurisdictionCode: varchar("jurisdictionCode", { length: 50 }).notNull(),
    courtLevel: varchar("courtLevel", { length: 120 }).notNull(),
    caseType: varchar("caseType", { length: 120 }).notNull(),
    status: mysqlEnum("status", ["created", "document_review", "drafting", "under_review", "approved", "archived"]).default("created").notNull(),
    languageCode: varchar("languageCode", { length: 16 }).default("en").notNull(),
    summary: text("summary"),
    assignedJudgeId: int("assignedJudgeId").references(() => users.id, { onDelete: "set null" }),
    createdBy: int("createdBy").notNull().references(() => users.id, { onDelete: "restrict" }),
    archivedAt: timestamp("archivedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    caseLookupUnique: uniqueIndex("cases_number_jurisdiction_court_unique").on(
      table.caseNumber,
      table.jurisdictionCode,
      table.courtLevel,
    ),
    statusIdx: index("cases_status_idx").on(table.status),
    assignedJudgeIdx: index("cases_assigned_judge_idx").on(table.assignedJudgeId),
    createdByIdx: index("cases_created_by_idx").on(table.createdBy),
    titleIdx: index("cases_title_idx").on(table.title),
  }),
);

export const caseParties = mysqlTable(
  "case_parties",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    partyType: mysqlEnum("partyType", ["claimant", "defendant", "respondent", "appellant", "appellee", "interested_party", "other"]).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    representativeName: varchar("representativeName", { length: 255 }),
    identifier: varchar("identifier", { length: 120 }),
    address: text("address"),
    isOrganization: boolean("isOrganization").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    caseIdx: index("case_parties_case_idx").on(table.caseId),
    typeIdx: index("case_parties_type_idx").on(table.partyType),
  }),
);

export const caseDocuments = mysqlTable(
  "case_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    documentType: mysqlEnum("documentType", ["pleading", "evidence", "supporting", "reference", "decision", "other"]).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    fileKey: varchar("fileKey", { length: 500 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 1000 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    fileHash: varchar("fileHash", { length: 128 }).notNull(),
    uploadStatus: mysqlEnum("uploadStatus", ["uploaded", "processing", "processed", "failed", "duplicate"]).default("uploaded").notNull(),
    duplicateOfDocumentId: int("duplicateOfDocumentId"),
    extractedText: text("extractedText"),
    metadataJson: json("metadataJson").$type<Record<string, unknown> | null>(),
    uploadedBy: int("uploadedBy").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    caseIdx: index("case_documents_case_idx").on(table.caseId),
    hashIdx: index("case_documents_hash_idx").on(table.fileHash),
    statusIdx: index("case_documents_status_idx").on(table.uploadStatus),
    titleIdx: index("case_documents_title_idx").on(table.title),
    uploadedByIdx: index("case_documents_uploaded_by_idx").on(table.uploadedBy),
    duplicateFk: foreignKey({
      columns: [table.duplicateOfDocumentId],
      foreignColumns: [table.id],
      name: "case_documents_duplicate_fk",
    }).onDelete("set null"),
  }),
);

export const processingJobs = mysqlTable(
  "processing_jobs",
  {
    id: int("id").autoincrement().primaryKey(),
    jobType: mysqlEnum("jobType", ["knowledge_ingest", "case_document_ingest", "draft_generation", "section_regeneration", "docx_export"]).notNull(),
    targetEntityType: mysqlEnum("targetEntityType", ["knowledge_document", "case_document", "draft", "draft_section", "decision_export"]).notNull(),
    targetEntityId: int("targetEntityId").notNull(),
    caseId: int("caseId").references(() => cases.id, { onDelete: "cascade" }),
    status: mysqlEnum("status", ["queued", "running", "completed", "failed"]).default("queued").notNull(),
    payloadJson: json("payloadJson").$type<Record<string, unknown> | null>(),
    resultJson: json("resultJson").$type<Record<string, unknown> | null>(),
    errorMessage: text("errorMessage"),
    createdBy: int("createdBy").references(() => users.id, { onDelete: "set null" }),
    queuedAt: timestamp("queuedAt").defaultNow().notNull(),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    caseIdx: index("processing_jobs_case_idx").on(table.caseId),
    statusIdx: index("processing_jobs_status_idx").on(table.status),
    targetIdx: index("processing_jobs_target_idx").on(table.targetEntityType, table.targetEntityId),
    typeIdx: index("processing_jobs_type_idx").on(table.jobType),
    // Composite: queue-poll queries (WHERE status = ? AND jobType = ?)
    statusTypeIdx: index("processing_jobs_status_type_idx").on(table.status, table.jobType),
    createdByIdx: index("processing_jobs_created_by_idx").on(table.createdBy),
  }),
);

export const drafts = mysqlTable(
  "drafts",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    versionNo: int("versionNo").notNull(),
    status: mysqlEnum("status", ["system_generated", "judge_edited", "reviewed", "approved", "archived"]).default("system_generated").notNull(),
    generationMode: mysqlEnum("generationMode", ["ai", "manual", "hybrid"]).default("ai").notNull(),
    providerSettingId: int("providerSettingId").references(() => aiProviderSettings.id, { onDelete: "set null" }),
    generationPromptSnapshot: text("generationPromptSnapshot"),
    generatedByJobId: int("generatedByJobId").references(() => processingJobs.id, { onDelete: "set null" }),
    createdBy: int("createdBy").references(() => users.id, { onDelete: "set null" }),
    approvedBy: int("approvedBy").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    versionUnique: uniqueIndex("drafts_case_version_unique").on(table.caseId, table.versionNo),
    caseIdx: index("drafts_case_idx").on(table.caseId),
    statusIdx: index("drafts_status_idx").on(table.status),
    providerSettingIdx: index("drafts_provider_setting_idx").on(table.providerSettingId),
    generatedByJobIdx: index("drafts_generated_by_job_idx").on(table.generatedByJobId),
    createdByIdx: index("drafts_created_by_idx").on(table.createdBy),
    approvedByIdx: index("drafts_approved_by_idx").on(table.approvedBy),
  }),
);

export const draftSections = mysqlTable(
  "draft_sections",
  {
    id: int("id").autoincrement().primaryKey(),
    draftId: int("draftId")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    sectionKey: mysqlEnum("sectionKey", ["header", "facts", "issues", "reasoning", "operative_part"]).notNull(),
    sectionTitle: varchar("sectionTitle", { length: 200 }).notNull(),
    sectionOrder: int("sectionOrder").notNull(),
    sectionText: text("sectionText").notNull(),
    reviewStatus: mysqlEnum("reviewStatus", ["draft", "reviewed", "approved"]).default("draft").notNull(),
    authorNote: text("authorNote"),
    lastEditedBy: int("lastEditedBy").references(() => users.id, { onDelete: "set null" }),
    approvedBy: int("approvedBy").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approvedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    draftSectionUnique: uniqueIndex("draft_sections_draft_key_unique").on(table.draftId, table.sectionKey),
    draftIdx: index("draft_sections_draft_idx").on(table.draftId),
    statusIdx: index("draft_sections_status_idx").on(table.reviewStatus),
    lastEditedByIdx: index("draft_sections_last_edited_by_idx").on(table.lastEditedBy),
    approvedByIdx: index("draft_sections_approved_by_idx").on(table.approvedBy),
  }),
);

export const draftParagraphs = mysqlTable(
  "draft_paragraphs",
  {
    id: int("id").autoincrement().primaryKey(),
    sectionId: int("sectionId")
      .notNull()
      .references(() => draftSections.id, { onDelete: "cascade" }),
    paragraphOrder: int("paragraphOrder").notNull(),
    paragraphText: text("paragraphText").notNull(),
    rationale: text("rationale"),
    confidenceScore: decimal("confidenceScore", { precision: 4, scale: 3 }),
    reviewStatus: mysqlEnum("reviewStatus", ["draft", "reviewed", "approved"]).default("draft").notNull(),
    editedBy: int("editedBy").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    paragraphUnique: uniqueIndex("draft_paragraphs_section_order_unique").on(table.sectionId, table.paragraphOrder),
    sectionIdx: index("draft_paragraphs_section_idx").on(table.sectionId),
    statusIdx: index("draft_paragraphs_status_idx").on(table.reviewStatus),
    editedByIdx: index("draft_paragraphs_edited_by_idx").on(table.editedBy),
  }),
);

export const paragraphAnnotations = mysqlTable(
  "paragraph_annotations",
  {
    id: int("id").autoincrement().primaryKey(),
    paragraphId: int("paragraphId")
      .notNull()
      .references(() => draftParagraphs.id, { onDelete: "cascade" }),
    sourceType: mysqlEnum("sourceType", ["case_document", "knowledge_document", "statute", "regulation", "precedent", "reference"]).notNull(),
    caseDocumentId: int("caseDocumentId").references(() => caseDocuments.id, { onDelete: "set null" }),
    knowledgeDocumentId: int("knowledgeDocumentId").references(() => knowledgeDocuments.id, { onDelete: "set null" }),
    sourceLabel: varchar("sourceLabel", { length: 255 }).notNull(),
    sourceLocator: varchar("sourceLocator", { length: 255 }),
    quotedText: text("quotedText"),
    rationaleNote: text("rationaleNote"),
    relevanceScore: decimal("relevanceScore", { precision: 4, scale: 3 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    paragraphIdx: index("paragraph_annotations_paragraph_idx").on(table.paragraphId),
    sourceTypeIdx: index("paragraph_annotations_source_type_idx").on(table.sourceType),
    caseDocIdx: index("paragraph_annotations_case_doc_idx").on(table.caseDocumentId),
    knowledgeDocIdx: index("paragraph_annotations_knowledge_doc_idx").on(table.knowledgeDocumentId),
  }),
);

export const reviewApprovalThresholds = mysqlTable(
  "review_approval_thresholds",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerUserId: int("ownerUserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    caseTypeKey: mysqlEnum("caseTypeKey", ["inheritance"]).default("inheritance").notNull(),
    minimumQualityScore: int("minimumQualityScore").default(72).notNull(),
    requireReadyForSignature: boolean("requireReadyForSignature").default(true).notNull(),
    maxHighSeverityFindings: int("maxHighSeverityFindings").default(0).notNull(),
    maxMediumSeverityFindings: int("maxMediumSeverityFindings").default(2).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    ownerCaseTypeUnique: uniqueIndex("review_thresholds_owner_case_type_unique").on(table.ownerUserId, table.caseTypeKey),
    ownerIdx: index("review_thresholds_owner_idx").on(table.ownerUserId),
    caseTypeIdx: index("review_thresholds_case_type_idx").on(table.caseTypeKey),
  }),
);

export const caseReviewSnapshots = mysqlTable(
  "case_review_snapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    draftId: int("draftId").references(() => drafts.id, { onDelete: "set null" }),
    draftVersionNo: int("draftVersionNo"),
    reviewTemplateKey: mysqlEnum("reviewTemplateKey", ["inheritance"]).default("inheritance").notNull(),
    reviewTemplateFocus: text("reviewTemplateFocus"),
    judgmentTextSnapshot: text("judgmentTextSnapshot"),
    outcomeAssessment: mysqlEnum("outcomeAssessment", ["supported", "partially_supported", "contradicted", "insufficient_basis"]).notNull(),
    confidenceScore: varchar("confidenceScore", { length: 32 }).notNull(),
    qualityScore: int("qualityScore").notNull(),
    readyForSignature: boolean("readyForSignature").default(false).notNull(),
    highSeverityCount: int("highSeverityCount").default(0).notNull(),
    mediumSeverityCount: int("mediumSeverityCount").default(0).notNull(),
    providerSettingId: int("providerSettingId"),
    resultJson: json("resultJson").$type<Record<string, unknown> | null>(),
    createdBy: int("createdBy").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    providerSettingFk: foreignKey({
      name: "case_review_snapshots_provider_fk",
      columns: [table.providerSettingId],
      foreignColumns: [aiProviderSettings.id],
    }).onDelete("set null"),
    caseIdx: index("case_review_snapshots_case_idx").on(table.caseId),
    draftIdx: index("case_review_snapshots_draft_idx").on(table.draftId),
    caseDraftCreatedIdx: index("case_review_snapshots_case_draft_created_idx").on(table.caseId, table.draftId, table.createdAt),
    createdByIdx: index("case_review_snapshots_created_by_idx").on(table.createdBy),
    providerIdx: index("case_review_snapshots_provider_idx").on(table.providerSettingId),
  }),
);

export const reviewFindingResolutions = mysqlTable(
  "review_finding_resolutions",
  {
    id: int("id").autoincrement().primaryKey(),
    reviewSnapshotId: int("reviewSnapshotId")
      .notNull()
      .references(() => caseReviewSnapshots.id, { onDelete: "cascade" }),
    findingIndex: int("findingIndex").notNull(),
    status: mysqlEnum("status", ["addressed", "accepted", "deferred"]).notNull(),
    note: text("note"),
    resolvedBy: int("resolvedBy").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    uniqueSnapshotFinding: uniqueIndex("review_finding_resolutions_unique_idx").on(
      table.reviewSnapshotId,
      table.findingIndex,
    ),
    snapshotIdx: index("review_finding_resolutions_snapshot_idx").on(table.reviewSnapshotId),
  }),
);

export const decisionExports = mysqlTable(
  "decision_exports",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    draftId: int("draftId")
      .notNull()
      .references(() => drafts.id, { onDelete: "cascade" }),
    format: mysqlEnum("format", ["docx"]).default("docx").notNull(),
    status: mysqlEnum("status", ["queued", "ready", "failed"]).default("queued").notNull(),
    fileKey: varchar("fileKey", { length: 500 }),
    fileUrl: varchar("fileUrl", { length: 1000 }),
    requestedBy: int("requestedBy").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    caseIdx: index("decision_exports_case_idx").on(table.caseId),
    draftIdx: index("decision_exports_draft_idx").on(table.draftId),
    statusIdx: index("decision_exports_status_idx").on(table.status),
    requestedByIdx: index("decision_exports_requested_by_idx").on(table.requestedBy),
  }),
);

export const caseActivityLogs = mysqlTable(
  "case_activity_logs",
  {
    id: int("id").autoincrement().primaryKey(),
    caseId: int("caseId")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    actorUserId: int("actorUserId").references(() => users.id, { onDelete: "set null" }),
    actionType: varchar("actionType", { length: 120 }).notNull(),
    entityType: varchar("entityType", { length: 120 }).notNull(),
    entityId: int("entityId"),
    summary: varchar("summary", { length: 255 }).notNull(),
    detailsJson: json("detailsJson").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    caseIdx: index("case_activity_logs_case_idx").on(table.caseId),
    actorIdx: index("case_activity_logs_actor_idx").on(table.actorUserId),
    actionIdx: index("case_activity_logs_action_idx").on(table.actionType),
    // Composite: timeline queries (WHERE caseId = ? ORDER BY createdAt DESC)
    caseCreatedIdx: index("case_activity_logs_case_created_idx").on(table.caseId, table.createdAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = typeof userSessions.$inferInsert;

export type AiProviderSetting = typeof aiProviderSettings.$inferSelect;
export type InsertAiProviderSetting = typeof aiProviderSettings.$inferInsert;

export type KnowledgeDocument = typeof knowledgeDocuments.$inferSelect;
export type InsertKnowledgeDocument = typeof knowledgeDocuments.$inferInsert;

export type Case = typeof cases.$inferSelect;
export type InsertCase = typeof cases.$inferInsert;

export type CaseParty = typeof caseParties.$inferSelect;
export type InsertCaseParty = typeof caseParties.$inferInsert;

export type CaseDocument = typeof caseDocuments.$inferSelect;
export type InsertCaseDocument = typeof caseDocuments.$inferInsert;

export type ProcessingJob = typeof processingJobs.$inferSelect;
export type InsertProcessingJob = typeof processingJobs.$inferInsert;

export type OcrSetting = typeof ocrSettings.$inferSelect;
export type InsertOcrSetting = typeof ocrSettings.$inferInsert;

export type Draft = typeof drafts.$inferSelect;
export type InsertDraft = typeof drafts.$inferInsert;

export type DraftSection = typeof draftSections.$inferSelect;
export type InsertDraftSection = typeof draftSections.$inferInsert;

export type DraftParagraph = typeof draftParagraphs.$inferSelect;
export type InsertDraftParagraph = typeof draftParagraphs.$inferInsert;

export type ParagraphAnnotation = typeof paragraphAnnotations.$inferSelect;
export type InsertParagraphAnnotation = typeof paragraphAnnotations.$inferInsert;

export type ReviewApprovalThreshold = typeof reviewApprovalThresholds.$inferSelect;
export type InsertReviewApprovalThreshold = typeof reviewApprovalThresholds.$inferInsert;

export type CaseReviewSnapshot = typeof caseReviewSnapshots.$inferSelect;
export type InsertCaseReviewSnapshot = typeof caseReviewSnapshots.$inferInsert;

export type ReviewFindingResolution = typeof reviewFindingResolutions.$inferSelect;
export type InsertReviewFindingResolution = typeof reviewFindingResolutions.$inferInsert;

export type DecisionExport = typeof decisionExports.$inferSelect;
export type InsertDecisionExport = typeof decisionExports.$inferInsert;

export const judgeStyleProfiles = mysqlTable(
  "judge_style_profiles",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
    profileJson: json("profileJson").$type<Record<string, unknown> | null>(),
    judgmentCount: int("judgmentCount").default(0).notNull(),
    minConfidenceScore: int("minConfidenceScore").default(0),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userIdx: index("judge_style_profiles_user_idx").on(table.userId),
    statusIdx: index("judge_style_profiles_status_idx").on(table.status),
  }),
);

export const judgeStyleJudgments = mysqlTable(
  "judge_style_judgments",
  {
    id: int("id").autoincrement().primaryKey(),
    profileId: int("profileId").notNull().references(() => judgeStyleProfiles.id, { onDelete: "cascade" }),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 255 }).notNull(),
    fileKey: varchar("fileKey", { length: 500 }).notNull(),
    fileUrl: varchar("fileUrl", { length: 500 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    extractedText: text("extractedText"),
    caseType: varchar("caseType", { length: 120 }),
    jurisdictionCode: varchar("jurisdictionCode", { length: 120 }),
    judgmentDate: timestamp("judgmentDate"),
    tagsJson: json("tagsJson").$type<string[] | null>(),
    analysisJson: json("analysisJson").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    profileIdx: index("judge_style_judgments_profile_idx").on(table.profileId),
    userIdx: index("judge_style_judgments_user_idx").on(table.userId),
  }),
);

export type JudgeStyleProfile = typeof judgeStyleProfiles.$inferSelect;
export type InsertJudgeStyleProfile = typeof judgeStyleProfiles.$inferInsert;

export type JudgeStyleJudgment = typeof judgeStyleJudgments.$inferSelect;
export type InsertJudgeStyleJudgment = typeof judgeStyleJudgments.$inferInsert;

export type CaseActivityLog = typeof caseActivityLogs.$inferSelect;
export type InsertCaseActivityLog = typeof caseActivityLogs.$inferInsert;
