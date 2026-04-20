ALTER TABLE `paragraph_annotations`
  ADD CONSTRAINT `para_ann_kdoc_fk`
  FOREIGN KEY (`knowledgeDocumentId`) REFERENCES `knowledge_documents`(`id`)
  ON DELETE set null ON UPDATE no action;

ALTER TABLE `processing_jobs`
  ADD CONSTRAINT `processing_jobs_caseId_cases_id_fk`
  FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`)
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE `processing_jobs`
  ADD CONSTRAINT `processing_jobs_createdBy_users_id_fk`
  FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`)
  ON DELETE set null ON UPDATE no action;

ALTER TABLE `user_sessions`
  ADD CONSTRAINT `user_sessions_userId_users_id_fk`
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
  ON DELETE cascade ON UPDATE no action;

CREATE INDEX `ai_provider_settings_active_idx` ON `ai_provider_settings` (`isActive`);
CREATE INDEX `ai_provider_settings_provider_idx` ON `ai_provider_settings` (`providerType`);
CREATE INDEX `case_activity_logs_case_idx` ON `case_activity_logs` (`caseId`);
CREATE INDEX `case_activity_logs_actor_idx` ON `case_activity_logs` (`actorUserId`);
CREATE INDEX `case_activity_logs_action_idx` ON `case_activity_logs` (`actionType`);
CREATE INDEX `case_documents_case_idx` ON `case_documents` (`caseId`);
CREATE INDEX `case_documents_hash_idx` ON `case_documents` (`fileHash`);
CREATE INDEX `case_documents_status_idx` ON `case_documents` (`uploadStatus`);
CREATE INDEX `case_documents_title_idx` ON `case_documents` (`title`);
CREATE INDEX `case_parties_case_idx` ON `case_parties` (`caseId`);
CREATE INDEX `case_parties_type_idx` ON `case_parties` (`partyType`);
CREATE INDEX `cases_status_idx` ON `cases` (`status`);
CREATE INDEX `cases_assigned_judge_idx` ON `cases` (`assignedJudgeId`);
CREATE INDEX `cases_created_by_idx` ON `cases` (`createdBy`);
CREATE INDEX `cases_title_idx` ON `cases` (`title`);
CREATE INDEX `decision_exports_case_idx` ON `decision_exports` (`caseId`);
CREATE INDEX `decision_exports_draft_idx` ON `decision_exports` (`draftId`);
CREATE INDEX `decision_exports_status_idx` ON `decision_exports` (`status`);
CREATE INDEX `draft_paragraphs_section_idx` ON `draft_paragraphs` (`sectionId`);
CREATE INDEX `draft_paragraphs_status_idx` ON `draft_paragraphs` (`reviewStatus`);
CREATE INDEX `draft_sections_draft_idx` ON `draft_sections` (`draftId`);
CREATE INDEX `draft_sections_status_idx` ON `draft_sections` (`reviewStatus`);
CREATE INDEX `drafts_case_idx` ON `drafts` (`caseId`);
CREATE INDEX `drafts_status_idx` ON `drafts` (`status`);
CREATE INDEX `knowledge_documents_hash_idx` ON `knowledge_documents` (`fileHash`);
CREATE INDEX `knowledge_documents_type_idx` ON `knowledge_documents` (`documentType`);
CREATE INDEX `knowledge_documents_status_idx` ON `knowledge_documents` (`processingStatus`);
CREATE INDEX `knowledge_documents_jurisdiction_idx` ON `knowledge_documents` (`jurisdictionCode`);
CREATE INDEX `knowledge_documents_title_idx` ON `knowledge_documents` (`title`);
CREATE FULLTEXT INDEX `case_documents_fulltext_idx` ON `case_documents` (`title`, `extractedText`);
CREATE FULLTEXT INDEX `knowledge_documents_fulltext_idx` ON `knowledge_documents` (`title`, `citation`, `summary`, `extractedText`);
CREATE INDEX `paragraph_annotations_paragraph_idx` ON `paragraph_annotations` (`paragraphId`);
CREATE INDEX `paragraph_annotations_source_type_idx` ON `paragraph_annotations` (`sourceType`);
CREATE INDEX `processing_jobs_case_idx` ON `processing_jobs` (`caseId`);
CREATE INDEX `processing_jobs_status_idx` ON `processing_jobs` (`status`);
CREATE INDEX `processing_jobs_target_idx` ON `processing_jobs` (`targetEntityType`, `targetEntityId`);
CREATE INDEX `processing_jobs_type_idx` ON `processing_jobs` (`jobType`);
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`userId`);
CREATE INDEX `user_sessions_expires_idx` ON `user_sessions` (`expiresAt`);
CREATE INDEX `users_role_idx` ON `users` (`role`);
CREATE INDEX `users_status_idx` ON `users` (`status`);
CREATE INDEX `users_email_idx` ON `users` (`email`);

INSERT INTO `__drizzle_migrations` (`hash`, `created_at`) VALUES
  ('7c15109dd5d4445451e096e1a7766fb38e6f68fdb5059ad1ca1f7b187f73c571', 1776195087508),
  ('14db1e296a82043dcc054fcc4c92077be78bbf1b47e20e7ae2a85ccde30282fc', 1776195242725);
