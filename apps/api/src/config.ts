import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { z } from "zod";
loadEnv({ path: resolve(__dirname, "../../../.env"), quiet: true });
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  DATABASE_URL: z.string().min(1),
  API_PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.url(),
  API_PUBLIC_ORIGIN: z.url(),
  OIDC_ISSUER: z.url(),
  OIDC_CLIENT_ID: z.string().min(1),
  OIDC_CLIENT_SECRET: z.string().min(16),
  OIDC_MFA_ACR: z.string().min(1).default("2"),
  OIDC_ALLOW_LOCAL_HTTP: z.enum(["true", "false"]).default("false"),
  SESSION_IDLE_SECONDS: z.coerce.number().int().min(60).max(3600).default(1800),
  SESSION_ABSOLUTE_SECONDS: z.coerce
    .number()
    .int()
    .min(60)
    .max(28800)
    .default(28800),
});
export type Config = z.infer<typeof schema>;
export function readConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const c = schema.parse(env);
  for (const value of [c.WEB_ORIGIN, c.API_PUBLIC_ORIGIN, c.OIDC_ISSUER]) {
    const u = new URL(value);
    if (
      u.protocol !== "https:" &&
      !(
        c.NODE_ENV !== "production" &&
        ["localhost", "127.0.0.1", "keycloak"].includes(u.hostname)
      )
    )
      throw new Error("HTTPS obrigatório");
  }
  if (c.NODE_ENV === "production" && c.OIDC_ALLOW_LOCAL_HTTP === "true")
    throw new Error("OIDC HTTP proibido em produção");
  return c;
}
