import postgres from "postgres";

// Lazy singleton so importing this module never opens a connection at build time.
// A connection is only established on first query at request time.
let sql: ReturnType<typeof postgres> | null = null;

export class MissingDatabaseError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Configure a Postgres (Supabase) connection string.");
    this.name = "MissingDatabaseError";
  }
}

// Supabase's transaction pooler (PgBouncer, port 6543) doesn't support prepared
// statements, so we must disable them there. Detect the pooler and turn them off;
// direct/session connections keep the faster prepared path.
function usesTransactionPooler(url: string): boolean {
  return /[:@][^/]*:6543\b/.test(url) || /[?&]pgbouncer=true\b/i.test(url);
}

export function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new MissingDatabaseError();
  if (!sql) {
    sql = postgres(url, {
      ssl: "require",
      max: 5,
      idle_timeout: 20,
      prepare: !usesTransactionPooler(url),
      // Map snake_case columns <-> camelCase JS keys automatically.
      transform: postgres.camel,
    });
  }
  return sql;
}

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
