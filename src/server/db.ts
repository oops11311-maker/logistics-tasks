import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export type Row = Record<string, unknown>;
export type Query = <T = Row>(text: string, params?: unknown[]) => Promise<T[]>;

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;
let local: Promise<PGlite> | undefined;

export function databaseIsLocal(): boolean {
  return databaseUrl === "";
}

export const sql: Query = async <T = Row>(text: string, params: unknown[] = []): Promise<T[]> => {
  if (databaseUrl !== "") {
    return (await postgresPool().query(text, params)).rows as T[];
  }
  const db = await localDb();
  return (await db.query<Row>(text, params)).rows as T[];
};

export async function withTransaction<T>(fn: (q: Query) => Promise<T>): Promise<T> {
  if (databaseUrl !== "") {
    const client = await postgresPool().connect();
    try {
      await client.query("begin");
      const q: Query = async <T = Row>(text: string, params: unknown[] = []): Promise<T[]> =>
        (await client.query(text, params)).rows as T[];
      const result = await fn(q);
      await client.query("commit");
      return result;
    } catch (error) {
      try {
        await client.query("rollback");
      } catch {
        // The original error is the one to surface.
      }
      throw error;
    } finally {
      client.release();
    }
  }
  const db = await localDb();
  return db.transaction(async (tx) => {
    const q: Query = async <T = Row>(text: string, params: unknown[] = []): Promise<T[]> =>
      (await tx.query<Row>(text, params)).rows as T[];
    return fn(q);
  });
}

function postgresPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: databaseUrl, max: 5 });
    pool.on("connect", (client) => {
      void client.query("set statement_timeout = '8s'").catch(() => undefined);
    });
  }
  return pool;
}

async function localDb(): Promise<PGlite> {
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return local;
}

async function startLocal(): Promise<PGlite> {
  const db = new PGlite();
  const files = (await readdir("migrations").catch(() => [])).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(`migrations/${file}`, "utf8"));
  }
  return db;
}

export async function resetLocalDatabase(): Promise<void> {
  if (databaseUrl !== "") {
    throw new Error("refusing to reset while DATABASE_URL is set");
  }
  const pending = local;
  local = undefined;
  if (!pending) return;
  const db = await pending.catch(() => undefined);
  await db?.close();
}
