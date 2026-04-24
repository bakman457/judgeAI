import mysql from "mysql2/promise";
import { ENV } from "./_core/env";

let repairPromise: Promise<void> | null = null;

type ColumnInfo = {
  COLUMN_NAME: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: "YES" | "NO";
  COLUMN_DEFAULT: string | null;
};

async function getColumn(connection: mysql.Connection, tableName: string, columnName: string) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName],
  );
  return (rows[0] as ColumnInfo | undefined) ?? null;
}

async function tableExists(connection: mysql.Connection, tableName: string) {
  const [rows] = await connection.query<mysql.RowDataPacket[]>(
    `
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName],
  );
  return rows.length > 0;
}

async function ensureColumn(
  connection: mysql.Connection,
  tableName: string,
  columnName: string,
  addStatement: string,
) {
  const column = await getColumn(connection, tableName, columnName);
  if (!column) {
    await connection.query(addStatement);
  }
}

async function ensureProviderSettingsSchema(connection: mysql.Connection) {
  if (!(await tableExists(connection, "ai_provider_settings"))) {
    console.log("[SchemaRepair] ai_provider_settings table does not exist yet — Drizzle will create it");
    return;
  }

  const providerType = await getColumn(connection, "ai_provider_settings", "providerType");
  if (!providerType) {
    console.warn("[SchemaRepair] providerType column missing on ai_provider_settings — skipping enum repair");
  } else if (!providerType.COLUMN_TYPE.includes("'deepseek'")) {
    console.log(
      "[SchemaRepair] Expanding providerType enum. Before:",
      providerType.COLUMN_TYPE,
    );
    await connection.query(`
      ALTER TABLE \`ai_provider_settings\`
        MODIFY COLUMN \`providerType\`
        ENUM('openai','azure_openai','custom_openai_compatible','alibaba_cloud','kimi','deepseek') NOT NULL
    `);
    const after = await getColumn(connection, "ai_provider_settings", "providerType");
    console.log("[SchemaRepair] providerType enum updated. After:", after?.COLUMN_TYPE);
  } else {
    console.log("[SchemaRepair] providerType enum already includes deepseek/kimi — no repair needed");
  }

  await ensureColumn(
    connection,
    "ai_provider_settings",
    "maxTokens",
    "ALTER TABLE `ai_provider_settings` ADD COLUMN `maxTokens` INT NOT NULL DEFAULT 8000",
  );

  await ensureColumn(
    connection,
    "ai_provider_settings",
    "fallbackOrder",
    "ALTER TABLE `ai_provider_settings` ADD COLUMN `fallbackOrder` INT NOT NULL DEFAULT 100",
  );
}

async function ensureDraftSectionsSchema(connection: mysql.Connection) {
  if (!(await tableExists(connection, "draft_sections"))) {
    console.log("[SchemaRepair] draft_sections table does not exist yet — Drizzle will create it");
    return;
  }
  await ensureColumn(
    connection,
    "draft_sections",
    "authorNote",
    "ALTER TABLE `draft_sections` ADD COLUMN `authorNote` TEXT NULL",
  );
}

async function ensureReviewFindingResolutionsTable(connection: mysql.Connection) {
  if (await tableExists(connection, "review_finding_resolutions")) return;
  if (!(await tableExists(connection, "case_review_snapshots"))) {
    console.log("[SchemaRepair] case_review_snapshots missing — skipping review_finding_resolutions for now");
    return;
  }
  console.log("[SchemaRepair] Creating review_finding_resolutions table");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`review_finding_resolutions\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`reviewSnapshotId\` INT NOT NULL,
      \`findingIndex\` INT NOT NULL,
      \`status\` ENUM('addressed','accepted','deferred') NOT NULL,
      \`note\` TEXT NULL,
      \`resolvedBy\` INT NULL,
      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY \`review_finding_resolutions_unique_idx\` (\`reviewSnapshotId\`, \`findingIndex\`),
      INDEX \`review_finding_resolutions_snapshot_idx\` (\`reviewSnapshotId\`),
      CONSTRAINT \`review_finding_resolutions_snapshot_fk\`
        FOREIGN KEY (\`reviewSnapshotId\`) REFERENCES \`case_review_snapshots\`(\`id\`) ON DELETE CASCADE,
      CONSTRAINT \`review_finding_resolutions_user_fk\`
        FOREIGN KEY (\`resolvedBy\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureAiUsageEventsTable(connection: mysql.Connection) {
  if (await tableExists(connection, "ai_usage_events")) return;
  console.log("[SchemaRepair] Creating ai_usage_events table");
  await connection.query(`
    CREATE TABLE IF NOT EXISTS \`ai_usage_events\` (
      \`id\` INT AUTO_INCREMENT PRIMARY KEY,
      \`providerId\` INT NULL,
      \`providerName\` VARCHAR(180) NULL,
      \`model\` VARCHAR(180) NULL,
      \`caseId\` INT NULL,
      \`userId\` INT NULL,
      \`kind\` VARCHAR(32) NOT NULL,
      \`promptTokens\` INT NOT NULL DEFAULT 0,
      \`completionTokens\` INT NOT NULL DEFAULT 0,
      \`totalTokens\` INT NOT NULL DEFAULT 0,
      \`cachedTokens\` INT NOT NULL DEFAULT 0,
      \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`ai_usage_events_created_at_idx\` (\`createdAt\`),
      INDEX \`ai_usage_events_provider_idx\` (\`providerId\`),
      INDEX \`ai_usage_events_case_idx\` (\`caseId\`)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureOcrSettingsSchema(connection: mysql.Connection) {
  if (!(await tableExists(connection, "ocr_settings"))) {
    console.log("[SchemaRepair] ocr_settings table does not exist — creating it");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`ocr_settings\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`provider\` VARCHAR(64) NOT NULL DEFAULT 'tesseract',
        \`enabled\` BOOLEAN NOT NULL DEFAULT TRUE,
        \`language\` VARCHAR(32) NOT NULL DEFAULT 'ell+eng',
        \`createdAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`ocr_settings_provider_idx\` (\`provider\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await connection.query(`
      INSERT INTO \`ocr_settings\` (\`id\`, \`provider\`, \`enabled\`, \`language\`)
      VALUES (1, 'tesseract', TRUE, 'ell+eng')
    `);
    console.log("[SchemaRepair] ocr_settings table created with default row");
  }
}

async function ensureInheritanceReviewSchema(connection: mysql.Connection) {
  if (await tableExists(connection, "review_approval_thresholds")) {
    const caseTypeKey = await getColumn(connection, "review_approval_thresholds", "caseTypeKey");
    if (caseTypeKey && !caseTypeKey.COLUMN_TYPE.includes("'inheritance'")) {
      await connection.query("DELETE FROM `review_approval_thresholds`");
      await connection.query(`
        ALTER TABLE \`review_approval_thresholds\`
          MODIFY COLUMN \`caseTypeKey\`
          ENUM('general','civil','criminal','administrative','inheritance') NOT NULL
      `);
      await connection.query(`
        ALTER TABLE \`review_approval_thresholds\`
          MODIFY COLUMN \`caseTypeKey\`
          ENUM('inheritance') NOT NULL DEFAULT 'inheritance'
      `);
    }
  }

  if (await tableExists(connection, "case_review_snapshots")) {
    const reviewTemplateKey = await getColumn(connection, "case_review_snapshots", "reviewTemplateKey");
    if (reviewTemplateKey && !reviewTemplateKey.COLUMN_TYPE.includes("'inheritance'")) {
      await connection.query(`
        ALTER TABLE \`case_review_snapshots\`
          MODIFY COLUMN \`reviewTemplateKey\`
          ENUM('general','civil','criminal','administrative','inheritance') NOT NULL DEFAULT 'general'
      `);
      await connection.query("UPDATE `case_review_snapshots` SET `reviewTemplateKey` = 'inheritance'");
      await connection.query(`
        ALTER TABLE \`case_review_snapshots\`
          MODIFY COLUMN \`reviewTemplateKey\`
          ENUM('inheritance') NOT NULL DEFAULT 'inheritance'
      `);
    }
  }
}

export async function ensureCurrentDatabaseSchema() {
  if (!repairPromise) {
    repairPromise = (async () => {
      if (!ENV.databaseUrl) {
        console.error("[SchemaRepair] ENV.databaseUrl is empty — cannot run schema repair. Check DATABASE_URL in .env");
        throw new Error("DATABASE_URL is not configured");
      }
      console.log("[SchemaRepair] Running schema repair against database...");
      const connection = await mysql.createConnection(ENV.databaseUrl);
      try {
        await ensureProviderSettingsSchema(connection);
        await ensureOcrSettingsSchema(connection);
        await ensureInheritanceReviewSchema(connection);
        await ensureDraftSectionsSchema(connection);
        await ensureReviewFindingResolutionsTable(connection);
        await ensureAiUsageEventsTable(connection);
        console.log("[SchemaRepair] Schema repair complete");
      } catch (err) {
        console.error("[SchemaRepair] Schema repair failed:", err);
        throw err;
      } finally {
        await connection.end();
      }
    })();
  }

  return repairPromise;
}
