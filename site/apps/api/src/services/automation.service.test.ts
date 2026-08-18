import { describe, expect, it } from "vitest";
import { suggestAutomationsFromLogs } from "./automation.service";

function log(deviceId: number, name: string, action: "on" | "off", dateStr: string, hour: number): {
  deviceId: number;
  deviceName: string;
  logMessage: string;
  createdAt: Date;
} {
  return {
    deviceId,
    deviceName: name,
    logMessage: `Device turned ${action}`,
    createdAt: new Date(`${dateStr}T${String(hour).padStart(2, "0")}:15:00`),
  };
}

describe("suggestAutomationsFromLogs", () => {
  it("daily 7am ON pattern → suggestion with confidence 1.0", () => {
    const logs = [
      log(1, "Bulb", "on", "2026-08-10", 7),
      log(1, "Bulb", "on", "2026-08-11", 7),
      log(1, "Bulb", "on", "2026-08-12", 7),
      log(1, "Bulb", "off", "2026-08-10", 21),
    ];
    const res = suggestAutomationsFromLogs(logs);
    expect(res).toHaveLength(1); // off pattern 1/3 din < 0.5
    expect(res[0]).toMatchObject({
      deviceId: 1,
      deviceName: "Bulb",
      type: "daily",
      time: "07:00",
      action: "on",
      confidence: 1,
      days: 3,
    });
    expect(res[0].reason).toContain("07:00");
  });

  it("partial pattern (2/4 din) → confidence 0.5, threshold pe milta hai", () => {
    const logs = [
      log(1, "Fan", "on", "2026-08-10", 8),
      log(1, "Fan", "on", "2026-08-11", 8),
      log(1, "Fan", "on", "2026-08-12", 19),
      log(1, "Fan", "on", "2026-08-13", 20),
    ];
    const res = suggestAutomationsFromLogs(logs);
    const eight = res.find((r) => r.time === "08:00" && r.action === "on");
    expect(eight?.confidence).toBe(0.5);
    expect(eight?.days).toBe(2);
  });

  it("kam din (minDays) — 1 din ka data → koi suggestion nahi", () => {
    const logs = [log(1, "TV", "on", "2026-08-10", 7)];
    expect(suggestAutomationsFromLogs(logs)).toHaveLength(0);
  });

  it("alag-alag devices ke alag suggestions, confidence se sorted", () => {
    const logs = [
      log(1, "Bulb", "on", "2026-08-10", 7),
      log(1, "Bulb", "on", "2026-08-11", 7),
      log(1, "Bulb", "on", "2026-08-12", 7),
      log(2, "Fan", "on", "2026-08-10", 18),
      log(2, "Fan", "on", "2026-08-11", 18),
      log(2, "Fan", "on", "2026-08-12", 20), // 2/3 at 18:00
    ];
    const res = suggestAutomationsFromLogs(logs);
    expect(res[0].deviceId).toBe(1); // confidence 1.0 pehle
    expect(res[0].confidence).toBeGreaterThanOrEqual(res[1].confidence);
    expect(res.map((r) => r.deviceId)).toEqual([1, 2]);
  });

  it("empty logs → no suggestions", () => {
    expect(suggestAutomationsFromLogs([])).toHaveLength(0);
  });

  it("max 10 suggestions", () => {
    const logs: ReturnType<typeof log>[] = [];
    for (let d = 0; d < 5; d++) {
      for (let dev = 1; dev <= 5; dev++) {
        logs.push(log(dev, `Dev${dev}`, "on", `2026-08-1${d}`, 7));
        logs.push(log(dev, `Dev${dev}`, "off", `2026-08-1${d}`, 21));
      }
    }
    const res = suggestAutomationsFromLogs(logs);
    expect(res.length).toBeLessThanOrEqual(10);
  });
});
