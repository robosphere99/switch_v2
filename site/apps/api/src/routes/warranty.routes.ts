import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";

export const warrantyRouter = Router();

warrantyRouter.use(requireAuth);

/** Serial + warranty status (claim karne se pehle check). */
warrantyRouter.get("/status", async (req, res) => {
  const code = String(req.query.serial ?? "").trim().toUpperCase();
  if (!code) throw new AppError("BAD_REQUEST", "serial query required");
  const serial = await prisma.serialRegistry.findUnique({
    where: { serialCode: code },
    include: { product: { select: { name: true, modelCode: true } } },
  });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  if (serial.userId !== req.user!.sub) {
    throw new AppError("FORBIDDEN", "Ye device aapke account me nahi hai");
  }
  ok(res, {
    serialCode: serial.serialCode,
    productName: serial.product.name,
    modelCode: serial.product.modelCode,
    warrantyStatus: serial.warrantyStatus,
    warrantyExpiresAt: serial.warrantyExpiresAt,
    claimedAt: serial.claimedAt,
  });
});

/** Warranty claim file karo. */
warrantyRouter.post("/", async (req, res) => {
  const serialCode = String(req.body?.serialCode ?? "").trim().toUpperCase();
  const reason = String(req.body?.reason ?? "").trim();
  const description = String(req.body?.description ?? "").trim() || undefined;

  if (!serialCode) throw new AppError("BAD_REQUEST", "Serial code is required");
  if (!reason) throw new AppError("BAD_REQUEST", "Reason is required");
  if (reason.length > 255) throw new AppError("BAD_REQUEST", "Reason 255 chars se kam rakho");

  const serial = await prisma.serialRegistry.findUnique({ where: { serialCode } });
  if (!serial) throw new AppError("NOT_FOUND", "Serial not found");
  if (serial.status !== "claimed") {
    throw new AppError("CONFLICT", "Device pehle activate nahi hua — serial claim karo");
  }
  if (serial.userId !== req.user!.sub) {
    throw new AppError("FORBIDDEN", "Ye device aapke account me nahi hai");
  }
  if (serial.warrantyStatus === "claimed") {
    throw new AppError("CONFLICT", "Is device ki ek claim pehle se active hai");
  }
  if (serial.warrantyExpiresAt && serial.warrantyExpiresAt < new Date()) {
    throw new AppError("CONFLICT", "Warranty expire ho chuki hai (serial ke claim ke 1 saal baad)");
  }

  // Duplicate open claim check
  const openClaim = await prisma.warrantyClaim.findFirst({
    where: { serialCode, status: { in: ["submitted", "approved"] } },
  });
  if (openClaim) throw new AppError("CONFLICT", "Ek claim already submitted hai");

  const claim = await prisma.$transaction(async (tx) => {
    const created = await tx.warrantyClaim.create({
      data: { serialCode, userId: req.user!.sub, reason, description },
    });
    await tx.serialRegistry.update({
      where: { id: serial.id },
      data: { warrantyStatus: "claimed" },
    });
    return created;
  });

  ok(res, {
    id: claim.id,
    serialCode,
    reason,
    description,
    status: claim.status,
    createdAt: claim.createdAt,
  }, 201);
});

/** Meri saari claims + devices (warranty page ke liye). */
warrantyRouter.get("/mine", async (req, res) => {
  const [claims, serials] = await Promise.all([
    prisma.warrantyClaim.findMany({
      where: { userId: req.user!.sub },
      include: { user: { select: { username: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.serialRegistry.findMany({
      where: { userId: req.user!.sub },
      include: { product: { select: { name: true, modelCode: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  ok(res, { claims, serials });
});
