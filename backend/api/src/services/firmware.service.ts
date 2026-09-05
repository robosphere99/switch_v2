import { prisma } from "../lib/prisma";

/**
 * Board ke model ke liye current firmware dhoondo:
 *  - model-specific current pehle (e.g. 4CH ke liye firmware-4ch.bin)
 *  - agar nahi to universal (modelCode = "") current
 * Returns null agar koi current firmware nahi hai.
 */
export async function resolveFirmware(modelCode?: string | null) {
  const model = (modelCode ?? "").trim().toUpperCase();
  return prisma.firmwareVersion.findFirst({
    where: {
      isCurrent: true,
      OR: model ? [{ modelCode: model }, { modelCode: "" }] : [{ modelCode: "" }],
    },
    orderBy: { modelCode: "desc" }, // "" sabse chhota -> model-specific wins
  });
}

export const MODEL_CODES = ["2CH", "4CH", "5CH", "6CH", "8CH", "4CH-IR", "FAN-DIM", "DIM-3S", "DIM-4S"];
