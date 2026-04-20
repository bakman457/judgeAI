import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const connection = await mysql.createConnection(databaseUrl);
await connection.query("SET FOREIGN_KEY_CHECKS = 0");
await connection.query("DROP TABLE IF EXISTS `case_review_snapshots`");
await connection.query("DROP TABLE IF EXISTS `review_approval_thresholds`");
await connection.query("SET FOREIGN_KEY_CHECKS = 1");
await connection.end();

console.log("Dropped partial review migration tables.");
