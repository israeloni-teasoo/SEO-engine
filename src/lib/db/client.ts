import postgres from "postgres";

// Lazy singleton so importing this module never opens a connection at build time.
// A connection is only established on first query at request time.
let sql: ReturnType<typeof postgres> | null = null;

export class MissingDatabaseError extends Error {
  constructor() {
    super("DATABASE_URL is not set. Configure a Postgres (Neon) connection string.");
    this.name = "MissingDatabaseError";
  }
}

export function db() {
  if (!process.env.DATABASE_URL) throw new MissingDatabaseError();
  if (!sql) {
    sql = postgres(process.env.DATABASE_URL, {
      ssl: "require",
      max: 5,
      idle_timeout: 20,
      // Map snake_case columns <-> camelCase JS keys automatically.
      transform: postgres.camel,
    });
  }
  return sql;
}

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
