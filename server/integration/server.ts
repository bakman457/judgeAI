import express, { type NextFunction, type Request, type Response } from "express";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { API_UPLOAD_BODY_LIMIT } from "../../shared/const";
import { createExternalHttpRouter } from "./http";
import { createMcpRouter } from "./mcp";
import { IntegrationError } from "./service";

let integrationServer: Server | null = null;

export type IntegrationServerInfo = {
  host: string;
  port: number;
  httpBaseUrl: string;
  mcpUrl: string;
};

export async function startIntegrationServer(): Promise<IntegrationServerInfo | null> {
  if ((process.env.JUDGE_AI_INTEGRATION_ENABLED ?? "1") === "0") {
    console.log("[Integration] Disabled by JUDGE_AI_INTEGRATION_ENABLED=0");
    return null;
  }

  if (integrationServer) {
    const address = integrationServer.address();
    const port = typeof address === "object" && address ? address.port : Number(process.env.JUDGE_AI_INTEGRATION_PORT || 3100);
    return {
      host: "127.0.0.1",
      port,
      httpBaseUrl: `http://127.0.0.1:${port}/api/v1`,
      mcpUrl: `http://127.0.0.1:${port}/mcp`,
    };
  }

  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: API_UPLOAD_BODY_LIMIT }));
  app.use(express.urlencoded({ limit: API_UPLOAD_BODY_LIMIT, extended: true }));

  app.use((req, res, next) => {
    const incoming = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : null;
    const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
    (req as any).id = id;
    res.setHeader("X-Request-Id", id);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "no-store");
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "judge-ai-integration",
      http: "/api/v1",
      mcp: "/mcp",
    });
  });

  app.use("/api/v1", createExternalHttpRouter());
  app.use("/mcp", createMcpRouter());

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof z.ZodError) {
      res.status(400).json({
        error: "Invalid integration request.",
        code: "invalid_input",
        issues: error.issues,
        requestId: (req as any).id ?? null,
      });
      return;
    }

    if (error instanceof IntegrationError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        requestId: (req as any).id ?? null,
      });
      return;
    }

    console.error("[Integration] Request failed:", error);
    res.status(500).json({
      error: "Integration request failed.",
      code: "integration_error",
      requestId: (req as any).id ?? null,
    });
  });

  const port = Number.parseInt(process.env.JUDGE_AI_INTEGRATION_PORT || "3100", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("JUDGE_AI_INTEGRATION_PORT must be a valid TCP port.");
  }

  const server = createServer(app);

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => reject(error);
    server.once("error", onError);
    server.listen(port, "127.0.0.1", () => {
      server.off("error", onError);
      resolve();
    });
  });

  integrationServer = server;
  console.log(`[Integration] HTTP API: http://127.0.0.1:${port}/api/v1`);
  console.log(`[Integration] MCP:      http://127.0.0.1:${port}/mcp`);

  return {
    host: "127.0.0.1",
    port,
    httpBaseUrl: `http://127.0.0.1:${port}/api/v1`,
    mcpUrl: `http://127.0.0.1:${port}/mcp`,
  };
}

export async function stopIntegrationServer() {
  if (!integrationServer) return;

  const server = integrationServer;
  integrationServer = null;

  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error) reject(error);
      else resolve();
    });
  });
}
