import "dotenv/config";
import "./logger";
import cors from "cors";
import express from "express";
import { createServer } from "http";
import net from "net";
import { randomUUID } from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { createContext, setDesktopAdminUser } from "./context";
import { serveStatic } from "./vite";
import { ENV } from "./env";
import { upsertUser, getUserByOpenId, cleanupOrphanedProcessingJobs, reapStaleProcessingJobs } from "../db";
import { saveProviderSettings, seedGreekInheritanceKnowledgeBase } from "../judgeAiService";
import { listAiProviderSettings, setActiveAiProviderSetting } from "../db";
import { API_UPLOAD_BODY_LIMIT } from "../../shared/const";
import { getLocalUploadsDir } from "../storage";
import { ensureCurrentDatabaseSchema } from "../schemaRepair";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function requirePort(port: number): Promise<number> {
  if (await isPortAvailable(port)) {
    return port;
  }
  throw new Error(
    `Port ${port} is already in use. Please close any running Judge AI windows and try again.`
  );
}

async function startServer() {
  // Ensure the desktop admin user exists in the database so foreign-key constraints are satisfied
  try {
    await ensureCurrentDatabaseSchema();

    await upsertUser({
      openId: "desktop-local-user",
      name: "Administrator",
      email: "admin@local",
      loginMethod: "local",
      status: "active",
    });
    const desktopUser = await getUserByOpenId("desktop-local-user");
    if (!desktopUser) {
      throw new Error("Desktop user was not found after upsert.");
    }
    setDesktopAdminUser(desktopUser);
    console.log("[Desktop] Admin user ready:", desktopUser.id, desktopUser.openId);

    // Ensure DeepSeek and Kimi providers have the correct API keys on every startup.
    // We always upsert so stale/wrong encrypted keys in the DB are fixed automatically.
    try {
      const existing = await listAiProviderSettings();
      const existingDeepSeek = existing.find(p => p.providerType === "deepseek");
      const existingKimi = existing.find(p => p.providerType === "kimi");
      const anyActive = existing.some(p => p.isActive);

      // Always make DeepSeek the active provider with the correct key.
      // Pass isActive: false here — we use setActiveAiProviderSetting after to
      // ensure ALL other providers (including stale openai-typed ones) are deactivated.
      const savedDeepSeek = await saveProviderSettings({
        id: existingDeepSeek?.id,
        name: existingDeepSeek?.name ?? "DeepSeek",
        providerType: "deepseek",
        endpoint: "https://api.deepseek.com/v1",
        model: existingDeepSeek?.model ?? "deepseek-chat",
        apiKey: process.env.DEEPSEEK_API_KEY ?? "",
        draftTemperature: existingDeepSeek?.draftTemperature ?? "0.2",
        maxTokens: existingDeepSeek?.maxTokens ?? 8000,
        isActive: false,
        userId: desktopUser.id,
      });
      if (!savedDeepSeek) throw new Error("Failed to save DeepSeek provider");
      // Explicitly deactivate ALL other providers and activate only DeepSeek.
      // This handles stale providers of any type (e.g. openai-typed with DeepSeek key).
      await setActiveAiProviderSetting(savedDeepSeek.id, desktopUser.id);
      console.log("[Seed] DeepSeek provider key refreshed and set active (id:", savedDeepSeek.id, ")");

      const afterDeepSeek = await listAiProviderSettings();
      const existingKimiNow = afterDeepSeek.find(p => p.providerType === "kimi") ?? existingKimi;

      await saveProviderSettings({
        id: existingKimiNow?.id,
        name: existingKimiNow?.name ?? "Kimi (Moonshot)",
        providerType: "kimi",
        endpoint: "https://api.moonshot.cn/v1",
        model: existingKimiNow?.model ?? "moonshot-v1-8k",
        apiKey: process.env.KIMI_API_KEY ?? "",
        draftTemperature: existingKimiNow?.draftTemperature ?? "0.2",
        maxTokens: existingKimiNow?.maxTokens ?? 8000,
        isActive: false,
        userId: desktopUser.id,
      });
      console.log("[Seed] Kimi provider key refreshed");
    } catch (seedError) {
      console.warn("[Seed] Could not refresh default AI provider keys:", seedError);
    }

    // Clean up any orphaned running jobs from previous server restarts
    try {
      await cleanupOrphanedProcessingJobs();
    } catch (cleanupError) {
      console.warn("[Startup] Could not clean up orphaned jobs:", cleanupError);
    }

    // Start a periodic reaper so jobs that silently hang mid-run (e.g. a
    // dropped LLM connection that never resolves) eventually fail instead
    // of spinning the UI forever.
    const STALE_JOB_MAX_AGE_MS = 30 * 60_000; // 30 minutes
    const REAPER_INTERVAL_MS = 5 * 60_000;    // 5 minutes
    setInterval(async () => {
      try {
        const reaped = await reapStaleProcessingJobs(STALE_JOB_MAX_AGE_MS);
        if (reaped > 0) {
          console.warn(`[Reaper] Marked ${reaped} stale processing job(s) as failed.`);
        }
      } catch (reaperError) {
        console.warn("[Reaper] Stale-job sweep failed:", reaperError);
      }
    }, REAPER_INTERVAL_MS).unref();

    // Seed Greek inheritance-law knowledge base on first start (idempotent — skips entries that already exist by title)
    try {
      const knowledgeSeedResult = await seedGreekInheritanceKnowledgeBase(desktopUser.id);
      if (knowledgeSeedResult.createdCount > 0) {
        console.log(`[Seed] Inserted ${knowledgeSeedResult.createdCount}/${knowledgeSeedResult.totalSeedEntries} inheritance-law knowledge entries`);
      }
    } catch (knowledgeSeedError) {
      console.warn("[Seed] Could not seed inheritance-law knowledge base:", knowledgeSeedError);
    }
  } catch (error) {
    console.error("[Desktop] Failed to ensure desktop user:", error);
    throw new Error(
      "Could not prepare the local administrator account. Please make sure your database is running and try again."
    );
  }

  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: API_UPLOAD_BODY_LIMIT }));
  app.use(express.urlencoded({ limit: API_UPLOAD_BODY_LIMIT, extended: true }));

  // CORS configuration — allow the frontend origin and send credentials
  const allowedOrigins = ENV.isProduction
    ? [process.env.FRONTEND_URL ?? "https://your-production-domain.com"]
    : [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
      ];

  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Request ID — attach X-Request-Id to every request so tRPC errors in logs
  // can be correlated with the exact client call that triggered them.
  // Honors an incoming X-Request-Id header if the client supplies one.
  app.use((req, res, next) => {
    const incoming = typeof req.headers["x-request-id"] === "string" ? req.headers["x-request-id"] : null;
    const id = incoming && incoming.length <= 128 ? incoming : randomUUID();
    (req as any).id = id;
    res.setHeader("X-Request-Id", id);
    next();
  });

  // Rate limiting — generous limits for general API usage.
  const generalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });
  app.use("/api/", generalLimiter);

  // Strict limiter for AI-heavy tRPC procedures (LLM calls cost real money and
  // can run for 10–60s each). Matches single or batched tRPC calls whose URL
  // contains any of the expensive procedure names.
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "AI request limit reached. Please wait a moment and try again." },
  });
  app.use(
    /^\/api\/trpc\/.*(drafts\.generate|judgeAi\.reviewJudgment|judgeStyle\.generateProfile|judgeAi\.exportReviewReport|cases\.reviewBatch|drafts\.transcribeSectionNote|cases\.explainFinding)/,
    aiLimiter,
  );

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ path, error, req }) => {
        const requestId = (req as any)?.id ?? "unknown";
        console.error(`[tRPC Error] [${requestId}] ${path}:`, error);
      },
    })
  );

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const requestId = (req as any)?.id ?? "unknown";
    console.error(`[GlobalError] [${requestId}]`, err);
    const status = typeof err?.statusCode === "number" ? err.statusCode : 500;
    const message = ENV.isProduction && status >= 500
      ? "Internal server error"
      : err?.message || "Internal server error";
    res.status(status).json({ error: message, requestId });
  });
  // Serve local uploads directory for desktop / local storage fallback
  app.use("/uploads", express.static(getLocalUploadsDir()));

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await requirePort(preferredPort);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
  
  // Handle server errors gracefully
  server.on("error", (err) => {
    console.error("[Server] Fatal error:", err);
    process.exit(1);
  });
  
  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    console.error("[Server] Uncaught exception:", err);
    process.exit(1);
  });
  
  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error("[Server] Unhandled rejection at:", promise, "reason:", reason);
    process.exit(1);
  });
  
  // Graceful shutdown
  const gracefulShutdown = (signal: string) => {
    console.log(`[Server] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      console.log("[Server] HTTP server closed");
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      console.error("[Server] Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };
  
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

startServer().catch((error) => {
  console.error("[Server] Fatal startup error:", error);
  process.exit(1);
});
