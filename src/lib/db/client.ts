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

/**
 * Turn a raw Postgres/connection error into an actionable message. Used by API
 * routes so a setup problem (schema not applied, unreachable DB) surfaces as a
 * clear JSON error instead of an empty 500 the browser reports as
 * "Unexpected end of JSON input".
 */
export function dbSetupHint(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/relation .* does not exist|undefined_table|does not exist|no such table/i.test(msg)) {
    return "The database tables aren't set up yet. Apply the schema once: run `DATABASE_URL=... npm run db:setup`, or paste src/lib/db/schema.sql into Supabase's SQL Editor and run it. Then try again.";
  }
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|connection|terminated|timeout|SASL|password authentication|SSL|self.signed/i.test(msg)) {
    return `Could not connect to the database. Check DATABASE_URL — on Vercel use Supabase's Transaction pooler URI (host …pooler.supabase.com, port 6543) and confirm the password is correct. (${msg})`;
  }
  if (/prepared statement|bind message|pgbouncer/i.test(msg)) {
    return `Database rejected a prepared statement — this is the Supabase pooler. Use the Transaction pooler URI (port 6543) so prepared statements are disabled automatically. (${msg})`;
  }
  return `Database error: ${msg}`;
}
