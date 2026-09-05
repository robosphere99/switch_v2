import { describe, expect, it } from "vitest";
import {
  groupOfflineEvents,
  offlineSummaryText,
  recoverySummaryText,
  type OfflineEventItem,
} from "./offline.service";

describe("offline batching (power-cut summary)", () => {
  it("groupOfflineEvents: home ke hisaab se group karta hai, order preserve", () => {
    const items: OfflineEventItem[] = [
      { homeId: 1, name: "Board A", kind: "board" },
      { homeId: 2, name: "Bulb", kind: "device" },
      { homeId: 1, name: "Fan", kind: "device" },
      { homeId: 1, name: "Board B", kind: "board" },
    ];
    const groups = groupOfflineEvents(items);
    expect(groups.length).toBe(2);
    const home1 = groups.find((g) => g[0]!.homeId === 1)!;
    const home2 = groups.find((g) => g[0]!.homeId === 2)!;
    expect(home1.map((i) => i.name)).toEqual(["Board A", "Fan", "Board B"]);
    expect(home2.map((i) => i.name)).toEqual(["Bulb"]);
  });

  it("offlineSummaryText: 2+ items = power-cut summary with counts", () => {
    const s = offlineSummaryText([
      { homeId: 1, name: "Hall Board", kind: "board" },
      { homeId: 1, name: "Kitchen Board", kind: "board" },
      { homeId: 1, name: "Bedroom Bulb", kind: "device" },
    ]);
    expect(s).not.toBeNull();
    expect(s!.title).toContain("Power cut detected");
    expect(s!.title).toContain("2 boards");
    expect(s!.title).toContain("1 device");
    expect(s!.body).toContain("Hall Board");
  });

  it("offlineSummaryText: single item = null (individual notification)", () => {
    expect(
      offlineSummaryText([{ homeId: 1, name: "Solo Board", kind: "board" }]),
    ).toBeNull();
  });

  it("offlineSummaryText: empty = null", () => {
    expect(offlineSummaryText([])).toBeNull();
  });

  it("recoverySummaryText: 2+ items = power restored summary", () => {
    const s = recoverySummaryText([
      { homeId: 1, name: "A", kind: "board" },
      { homeId: 1, name: "B", kind: "device" },
    ]);
    expect(s).not.toBeNull();
    expect(s!.title).toContain("Power restored");
    expect(s!.title).toContain("1 board + 1 device");
  });

  it("recoverySummaryText: single item = null", () => {
    expect(recoverySummaryText([{ homeId: 1, name: "A", kind: "device" }])).toBeNull();
  });

  it("power cut: same-tick events mixed boards+devices get one summary", () => {
    const events: OfflineEventItem[] = [
      { homeId: 7, name: "Board-1", kind: "board" },
      { homeId: 7, name: "Board-2", kind: "board" },
      { homeId: 7, name: "TV", kind: "device" },
    ];
    const groups = groupOfflineEvents(events);
    expect(groups.length).toBe(1);
    expect(offlineSummaryText(groups[0]!)).not.toBeNull();
  });
});
