process.env.PGLITE_DATA_DIR = process.argv[2];
delete process.env.DATABASE_URL;

const { sql, closeDb } = await import("../src/lib/db.ts");
const rows = await sql<{ name: string }>(
  `select name from holidays where stage = 'production' and day = '2099-01-02'::date`,
);
await closeDb();
if (rows[0]?.name !== "재시작 확인") {
  console.error("missing", rows);
  process.exit(1);
}
console.log("read");
