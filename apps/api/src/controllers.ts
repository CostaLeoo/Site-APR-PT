import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Req,
  Res,
  Inject,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  HttpCode,
} from "@nestjs/common";
import { ApiOperation, ApiTags, ApiCookieAuth } from "@nestjs/swagger";
import { z } from "zod";
import type { Request, Response } from "express";
import { Database, type Tx } from "./database";
import { type AuthRequest, AuthService } from "./auth";
import {
  requirePermission,
  roleSchema,
  permissions,
  type Role,
  canAccessUnit,
} from "./policy";
const uuid = z.uuid();
const name = z.string().trim().min(2).max(120);
const memberInput = z
  .object({
    userId: z.string().regex(/^[a-f0-9]{64}$/),
    displayName: name,
    role: roleSchema,
    allUnits: z.boolean(),
    unitIds: z.array(uuid).max(100),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.role === "COMPANY_ADMIN" && !v.allUnits)
      c.addIssue({
        code: "custom",
        message: "Administrador deve ter escopo de empresa",
      });
    if (!v.allUnits && !v.unitIds.length)
      c.addIssue({ code: "custom", message: "Selecione ao menos uma unidade" });
  });
export class TenantService {
  constructor(readonly db: Database) {}
  async run<T>(
    req: AuthRequest,
    id: string,
    permission: string,
    fn: (
      tx: Tx,
      member: Awaited<ReturnType<Tx["membership"]["findFirstOrThrow"]>> & {
        scopes: { unitId: string }[];
      },
    ) => Promise<T>,
  ) {
    uuid.parse(id);
    return this.db.context(req.session.userId, id, async (tx) => {
      const member = await tx.membership.findFirst({
        where: { tenantId: id, userId: req.session.userId, active: true },
        include: { scopes: true },
      });
      if (!member) throw new NotFoundException("Empresa não encontrada");
      requirePermission(member.role, permission, req.session.mfa);
      return fn(tx, member);
    });
  }
}
@Controller("auth")
@ApiTags("Autenticação")
export class AuthController {
  constructor(@Inject(AuthService) private auth: AuthService) {}
  @Get("login")
  @ApiOperation({ summary: "Inicia OIDC com PKCE, state e nonce" })
  login(@Res() res: Response) {
    return this.auth.login(res);
  }
  @Get("callback") callback(@Req() req: Request, @Res() res: Response) {
    return this.auth.callback(req, res);
  }
  @Post("logout") @HttpCode(204) logout(
    @Req() req: AuthRequest,
    @Res() res: Response,
  ) {
    return this.auth.logout(req, res);
  }
}
@Controller("v1")
@ApiCookieAuth()
@ApiTags("Fundação multiempresa")
export class FoundationController {
  constructor(
    @Inject(Database) private db: Database,
    @Inject(TenantService) private tenants: TenantService,
  ) {}
  @Get("me")
  async me(@Req() req: AuthRequest) {
    return this.db.context(req.session.userId, null, async (tx) => {
      const memberships = await tx.membership.findMany({
        where: { userId: req.session.userId, active: true },
        include: { tenant: true },
        take: 100,
      });
      const [op] = await tx.$queryRaw<
        { allowed: boolean }[]
      >`SELECT app.is_operator() AS allowed`;
      return {
        userId: req.session.userId,
        name: req.session.displayName,
        mfa: req.session.mfa,
        csrf: req.session.csrf,
        platformOperator: op.allowed && req.session.mfa,
        memberships: memberships.map((m) => ({
          tenantId: m.tenantId,
          name: m.tenant.name,
          role: m.role,
          permissions: permissions[m.role as Role],
        })),
      };
    });
  }
  @Get("tenants/:tenantId")
  company(@Req() req: AuthRequest, @Param("tenantId") id: string) {
    return this.tenants.run(req, id, "company:read", (tx) =>
      tx.tenant.findUnique({ where: { id } }),
    );
  }
  @Get("tenants/:tenantId/units")
  units(@Req() req: AuthRequest, @Param("tenantId") id: string) {
    return this.tenants.run(req, id, "unit:read", (tx, m) =>
      tx.unit.findMany({
        where: {
          tenantId: id,
          ...(!m.allUnits ? { id: { in: m.scopes.map((s) => s.unitId) } } : {}),
        },
        orderBy: { name: "asc" },
        take: 100,
      }),
    );
  }
  @Get("tenants/:tenantId/units/:unitId")
  unit(
    @Req() req: AuthRequest,
    @Param("tenantId") id: string,
    @Param("unitId") unitId: string,
  ) {
    uuid.parse(unitId);
    return this.tenants.run(req, id, "unit:read", async (tx, m) => {
      if (!canAccessUnit(m, unitId)) throw new NotFoundException();
      const unit = await tx.unit.findFirst({
        where: { tenantId: id, id: unitId },
      });
      if (!unit) throw new NotFoundException();
      return unit;
    });
  }
  @Post("tenants/:tenantId/units")
  createUnit(
    @Req() req: AuthRequest,
    @Param("tenantId") id: string,
    @Body() body: unknown,
  ) {
    const data = z.object({ name }).strict().parse(body);
    return this.tenants.run(req, id, "unit:write", (tx) =>
      tx.unit.create({ data: { ...data, tenantId: id } }),
    );
  }
  @Patch("tenants/:tenantId/units/:unitId")
  updateUnit(
    @Req() req: AuthRequest,
    @Param("tenantId") id: string,
    @Param("unitId") unitId: string,
    @Body() body: unknown,
  ) {
    uuid.parse(unitId);
    const data = z
      .object({ name, version: z.number().int().positive() })
      .strict()
      .parse(body);
    return this.tenants.run(req, id, "unit:write", async (tx) => {
      if (!(await tx.unit.findFirst({ where: { id: unitId, tenantId: id } })))
        throw new NotFoundException();
      const r = await tx.unit.updateMany({
        where: { id: unitId, tenantId: id, version: data.version },
        data: { name: data.name, version: { increment: 1 } },
      });
      if (r.count !== 1)
        throw new ConflictException(
          "O registro foi alterado. Atualize antes de salvar.",
        );
      return tx.unit.findFirst({ where: { id: unitId, tenantId: id } });
    });
  }
  @Get("tenants/:tenantId/members")
  members(@Req() req: AuthRequest, @Param("tenantId") id: string) {
    return this.tenants.run(req, id, "member:read", (tx, m) =>
      tx.membership.findMany({
        where: {
          tenantId: id,
          ...(!m.allUnits
            ? {
                scopes: {
                  some: { unitId: { in: m.scopes.map((s) => s.unitId) } },
                },
              }
            : {}),
        },
        include: { scopes: true },
        orderBy: { displayName: "asc" },
        take: 100,
      }),
    );
  }
  @Post("tenants/:tenantId/members")
  addMember(
    @Req() req: AuthRequest,
    @Param("tenantId") id: string,
    @Body() body: unknown,
  ) {
    const data = memberInput.parse(body);
    return this.tenants.run(req, id, "member:write", async (tx) => {
      const ids = [...new Set(data.unitIds)];
      if (
        (await tx.unit.count({ where: { tenantId: id, id: { in: ids } } })) !==
        ids.length
      )
        throw new NotFoundException("Unidade não encontrada");
      const m = await tx.membership.create({
        data: {
          tenantId: id,
          userId: data.userId,
          displayName: data.displayName,
          role: data.role,
          allUnits: data.allUnits,
        },
      });
      if (ids.length)
        await tx.unitScope.createMany({
          data: ids.map((unitId) => ({
            tenantId: id,
            membershipId: m.id,
            unitId,
          })),
        });
      return m;
    });
  }
  @Patch("tenants/:tenantId/members/:memberId")
  changeMember(
    @Req() req: AuthRequest,
    @Param("tenantId") id: string,
    @Param("memberId") memberId: string,
    @Body() body: unknown,
  ) {
    uuid.parse(memberId);
    const data = z
      .object({ active: z.boolean(), version: z.number().int().positive() })
      .strict()
      .parse(body);
    return this.tenants.run(req, id, "member:write", async (tx, actor) => {
      if (actor.id === memberId)
        throw new ForbiddenException(
          "Não é permitido desativar o próprio vínculo",
        );
      const m = await tx.membership.findFirst({
        where: { id: memberId, tenantId: id },
      });
      if (!m) throw new NotFoundException();
      if (
        m.role === "COMPANY_ADMIN" &&
        !data.active &&
        (await tx.membership.count({
          where: { tenantId: id, role: "COMPANY_ADMIN", active: true },
        })) <= 1
      )
        throw new ConflictException("Mantenha ao menos um administrador ativo");
      const result = await tx.membership.updateMany({
        where: { id: memberId, tenantId: id, version: data.version },
        data: { active: data.active, version: { increment: 1 } },
      });
      if (result.count !== 1)
        throw new ConflictException("Vínculo alterado por outro usuário");
      return { updated: true };
    });
  }
  @Get("tenants/:tenantId/audit")
  audit(@Req() req: AuthRequest, @Param("tenantId") id: string) {
    return this.tenants.run(req, id, "audit:read", (tx, m) => {
      if (!m.allUnits)
        throw new ForbiddenException(
          "Consulta de auditoria requer escopo de empresa",
        );
      return tx.auditEvent.findMany({
        where: { tenantId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    });
  }
  @Get("platform/tenants")
  async commercial(@Req() req: AuthRequest) {
    if (!req.session.mfa) throw new ForbiddenException("MFA obrigatório");
    return this.db.context(req.session.userId, null, async (tx) => {
      const [op] = await tx.$queryRaw<
        { allowed: boolean }[]
      >`SELECT app.is_operator() AS allowed`;
      if (!op.allowed) throw new ForbiddenException();
      return tx.$queryRaw`SELECT * FROM app.commercial_tenants() LIMIT 100`;
    });
  }
  @Post("platform/tenants")
  async provision(@Req() req: AuthRequest, @Body() body: unknown) {
    if (!req.session.mfa) throw new ForbiddenException("MFA obrigatório");
    const data = z
      .object({
        legalName: name,
        name,
        cnpj: z.string().regex(/^[A-Z0-9]{12}\d{2}$/),
        adminUserId: z.string().regex(/^[a-f0-9]{64}$/),
        adminName: name,
      })
      .strict()
      .parse(body);
    return this.db.context(req.session.userId, null, async (tx) => {
      const [op] = await tx.$queryRaw<
        { allowed: boolean }[]
      >`SELECT app.is_operator() AS allowed`;
      if (!op.allowed) throw new ForbiddenException();
      const [created] = await tx.$queryRaw<
        { id: string }[]
      >`SELECT app.provision_tenant(${data.legalName},${data.name},${data.cnpj},${data.adminUserId},${data.adminName}) AS id`;
      return created;
    });
  }
}
