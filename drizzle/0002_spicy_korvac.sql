ALTER TABLE `paragraph_annotations` DROP FOREIGN KEY `paragraph_annotations_knowledgeDocumentId_knowledge_documents_id_fk`;
--> statement-breakpoint
ALTER TABLE `paragraph_annotations` ADD CONSTRAINT `para_ann_kdoc_fk` FOREIGN KEY (`knowledgeDocumentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE set null ON UPDATE no action;