import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CopyText } from "../components/CopyText";
import { Star, FileText, Banknote, Search, ChevronLeft, ChevronRight, Filter, KeyRound } from "lucide-react";
import QRCode from "qrcode";

async function generateBill(o: any) {
  let qrCodeHtml = "";
  if (o.verifyToken) {
    try {
      const url = `${window.location.origin}/verify/bill/${o.verifyToken}`;
      const dataUrl = await QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 90, color: { dark: "#0b0b16", light: "#ffffff" } });
      qrCodeHtml = `<img src="${dataUrl}" alt="Verify QR" style="width: 70px; height: 70px; border-radius: 4px; float: right; margin-left: 15px;" />`;
    } catch {
      // ignore
    }
  }
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Invoice #${o.orderNumber}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: #fff; color: #111; padding: 40px; }
    .bill { background: #ffffff; color: #111; border-radius: 10px; padding: 28px; border: 1px solid #e5e7eb; max-width: 800px; margin: 0 auto; }
    .bill-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
    .bill-brand { font-size: 20px; font-weight: 800; }
    .bill-title { font-size: 13px; color: #444; margin-top: 2px; }
    .bill-meta { text-align: right; font-size: 12px; color: #333; line-height: 1.5; }
    .bill-meta b { font-size: 15px; }
    .bill-section { margin-bottom: 14px; }
    .bill-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #777; margin-bottom: 4px; font-weight: 700; }
    .bill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .bill-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .bill-table th { text-align: left; border-bottom: 1px solid #ddd; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #555; }
    .bill-table td { border-bottom: 1px solid #eee; padding: 7px 8px; vertical-align: top; }
    .bill-total td { border-top: 2px solid #111; border-bottom: 0; font-weight: 800; font-size: 14px; }
    .bill-foot { margin-top: 18px; padding-top: 10px; border-top: 1px dashed #bbb; font-size: 11px; color: #555; }
    .bill-serial { font-family: Consolas, monospace; font-weight: 700; font-size: 11px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .badge-paid { background-color: rgb(34 197 94 / 0.2); color: rgb(21 128 61); }
    .badge-cod { background-color: rgb(245 158 11 / 0.2); color: rgb(180 83 9); }
    @media print { body { padding: 0; } .bill { border: none; max-width: 100%; } }
  </style>
</head>
<body>
  <div class="bill">
    <div class="bill-header">
      <div>
        <div class="bill-brand">🚀 SwitchNest</div>
        <div class="bill-title">Invoice / Bill of Sale — IoT Relay Boards</div>
      </div>
      <div class="bill-meta">
        ${qrCodeHtml}
        <div>Bill No: <b>#${o.orderNumber}</b></div>
        <div>Date: ${new Date(o.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        <div>Status: <span class="badge ${o.paymentMethod === 'cod' ? 'badge-cod' : 'badge-paid'}">${o.status}</span></div>
        <div style="color: #16a34a; font-weight: 700; font-size: 11px; margin-top: 4px;">🛡️ Genuine · Factory tested</div>
      </div>
    </div>

    <div class="bill-grid">
      <div class="bill-section">
        <div class="bill-label">Billed To</div>
        <div style="font-size: 13px; line-height: 1.6">
          <b>${o.shippingName}</b><br />
          ${o.shippingPhone}<br />
          ${o.shippingAddress}
        </div>
      </div>
      <div class="bill-section">
        <div class="bill-label">Payment</div>
        <div style="font-size: 13px; line-height: 1.6">
          Method: <b>${o.paymentMethod.toUpperCase()}</b><br />
          Status: ${o.paymentStatus}<br />
          ${o.paidAt ? `Paid at: ${new Date(o.paidAt).toLocaleString("en-IN")}<br />` : ""}
          ${o.paymentRef ? `Ref: <span class="bill-serial">${o.paymentRef}</span>` : ""}
        </div>
        ${o.wifiSsid ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">📶 WiFi (factory): ${o.wifiSsid}</div>` : ""}
      </div>
    </div>

    <div class="bill-section">
      <div class="bill-label">Items</div>
      <table class="bill-table">
        <thead>
          <tr>
            <th>Product</th>
            <th style="text-align: right">Qty</th>
            <th style="text-align: right">Unit</th>
            <th style="text-align: right">Amount</th>
            <th>Serial(s)</th>
          </tr>
        </thead>
        <tbody>
          ${o.items.map((i: any) => `
          <tr>
            <td>${i.productName}</td>
            <td style="text-align: right">${i.quantity}</td>
            <td style="text-align: right">&#8377;${Number(i.price).toLocaleString('en-IN')}</td>
            <td style="text-align: right">&#8377;${(Number(i.price) * i.quantity).toLocaleString('en-IN')}</td>
            <td class="bill-serial">${i.serialCode ?? "—"}</td>
          </tr>
          `).join('')}
          ${Number(o.discountAmount) > 0 ? `
          <tr>
            <td colspan="3" style="text-align: right; font-weight: 600; color: #16a34a;">Discount ${o.coupon?.code ? `(${o.coupon.code})` : ''}</td>
            <td style="text-align: right; font-weight: 600; color: #16a34a;">-&#8377;${Number(o.discountAmount).toLocaleString('en-IN')}</td>
            <td></td>
          </tr>
          ` : ''}
          <tr class="bill-total">
            <td colspan="3">Total</td>
            <td style="text-align: right">&#8377;${Number(o.totalAmount).toLocaleString('en-IN')}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    ${o.verifyToken ? `<div class="bill-foot" style="display: flex; align-items: center; gap: 10px;">
      <b>🛡️ Verify:</b> ${window.location.origin}/verify/bill/${o.verifyToken}
    </div>` : ""}
    <div class="bill-foot">
      Serial codes box sticker pe bhi hain — user Activate page pe daal kar device apne home me add karta hai.<br />
      Factory note: har board flash + relay self-test pass karke ship hota hai. Warranty claim ke liye serial code chahiye.
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank', 'width=800,height=900');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}
import {
  demoPay,
  getMyOrders,
  initiatePayment,
  verifyPayment,
  addProductReview,
  getClaimHomes,
  claimDevice,
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
  const [reviewItem, setReviewItem] = useState<any>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);

  // Search & Pagination State
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(5);

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

  const submitReview = async () => {
    if (!reviewItem) return;
    setReviewBusy(true);
    try {
      await addProductReview(reviewItem.productId, { rating: reviewRating, comment: reviewComment });
      alert('Review submitted successfully!');
      setReviewItem(null);
      setReviewComment('');
      setReviewRating(5);
    } catch (e: any) {
      alert(e.message || 'Failed to submit review');
    } finally {
      setReviewBusy(false);
    }
  };

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

  const filteredOrders = orders.filter((o) => {
    if (filterStatus !== "all" && o.status !== filterStatus) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.shippingName.toLowerCase().includes(q) ||
        o.items.some((i: any) => i.productName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredOrders.length / perPage) || 1;
  const currentOrders = filteredOrders.slice((page - 1) * perPage, page * perPage);

  return (
    <div className="page-enter mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="page-title mb-6">My Orders</h1>

      {placed && (
        <div className="alert-success mb-6">
          ✅ Order <span className="font-bold">{placed}</span> placed! Delivery hone ke baad box pe serial code se{" "}
          <Link to="/activate" className="underline">device activate</Link> karo.
        </div>
      )}

      {failed && (
        <div className="alert-error mb-6">
          ❌ Payment failed or was cancelled. The pending order has been cancelled automatically.
        </div>
      )}

      {orders.length === 0 ? (
        <div className="card-static p-10 text-center">
          <div className="mb-2 text-4xl">🛒</div>
          <p className="text-gray-500">Koi order nahi abhi.</p>
          <Link to="/shop" className="btn-primary mt-4 inline-flex px-6 py-2.5">
            Shop kholo
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 h-4 w-4" />
              <input
                type="text"
                placeholder="Search orders..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full rounded-lg border border-brand/20 bg-night-900 py-2 pl-9 pr-4 text-sm text-gray-200 outline-none focus:border-brand/50 transition"
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex items-center">
                <Filter className="absolute left-3 text-gray-500 h-4 w-4" />
                <select
                  value={filterStatus}
                  onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
                  className="rounded-lg border border-brand/20 bg-night-900 py-2 pl-9 pr-8 text-sm text-gray-200 outline-none focus:border-brand/50 appearance-none transition"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                className="rounded-lg border border-brand/20 bg-night-900 py-2 px-3 text-sm text-gray-200 outline-none focus:border-brand/50 transition"
              >
                <option value={5}>5 / page</option>
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
              </select>
            </div>
          </div>

          <div className="space-y-5">
            {currentOrders.length === 0 && (
              <div className="text-center text-gray-500 py-10">Koi matching order nahi mila.</div>
            )}
            {currentOrders.map((o) => {
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
                    <div key={i.id} className="flex flex-col border-b border-brand/10 pb-2">
                      <div className="flex justify-between">
                        <span>
                          {i.productName} × {i.quantity}
                        </span>
                        <span>₹{(Number(i.price) * i.quantity).toLocaleString("en-IN")}</span>
                      </div>
                      <div className="flex gap-4 mt-1">
                        {o.status === "delivered" && (
                          <button onClick={() => { setReviewItem(i); setReviewRating(5); setReviewComment(''); }} className="text-left text-xs font-bold text-brand hover:underline w-fit">
                            Write a Review
                          </button>
                        )}
                        {(o.status === "shipped" || o.status === "delivered") && (
                          i.isClaimed ? (
                            <span className="text-left text-xs font-bold text-gray-400 w-fit flex items-center gap-1">
                              ✅ Activated
                            </span>
                          ) : (
                            <Link to={`/activate${i.serialCode ? `?serial=${encodeURIComponent(i.serialCode)}` : ''}`} className="text-left text-xs font-bold text-green-400 hover:underline w-fit flex items-center gap-1">
                              <KeyRound className="h-3 w-3" /> Activate Device
                            </Link>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                  {Number(o.discountAmount) > 0 && (
                    <div className="flex justify-between border-t border-brand/20 pt-2 text-sm font-semibold text-green-400">
                      <span>Discount {o.coupon?.code ? `(${o.coupon.code})` : ''}</span>
                      <span>-₹{Number(o.discountAmount).toLocaleString("en-IN")}</span>
                    </div>
                  )}
                  <div className={`flex flex-wrap items-center justify-between gap-2 ${Number(o.discountAmount) <= 0 ? 'border-t border-brand/20 pt-2' : 'pt-1'}`}>
                    <span className="font-bold text-white">Total ({o.paymentMethod.toUpperCase()})</span>
                    <span className="font-bold text-white">₹{Number(o.totalAmount).toLocaleString("en-IN")}</span>
                  </div>

                  {/* Bill / COD notice */}
                  {o.paymentMethod === "cod" ? (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm">
                      <Banknote className="h-4 w-4 shrink-0 text-amber-400" />
                      <span className="text-amber-300 font-medium">
                        Cash on Delivery — delivery par <span className="font-bold">₹{Number(o.totalAmount).toLocaleString("en-IN")}</span> cash ready rakhein.
                      </span>
                    </div>
                  ) : (o.paymentStatus === "paid" || o.status === "shipped" || o.status === "delivered") ? (
                    <div className="mt-3 flex items-center justify-between gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 shrink-0 text-green-400" />
                        <span className="text-green-300 font-medium">Payment complete — bill ready.</span>
                      </div>
                      <button
                        onClick={() => generateBill(o)}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-500 transition"
                      >
                        <FileText className="h-3.5 w-3.5" /> Download Bill
                      </button>
                    </div>
                  ) : null}
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
                    {o.status === "delivered" && !(o as any).allClaimed && (
                      <button
                        onClick={async () => {
                          try {
                            const homes = await getClaimHomes();
                            if (homes.length === 0) {
                              alert('Please create a Home in your Dashboard first.');
                              return;
                            }
                            let homeId = homes[0].id;
                            if (homes.length > 1) {
                              const choice = prompt('Which Home ID do you want to activate these devices in?\\n' + homes.map(h => `${h.id}: ${h.name}`).join('\\n'), String(homes[0].id));
                              if (!choice) return;
                              homeId = Number(choice);
                            }
                            
                            let successCount = 0;
                            for (const s of serials) {
                               try {
                                 await claimDevice(s, homeId);
                                 successCount++;
                               } catch(err: any) {
                                 if (err?.response?.data?.error?.message !== 'Already claimed') {
                                    console.error('Failed for serial', s, err);
                                 }
                               }
                            }
                            if (successCount > 0) {
                              alert('Devices activated successfully!');
                              refresh();
                            } else {
                              alert('No new devices could be activated. They may already be activated.');
                            }
                          } catch (e: any) {
                            alert(e.message || 'Failed to activate devices.');
                          }
                        }}
                        className="ml-auto rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
                      >
                        🔑 Activate Now
                      </button>
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
        
        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-brand/20 pt-4">
            <span className="text-sm text-gray-400">
              Showing {Math.min((page - 1) * perPage + 1, filteredOrders.length)} to {Math.min(page * perPage, filteredOrders.length)} of {filteredOrders.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg bg-night-800 p-2 text-gray-300 hover:bg-brand/20 hover:text-brand disabled:opacity-50 disabled:hover:bg-night-800 disabled:hover:text-gray-300 transition"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => (
                  <button
                    key={i + 1}
                    onClick={() => setPage(i + 1)}
                    className={`h-8 w-8 rounded-lg text-sm font-semibold transition ${page === i + 1 ? "bg-brand text-white" : "bg-night-800 text-gray-300 hover:bg-brand/20"}`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg bg-night-800 p-2 text-gray-300 hover:bg-brand/20 hover:text-brand disabled:opacity-50 disabled:hover:bg-night-800 disabled:hover:text-gray-300 transition"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
        </>
      )}

      {payMsg && (
        <div className="mt-6 rounded-lg border border-brand/30 bg-night-800 p-4 text-sm text-brand">
          {payMsg}
          {payMsg.startsWith("✅") && (
            <button onClick={() => setPayMsg(null)} className="ml-3 underline">close</button>
          )}
        </div>
      )}

      {reviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-xl border border-brand/20 bg-night-900 p-6">
            <h3 className="mb-2 text-xl font-bold">Rate Product</h3>
            <p className="mb-6 text-sm text-gray-500">{reviewItem.productName}</p>
            
            <div className="mb-6 flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setReviewRating(star)} className="outline-none">
                  <Star className={star <= reviewRating ? "text-amber-500 fill-amber-500" : "text-gray-600"} size={32} />
                </button>
              ))}
            </div>

            <textarea
              className="w-full rounded-lg border border-brand/20 bg-night-950 p-3 text-sm text-gray-300 focus:border-brand focus:outline-none"
              rows={4}
              placeholder="Write your experience..."
              value={reviewComment}
              onChange={(e) => setReviewComment(e.target.value)}
            />

            <div className="mt-6 flex gap-3">
              <button onClick={() => setReviewItem(null)} className="flex-1 rounded-lg bg-night-800 px-4 py-2 font-bold text-white hover:bg-night-700">Cancel</button>
              <button onClick={submitReview} disabled={reviewBusy} className="flex-1 rounded-lg bg-brand px-4 py-2 font-bold text-white disabled:opacity-50 hover:bg-brand/80">
                {reviewBusy ? "Submitting..." : "Submit"}
              </button>
            </div>
          </div>
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
