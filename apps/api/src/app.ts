import "reflect-metadata";
import {
  Module,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import express, { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { Config } from "./config";
import { Database } from "./database";
import { AuthService, digest } from "./auth";
import {
  AuthController,
  FoundationController,
  TenantService,
} from "./controllers";
@Catch()
class SafeErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let status = 500,
      message = "Não foi possível concluir a operação",
      details: unknown;
    if (error instanceof ZodError) {
      status = 400;
      message = "Confira os campos informados";
      details = error.issues.map((i) => ({
        field: i.path.join("."),
        message: i.message,
      }));
    } else if (error instanceof HttpException) {
      status = error.getStatus();
      message = error.message;
    } else if (
      error &&
      typeof error === "object" &&
      "type" in error &&
      error.type === "entity.too.large"
    ) {
      status = 413;
      message = "Requisição muito grande";
    } else if (error instanceof SyntaxError) {
      status = 400;
      message = "JSON inválido";
    } else if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    ) {
      status = 409;
      message = "Conflito de dados. Atualize e tente novamente.";
    }
    // Never log request headers, cookies, body, query string or raw database errors.
    if (status >= 500)
      console.error(
        JSON.stringify({
          event: "request_failed",
          requestId: res.getHeader("X-Request-Id"),
          type: error instanceof Error ? error.constructor.name : "Unknown",
        }),
      );
    res.status(status).json({
      statusCode: status,
      message,
      ...(details ? { details } : {}),
      requestId: res.getHeader("X-Request-Id"),
    });
  }
}
export async function createApp(
  config: Config,
  db = new Database(config.DATABASE_URL),
) {
  await db.verifyRole();
  const auth = new AuthService(db, config);
  @Module({
    controllers: [AuthController, FoundationController],
    providers: [
      { provide: Database, useValue: db },
      { provide: AuthService, useValue: auth },
      { provide: TenantService, useValue: new TenantService(db) },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn"],
    bodyParser: false,
  });
  app.use(helmet({ crossOriginResourcePolicy: { policy: "same-site" } }));
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.enableCors({
    origin: config.WEB_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PATCH"],
    allowedHeaders: ["Content-Type", "X-CSRF-Token"],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("X-Request-Id", randomUUID());
    res.setHeader("Cache-Control", "no-store");
    if (req.path === "/health/live") {
      res.json({ status: "ok", phase: 1 });
      return;
    }
    if (req.path === "/health/ready") {
      db.client.$queryRaw`SELECT 1`
        .then(() => res.json({ status: "ok" }))
        .catch(() => res.status(503).json({ status: "unavailable" }));
      return;
    }
    next();
  });
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Database-backed limiter works across API replicas. Do not trust forwarded IPs by default.
      const protectedRoute =
        req.path.startsWith("/v1") || req.path === "/auth/logout";
      let session;
      if (protectedRoute) {
        session = await auth.authenticate(req);
        Object.assign(req, { session });
      }
      const key = digest(
        session
          ? `user:${session.userId}|api`
          : `${req.socket.remoteAddress}|${req.path.startsWith("/auth") ? "auth" : "api"}`,
      );
      const [limit] = await db.client.$queryRaw<{ hits: number }[]>`
        INSERT INTO request_limits(key,hits,"resetAt") VALUES(${key},1,now()+interval '1 minute')
        ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN request_limits."resetAt"<now() THEN 1 ELSE request_limits.hits+1 END,
        "resetAt"=CASE WHEN request_limits."resetAt"<now() THEN now()+interval '1 minute' ELSE request_limits."resetAt" END RETURNING hits`;
      if (
        req.path !== "/auth/logout" &&
        limit.hits > (session ? 300 : req.path.startsWith("/auth") ? 30 : 300)
      ) {
        res.setHeader("Retry-After", "60");
        res
          .status(429)
          .json({ message: "Muitas tentativas. Aguarde um minuto." });
        return;
      }
      if (session) {
        if (!["GET", "HEAD", "OPTIONS"].includes(req.method))
          auth.csrf(req, session);
      }
      next();
    } catch (e) {
      const status = e instanceof HttpException ? e.getStatus() : 503;
      console.warn(
        JSON.stringify({
          event:
            status === 401
              ? "authentication_denied"
              : status === 403
                ? "authorization_denied"
                : "service_unavailable",
          requestId: res.getHeader("X-Request-Id"),
        }),
      );
      res.status(status).json({
        message:
          e instanceof HttpException
            ? e.message
            : "Serviço temporariamente indisponível",
      });
    }
  });
  app.useGlobalFilters(new SafeErrors());
  const spec = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("APR/PT — API da fundação")
      .setVersion("0.1.0")
      .addCookieAuth(auth.sessionCookie)
      .build(),
  );
  if (config.NODE_ENV !== "production")
    SwaggerModule.setup("api-docs", app, spec);
  app.enableShutdownHooks();
  await app.init();
  return { app, db, auth, spec };
}
