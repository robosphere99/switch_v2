import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { audit } from "../services/audit.service";

export const claimRouter = Router();

// Serial brute-force / guessing se bachao — per IP. Claim ek heavy write
// (serial registry + device + audit), isliye hourly limit tight rakhi hai.
const claimLimiter = rateLimit({
  name: "claim:create",
  windowMs: 60 * 60_000,
  max: 20,
  message: "Bahut zyada claim attempts — 1 ghanta baad try karo",
});
const claimHomesLimiter = rateLimit({
  name: "claim:homes",
  windowMs: 60_000,
  max: 60,
});

claimRouter.use(requireAuth);

const TYPE_BY_MODEL: Record<string, "bulb" | "fan" | "ac" | "tv" | "plug" | "dimmer" | "custom"> = {
  "2CH": "custom",
  "4CH": "custom",
  "5CH": "custom",
  "6CH": "custom",
  "8CH": "custom",
  "4CH-IR": "custom",
  "FAN-DIM": "dimmer",
  "DIM-3S": "dimmer",
  "DIM-4S": "dimmer",
};

/** Look up how many homes the user can claim into (owner or admin). */
async function claimableHomes(userId: number) {
  return prisma.homeMember.findMany({
    where: {
      userId,
      role: { in: ["owner", "admin"] },
      home: { status: "active" },
    },
    include: { home: { select: { id: true, name: true } } },
  });
}

claimRouter.get("/homes", claimHomesLimiter, async (req, res) => {
  const homes = await claimableHomes(req.user!.sub);
  ok(res, homes.map((h) => h.home));
});

/** POST /api/claim  { serialCode, homeId } */
claimRouter.post("/", claimLimiter, async (req, res) => {
  const serialCode = String(req.body?.serialCode ?? "").trim().toUpperCase();
  const homeId = Number(req.body?.homeId);
  if (!serialCode) throw new AppError("BAD_REQUEST", "Serial code is required");
  if (!Number.isInteger(homeId) || homeId < 1) {
    throw new AppError("BAD_REQUEST", "A valid home is required");
  }

  const serial = await prisma.serialRegistry.findUnique({
    where: { serialCode },
    include: { product: true },
  });
  if (!serial) throw new AppError("NOT_FOUND", "Unknown serial code — check the sticker on the box");

  if (serial.status === "claimed") {
    if (serial.userId === req.user!.sub) {
      throw new AppError("CONFLICT", "This device is already activated in your home — check your Devices/Boards");
    }
    throw new AppError("CONFLICT", "This device was already activated by another user");
  }
  if (!["delivered", "shipped"].includes(serial.status)) {
    throw new AppError("CONFLICT", `This device is not yet ready to activate (status: ${serial.status})`);
  }

  // User must be owner/admin of the target home.
  const membership = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId: req.user!.sub } },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) {
    throw new AppError("FORBIDDEN", "You are not the owner or admin of that home");
  }

  const type = TYPE_BY_MODEL[serial.product.modelCode] ?? "custom";
  const deviceName = `${serial.product.name} · ${serial.serialCode}`;

  const device = await prisma.$transaction(async (tx) => {
    await tx.serialRegistry.update({
      where: { id: serial.id },
      data: {
        status: "claimed",
        userId: req.user!.sub,
        homeId,
        claimedAt: new Date(),
        warrantyExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      },
    });

    const espStub = await tx.espDevice.create({
      data: {
        homeId,
        macAddress: `PENDING-${serial.serialCode}`,
        name: deviceName,
        serialCode: serial.serialCode,
        modelCode: serial.product.modelCode,
        offline: true,
      },
    });

    // Sirf hardware board (EspDevice) create karte hain.
    // Logical devices user baad me khud create/map karega app/web se.
    return espStub;
  });

  await audit(req.user!.sub, "shop.device.claim", {
    entity: "esp_device",
    entityId: device.id,
    meta: { serialCode, homeId, model: serial.product.modelCode },
  });

  ok(res, {
    claimed: true,
    device: { id: device.id, name: device.name, type: "custom" },
    serialCode,
    homeId,
  }, 201);
});
