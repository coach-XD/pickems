import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { sql?: postgres.Sql };

export function databaseUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

export function getSql(): postgres.Sql {
  const url = databaseUrl();
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add it locally and in the Vercel project.");
  }
  if (!globalForDb.sql) {
    globalForDb.sql = postgres(url, { prepare: false, max: 5, idle_timeout: 20 });
  }
  return globalForDb.sql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export async function closeDb(): Promise<void> {
  if (globalForDb.sql) {
    await globalForDb.sql.end({ timeout: 5 });
    globalForDb.sql = undefined;
  }
}
