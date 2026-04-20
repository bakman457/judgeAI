import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import { vitePluginManusRuntime } from "vite-plugin-manus-runtime";

// =============================================================================
// Manus Debug Collector - Vite Plugin
// Writes browser logs directly to files, trimmed when exceeding size limit
// =============================================================================

const PROJECT_ROOT = fileURLToPath(new URL(".", import.meta.url));
const LOG_DIR = join(PROJECT_ROOT, ".manus-logs");
const MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024; // 1MB per log file
const TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6); // Trim to 60% to avoid constant re-trimming

type LogSource = "browserConsole" | "networkRequests" | "sessionReplay";

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function trimLogFile(logPath: string, maxSize: number) {
  try {
    if (!existsSync(logPath) || statSync(logPath).size <= maxSize) {
      return;
    }

    const lines = readFileSync(logPath, "utf-8").split("\n");
    const keptLines: string[] = [];
    let keptBytes = 0;

    // Keep newest lines (from end) that fit within 60% of maxSize
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }

    writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
    /* ignore trim errors */
  }
}

function writeToLogFile(source: LogSource, entries: unknown[]) {
  if (entries.length === 0) return;

  ensureLogDir();
  const logPath = join(LOG_DIR, `${source}.log`);

  // Format entries with timestamps
  const lines = entries.map((entry) => {
    const ts = new Date().toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });

  // Append to log file
  appendFileSync(logPath, `${lines.join("\n")}\n`, "utf-8");

  // Trim if exceeds max size
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}

/**
 * Vite plugin to collect browser debug logs
 * - POST /__manus__/logs: Browser sends logs, written directly to files
 * - Files: browserConsole.log, networkRequests.log, sessionReplay.log
 * - Auto-trimmed when exceeding 1MB (keeps newest entries)
 */
function vitePluginManusDebugCollector(): Plugin {
  return {
    name: "manus-debug-collector",

    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js",
              defer: true,
            },
            injectTo: "head",
          },
        ],
      };
    },

    configureServer(server: ViteDevServer) {
      // POST /__manus__/logs: Browser sends logs (written directly to files)
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }

        const handlePayload = (payload: any) => {
          // Write logs directly to files
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };

        const reqBody = (req as { body?: unknown }).body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }

        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });

        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    },
  };
}

// Opt-in debug collector.
// Why opt-in: previously this plugin always injected a script tag and wrote log files
// to .manus-logs/ on every dev session. That's noisy, leaks page activity to disk by
// default, and was always-on whether the developer wanted telemetry or not.
// Set JUDGE_AI_DEBUG_COLLECTOR=1 in your shell or .env to re-enable it.
const debugCollectorEnabled = process.env.JUDGE_AI_DEBUG_COLLECTOR === "1";

const plugins = [
  react(),
  tailwindcss(),
  vitePluginManusRuntime(),
  ...(debugCollectorEnabled ? [vitePluginManusDebugCollector()] : []),
];

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": resolve(PROJECT_ROOT, "client", "src"),
      "@shared": resolve(PROJECT_ROOT, "shared"),
      "@assets": resolve(PROJECT_ROOT, "attached_assets"),
    },
  },
  envDir: resolve(PROJECT_ROOT),
  root: resolve(PROJECT_ROOT, "client"),
  publicDir: resolve(PROJECT_ROOT, "client", "public"),
  build: {
    outDir: resolve(PROJECT_ROOT, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("/@radix-ui/")) return "radix";
          if (id.includes("/@trpc/") || id.includes("/@tanstack/react-query") || id.includes("/superjson/")) {
            return "trpc";
          }
          if (id.includes("/lucide-react/")) return "icons";
          if (id.includes("/recharts/")) return "charts";
          if (id.includes("/framer-motion/")) return "motion";
          if (
            id.includes("/react-hook-form/") ||
            id.includes("/@hookform/") ||
            id.includes("/zod/")
          ) {
            return "forms";
          }
          if (
            id.includes("/react-dom/") ||
            id.match(/\/node_modules\/react\//) ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }
          return undefined;
        },
      },
    },
  },
  server: {
    host: true,
    // Only allow localhost in development; production should not use dev server
    allowedHosts: process.env.NODE_ENV === "production"
      ? []  // No allowed hosts in production - should not be using dev server
      : ["localhost", "127.0.0.1"],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
