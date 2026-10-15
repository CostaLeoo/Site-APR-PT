import { test } from "node:test";
import assert from "node:assert/strict";
import type { Request } from "express";
import { clientIp } from "../apps/api/src/client-ip";

const request = (headers: Request["headers"]) =>
  ({ headers, socket: { remoteAddress: "127.0.0.1" } }) as Request;

test("fora da Vercel ignora cabeçalhos de IP controlados pelo cliente", () => {
  assert.equal(
    clientIp(request({ "x-vercel-forwarded-for": "203.0.113.5" }), false),
    "127.0.0.1",
  );
});
test("na Vercel usa apenas IP válido do cabeçalho da plataforma", () => {
  assert.equal(
    clientIp(request({ "x-vercel-forwarded-for": "203.0.113.5" }), true),
    "203.0.113.5",
  );
  assert.equal(
    clientIp(request({ "x-vercel-forwarded-for": "2001:db8::1" }), true),
    "2001:db8::1",
  );
  for (const value of ["bad", "203.0.113.5, 127.0.0.1", ["203.0.113.5"]]) {
    assert.equal(
      clientIp(request({ "x-vercel-forwarded-for": value }), true),
      "127.0.0.1",
    );
  }
  assert.equal(
    clientIp(request({ "x-forwarded-for": "203.0.113.5" }), true),
    "127.0.0.1",
  );
});
