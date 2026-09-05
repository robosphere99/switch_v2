import type { NotificationType } from "@robosphere/shared";

/**
 * Notification list ke pure query helpers — DB ke bina unit-testable.
 * Schedule category regression yahan guard hota hai: purani rows (category=system)
 * ko "Schedule fired" title se schedule filter me dikhao / system filter se hatao.
 */

const SCHEDULE_TITLE_RE = /Schedule fired/i;

/** Category normalize — system me purani schedule rows ko schedule treat karo. */
export function normalizeCategory(category: string, title: string): string {
  if (category === "system" && SCHEDULE_TITLE_RE.test(title ?? "")) return "schedule";
  return category;
}

export interface NotificationListArgs {
  page?: number;
  pageSize?: number;
  category?: string;
  type?: string;
  unread?: boolean;
}

export interface NotificationWhere {
  userId: number;
  category?: string;
  type?: NotificationType;
  readAt?: null;
  OR?: Array<{
    category: string;
    title?: { contains: string };
    NOT?: { title: { contains: string } };
  }>;
}

/** Notification list query ka WHERE clause build karo (schedule-normalization ke saath). */
export function buildNotificationWhere(userId: number, args: NotificationListArgs = {}): NotificationWhere {
  const where: NotificationWhere = { userId };
  if (args.category && args.category !== "all") {
    if (args.category === "schedule") {
      // Normalized rows bhi Schedule filter me dikho: category=schedule ya
      // (category=system + schedule title).
      where.OR = [{ category: "schedule" }, { category: "system", title: { contains: "Schedule fired" } }];
    } else if (args.category === "system") {
      // System filter me normalized schedule rows na dikho.
      where.OR = [{ category: "system", NOT: { title: { contains: "Schedule fired" } } }];
    } else {
      where.category = args.category;
    }
  }
  if (args.type && args.type !== "all") where.type = args.type as NotificationType;
  if (args.unread) where.readAt = null;
  return where;
}
