import "dotenv/config";
import { Client } from "pg";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
export const ids = {
  alpha: "11111111-1111-4111-8111-111111111111",
  beta: "22222222-2222-4222-8222-222222222222",
  unitA: "a1111111-1111-4111-8111-111111111111",
  unitA2: "a2222222-2222-4222-8222-222222222222",
  unitB: "b1111111-1111-4111-8111-111111111111",
};
export const demoUsers = [
  {
    sub: "10000000-0000-4000-8000-000000000001",
    username: "admin.alfa",
    name: "Administrador Alfa — fictício",
    role: "COMPANY_ADMIN",
    tenant: ids.alpha,
  },
  {
    sub: "10000000-0000-4000-8000-000000000002",
    username: "admin.beta",
    name: "Administrador Beta — fictício",
    role: "COMPANY_ADMIN",
    tenant: ids.beta,
  },
  {
    sub: "10000000-0000-4000-8000-000000000003",
    username: "executante.alfa",
    name: "Executante Alfa — fictício",
    role: "EXECUTOR",
    tenant: ids.alpha,
  },
  {
    sub: "10000000-0000-4000-8000-000000000004",
    username: "auditor.alfa",
    name: "Auditor Alfa — fictício",
    role: "AUDITOR",
    tenant: ids.alpha,
  },
  {
    sub: "10000000-0000-4000-8000-000000000005",
    username: "comercial",
    name: "Operador comercial — fictício",
    role: "PLATFORM",
    tenant: null,
  },
];
export const userKey = (issuer: string, sub: string) =>
  createHash("sha256")
    .update(JSON.stringify([issuer, sub]))
    .digest("hex");
export async function seed(url: string, issuer: string) {
  const c = new Client({ connectionString: url });
  await c.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      `INSERT INTO tenants(id,"legalName",name,cnpj) VALUES($1,'Empresa Alfa de Demonstração','Alfa Industrial','00000000000100'),($2,'Empresa Beta de Demonstração','Beta Serviços','00000000000200') ON CONFLICT DO NOTHING`,
      [ids.alpha, ids.beta],
    );
    await c.query(
      `INSERT INTO units(id,"tenantId",name) VALUES($1,$2,'Unidade Norte'),($3,$2,'Unidade Sul'),($4,$5,'Unidade Beta') ON CONFLICT DO NOTHING`,
      [ids.unitA, ids.alpha, ids.unitA2, ids.unitB, ids.beta],
    );
    for (const u of demoUsers) {
      const key = userKey(issuer, u.sub);
      if (u.role === "PLATFORM") {
        await c.query(
          'INSERT INTO platform_operators("userId") VALUES($1) ON CONFLICT DO NOTHING',
          [key],
        );
        continue;
      }
      const result = await c.query(
        `INSERT INTO memberships("tenantId","userId","displayName",role,"allUnits") VALUES($1,$2,$3,$4,$5) ON CONFLICT("tenantId","userId") DO UPDATE SET "displayName"=EXCLUDED."displayName" RETURNING id`,
        [u.tenant, key, u.name, u.role, u.role !== "EXECUTOR"],
      );
      if (u.role === "EXECUTOR")
        await c.query(
          'INSERT INTO unit_scopes("tenantId","membershipId","unitId") VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
          [u.tenant, result.rows[0].id, ids.unitA],
        );
    }
    await c.query("COMMIT");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    await c.end();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seed fictício proibido em produção");
  seed(process.env.MIGRATION_DATABASE_URL!, process.env.OIDC_ISSUER!)
    .then(() => console.log("Empresas e usuários fictícios cadastrados"))
    .catch((e) => {
      console.error(e.message);
      process.exitCode = 1;
    });
}
