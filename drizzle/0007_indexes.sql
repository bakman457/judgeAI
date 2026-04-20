-- Migration 0007: performance indexes identified by database_audit
--
-- Covers three categories:
--   1. Composite indexes for the two highest-traffic query patterns
--      (timeline queries on case_activity_logs, queue-poll queries on processing_jobs)
--   2. FK columns that the schema still lacks a plain index on
--      (every foreign-key column that doesn't already have a covering index)
--
-- All statements use CREATE INDEX IF NOT EXISTS so this file is safe to
-- re-run manually or through db:push without duplicating indexes.

-- ─── 1. Composite indexes ────────────────────────────────────────────────────

-- Timeline queries: SELECT … FROM case_activity_logs WHERE caseId = ? ORDER BY createdAt DESC
CREATE INDEX IF NOT EXISTS `case_activity_logs_case_created_idx`
  ON `case_activity_logs` (`caseId`, `createdAt`);
--> statement-breakpoint

-- Queue-poll queries: SELECT … FROM processing_jobs WHERE status = ? AND jobType = ?
CREATE INDEX IF NOT EXISTS `processing_jobs_status_type_idx`
  ON `processing_jobs` (`status`, `jobType`);
--> statement-breakpoint

-- ─── 2. FK columns without a covering index ──────────────────────────────────

-- case_activity_logs.actorUserId (FK → users.id)
-- (already has case_activity_logs_actor_idx in schema — skipped)

-- drafts.providerSettingId (FK → ai_provider_settings.id)
CREATE INDEX IF NOT EXISTS `drafts_provider_setting_idx`
  ON `drafts` (`providerSettingId`);
--> statement-breakpoint

-- drafts.generatedByJobId (FK → processing_jobs.id)
CREATE INDEX IF NOT EXISTS `drafts_generated_by_job_idx`
  ON `drafts` (`generatedByJobId`);
--> statement-breakpoint

-- drafts.createdBy (FK → users.id)
CREATE INDEX IF NOT EXISTS `drafts_created_by_idx`
  ON `drafts` (`createdBy`);
--> statement-breakpoint

-- drafts.approvedBy (FK → users.id)
CREATE INDEX IF NOT EXISTS `drafts_approved_by_idx`
  ON `drafts` (`approvedBy`);
--> statement-breakpoint

-- draft_sections.lastEditedBy (FK → users.id)
CREATE INDEX IF NOT EXISTS `draft_sections_last_edited_by_idx`
  ON `draft_sections` (`lastEditedBy`);
--> statement-breakpoint

-- draft_sections.approvedBy (FK → users.id)
CREATE INDEX IF NOT EXISTS `draft_sections_approved_by_idx`
  ON `draft_sections` (`approvedBy`);
--> statement-breakpoint

-- draft_paragraphs.editedBy (FK → users.id)
CREATE INDEX IF NOT EXISTS `draft_paragraphs_edited_by_idx`
  ON `draft_paragraphs` (`editedBy`);
--> statement-breakpoint

-- paragraph_annotations.caseDocumentId (FK → case_documents.id)
CREATE INDEX IF NOT EXISTS `paragraph_annotations_case_doc_idx`
  ON `paragraph_annotations` (`caseDocumentId`);
--> statement-breakpoint

-- paragraph_annotations.knowledgeDocumentId (FK → knowledge_documents.id)
CREATE INDEX IF NOT EXISTS `paragraph_annotations_knowledge_doc_idx`
  ON `paragraph_annotations` (`knowledgeDocumentId`);
--> statement-breakpoint

-- case_review_snapshots.providerSettingId (FK → ai_provider_settings.id)
-- (already covered by providerSettingFk foreign-key definition; add plain index for query speed)
CREATE INDEX IF NOT EXISTS `case_review_snapshots_provider_idx`
  ON `case_review_snapshots` (`providerSettingId`);
--> statement-breakpoint

-- decision_exports.requestedBy (FK → users.id)
CREATE INDEX IF NOT EXISTS `decision_exports_requested_by_idx`
  ON `decision_exports` (`requestedBy`);
--> statement-breakpoint

-- processing_jobs.createdBy (FK → users.id)
CREATE INDEX IF NOT EXISTS `processing_jobs_created_by_idx`
  ON `processing_jobs` (`createdBy`);
--> statement-breakpoint

-- judge_style_profiles.userId already has judge_style_profiles_user_idx — skipped.
-- judge_style_judgments.profileId already has judge_style_judgments_profile_idx — skipped.
-- judge_style_judgments.userId already has judge_style_judgments_user_idx — skipped.
-- knowledge_documents.uploadedBy — add index
CREATE INDEX IF NOT EXISTS `knowledge_documents_uploaded_by_idx`
  ON `knowledge_documents` (`uploadedBy`);
--> statement-breakpoint

-- case_documents.uploadedBy — add index
CREATE INDEX IF NOT EXISTS `case_documents_uploaded_by_idx`
  ON `case_documents` (`uploadedBy`);
