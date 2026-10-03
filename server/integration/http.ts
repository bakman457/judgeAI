import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  IntegrationError,
  getIntegrationCaseDocument,
  getIntegrationCaseOverview,
  getIntegrationCurrentDraft,
  getIntegrationGenerationStatus,
  getIntegrationKnowledgeDocument,
  integrationHealth,
  listIntegrationCases,
  searchIntegrationCase,
  searchIntegrationCases,
} from "./service";

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function positiveInt(value: unknown, field: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new IntegrationError(400, field + " must be a positive integer.", "invalid_input");
  }
  return number;
}

export function createExternalHttpRouter() {
  const router = Router();

  router.get("/health", asyncRoute(async (_req, res) => {
    res.json(await integrationHealth());
  }));

  router.get("/cases", asyncRoute(async (req, res) => {
    const status = z
      .enum(["created", "document_review", "drafting", "under_review", "approved", "archived"])
      .optional()
      .parse(typeof req.query.status === "string" ? req.query.status : undefined);

    res.json(await listIntegrationCases({
      query: typeof req.query.query === "string" ? req.query.query.slice(0, 255) : undefined,
      status,
      jurisdictionCode: typeof req.query.jurisdictionCode === "string" ? req.query.jurisdictionCode.slice(0, 50) : undefined,
      caseType: typeof req.query.caseType === "string" ? req.query.caseType.slice(0, 120) : undefined,
      includeArchived: req.query.includeArchived === "true" || req.query.includeArchived === "1",
    }));
  }));

  router.get("/cases/:caseId", asyncRoute(async (req, res) => {
    res.json(await getIntegrationCaseOverview(positiveInt(req.params.caseId, "caseId")));
  }));

  router.get("/cases/:caseId/draft", asyncRoute(async (req, res) => {
    res.json(await getIntegrationCurrentDraft(positiveInt(req.params.caseId, "caseId")));
  }));

  router.get("/cases/:caseId/generation-status", asyncRoute(async (req, res) => {
    res.json(await getIntegrationGenerationStatus(positiveInt(req.params.caseId, "caseId")));
  }));

  router.get("/cases/:caseId/documents/:documentId", asyncRoute(async (req, res) => {
    res.json(await getIntegrationCaseDocument(
      positiveInt(req.params.caseId, "caseId"),
      positiveInt(req.params.documentId, "documentId"),
      {
        offset: req.query.offset === undefined ? undefined : Number(req.query.offset),
        maxChars: req.query.maxChars === undefined ? undefined : Number(req.query.maxChars),
      },
    ));
  }));

  router.get("/knowledge/:documentId", asyncRoute(async (req, res) => {
    res.json(await getIntegrationKnowledgeDocument(
      positiveInt(req.params.documentId, "documentId"),
      {
        offset: req.query.offset === undefined ? undefined : Number(req.query.offset),
        maxChars: req.query.maxChars === undefined ? undefined : Number(req.query.maxChars),
      },
    ));
  }));

  router.get("/cases/:caseId/search", asyncRoute(async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (!query || query.length > 255) {
      throw new IntegrationError(400, "q must contain 1 to 255 characters.", "invalid_input");
    }
    res.json(await searchIntegrationCase(positiveInt(req.params.caseId, "caseId"), query));
  }));

  router.get("/search", asyncRoute(async (req, res) => {
    const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
    if (query.length < 2 || query.length > 255) {
      throw new IntegrationError(400, "q must contain 2 to 255 characters.", "invalid_input");
    }
    res.json(await searchIntegrationCases(query));
  }));

  return router;
}
