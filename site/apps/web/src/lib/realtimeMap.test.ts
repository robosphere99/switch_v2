import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { REALTIME_INVALIDATIONS, invalidationsForEvent, applyInvalidations } from "./realtimeMap";

describe("realtimeMap — socket events → react-query invalidations", () => {
  it("device:updated → devices + home dono invalidate (state change kahin bhi dikhe)", () => {
    expect(invalidationsForEvent("device:updated")).toEqual([["devices"], ["home"]]);
  });

  it("command:updated → devices (command confirm hone pe device state refresh)", () => {
    expect(invalidationsForEvent("command:updated")).toEqual([["devices"]]);
  });

  it("notification:new → notifications", () => {
    expect(invalidationsForEvent("notification:new")).toEqual([["notifications"]]);
  });

  it("unknown event → empty (koi listener nahi, kuch invalidate nahi)", () => {
    expect(invalidationsForEvent("something:else")).toEqual([]);
  });

  it("har registered event ka map non-empty hai (dead entry nahi)", () => {
    for (const [event, keys] of Object.entries(REALTIME_INVALIDATIONS)) {
      expect(keys.length, `event ${event} has empty invalidation list`).toBeGreaterThan(0);
    }
  });
});

describe("applyInvalidations — QueryClient integration", () => {
  let qc: { invalidateQueries: ReturnType<typeof vi.fn> } & QueryClient;

  beforeEach(() => {
    qc = { invalidateQueries: vi.fn() } as unknown as typeof qc;
  });

  it("event ke saare keys invalidate karta hai", () => {
    applyInvalidations(qc, "device:updated");
    expect(qc.invalidateQueries).toHaveBeenCalledTimes(2);
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["devices"] });
    expect(qc.invalidateQueries).toHaveBeenCalledWith({ queryKey: ["home"] });
  });

  it("unknown event → koi invalidation nahi", () => {
    applyInvalidations(qc, "nope:event");
    expect(qc.invalidateQueries).not.toHaveBeenCalled();
  });
});
