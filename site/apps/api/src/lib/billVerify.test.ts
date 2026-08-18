import { describe, expect, it } from "vitest";
import { signBillToken, verifyBillToken } from "./billVerify";

describe("bill verify token", () => {
  it("roundtrip — sign then verify returns orderId", () => {
    const token = signBillToken(42);
    expect(token).toMatch(/^42\.[A-Za-z0-9_-]+$/);
    expect(verifyBillToken(token)).toEqual({ orderId: 42 });
  });

  it("different orders → different tokens (deterministic per order)", () => {
    const t1 = signBillToken(1);
    const t2 = signBillToken(2);
    expect(t1).not.toBe(t2);
    // same order → same token (QR stable, reprint se verify tutega nahi)
    expect(signBillToken(7)).toBe(signBillToken(7));
  });

  it("tampered orderId → rejected", () => {
    const token = signBillToken(42);
    const forged = `43${token.slice(2)}`; // 42 → 43
    expect(verifyBillToken(forged)).toBeNull();
  });

  it("tampered signature → rejected", () => {
    const token = signBillToken(42);
    const last = token[token.length - 1];
    const corrupted = token.slice(0, -1) + (last === "A" ? "B" : "A");
    expect(verifyBillToken(corrupted)).toBeNull();
  });

  it("garbage / missing parts → null (no crash)", () => {
    expect(verifyBillToken("")).toBeNull();
    expect(verifyBillToken("abc")).toBeNull();
    expect(verifyBillToken("42.")).toBeNull();
    expect(verifyBillToken(".sig")).toBeNull();
    expect(verifyBillToken("0.abc")).toBeNull();
    expect(verifyBillToken("-5.abc")).toBeNull();
    expect(verifyBillToken("42.!!!!")).toBeNull();
    expect(verifyBillToken("abc.def")).toBeNull();
  });
});
