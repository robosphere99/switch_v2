import { describe, expect, it } from "vitest";
import { parseIntent } from "./assistant.service";

const devices = [
  { id: 1, name: "PANKHA", type: "fan" },
  { id: 2, name: "Living Room Light", type: "bulb" },
  { id: 3, name: "TV", type: "tv" },
  { id: 4, name: "Bedroom AC", type: "ac" },
];

describe("parseIntent", () => {
  it("matches by exact device name (case-insensitive)", () => {
    const r = parseIntent("pankha chalu karo", "pankha chalu karo", devices);
    expect(r.action).toBe("on");
    expect(r.actions).toEqual([{ deviceId: 1, deviceName: "PANKHA", action: "on" }]);
    // "pankh" fan-type keyword bhi match karta hai — type precedence
    expect(r.matchedBy).toBe("type:fan");
  });

  it("matches by type keyword — 'saare lights' = lights, not everything", () => {
    const r = parseIntent("saare lights band karo", "saare lights band karo", devices);
    expect(r.action).toBe("off");
    expect(r.actions.map((a) => a.deviceId)).toEqual([2]);
    expect(r.matchedBy).toBe("type:bulb,light");
  });

  it("all devices request", () => {
    const r = parseIntent("sab kuch band karo", "sab kuch band karo", devices);
    expect(r.action).toBe("off");
    expect(r.actions).toHaveLength(devices.length);
    expect(r.matchedBy).toBe("all");
  });

  it("English patterns work", () => {
    const r = parseIntent("turn on the TV", "turn on the TV", devices);
    expect(r.action).toBe("on");
    expect(r.actions.map((a) => a.deviceId)).toEqual([3]);
  });

  it("ambiguous on+off → action null, no actions", () => {
    const r = parseIntent("fan on off karo", "fan on off karo", devices);
    expect(r.action).toBeNull();
    expect(r.actions).toHaveLength(0);
  });

  it("no action word → null", () => {
    const r = parseIntent("aaj mausam kaisa hai", "aaj mausam kaisa hai", devices);
    expect(r.action).toBeNull();
    expect(r.actions).toHaveLength(0);
  });

  it("device name na ho to empty actions", () => {
    const r = parseIntent("geyser chalu karo", "geyser chalu karo", devices);
    expect(r.action).toBe("on");
    expect(r.actions).toHaveLength(0);
    expect(r.matchedBy).toBe("none");
  });

  it("mixed: name + type dono match (dedup)", () => {
    // "PANKHA" name match + fan type match — same device, ek baar
    const r = parseIntent("pankha aur saare fans chalu karo", "pankha aur saare fans chalu karo", devices);
    expect(r.action).toBe("on");
    expect(r.actions).toHaveLength(1);
  });
});
