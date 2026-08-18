import { describe, expect, it } from "vitest";
import type { BoardHistoryEvent } from "../api/devices";
import { historyEvent } from "./boardHistory";

function ev(action: string, meta?: Record<string, unknown>): BoardHistoryEvent {
  return { id: 1, action, createdAt: new Date().toISOString(), actor: null, meta: (meta ?? null) as never };
}

describe("historyEvent", () => {
  it("user rename — from → to detail", () => {
    const h = historyEvent(ev("user.esp.rename", { from: "A", to: "B" }));
    expect(h.icon).toBe("✏️");
    expect(h.label).toBe("Naam badla");
    expect(h.detail).toBe("A → B");
  });

  it("admin rename — support label", () => {
    const h = historyEvent(ev("admin.esp.rename", { from: "X", to: "Y" }));
    expect(h.label).toBe("Support ne naam badla");
    expect(h.detail).toBe("X → Y");
  });

  it("key issue — no detail", () => {
    const h = historyEvent(ev("admin.esp.key.issue"));
    expect(h.icon).toBe("🔑");
    expect(h.label).toBe("Naya API key issue hua");
    expect(h.detail).toBeUndefined();
  });

  it("OTA push — version detail", () => {
    const h = historyEvent(ev("admin.ota.push", { version: "1.0.1" }));
    expect(h.label).toBe("Firmware push (admin)");
    expect(h.detail).toBe("FW v1.0.1");
  });

  it("device claim — serial detail", () => {
    const h = historyEvent(ev("shop.device.claim", { serialCode: "RS-4CH-TJC8BD" }));
    expect(h.label).toBe("Device claim hua");
    expect(h.detail).toBe("Serial RS-4CH-TJC8BD");
  });

  it("unknown action — dotted fallback", () => {
    const h = historyEvent(ev("foo.bar.baz"));
    expect(h.label).toBe("foo bar baz");
  });

  it("rename without meta — no detail crash", () => {
    const h = historyEvent(ev("user.esp.rename"));
    expect(h.label).toBe("Naam badla");
    expect(h.detail).toBeUndefined();
  });
});
