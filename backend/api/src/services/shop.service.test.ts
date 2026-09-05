import { describe, expect, it } from "vitest";
import { makeOrderNumber, makeSerialCode } from "./shop.service";

describe("makeOrderNumber", () => {
  it("starts with RS and is unique per call", () => {
    const a = makeOrderNumber();
    const b = makeOrderNumber();
    expect(a).toMatch(/^RS[A-Z0-9]+$/);
    expect(a).not.toBe(b);
  });

  it("is stable in length", () => {
    for (let i = 0; i < 50; i++) {
      expect(makeOrderNumber().length).toBeLessThanOrEqual(16);
    }
  });
});

describe("makeSerialCode", () => {
  it("format: RS-<MODEL>-<6 chars>", () => {
    const code = makeSerialCode("4CH");
    expect(code).toMatch(/^RS-4CH-[A-Z2-9]{6}$/);
  });

  it("never uses ambiguous characters (0/O/1/I)", () => {
    for (let i = 0; i < 200; i++) {
      const code = makeSerialCode("4CH");
      const suffix = code.split("-")[2]!;
      expect(suffix).not.toMatch(/[01OI]/);
    }
  });

  it("two codes are distinct", () => {
    const codes = new Set(Array.from({ length: 100 }, () => makeSerialCode("4CH")));
    expect(codes.size).toBe(100);
  });
});
