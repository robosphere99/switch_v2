/**
 * Razorpay SDK helpers — shared between Checkout and Orders pages.
 * Loads the SDK script lazily and opens the checkout modal.
 */
import { verifyPayment, type PayIntent } from "../api/shop";

const RAZORPAY_SDK_URL = "https://checkout.razorpay.com/v1/checkout.js";

/** Lazy-load Razorpay's checkout.js — resolves true when ready. */
export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${RAZORPAY_SDK_URL}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = RAZORPAY_SDK_URL;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export interface RazorpayCheckoutOptions {
  /** PayIntent from backend `/pay` endpoint. */
  intent: PayIntent;
  /** Order ID for verify callback. */
  orderId: number;
  /** Prefill fields for the Razorpay modal. */
  prefill: {
    name?: string;
    email?: string;
    contact?: string;
  };
  /** Brand color for the Razorpay modal (hex). */
  themeColor?: string;
  /** Order description shown in the modal. */
  description?: string;
}

/**
 * Open Razorpay checkout modal and verify payment on success.
 * Resolves when payment is verified, rejects on cancel/failure.
 */
export async function openRazorpayCheckout(opts: RazorpayCheckoutOptions): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded) {
    throw new Error("Razorpay SDK failed to load. Please verify your internet connection.");
  }

  return new Promise((resolve, reject) => {
    const { intent, orderId, prefill, themeColor = "#991b1b", description } = opts;

    const options = {
      key: intent.keyId,
      amount: intent.amount * 100, // INR → paise
      currency: "INR",
      name: "SwitchNest",
      description: description ?? `Order #${orderId}`,
      order_id: intent.razorpayOrderId ?? "",
      handler: async function (response: any) {
        try {
          await verifyPayment(orderId, {
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          resolve();
        } catch (err: any) {
          reject(new Error(err?.message || "Payment verification failed."));
        }
      },
      modal: {
        ondismiss: function () {
          reject(new Error("PAYMENT_CLOSED"));
        },
      },
      prefill: {
        name: prefill.name || "Customer",
        email: prefill.email || "",
        contact: prefill.contact || "",
      },
      theme: { color: themeColor },
    };

    const rzp = new (window as any).Razorpay(options);
    rzp.on("payment.failed", function (response: any) {
      reject(new Error(response.error.description || "Razorpay payment failed."));
    });
    rzp.open();
  });
}
