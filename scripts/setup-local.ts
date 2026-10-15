import { mkdir, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { demoUsers } from "./seed";
async function main() {
  try {
    await access(".env");
    throw new Error(
      ".env já existe; preserve os segredos e use as instruções de instalação.",
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  await mkdir(".local/keycloak", { recursive: true });
  const password = () => randomBytes(24).toString("hex");
  const admin = password(),
    app = password(),
    oidc = password(),
    keycloak = password(),
    demo = password();
  const env = `NODE_ENV=development\nAPI_PORT=4000\nWEB_ORIGIN=http://localhost:3000\nAPI_PUBLIC_ORIGIN=http://localhost:3000\nDATABASE_URL=postgresql://apr_app:${app}@127.0.0.1:5432/apr\nMIGRATION_DATABASE_URL=postgresql://postgres:${admin}@127.0.0.1:5432/apr\nPOSTGRES_PASSWORD=${admin}\nAPP_DB_PASSWORD=${app}\nKC_BOOTSTRAP_ADMIN_USERNAME=bootstrap\nKC_BOOTSTRAP_ADMIN_PASSWORD=${keycloak}\nOIDC_ISSUER=http://localhost:8080/realms/apr\nOIDC_CLIENT_ID=apr-web\nOIDC_CLIENT_SECRET=${oidc}\nOIDC_MFA_ACR=2\nOIDC_ALLOW_LOCAL_HTTP=true\nSESSION_IDLE_SECONDS=1800\nSESSION_ABSOLUTE_SECONDS=28800\n`;
  await writeFile(".env", env, { flag: "wx", mode: 0o600 });
  const realm = {
    realm: "apr",
    enabled: true,
    displayName: "APR/PT · Desenvolvimento",
    registrationAllowed: false,
    resetPasswordAllowed: false,
    bruteForceProtected: true,
    sslRequired: "external",
    browserFlow: "apr-mfa",
    authenticationFlows: [
      {
        alias: "apr-mfa",
        providerId: "basic-flow",
        topLevel: true,
        builtIn: false,
        authenticationExecutions: [
          {
            flowAlias: "apr-level2",
            authenticatorFlow: true,
            requirement: "CONDITIONAL",
            priority: 10,
          },
        ],
      },
      {
        alias: "apr-level2",
        providerId: "basic-flow",
        topLevel: false,
        builtIn: false,
        authenticationExecutions: [
          {
            authenticator: "conditional-level-of-authentication",
            authenticatorConfig: "apr-loa2",
            requirement: "REQUIRED",
            priority: 10,
            authenticatorFlow: false,
          },
          {
            authenticator: "auth-username-password-form",
            requirement: "REQUIRED",
            priority: 20,
            authenticatorFlow: false,
          },
          {
            authenticator: "auth-otp-form",
            requirement: "REQUIRED",
            priority: 30,
            authenticatorFlow: false,
          },
        ],
      },
    ],
    authenticatorConfig: [
      {
        alias: "apr-loa2",
        config: { "loa-condition-level": "2", "loa-max-age": "0" },
      },
    ],
    clients: [
      {
        clientId: "apr-web",
        enabled: true,
        publicClient: false,
        secret: oidc,
        standardFlowEnabled: true,
        directAccessGrantsEnabled: false,
        serviceAccountsEnabled: false,
        redirectUris: ["http://localhost:3000/auth/callback"],
        webOrigins: ["http://localhost:3000"],
        defaultClientScopes: ["profile", "acr"],
        attributes: {
          "pkce.code.challenge.method": "S256",
          "default.acr.values": "2",
          "minimum.acr.value": "2",
        },
        protocolMappers: [
          {
            name: "acr loa level",
            protocol: "openid-connect",
            protocolMapper: "oidc-acr-mapper",
            config: { "id.token.claim": "true", "access.token.claim": "true" },
          },
        ],
      },
    ],
    users: demoUsers.map((u) => ({
      id: u.sub,
      username: u.username,
      firstName: u.name,
      enabled: true,
      emailVerified: false,
      requiredActions: ["CONFIGURE_TOTP"],
      credentials: [{ type: "password", value: demo, temporary: false }],
    })),
  };
  await writeFile(
    ".local/keycloak/apr-realm.json",
    JSON.stringify(realm, null, 2),
    { mode: 0o600 },
  );
  await writeFile(
    ".local/demo-access.txt",
    `SOMENTE DESENVOLVIMENTO — dados fictícios\nUsuários: ${demoUsers.map((u) => u.username).join(", ")}\nSenha inicial: ${demo}\nMFA: cadastrar TOTP no primeiro login.\nKeycloak bootstrap: bootstrap\nSenha bootstrap: ${keycloak}\n`,
    { mode: 0o600 },
  );
  console.log(
    "Configuração criada em .env; acessos fictícios em .local/demo-access.txt. Não versionar esses arquivos.",
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
