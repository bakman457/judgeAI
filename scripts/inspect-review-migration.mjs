import mysql from "mysql2/promise";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const connection = await mysql.createConnection(databaseUrl);

const [tables] = await connection.query(`
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = DATABASE()
    AND table_name IN ('case_review_snapshots', 'review_approval_thresholds', '__drizzle_migrations')
  ORDER BY table_name
`);

console.log(JSON.stringify(tables, null, 2));

for (const row of tables) {
  const tableName = row.TABLE_NAME || row.table_name;
  const [createRows] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
  console.log(`\n--- ${tableName} ---`);
  console.log(createRows[0]["Create Table"]);
}

await connection.end();
