process.env.PGLITE_DATA_DIR = process.argv[2];
delete process.env.DATABASE_URL;

const { sql, closeDb } = await import("../src/lib/db.ts");
await sql(
  `insert into holidays (stage, day, name) values ('production', '2099-01-02', '재시작 확인')
   on conflict (stage, day) do update set name = excluded.name`,
);
await closeDb();
console.log("wrote");
