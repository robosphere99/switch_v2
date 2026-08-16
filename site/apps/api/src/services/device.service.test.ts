import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../lib/response";

// ---- mocks (module-level, hoisted) ----
const prismaMock = vi.hoisted(() => ({
  // truthy object — restricted checks chalein; findMany per-test assign hota hai
  deviceAccess: {} as { findMany?: ReturnType<typeof vi.fn> },
  homeMember: { findUnique: vi.fn() },
  device: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
  room: { findFirst: vi.fn() },
  deviceCommand: { create: vi.fn() },
  deviceLog: { create: vi.fn() },
  $transaction: vi.fn(async (ops: Promise<unknown>[]) => {
    for (const op of ops) await op;
  }),
}));

vi.mock("../lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("../lib/socket", () => ({ emitToHome: vi.fn() }));
vi.mock("./audit.service", () => ({ audit: vi.fn() }));
vi.mock("./notification.service", () => ({ createNotification: vi.fn() }));
vi.mock("./firmware.service", () => ({ resolveFirmware: vi.fn() }));

import { bulkSetStatus } from "./device.service";
import { emitToHome } from "../lib/socket";

const prisma = prismaMock;
const emitMock = vi.mocked(emitToHome);

const d1 = { id: 1, homeId: 10, name: "Living TV", status: "off" as const };
const d2 = { id: 2, homeId: 10, name: "Kitchen Fan", status: "off" as const };

describe("bulkSetStatus — home scoping + restricted member permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: normal member (restricted false) — saare devices allowed
    prisma.homeMember.findUnique.mockResolvedValue({ restricted: false });
    prisma.device.findMany.mockResolvedValue([d1, d2]);
  });

  it("normal member → saare home devices status change, commands + logs likhe, events emit", async () => {
    prisma.device.findMany
      .mockResolvedValueOnce([d1, d2]) // fetch
      .mockResolvedValueOnce([{ ...d1, status: "on" }, { ...d2, status: "on" }]); // updated

    const result = await bulkSetStatus({
      homeId: 10,
      actorId: 5,
      deviceIds: [1, 2],
      status: "on",
    });

    // Home scoping: findMany me homeId filter zaroori hai (dusre home ke devices nahi)
    expect(prisma.device.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [1, 2] }, homeId: 10 } }),
    );
    expect(prisma.device.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1, 2] } },
      data: { status: "on" },
    });
    expect(prisma.deviceCommand.create).toHaveBeenCalledTimes(2);
    expect(prisma.deviceLog.create).toHaveBeenCalledTimes(2);
    expect(emitMock).toHaveBeenCalledTimes(2);
    expect(emitMock).toHaveBeenCalledWith(10, "device:updated", expect.objectContaining({ id: 1 }));
    expect(result).toHaveLength(2);
  });

  it("duplicate deviceIds → dedupe (ek baar hi process)", async () => {
    prisma.device.findMany
      .mockResolvedValueOnce([d1])
      .mockResolvedValueOnce([{ ...d1, status: "off" }]);

    await bulkSetStatus({ homeId: 10, actorId: 5, deviceIds: [1, 1, 1], status: "off" });

    expect(prisma.device.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [1] }, homeId: 10 } }),
    );
    expect(prisma.device.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
      data: { status: "off" },
    });
  });

  it("restricted member (child) → sirf granted devices control, baaki silently skip", async () => {
    prisma.homeMember.findUnique.mockResolvedValue({ restricted: true });
    // Sirf device 1 granted
    const deviceAccessFindMany = vi
      .fn()
      .mockResolvedValue([{ deviceId: 1 }]);
    prisma.deviceAccess.findMany = deviceAccessFindMany;
    prisma.device.findMany
      .mockResolvedValueOnce([d1, d2])
      .mockResolvedValueOnce([{ ...d1, status: "on" }]);

    const result = await bulkSetStatus({
      homeId: 10,
      actorId: 5,
      deviceIds: [1, 2],
      status: "on",
    });

    expect(deviceAccessFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 5, deviceId: { in: [1, 2] } } }),
    );
    // Sirf granted device (1) update hua — 2 ko touch nahi
    expect(prisma.device.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1] } },
      data: { status: "on" },
    });
    expect(prisma.deviceCommand.create).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(1);
    expect(result?.[0].id).toBe(1);
  });

  it("restricted member, koi bhi granted nahi → FORBIDDEN (403)", async () => {
    prisma.homeMember.findUnique.mockResolvedValue({ restricted: true });
    prisma.deviceAccess.findMany = vi.fn().mockResolvedValue([]);

    await expect(
      bulkSetStatus({ homeId: 10, actorId: 5, deviceIds: [1, 2], status: "on" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN", status: 403 });

    expect(prisma.device.updateMany).not.toHaveBeenCalled();
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("koi device is home me nahi mila → DEVICE_NOT_FOUND (404)", async () => {
    prisma.device.findMany.mockResolvedValue([]);

    await expect(
      bulkSetStatus({ homeId: 10, actorId: 5, deviceIds: [99], status: "on" }),
    ).rejects.toMatchObject({ code: "DEVICE_NOT_FOUND", status: 404 });
  });

  it("AppError class se throw hota hai (error handler usi ko JSON banata hai)", async () => {
    prisma.device.findMany.mockResolvedValue([]);
    try {
      await bulkSetStatus({ homeId: 10, actorId: 5, deviceIds: [99], status: "on" });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
    }
  });
});
