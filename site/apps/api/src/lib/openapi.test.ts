import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { getOpenApiSpec } from "./openapi";

type Paths = Record<string, Record<string, { security?: unknown; requestBody?: unknown; tags?: string[] }>>;

describe("OpenAPI spec", () => {
  const spec = getOpenApiSpec();
  const paths = spec.paths as Paths;

  it("enumerates key endpoints with correct mount prefixes", () => {
    expect(paths["/api/auth/login"].post).toBeTruthy();
    expect(paths["/api/auth/forgot-password"].post).toBeTruthy();
    expect(paths["/api/device/read-all"].get).toBeTruthy();
    expect(paths["/api/device/commands"].get).toBeTruthy();
    expect(paths["/api/homes"].get).toBeTruthy();
    expect(paths["/api/homes/:homeId/devices"].get).toBeTruthy();
    expect(paths["/api/homes/:homeId/devices/:deviceId/status"].post).toBeTruthy();
    expect(paths["/api/homes/:homeId/schedules"].get).toBeTruthy();
    expect(paths["/api/shop/products"].get).toBeTruthy();
    expect(paths["/api/admin/stats"].get).toBeTruthy();
    expect(paths["/api/health"].get).toBeTruthy();
  });

  it("device API uses apiKey security, auth login is public", () => {
    expect(paths["/api/device/read-all"].get.security).toEqual([{ deviceApiKey: [] }]);
    expect(paths["/api/device/update"].post.security).toEqual([{ deviceApiKey: [] }]);
    expect(paths["/api/auth/login"].post.security).toBeUndefined();
    expect(paths["/api/shop/products"].get.security).toBeUndefined();
    expect(paths["/api/homes"].get.security).toEqual([{ bearerAuth: [] }]);
  });

  it("request bodies attached to key mutations", () => {
    expect(paths["/api/auth/signup"].post.requestBody).toBeTruthy();
    expect(paths["/api/device/update"].post.requestBody).toBeTruthy();
    expect(paths["/api/device/heartbeat"].post.requestBody).toBeTruthy();
    expect(paths["/api/shop/orders"].post.requestBody).toBeTruthy();
    expect(paths["/api/claim"].post.requestBody).toBeTruthy();
  });

  it("covers the whole surface (paths + operations)", () => {
    let ops = 0;
    for (const p of Object.values(paths)) ops += Object.keys(p).length;
    // Saare routers enumerated — auth 9 + device 6 + admin 50+ ...
    expect(ops).toBeGreaterThan(120);
  });

  it("committed openapi.json snapshot in sync (docs:generate chalao agar fail ho)", () => {
    const committedPath = path.resolve(process.cwd(), "openapi.json");
    const committed = JSON.parse(fs.readFileSync(committedPath, "utf8"));
    // Deep equality — routes/schemas badle to snapshot bhi update karna hoga.
    expect(committed).toEqual(spec);
  });
});
