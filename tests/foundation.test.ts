import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { Client } from "pg";
import { fixture, ids, demoUsers, userKey } from "./support/fixture";
import { Database } from "../apps/api/src/database";
import { digest } from "../apps/api/src/auth";
import { readConfig } from "../apps/api/src/config";
let f: Awaited<ReturnType<typeof fixture>>;
let admin: Awaited<ReturnType<typeof f.session>>,
  beta: typeof admin,
  executor: typeof admin,
  auditor: typeof admin,
  commercial: typeof admin;
before(
  async () => {
    f = await fixture();
    admin = await f.session(0);
    beta = await f.session(1);
    executor = await f.session(2);
    auditor = await f.session(3);
    commercial = await f.session(4);
  },
  { timeout: 120000 },
);
after(async () => {
  if (f) await f.close();
});
function call(
  path: string,
  session = admin,
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
) {
  return fetch(f.base + path, {
    method,
    redirect: "manual",
    headers: {
      Cookie: session.cookie,
      ...(body === undefined
        ? {}
        : {
            "Content-Type": "application/json",
            "X-CSRF-Token": session.csrf,
            Origin: f.config.WEB_ORIGIN,
          }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
test("API recusa credencial privilegiada de banco", async () => {
  const db = new Database(f.adminUrl);
  try {
    await assert.rejects(db.verifyRole(), /BYPASSRLS/);
  } finally {
    await db.client.$disconnect();
  }
});
test("sem sessão não acessa dados", async () => {
  assert.equal((await fetch(f.base + "/v1/me")).status, 401);
});
test("me retorna somente vínculos próprios", async () => {
  const r = await call("/v1/me");
  assert.equal(r.status, 200);
  const b = await r.json();
  assert.equal(b.memberships.length, 1);
  assert.equal(b.memberships[0].tenantId, ids.alpha);
  assert.equal(b.platformOperator, false);
});
test("consulta cruzada de empresa e recurso retorna 404", async () => {
  assert.equal((await call(`/v1/tenants/${ids.beta}/units`)).status, 404);
  assert.equal(
    (await call(`/v1/tenants/${ids.alpha}/units/${ids.unitB}`)).status,
    404,
  );
  assert.equal(
    (await call(`/v1/tenants/${ids.alpha}/units`, beta)).status,
    404,
  );
});
test("executor vê somente sua unidade e não altera", async () => {
  const units = await (
    await call(`/v1/tenants/${ids.alpha}/units`, executor)
  ).json();
  assert.deepEqual(
    units.map((u: { id: string }) => u.id),
    [ids.unitA],
  );
  assert.equal(
    (await call(`/v1/tenants/${ids.alpha}/units/${ids.unitA2}`, executor))
      .status,
    404,
  );
  assert.equal(
    (
      await call(`/v1/tenants/${ids.alpha}/units`, executor, "POST", {
        name: "Negada",
      })
    ).status,
    403,
  );
});
test("auditor não cria unidade nem usuário", async () => {
  assert.equal(
    (
      await call(`/v1/tenants/${ids.alpha}/units`, auditor, "POST", {
        name: "Negada",
      })
    ).status,
    403,
  );
});
test("privilegiado sem MFA negado", async () => {
  const weak = await f.session(0, false);
  assert.equal(
    (await call(`/v1/tenants/${ids.alpha}/units`, weak)).status,
    403,
  );
});
test("CSRF rejeita token ausente e origem estrangeira", async () => {
  assert.equal(
    (
      await call(
        `/v1/tenants/${ids.alpha}/units`,
        admin,
        "POST",
        { name: "Teste" },
        { "X-CSRF-Token": "" },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        `/v1/tenants/${ids.alpha}/units`,
        admin,
        "POST",
        { name: "Teste" },
        { Origin: "https://evil.example" },
      )
    ).status,
    403,
  );
});
test("payload estrito bloqueia tenantId e perfil injetados", async () => {
  assert.equal(
    (
      await call(`/v1/tenants/${ids.alpha}/units`, admin, "POST", {
        name: "Teste",
        tenantId: ids.beta,
      })
    ).status,
    400,
  );
});
test("unidade é persistida e alteração produz auditoria", async () => {
  const r = await call(`/v1/tenants/${ids.alpha}/units`, admin, "POST", {
    name: "Unidade de teste",
  });
  assert.equal(r.status, 201);
  const u = await r.json();
  const got = await call(`/v1/tenants/${ids.alpha}/units/${u.id}`);
  assert.equal((await got.json()).name, "Unidade de teste");
  const history = await (await call(`/v1/tenants/${ids.alpha}/audit`)).json();
  assert.ok(history.some((e: { resourceId: string }) => e.resourceId === u.id));
});
test("concorrência impede sobrescrita silenciosa", async () => {
  const responses = await Promise.all(
    ["Nome A", "Nome B"].map((name) =>
      call(`/v1/tenants/${ids.alpha}/units/${ids.unitA2}`, admin, "PATCH", {
        name,
        version: 1,
      }),
    ),
  );
  assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
});
test("atualização cruzada não modifica outra empresa", async () => {
  assert.equal(
    (
      await call(
        `/v1/tenants/${ids.alpha}/units/${ids.unitB}`,
        admin,
        "PATCH",
        { name: "Invadida", version: 1 },
      )
    ).status,
    404,
  );
  const own = await (
    await call(`/v1/tenants/${ids.beta}/units/${ids.unitB}`, beta)
  ).json();
  assert.equal(own.name, "Unidade Beta");
});
test("associação de unidade estrangeira negada", async () => {
  const r = await call(`/v1/tenants/${ids.alpha}/members`, admin, "POST", {
    userId: "a".repeat(64),
    displayName: "Fictício",
    role: "EXECUTOR",
    allUnits: false,
    unitIds: [ids.unitB],
  });
  assert.equal(r.status, 404);
});
test("RLS bloqueia leitura sem contexto e escrita cruzada mesmo sem filtro ORM", async () => {
  assert.equal((await f.db.client.unit.findMany()).length, 0);
  await f.db.context(
    userKey(f.oidc.issuer, demoUsers[0].sub),
    ids.alpha,
    async (tx) => {
      const all = await tx.unit.findMany();
      assert.ok(all.length > 0);
      assert.ok(all.every((u) => u.tenantId === ids.alpha));
    },
  );
  await assert.rejects(
    f.db.context(userKey(f.oidc.issuer, demoUsers[0].sub), ids.alpha, (tx) =>
      tx.unit.create({ data: { name: "RLS attack", tenantId: ids.beta } }),
    ),
  );
  await f.db.context(
    userKey(f.oidc.issuer, demoUsers[0].sub),
    ids.beta,
    async (tx) => {
      assert.equal((await tx.unit.findMany()).length, 0);
    },
  );
  assert.equal((await f.db.client.unit.findMany()).length, 0);
});
test("chave estrangeira composta rejeita referência cruzada", async () => {
  const m = (
    await f.admin.query(
      'SELECT id FROM memberships WHERE "tenantId"=$1 LIMIT 1',
      [ids.alpha],
    )
  ).rows[0];
  await assert.rejects(
    f.admin.query(
      'INSERT INTO unit_scopes("tenantId","membershipId","unitId") VALUES($1,$2,$3)',
      [ids.alpha, m.id, ids.unitB],
    ),
    (e: unknown) => (e as { code: string }).code === "23503",
  );
});
test("RLS mantém isolamento em consultas concorrentes e após rollback", async () => {
  const results = await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      f.db.context(
        userKey(f.oidc.issuer, demoUsers[i % 2].sub),
        i % 2 ? ids.beta : ids.alpha,
        (tx) => tx.unit.findMany(),
      ),
    ),
  );
  results.forEach((rows, i) =>
    assert.ok(rows.every((r) => r.tenantId === (i % 2 ? ids.beta : ids.alpha))),
  );
  await assert.rejects(
    f.db.context(
      userKey(f.oidc.issuer, demoUsers[0].sub),
      ids.alpha,
      async () => {
        throw new Error("rollback");
      },
    ),
  );
  assert.equal((await f.db.client.unit.findMany()).length, 0);
});
test("runtime não altera trilha de auditoria nem eleva seu papel", async () => {
  const c = new Client({ connectionString: f.appUrl });
  await c.connect();
  try {
    await assert.rejects(c.query("DELETE FROM audit_events"));
    await assert.rejects(c.query("ALTER ROLE apr_app SUPERUSER"));
    await assert.rejects(c.query("SELECT * FROM platform_operators"));
  } finally {
    await c.end();
  }
});
test("digest de auditoria confere com o evento armazenado", async () => {
  const r = await f.admin.query(
    'SELECT count(*)::int AS n FROM audit_events WHERE hash<>app.audit_digest(id,"tenantId",actor,action,resource,"resourceId",payload,"createdAt")',
  );
  assert.equal(r.rows[0].n, 0);
});
test("comercial lista cadastros mas não ganha acesso ao conteúdo", async () => {
  assert.equal((await call("/v1/platform/tenants", commercial)).status, 200);
  assert.equal(
    (await call(`/v1/tenants/${ids.alpha}/units`, commercial)).status,
    404,
  );
  assert.equal((await call("/v1/platform/tenants", admin)).status, 403);
});
test("provisionamento comercial cria empresa com administrador explícito", async () => {
  const r = await call("/v1/platform/tenants", commercial, "POST", {
    legalName: "Empresa Fictícia Gama",
    name: "Gama Demo",
    cnpj: "00000000000300",
    adminUserId: userKey(f.oidc.issuer, demoUsers[1].sub),
    adminName: "Administrador fictício",
  });
  assert.equal(r.status, 201);
  const { id } = await r.json();
  assert.equal((await call(`/v1/tenants/${id}/units`, commercial)).status, 404);
  assert.equal((await call(`/v1/tenants/${id}/units`, beta)).status, 200);
});
test("desativação de vínculo corta acesso da sessão existente", async () => {
  const members = await (await call(`/v1/tenants/${ids.alpha}/members`)).json();
  const target = members.find((m: { role: string }) => m.role === "EXECUTOR");
  assert.equal(
    (
      await call(
        `/v1/tenants/${ids.alpha}/members/${target.id}`,
        admin,
        "PATCH",
        { active: false, version: target.version },
      )
    ).status,
    200,
  );
  assert.equal(
    (await call(`/v1/tenants/${ids.alpha}/units`, executor)).status,
    404,
  );
});
test("sessão expirada e logout são efetivos", async () => {
  const s = await f.session();
  await f.db.client.session.update({
    where: { hash: digest(s.token) },
    data: { idleExpiresAt: new Date(0) },
  });
  assert.equal((await call("/v1/me", s)).status, 401);
  const active = await f.session();
  assert.equal((await call("/auth/logout", active, "POST", {})).status, 204);
  assert.equal((await call("/v1/me", active)).status, 401);
});
test("produção recusa origem HTTP e exceção OIDC insegura", () => {
  assert.throws(() =>
    readConfig({
      ...f.config,
      NODE_ENV: "production",
    } as unknown as NodeJS.ProcessEnv),
  );
});
test("fluxo OIDC real no cliente: state, PKCE, nonce e assinatura até sessão", async () => {
  const login = await fetch(f.base + "/auth/login", { redirect: "manual" });
  assert.equal(login.status, 302);
  const cookie = login.headers.get("set-cookie")!.split(";")[0];
  assert.match(cookie, /apr_login=/);
  const url = new URL(login.headers.get("location")!);
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  const provider = await fetch(url, { redirect: "manual" });
  const callback = provider.headers.get("location")!;
  const done = await fetch(callback, {
    headers: { Cookie: cookie },
    redirect: "manual",
  });
  assert.equal(done.status, 302);
  const cookies = done.headers.getSetCookie();
  const sessionCookie = cookies
    .find((c) => c.startsWith("apr_session="))!
    .split(";")[0];
  assert.ok(sessionCookie);
  assert.equal(
    (await call("/v1/me", { cookie: sessionCookie, csrf: "", token: "" }))
      .status,
    200,
  );
  assert.equal(
    (await fetch(callback, { headers: { Cookie: cookie }, redirect: "manual" }))
      .status,
    401,
  );
});
test("OIDC não aceita state alterado, nonce, público, expiração ou assinatura inválidos", async () => {
  for (const scenario of [
    "state",
    "badNonce",
    "badAudience",
    "expired",
    "badSignature",
  ] as const) {
    if (scenario !== "state") f.oidc.controls[scenario] = true;
    const login = await fetch(f.base + "/auth/login", { redirect: "manual" });
    const cookie = login.headers.get("set-cookie")!.split(";")[0];
    const p = await fetch(login.headers.get("location")!, {
      redirect: "manual",
    });
    const callback = new URL(p.headers.get("location")!);
    if (scenario === "state") callback.searchParams.set("state", "forged");
    const r = await fetch(callback, {
      headers: { Cookie: cookie },
      redirect: "manual",
    });
    assert.equal(r.status, 401);
    assert.ok(
      !r.headers.getSetCookie().some((c) => c.startsWith("apr_session=")),
    );
    if (scenario !== "state") f.oidc.controls[scenario] = false;
  }
});
test("limite de requisições de login é compartilhado no banco", async () => {
  await f.admin.query(`UPDATE request_limits SET hits=30 WHERE key=$1`, [
    digest("127.0.0.1|auth"),
  ]);
  assert.equal(
    (await fetch(f.base + "/auth/login", { redirect: "manual" })).status,
    429,
  );
});
test("logout permanece disponível após atingir o limite da API", async () => {
  const s = await f.session();
  const key = digest(`user:${userKey(f.oidc.issuer, demoUsers[0].sub)}|api`);
  await f.admin.query("UPDATE request_limits SET hits=300 WHERE key=$1", [key]);
  assert.equal((await call("/v1/me", s)).status, 429);
  assert.equal((await call("/auth/logout", s, "POST", {})).status, 204);
  await f.admin.query("UPDATE request_limits SET hits=0 WHERE key=$1", [key]);
});
test("banco indisponível retorna 503, nunca dados ou autorização", async () => {
  await f.stopDatabase();
  assert.equal((await call("/v1/me")).status, 503);
  assert.equal((await fetch(f.base + "/health/ready")).status, 503);
  assert.equal((await fetch(f.base + "/health/live")).status, 200);
});
