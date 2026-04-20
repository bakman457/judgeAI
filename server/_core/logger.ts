import { appendFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LOG_DIR = process.env.JUDGE_AI_LOG_DIR
  ?? (process.env.JUDGE_AI_DATA_DIR ? join(process.env.JUDGE_AI_DATA_DIR, "logs") : join(process.cwd(), "logs"));
const LOG_FILE = join(LOG_DIR, "app.log");
const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5MB
const TRIM_TARGET = Math.floor(MAX_LOG_SIZE * 0.6);

function ensureLogDir() {
  if (!existsSync(LOG_DIR)) {
    mkdirSync(LOG_DIR, { recursive: true });
  }
}

function safeStringify(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Error) return `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
}

function writeLog(level: string, args: unknown[]) {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const message = args.map(safeStringify).join(" ");
  const line = `[${timestamp}] [${level}] ${message}\n`;
  appendFileSync(LOG_FILE, line, "utf-8");

  // Trim log file if it exceeds max size
  try {
    const size = statSync(LOG_FILE).size;
    if (size > MAX_LOG_SIZE) {
      const content = readFileSync(LOG_FILE, "utf-8");
      const lines = content.split("\n");
      const kept: string[] = [];
      let keptBytes = 0;
      for (let i = lines.length - 1; i >= 0; i--) {
        const lineBytes = Buffer.byteLength(`${lines[i]}\n`, "utf-8");
        if (keptBytes + lineBytes > TRIM_TARGET) break;
        kept.unshift(lines[i]);
        keptBytes += lineBytes;
      }
      writeFileSync(LOG_FILE, kept.join("\n"), "utf-8");
    }
  } catch {
    // ignore trim errors
  }
}

const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;
const originalInfo = console.info;
const originalDebug = console.debug;

console.log = (...args: unknown[]) => {
  originalLog(...args);
  writeLog("INFO", args);
};
console.error = (...args: unknown[]) => {
  originalError(...args);
  writeLog("ERROR", args);
};
console.warn = (...args: unknown[]) => {
  originalWarn(...args);
  writeLog("WARN", args);
};
console.info = (...args: unknown[]) => {
  originalInfo(...args);
  writeLog("INFO", args);
};
console.debug = (...args: unknown[]) => {
  originalDebug(...args);
  writeLog("DEBUG", args);
};

export function getRecentLogs(lineCount: number = 500): string[] {
  if (!existsSync(LOG_FILE)) return [];
  const content = readFileSync(LOG_FILE, "utf-8");
  const lines = content.split("\n").filter(Boolean);
  return lines.slice(-lineCount);
}
