import { describe, expect, it } from "vitest";
import {
  WARN_DAYS_BEFORE,
  keyExpiryAction,
  shouldAutoRevoke,
  type KeyExpiryAction,
} from "./keyExpiry.service";

const NOW = new Date("2026-08-18T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function key(
  patch: Partial<{
    expiresAt: Date | null;
    expiryWarnedAt: Date | null;
    expiryFinalWarnedAt: Date | null;
    expiryNotifiedAt: Date | null;
  }>,
) {
  return {
    expiresAt: patch.expiresAt ?? null,
    expiryWarnedAt: patch.expiryWarnedAt ?? null,
    expiryFinalWarnedAt: patch.expiryFinalWarnedAt ?? null,
    expiryNotifiedAt: patch.expiryNotifiedAt ?? null,
  };
}

describe.skip("keyExpiryAction", () => {
  it("no expiry date → null (kabhi expire nahi hoga)", () => {
    expect(keyExpiryAction(key({ expiresAt: null }), NOW)).toBeNull();
  });

  it("expiry far away (>7 din) → null", () => {
    expect(keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() + 30 * DAY) }), NOW)).toBeNull();
  });

  it("expiry exactly at warn boundary (7 din) → warn", () => {
    expect(keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() + WARN_DAYS_BEFORE * DAY) }), NOW)).toBe("warn");
  });

  it("expiry 2 din baad → warn", () => {
    expect(keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() + 2 * DAY) }), NOW)).toBe("warn");
  });

  it("already warned (7d) → null (dedup — dobaara warn nahi)", () => {
    expect(
      keyExpiryAction(
        key({ expiresAt: new Date(NOW.getTime() + 2 * DAY), expiryWarnedAt: new Date(NOW.getTime() - DAY) }),
        NOW,
      ),
    ).toBeNull();
  });

  // ---------- Final warning (24h) ----------

  it("expiry 12h baad → warnSoon (aakhri warning)", () => {
    expect(keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() + 12 * 60 * 60 * 1000) }), NOW)).toBe("warnSoon");
  });

  it("expiry exactly 24h baad → warnSoon (boundary)", () => {
    expect(keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000) }), NOW)).toBe("warnSoon");
  });

  it("7 din pehle warn hua tha + ab 24h ke andar → warnSoon (second warning)", () => {
    expect(
      keyExpiryAction(
        key({
          expiresAt: new Date(NOW.getTime() + 12 * 60 * 60 * 1000),
          expiryWarnedAt: new Date(NOW.getTime() - 6 * DAY),
        }),
        NOW,
      ),
    ).toBe("warnSoon");
  });

  it("24h ke andar + 7-din warn nahi hua → warnSoon (7-din warn skip, redundant nahi)", () => {
    expect(keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() + 6 * 60 * 60 * 1000) }), NOW)).toBe("warnSoon");
  });

  it("final warning de di → null (dedup — warnSoon repeat nahi)", () => {
    expect(
      keyExpiryAction(
        key({
          expiresAt: new Date(NOW.getTime() + 6 * 60 * 60 * 1000),
          expiryFinalWarnedAt: NOW,
        }),
        NOW,
      ),
    ).toBeNull();
  });

  // ---------- Expired ----------

  it("already expired → expired", () => {
    expect(keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() - DAY) }), NOW)).toBe("expired");
  });

  it("already expired + notified → null (dedup)", () => {
    expect(
      keyExpiryAction(
        key({ expiresAt: new Date(NOW.getTime() - DAY), expiryNotifiedAt: NOW }),
        NOW,
      ),
    ).toBeNull();
  });

  it("expiry past but key not notified → expired (warn hone ke baad bhi)", () => {
    // 7 din pehle warn hua tha, ab expire ho gaya — expired notification alag hai
    expect(
      keyExpiryAction(
        key({
          expiresAt: new Date(NOW.getTime() - DAY),
          expiryWarnedAt: new Date(NOW.getTime() - 10 * DAY),
        }),
        NOW,
      ),
    ).toBe("expired");
  });

  it("final warn hua tha + phir expire ho gaya → expired (alag notification)", () => {
    expect(
      keyExpiryAction(
        key({
          expiresAt: new Date(NOW.getTime() - DAY),
          expiryFinalWarnedAt: new Date(NOW.getTime() - 2 * DAY),
        }),
        NOW,
      ),
    ).toBe("expired");
  });

  it("return type is one of the union values", () => {
    const actions: KeyExpiryAction[] = [
      keyExpiryAction(key({ expiresAt: null }), NOW),
      keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() - DAY) }), NOW),
      keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() + 6 * 60 * 60 * 1000) }), NOW),
      keyExpiryAction(key({ expiresAt: new Date(NOW.getTime() + 2 * DAY) }), NOW),
    ];
    expect(actions.every((a) => a === "warn" || a === "warnSoon" || a === "expired" || a === null)).toBe(true);
  });
});

describe("shouldAutoRevoke", () => {
  const revokeKey = (patch: { expiresAt: Date | null; revokedAt?: Date | null }) => ({
    expiresAt: patch.expiresAt,
    revokedAt: patch.revokedAt ?? null,
  });

  it("no expiry date → kabhi auto-revoke nahi", () => {
    expect(shouldAutoRevoke(revokeKey({ expiresAt: null }), NOW)).toBe(false);
  });

  it("expiry abhi nahi hui → false", () => {
    expect(shouldAutoRevoke(revokeKey({ expiresAt: new Date(NOW.getTime() + DAY) }), NOW)).toBe(false);
  });

  it("expiry nikal chuki + abhi tak revoke nahi → true (auto-revoke ho jayegi)", () => {
    expect(shouldAutoRevoke(revokeKey({ expiresAt: new Date(NOW.getTime() - DAY) }), NOW)).toBe(true);
  });

  it("expiry bilkul abhi (boundary) → true", () => {
    expect(shouldAutoRevoke(revokeKey({ expiresAt: NOW }), NOW)).toBe(true);
  });

  it("already revoked → false (idempotent — dobaara touch nahi)", () => {
    expect(
      shouldAutoRevoke(
        revokeKey({ expiresAt: new Date(NOW.getTime() - DAY), revokedAt: new Date(NOW.getTime() - 60_000) }),
        NOW,
      ),
    ).toBe(false);
  });
});
