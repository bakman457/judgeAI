CREATE FULLTEXT INDEX `case_documents_fulltext_idx` ON `case_documents` (`title`, `extractedText`);
--> statement-breakpoint
CREATE FULLTEXT INDEX `knowledge_documents_fulltext_idx` ON `knowledge_documents` (`title`, `citation`, `summary`, `extractedText`);
