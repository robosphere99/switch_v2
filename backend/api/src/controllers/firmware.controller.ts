import { Request, Response } from "express";
import { prisma } from "../lib/prisma";
import { ok } from "../lib/response";

export const getCurrentFirmware = async (_req: Request, res: Response) => {
  const versions = await prisma.firmwareVersion.findMany({
    where: { isCurrent: true },
    select: { modelCode: true, version: true, releaseNotes: true },
    orderBy: { modelCode: "asc" },
  });
  ok(res, versions);
};
