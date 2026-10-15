import "dotenv/config";
import { Client } from "pg";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
export async function migrate(url: string) {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    await c.query("SELECT pg_advisory_lock(981402)");
    await c.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const file of (await readdir("database/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      const sql = await readFile(`database/migrations/${file}`, "utf8");
      const hash = createHash("sha256").update(sql).digest("hex");
      const old = await c.query(
        "SELECT hash FROM schema_migrations WHERE name=$1",
        [file],
      );
      if (old.rowCount) {
        if (old.rows[0].hash !== hash)
          throw new Error(`Migração alterada: ${file}`);
        continue;
      }
      await c.query("BEGIN");
      try {
        await c.query(sql);
        await c.query(
          "INSERT INTO schema_migrations(name,hash) VALUES($1,$2)",
          [file, hash],
        );
        await c.query("COMMIT");
        console.log(`Migração aplicada: ${file}`);
      } catch (e) {
        await c.query("ROLLBACK");
        throw e;
      }
    }
  } finally {
    await c.end();
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  migrate(process.env.MIGRATION_DATABASE_URL!).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
