import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import { access, mkdir } from "node:fs/promises";
import { Client } from "pg";
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Somente desenvolvimento");
  const owner = new URL(process.env.MIGRATION_DATABASE_URL!);
  if (
    !["localhost", "127.0.0.1"].includes(owner.hostname) ||
    owner.pathname !== "/apr"
  )
    throw new Error("Use banco local apr");
  await mkdir(".local/postgres", { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: ".local/postgres",
    user: "postgres",
    password: decodeURIComponent(owner.password),
    port: Number(owner.port) || 5432,
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  try {
    await access(".local/postgres/PG_VERSION");
  } catch {
    await pg.initialise();
  }
  await pg.start();
  const c = pg.getPgClient("postgres");
  await c.connect();
  try {
    const role = await c.query(
      "SELECT 1 FROM pg_roles WHERE rolname='apr_app'",
    );
    if (!role.rowCount) {
      const pw = new URL(process.env.DATABASE_URL!).password;
      if (!/^[a-f0-9]+$/.test(pw))
        throw new Error("Use senha gerada por setup:local");
      await c.query(
        `CREATE ROLE apr_app LOGIN PASSWORD '${pw}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
      );
    }
    if (
      !(await c.query("SELECT 1 FROM pg_database WHERE datname='apr'")).rowCount
    )
      await c.query("CREATE DATABASE apr");
  } finally {
    await c.end();
  }
  console.log(
    "PostgreSQL local disponível em 127.0.0.1:5432. Ctrl+C encerra sem apagar dados.",
  );
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  setInterval(() => {}, 60_000);
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
