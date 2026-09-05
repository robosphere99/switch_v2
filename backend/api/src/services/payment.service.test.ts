import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";

// env module mock — payment service module-load pe env padhta hai, isliye
// vi.mock (hoisted) se deterministic keys do (site/.env me nahi hote).
vi.mock("../config/env", () => ({
  env: { RAZORPAY_KEY_ID: "rzp_test_id", RAZORPAY_KEY_SECRET: "rzp_test_secret" },
}));

const { createRazorpayOrder, razorpayConfigured, verifyRazorpaySignature, verifyRazorpayWebhook } =
  await import("./payment.service");

function hmac(payload: string, secret = "rzp_test_secret"): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

describe("verifyRazorpaySignature", () => {
  it("verifies a correct signature (HMAC-SHA256 of orderId|paymentId)", () => {
    expect(verifyRazorpaySignature("order_1", "pay_1", hmac("order_1|pay_1"))).toBe(true);
  });

  it("rejects a tampered signature", () => {
    expect(verifyRazorpaySignature("order_1", "pay_1", "deadbeef")).toBe(false);
    expect(verifyRazorpaySignature("order_2", "pay_1", hmac("order_1|pay_1"))).toBe(false);
  });
});

describe("verifyRazorpayWebhook", () => {
  it("verifies webhook signature over the raw body", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    expect(verifyRazorpayWebhook(body, hmac(body))).toBe(true);
  });

  it("rejects a wrong webhook signature", () => {
    expect(verifyRazorpayWebhook('{"event":"x"}', "nope")).toBe(false);
  });
});

describe("razorpayConfigured", () => {
  it("true when keys are present (mocked env)", () => {
    expect(razorpayConfigured()).toBe(true);
  });
});

describe("createRazorpayOrder", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts amount in paise to the Razorpay Orders API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "order_xyz", amount: 79900, currency: "INR" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createRazorpayOrder(799, "order_1");

    expect(result.id).toBe("order_xyz");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.razorpay.com/v1/orders",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Basic " + Buffer.from("rzp_test_id:rzp_test_secret").toString("base64"),
        }),
        body: expect.stringContaining('"amount":79900'),
      }),
    );
  });

  it("throws PAYMENT_ERROR on non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }),
    );

    await expect(createRazorpayOrder(100, "order_2")).rejects.toMatchObject({
      code: "PAYMENT_ERROR",
    });
  });
});
