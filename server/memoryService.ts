import { createHash } from "node:crypto";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";

export type MemoryScope = "global" | "case_type" | "case";
export type MemoryCategory =
  | "instruction"
  | "preference"
  | "edit_example"
  | "author_note"
  | "review_feedback"
  | "manual";
export type MemoryStatus = "active" | "inactive" | "superseded";

export type UserMemoryItem = {
  id: number;
  userId: number;
  scope: MemoryScope;
  caseId: number | null;
  caseType: string | null;
  category: MemoryCategory;
  content: string;
  confidence: string | number;
  reinforcementCount: number;
  usageCount: number;
  status: MemoryStatus;
  sourceEventId: number | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastUsedAt: Date | string | null;
};

let memoryPool: mysql.Pool | null = null;

function getMemoryPool() {
  if (!ENV.databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  if (!memoryPool) {
    memoryPool = mysql.createPool(ENV.databaseUrl);
  }
  return memoryPool;
}

function normalizeMemoryText(value: string, maxLength = 12_000) {
  const trimmed = value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function fingerprintText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function resolveScope(input: {
  scope: MemoryScope;
  caseId?: number | null;
  caseType?: string | null;
}) {
  if (input.scope === "case" && input.caseId) {
    return { scope: "case" as const, caseId: input.caseId, caseType: input.caseType?.trim() || null };
  }
  if (input.scope === "case_type" && input.caseType?.trim()) {
    return { scope: "case_type" as const, caseId: null, caseType: input.caseType.trim().slice(0, 120) };
  }
  return { scope: "global" as const, caseId: null, caseType: null };
}

export async function recordMemorySignal(input: {
  userId: number;
  caseId?: number | null;
  caseType?: string | null;
  eventType: string;
  rawText: string;
  scope: MemoryScope;
  category: MemoryCategory;
  confidence?: number;
  metadata?: Record<string, unknown> | null;
}) {
  const content = normalizeMemoryText(input.rawText);
  if (!content) return null;

  const resolved = resolveScope(input);
  const confidence = Math.max(0, Math.min(1, input.confidence ?? 0.9));
  const pool = getMemoryPool();

  const [eventResult] = await pool.execute<mysql.ResultSetHeader>(
    `INSERT INTO user_memory_events
      (userId, caseId, caseType, eventType, rawText, metadataJson)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      input.userId,
      input.caseId ?? null,
      input.caseType?.trim().slice(0, 120) || null,
      input.eventType.slice(0, 64),
      content,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );

  const fingerprint = createHash("sha256")
    .update(
      [
        input.userId,
        resolved.scope,
        resolved.caseId ?? "",
        resolved.caseType ?? "",
        input.category,
        fingerprintText(content),
      ].join("|"),
    )
    .digest("hex");

  await pool.execute(
    `INSERT INTO user_memory_items
      (userId, scope, caseId, caseType, category, content, fingerprint, confidence,
       reinforcementCount, usageCount, status, sourceEventId)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 'active', ?)
     ON DUPLICATE KEY UPDATE
       reinforcementCount = reinforcementCount + 1,
       confidence = GREATEST(confidence, VALUES(confidence)),
       status = 'active',
       sourceEventId = VALUES(sourceEventId),
       updatedAt = CURRENT_TIMESTAMP`,
    [
      input.userId,
      resolved.scope,
      resolved.caseId,
      resolved.caseType,
      input.category,
      content,
      fingerprint,
      confidence,
      eventResult.insertId,
    ],
  );

  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM user_memory_items WHERE userId = ? AND fingerprint = ? LIMIT 1",
    [input.userId, fingerprint],
  );

  return (rows[0] as UserMemoryItem | undefined) ?? null;
}

export async function getRelevantMemories(input: {
  userId: number;
  caseId?: number | null;
  caseType?: string | null;
  limit?: number;
}) {
  const pool = getMemoryPool();
  const limit = Math.max(1, Math.min(24, input.limit ?? 16));
  const predicates: string[] = ["scope = 'global'"];
  const params: unknown[] = [input.userId];

  if (input.caseType?.trim()) {
    predicates.push("(scope = 'case_type' AND caseType = ?)");
    params.push(input.caseType.trim().slice(0, 120));
  }
  if (input.caseId) {
    predicates.push("(scope = 'case' AND caseId = ?)");
    params.push(input.caseId);
  }

  params.push(limit);
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT *
       FROM user_memory_items
      WHERE userId = ?
        AND status = 'active'
        AND (${predicates.join(" OR ")})
      ORDER BY
        CASE scope WHEN 'case' THEN 0 WHEN 'case_type' THEN 1 ELSE 2 END,
        reinforcementCount DESC,
        confidence DESC,
        updatedAt DESC
      LIMIT ?`,
    params,
  );
  return rows as UserMemoryItem[];
}

export function buildMemoryPrompt(items: UserMemoryItem[]) {
  if (!items.length) return "";

  const lines = items.slice(0, 24).map((item, index) => {
    const scopeLabel =
      item.scope === "case"
        ? "this case"
        : item.scope === "case_type"
          ? `case type: ${item.caseType ?? "current"}`
          : "all cases";
    const usageRule =
      item.category === "edit_example"
        ? " Treat this only as a writing/structure example; never copy its case-specific facts."
        : "";
    return `${index + 1}. [${item.category}; ${scopeLabel}] ${item.content}${usageRule}`;
  });

  return [
    "LONG-TERM JUDGE MEMORY:",
    "The following items were learned from this judge's prior instructions, edits, notes, or feedback.",
    "Use them only when relevant. Current explicit instructions override memory. Case evidence and applicable law override both.",
    "Never treat remembered wording, names, dates, amounts, or factual assertions as evidence in a different case.",
    ...lines,
  ].join("\n");
}

export async function markMemoriesUsed(memoryIds: number[]) {
  const ids = Array.from(new Set(memoryIds.filter(id => Number.isInteger(id) && id > 0))).slice(0, 50);
  if (!ids.length) return;
  const placeholders = ids.map(() => "?").join(",");
  const pool = getMemoryPool();
  await pool.execute(
    `UPDATE user_memory_items
        SET usageCount = usageCount + 1, lastUsedAt = CURRENT_TIMESTAMP
      WHERE id IN (${placeholders})`,
    ids,
  );
}

export async function listUserMemories(input: {
  userId: number;
  status?: MemoryStatus | "all";
  limit?: number;
}) {
  const pool = getMemoryPool();
  const limit = Math.max(1, Math.min(500, input.limit ?? 200));
  const params: unknown[] = [input.userId];
  let statusSql = "";
  if (input.status && input.status !== "all") {
    statusSql = " AND status = ?";
    params.push(input.status);
  }
  params.push(limit);
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT * FROM user_memory_items
      WHERE userId = ?${statusSql}
      ORDER BY status = 'active' DESC, updatedAt DESC
      LIMIT ?`,
    params,
  );
  return rows as UserMemoryItem[];
}

export async function listUserMemoryEvents(input: { userId: number; limit?: number }) {
  const pool = getMemoryPool();
  const limit = Math.max(1, Math.min(500, input.limit ?? 100));
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT id, userId, caseId, caseType, eventType, rawText, metadataJson, createdAt
       FROM user_memory_events
      WHERE userId = ?
      ORDER BY createdAt DESC
      LIMIT ?`,
    [input.userId, limit],
  );
  return rows;
}

export async function setUserMemoryStatus(input: {
  userId: number;
  memoryId: number;
  status: MemoryStatus;
}) {
  const pool = getMemoryPool();
  await pool.execute(
    "UPDATE user_memory_items SET status = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?",
    [input.status, input.memoryId, input.userId],
  );
  const [rows] = await pool.execute<mysql.RowDataPacket[]>(
    "SELECT * FROM user_memory_items WHERE id = ? AND userId = ? LIMIT 1",
    [input.memoryId, input.userId],
  );
  return (rows[0] as UserMemoryItem | undefined) ?? null;
}

export async function getUserMemoryStats(userId: number) {
  const pool = getMemoryPool();
  const [itemRows] = await pool.execute<mysql.RowDataPacket[]>(
    `SELECT
        COUNT(*) AS totalItems,
        SUM(status = 'active') AS activeItems,
        SUM(status = 'inactive') AS inactiveItems,
        SUM(status = 'superseded') AS supersededItems,
        COALESCE(SUM(reinforcementCount), 0) AS totalReinforcements,
        COALESCE(SUM(usageCount), 0) AS totalUses
       FROM user_memory_items
      WHERE userId = ?`,
    [userId],
  );
  const [eventRows] = await pool.execute<mysql.RowDataPacket[]>(
    "SELECT COUNT(*) AS totalEvents FROM user_memory_events WHERE userId = ?",
    [userId],
  );
  return {
    totalItems: Number(itemRows[0]?.totalItems ?? 0),
    activeItems: Number(itemRows[0]?.activeItems ?? 0),
    inactiveItems: Number(itemRows[0]?.inactiveItems ?? 0),
    supersededItems: Number(itemRows[0]?.supersededItems ?? 0),
    totalReinforcements: Number(itemRows[0]?.totalReinforcements ?? 0),
    totalUses: Number(itemRows[0]?.totalUses ?? 0),
    totalEvents: Number(eventRows[0]?.totalEvents ?? 0),
  };
}
