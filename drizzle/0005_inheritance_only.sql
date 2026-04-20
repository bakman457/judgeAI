-- Narrow caseTypeKey / reviewTemplateKey enums to inheritance only.
-- Drop existing per-case-type approval thresholds; defaults will be regenerated
-- by buildDefaultReviewThreshold on next read.
DELETE FROM `review_approval_thresholds`;

-- Expand enums first so we can rewrite values to "inheritance" without violating
-- the column constraint, then collapse back to a single allowed value.
ALTER TABLE `review_approval_thresholds`
  MODIFY COLUMN `caseTypeKey` ENUM('general', 'civil', 'criminal', 'administrative', 'inheritance') NOT NULL;

ALTER TABLE `case_review_snapshots`
  MODIFY COLUMN `reviewTemplateKey` ENUM('general', 'civil', 'criminal', 'administrative', 'inheritance') NOT NULL DEFAULT 'general';

UPDATE `case_review_snapshots` SET `reviewTemplateKey` = 'inheritance';

ALTER TABLE `review_approval_thresholds`
  MODIFY COLUMN `caseTypeKey` ENUM('inheritance') NOT NULL DEFAULT 'inheritance';

ALTER TABLE `case_review_snapshots`
  MODIFY COLUMN `reviewTemplateKey` ENUM('inheritance') NOT NULL DEFAULT 'inheritance';

-- Per-provider max_tokens cap (DeepSeek 8000, room to raise for other providers).
ALTER TABLE `ai_provider_settings`
  ADD COLUMN `maxTokens` INT NOT NULL DEFAULT 8000;
