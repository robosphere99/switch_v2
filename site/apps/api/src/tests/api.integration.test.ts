import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { resetRateLimitStore } from "../middleware/rateLimit";

// ---------------------------------------------------------------------------
// Integration tests — REAL MySQL (test DB `switchnest_test`) + REAL HTTP server.
// CI (no MySQL) me suite skip hota hai; locally XAMPP on ho to full flow verify.
// ---------------------------------------------------------------------------

const envFile = dotenv.config({ path: path.resolve(process.cwd(), "../../.env") }).parsed ?? {};
const DB = {
  host: envFile.DB_HOST ?? "localhost",
  port: Number(envFile.DB_PORT) || 3306,
  user: envFile.DB_USER ?? "root",
  pass: envFile.DB_PASS ?? "",
  name: "switchnest_test",
};

// App modules ko import karne se PEHLE test DB set karna zaroori hai —
// PrismaClient env se module-load time pe banata hai.
process.env.DATABASE_URL = `mysql://${encodeURIComponent(DB.user)}:${encodeURIComponent(DB.pass)}@${DB.host}:${DB.port}/${DB.name}?connection_limit=2`;

async function dbReachable(): Promise<boolean> {
  try {
    const c = await mysql.createConnection({
      host: DB.host,
      port: DB.port,
      user: DB.user,
      password: DB.pass,
      connectTimeout: 3000,
    });
    await c.end();
    return true;
  } catch {
    return false;
  }
}

const reachable = await dbReachable();

describe.skipIf(!reachable)("api integration (real MySQL)", () => {
  let server: Server;
  let baseUrl: string;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // 1) Fresh test DB + schema
    const conn = await mysql.createConnection({
      host: DB.host,
      port: DB.port,
      user: DB.user,
      password: DB.pass,
      multipleStatements: true,
      connectTimeout: 5000,
    });
    await conn.query(`DROP DATABASE IF EXISTS \`${DB.name}\``);
    await conn.query(`CREATE DATABASE \`${DB.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${DB.name}\``);
    const schema = fs.readFileSync(path.resolve(process.cwd(), "prisma/schema.sql"), "utf-8");
    await conn.query(schema);
    await conn.end();

    // 2) App + server (port 0 = random)
    const { createApp } = await import("../app");
    const app = createApp();
    server = app.listen(0);
    await new Promise<void>((r) => server.once("listening", () => r()));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    // 3) Direct DB access (token rows, products, etc.)
    prisma = (await import("../lib/prisma")).prisma;
    await prisma.$connect();
  }, 60_000);

  afterAll(async () => {
    server?.close();
    try {
      await prisma?.$disconnect();
    } catch {
      /* ignore */
    }
    try {
      const conn = await mysql.createConnection({
        host: DB.host,
        port: DB.port,
        user: DB.user,
        password: DB.pass,
      });
      await conn.query(`DROP DATABASE IF EXISTS \`${DB.name}\``);
      await conn.end();
    } catch {
      /* ignore */
    }
  }, 30_000);

  beforeEach(() => {
    // Rate limit buckets reset — har test fresh window se shuru ho.
    resetRateLimitStore();
  });

  // ---------- helpers ----------

  async function api(pathname: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
    const res = await fetch(`${baseUrl}${pathname}`, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, body: json as { success?: boolean; data?: any; error?: any } };
  }

  async function signup(username: string, email: string, password = "secret123") {
    const r = await api("/api/auth/signup", {
      method: "POST",
      body: { username, email, password },
    });
    expect(r.status).toBe(201);
    return r.body!.data as { accessToken: string; refreshToken: string; user: { id: number; username: string } };
  }

  // ---------- health ----------

  it("GET /api/health → ok", async () => {
    const r = await api("/api/health");
    expect(r.status).toBe(200);
    expect(r.body!.success).toBe(true);
    expect(r.body!.data.status).toBe("ok");
  });

  // ---------- auth ----------

  it("signup creates user + home, tokens returned", async () => {
    const u = await signup("owner1", "owner1@test.local");
    expect(u.accessToken).toBeTruthy();
    expect(u.refreshToken).toBeTruthy();
    expect(u.user.username).toBe("owner1");

    const homes = await api("/api/homes", { token: u.accessToken });
    expect(homes.status).toBe(200);
    expect(homes.body!.data).toHaveLength(1);
    expect(homes.body!.data[0].name).toBe("owner1's Home");
  });

  it("duplicate signup → 409", async () => {
    await signup("dup1", "dup1@test.local");
    const r = await api("/api/auth/signup", {
      method: "POST",
      body: { username: "dup1", email: "other@test.local", password: "secret123" },
    });
    expect(r.status).toBe(409);
    expect(r.body!.error.code).toBe("EMAIL_OR_USERNAME_TAKEN");
  });

  it("login: wrong password → 401, correct → 200", async () => {
    await signup("login1", "login1@test.local");
    const bad = await api("/api/auth/login", {
      method: "POST",
      body: { usernameEmail: "login1", password: "wrongpass" },
    });
    expect(bad.status).toBe(401);
    expect(bad.body!.error.code).toBe("INVALID_CREDENTIALS");

    const good = await api("/api/auth/login", {
      method: "POST",
      body: { usernameEmail: "login1@test.local", password: "secret123" },
    });
    expect(good.status).toBe(200);
    expect(good.body!.data.accessToken).toBeTruthy();
  });

  it("/auth/me with token → user, without → 401", async () => {
    const u = await signup("me1", "me1@test.local");
    const r = await api("/api/auth/me", { token: u.accessToken });
    expect(r.status).toBe(200);
    expect(r.body!.data.username).toBe("me1");

    const anon = await api("/api/auth/me");
    expect(anon.status).toBe(401);
  });

  // ---------- password reset ----------

  it("forgot-password: unknown email bhi same response (no user enumeration)", async () => {
    const r = await api("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "ghost@test.local" },
    });
    expect(r.status).toBe(200);
    expect(r.body!.data).toEqual({ sent: true });
  });

  it("forgot-password → reset token row + reset-password completes the cycle", async () => {
    const u = await signup("reset1", "reset1@test.local");

    // SMTP configured nahi → link console me log hota hai; spy se pakdo.
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const r = await api("/api/auth/forgot-password", {
      method: "POST",
      body: { email: "reset1@test.local" },
    });
    expect(r.status).toBe(200);
    expect(r.body!.data).toEqual({ sent: true });

    const logged = logSpy.mock.calls.map((c) => c.join(" ")).join("\n");
    const token = logged.match(/[?&]token=([^&\s]+)/)?.[1];
    expect(token).toBeTruthy();
    logSpy.mockRestore();

    // DB me 1 pending (unused) token hona chahiye
    const row = await prisma.passwordResetToken.findFirst({
      where: { user: { id: u.user.id }, usedAt: null },
    });
    expect(row).toBeTruthy();

    // Reset with token → success
    const reset = await api("/api/auth/reset-password", {
      method: "POST",
      body: { token, newPassword: "newpass456" },
    });
    expect(reset.status).toBe(200);

    // Purana password ab kaam nahi karta, naya karta hai
    const oldLogin = await api("/api/auth/login", {
      method: "POST",
      body: { usernameEmail: "reset1", password: "secret123" },
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await api("/api/auth/login", {
      method: "POST",
      body: { usernameEmail: "reset1", password: "newpass456" },
    });
    expect(newLogin.status).toBe(200);

    // Token ab 1-use — dobara use → 400
    const reuse = await api("/api/auth/reset-password", {
      method: "POST",
      body: { token, newPassword: "another456" },
    });
    expect(reuse.status).toBe(400);
    expect(reuse.body!.error.code).toBe("INVALID_RESET_TOKEN");
  });

  it("reset-password: garbage token → 400", async () => {
    const r = await api("/api/auth/reset-password", {
      method: "POST",
      body: { token: "totally-fake-token-123456", newPassword: "newpass456" },
    });
    expect(r.status).toBe(400);
    expect(r.body!.error.code).toBe("INVALID_RESET_TOKEN");
  });

  // ---------- rate limiting ----------

  it("login: 10 allowed, 11th → 429 with headers", async () => {
    await signup("ratelimit1", "ratelimit1@test.local");

    for (let i = 0; i < 10; i++) {
      const r = await api("/api/auth/login", {
        method: "POST",
        body: { usernameEmail: "ratelimit1", password: "wrong" },
      });
      expect(r.status).toBe(401); // wrong password — limiter nahi, auth 401
    }

    const blocked = await api("/api/auth/login", {
      method: "POST",
      body: { usernameEmail: "ratelimit1", password: "wrong" },
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body!.error.code).toBe("RATE_LIMITED");
  });

  // ---------- API keys + device API (ESP32) ----------

  it("api key create → device read-all works with it, 401 without", async () => {
    const u = await signup("apikey1", "apikey1@test.local");
    const homes = await api("/api/homes", { token: u.accessToken });
    const homeId = homes.body!.data[0].id as number;

    const created = await api("/api/api-keys/", {
      method: "POST",
      token: u.accessToken,
      body: { homeId, label: "esp32-test" },
    });
    expect(created.status).toBe(201);
    const rawKey = created.body!.data.rawKey as string;
    expect(rawKey).toMatch(/^rs_[a-f0-9]+$/);
    expect(created.body!.data.keyHash).toBeUndefined(); // hash kabhi wapas nahi

    // Device API — api_key query param (ESP32 style)
    const read = await fetch(`${baseUrl}/api/device/read-all?api_key=${rawKey}`);
    expect(read.status).toBe(200);
    const readBody = (await read.json()) as { success: boolean; data: { devices: unknown[] } };
    expect(readBody.success).toBe(true);
    expect(readBody.data.devices).toEqual([]);

    // Bina key → 400 (validation pehle — api_key required)
    const noKey = await fetch(`${baseUrl}/api/device/read-all`);
    expect(noKey.status).toBe(400);

    // Bogus key → 401 (requireApiKey)
    const badKey = await fetch(`${baseUrl}/api/device/read-all?api_key=rs_boguskey123`);
    expect(badKey.status).toBe(401);
  });

  // ---------- members + permissions ----------

  it("invite → accept → viewer cannot toggle device, member can", async () => {
    const owner = await signup("owner2", "owner2@test.local");
    const viewer = await signup("viewer2", "viewer2@test.local");
    const member = await signup("member2", "member2@test.local");

    const homes = await api("/api/homes", { token: owner.accessToken });
    const homeId = homes.body!.data[0].id as number;

    // Owner device banata hai (requireHomeMember admin+)
    const dev = await api(`/api/homes/${homeId}/devices`, {
      method: "POST",
      token: owner.accessToken,
      body: { name: "Fan", type: "fan" },
    });
    expect(dev.status).toBe(201);
    const deviceId = dev.body!.data.id as number;

    // Owner viewer2 ko invite karta hai (viewer role)
    const inv = await api(`/api/homes/${homeId}/invitations`, {
      method: "POST",
      token: owner.accessToken,
      body: { email: "viewer2@test.local", role: "viewer" },
    });
    expect(inv.status).toBe(201);
    const inviteCode = inv.body!.data.inviteCode as string;

    // viewer invite accept karta hai
    const accept = await api("/api/homes/invitations/accept", {
      method: "POST",
      token: viewer.accessToken,
      body: { inviteCode },
    });
    expect(accept.status).toBe(200);

    // Viewer device toggle nahi kar sakta → 403
    const viewerToggle = await api(`/api/homes/${homeId}/devices/${deviceId}/status`, {
      method: "POST",
      token: viewer.accessToken,
      body: { status: "on" },
    });
    expect(viewerToggle.status).toBe(403);

    // Viewer device dekh sakta hai (viewer+)
    const viewerList = await api(`/api/homes/${homeId}/devices`, { token: viewer.accessToken });
    expect(viewerList.status).toBe(200);

    // Member join (invite code se) → toggle allowed
    const inv2 = await api(`/api/homes/${homeId}/invitations`, {
      method: "POST",
      token: owner.accessToken,
      body: { email: "member2@test.local", role: "member" },
    });
    const memberAccept = await api("/api/homes/invitations/accept", {
      method: "POST",
      token: member.accessToken,
      body: { inviteCode: inv2.body!.data.inviteCode },
    });
    expect(memberAccept.status).toBe(200);

    const memberToggle = await api(`/api/homes/${homeId}/devices/${deviceId}/status`, {
      method: "POST",
      token: member.accessToken,
      body: { status: "on" },
    });
    expect(memberToggle.status).toBe(200);
    expect(memberToggle.body!.data.status).toBe("on");

    // Owner member list me dono hain
    const members = await api(`/api/homes/${homeId}/members`, { token: owner.accessToken });
    expect(members.body!.data).toHaveLength(3);
  });

  // ---------- shop ----------

  it("shop: order create reserves a serial, cancel releases it", async () => {
    // Product direct DB se (admin upload flow integration test me nahi)
    const product = await prisma.product.create({
      data: {
        name: "4CH WiFi Relay",
        modelCode: "4CH",
        relayCount: 4,
        price: "799.00",
      },
    });
    const serial = await prisma.serialRegistry.create({
      data: { serialCode: "RS-4CH-ABCDEF", productId: product.id },
    });

    const u = await signup("shop1", "shop1@test.local");
    const order = await api("/api/shop/orders", {
      method: "POST",
      token: u.accessToken,
      body: {
        items: [{ productId: product.id, quantity: 1 }],
        shipping: { name: "Test User", phone: "9876543210", address: "Test Address" },
        paymentMethod: "cod",
      },
    });
    expect(order.status).toBe(201);
    expect(order.body!.data.orderNumber).toMatch(/^RS[A-Z0-9]+$/);

    // Serial reserve ho gaya (available → reserved)
    const afterOrder = await prisma.serialRegistry.findUnique({ where: { id: serial.id } });
    expect(afterOrder!.status).toBe("reserved");
    expect(afterOrder!.orderId).toBe(order.body!.data.id);

    // Cancel → serial wapas available
    const cancel = await api(`/api/shop/orders/${order.body!.data.id}/cancel`, {
      method: "POST",
      token: u.accessToken,
    });
    expect(cancel.status).toBe(200);
    const afterCancel = await prisma.serialRegistry.findUnique({ where: { id: serial.id } });
    expect(afterCancel!.status).toBe("available");
    expect(afterCancel!.orderId).toBeNull();
  });
});
