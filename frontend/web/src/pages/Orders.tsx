import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  demoPay,
  getMyOrders,
  initiatePayment,
  addProductReview,
  getClaimHomes,
  claimDevice,
  type Order,
  type PayIntent,
} from "../api/shop";
import { useAuthStore } from "../stores/auth";
import { useSiteStore } from "../stores/site";
import { openRazorpayCheckout } from "../lib/razorpay";
import QRCode from "qrcode";
import { OrderCard } from "../components/orders/OrderCard";
import { OrderReviewModal } from "../components/orders/OrderReviewModal";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Skeleton } from "../components/ui/Skeleton";
import { Modal } from "../components/ui/Modal";
import { Search, ChevronLeft, ChevronRight, ShoppingBag } from "lucide-react";

async function generateBill(o: any) {
  let qrCodeHtml = "";
  if (o.verifyToken) {
    try {
      const url = `${window.location.origin}/verify/bill/${o.verifyToken}`;
      const dataUrl = await QRCode.toDataURL(url, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 90,
        color: { dark: "#0b0b16", light: "#ffffff" },
      });
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
        <div class="bill-brand">SwitchNest</div>
        <div class="bill-title">Invoice / Bill of Sale — IoT Hardware Controllers</div>
      </div>
      <div class="bill-meta">
        ${qrCodeHtml}
        <div>Invoice No: <b>#${o.orderNumber}</b></div>
        <div>Date: ${new Date(o.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
        <div>Status: <span class="badge ${o.paymentMethod === 'cod' ? 'badge-cod' : 'badge-paid'}">${o.status}</span></div>
        <div style="color: #16a34a; font-weight: 700; font-size: 11px; margin-top: 4px;">Genuine · Factory Tested</div>
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
        <div class="bill-label">Payment Details</div>
        <div style="font-size: 13px; line-height: 1.6">
          Method: <b>${o.paymentMethod.toUpperCase()}</b><br />
          Status: ${o.paymentStatus}<br />
          ${o.paidAt ? `Paid At: ${new Date(o.paidAt).toLocaleString("en-IN")}<br />` : ""}
          ${o.paymentRef ? `Ref: <span class="bill-serial">${o.paymentRef}</span>` : ""}
        </div>
        ${o.wifiSsid ? `<div style="font-size: 11px; color: #666; margin-top: 4px;">Pre-configured WiFi: ${o.wifiSsid}</div>` : ""}
      </div>
    </div>

    <div class="bill-section">
      <div class="bill-label">Order Items</div>
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
      <b>Verify Authenticity:</b> ${window.location.origin}/verify/bill/${o.verifyToken}
    </div>` : ""}
    <div class="bill-foot">
      Serial codes are stamped on hardware stickers. Warranty registration is verifiable through the SwitchNest app.
    </div>
  </div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=800,height=900");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

export function Orders() {
  const user = useAuthStore((s) => s.user);
  const supportEmail = useSiteStore((s) => s.settings.supportEmail);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const placed = params.get("placed");
  const failed = params.get("failed");
  const [payIntent, setPayIntent] = useState<PayIntent | null>(null);
  const [payingFor, setPayingFor] = useState<number | null>(null);
  const [payBusy, setPayBusy] = useState(false);
  const [payMsg, setPayMsg] = useState<string | null>(null);
  const [reviewItem, setReviewItem] = useState<any>(null);
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

    const interval = setInterval(() => {
      getMyOrders().then(setOrders);
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  const submitReview = async (rating: number, comment: string) => {
    if (!reviewItem) return;
    setReviewBusy(true);
    try {
      await addProductReview(reviewItem.productId, { rating, comment });
      alert("Review submitted successfully!");
      setReviewItem(null);
    } catch (e: any) {
      alert(e.message || "Failed to submit review");
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
        await openRazorpayCheckout({
          intent,
          orderId,
          prefill: {
            name: user?.username || "SwitchNest User",
            email: user?.email || supportEmail || "",
            contact: user?.phone || "",
          },
        });
        setPayMsg("Payment verified successfully!");
        await refresh();
      }
    } catch (err: any) {
      if (err?.message === "PAYMENT_CLOSED") {
        setPayMsg("Payment window closed.");
      } else {
        setPayMsg(err?.response?.data?.error?.message ?? err?.message ?? String(err));
      }
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
      setPayMsg(`Payment confirmed (${r.paymentRef})`);
      await refresh();
    } catch (e: any) {
      setPayMsg(e?.message || "Demo payment confirmation failed");
    } finally {
      setPayBusy(false);
    }
  };

  const handleActivateNow = async (_order: Order, serials: string[]) => {
    try {
      const homes = await getClaimHomes();
      if (homes.length === 0) {
        alert("Please create a home in your Dashboard first.");
        return;
      }
      let homeId = homes[0].id;
      if (homes.length > 1) {
        const choice = prompt(
          "Which Home ID do you want to activate these devices in?\n" +
            homes.map((h) => `${h.id}: ${h.name}`).join("\n"),
          String(homes[0].id)
        );
        if (!choice) return;
        homeId = Number(choice);
      }

      let successCount = 0;
      for (const s of serials) {
        try {
          await claimDevice(s, homeId);
          successCount++;
        } catch (err: any) {
          if (err?.response?.data?.error?.message !== "Already claimed") {
            console.error("Failed for serial", s, err);
          }
        }
      }
      if (successCount > 0) {
        alert("Devices activated successfully!");
        refresh();
      } else {
        alert("Devices are already activated.");
      }
    } catch (e: any) {
      alert(e.message || "Failed to activate devices.");
    }
  };

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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Order History
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Track packages, download tax bills, and activate delivered devices.
        </p>
      </div>

      {placed && (
        <div className="mb-6">
          <Alert variant="success">
            Order <b>#{placed}</b> successfully placed! When your package arrives, activate the device with the serial sticker on the box.
          </Alert>
        </div>
      )}

      {failed && (
        <div className="mb-6">
          <Alert variant="danger">
            Payment was cancelled or interrupted. The pending order has been safely cancelled.
          </Alert>
        </div>
      )}

      {payMsg && (
        <div className="mb-6">
          <Alert variant={payMsg.startsWith("Payment failed") ? "danger" : "success"} onClose={() => setPayMsg(null)}>
            {payMsg}
          </Alert>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 space-y-3">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-8 w-8 text-slate-400" />}
          title="No Orders Found"
          description="You haven't placed any hardware orders yet."
          action={
            <Link to="/shop">
              <Button variant="primary">Visit Hardware Store</Button>
            </Link>
          }
        />
      ) : (
        <>
          {/* Filter and Search Bar */}
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Input
                placeholder="Search by order #, product name, or recipient..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                leftIcon={<Search className="h-4 w-4 text-slate-400" />}
              />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-36">
                <Select
                  value={filterStatus}
                  onChange={(e) => {
                    setFilterStatus(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </Select>
              </div>

              <div className="w-28">
                <Select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={5}>5 / page</option>
                  <option value={10}>10 / page</option>
                  <option value={20}>20 / page</option>
                </Select>
              </div>
            </div>
          </div>

          {/* Orders List */}
          <div className="space-y-4">
            {currentOrders.length === 0 && (
              <p className="text-center text-sm text-slate-400 py-10">No orders match your filter.</p>
            )}
            {currentOrders.map((o) => (
              <OrderCard
                key={o.id}
                order={o}
                onPayNow={openPay}
                payBusy={payBusy}
                onOpenReview={(item) => setReviewItem(item)}
                onGenerateBill={generateBill}
                onActivateNow={handleActivateNow}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex items-center justify-between border-t border-slate-200/80 pt-4 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Showing {Math.min((page - 1) * perPage + 1, filteredOrders.length)} to{" "}
                {Math.min(page * perPage, filteredOrders.length)} of {filteredOrders.length}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  leftIcon={<ChevronLeft className="h-4 w-4" />}
                >
                  Previous
                </Button>
                <span className="text-xs font-semibold px-2 text-slate-700 dark:text-slate-300">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  rightIcon={<ChevronRight className="h-4 w-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Review Modal */}
      <OrderReviewModal
        item={reviewItem}
        onClose={() => setReviewItem(null)}
        onSubmit={submitReview}
        isSubmitting={reviewBusy}
      />

      {/* Demo Pay Modal */}
      {payIntent && payingFor && (
        <Modal title="Complete UPI Payment" onClose={() => setPayIntent(null)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 dark:bg-brand/10">
              <p className="text-xs text-slate-500 mb-2">Simulate UPI intent transaction:</p>
              <code className="block rounded-lg bg-slate-100 dark:bg-slate-800 p-2.5 font-mono text-xs text-brand break-all">
                {payIntent.upiIntent}
              </code>
            </div>
            <Button
              onClick={() => confirmDemoPay(payingFor)}
              disabled={payBusy}
              loading={payBusy}
              variant="primary"
              className="w-full"
            >
              Simulate Verified Payment
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPayIntent(null)}
              className="w-full text-slate-400"
            >
              Cancel
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
