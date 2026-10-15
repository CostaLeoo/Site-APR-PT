import { createServer, Server } from "node:http";
import {
  generateKeyPairSync,
  sign,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import EmbeddedPostgres from "embedded-postgres";
import { Client } from "pg";
import { migrate } from "../../scripts/migrate";
import { seed, demoUsers, userKey, ids } from "../../scripts/seed";
import { createApp } from "../../apps/api/src/app";
import { readConfig } from "../../apps/api/src/config";
import { digest, secret } from "../../apps/api/src/auth";
export { demoUsers, userKey, ids };
const listen = (server: Server, port = 0) =>
  new Promise<number>((resolve) =>
    server.listen(port, "127.0.0.1", () =>
      resolve((server.address() as { port: number }).port),
    ),
  );
export async function mockOidc(port = 0) {
  const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const jwk = {
    ...pair.publicKey.export({ format: "jwk" }),
    kid: "fixture-key",
    use: "sig",
    alg: "RS256",
  };
  const codes = new Map<
    string,
    {
      nonce: string;
      challenge: string;
      redirect: string;
      sub: string;
      acr: string;
    }
  >();
  const controls = {
    acr: "2",
    sub: demoUsers[0].sub,
    badSignature: false,
    badNonce: false,
    badAudience: false,
    expired: false,
  };
  let issuer = "";
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, issuer || "http://localhost");
    const json = (data: unknown, status = 200) => {
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (url.pathname === "/.well-known/openid-configuration")
      return json({
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ["code"],
        subject_types_supported: ["public"],
        id_token_signing_alg_values_supported: ["RS256"],
        token_endpoint_auth_methods_supported: ["client_secret_post"],
        code_challenge_methods_supported: ["S256"],
      });
    if (url.pathname === "/jwks") return json({ keys: [jwk] });
    if (url.pathname === "/authorize") {
      const p = url.searchParams;
      if (
        p.get("client_id") !== "apr-web" ||
        p.get("code_challenge_method") !== "S256"
      )
        return json({ error: "invalid_request" }, 400);
      const code = secret();
      codes.set(code, {
        nonce: p.get("nonce")!,
        challenge: p.get("code_challenge")!,
        redirect: p.get("redirect_uri")!,
        sub: controls.sub,
        acr: controls.acr,
      });
      const target = new URL(p.get("redirect_uri")!);
      target.searchParams.set("code", code);
      target.searchParams.set("state", p.get("state")!);
      res.writeHead(302, { Location: target.href });
      res.end();
      return;
    }
    if (url.pathname === "/token") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = new URLSearchParams(Buffer.concat(chunks).toString());
      const code = body.get("code")!;
      const record = codes.get(code);
      codes.delete(code);
      if (
        !record ||
        body.get("client_secret") !== "test-client-secret-32-characters!" ||
        body.get("redirect_uri") !== record.redirect ||
        createHash("sha256")
          .update(body.get("code_verifier") ?? "")
          .digest("base64url") !== record.challenge
      )
        return json({ error: "invalid_grant" }, 400);
      const now = Math.floor(Date.now() / 1000);
      const payload = {
        iss: issuer,
        sub: record.sub,
        aud: controls.badAudience ? "wrong-client" : "apr-web",
        exp: controls.expired ? now - 120 : now + 300,
        iat: now,
        auth_time: now,
        nonce: controls.badNonce ? "wrong" : record.nonce,
        acr: record.acr,
        name: "Pessoa fictícia de teste",
      };
      const input =
        Buffer.from(
          JSON.stringify({ alg: "RS256", kid: "fixture-key", typ: "JWT" }),
        ).toString("base64url") +
        "." +
        Buffer.from(JSON.stringify(payload)).toString("base64url");
      const signature = sign(
        "RSA-SHA256",
        Buffer.from(input),
        controls.badSignature
          ? generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey
          : pair.privateKey,
      ).toString("base64url");
      return json({
        access_token: "fixture-token-not-for-real-use",
        token_type: "Bearer",
        expires_in: 300,
        id_token: `${input}.${signature}`,
      });
    }
    json({ error: "not_found" }, 404);
  });
  issuer = `http://127.0.0.1:${await listen(server, port)}`;
  return {
    issuer,
    controls,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
export async function fixture(
  options: {
    apiPort?: number;
    webOrigin?: string;
    callbackOrigin?: string;
  } = {},
) {
  const dir = `.local/test-postgres-${randomUUID()}`;
  await mkdir(dir, { recursive: true });
  const probe = createServer();
  const port = await listen(probe);
  await new Promise<void>((r) => probe.close(() => r()));
  const pw = randomBytes(24).toString("hex");
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "postgres",
    password: pw,
    port,
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"],
    onLog: () => {},
    onError: () => {},
  });
  await pg.initialise();
  await pg.start();
  const owner = pg.getPgClient("postgres");
  await owner.connect();
  await owner.query(
    `CREATE ROLE apr_app LOGIN PASSWORD '${pw}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`,
  );
  await owner.query("CREATE DATABASE apr");
  await owner.end();
  const adminUrl = `postgresql://postgres:${pw}@127.0.0.1:${port}/apr`,
    appUrl = `postgresql://apr_app:${pw}@127.0.0.1:${port}/apr`;
  await migrate(adminUrl);
  const oidc = await mockOidc();
  await seed(adminUrl, oidc.issuer);
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();
  const config = readConfig({
    NODE_ENV: "test",
    DATABASE_URL: appUrl,
    API_PORT: "4000",
    WEB_ORIGIN: options.webOrigin ?? "http://localhost:3000",
    API_PUBLIC_ORIGIN: options.callbackOrigin ?? "http://127.0.0.1:4000",
    OIDC_ISSUER: oidc.issuer,
    OIDC_CLIENT_ID: "apr-web",
    OIDC_CLIENT_SECRET: "test-client-secret-32-characters!",
    OIDC_MFA_ACR: "2",
    OIDC_ALLOW_LOCAL_HTTP: "true",
  });
  const result = await createApp(config);
  await result.app.listen(options.apiPort ?? 0, "127.0.0.1");
  const base = await result.app.getUrl();
  if (!options.callbackOrigin) config.API_PUBLIC_ORIGIN = base;
  await writeFile(
    `${dir}/README.txt`,
    "Dados exclusivamente fictícios gerados por teste. Cluster encerrado ao finalizar. Sem dados de trabalhadores reais.",
  );
  let running = true;
  return {
    ...result,
    admin,
    oidc,
    config,
    base,
    adminUrl,
    appUrl,
    async session(index = 0, mfa = true) {
      const token = secret();
      const csrf = secret();
      await result.db.client.session.create({
        data: {
          hash: digest(token),
          csrf,
          userId: userKey(oidc.issuer, demoUsers[index].sub),
          displayName: demoUsers[index].name,
          mfa,
          expiresAt: new Date(Date.now() + 3600000),
          idleExpiresAt: new Date(Date.now() + 1800000),
        },
      });
      return { cookie: `apr_session=${token}`, csrf, token };
    },
    async stopDatabase() {
      await admin.end();
      await pg.stop();
      running = false;
    },
    async close() {
      await result.app.close();
      await result.db.client.$disconnect();
      if (running) await admin.end();
      await oidc.close();
      if (running) await pg.stop();
    },
  };
}
