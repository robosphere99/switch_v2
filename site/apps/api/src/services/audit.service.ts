import { prisma } from "../lib/prisma";

/** Write an audit log entry. Safe to call anywhere; never throws. */
export async function audit(
  actorId: number | null,
  action: string,
  opts: { homeId?: number | null; entity?: string; entityId?: number; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const data: Record<string, unknown> = {
      actorId,
      homeId: opts.homeId ?? null,
      action,
      entity: opts.entity ?? null,
      entityId: opts.entityId ?? null,
    };
    if (opts.meta) data.meta = opts.meta as object;
    await prisma.auditLog.create({ data: data as never });
  } catch (err) {
    console.error("[audit] failed to write audit log:", err);
  }
}
