CREATE TABLE IF NOT EXISTS `ai_provider_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`providerType` enum('openai','azure_openai','custom_openai_compatible') NOT NULL,
	`endpoint` varchar(500) NOT NULL,
	`model` varchar(180) NOT NULL,
	`apiKeyEncrypted` text,
	`azureApiVersion` varchar(80),
	`defaultSystemPrompt` text,
	`draftTemperature` decimal(3,2) NOT NULL DEFAULT '0.20',
	`isActive` boolean NOT NULL DEFAULT false,
	`isArchived` boolean NOT NULL DEFAULT false,
	`createdBy` int,
	`updatedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_provider_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `case_activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`actorUserId` int,
	`actionType` varchar(120) NOT NULL,
	`entityType` varchar(120) NOT NULL,
	`entityId` int,
	`summary` varchar(255) NOT NULL,
	`detailsJson` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `case_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `case_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`documentType` enum('pleading','evidence','supporting','reference','decision','other') NOT NULL,
	`title` varchar(255) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`sizeBytes` int NOT NULL,
	`fileHash` varchar(128) NOT NULL,
	`uploadStatus` enum('uploaded','processing','processed','failed','duplicate') NOT NULL DEFAULT 'uploaded',
	`duplicateOfDocumentId` int,
	`extractedText` text,
	`metadataJson` json,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `case_parties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`partyType` enum('claimant','defendant','respondent','appellant','appellee','interested_party','other') NOT NULL,
	`name` varchar(255) NOT NULL,
	`representativeName` varchar(255),
	`identifier` varchar(120),
	`address` text,
	`isOrganization` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `case_parties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `cases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseNumber` varchar(120) NOT NULL,
	`title` varchar(255) NOT NULL,
	`jurisdictionCode` varchar(50) NOT NULL,
	`courtLevel` varchar(120) NOT NULL,
	`caseType` varchar(120) NOT NULL,
	`status` enum('created','document_review','drafting','under_review','approved','archived') NOT NULL DEFAULT 'created',
	`languageCode` varchar(16) NOT NULL DEFAULT 'en',
	`summary` text,
	`assignedJudgeId` int,
	`createdBy` int NOT NULL,
	`archivedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cases_id` PRIMARY KEY(`id`),
	CONSTRAINT `cases_number_jurisdiction_court_unique` UNIQUE(`caseNumber`,`jurisdictionCode`,`courtLevel`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `decision_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`draftId` int NOT NULL,
	`format` enum('docx') NOT NULL DEFAULT 'docx',
	`status` enum('queued','ready','failed') NOT NULL DEFAULT 'queued',
	`fileKey` varchar(500),
	`fileUrl` varchar(1000),
	`requestedBy` int,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `decision_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `draft_paragraphs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sectionId` int NOT NULL,
	`paragraphOrder` int NOT NULL,
	`paragraphText` text NOT NULL,
	`rationale` text,
	`confidenceScore` decimal(4,3),
	`reviewStatus` enum('draft','reviewed','approved') NOT NULL DEFAULT 'draft',
	`editedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `draft_paragraphs_id` PRIMARY KEY(`id`),
	CONSTRAINT `draft_paragraphs_section_order_unique` UNIQUE(`sectionId`,`paragraphOrder`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `draft_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`draftId` int NOT NULL,
	`sectionKey` enum('header','facts','issues','reasoning','operative_part') NOT NULL,
	`sectionTitle` varchar(200) NOT NULL,
	`sectionOrder` int NOT NULL,
	`sectionText` text NOT NULL,
	`reviewStatus` enum('draft','reviewed','approved') NOT NULL DEFAULT 'draft',
	`lastEditedBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `draft_sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `draft_sections_draft_key_unique` UNIQUE(`draftId`,`sectionKey`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `drafts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`versionNo` int NOT NULL,
	`status` enum('system_generated','judge_edited','reviewed','approved','archived') NOT NULL DEFAULT 'system_generated',
	`generationMode` enum('ai','manual','hybrid') NOT NULL DEFAULT 'ai',
	`providerSettingId` int,
	`generationPromptSnapshot` text,
	`generatedByJobId` int,
	`createdBy` int,
	`approvedBy` int,
	`approvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `drafts_id` PRIMARY KEY(`id`),
	CONSTRAINT `drafts_case_version_unique` UNIQUE(`caseId`,`versionNo`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `knowledge_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`documentType` enum('statute','regulation','precedent','reference','other') NOT NULL,
	`jurisdictionCode` varchar(50) NOT NULL,
	`courtLevel` varchar(120),
	`citation` varchar(255),
	`sourceReference` varchar(500),
	`languageCode` varchar(16) NOT NULL DEFAULT 'en',
	`tags` json,
	`summary` text,
	`fileName` varchar(255) NOT NULL,
	`fileKey` varchar(500) NOT NULL,
	`fileUrl` varchar(1000) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`sizeBytes` int NOT NULL,
	`fileHash` varchar(128) NOT NULL,
	`processingStatus` enum('uploaded','processing','processed','failed','duplicate') NOT NULL DEFAULT 'uploaded',
	`duplicateOfDocumentId` int,
	`extractedText` text,
	`metadataJson` json,
	`uploadedBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `knowledge_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `paragraph_annotations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paragraphId` int NOT NULL,
	`sourceType` enum('case_document','knowledge_document','statute','regulation','precedent','reference') NOT NULL,
	`caseDocumentId` int,
	`knowledgeDocumentId` int,
	`sourceLabel` varchar(255) NOT NULL,
	`sourceLocator` varchar(255),
	`quotedText` text,
	`rationaleNote` text,
	`relevanceScore` decimal(4,3),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paragraph_annotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `processing_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobType` enum('knowledge_ingest','case_document_ingest','draft_generation','section_regeneration','docx_export') NOT NULL,
	`targetEntityType` enum('knowledge_document','case_document','draft','draft_section','decision_export') NOT NULL,
	`targetEntityId` int NOT NULL,
	`caseId` int,
	`status` enum('queued','running','completed','failed') NOT NULL DEFAULT 'queued',
	`payloadJson` json,
	`resultJson` json,
	`errorMessage` text,
	`createdBy` int,
	`queuedAt` timestamp NOT NULL DEFAULT (now()),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `processing_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`sessionTokenHash` varchar(128) NOT NULL,
	`userAgent` varchar(500),
	`ipAddress` varchar(64),
	`expiresAt` timestamp NOT NULL,
	`lastSeenAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_token_unique` UNIQUE(`sessionTokenHash`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `name` varchar(255);--> statement-breakpoint
UPDATE `users` SET `role` = 'judge' WHERE `role` = 'user';
ALTER TABLE `users` MODIFY COLUMN `role` enum('judge','admin') NOT NULL DEFAULT 'judge';--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('active','suspended') DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `title` varchar(120);--> statement-breakpoint
ALTER TABLE `ai_provider_settings` ADD CONSTRAINT `ai_provider_settings_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_provider_settings` ADD CONSTRAINT `ai_provider_settings_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_activity_logs` ADD CONSTRAINT `case_activity_logs_caseId_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_activity_logs` ADD CONSTRAINT `case_activity_logs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_documents` ADD CONSTRAINT `case_documents_caseId_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_documents` ADD CONSTRAINT `case_documents_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_parties` ADD CONSTRAINT `case_parties_caseId_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cases` ADD CONSTRAINT `cases_assignedJudgeId_users_id_fk` FOREIGN KEY (`assignedJudgeId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cases` ADD CONSTRAINT `cases_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decision_exports` ADD CONSTRAINT `decision_exports_caseId_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decision_exports` ADD CONSTRAINT `decision_exports_draftId_drafts_id_fk` FOREIGN KEY (`draftId`) REFERENCES `drafts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `decision_exports` ADD CONSTRAINT `decision_exports_requestedBy_users_id_fk` FOREIGN KEY (`requestedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `draft_paragraphs` ADD CONSTRAINT `draft_paragraphs_sectionId_draft_sections_id_fk` FOREIGN KEY (`sectionId`) REFERENCES `draft_sections`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `draft_paragraphs` ADD CONSTRAINT `draft_paragraphs_editedBy_users_id_fk` FOREIGN KEY (`editedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `draft_sections` ADD CONSTRAINT `draft_sections_draftId_drafts_id_fk` FOREIGN KEY (`draftId`) REFERENCES `drafts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `draft_sections` ADD CONSTRAINT `draft_sections_lastEditedBy_users_id_fk` FOREIGN KEY (`lastEditedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `draft_sections` ADD CONSTRAINT `draft_sections_approvedBy_users_id_fk` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_caseId_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_providerSettingId_ai_provider_settings_id_fk` FOREIGN KEY (`providerSettingId`) REFERENCES `ai_provider_settings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_generatedByJobId_processing_jobs_id_fk` FOREIGN KEY (`generatedByJobId`) REFERENCES `processing_jobs`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `drafts` ADD CONSTRAINT `drafts_approvedBy_users_id_fk` FOREIGN KEY (`approvedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_uploadedBy_users_id_fk` FOREIGN KEY (`uploadedBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paragraph_annotations` ADD CONSTRAINT `paragraph_annotations_paragraphId_draft_paragraphs_id_fk` FOREIGN KEY (`paragraphId`) REFERENCES `draft_paragraphs`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paragraph_annotations` ADD CONSTRAINT `paragraph_annotations_caseDocumentId_case_documents_id_fk` FOREIGN KEY (`caseDocumentId`) REFERENCES `case_documents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paragraph_annotations` ADD CONSTRAINT `paragraph_annotations_knowledgeDocumentId_knowledge_documents_id_fk` FOREIGN KEY (`knowledgeDocumentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD CONSTRAINT `processing_jobs_caseId_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `processing_jobs` ADD CONSTRAINT `processing_jobs_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_sessions` ADD CONSTRAINT `user_sessions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_provider_settings_active_idx` ON `ai_provider_settings` (`isActive`);--> statement-breakpoint
CREATE INDEX `ai_provider_settings_provider_idx` ON `ai_provider_settings` (`providerType`);--> statement-breakpoint
CREATE INDEX `case_activity_logs_case_idx` ON `case_activity_logs` (`caseId`);--> statement-breakpoint
CREATE INDEX `case_activity_logs_actor_idx` ON `case_activity_logs` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `case_activity_logs_action_idx` ON `case_activity_logs` (`actionType`);--> statement-breakpoint
CREATE INDEX `case_documents_case_idx` ON `case_documents` (`caseId`);--> statement-breakpoint
CREATE INDEX `case_documents_hash_idx` ON `case_documents` (`fileHash`);--> statement-breakpoint
CREATE INDEX `case_documents_status_idx` ON `case_documents` (`uploadStatus`);--> statement-breakpoint
CREATE INDEX `case_documents_title_idx` ON `case_documents` (`title`);--> statement-breakpoint
CREATE INDEX `case_parties_case_idx` ON `case_parties` (`caseId`);--> statement-breakpoint
CREATE INDEX `case_parties_type_idx` ON `case_parties` (`partyType`);--> statement-breakpoint
CREATE INDEX `cases_status_idx` ON `cases` (`status`);--> statement-breakpoint
CREATE INDEX `cases_assigned_judge_idx` ON `cases` (`assignedJudgeId`);--> statement-breakpoint
CREATE INDEX `cases_created_by_idx` ON `cases` (`createdBy`);--> statement-breakpoint
CREATE INDEX `cases_title_idx` ON `cases` (`title`);--> statement-breakpoint
CREATE INDEX `decision_exports_case_idx` ON `decision_exports` (`caseId`);--> statement-breakpoint
CREATE INDEX `decision_exports_draft_idx` ON `decision_exports` (`draftId`);--> statement-breakpoint
CREATE INDEX `decision_exports_status_idx` ON `decision_exports` (`status`);--> statement-breakpoint
CREATE INDEX `draft_paragraphs_section_idx` ON `draft_paragraphs` (`sectionId`);--> statement-breakpoint
CREATE INDEX `draft_paragraphs_status_idx` ON `draft_paragraphs` (`reviewStatus`);--> statement-breakpoint
CREATE INDEX `draft_sections_draft_idx` ON `draft_sections` (`draftId`);--> statement-breakpoint
CREATE INDEX `draft_sections_status_idx` ON `draft_sections` (`reviewStatus`);--> statement-breakpoint
CREATE INDEX `drafts_case_idx` ON `drafts` (`caseId`);--> statement-breakpoint
CREATE INDEX `drafts_status_idx` ON `drafts` (`status`);--> statement-breakpoint
CREATE INDEX `knowledge_documents_hash_idx` ON `knowledge_documents` (`fileHash`);--> statement-breakpoint
CREATE INDEX `knowledge_documents_type_idx` ON `knowledge_documents` (`documentType`);--> statement-breakpoint
CREATE INDEX `knowledge_documents_status_idx` ON `knowledge_documents` (`processingStatus`);--> statement-breakpoint
CREATE INDEX `knowledge_documents_jurisdiction_idx` ON `knowledge_documents` (`jurisdictionCode`);--> statement-breakpoint
CREATE INDEX `knowledge_documents_title_idx` ON `knowledge_documents` (`title`);--> statement-breakpoint
CREATE INDEX `paragraph_annotations_paragraph_idx` ON `paragraph_annotations` (`paragraphId`);--> statement-breakpoint
CREATE INDEX `paragraph_annotations_source_type_idx` ON `paragraph_annotations` (`sourceType`);--> statement-breakpoint
CREATE INDEX `processing_jobs_case_idx` ON `processing_jobs` (`caseId`);--> statement-breakpoint
CREATE INDEX `processing_jobs_status_idx` ON `processing_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `processing_jobs_target_idx` ON `processing_jobs` (`targetEntityType`,`targetEntityId`);--> statement-breakpoint
CREATE INDEX `processing_jobs_type_idx` ON `processing_jobs` (`jobType`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_idx` ON `user_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `user_sessions_expires_idx` ON `user_sessions` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);