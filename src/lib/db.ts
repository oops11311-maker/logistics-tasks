import { mkdir, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

const DATE_OID = 1082;
const TIME_OID = 1083;
pg.types.setTypeParser(DATE_OID, (value) => value);
pg.types.setTypeParser(TIME_OID, (value) => value);

export type QueryFn = <T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<T[]>;

const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
let pool: pg.Pool | undefined;
let local: Promise<PGlite> | undefined;
let tail: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function usingPostgres(): boolean {
  return databaseUrl !== "";
}

export const sql: QueryFn = async (text, params = []) => {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    return (await pool.query(text, params)).rows as never;
  }
  return enqueue(async () => {
    const db = await ensureLocal();
    return (await db.query(text, params)).rows as never;
  });
};

export async function withTransaction<T>(fn: (query: QueryFn) => Promise<T>): Promise<T> {
  if (databaseUrl !== "") {
    pool ??= new pg.Pool({ connectionString: databaseUrl, max: 5 });
    const client = await pool.connect();
    try {
      await client.query("begin");
      const query: QueryFn = async (text, params = []) =>
        (await client.query(text, params)).rows as never;
      const result = await fn(query);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  return enqueue(async () => {
    const db = await ensureLocal();
    await db.exec("begin");
    try {
      const query: QueryFn = async (text, params = []) =>
        (await db.query(text, params)).rows as never;
      const result = await fn(query);
      await db.exec("commit");
      return result;
    } catch (error) {
      await db.exec("rollback");
      throw error;
    }
  });
}

async function ensureLocal(): Promise<PGlite> {
  local ??= startLocal().catch((error: unknown) => {
    local = undefined;
    throw error;
  });
  return local;
}

async function startLocal(): Promise<PGlite> {
  const configured = process.env.PGLITE_DATA_DIR?.trim() ?? "";
  const dataDir =
    configured === ":memory:"
      ? undefined
      : configured !== ""
        ? configured
        : path.join(process.cwd(), ".data", "pglite");
  if (dataDir) await mkdir(dataDir, { recursive: true });
  const db = dataDir ? new PGlite(dataDir) : new PGlite();
  const dir = path.join(process.cwd(), "migrations");
  const files = (await readdir(dir).catch(() => [])).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    await db.exec(await readFile(path.join(dir, file), "utf8"));
  }
  return db;
}

export async function closeDb(): Promise<void> {
  if (pool) {
    const current = pool;
    pool = undefined;
    await current.end();
  }
  const currentLocal = local;
  if (!currentLocal) return;
  await enqueue(async () => {
    const db = await currentLocal;
    local = undefined;
    await db.close();
  });
}
