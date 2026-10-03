import { Router, type NextFunction, type Request, type Response } from "express";
import { z } from "zod";
import {
  getIntegrationCaseDocument,
  getIntegrationCaseOverview,
  getIntegrationCurrentDraft,
  getIntegrationGenerationStatus,
  getIntegrationKnowledgeDocument,
  listIntegrationCases,
  searchIntegrationCase,
  searchIntegrationCases,
} from "./service";

const MODERN_PROTOCOL_VERSION = "2026-07-28";
const LEGACY_PROTOCOL_VERSION = "2025-11-25";
const LEGACY_PROTOCOL_FALLBACK = "2025-06-18";
const SERVER_INFO = { name: "judge-ai", version: "1.0.0" };

type RpcId = string | number | null;
type RpcRequest = {
  jsonrpc?: string;
  id?: RpcId;
  method?: string;
  params?: Record<string, any>;
};

const tools = [
  {
    name: "judge_ai_list_cases",
    title: "List Judge AI cases",
    description: "List cases accessible to the configured Judge AI integration user.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", maxLength: 255 },
        status: { type: "string", enum: ["created", "document_review", "drafting", "under_review", "approved", "archived"] },
        jurisdictionCode: { type: "string", maxLength: 50 },
        caseType: { type: "string", maxLength: 120 },
        includeArchived: { type: "boolean" },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "judge_ai_get_case",
    title: "Get case overview",
    description: "Get case metadata, parties, document metadata, current draft metadata, and latest review metadata.",
    inputSchema: {
      type: "object",
      properties: { caseId: { type: "integer", minimum: 1 } },
      required: ["caseId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "judge_ai_get_current_draft",
    title: "Get current decision draft",
    description: "Return the latest structured decision draft, including sections, paragraphs, and annotations.",
    inputSchema: {
      type: "object",
      properties: { caseId: { type: "integer", minimum: 1 } },
      required: ["caseId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "judge_ai_get_case_document",
    title: "Read case document",
    description: "Read a bounded chunk of extracted text from a case document. Use nextOffset to continue large documents.",
    inputSchema: {
      type: "object",
      properties: {
        caseId: { type: "integer", minimum: 1 },
        documentId: { type: "integer", minimum: 1 },
        offset: { type: "integer", minimum: 0 },
        maxChars: { type: "integer", minimum: 500, maximum: 20000 },
      },
      required: ["caseId", "documentId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "judge_ai_get_knowledge_document",
    title: "Read knowledge document",
    description: "Read a bounded chunk of a Judge AI knowledge-base document. Admin integration user required.",
    inputSchema: {
      type: "object",
      properties: {
        documentId: { type: "integer", minimum: 1 },
        offset: { type: "integer", minimum: 0 },
        maxChars: { type: "integer", minimum: 500, maximum: 20000 },
      },
      required: ["documentId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "judge_ai_search_case",
    title: "Search one case",
    description: "Search case evidence and the Judge AI knowledge base for relevant text.",
    inputSchema: {
      type: "object",
      properties: {
        caseId: { type: "integer", minimum: 1 },
        query: { type: "string", minLength: 1, maxLength: 255 },
      },
      required: ["caseId", "query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "judge_ai_search_cases",
    title: "Search accessible cases",
    description: "Search across cases accessible to the integration user and the Judge AI knowledge base.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 2, maxLength: 255 } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
  {
    name: "judge_ai_generation_status",
    title: "Get generation status",
    description: "Get the latest decision-generation job status for a case.",
    inputSchema: {
      type: "object",
      properties: { caseId: { type: "integer", minimum: 1 } },
      required: ["caseId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
  },
] as const;

const schemas = {
  judge_ai_list_cases: z.object({
    query: z.string().max(255).optional(),
    status: z.enum(["created", "document_review", "drafting", "under_review", "approved", "archived"]).optional(),
    jurisdictionCode: z.string().max(50).optional(),
    caseType: z.string().max(120).optional(),
    includeArchived: z.boolean().optional(),
  }),
  judge_ai_get_case: z.object({ caseId: z.coerce.number().int().positive() }),
  judge_ai_get_current_draft: z.object({ caseId: z.coerce.number().int().positive() }),
  judge_ai_get_case_document: z.object({
    caseId: z.coerce.number().int().positive(),
    documentId: z.coerce.number().int().positive(),
    offset: z.coerce.number().int().min(0).optional(),
    maxChars: z.coerce.number().int().min(500).max(20000).optional(),
  }),
  judge_ai_get_knowledge_document: z.object({
    documentId: z.coerce.number().int().positive(),
    offset: z.coerce.number().int().min(0).optional(),
    maxChars: z.coerce.number().int().min(500).max(20000).optional(),
  }),
  judge_ai_search_case: z.object({
    caseId: z.coerce.number().int().positive(),
    query: z.string().min(1).max(255),
  }),
  judge_ai_search_cases: z.object({ query: z.string().min(2).max(255) }),
  judge_ai_generation_status: z.object({ caseId: z.coerce.number().int().positive() }),
} as const;

type ToolName = keyof typeof schemas;

async function callTool(name: string, input: unknown) {
  if (!(name in schemas)) throw new Error("Unknown tool: " + name);
  const toolName = name as ToolName;
  const parsed = schemas[toolName].parse(input ?? {});

  switch (toolName) {
    case "judge_ai_list_cases":
      return listIntegrationCases(parsed as z.infer<typeof schemas.judge_ai_list_cases>);
    case "judge_ai_get_case":
      return getIntegrationCaseOverview((parsed as z.infer<typeof schemas.judge_ai_get_case>).caseId);
    case "judge_ai_get_current_draft":
      return getIntegrationCurrentDraft((parsed as z.infer<typeof schemas.judge_ai_get_current_draft>).caseId);
    case "judge_ai_get_case_document": {
      const args = parsed as z.infer<typeof schemas.judge_ai_get_case_document>;
      return getIntegrationCaseDocument(args.caseId, args.documentId, args);
    }
    case "judge_ai_get_knowledge_document": {
      const args = parsed as z.infer<typeof schemas.judge_ai_get_knowledge_document>;
      return getIntegrationKnowledgeDocument(args.documentId, args);
    }
    case "judge_ai_search_case": {
      const args = parsed as z.infer<typeof schemas.judge_ai_search_case>;
      return searchIntegrationCase(args.caseId, args.query);
    }
    case "judge_ai_search_cases":
      return searchIntegrationCases((parsed as z.infer<typeof schemas.judge_ai_search_cases>).query);
    case "judge_ai_generation_status":
      return getIntegrationGenerationStatus((parsed as z.infer<typeof schemas.judge_ai_generation_status>).caseId);
  }
}

function isModern(req: Request, body: RpcRequest) {
  const header = req.header("mcp-protocol-version")?.trim();
  const meta = body.params?._meta as Record<string, unknown> | undefined;
  return header === MODERN_PROTOCOL_VERSION ||
    meta?.["io.modelcontextprotocol/protocolVersion"] === MODERN_PROTOCOL_VERSION;
}

function result(id: RpcId | undefined, value: any, modern: boolean) {
  if (modern && value && typeof value === "object" && !Array.isArray(value)) {
    value = {
      ...value,
      _meta: {
        ...(value._meta ?? {}),
        "io.modelcontextprotocol/serverInfo": SERVER_INFO,
      },
    };
  }
  return { jsonrpc: "2.0", id: id ?? null, result: value };
}

function rpcError(id: RpcId | undefined, code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function toolResult(value: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value && typeof value === "object" ? value : { value },
    isError: false,
  };
}

function toolFailure(error: unknown) {
  return {
    content: [{ type: "text", text: error instanceof Error ? error.message : "Tool execution failed." }],
    isError: true,
  };
}

async function dispatch(req: Request, body: RpcRequest) {
  if (body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(body.id, -32600, "Invalid Request");
  }

  const modern = isModern(req, body);

  if (body.method === "server/discover") {
    return result(body.id, {
      supportedVersions: [MODERN_PROTOCOL_VERSION, LEGACY_PROTOCOL_VERSION, LEGACY_PROTOCOL_FALLBACK],
      capabilities: { tools: { listChanged: false } },
      instructions: "Read-only access to Judge AI case workspaces, evidence, search, drafts, and generation status.",
      ttlMs: 300000,
      cacheScope: "private",
    }, true);
  }

  if (body.method === "initialize") {
    const requested = body.params?.protocolVersion;
    const protocolVersion =
      requested === LEGACY_PROTOCOL_FALLBACK ? LEGACY_PROTOCOL_FALLBACK : LEGACY_PROTOCOL_VERSION;
    return result(body.id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: SERVER_INFO,
      instructions: "Read-only access to Judge AI case workspaces, evidence, search, drafts, and generation status.",
    }, false);
  }

  if (body.method === "ping") return result(body.id, {}, modern);
  if (body.method === "tools/list") return result(body.id, { tools }, modern);

  if (body.method === "tools/call") {
    const name = body.params?.name;
    if (typeof name !== "string") return rpcError(body.id, -32602, "tools/call requires params.name");
    try {
      return result(body.id, toolResult(await callTool(name, body.params?.arguments)), modern);
    } catch (error) {
      return result(body.id, toolFailure(error), modern);
    }
  }

  if (body.method === "notifications/initialized" || body.method === "notifications/cancelled") return null;
  return rpcError(body.id, -32601, "Method not found: " + body.method);
}

function asyncRoute(handler: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

export function createMcpRouter() {
  const router = Router();

  router.get("/", (_req, res) => {
    res.status(405).setHeader("Allow", "POST, DELETE").json({
      error: "Use HTTP POST for this stateless MCP endpoint.",
      protocolVersions: [MODERN_PROTOCOL_VERSION, LEGACY_PROTOCOL_VERSION, LEGACY_PROTOCOL_FALLBACK],
    });
  });

  router.delete("/", (_req, res) => {
    res.status(204).end();
  });

  router.post("/", asyncRoute(async (req, res) => {
    const body = req.body as RpcRequest;
    const response = await dispatch(req, body);
    if (response === null) {
      res.status(202).end();
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("MCP-Protocol-Version", isModern(req, body) ? MODERN_PROTOCOL_VERSION : LEGACY_PROTOCOL_VERSION);
    res.type("application/json").status(200).send(JSON.stringify(response));
  }));

  return router;
}
