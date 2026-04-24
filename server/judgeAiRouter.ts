import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getRecentLogs } from "./_core/logger";
import {
  createCase,
  getCaseByIdForUser,
  getCaseWorkspace,
  getDraftParagraphCaseId,
  getDraftSectionCaseId,
  getKnowledgeDocumentById,
  getLatestProcessingJobForCase,
  listCases,
  listKnowledgeDocuments,
  listUsers,
  updateUserRoleAndStatus,
  updateCaseStatus,
  archiveCase,
  updateCase,
  deleteCase,
  updateProcessingJob,
  resetSystemData,
  purgeUploadsDirectory,
} from "./db";
import {
  activateProviderSettings,
  approveDraftAndLog,
  exportCaseReviewReport,
  exportDraftAsDocx,
  exportCaseBundle,
  generateStructuredDraft,
  getCaseTimeline,
  listCasesWithStaleReview,
  getReviewApprovalThresholds,
  batchImportCaseDocuments,
  batchImportKnowledgeDocuments,
  getDownloadUrlForCaseDocument,
  getDownloadUrlForDecisionExport,
  getDownloadUrlForKnowledgeDocument,
  getProviderSettingsForAdmin,
  ingestCaseDocument,
  ingestJudgeStyleJudgment,
  ingestKnowledgeDocument,
  analyzeJudgeStyleProfile,
  runSearch,
  runCrossCaseSearch,
  getUsageDashboardStats,
  saveProviderSettings,
  saveReviewApprovalThreshold,
  testProviderConnectivity,
  reviewCaseAgainstEvidence,
  reviewCasesBatch,
  listFindingResolutions,
  saveFindingResolution,
  removeFindingResolution,
  explainFinding,
  getOcrSettingsForAdmin,
  saveOcrSettingsForAdmin,
  testOcrProvider,
  updateDraftParagraphWithAudit,
  updateDraftSectionReview,
  saveSectionAuthorNote,
  transcribeAndSaveSectionNote,
} from "./judgeAiService";
import { adminProcedure, protectedProcedure, router } from "./_core/trpc";

// Provider routes intentionally use protectedProcedure so all authenticated
// users (judges and admins) can configure and test AI providers.

const casePartySchema = z.object({
  partyType: z.enum([
    "claimant",
    "defendant",
    "respondent",
    "appellant",
    "appellee",
    "interested_party",
    "other",
  ]),
  name: z.string().min(1).max(255),
  representativeName: z.string().max(255).nullish(),
  identifier: z.string().max(120).nullish(),
  address: z.string().max(2000).nullish(),
  isOrganization: z.boolean().default(false),
});

const baseDocumentUploadSchema = z.object({
  title: z.string().min(1).max(255),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  base64Content: z.string().min(1),
  metadataJson: z.record(z.string(), z.unknown()).nullish(),
});

async function assertCaseAccess(caseId: number, user: { id: number; role: "judge" | "admin" }) {
  const caseRecord = await getCaseByIdForUser(caseId, user);
  if (!caseRecord) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Case was not found" });
  }
  return caseRecord;
}

export const judgeAiRouter = router({
  admin: router({
    listUsers: adminProcedure.query(async () => listUsers()),
    usageStats: adminProcedure
      .input(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }).optional())
      .query(async ({ input }) => getUsageDashboardStats(input?.days ?? 30)),
    updateUser: adminProcedure
      .input(
        z.object({
          userId: z.coerce.number().int().positive(),
          role: z.enum(["judge", "admin"]).optional(),
          status: z.enum(["active", "suspended"]).optional(),
          title: z.string().max(120).nullable().optional(),
          autoApprove: z.boolean().optional(),
        }),
      )
      .mutation(async ({ input }) => updateUserRoleAndStatus(input.userId, input)),
    toggleAutoApprove: protectedProcedure
      .input(z.object({ autoApprove: z.boolean() }))
      .mutation(async ({ ctx, input }) =>
        updateUserRoleAndStatus(ctx.user.id, { autoApprove: input.autoApprove }),
      ),
    listProviderSettings: protectedProcedure.query(async () => getProviderSettingsForAdmin()),
    saveProviderSettings: protectedProcedure
      .input(
        z.object({
          id: z.coerce.number().int().positive().optional(),
          name: z.string().min(1).max(180),
          providerType: z.enum(["openai", "azure_openai", "custom_openai_compatible", "alibaba_cloud", "kimi", "deepseek"]),
          endpoint: z.string().url(),
          model: z.string().min(1).max(180),
          apiKey: z.string().min(1).max(500).nullable().optional(),
          azureApiVersion: z.string().max(80).nullable().optional(),
          defaultSystemPrompt: z.string().max(20000).nullable().optional(),
          draftTemperature: z.string().max(12).nullable().optional(),
          maxTokens: z.coerce.number().int().min(256).max(65536).nullable().optional(),
          fallbackOrder: z.coerce.number().int().min(0).max(999).nullable().optional(),
          isActive: z.boolean().optional(),
          isArchived: z.boolean().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        saveProviderSettings({
          ...input,
          userId: ctx.user.id,
        }),
      ),
    testProviderSettings: protectedProcedure
      .input(
        z.object({
          id: z.coerce.number().int().positive().optional(),
          providerType: z.enum(["openai", "azure_openai", "custom_openai_compatible", "alibaba_cloud", "kimi", "deepseek"]),
          endpoint: z.string().url(),
          model: z.string().min(1).max(180),
          apiKey: z.string().min(1).max(500).nullable().optional(),
          azureApiVersion: z.string().max(80).nullable().optional(),
        }),
      )
      .mutation(async ({ input }) => testProviderConnectivity(input)),
    activateProviderSettings: protectedProcedure
      .input(z.object({ providerId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => activateProviderSettings(input.providerId, ctx.user.id)),
    logs: protectedProcedure
      .input(z.object({ lines: z.coerce.number().int().min(1).max(5000).default(500) }))
      .query(({ input }) => {
        return getRecentLogs(input.lines);
      }),
    resetSystem: adminProcedure
      .input(
        z.object({
          scope: z.enum(["factory", "program_data", "settings"]),
          confirmation: z.literal("RESET"),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const result = await resetSystemData(input.scope, ctx.user.id);
        let filesRemoved = 0;
        if (input.scope === "factory" || input.scope === "program_data") {
          filesRemoved = await purgeUploadsDirectory();
        }
        return { ...result, filesRemoved };
      }),

    getOcrSettings: protectedProcedure.query(async () => {
      return getOcrSettingsForAdmin();
    }),

    saveOcrSettings: protectedProcedure
      .input(
        z.object({
          enabled: z.boolean().optional(),
          provider: z.string().min(1).max(64).optional(),
          language: z.string().min(1).max(32).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        return saveOcrSettingsForAdmin(input);
      }),

    testOcr: protectedProcedure
      .input(
        z.object({
          base64Image: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        return testOcrProvider(input.base64Image);
      }),
  }),

  judgeStyle: router({
    createProfile: protectedProcedure
      .input(z.object({ name: z.string().min(1).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const { createJudgeStyleProfile } = await import("./db");
        return createJudgeStyleProfile({
          userId: ctx.user.id,
          name: input.name,
          status: "active",
          profileJson: null,
          judgmentCount: 0,
          minConfidenceScore: 0,
        });
      }),
    listProfiles: protectedProcedure.query(async ({ ctx }) => {
      const { listJudgeStyleProfiles } = await import("./db");
      return listJudgeStyleProfiles(ctx.user.id);
    }),
    deleteProfile: protectedProcedure
      .input(z.object({ profileId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { getJudgeStyleProfileById, deleteJudgeStyleProfile } = await import("./db");
        const profile = await getJudgeStyleProfileById(input.profileId);
        if (!profile || profile.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
        }
        await deleteJudgeStyleProfile(input.profileId);
        return { success: true };
      }),
    uploadJudgment: protectedProcedure
      .input(
        z.object({
          profileId: z.coerce.number().int().positive(),
          title: z.string().min(1).max(255),
          fileName: z.string().min(1).max(255),
          mimeType: z.string().min(1).max(255),
          base64Content: z.string().min(1),
          caseType: z.string().max(120).nullable().optional(),
          jurisdictionCode: z.string().max(120).nullable().optional(),
          judgmentDate: z.coerce.date().nullable().optional(),
          tags: z.array(z.string()).nullable().optional(),
          splitMode: z.boolean().optional().default(false),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const { getJudgeStyleProfileById } = await import("./db");
        const profile = await getJudgeStyleProfileById(input.profileId);
        if (!profile || profile.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
        }
        return ingestJudgeStyleJudgment({ ...input, userId: ctx.user.id });
      }),
    listJudgments: protectedProcedure
      .input(z.object({ profileId: z.coerce.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const { getJudgeStyleProfileById, listJudgeStyleJudgments } = await import("./db");
        const profile = await getJudgeStyleProfileById(input.profileId);
        if (!profile || profile.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Profile not found" });
        }
        return listJudgeStyleJudgments(input.profileId);
      }),
    deleteJudgment: protectedProcedure
      .input(z.object({ judgmentId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const { getJudgeStyleJudgmentById, deleteJudgeStyleJudgment } = await import("./db");
        const row = await getJudgeStyleJudgmentById(input.judgmentId);
        if (!row || row.profile.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Judgment not found" });
        }
        await deleteJudgeStyleJudgment(input.judgmentId);
        return { success: true };
      }),
    generateProfile: protectedProcedure
      .input(z.object({ profileId: z.coerce.number().int().positive(), providerId: z.coerce.number().int().positive().nullable().optional() }))
      .mutation(async ({ ctx, input }) => {
        return analyzeJudgeStyleProfile(input.profileId, ctx.user.id, input.providerId ?? null);
      }),
  }),

  knowledge: router({
    list: protectedProcedure
      .input(
        z
          .object({
            query: z.string().max(255).optional(),
            documentType: z.enum(["statute", "regulation", "precedent", "reference", "other"]).optional(),
            jurisdictionCode: z.string().max(50).optional(),
            processingStatus: z.enum(["uploaded", "processing", "processed", "failed", "duplicate"]).optional(),
          })
          .optional(),
      )
      .query(async ({ input }) => listKnowledgeDocuments(input ?? {})),
    upload: protectedProcedure
      .input(
        baseDocumentUploadSchema.extend({
          documentType: z.enum(["statute", "regulation", "precedent", "reference", "other"]),
          jurisdictionCode: z.string().min(1).max(50),
          courtLevel: z.string().max(120).nullable().optional(),
          citation: z.string().max(255).nullable().optional(),
          sourceReference: z.string().max(500).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        ingestKnowledgeDocument({
          ...input,
          userId: ctx.user.id,
        }),
      ),
    batchUpload: protectedProcedure
      .input(
        z.object({
          jurisdictionCode: z.string().min(1).max(50),
          courtLevel: z.string().max(120).nullable().optional(),
          files: z
            .array(
              z.object({
                title: z.string().max(255).nullish(),
                fileName: z.string().min(1).max(255),
                mimeType: z.string().min(1).max(255),
                base64Content: z.string().min(1),
                metadataJson: z.record(z.string(), z.unknown()).nullish(),
              }),
            )
            .min(1)
            .max(20),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        batchImportKnowledgeDocuments({
          userId: ctx.user.id,
          jurisdictionCode: input.jurisdictionCode,
          courtLevel: input.courtLevel ?? null,
          files: input.files,
        }),
      ),
    downloadUrl: protectedProcedure
      .input(z.object({ documentId: z.coerce.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const doc = await getKnowledgeDocumentById(input.documentId);
        if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return getDownloadUrlForKnowledgeDocument(input.documentId);
      }),
  }),

  cases: router({
    list: protectedProcedure
      .input(
        z
          .object({
            query: z.string().max(255).optional(),
            status: z.enum(["created", "document_review", "drafting", "under_review", "approved", "archived"]).optional(),
            jurisdictionCode: z.string().max(50).optional(),
            caseType: z.string().max(120).optional(),
            includeArchived: z.boolean().optional(),
          })
          .optional(),
      )
      .query(async ({ ctx, input }) => listCases(ctx.user, input ?? {})),
    create: protectedProcedure
      .input(
        z.object({
          caseNumber: z.string().min(1).max(120),
          title: z.string().min(1).max(255),
          jurisdictionCode: z.string().min(1).max(50),
          courtLevel: z.string().min(1).max(120),
          caseType: z.string().min(1).max(120),
          languageCode: z.string().max(16).optional(),
          summary: z.string().max(20000).nullable().optional(),
          assignedJudgeId: z.coerce.number().int().positive().nullable().optional(),
          parties: z.array(casePartySchema).default([]),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        createCase({
          ...input,
          createdBy: ctx.user.id,
        }),
      ),
    workspace: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return getCaseWorkspace(input.caseId, ctx.user);
      }),
    updateStatus: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          status: z.enum(["created", "document_review", "drafting", "under_review", "approved", "archived"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return updateCaseStatus(input.caseId, input.status, ctx.user.id);
      }),
    archive: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        await archiveCase(input.caseId, ctx.user.id);
        return { success: true } as const;
      }),
    update: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          caseNumber: z.string().min(1).max(120),
          title: z.string().min(1).max(255),
          jurisdictionCode: z.string().min(1).max(50),
          courtLevel: z.string().min(1).max(120),
          caseType: z.string().min(1).max(120),
          languageCode: z.string().max(16).optional(),
          summary: z.string().max(20000).nullable().optional(),
          assignedJudgeId: z.coerce.number().int().positive().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return updateCase(input.caseId, input, ctx.user.id);
      }),
    delete: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        const deleted = await deleteCase(input.caseId, ctx.user.id);
        if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Case not found" });
        return { success: true } as const;
      }),
    uploadDocument: protectedProcedure
      .input(
        baseDocumentUploadSchema.extend({
          caseId: z.coerce.number().int().positive(),
          documentType: z.enum(["pleading", "evidence", "supporting", "reference", "decision", "other"]),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return ingestCaseDocument({
          ...input,
          userId: ctx.user.id,
        });
      }),
    batchImportDocuments: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          files: z
            .array(
              z.object({
                title: z.string().max(255).nullish(),
                fileName: z.string().min(1).max(255),
                mimeType: z.string().min(1).max(255),
                base64Content: z.string().min(1),
                metadataJson: z.record(z.string(), z.unknown()).nullish(),
              }),
            )
            .min(1)
            .max(20),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return batchImportCaseDocuments({
          caseId: input.caseId,
          userId: ctx.user.id,
          files: input.files,
        });
      }),
    timeline: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return getCaseTimeline(input.caseId);
      }),
    staleReviews: protectedProcedure.query(async ({ ctx }) =>
      listCasesWithStaleReview(ctx.user.id, ctx.user.role as "judge" | "admin"),
    ),
    search: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive(), query: z.string().min(1).max(255) }))
      .query(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return runSearch(input.caseId, input.query);
      }),
    crossCaseSearch: protectedProcedure
      .input(z.object({ query: z.string().min(2).max(255) }))
      .query(async ({ ctx, input }) =>
        runCrossCaseSearch(ctx.user.id, ctx.user.role as "judge" | "admin", input.query),
      ),
    reviewThresholds: protectedProcedure.query(async ({ ctx }) => getReviewApprovalThresholds(ctx.user.id)),
    saveReviewThreshold: protectedProcedure
      .input(
        z.object({
          caseTypeKey: z.enum(["inheritance"]).optional().default("inheritance"),
          minimumQualityScore: z.coerce.number().int().min(0).max(100),
          requireReadyForSignature: z.boolean(),
          maxHighSeverityFindings: z.coerce.number().int().min(0).max(20),
          maxMediumSeverityFindings: z.coerce.number().int().min(0).max(50),
        }),
      )
      .mutation(async ({ ctx, input }) =>
        saveReviewApprovalThreshold({
          ...input,
          userId: ctx.user.id,
        }),
      ),
    reviewJudgment: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          judgmentText: z.string().max(12000).nullable().optional(),
          providerId: z.coerce.number().int().positive().nullable().optional(),
          reviewTemplateKey: z.enum(["inheritance"]).optional(),
          reviewTemplateFocus: z.string().max(1200).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return reviewCaseAgainstEvidence({
          caseId: input.caseId,
          userId: ctx.user.id,
          userRole: ctx.user.role as "judge" | "admin",
          judgmentText: input.judgmentText ?? null,
          providerId: input.providerId ?? null,
          reviewTemplateKey: input.reviewTemplateKey,
          reviewTemplateFocus: input.reviewTemplateFocus ?? null,
        });
      }),
    findingResolutions: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive(), reviewSnapshotId: z.coerce.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return listFindingResolutions({ caseId: input.caseId, reviewSnapshotId: input.reviewSnapshotId });
      }),
    setFindingResolution: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          reviewSnapshotId: z.coerce.number().int().positive(),
          findingIndex: z.coerce.number().int().min(0).max(999),
          status: z.enum(["addressed", "accepted", "deferred"]),
          note: z.string().max(2000).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return saveFindingResolution({
          caseId: input.caseId,
          reviewSnapshotId: input.reviewSnapshotId,
          findingIndex: input.findingIndex,
          status: input.status,
          note: input.note ?? null,
          userId: ctx.user.id,
        });
      }),
    clearFindingResolution: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          reviewSnapshotId: z.coerce.number().int().positive(),
          findingIndex: z.coerce.number().int().min(0).max(999),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return removeFindingResolution({
          caseId: input.caseId,
          reviewSnapshotId: input.reviewSnapshotId,
          findingIndex: input.findingIndex,
        });
      }),
    explainFinding: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          reviewSnapshotId: z.coerce.number().int().positive(),
          findingIndex: z.coerce.number().int().min(0).max(999),
          providerId: z.coerce.number().int().positive().nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return explainFinding({
          caseId: input.caseId,
          reviewSnapshotId: input.reviewSnapshotId,
          findingIndex: input.findingIndex,
          providerId: input.providerId ?? null,
          userId: ctx.user.id,
          userRole: ctx.user.role as "judge" | "admin",
        });
      }),
    reviewBatch: protectedProcedure
      .input(
        z.object({
          caseIds: z.array(z.coerce.number().int().positive()).min(1).max(25),
          providerId: z.coerce.number().int().positive().nullable().optional(),
          reviewTemplateKey: z.enum(["inheritance"]).optional(),
          reviewTemplateFocus: z.string().max(1200).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        for (const caseId of input.caseIds) {
          await assertCaseAccess(caseId, ctx.user);
        }
        return reviewCasesBatch({
          caseIds: input.caseIds,
          userId: ctx.user.id,
          userRole: ctx.user.role as "judge" | "admin",
          providerId: input.providerId ?? null,
          reviewTemplateKey: input.reviewTemplateKey,
          reviewTemplateFocus: input.reviewTemplateFocus ?? null,
        });
      }),
    exportBundle: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return exportCaseBundle({
          caseId: input.caseId,
          userId: ctx.user.id,
          userRole: ctx.user.role as "judge" | "admin",
        });
      }),
    exportReviewReport: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          reviewSnapshotId: z.coerce.number().int().positive(),
          format: z.enum(["docx", "pdf"]).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return exportCaseReviewReport({
          caseId: input.caseId,
          reviewSnapshotId: input.reviewSnapshotId,
          userId: ctx.user.id,
          userRole: ctx.user.role as "judge" | "admin",
          format: input.format,
          signerName: ctx.user.name ?? ctx.user.email ?? `User ${ctx.user.id}`,
          signerRoleLabel: ctx.user.role,
        });
      }),
    downloadUrl: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          documentId: z.coerce.number().int().positive(),
        }),
      )
      .query(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return getDownloadUrlForCaseDocument(input.documentId, input.caseId);
      }),
  }),

  drafts: router({
    generate: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          providerId: z.coerce.number().int().positive().nullable().optional(),
          profileId: z.coerce.number().int().positive().nullable().optional(),
          reviewContext: z.string().optional().nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return generateStructuredDraft({
          caseId: input.caseId,
          userId: ctx.user.id,
          userRole: ctx.user.role,
          providerId: input.providerId ?? null,
          profileId: input.profileId ?? null,
          reviewContext: input.reviewContext ?? null,
        });
      }),
    jobStatus: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        const job = await getLatestProcessingJobForCase(input.caseId, "draft_generation");
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
      }),
    cancel: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        const job = await getLatestProcessingJobForCase(input.caseId, "draft_generation");
        if (job && job.status === "running") {
          await updateProcessingJob(job.id, {
            status: "failed",
            errorMessage: "Cancelled by user",
          });
        }
        return { success: true } as const;
      }),
    updateParagraph: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          paragraphId: z.coerce.number().int().positive(),
          paragraphText: z.string().max(20000).optional(),
          rationale: z.string().max(4000).nullable().optional(),
          confidenceScore: z.string().max(12).nullable().optional(),
          reviewStatus: z.enum(["draft", "reviewed", "approved"]).optional(),
          annotations: z
            .array(
              z.object({
                sourceType: z.enum(["case_document", "knowledge_document", "statute", "regulation", "precedent", "reference"]),
                caseDocumentId: z.coerce.number().int().positive().nullable().optional(),
                knowledgeDocumentId: z.coerce.number().int().positive().nullable().optional(),
                sourceLabel: z.string().min(1).max(255),
                sourceLocator: z.string().max(255).nullable().optional(),
                quotedText: z.string().max(4000).nullable().optional(),
                rationaleNote: z.string().max(2000).nullable().optional(),
                relevanceScore: z.string().max(12).nullable().optional(),
              }),
            )
            .optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        const paragraphCaseId = await getDraftParagraphCaseId(input.paragraphId);
        if (paragraphCaseId !== input.caseId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Paragraph not found in this case" });
        }
        return updateDraftParagraphWithAudit({
          ...input,
          userId: ctx.user.id,
        });
      }),
    updateSection: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          sectionId: z.coerce.number().int().positive(),
          reviewStatus: z.enum(["draft", "reviewed", "approved"]),
          sectionText: z.string().max(30000).optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        const sectionCaseId = await getDraftSectionCaseId(input.sectionId);
        if (sectionCaseId !== input.caseId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Section not found in this case" });
        }
        return updateDraftSectionReview({
          ...input,
          userId: ctx.user.id,
        });
      }),
    saveSectionNote: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          sectionId: z.coerce.number().int().positive(),
          authorNote: z.string().max(20000).nullable(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        const sectionCaseId = await getDraftSectionCaseId(input.sectionId);
        if (sectionCaseId !== input.caseId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Section not found in this case" });
        }
        return saveSectionAuthorNote({
          sectionId: input.sectionId,
          caseId: input.caseId,
          userId: ctx.user.id,
          authorNote: input.authorNote,
        });
      }),
    transcribeSectionNote: protectedProcedure
      .input(
        z.object({
          caseId: z.coerce.number().int().positive(),
          sectionId: z.coerce.number().int().positive(),
          base64Audio: z.string().min(1),
          mimeType: z.string().min(1).max(120),
          append: z.boolean().default(true),
          existingNote: z.string().max(20000).nullable().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        const sectionCaseId = await getDraftSectionCaseId(input.sectionId);
        if (sectionCaseId !== input.caseId) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Section not found in this case" });
        }
        return transcribeAndSaveSectionNote({
          sectionId: input.sectionId,
          caseId: input.caseId,
          userId: ctx.user.id,
          base64Audio: input.base64Audio,
          mimeType: input.mimeType,
          append: input.append,
          existingNote: input.existingNote ?? null,
        });
      }),
    approve: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive(), draftId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return approveDraftAndLog({
          ...input,
          userId: ctx.user.id,
          userRole: ctx.user.role as "judge" | "admin",
        });
      }),
    exportDocx: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive(), draftId: z.coerce.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return exportDraftAsDocx({
          ...input,
          userId: ctx.user.id,
          userRole: ctx.user.role as "judge" | "admin",
        });
      }),
    exportDownloadUrl: protectedProcedure
      .input(z.object({ caseId: z.coerce.number().int().positive(), exportId: z.coerce.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        await assertCaseAccess(input.caseId, ctx.user);
        return getDownloadUrlForDecisionExport(input.exportId);
      }),
  }),
});
