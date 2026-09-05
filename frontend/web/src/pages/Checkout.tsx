import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createOrder, initiatePayment, verifyPayment, demoPay, cancelOrder, validateCoupon, type PayIntent } from "../api/shop";
import { useCartStore } from "../stores/cart";

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]')) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function Checkout() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const total = useCartStore((s) => s.total());

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [wifiEnabled, setWifiEnabled] = useState(false);
  const [ssid, setSsid] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [wifiPass, setWifiPass] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "upi">("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [payIntent, setPayIntent] = useState<PayIntent | null>(null);
  const [payingFor, setPayingFor] = useState<number | null>(null);

  const [couponCodeInput, setCouponCodeInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; type: "percentage" | "fixed"; value: number; max: number | null; min: number | null } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.min && total < appliedCoupon.min) {
      // Too small, no discount applied but it's handled on apply. We just do it for safety
    } else {
      if (appliedCoupon.type === "percentage") {
        discount = (total * appliedCoupon.value) / 100;
        if (appliedCoupon.max && discount > appliedCoupon.max) discount = appliedCoupon.max;
      } else {
        discount = appliedCoupon.value;
      }
      discount = Math.min(discount, total);
    }
  }

  const finalTotal = total - discount;

  async function handleApplyCoupon() {
    setCouponError(null);
    if (!couponCodeInput.trim()) return;
    try {
      const c = await validateCoupon(couponCodeInput);
      if (c.minOrderAmount && total < c.minOrderAmount) {
        setCouponError(`Min order amount is ₹${c.minOrderAmount}`);
        return;
      }
      setAppliedCoupon({ code: c.code, type: c.discountType, value: c.discountValue, max: c.maxDiscount, min: c.minOrderAmount });
    } catch (err: any) {
      setCouponError(err?.response?.data?.error?.message ?? err?.message ?? "Invalid coupon code");
    }
  }

  async function handleCancelDemoPay(orderId: number) {
    setSubmitting(true);
    try {
      await cancelOrder(orderId);
      setError("Payment cancelled. Order cancelled.");
    } catch (err) {
      console.error("Auto cancel failed:", err);
    } finally {
      setPayIntent(null);
      setPayingFor(null);
      setSubmitting(false);
    }
  }

  async function handleConfirmDemoPay(orderId: number) {
    setSubmitting(true);
    try {
      const r = await demoPay(orderId);
      clear();
      navigate(`/orders?placed=${r.paymentRef || "demo"}`);
    } catch (err: any) {
      setError(err?.message || "Demo payment failed.");
      try {
        await cancelOrder(orderId);
      } catch (cancelErr) {
        console.error("Auto cancel failed:", cancelErr);
      }
    } finally {
      setPayIntent(null);
      setPayingFor(null);
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    setSubmitting(true);
    setError(null);
    let createdOrderId: number | null = null;
    try {
      const order = await createOrder({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shipping: { name, phone, address },
        wifi: wifiEnabled && ssid ? { ssid, password: wifiPass } : undefined,
        paymentMethod,
        couponCode: appliedCoupon?.code,
      });
      createdOrderId = order.id;

      if (paymentMethod === "upi") {
        const intent = await initiatePayment(order.id);
        if (intent.mode === "demo") {
          setPayingFor(order.id);
          setPayIntent(intent);
          return;
        } else {
          const loaded = await loadRazorpayScript();
          if (!loaded) {
            throw new Error("Razorpay SDK failed to load. Are you offline?");
          }

          await new Promise<void>((resolve, reject) => {
            const options = {
              key: intent.keyId,
              amount: intent.amount * 100, // INR to paise
              currency: "INR",
              name: "SwitchNest",
              description: "Order #" + order.id,
              order_id: intent.razorpayOrderId ?? "",
              handler: async function (response: any) {
                try {
                  await verifyPayment(order.id, {
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
                }
              },
              prefill: {
                name: "SwitchNest User",
                email: "support@switchnest.com",
                contact: "9999999999"
              },
              theme: { color: "#4f46e5" }
            };
            const rzp = new (window as any).Razorpay(options);
            rzp.on("payment.failed", function (response: any) {
              reject(new Error(response.error.description || "Razorpay payment failed."));
            });
            rzp.open();
          });
        }
      }

      clear();
      navigate(`/orders?placed=${order.orderNumber}`);
    } catch (err: any) {
      console.warn("Checkout/payment failed, auto-cancelling order:", createdOrderId, err);
      if (createdOrderId) {
        try {
          await cancelOrder(createdOrderId);
        } catch (cancelErr) {
          console.error("Auto cancel fail:", cancelErr);
        }
        clear();
        navigate("/orders?failed=true");
      } else {
        const msg = err?.response?.data?.error?.message ?? err?.message ?? "Order fail ho gaya — dobara try karo";
        setError(msg);
        setSubmitting(false);
      }
    }
  }

  if (!items.length) {
    return (
      <div className="page-enter mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-4 text-5xl">🛒</div>
        <h1 className="mb-2 text-2xl font-bold">Cart khali hai</h1>
        <p className="mb-6 text-gray-500">Pehle kuch products add karo.</p>
        <Link to="/shop" className="btn-primary px-6 py-3">
          Shop kholo
        </Link>
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="page-title mb-6">Checkout</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Items summary */}
        <section className="card-static p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900 dark:text-white">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map((i) => (
              <div key={i.productId} className="flex justify-between text-gray-600">
                <span>
                  {i.name} <span className="text-gray-500">× {i.quantity}</span>
                </span>
                <span>₹{(i.price * i.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
            {discount > 0 && (
              <div className="flex justify-between border-t border-brand/20 pt-3 text-sm font-semibold text-green-500">
                <span>Discount ({appliedCoupon?.code})</span>
                <span>-₹{discount.toLocaleString("en-IN")}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-brand/20 pt-3 text-base font-bold">
              <span>Total</span>
              <span>₹{finalTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </section>

        {/* Coupons */}
        <section className="rounded-xl border border-brand/20 bg-night-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Apply Coupon</h2>
          <div className="flex items-center gap-3">
            <input
              value={couponCodeInput}
              onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
              placeholder="Enter coupon code"
              className="flex-1 rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm uppercase"
            />
            <button
              type="button"
              onClick={handleApplyCoupon}
              className="rounded-lg bg-night-700 px-4 py-2 font-semibold hover:bg-night-600"
            >
              Apply
            </button>
          </div>
          {couponError && <p className="mt-2 text-sm text-red-500">{couponError}</p>}
          {appliedCoupon && !couponError && (
            <p className="mt-2 text-sm text-green-500">
              Coupon '{appliedCoupon.code}' applied successfully!
            </p>
          )}
        </section>

        {/* Shipping */}
        <section className="rounded-xl border border-brand/20 bg-night-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Shipping Details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-gray-500">Full name *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm text-gray-500">Phone *</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="mb-1 block text-sm text-gray-500">Shipping address *</label>
            <textarea
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required
              rows={2}
              className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm"
            />
          </div>
        </section>

        {/* WiFi provisioning (optional) */}
        <section className="rounded-xl border border-brand/20 bg-night-800 p-6">
          <label className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">WiFi Pre-Provisioning <span className="text-xs font-normal text-gray-500">(optional)</span></h2>
              <p className="text-sm text-gray-500">
                Board factory se hi aapke WiFi se connected aayega. Device bhi khud config mode me aa jata hai agar WiFi badle.
              </p>
            </div>
            <input
              type="checkbox"
              checked={wifiEnabled}
              onChange={(e) => setWifiEnabled(e.target.checked)}
              className="h-5 w-5 accent-brand"
            />
          </label>
          {wifiEnabled && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm text-gray-500">WiFi name (SSID)</label>
                <input
                  value={ssid}
                  onChange={(e) => setSsid(e.target.value)}
                  placeholder="e.g. Robo_lab"
                  className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-500">WiFi password</label>
                <div className="relative">
                  <input
                    type={showPass ? "text" : "password"}
                    value={wifiPass}
                    onChange={(e) => setWifiPass(e.target.value)}
                    placeholder="Enter WiFi password"
                    className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 pr-10 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition"
                    tabIndex={-1}
                    title={showPass ? "Hide password" : "Show password"}
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Payment */}
        <section className="rounded-xl border border-brand/20 bg-night-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Payment</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${paymentMethod === "cod" ? "border-brand bg-brand/10" : "border-night-600"
                }`}
            >
              <input
                type="radio"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
                className="accent-brand"
              />
              <div>
                <div className="font-semibold">💵 Cash on Delivery</div>
                <div className="text-xs text-gray-500">Delivery par pay karo</div>
              </div>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${paymentMethod === "upi" ? "border-brand bg-brand/10" : "border-night-600"
                }`}
            >
              <input
                type="radio"
                checked={paymentMethod === "upi"}
                onChange={() => setPaymentMethod("upi")}
                className="accent-brand"
              />
              <div>
                <div className="font-semibold">📱 UPI / Bank Transfer</div>
                <div className="text-xs text-gray-500">Fast checkout with online payment</div>
              </div>
            </label>
          </div>
        </section>

        {error && <div className="rounded bg-red-900/40 p-3 text-sm text-red-600">{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand px-4 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50"
        >
          {submitting ? "Placing order…" : `Place Order · ₹${total.toLocaleString("en-IN")}`}
        </button>
      </form>

      {payIntent && payingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => handleCancelDemoPay(payingFor)}>
          <div className="w-full max-w-md rounded-xl border border-brand/30 bg-night-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">💳 Pay ₹{payIntent.amount.toLocaleString("en-IN")}</h3>
            {payIntent.mode === "demo" && (
              <>
                <p className="mb-3 text-sm text-gray-500">
                  Demo mode — kisi bhi UPI app me yeh intent use karo:
                </p>
                <div className="mb-3 rounded-lg bg-night-700 p-3 font-mono text-xs text-brand break-all">
                  {payIntent.upiIntent}
                </div>
                <button
                  onClick={() => handleConfirmDemoPay(payingFor)}
                  disabled={submitting}
                  className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? "Verifying…" : "✅ Maine UPI se pay kar diya (Demo verify)"}
                </button>
              </>
            )}
            <button onClick={() => handleCancelDemoPay(payingFor)} className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
