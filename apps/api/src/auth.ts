import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import type { Session, LoginAttempt } from "@prisma/client";
import { Database } from "./database";
import type { Config } from "./config";
import type { Configuration } from "openid-client" with {
  "resolution-mode": "import",
};
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export const identityKey = (issuer: string, sub: string) =>
  digest(JSON.stringify([issuer, sub]));
export const secret = () => randomBytes(32).toString("base64url");
export interface AuthRequest extends Request {
  session: Session;
}
export class AuthService {
  private oidc?: Promise<Configuration>;
  constructor(
    readonly db: Database,
    readonly config: Config,
  ) {}
  get sessionCookie() {
    return this.config.NODE_ENV === "production"
      ? "__Host-apr_session"
      : "apr_session";
  }
  get loginCookie() {
    return this.config.NODE_ENV === "production"
      ? "__Host-apr_login"
      : "apr_login";
  }
  cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
    };
  }
  async provider() {
    this.oidc ??= (async () => {
      const o = await import("openid-client");
      return o.discovery(
        new URL(this.config.OIDC_ISSUER),
        this.config.OIDC_CLIENT_ID,
        this.config.OIDC_CLIENT_SECRET,
        undefined,
        {
          execute: [
            o.enableNonRepudiationChecks,
            ...(this.config.OIDC_ALLOW_LOCAL_HTTP === "true"
              ? [o.allowInsecureRequests]
              : []),
          ],
          timeout: 10,
        },
      );
    })().catch((e) => {
      this.oidc = undefined;
      throw e;
    });
    return this.oidc;
  }
  async login(res: Response) {
    const o = await import("openid-client");
    const provider = await this.provider();
    const verifier = o.randomPKCECodeVerifier(),
      state = o.randomState(),
      nonce = o.randomNonce(),
      cookie = secret();
    await this.db.client.loginAttempt.create({
      data: {
        hash: digest(cookie),
        state,
        nonce,
        verifier,
        expiresAt: new Date(Date.now() + 300_000),
      },
    });
    const url = o.buildAuthorizationUrl(provider, {
      redirect_uri: `${this.config.API_PUBLIC_ORIGIN}/auth/callback`,
      scope: "openid profile",
      state,
      nonce,
      code_challenge: await o.calculatePKCECodeChallenge(verifier),
      code_challenge_method: "S256",
      acr_values: this.config.OIDC_MFA_ACR,
      prompt: "login",
      max_age: "0",
    });
    res.cookie(this.loginCookie, cookie, {
      ...this.cookieOptions(),
      maxAge: 300_000,
    });
    res.redirect(url.href);
  }
  async callback(req: Request, res: Response) {
    const cookie = req.cookies?.[this.loginCookie];
    res.clearCookie(this.loginCookie, this.cookieOptions());
    if (typeof cookie !== "string")
      throw new UnauthorizedException("Login expirado. Entre novamente.");
    const [attempt] = await this.db.client.$queryRaw<
      LoginAttempt[]
    >`DELETE FROM login_attempts WHERE hash=${digest(cookie)} AND "expiresAt">now() RETURNING *`;
    if (!attempt)
      throw new UnauthorizedException("Login expirado. Entre novamente.");
    const o = await import("openid-client");
    const callback = new URL(`${this.config.API_PUBLIC_ORIGIN}/auth/callback`);
    const incoming = new URL(req.originalUrl, this.config.API_PUBLIC_ORIGIN);
    callback.search = incoming.search;
    const provider = await this.provider();
    const tokens = await o
      .authorizationCodeGrant(provider, callback, {
        expectedState: attempt.state,
        expectedNonce: attempt.nonce,
        pkceCodeVerifier: attempt.verifier,
        idTokenExpected: true,
        maxAge: 60,
      })
      .catch(() => {
        throw new UnauthorizedException(
          "Não foi possível validar o login. Entre novamente.",
        );
      });
    const claims = tokens.claims();
    if (
      !claims ||
      typeof claims.sub !== "string" ||
      claims.iss !== this.config.OIDC_ISSUER
    )
      throw new UnauthorizedException();
    const token = secret();
    const now = Date.now();
    // ACR is accepted only from the validated ID token and must match the reviewed IdP MFA flow.
    const mfa = claims.acr === this.config.OIDC_MFA_ACR;
    const old = req.cookies?.[this.sessionCookie];
    if (typeof old === "string")
      await this.db.client.session.deleteMany({ where: { hash: digest(old) } });
    await this.db.client.session.create({
      data: {
        hash: digest(token),
        userId: identityKey(claims.iss, claims.sub),
        displayName:
          typeof claims.name === "string"
            ? claims.name.slice(0, 120)
            : "Usuário",
        csrf: secret(),
        mfa,
        expiresAt: new Date(now + this.config.SESSION_ABSOLUTE_SECONDS * 1000),
        idleExpiresAt: new Date(now + this.config.SESSION_IDLE_SECONDS * 1000),
      },
    });
    res.cookie(this.sessionCookie, token, {
      ...this.cookieOptions(),
      maxAge: this.config.SESSION_ABSOLUTE_SECONDS * 1000,
    });
    res.redirect(`${this.config.WEB_ORIGIN}/painel`);
  }
  async authenticate(req: Request) {
    const token = req.cookies?.[this.sessionCookie];
    if (typeof token !== "string" || token.length > 100)
      throw new UnauthorizedException("Entre para continuar");
    const hash = digest(token);
    const [session] = await this.db.client.$queryRaw<Session[]>`
      UPDATE sessions SET "idleExpiresAt"=LEAST("expiresAt",now()+(${this.config.SESSION_IDLE_SECONDS} * interval '1 second'))
      WHERE hash=${hash} AND "expiresAt">now() AND "idleExpiresAt">now() RETURNING *`;
    if (!session) throw new UnauthorizedException("Sessão expirada");
    return session;
  }
  csrf(req: Request, session: Session) {
    if (req.headers.origin !== this.config.WEB_ORIGIN)
      throw new ForbiddenException("Origem inválida");
    const value = req.headers["x-csrf-token"];
    if (
      typeof value !== "string" ||
      value.length !== session.csrf.length ||
      !timingSafeEqual(Buffer.from(value), Buffer.from(session.csrf))
    )
      throw new ForbiddenException("Confirmação de sessão inválida");
    if (!req.is("application/json"))
      throw new ForbiddenException("Use application/json");
  }
  async logout(req: AuthRequest, res: Response) {
    await this.db.client.session.deleteMany({
      where: { hash: req.session.hash },
    });
    res.clearCookie(this.sessionCookie, this.cookieOptions());
    res.status(204).end();
  }
}
