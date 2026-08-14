import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { audit } from "../services/audit.service";
import { generateSerials, updateOrderStatus } from "../services/shop.service";
import { decryptSecret } from "../lib/crypto";
import { resolveFirmware } from "../services/firmware.service";

export const adminRouter = Router();

/** System admins only. */
function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (req.user?.role !== "system_admin") {
    return next(new AppError("FORBIDDEN", "Admin access required", 403));
  }
  next();
}

adminRouter.use(requireAuth, requireAdmin);

// ---------- Stats ----------

adminRouter.get("/stats", async (_req, res) => {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [users, homes, devices, activeToday, onlineDevices, pendingCommands, apiKeys, auditCount] =
    await Promise.all([
      prisma.user.count(),
      prisma.home.count(),
      prisma.device.count(),
      prisma.user.count({ where: { lastLoginAt: { gte: dayAgo } } }),
      prisma.device.count({ where: { lastSeen: { gte: dayAgo } } }),
      prisma.deviceCommand.count({ where: { status: "pending" } }),
      prisma.apiKey.count(),
      prisma.auditLog.count(),
    ]);
  ok(res, { users, homes, devices, activeToday, onlineDevices, pendingCommands, apiKeys, auditCount });
});

// ---------- Users ----------

adminRouter.get("/users", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const users = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { ownedHomes: true, memberships: true } },
    },
    where: q
      ? {
          OR: [
            { username: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, users);
});

adminRouter.patch("/users/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.sub) throw new AppError("BAD_REQUEST", "You cannot suspend your own account");
  const status = String(req.body.status ?? "");
  if (!["active", "suspended"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status must be active or suspended");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { status: status as "active" | "suspended" },
  });
  await audit(req.user!.sub, `admin.user.${status}`, { entity: "user", entityId: id, meta: { username: user.username } });
  ok(res, user);
});

adminRouter.patch("/users/:id/role", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.sub) throw new AppError("BAD_REQUEST", "You cannot change your own role");
  const role = String(req.body.role ?? "");
  if (!["user", "system_admin"].includes(role)) {
    throw new AppError("BAD_REQUEST", "Role must be user or system_admin");
  }
  const user = await prisma.user.update({
    where: { id },
    data: { role: role as "user" | "system_admin" },
  });
  await audit(req.user!.sub, `admin.user.role`, { entity: "user", entityId: id, meta: { username: user.username, role } });
  ok(res, user);
});

adminRouter.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user!.sub) throw new AppError("BAD_REQUEST", "You cannot delete your own account");
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw new AppError("NOT_FOUND", "User not found");
  await audit(req.user!.sub, "admin.user.delete", { entity: "user", entityId: id, meta: { username: user.username, email: user.email } });
  await prisma.user.delete({ where: { id } });
  ok(res, { deleted: true });
});

// ---------- Homes ----------

adminRouter.get("/homes", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const homes = await prisma.home.findMany({
    include: {
      owner: { select: { id: true, username: true, email: true } },
      _count: { select: { devices: true, members: true, rooms: true } },
    },
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, homes);
});

adminRouter.get("/homes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const home = await prisma.home.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true, email: true } },
      members: { include: { user: { select: { id: true, username: true, email: true } } } },
      devices: { orderBy: { id: "asc" } },
      rooms: true,
      _count: { select: { devices: true, members: true, invitations: true } },
    },
  });
  if (!home) throw new AppError("NOT_FOUND", "Home not found");
  ok(res, home);
});

adminRouter.patch("/homes/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status ?? "");
  if (!["active", "suspended"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status must be active or suspended");
  }
  const home = await prisma.home.update({
    where: { id },
    data: { status: status as "active" | "suspended" },
  });
  await audit(req.user!.sub, `admin.home.${status}`, { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  ok(res, home);
});

adminRouter.delete("/homes/:id", async (req, res) => {
  const id = Number(req.params.id);
  const home = await prisma.home.findUnique({ where: { id } });
  if (!home) throw new AppError("NOT_FOUND", "Home not found");
  await audit(req.user!.sub, "admin.home.delete", { homeId: id, entity: "home", entityId: id, meta: { name: home.name } });
  await prisma.home.delete({ where: { id } });
  ok(res, { deleted: true });
});

// ---------- Devices ----------

adminRouter.get("/devices", async (req, res) => {
  const q = String(req.query.q ?? "").trim();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const devices = await prisma.device.findMany({
    include: {
      home: { select: { id: true, name: true, owner: { select: { username: true } } } },
      room: { select: { name: true } },
      _count: { select: { commands: true, logs: true } },
    },
    where: q ? { name: { contains: q } } : undefined,
    orderBy: { id: "desc" },
    take: 200,
  });
  ok(
    res,
    devices.map((d) => ({
      ...d,
      online: d.lastSeen !== null && d.lastSeen.getTime() > dayAgo.getTime(),
    })),
  );
});

// ---------- API keys ----------

adminRouter.get("/api-keys", async (_req, res) => {
  const keys = await prisma.apiKey.findMany({
    include: {
      user: { select: { id: true, username: true, email: true } },
      home: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, keys);
});

adminRouter.delete("/api-keys/:id", async (req, res) => {
  const id = Number(req.params.id);
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key) throw new AppError("NOT_FOUND", "API key not found");
  await audit(req.user!.sub, "admin.apikey.revoke", { homeId: key.homeId, entity: "api_key", entityId: id, meta: { prefix: key.keyPrefix } });
  await prisma.apiKey.delete({ where: { id } });
  ok(res, { deleted: true });
});

// ---------- Audit log ----------

adminRouter.get("/audit", async (req, res) => {
  const action = String(req.query.action ?? "");
  const where = action ? { action } : undefined;
  const logs = await prisma.auditLog.findMany({
    where,
    include: { actor: { select: { id: true, username: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, logs);
});

// ============================================================
// ESP / OTA — connected ESPs (IPs, firmware) + firmware publish + push
// ============================================================

// Published firmware lives in <repo>/hardware/firmware, served at /firmware.
const firmwareDir = path.resolve(process.cwd(), "../../../hardware/firmware");
fs.mkdirSync(firmwareDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, firmwareDir),
    filename: (_req, _file, cb) => cb(null, "firmware.bin"),
  }),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB is plenty for ESP32 .bin
});

/** ESP boards — ek row per PHYSICAL board (MAC se), under me controlled devices. */
adminRouter.get("/esp", async (_req, res) => {
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  const esps = await prisma.espDevice.findMany({
    select: {
      id: true,
      homeId: true,
      macAddress: true,
      name: true,
      ssid: true,
      serialCode: true,
      modelCode: true,
      ipAddress: true,
      firmwareVersion: true,
      lastSeen: true,
      offline: true,
      otaPendingVersion: true,
      otaRequestedAt: true,
      otaProgress: true,
      otaStatus: true,
      home: { select: { id: true, name: true, owner: { select: { username: true } } } },
      devices: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
          room: { select: { name: true } },
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { lastSeen: "desc" },
    take: 100,
  });
  // Devices jinhe abhi tak koi ESP report nahi kiya (legacy) — admin view se gayab na hon.
  const unlinked = await prisma.device.findMany({
    where: { espId: null },
    select: {
      id: true,
      homeId: true,
      name: true,
      type: true,
      status: true,
      firmwareVersion: true,
      ipAddress: true,
      lastSeen: true,
      offline: true,
      serialNumber: true,
      home: { select: { name: true } },
    },
    orderBy: { id: "asc" },
    take: 100,
  });
  ok(res, { esps, unlinked, currentVersion: current?.version ?? null });
});

/** Rename an ESP board (admin friendly name). */
adminRouter.patch("/esp/:id", async (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body?.name ?? "").trim().slice(0, 60);
  if (!name) throw new AppError("BAD_REQUEST", "Name required");
  const esp = await prisma.espDevice.update({ where: { id }, data: { name } });
  await audit(req.user!.sub, "admin.esp.rename", {
    entity: "esp",
    entityId: id,
    meta: { name },
  });
  ok(res, esp);
});

/** Firmware version history. */
adminRouter.get("/firmware", async (_req, res) => {
  const versions = await prisma.firmwareVersion.findMany({ orderBy: { createdAt: "desc" } });
  const current = versions.find((v) => v.isCurrent) ?? null;
  ok(res, { versions, current });
});

/** Upload a new firmware .bin + version + release notes -> publish as current.
 * model = "2CH" | "4CH" | "8CH" | "DIM-3S" | "DIM-4S" | "" (universal). */
adminRouter.post("/firmware", upload.single("firmware"), async (req, res) => {
  const version = String(req.body.version ?? "").trim();
  const releaseNotes = String(req.body.release_notes ?? "").trim();
  const modelCode = String(req.body.model ?? "").trim().toUpperCase();

  if (!version) throw new AppError("BAD_REQUEST", "Version is required (e.g. 1.0.1)");
  if (!req.file) throw new AppError("BAD_REQUEST", "Firmware .bin file is required");
  if (!req.file.originalname.toLowerCase().endsWith(".bin")) {
    throw new AppError("BAD_REQUEST", "Only .bin files are accepted");
  }
  if (!/^[A-Z0-9-]*$/.test(modelCode)) {
    throw new AppError("BAD_REQUEST", "Model code me sirf A-Z 0-9 - allowed");
  }

  const filename = modelCode ? `firmware-${modelCode.toLowerCase()}.bin` : "firmware.bin";
  const url = `/firmware/${filename}`;

  // multer filename fixed "firmware.bin" rakhta hai — model ho to rename karo
  if (modelCode && filename !== "firmware.bin") {
    const uploaded = path.join(firmwareDir, "firmware.bin");
    const target = path.join(firmwareDir, filename);
    if (fs.existsSync(uploaded) && uploaded !== target) {
      if (fs.existsSync(target)) fs.unlinkSync(target);
      fs.renameSync(uploaded, target);
    }
  }

  await prisma.$transaction([
    // Sirf isi model ke puraane current deactivate karo — doosre models ke current untouched
    prisma.firmwareVersion.updateMany({ where: { modelCode, isCurrent: true }, data: { isCurrent: false } }),
    prisma.firmwareVersion.upsert({
      where: { version_modelCode: { version, modelCode } },
      create: { version, modelCode, url, releaseNotes, isCurrent: true },
      update: { releaseNotes, isCurrent: true, url },
    }),
  ]);

  await audit(req.user!.sub, "admin.firmware.upload", {
    entity: "firmware",
    meta: { version, modelCode: modelCode || "universal", releaseNotes },
  });
  ok(res, { version, modelCode, releaseNotes, published: true, url });
});

/** Mark an existing firmware version as the current one (per model). */
adminRouter.post("/firmware/:id/activate", async (req, res) => {
  const id = Number(req.params.id);
  const fw = await prisma.firmwareVersion.findUnique({ where: { id } });
  if (!fw) throw new AppError("NOT_FOUND", "Firmware version not found", 404);

  await prisma.$transaction([
    prisma.firmwareVersion.updateMany({ where: { modelCode: fw.modelCode }, data: { isCurrent: false } }),
    prisma.firmwareVersion.update({ where: { id }, data: { isCurrent: true } }),
  ]);
  await audit(req.user!.sub, "admin.firmware.activate", {
    entity: "firmware",
    entityId: id,
    meta: { version: fw.version },
  });
  ok(res, { id, version: fw.version, isCurrent: true });
});

/** Push the current firmware to ONE device (updates on its next heartbeat).
 * Firmware resolution board ke model se hota hai (model-specific > universal). */
adminRouter.post("/devices/:id/push-ota", async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device) throw new AppError("NOT_FOUND", "Device not found", 404);

  const esp = device.espId
    ? await prisma.espDevice.findUnique({ where: { id: device.espId } })
    : null;
  const current = await resolveFirmware(esp?.modelCode);
  if (!current) {
    throw new AppError("NO_FIRMWARE", "No current firmware published yet — upload a .bin first", 400);
  }

  await prisma.device.update({
    where: { id },
    data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
  });
  let espId: number | null = null;
  if (device.espId) {
    espId = device.espId;
    await prisma.espDevice.update({
      where: { id: espId },
      data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
    });
  }
  await audit(req.user!.sub, "admin.ota.push", {
    homeId: device.homeId,
    entity: "device",
    entityId: id,
    meta: { version: current.version, model: esp?.modelCode ?? null },
  });
  ok(res, {
    deviceId: id,
    espId,
    version: current.version,
    model: current.modelCode || "universal",
    message: "OTA update pushed — the device will update on its next heartbeat",
  });
});

/** Push the current firmware to ALL devices (or one home with homeId). */
adminRouter.post("/devices/push-ota-all", async (req, res) => {
  const current = await prisma.firmwareVersion.findFirst({ where: { isCurrent: true } });
  if (!current) {
    throw new AppError("NO_FIRMWARE", "No current firmware published yet — upload a .bin first", 400);
  }
  const rawHome = Number(req.body.homeId ?? 0);
  const homeId = rawHome > 0 ? rawHome : undefined;

  const espResult = await prisma.espDevice.updateMany({
    where: homeId ? { homeId } : {},
    data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
  });
  // Bina ESP ke devices (legacy) — device-level pending set karo.
  const deviceResult = await prisma.device.updateMany({
    where: { ...(homeId ? { homeId } : {}), espId: null },
    data: { otaPendingVersion: current.version, otaRequestedAt: new Date() },
  });
  const count = espResult.count + deviceResult.count;
  await audit(req.user!.sub, "admin.ota.push_all", {
    homeId,
    entity: "device",
    meta: { version: current.version, count },
  });
  ok(res, { count, version: current.version });
});

/** Quick reachability probe of an ESP board's web panel (HTTP GET with timeout). */
adminRouter.get("/esp/:id/probe", async (req, res) => {
  const id = Number(req.params.id);
  const esp = await prisma.espDevice.findUnique({ where: { id } });
  if (!esp) throw new AppError("NOT_FOUND", "ESP not found", 404);

  const ip = esp.ipAddress?.trim();
  if (!ip) {
    return ok(res, { reachable: false, reason: "no_ip" });
  }
  // Basic IP shape guard (IPv4 / IPv6 literal) — never probe arbitrary URLs.
  if (!/^[\d.a-fA-F:]+$/.test(ip)) {
    return ok(res, { reachable: false, reason: "invalid_ip" });
  }

  const url = `http://${ip}/`;
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const r = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": "RoboSphere-Admin/1.0" },
    });
    return ok(res, { reachable: true, latencyMs: Date.now() - started, statusCode: r.status });
  } catch {
    return ok(res, { reachable: false, reason: "unreachable", latencyMs: Date.now() - started });
  } finally {
    clearTimeout(timer);
  }
});

// ---------- Shop: Products ----------

adminRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { id: "asc" },
    include: { _count: { select: { serials: true } } },
  });
  ok(res, products);
});

adminRouter.post("/products", async (req, res) => {
  const { name, modelCode, relayCount, price, description, features, imageUrl } = req.body ?? {};
  if (!name || !modelCode || price == null) {
    throw new AppError("BAD_REQUEST", "name, modelCode and price are required");
  }
  const product = await prisma.product.create({
    data: {
      name: String(name).slice(0, 100),
      modelCode: String(modelCode).trim().toUpperCase().slice(0, 32),
      relayCount: Number(relayCount) || 0,
      price: Number(price),
      description: description ? String(description) : undefined,
      features: features ? (typeof features === "string" ? JSON.parse(features) : features) : undefined,
      imageUrl: imageUrl ? String(imageUrl).slice(0, 255) : undefined,
    },
  });
  await audit(req.user!.sub, "admin.product.create", { entity: "product", entityId: product.id, meta: { modelCode } });
  ok(res, product, 201);
});

adminRouter.patch("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { name, price, description, features, imageUrl, active } = req.body ?? {};
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: name != null ? String(name).slice(0, 100) : undefined,
      price: price != null ? Number(price) : undefined,
      description: description != null ? String(description) : undefined,
      features: features ? (typeof features === "string" ? JSON.parse(features) : features) : undefined,
      imageUrl: imageUrl != null ? String(imageUrl).slice(0, 255) : undefined,
      active: active != null ? Boolean(active) : undefined,
    },
  });
  await audit(req.user!.sub, "admin.product.update", { entity: "product", entityId: id });
  ok(res, product);
});

adminRouter.delete("/products/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.product.delete({ where: { id } });
  await audit(req.user!.sub, "admin.product.delete", { entity: "product", entityId: id });
  ok(res, { deleted: true });
});

// ---------- Shop: Orders ----------

adminRouter.get("/orders", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const orders = await prisma.order.findMany({
    where: status ? { status: status as never } : undefined,
    include: {
      items: true,
      user: { select: { id: true, username: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  ok(res, orders);
});

adminRouter.patch("/orders/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  const order = await updateOrderStatus(id, status);
  await audit(req.user!.sub, `admin.order.${status}`, {
    entity: "order",
    entityId: id,
    meta: { orderNumber: order.orderNumber },
  });
  ok(res, order);
});

// ---------- Shop: Serial Registry ----------

adminRouter.get("/serials", async (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const productId = req.query.productId ? Number(req.query.productId) : undefined;
  const serials = await prisma.serialRegistry.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(productId ? { productId } : {}),
    },
    include: { product: { select: { id: true, name: true, modelCode: true } } },
    orderBy: { id: "desc" },
    take: 500,
  });
  ok(res, serials);
});

adminRouter.post("/serials/generate", async (req, res) => {
  const productId = Number(req.body?.productId);
  const count = Number(req.body?.count ?? 10);
  const codes = await generateSerials(productId, count);
  await audit(req.user!.sub, "admin.serial.generate", {
    entity: "product",
    entityId: productId,
    meta: { count, codes: codes.slice(0, 5) },
  });
  ok(res, { generated: codes.length, codes }, 201);
});

// ---------- Manufacturing: Order Provision + Serial Test ----------

/** Flasher GUI ke liye: order ki items + serials + WiFi (decrypted) — admin only. */
adminRouter.get("/orders/:id/provision", async (req, res) => {
  const include = {
    items: true,
    user: { select: { id: true, username: true, email: true } },
  };
  const raw = String(req.params.id).trim();
  // Numeric ID ho to direct, warna order NUMBER se (flasher me order number
  // ya uska suffix paste karne par bhi kaam kare).
  let order = /^\d+$/.test(raw)
    ? await prisma.order.findUnique({ where: { id: Number(raw) }, include })
    : null;
  if (!order && raw) {
    const matches = await prisma.order.findMany({
      where: { orderNumber: { contains: raw.toUpperCase() } },
      orderBy: { id: "desc" },
      take: 1,
      include,
    });
    order = matches[0] ?? null;
  }
  if (!order) throw new AppError("NOT_FOUND", "Order not found");

  const items = await Promise.all(
    order.items.map(async (it) => {
      let modelCode = null;
      if (it.serialCode) {
        const reg = await prisma.serialRegistry.findUnique({
          where: { serialCode: it.serialCode },
          include: { product: { select: { modelCode: true } } },
        });
        modelCode = reg?.product.modelCode ?? null;
      }
      return {
        id: it.id,
        productId: it.productId,
        productName: it.productName,
        price: Number(it.price),
        quantity: it.quantity,
        serialCode: it.serialCode,
        modelCode,
      };
    }),
  );

  let wifiPassword = null;
  if (order.wifiPasswordEnc) {
    try {
      wifiPassword = decryptSecret(order.wifiPasswordEnc);
    } catch {
      wifiPassword = null;
    }
  }

  // Buyer ke home ka API key — board ko isi se server se baat karni hai.
  // Har provision pe ek fresh key issue karte hain (label = factory/order).
  const crypto = await import("node:crypto");
  const plain = `rs_${crypto.randomBytes(9).toString("base64url").replace(/-/g, "").slice(0, 16)}`;
  const keyHash = crypto.createHash("sha256").update(plain).digest("hex");
  const keyPrefix = plain.slice(0, 8);
  const home = await prisma.home.findFirst({ where: { ownerId: order.userId } });
  if (home) {
    await prisma.apiKey.create({
      data: {
        userId: order.userId,
        homeId: home.id,
        label: `factory-order-${order.orderNumber}`,
        keyHash,
        keyPrefix,
      },
    });
  }
  const apiKeyPlain = home ? plain : null;

  ok(res, {
    orderId: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    wifiSsid: order.wifiSsid,
    wifiPassword,
    apiKey: apiKeyPlain,
    user: order.user,
    items,
  });
});

/** Flasher: serial ko factory-tested mark karo (relay self-test pass hone ke baad). */
adminRouter.post("/serials/:code/mark-tested", async (req, res) => {
  const code = String(req.params.code).trim().toUpperCase();
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  const updated = await prisma.serialRegistry.update({
    where: { id: serial.id },
    data: { testedAt: new Date() },
  });
  await audit(req.user!.sub, "admin.serial.tested", {
    entity: "serial",
    entityId: serial.id,
    meta: { serialCode: code },
  });
  ok(res, { tested: true, serialCode: code, testedAt: updated.testedAt });
});

// ---------- Warranty (admin) ----------

adminRouter.get("/warranty", async (_req, res) => {
  const claims = await prisma.warrantyClaim.findMany({
    include: { user: { select: { id: true, username: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });
  const codes = [...new Set(claims.map((c) => c.serialCode))];
  const serials = await prisma.serialRegistry.findMany({
    where: { serialCode: { in: codes } },
    select: { serialCode: true, warrantyStatus: true, warrantyExpiresAt: true, product: { select: { name: true, modelCode: true } } },
  });
  ok(res, claims.map((c) => ({ ...c, serial: serials.find((s) => s.serialCode === c.serialCode) ?? null })));
});

/** Claim status update: approved / rejected / resolved. */
adminRouter.patch("/warranty/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["approved", "rejected", "resolved"].includes(status)) {
    throw new AppError("BAD_REQUEST", "Status approved | rejected | resolved hona chahiye");
  }
  const claim = await prisma.warrantyClaim.findUnique({ where: { id } });
  if (!claim) throw new AppError("NOT_FOUND", "Claim not found");
  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode: claim.serialCode } });
  if (claim.status === "resolved") throw new AppError("BAD_REQUEST", "Resolved claim change nahi hoti");

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.warrantyClaim.update({
      where: { id },
      data: { status: status as "approved" | "rejected" | "resolved" },
    });
    if (status === "resolved" || status === "rejected") {
      await tx.serialRegistry.update({
        where: { serialCode: claim.serialCode },
        data: { warrantyStatus: "active" },
      });
    }
    return c;
  });

  await audit(req.user!.sub, `admin.warranty.${status}`, {
    entity: "warranty_claim",
    entityId: id,
    meta: { serialCode: claim.serialCode },
  });
  ok(res, { id: updated.id, status: updated.status });
});

// ---------- Contact / Feedback (public form se) ----------

adminRouter.get("/contact", async (_req, res) => {
  const msgs = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, username: true, email: true, role: true } } },
  });
  ok(res, msgs);
});

adminRouter.patch("/contact/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body?.status ?? "");
  if (!["new", "read", "done"].includes(status)) throw new AppError("BAD_REQUEST", "Status new | read | done");
  const updated = await prisma.contactMessage.update({ where: { id }, data: { status } });
  ok(res, updated);
});

adminRouter.delete("/contact/:id", async (req, res) => {
  const id = Number(req.params.id);
  await prisma.contactMessage.delete({ where: { id } });
  ok(res, { deleted: true });
});
