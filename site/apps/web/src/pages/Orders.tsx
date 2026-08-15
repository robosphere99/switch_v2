import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CopyText } from "../components/CopyText";
import {
  demoPay,
  getMyOrders,
  initiatePayment,
  verifyPayment,
  type Order,
  type PayIntent,
} from "../api/shop";

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending: { label: "⏳ Pending", cls: "bg-amber-500/20 text-amber-600" },
  paid: { label: "💳 Paid", cls: "bg-blue-500/20 text-blue-700" },
  shipped: { label: "📦 Shipped", cls: "bg-purple-500/20 text-purple-300" },
  delivered: { label: "✅ Delivered", cls: "bg-green-500/20 text-green-700" },
  cancelled: { label: "❌ Cancelled", cls: "bg-red-500/20 text-red-600" },
};

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const placed = params.get("placed");
  const [payIntent, setPayIntent] = useState<PayIntent | null>(null);
  const [payingFor, setPayingFor] = useState<number | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [verifyFields, setVerifyFields] = useState({ paymentId: "", signature: "" });

  const refresh = () => getMyOrders().then(setOrders);

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .finally(() => setLoading(false));
  }, []);

  const openPay = async (orderId: number) => {
    setPayBusy(true);
    setPayMsg(null);
    try {
      const intent = await initiatePayment(orderId);
      setPayingFor(orderId);
      setPayIntent(intent);
    } catch (e) {
      setPayMsg(String((e as Error).message ?? e));
    } finally {
      setPayBusy(false);
    }
  };

  const confirmDemoPay = async (orderId: number) => {
    setPayBusy(true);
    setPayMsg(null);
    try {
      const r = await demoPay(orderId);
      setPayIntent(null);
      setPayingFor(null);
      setPayMsg(`✅ Payment confirmed (${r.paymentRef})`);
      await refresh();
    } catch (e) {
      setPayMsg(String((e as Error).message ?? e));
    } finally {
      setPayBusy(false);
    }
  };

  const confirmRazorpay = async (orderId: number) => {
    setPayBusy(true);
    setPayMsg(null);
    try {
      await verifyPayment(orderId, {
        razorpayOrderId: payIntent?.razorpayOrderId ?? "",
        razorpayPaymentId: verifyFields.paymentId.trim(),
        razorpaySignature: verifyFields.signature.trim(),
      });
      setPayIntent(null);
      setPayingFor(null);
      setPayMsg("✅ Payment verified");
      await refresh();
    } catch (e) {
      setPayMsg(String((e as Error).message ?? e));
    } finally {
      setPayBusy(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading orders…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">
        <span className="bg-gradient-to-r from-brand-light to-brand bg-clip-text text-transparent">My Orders</span>
      </h1>

      {placed && (
        <div className="mb-6 rounded-lg border border-green-500/40 bg-green-900/30 p-4 text-sm text-green-700">
          ✅ Order <span className="font-bold">{placed}</span> placed! Delivery hone ke baad box pe serial code se{" "}
          <Link to="/activate" className="underline">device activate</Link> karo.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-brand/20 bg-night-800 p-10 text-center">
          <div className="mb-2 text-4xl">🛒</div>
          <p className="text-gray-500">Koi order nahi abhi.</p>
          <Link to="/shop" className="mt-4 inline-block rounded-lg bg-gradient-to-r from-brand to-brand-light px-6 py-2.5 font-semibold text-white">
            Shop kholo
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((o) => {
            const badge = STATUS_BADGE[o.status] ?? STATUS_BADGE.pending;
            const serials = o.items.flatMap((i) => (i.serialCode ? [i.serialCode] : []));
            return (
              <div key={o.id} className="rounded-xl border border-brand/20 bg-night-800 p-6">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CopyText text={o.orderNumber} className="text-lg font-bold" title="Hold to copy order #">
                      #{o.orderNumber}
                    </CopyText>
                    <span className="ml-3 text-sm text-gray-500">{new Date(o.createdAt).toLocaleString()}</span>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                </div>
                {o.status === "pending" && o.paymentMethod !== "cod" && (
                  <div className="mb-3">
                    <button
                      onClick={() => openPay(o.id)}
                      disabled={payBusy}
                      className="rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      💳 Pay Now
                    </button>
                  </div>
                )}

                <div className="mb-4 space-y-1.5 text-sm text-gray-600">
                  {o.items.map((i) => (
                    <div key={i.id} className="flex justify-between">
                      <span>
                        {i.productName} × {i.quantity}
                      </span>
                      <span>₹{(Number(i.price) * i.quantity).toLocaleString("en-IN")}</span>
                    </div>
                  ))}
                  <div className="flex justify-between border-t border-brand/20 pt-2 font-bold text-night-950">
                    <span>Total ({o.paymentMethod.toUpperCase()})</span>
                    <span>₹{Number(o.totalAmount).toLocaleString("en-IN")}</span>
                  </div>
                </div>

                {o.wifiSsid && (
                  <div className="mb-3 text-xs text-gray-500">📶 Pre-provisioned WiFi: <span className="text-gray-600">{o.wifiSsid}</span></div>
                )}

                {serials.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-gray-500">Serial:</span>
                    {serials.map((s) => (
                      <CopyText key={s} text={s} className="rounded bg-night-700 px-2 py-1 text-xs text-brand" title="Hold to copy serial">
                        {s}
                      </CopyText>
                    ))}
                    {o.status === "delivered" && (
                      <Link
                        to="/activate"
                        className="ml-auto rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-2 text-sm font-semibold text-white"
                      >
                        🔑 Activate Now
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">Serial code delivery ke baad milega (box pe sticker).</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {payMsg && (
        <div className="mt-6 rounded-lg border border-brand/30 bg-night-800 p-4 text-sm text-brand">
          {payMsg}
          {payMsg.startsWith("✅") && (
            <button onClick={() => setPayMsg(null)} className="ml-3 underline">close</button>
          )}
        </div>
      )}

      {payIntent && payingFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPayIntent(null)}>
          <div className="w-full max-w-md rounded-xl border border-brand/30 bg-night-800 p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-lg font-bold">💳 Pay ₹{payIntent.amount.toLocaleString("en-IN")}</h3>
            {payIntent.mode === "demo" ? (
              <>
                <p className="mb-3 text-sm text-gray-500">
                  Demo mode — kisi bhi UPI app me yeh intent use karo:
                </p>
                <div className="mb-3 rounded-lg bg-night-700 p-3 font-mono text-xs text-brand break-all">
                  {payIntent.upiIntent}
                </div>
                <button
                  onClick={() => confirmDemoPay(payingFor)}
                  disabled={payBusy}
                  className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {payBusy ? "Verifying…" : "✅ Maine UPI se pay kar diya (Demo verify)"}
                </button>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-gray-500">
                  Razorpay checkout — payment ke baad yahan payment ID + signature daalo (server verify karega):
                </p>
                <label className="mb-1 block text-xs text-gray-500">Razorpay Payment ID</label>
                <input
                  value={verifyFields.paymentId}
                  onChange={(e) => setVerifyFields((v) => ({ ...v, paymentId: e.target.value }))}
                  className="mb-3 w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
                  placeholder="pay_xxxxxxxx"
                />
                <label className="mb-1 block text-xs text-gray-500">Razorpay Signature</label>
                <input
                  value={verifyFields.signature}
                  onChange={(e) => setVerifyFields((v) => ({ ...v, signature: e.target.value }))}
                  className="mb-3 w-full rounded-lg border border-brand/30 bg-night-700 px-3 py-2 text-sm text-night-950"
                  placeholder="signature_hex"
                />
                <button
                  onClick={() => confirmRazorpay(payingFor)}
                  disabled={payBusy}
                  className="w-full rounded-lg bg-gradient-to-r from-brand to-brand-light px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {payBusy ? "Verifying…" : "Verify & Confirm Payment"}
                </button>
              </>
            )}
            <button onClick={() => setPayIntent(null)} className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
