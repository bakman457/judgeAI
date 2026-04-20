import { relations } from "drizzle-orm";
import {
  users,
  userSessions,
  aiProviderSettings,
  knowledgeDocuments,
  cases,
  caseParties,
  caseDocuments,
  processingJobs,
  drafts,
  draftSections,
  draftParagraphs,
  paragraphAnnotations,
  reviewApprovalThresholds,
  caseReviewSnapshots,
  decisionExports,
  caseActivityLogs,
  judgeStyleProfiles,
  judgeStyleJudgments,
} from "./schema";

// ============================================================================
// User Relations
// ============================================================================

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(userSessions),
  createdCases: many(cases, { relationName: "cases_createdBy" }),
  assignedCases: many(cases, { relationName: "cases_assignedJudge" }),
  providerSettings: many(aiProviderSettings, { relationName: "aiProviderSettings_createdBy" }),
  updatedProviderSettings: many(aiProviderSettings, { relationName: "aiProviderSettings_updatedBy" }),
  reviewThresholds: many(reviewApprovalThresholds),
  reviewSnapshots: many(caseReviewSnapshots, { relationName: "caseReviewSnapshots_createdBy" }),
  decisionExports: many(decisionExports, { relationName: "decisionExports_requestedBy" }),
  processingJobs: many(processingJobs, { relationName: "processingJobs_createdBy" }),
  caseActivityLogs: many(caseActivityLogs),
  updatedKnowledgeDocuments: many(knowledgeDocuments, { relationName: "knowledgeDocuments_updatedBy" }),
  uploadedCaseDocuments: many(caseDocuments, { relationName: "caseDocuments_uploadedBy" }),
  judgeStyleProfiles: many(judgeStyleProfiles),
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id],
  }),
}));

// ============================================================================
// AI Provider Settings Relations
// ============================================================================

export const aiProviderSettingsRelations = relations(aiProviderSettings, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [aiProviderSettings.createdBy],
    references: [users.id],
    relationName: "aiProviderSettings_createdBy",
  }),
  updatedByUser: one(users, {
    fields: [aiProviderSettings.updatedBy],
    references: [users.id],
    relationName: "aiProviderSettings_updatedBy",
  }),
  drafts: many(drafts),
  caseReviewSnapshots: many(caseReviewSnapshots),
}));

// ============================================================================
// Knowledge Documents Relations
// ============================================================================

export const knowledgeDocumentsRelations = relations(knowledgeDocuments, ({ one, many }) => ({
  uploadedByUser: one(users, {
    fields: [knowledgeDocuments.uploadedBy],
    references: [users.id],
    relationName: "knowledgeDocuments_updatedBy",
  }),
  duplicateOf: one(knowledgeDocuments, {
    fields: [knowledgeDocuments.duplicateOfDocumentId],
    references: [knowledgeDocuments.id],
    relationName: "knowledgeDocuments_duplicate",
  }),
  duplicates: many(knowledgeDocuments, { relationName: "knowledgeDocuments_duplicate" }),
  paragraphAnnotations: many(paragraphAnnotations),
}));

// ============================================================================
// Cases Relations
// ============================================================================

export const casesRelations = relations(cases, ({ one, many }) => ({
  createdByUser: one(users, {
    fields: [cases.createdBy],
    references: [users.id],
    relationName: "cases_createdBy",
  }),
  assignedJudgeUser: one(users, {
    fields: [cases.assignedJudgeId],
    references: [users.id],
    relationName: "cases_assignedJudge",
  }),
  parties: many(caseParties),
  documents: many(caseDocuments),
  drafts: many(drafts),
  processingJobs: many(processingJobs),
  reviewSnapshots: many(caseReviewSnapshots),
  decisionExports: many(decisionExports),
  activityLogs: many(caseActivityLogs),
}));

export const casePartiesRelations = relations(caseParties, ({ one }) => ({
  case: one(cases, {
    fields: [caseParties.caseId],
    references: [cases.id],
  }),
}));

export const caseDocumentsRelations = relations(caseDocuments, ({ one, many }) => ({
  case: one(cases, {
    fields: [caseDocuments.caseId],
    references: [cases.id],
  }),
  uploadedByUser: one(users, {
    fields: [caseDocuments.uploadedBy],
    references: [users.id],
    relationName: "caseDocuments_uploadedBy",
  }),
  duplicateOf: one(caseDocuments, {
    fields: [caseDocuments.duplicateOfDocumentId],
    references: [caseDocuments.id],
    relationName: "caseDocuments_duplicate",
  }),
  duplicates: many(caseDocuments, { relationName: "caseDocuments_duplicate" }),
  paragraphAnnotations: many(paragraphAnnotations),
}));

// ============================================================================
// Processing Jobs Relations
// ============================================================================

export const processingJobsRelations = relations(processingJobs, ({ one }) => ({
  case: one(cases, {
    fields: [processingJobs.caseId],
    references: [cases.id],
  }),
  createdByUser: one(users, {
    fields: [processingJobs.createdBy],
    references: [users.id],
    relationName: "processingJobs_createdBy",
  }),
}));

// ============================================================================
// Drafts Relations
// ============================================================================

export const draftsRelations = relations(drafts, ({ one, many }) => ({
  case: one(cases, {
    fields: [drafts.caseId],
    references: [cases.id],
  }),
  providerSetting: one(aiProviderSettings, {
    fields: [drafts.providerSettingId],
    references: [aiProviderSettings.id],
  }),
  createdByUser: one(users, {
    fields: [drafts.createdBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [drafts.approvedBy],
    references: [users.id],
  }),
  sections: many(draftSections),
  reviewSnapshots: many(caseReviewSnapshots),
}));

export const draftSectionsRelations = relations(draftSections, ({ one, many }) => ({
  draft: one(drafts, {
    fields: [draftSections.draftId],
    references: [drafts.id],
  }),
  paragraphs: many(draftParagraphs),
  lastEditedByUser: one(users, {
    fields: [draftSections.lastEditedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [draftSections.approvedBy],
    references: [users.id],
  }),
}));

export const draftParagraphsRelations = relations(draftParagraphs, ({ one, many }) => ({
  section: one(draftSections, {
    fields: [draftParagraphs.sectionId],
    references: [draftSections.id],
  }),
  editedByUser: one(users, {
    fields: [draftParagraphs.editedBy],
    references: [users.id],
  }),
  annotations: many(paragraphAnnotations),
}));

export const paragraphAnnotationsRelations = relations(paragraphAnnotations, ({ one }) => ({
  paragraph: one(draftParagraphs, {
    fields: [paragraphAnnotations.paragraphId],
    references: [draftParagraphs.id],
  }),
  caseDocument: one(caseDocuments, {
    fields: [paragraphAnnotations.caseDocumentId],
    references: [caseDocuments.id],
  }),
  knowledgeDocument: one(knowledgeDocuments, {
    fields: [paragraphAnnotations.knowledgeDocumentId],
    references: [knowledgeDocuments.id],
  }),
}));

// ============================================================================
// Review Approval Thresholds Relations
// ============================================================================

export const reviewApprovalThresholdsRelations = relations(reviewApprovalThresholds, ({ one }) => ({
  ownerUser: one(users, {
    fields: [reviewApprovalThresholds.ownerUserId],
    references: [users.id],
  }),
}));

// ============================================================================
// Case Review Snapshots Relations
// ============================================================================

export const caseReviewSnapshotsRelations = relations(caseReviewSnapshots, ({ one }) => ({
  case: one(cases, {
    fields: [caseReviewSnapshots.caseId],
    references: [cases.id],
  }),
  draft: one(drafts, {
    fields: [caseReviewSnapshots.draftId],
    references: [drafts.id],
  }),
  providerSetting: one(aiProviderSettings, {
    fields: [caseReviewSnapshots.providerSettingId],
    references: [aiProviderSettings.id],
  }),
  createdByUser: one(users, {
    fields: [caseReviewSnapshots.createdBy],
    references: [users.id],
    relationName: "caseReviewSnapshots_createdBy",
  }),
}));

// ============================================================================
// Decision Exports Relations
// ============================================================================

export const decisionExportsRelations = relations(decisionExports, ({ one }) => ({
  case: one(cases, {
    fields: [decisionExports.caseId],
    references: [cases.id],
  }),
  draft: one(drafts, {
    fields: [decisionExports.draftId],
    references: [drafts.id],
  }),
  requestedByUser: one(users, {
    fields: [decisionExports.requestedBy],
    references: [users.id],
    relationName: "decisionExports_requestedBy",
  }),
}));

// ============================================================================
// Case Activity Logs Relations
// ============================================================================

export const caseActivityLogsRelations = relations(caseActivityLogs, ({ one }) => ({
  case: one(cases, {
    fields: [caseActivityLogs.caseId],
    references: [cases.id],
  }),
  actorUser: one(users, {
    fields: [caseActivityLogs.actorUserId],
    references: [users.id],
  }),
}));

export const judgeStyleProfilesRelations = relations(judgeStyleProfiles, ({ one, many }) => ({
  user: one(users, {
    fields: [judgeStyleProfiles.userId],
    references: [users.id],
  }),
  judgments: many(judgeStyleJudgments),
}));

export const judgeStyleJudgmentsRelations = relations(judgeStyleJudgments, ({ one }) => ({
  profile: one(judgeStyleProfiles, {
    fields: [judgeStyleJudgments.profileId],
    references: [judgeStyleProfiles.id],
  }),
  user: one(users, {
    fields: [judgeStyleJudgments.userId],
    references: [users.id],
  }),
}));
