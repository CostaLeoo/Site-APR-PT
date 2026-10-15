import { ForbiddenException } from "@nestjs/common";
import { z } from "zod";
export const roles = [
  "COMPANY_ADMIN",
  "SST",
  "SUPERVISOR",
  "EXECUTOR",
  "AUDITOR",
] as const;
export const roleSchema = z.enum(roles);
export type Role = (typeof roles)[number];
export const permissions: Record<Role, readonly string[]> = {
  COMPANY_ADMIN: [
    "company:read",
    "company:write",
    "unit:read",
    "unit:write",
    "member:read",
    "member:write",
    "audit:read",
  ],
  SST: ["company:read", "unit:read", "member:read", "audit:read"],
  SUPERVISOR: ["company:read", "unit:read"],
  EXECUTOR: ["company:read", "unit:read"],
  AUDITOR: ["company:read", "unit:read", "member:read", "audit:read"],
};
export function requirePermission(
  role: string,
  permission: string,
  mfa: boolean,
) {
  const allowed = permissions[role as Role];
  if (!allowed?.includes(permission))
    throw new ForbiddenException("Permissão insuficiente");
  if (["COMPANY_ADMIN", "SST", "SUPERVISOR"].includes(role) && !mfa)
    throw new ForbiddenException("Autenticação multifator necessária");
}
export function canAccessUnit(
  member: { allUnits: boolean; scopes: { unitId: string }[] },
  id: string,
) {
  return member.allUnits || member.scopes.some((s) => s.unitId === id);
}
// Future operational permissions deliberately absent. A role alone cannot release a PT.
