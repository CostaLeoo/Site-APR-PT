import { isIP } from "node:net";
import type { Request } from "express";

export function clientIp(req: Request, onVercel = process.env.VERCEL === "1") {
  // Only trust the platform-owned header when running behind Vercel ingress.
  // Never enable blanket Express `trust proxy` for arbitrary forwarded headers.
  const forwarded = req.headers["x-vercel-forwarded-for"];
  if (onVercel && typeof forwarded === "string" && isIP(forwarded.trim())) {
    return forwarded.trim();
  }
  return req.socket.remoteAddress ?? "unknown";
}
