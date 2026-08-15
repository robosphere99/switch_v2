import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createOrder } from "../api/shop";
import { useCartStore } from "../stores/cart";

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
  const [wifiPass, setWifiPass] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "upi">("cod");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!items.length) return;
    setSubmitting(true);
    setError(null);
    try {
      const order = await createOrder({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        shipping: { name, phone, address },
        wifi: wifiEnabled && ssid ? { ssid, password: wifiPass } : undefined,
        paymentMethod,
      });
      clear();
      navigate(`/orders?placed=${order.orderNumber}`);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? "Order fail ho gaya — dobara try karo");
    } finally {
      setSubmitting(false);
    }
  }

  if (!items.length) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <div className="mb-4 text-5xl">🛒</div>
        <h1 className="mb-2 text-2xl font-bold">Cart khali hai</h1>
        <p className="mb-6 text-gray-500">Pehle kuch products add karo.</p>
        <Link to="/shop" className="rounded-lg bg-brand px-6 py-3 font-semibold text-white">
          Shop kholo
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">
        <span className="text-brand">Checkout</span>
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Items summary */}
        <section className="rounded-xl border border-brand/20 bg-night-800 p-6">
          <h2 className="mb-3 text-lg font-semibold">Order Summary</h2>
          <div className="space-y-2 text-sm">
            {items.map((i) => (
              <div key={i.productId} className="flex justify-between text-gray-600">
                <span>
                  {i.name} <span className="text-gray-500">× {i.quantity}</span>
                </span>
                <span>₹{(i.price * i.quantity).toLocaleString("en-IN")}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-brand/20 pt-3 text-base font-bold">
              <span>Total</span>
              <span>₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>
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
                <input
                  type="password"
                  value={wifiPass}
                  onChange={(e) => setWifiPass(e.target.value)}
                  className="w-full rounded-lg border border-night-600 bg-night-900 px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}
        </section>

        {/* Payment */}
        <section className="rounded-xl border border-brand/20 bg-night-800 p-6">
          <h2 className="mb-4 text-lg font-semibold">Payment</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${
                paymentMethod === "cod" ? "border-brand bg-brand/10" : "border-night-600"
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
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 ${
                paymentMethod === "upi" ? "border-brand bg-brand/10" : "border-night-600"
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
                <div className="text-xs text-gray-500">Order ke baad details milengi</div>
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
    </div>
  );
}
