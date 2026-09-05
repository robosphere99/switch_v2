import { describe, expect, it } from "vitest";
import { buildNotificationWhere, normalizeCategory } from "./notificationQuery";

/**
 * Schedule category regression ke tests.
 * Purani schedule notifications (category fix se pehle) DB me 'system' me hain —
 * read-time normalization + filter logic yahan guard hoti hai taaki wo dobara
 * "System" badge ke saath System filter me na dikhe.
 */

describe("normalizeCategory — schedule regression", () => {
  it("system + 'Schedule fired' title → schedule", () => {
    expect(normalizeCategory("system", "⏰ Schedule fired: Living TV ON")).toBe("schedule");
  });

  it("system + 'Schedule fired' (bina emoji) → schedule", () => {
    expect(normalizeCategory("system", "Schedule fired: Kitchen Fan OFF")).toBe("schedule");
  });

  it("system + schedule title kisi bhi jagah match → schedule", () => {
    expect(normalizeCategory("system", "Note: Schedule fired for TV")).toBe("schedule");
  });

  it("pehle se schedule category → waisi hi", () => {
    expect(normalizeCategory("schedule", "⏰ Schedule fired: Living TV ON")).toBe("schedule");
  });

  it("system + normal title → system (koi change nahi)", () => {
    expect(normalizeCategory("system", "📨 User ne support me reply kiya")).toBe("system");
  });

  it("device/support category + schedule title → normalize nahi (sirf system rows)", () => {
    expect(normalizeCategory("device", "Schedule fired: TV ON")).toBe("device");
    expect(normalizeCategory("support", "Schedule fired: TV ON")).toBe("support");
  });

  it("empty title → unchanged", () => {
    expect(normalizeCategory("system", "")).toBe("system");
  });
});

describe("buildNotificationWhere — schedule filter", () => {
  it("koi filter nahi → sirf userId", () => {
    expect(buildNotificationWhere(7)).toEqual({ userId: 7 });
  });

  it("category 'all' → sirf userId (koi category filter nahi)", () => {
    expect(buildNotificationWhere(7, { category: "all" })).toEqual({ userId: 7 });
  });

  it("category 'schedule' → normalized rows (system + schedule title) bhi included", () => {
    expect(buildNotificationWhere(7, { category: "schedule" })).toEqual({
      userId: 7,
      OR: [
        { category: "schedule" },
        { category: "system", title: { contains: "Schedule fired" } },
      ],
    });
  });

  it("category 'system' → schedule-title wali system rows excluded", () => {
    expect(buildNotificationWhere(7, { category: "system" })).toEqual({
      userId: 7,
      OR: [{ category: "system", NOT: { title: { contains: "Schedule fired" } } }],
    });
  });

  it("category 'device' → direct category filter", () => {
    expect(buildNotificationWhere(7, { category: "device" })).toEqual({ userId: 7, category: "device" });
  });

  it("type filter", () => {
    expect(buildNotificationWhere(7, { type: "warning" })).toEqual({ userId: 7, type: "warning" });
  });

  it("type 'all' → koi type filter nahi", () => {
    expect(buildNotificationWhere(7, { type: "all" })).toEqual({ userId: 7 });
  });

  it("unread → readAt null", () => {
    expect(buildNotificationWhere(7, { unread: true })).toEqual({ userId: 7, readAt: null });
  });

  it("combined: schedule + type + unread ek saath", () => {
    expect(buildNotificationWhere(7, { category: "schedule", type: "error", unread: true })).toEqual({
      userId: 7,
      OR: [
        { category: "schedule" },
        { category: "system", title: { contains: "Schedule fired" } },
      ],
      type: "error",
      readAt: null,
    });
  });
});
