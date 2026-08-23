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

const STEPS = ["placed", "paid", "shipped", "delivered"] as const;

const STEP_LABEL: Record<string, string> = {
  placed: "🛒 Order placed",
  paid: "💳 Payment verified",
  shipped: "📦 Shipped",
  delivered: "✅ Delivered",
};

function OrderDetails({ order }: { order: Order }) {
  const activeIdx = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  return (
    <div className="mt-4 rounded-lg border border-brand/20 bg-night-900 p-4 text-sm">
      {/* Status timeline */}
      <div className="mb-4 flex flex-wrap items-center gap-1">
        {STEPS.map((s, i) => {
          const done = activeIdx >= 0 && i <= activeIdx;
          return (
            <div key={s} className="flex items-center gap-1">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${done ? "bg-brand/20 text-brand" : "bg-night-700 text-gray-500"}`}
              >
                {STEP_LABEL[s]}
              </span>
              {i < STEPS.length - 1 && <span className="text-gray-600">→</span>}
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Payment</div>
          <div className="space-y-1 text-gray-600">
            <div>Method: <b className="text-night-950">{order.paymentMethod.toUpperCase()}</b></div>
            <div>Status: {order.paymentStatus}</div>
            <div>Paid at: {order.paidAt ? new Date(order.paidAt).toLocaleString() : "—"}</div>
            {order.paymentRef && (
              <div className="break-all">Ref: <span className="font-mono text-xs text-brand">{order.paymentRef}</span></div>
            )}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Shipping</div>
          <div className="space-y-1 text-gray-600">
            <div><b className="text-night-950">{order.shippingName}</b> · {order.shippingPhone}</div>
            <div>{order.shippingAddress}</div>
            {order.wifiSsid && <div>📶 Pre-provisioned WiFi: <b>{order.wifiSsid}</b></div>}
          </div>
        </div>
      </div>

      {/* Courier tracking — future integration ke liye placeholder */}
      <div className="mt-4 rounded-lg border border-dashed border-brand/30 bg-night-800/60 p-3">
        <div className="mb-1 flex items-center gap-2 text-xs font-bold text-brand">🚚 Courier Tracking</div>
        <p className="text-xs text-gray-500">
          Abhi koi delivery service (Shiprocket etc.) linked nahi hai — order ka status yahan track hota hai.
          Future me courier service integration ke baad yahan live location dikhegi.
        </p>
        <div className="mt-2 text-xs text-gray-600">
          Current status: <span className="font-bold text-night-950">{(STATUS_BADGE[order.status] ?? STATUS_BADGE.pending).label}</span>
        </div>
      </div>
    </div>
  );
}

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
  const failed = params.get("failed");
  const [openId, setOpenId] = useState<number | null>(null);
  const [payIntent, setPayIntent] = useState<PayIntent | null>(null);
  const [payingFor, setPayingFor] = useState<number | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);

  const refresh = () => getMyOrders().then(setOrders);

  useEffect(() => {
    getMyOrders()
      .then(setOrders)
      .finally(() => setLoading(false));

    // Poll for fresh order records every 8 seconds silently
    const interval = setInterval(() => {
      getMyOrders().then(setOrders);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const openPay = async (orderId: number) => {
    setPayBusy(true);
    setPayMsg(null);
    try {
      const intent = await initiatePayment(orderId);
      if (intent.mode === "demo") {
        setPayingFor(orderId);
        setPayIntent(intent);
      } else {
        const loaded = await loadRazorpayScript();
        if (!loaded) {
          setPayMsg("Razorpay SDK failed to load. Are you offline?");
          return;
        }

        const options = {
          key: intent.keyId,
          amount: intent.amount * 100, // INR to paise
          currency: "INR",
          name: "SwitchNest",
          description: "Order #" + orderId,
          order_id: intent.razorpayOrderId ?? "",
          handler: async function (response: any) {
            setPayBusy(true);
            try {
              await verifyPayment(orderId, {
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              });
              setPayMsg("✅ Payment verified successfully");
              await refresh();
            } catch (err: any) {
              setPayMsg(String(err?.message ?? err));
            } finally {
              setPayBusy(false);
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
          setPayMsg("Payment failed: " + response.error.description);
        });
        rzp.open();
      }
    } catch (err: any) {
      setPayMsg(err?.response?.data?.error?.message ?? err?.message ?? String(err));
    } finally {
      setPayBusy(false);
    }
  };

  const closePay = async () => {
    setPayIntent(null);
    setPayingFor(null);
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



  if (loading) return <div className="p-10 text-center text-gray-500">Loading orders…</div>;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">
        <span className="text-brand">My Orders</span>
      </h1>

      {placed && (
        <div className="mb-6 rounded-lg border border-green-500/40 bg-green-900/30 p-4 text-sm text-green-700">
          ✅ Order <span className="font-bold">{placed}</span> placed! Delivery hone ke baad box pe serial code se{" "}
          <Link to="/activate" className="underline">device activate</Link> karo.
        </div>
      )}

      {failed && (
        <div className="mb-6 rounded-lg border border-red-500/40 bg-red-900/30 p-4 text-sm text-red-500">
          ❌ Payment failed or was cancelled. The pending order has been cancelled automatically.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="rounded-xl border border-brand/20 bg-night-800 p-10 text-center">
          <div className="mb-2 text-4xl">🛒</div>
          <p className="text-gray-500">Koi order nahi abhi.</p>
          <Link to="/shop" className="mt-4 inline-block rounded-lg bg-brand px-6 py-2.5 font-semibold text-white">
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
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.cls}`}>{badge.label}</span>
                    <button
                      onClick={() => setOpenId(openId === o.id ? null : o.id)}
                      className="rounded-lg border border-brand/20 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
                    >
                      {openId === o.id ? "▲ Details" : "▼ Details"}
                    </button>
                  </div>
                </div>
                {o.status === "pending" && o.paymentMethod !== "cod" && (
                  <div className="mb-3">
                    <button
                      onClick={() => openPay(o.id)}
                      disabled={payBusy}
                      className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
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
                        className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
                      >
                        🔑 Activate Now
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-gray-500">Serial code delivery ke baad milega (box pe sticker).</div>
                )}

                {openId === o.id && <OrderDetails order={o} />}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={closePay}>
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
                  onClick={() => confirmDemoPay(payingFor)}
                  disabled={payBusy}
                  className="w-full rounded-lg bg-brand px-4 py-2.5 font-semibold text-white disabled:opacity-50"
                >
                  {payBusy ? "Verifying…" : "✅ Maine UPI se pay kar diya (Demo verify)"}
                </button>
              </>
            )}
            <button onClick={closePay} className="mt-3 w-full text-center text-xs text-gray-500 hover:text-gray-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
