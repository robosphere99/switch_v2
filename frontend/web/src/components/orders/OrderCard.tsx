import { useState } from "react";
import { Link } from "react-router-dom";
import type { Order } from "../../api/shop";
import { CopyText } from "../CopyText";
import { OrderStatusBadge } from "./OrderStatusBadge";
import { Button } from "../ui/Button";
import { ChevronDown, ChevronUp, CreditCard, FileText, KeyRound, Banknote, Truck } from "lucide-react";

export interface OrderCardProps {
  order: Order;
  onPayNow: (orderId: number) => void;
  payBusy: boolean;
  onOpenReview: (item: any) => void;
  onGenerateBill: (order: Order) => void;
  onActivateNow: (order: Order, serials: string[]) => void;
}

const STEPS = ["placed", "paid", "shipped", "delivered"] as const;

const STEP_LABEL: Record<string, string> = {
  placed: "Order Placed",
  paid: "Payment Confirmed",
  shipped: "Dispatched",
  delivered: "Delivered",
};

export function OrderCard({
  order: o,
  onPayNow,
  payBusy,
  onOpenReview,
  onGenerateBill,
  onActivateNow,
}: OrderCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const serials = o.items.flatMap((i) => (i.serialCode ? [i.serialCode] : []));
  const activeIdx = STEPS.indexOf(o.status as (typeof STEPS)[number]);

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 transition-all hover:shadow-md">
      {/* Top Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <CopyText text={o.orderNumber} className="text-base font-bold text-slate-900 dark:text-white" title="Click to copy order #">
              #{o.orderNumber}
            </CopyText>
            <OrderStatusBadge status={o.status} />
          </div>
          <span className="text-xs text-slate-400 mt-0.5 block">
            {new Date(o.createdAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {o.status === "pending" && o.paymentMethod !== "cod" && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onPayNow(o.id)}
              disabled={payBusy}
              leftIcon={<CreditCard className="h-3.5 w-3.5" />}
            >
              Pay Now
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailsOpen(!detailsOpen)}
            rightIcon={detailsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          >
            {detailsOpen ? "Hide Details" : "Details"}
          </Button>
        </div>
      </div>

      {/* Items in this Order */}
      <div className="space-y-3">
        {o.items.map((i) => (
          <div key={i.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
            <div>
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                {i.productName}
              </span>
              <span className="text-xs text-slate-400 ml-2">× {i.quantity}</span>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                ₹{(Number(i.price) * i.quantity).toLocaleString("en-IN")}
              </span>

              {o.status === "delivered" && (
                <button
                  type="button"
                  onClick={() => onOpenReview(i)}
                  className="text-xs font-semibold text-brand hover:underline"
                >
                  Write Review
                </button>
              )}

              {(o.status === "shipped" || o.status === "delivered") && (
                i.isClaimed ? (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    ✓ Activated
                  </span>
                ) : (
                  <Link
                    to={`/activate${i.serialCode ? `?serial=${encodeURIComponent(i.serialCode)}` : ""}`}
                    className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                  >
                    <KeyRound className="h-3 w-3" /> Activate
                  </Link>
                )
              )}
            </div>
          </div>
        ))}

        {Number(o.discountAmount) > 0 && (
          <div className="flex justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 pt-1">
            <span>Discount {o.coupon?.code ? `(${o.coupon.code})` : ""}</span>
            <span>-₹{Number(o.discountAmount).toLocaleString("en-IN")}</span>
          </div>
        )}

        <div className="flex justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-sm font-bold text-slate-900 dark:text-white">
          <span>Total ({o.paymentMethod.toUpperCase()})</span>
          <span>₹{Number(o.totalAmount).toLocaleString("en-IN")}</span>
        </div>

        {/* Notices */}
        {o.paymentMethod === "cod" ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
            <Banknote className="h-4 w-4 shrink-0 text-amber-600" />
            <span>Cash on Delivery: Please keep <b>₹{Number(o.totalAmount).toLocaleString("en-IN")}</b> cash ready on delivery.</span>
          </div>
        ) : (o.paymentStatus === "paid" || o.status === "shipped" || o.status === "delivered") ? (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-xs text-emerald-800 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Payment complete · Official tax bill ready.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onGenerateBill(o)}
              leftIcon={<FileText className="h-3.5 w-3.5" />}
            >
              Invoice
            </Button>
          </div>
        ) : null}
      </div>

      {/* Serials & Direct Activation */}
      {serials.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Serials:</span>
          {serials.map((s) => (
            <CopyText key={s} text={s} className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-1 font-mono text-xs text-brand font-semibold" title="Copy serial">
              {s}
            </CopyText>
          ))}

          {o.status === "delivered" && !(o as any).allClaimed && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onActivateNow(o, serials)}
              className="ml-auto"
              leftIcon={<KeyRound className="h-3.5 w-3.5" />}
            >
              Activate Now
            </Button>
          )}
        </div>
      )}

      {/* Expandable Order Details Panel */}
      {detailsOpen && (
        <div className="mt-5 space-y-4 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/50">
          {/* Status Timeline */}
          <div className="flex flex-wrap items-center gap-2">
            {STEPS.map((s, i) => {
              const done = activeIdx >= 0 && i <= activeIdx;
              return (
                <div key={s} className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      done
                        ? "bg-brand/10 text-brand dark:bg-brand/20"
                        : "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {STEP_LABEL[s]}
                  </span>
                  {i < STEPS.length - 1 && <span className="text-slate-300 dark:text-slate-700">→</span>}
                </div>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div>
              <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                Payment Info
              </p>
              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                <div>Method: <b className="text-slate-900 dark:text-white">{o.paymentMethod.toUpperCase()}</b></div>
                <div>Status: {o.paymentStatus}</div>
                <div>Paid At: {o.paidAt ? new Date(o.paidAt).toLocaleString("en-IN") : "—"}</div>
                {o.paymentRef && (
                  <div className="break-all">Reference: <span className="font-mono text-brand font-semibold">{o.paymentRef}</span></div>
                )}
              </div>
            </div>

            <div>
              <p className="font-bold uppercase tracking-wider text-[10px] text-slate-400 mb-1">
                Shipping Destination
              </p>
              <div className="space-y-1 text-slate-600 dark:text-slate-300">
                <div><b className="text-slate-900 dark:text-white">{o.shippingName}</b> · {o.shippingPhone}</div>
                <div>{o.shippingAddress}</div>
                {o.wifiSsid && <div>Pre-configured WiFi: <b>{o.wifiSsid}</b></div>}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white mb-1">
              <Truck className="h-4 w-4 text-brand" />
              <span>Courier Delivery</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400">
              Orders are packaged with tamper-proof seal and tracked. Factory self-test report is attached with each unit.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
