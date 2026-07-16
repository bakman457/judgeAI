CREATE TABLE IF NOT EXISTS `case_review_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`caseId` int NOT NULL,
	`draftId` int,
	`draftVersionNo` int,
	`reviewTemplateKey` enum('general','civil','criminal','administrative') NOT NULL DEFAULT 'general',
	`reviewTemplateFocus` text,
	`judgmentTextSnapshot` text,
	`outcomeAssessment` enum('supported','partially_supported','contradicted','insufficient_basis') NOT NULL,
	`confidenceScore` varchar(32) NOT NULL,
	`qualityScore` int NOT NULL,
	`readyForSignature` boolean NOT NULL DEFAULT false,
	`highSeverityCount` int NOT NULL DEFAULT 0,
	`mediumSeverityCount` int NOT NULL DEFAULT 0,
	`providerSettingId` int,
	`resultJson` json,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `case_review_snapshots_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `review_approval_thresholds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`caseTypeKey` enum('general','civil','criminal','administrative') NOT NULL,
	`minimumQualityScore` int NOT NULL DEFAULT 70,
	`requireReadyForSignature` boolean NOT NULL DEFAULT true,
	`maxHighSeverityFindings` int NOT NULL DEFAULT 0,
	`maxMediumSeverityFindings` int NOT NULL DEFAULT 2,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `review_approval_thresholds_id` PRIMARY KEY(`id`),
	CONSTRAINT `review_thresholds_owner_case_type_unique` UNIQUE(`ownerUserId`,`caseTypeKey`)
);
--> statement-breakpoint
ALTER TABLE `case_review_snapshots` ADD CONSTRAINT `case_review_snapshots_caseId_cases_id_fk` FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_review_snapshots` ADD CONSTRAINT `case_review_snapshots_draftId_drafts_id_fk` FOREIGN KEY (`draftId`) REFERENCES `drafts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_review_snapshots` ADD CONSTRAINT `case_review_snapshots_provider_fk` FOREIGN KEY (`providerSettingId`) REFERENCES `ai_provider_settings`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `case_review_snapshots` ADD CONSTRAINT `case_review_snapshots_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_approval_thresholds` ADD CONSTRAINT `review_approval_thresholds_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `case_review_snapshots_case_idx` ON `case_review_snapshots` (`caseId`);--> statement-breakpoint
CREATE INDEX `case_review_snapshots_draft_idx` ON `case_review_snapshots` (`draftId`);--> statement-breakpoint
CREATE INDEX `case_review_snapshots_case_draft_created_idx` ON `case_review_snapshots` (`caseId`,`draftId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `case_review_snapshots_created_by_idx` ON `case_review_snapshots` (`createdBy`);--> statement-breakpoint
CREATE INDEX `review_thresholds_owner_idx` ON `review_approval_thresholds` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `review_thresholds_case_type_idx` ON `review_approval_thresholds` (`caseTypeKey`);