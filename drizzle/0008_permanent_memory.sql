-- Migration 0008: durable long-term judge memory
--
-- Raw memory events are append-only learning signals. user_memory_items is the
-- active/deduplicated retrieval layer. Normal program-data/factory resets do
-- not delete these tables; case foreign keys are SET NULL so learned history
-- survives case deletion.

CREATE TABLE IF NOT EXISTS `user_memory_events` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `caseId` INT NULL,
  `caseType` VARCHAR(120) NULL,
  `eventType` VARCHAR(64) NOT NULL,
  `rawText` TEXT NOT NULL,
  `metadataJson` JSON NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `user_memory_events_user_idx` (`userId`),
  INDEX `user_memory_events_case_idx` (`caseId`),
  INDEX `user_memory_events_created_idx` (`createdAt`),
  CONSTRAINT `user_memory_events_user_fk`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `user_memory_events_case_fk`
    FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS `user_memory_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `scope` ENUM('global','case_type','case') NOT NULL DEFAULT 'global',
  `caseId` INT NULL,
  `caseType` VARCHAR(120) NULL,
  `category` ENUM('instruction','preference','edit_example','author_note','review_feedback','manual') NOT NULL,
  `content` TEXT NOT NULL,
  `fingerprint` VARCHAR(64) NOT NULL,
  `confidence` DECIMAL(4,3) NOT NULL DEFAULT 0.900,
  `reinforcementCount` INT NOT NULL DEFAULT 1,
  `usageCount` INT NOT NULL DEFAULT 0,
  `status` ENUM('active','inactive','superseded') NOT NULL DEFAULT 'active',
  `sourceEventId` INT NULL,
  `lastUsedAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `user_memory_items_user_fingerprint_unique` (`userId`, `fingerprint`),
  INDEX `user_memory_items_user_status_idx` (`userId`, `status`),
  INDEX `user_memory_items_case_idx` (`caseId`),
  INDEX `user_memory_items_case_type_idx` (`caseType`),
  INDEX `user_memory_items_updated_idx` (`updatedAt`),
  CONSTRAINT `user_memory_items_user_fk`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `user_memory_items_case_fk`
    FOREIGN KEY (`caseId`) REFERENCES `cases`(`id`) ON DELETE SET NULL,
  CONSTRAINT `user_memory_items_event_fk`
    FOREIGN KEY (`sourceEventId`) REFERENCES `user_memory_events`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
