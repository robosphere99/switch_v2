import { describe, expect, it } from "vitest";
import { computeUsageAnalytics, type AnalyticsLog } from "./analytics.service";

const T0 = Date.parse("2026-08-17T00:00:00Z");

function log(
  deviceId: number,
  deviceName: string,
  msg: string,
  minutesAfterT0: number,
  actorId: number | null = 1,
  actorName?: string,
): AnalyticsLog {
  return {
    deviceId,
    deviceName,
    actorId,
    actorName: actorName ?? (actorId === null ? undefined : "demoflow"),
    logMessage: msg,
    createdAt: new Date(T0 + minutesAfterT0 * 60_000),
  };
}

describe("computeUsageAnalytics", () => {
  it("on-time: ON→OFF pairs sum hota hai, currently-ON period count hota hai", () => {
    const res = computeUsageAnalytics(
      [
        log(1, "TV", "Device turned on", 0),
        log(1, "TV", "Device turned off", 60), // 60 min on
        log(1, "TV", "Device turned on", 120),
        // 120 se abhi tak on — `now` = 150 min
      ],
      7,
      T0 + 150 * 60_000,
    );

    expect(res.totals.toggles).toBe(3);
    // 60min pair + (150-120)=30min ongoing = 90min = 5_400_000ms
    expect(res.perDevice[0].onMs).toBe(90 * 60_000);
    expect(res.perDevice[0].toggles).toBe(3);
  });

  it("togglesPerDay: saare days 0 se fill hote hain (chart gaps nahi)", () => {
    const res = computeUsageAnalytics(
      [log(1, "TV", "Device turned on", 30)],
      7,
      T0 + 60 * 60_000,
    );
    expect(res.togglesPerDay).toHaveLength(7);
    expect(res.togglesPerDay.filter((d) => d.count > 0)).toHaveLength(1);
  });

  it("perMember: actor null → 'Auto (schedule/device)' group", () => {
    const res = computeUsageAnalytics(
      [
        log(1, "TV", "Device turned on", 0, null),
        log(1, "TV", "Device turned off", 5, 1),
        log(1, "TV", "Device turned on", 10, 1),
      ],
      7,
      T0 + 60 * 60_000,
    );

    expect(res.perMember).toHaveLength(2);
    const auto = res.perMember.find((m) => m.userId === null);
    expect(auto?.username).toBe("Auto (schedule/device)");
    expect(auto?.toggles).toBe(1);
    const user = res.perMember.find((m) => m.userId === 1);
    expect(user?.toggles).toBe(2);
  });

  it("empty logs → zero-filled analytics", () => {
    const res = computeUsageAnalytics([], 7, T0);
    expect(res.totals.toggles).toBe(0);
    expect(res.totals.onMs).toBe(0);
    expect(res.togglesPerDay).toHaveLength(7);
    expect(res.perDevice).toHaveLength(0);
    expect(res.perMember).toHaveLength(0);
  });
});
