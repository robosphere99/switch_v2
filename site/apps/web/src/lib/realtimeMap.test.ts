import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import {
  REALTIME_INVALIDATIONS,
  REALTIME_RECONNECT_KEYS,
  invalidationsForEvent,
  removalsForEvent,
  applyInvalidations,
  applyRemovals,
} from "./realtimeMap";

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

  it("support:new → support queries", () => {
    expect(invalidationsForEvent("support:new")).toEqual([["support"]]);
  });

  it("home:access-revoked → homes invalidate + devices/home REMOVE (stale data na dikhe)", () => {
    expect(invalidationsForEvent("home:access-revoked")).toEqual([["homes"]]);
    expect(removalsForEvent("home:access-revoked")).toEqual([["devices"], ["home"]]);
  });

  it("REALTIME_RECONNECT_KEYS — reconnect pe core queries refresh", () => {
    expect(REALTIME_RECONNECT_KEYS.length).toBeGreaterThan(0);
    for (const key of REALTIME_RECONNECT_KEYS) {
      expect(key.length).toBeGreaterThan(0);
    }
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

  it("applyRemovals — access-revoked pe removeQueries call hota hai", () => {
    const removeMock = vi.fn();
    qc.removeQueries = removeMock;
    applyRemovals(qc, "home:access-revoked");
    expect(removeMock).toHaveBeenCalledTimes(2);
    expect(removeMock).toHaveBeenCalledWith({ queryKey: ["devices"] });
    expect(removeMock).toHaveBeenCalledWith({ queryKey: ["home"] });
  });

  it("applyRemovals — unknown event → koi removal nahi", () => {
    const removeMock = vi.fn();
    qc.removeQueries = removeMock;
    applyRemovals(qc, "nope:event");
    expect(removeMock).not.toHaveBeenCalled();
  });
});
