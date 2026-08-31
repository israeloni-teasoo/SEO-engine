#!/usr/bin/env node
// Apply the database schema to the Postgres/Neon database in DATABASE_URL.
// Usage: DATABASE_URL=postgres://... npm run db:setup
import postgres from "postgres";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, "..", "src", "lib", "db", "schema.sql"), "utf8");

const sql = postgres(url, { ssl: "require" });

try {
  await sql.unsafe(schema);
  console.log("✅ Schema applied successfully.");
} catch (err) {
  console.error("❌ Failed to apply schema:", err.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
