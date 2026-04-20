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
        await ensureInheritanceReviewSchema(connection);
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
