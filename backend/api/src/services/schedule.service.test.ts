import { describe, expect, it } from "vitest";
import { computeNextRun, nextCronRun, parseCron } from "./schedule.service";

/**
 * Cron matching local time me hota hai (getHours/getMinutes), isliye tests bhi
 * local-time Date se banao — timezone (UTC/IST) se independent rahen.
 */
function local(y: number, mo: number, d: number, h = 0, mi = 0): Date {
  return new Date(y, mo - 1, d, h, mi, 0, 0);
}

/** Local-time fields se compare (DST-safe). */
function sameLocal(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate() &&
    a.getHours() === b.getHours() &&
    a.getMinutes() === b.getMinutes()
  );
}

const T0 = local(2026, 8, 17, 10, 0); // Monday 10:00

describe("computeNextRun", () => {
  it("once: returns runAt when in the future, null when in the past", () => {
    const future = new Date(T0.getTime() + 60_000);
    expect(computeNextRun({ type: "once", runAt: future, cron: null, from: T0 })?.getTime()).toBe(
      future.getTime(),
    );
    const past = new Date(T0.getTime() - 60_000);
    expect(computeNextRun({ type: "once", runAt: past, cron: null, from: T0 })).toBeNull();
  });

  it("once: null runAt → null nextRun", () => {
    expect(computeNextRun({ type: "once", runAt: null, cron: null, from: T0 })).toBeNull();
  });

  it("daily: rolls forward by 24h until in the future", () => {
    const base = local(2026, 8, 17, 7, 0);
    const from = local(2026, 8, 17, 18, 0); // 7am already passed today
    const next = computeNextRun({ type: "daily", runAt: base, cron: null, from });
    expect(sameLocal(next, local(2026, 8, 18, 7, 0))).toBe(true);
  });

  it("weekly: rolls forward by 7 days until in the future", () => {
    const base = local(2026, 8, 10, 7, 0); // last Monday
    const from = local(2026, 8, 17, 9, 0); // this Monday, after 07:00
    const next = computeNextRun({ type: "weekly", runAt: base, cron: null, from });
    expect(sameLocal(next, local(2026, 8, 24, 7, 0))).toBe(true);
  });

  it("cron: delegates to nextCronRun, invalid cron → null", () => {
    const next = computeNextRun({
      type: "cron",
      runAt: null,
      cron: "0 7 * * *",
      from: local(2026, 8, 17, 10, 0),
    });
    expect(sameLocal(next, local(2026, 8, 18, 7, 0))).toBe(true);
    expect(computeNextRun({ type: "cron", runAt: null, cron: null, from: T0 })).toBeNull();
    expect(computeNextRun({ type: "cron", runAt: null, cron: "not-a-cron", from: T0 })).toBeNull();
  });
});

describe("parseCron", () => {
  it("parses * fields", () => {
    const c = parseCron("* * * * *");
    expect(c.minutes.size).toBe(60);
    expect(c.hours.size).toBe(24);
    expect(c.dom.size).toBe(31);
    expect(c.months.size).toBe(12);
    expect(c.dow.size).toBe(7);
  });

  it("parses lists, ranges and steps", () => {
    const c = parseCron("0,30 9-17/2 1,15 * 1-5");
    expect(c.minutes.has(0)).toBe(true);
    expect(c.minutes.has(30)).toBe(true);
    expect(c.minutes.size).toBe(2);
    expect(c.hours.has(9)).toBe(true);
    expect(c.hours.has(11)).toBe(true);
    expect(c.hours.has(17)).toBe(true);
    expect(c.hours.size).toBe(5);
    expect(c.dom.has(1)).toBe(true);
    expect(c.dom.has(15)).toBe(true);
    expect(c.dow.has(1)).toBe(true);
    expect(c.dow.has(5)).toBe(true);
  });

  it("rejects wrong field count", () => {
    expect(() => parseCron("* * *")).toThrow();
    expect(() => parseCron("* * * * * *")).toThrow();
  });
});

describe("nextCronRun", () => {
  it("finds next daily 7am occurrence", () => {
    const next = nextCronRun("0 7 * * *", local(2026, 8, 17, 10, 0));
    expect(sameLocal(next, local(2026, 8, 18, 7, 0))).toBe(true);
  });

  it("same minute match stays strictly after `from`", () => {
    const from = local(2026, 8, 17, 7, 0);
    from.setSeconds(30); // 07:00:30 — usi minute me match na ho
    const next = nextCronRun("0 7 * * *", from);
    expect(sameLocal(next, local(2026, 8, 18, 7, 0))).toBe(true);
  });

  it("weekly on Mondays at 07:00", () => {
    // 2026-08-17 is a Monday (local)
    const next = nextCronRun("0 7 * * 1", local(2026, 8, 17, 10, 0));
    expect(sameLocal(next, local(2026, 8, 24, 7, 0))).toBe(true);
  });

  it("returns null when no match within 1 year (e.g. Feb 30)", () => {
    expect(nextCronRun("0 0 30 2 *", local(2026, 8, 17, 10, 0))).toBeNull();
  });
});
