import { useState } from "react";
import { Eye, EyeOff, ShoppingBag, ArrowRight, Wifi, Tag, Check, CreditCard, ShieldCheck } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  createOrder,
  initiatePayment,
  demoPay,
  cancelOrder,
  validateCoupon,
  type PayIntent,
} from "../api/shop";
import { useCartStore } from "../stores/cart";
import { useAuthStore } from "../stores/auth";
import { useSiteStore } from "../stores/site";
import { openRazorpayCheckout } from "../lib/razorpay";
import { Input } from "../components/ui/Input";
import { Textarea } from "../components/ui/Textarea";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { EmptyState } from "../components/ui/EmptyState";
import { Modal } from "../components/ui/Modal";

export function Checkout() {
  const navigate = useNavigate();
  const items = useCartStore((s) => s.items);
  const clear = useCartStore((s) => s.clear);
  const total = useCartStore((s) => s.total());

  const user = useAuthStore((s) => s.user);
  const supportEmail = useSiteStore((s) => s.settings.supportEmail);

  const [name, setName] = useState(user?.username ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
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
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    type: "percentage" | "fixed";
    value: number;
    max: number | null;
    min: number | null;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  let discount = 0;
  if (appliedCoupon) {
    if (appliedCoupon.min && total < appliedCoupon.min) {
      // Too small, ignore
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
        setCouponError(`Minimum order amount for this coupon is ₹${c.minOrderAmount}`);
        return;
      }
      setAppliedCoupon({
        code: c.code,
        type: c.discountType,
        value: c.discountValue,
        max: c.maxDiscount,
        min: c.minOrderAmount,
      });
    } catch (err: any) {
      setCouponError(err?.response?.data?.error?.message ?? err?.message ?? "Invalid coupon code");
    }
  }

  async function handleCancelDemoPay(orderId: number) {
    setSubmitting(true);
    try {
      await cancelOrder(orderId);
      setError("Payment cancelled. Order was not completed.");
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
          await openRazorpayCheckout({
            intent,
            orderId: order.id,
            prefill: {
              name: name || user?.username || "SwitchNest Customer",
              email: user?.email || supportEmail || "",
              contact: phone || user?.phone || "",
            },
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
        const msg = err?.response?.data?.error?.message ?? err?.message ?? "Failed to place order. Please try again.";
        setError(msg);
        setSubmitting(false);
      }
    }
  }

  if (!items.length) {
    return (
      <div className="page-enter mx-auto max-w-2xl px-4 py-16 text-center">
        <EmptyState
          icon={<ShoppingBag className="h-10 w-10 text-slate-400" />}
          title="Your Cart is Empty"
          description="Add hardware switches or relay boards from the shop before proceeding to checkout."
          action={
            <Link to="/shop">
              <Button variant="primary" rightIcon={<ArrowRight className="h-4 w-4" />}>
                Browse Hardware Store
              </Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="page-enter mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
          Order Checkout
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Review your items, shipping destination, and select payment method.
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <Alert variant="danger" onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Items Summary Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Items in Order ({items.length})
          </h2>
          <div className="space-y-3">
            {items.map((i) => (
              <div key={i.productId} className="flex items-center justify-between text-sm py-1 border-b border-slate-100 dark:border-slate-800 last:border-0">
                <div>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{i.name}</span>
                  <span className="text-xs text-slate-400 ml-2">× {i.quantity}</span>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  ₹{(i.price * i.quantity).toLocaleString("en-IN")}
                </span>
              </div>
            ))}

            {discount > 0 && (
              <div className="flex justify-between pt-3 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Discount ({appliedCoupon?.code})</span>
                <span>-₹{discount.toLocaleString("en-IN")}</span>
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-3 text-base font-bold text-slate-900 dark:text-white">
              <span>Grand Total</span>
              <span>₹{finalTotal.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Coupons Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Have a Promo Code?</h2>
          </div>
          <div className="flex gap-2.5">
            <Input
              value={couponCodeInput}
              onChange={(e) => setCouponCodeInput(e.target.value.toUpperCase())}
              placeholder="e.g. FESTIVE10"
              className="font-mono uppercase flex-1"
            />
            <Button type="button" variant="secondary" onClick={handleApplyCoupon}>
              Apply Code
            </Button>
          </div>
          {couponError && <p className="mt-2 text-xs text-rose-500 font-medium">{couponError}</p>}
          {appliedCoupon && !couponError && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
              <Check className="h-3.5 w-3.5" /> Coupon '{appliedCoupon.code}' applied successfully!
            </p>
          )}
        </div>

        {/* Shipping Details Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Shipping Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Recipient Name *"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Full name"
            />
            <Input
              label="Mobile Number *"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              placeholder="+91 98765 43210"
            />
          </div>
          <Textarea
            label="Complete Delivery Address *"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            rows={2}
            placeholder="Flat / House No., Street, Landmark, City, State, PIN"
          />
        </div>

        {/* WiFi Provisioning Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <label className="flex items-start justify-between gap-4 cursor-pointer">
            <div>
              <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-white">
                <Wifi className="h-4 w-4 text-brand" />
                <span>Pre-configure Home WiFi</span>
                <Badge variant="neutral" size="sm">Optional</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                We will flash your credentials directly into the board before dispatch so it connects immediately out-of-the-box.
              </p>
            </div>
            <input
              type="checkbox"
              checked={wifiEnabled}
              onChange={(e) => setWifiEnabled(e.target.checked)}
              className="h-5 w-5 rounded text-brand focus:ring-brand accent-brand mt-0.5"
            />
          </label>

          {wifiEnabled && (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 pt-4 border-t border-slate-100 dark:border-slate-800">
              <Input
                label="Home WiFi Name (SSID) *"
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="e.g. Airtel_5G or Home_WiFi"
              />
              <div className="relative">
                <Input
                  label="WiFi Password"
                  type={showPass ? "text" : "password"}
                  value={wifiPass}
                  onChange={(e) => setWifiPass(e.target.value)}
                  placeholder="Enter WiFi password"
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-8 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  tabIndex={-1}
                  title={showPass ? "Hide password" : "Show password"}
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Payment Method Card */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-base font-bold text-slate-900 dark:text-white mb-4">
            Payment Option
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                paymentMethod === "cod"
                  ? "border-brand bg-brand/5 dark:bg-brand/10"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
              }`}
            >
              <input
                type="radio"
                checked={paymentMethod === "cod"}
                onChange={() => setPaymentMethod("cod")}
                className="accent-brand mt-0.5"
              />
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-white">
                  Cash on Delivery (COD)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Pay with cash or UPI upon courier arrival
                </div>
              </div>
            </label>

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${
                paymentMethod === "upi"
                  ? "border-brand bg-brand/5 dark:bg-brand/10"
                  : "border-slate-200 hover:border-slate-300 dark:border-slate-800"
              }`}
            >
              <input
                type="radio"
                checked={paymentMethod === "upi"}
                onChange={() => setPaymentMethod("upi")}
                className="accent-brand mt-0.5"
              />
              <div>
                <div className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-brand" />
                  <span>Instant UPI / NetBanking</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Razorpay secured checkout with instant confirmation
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Place Order Button */}
        <Button
          type="submit"
          variant="primary"
          size="lg"
          disabled={submitting}
          loading={submitting}
          className="w-full"
          leftIcon={<ShieldCheck className="h-5 w-5" />}
        >
          {submitting ? "Placing Order..." : `Place Order · ₹${finalTotal.toLocaleString("en-IN")}`}
        </Button>
      </form>

      {/* Demo Pay Modal */}
      {payIntent && payingFor && (
        <Modal title="Complete Demo Payment" onClose={() => handleCancelDemoPay(payingFor)}>
          <div className="space-y-4">
            <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 dark:bg-brand/10">
              <div className="flex justify-between items-center text-sm font-semibold mb-2">
                <span className="text-slate-600 dark:text-slate-300">Amount Due:</span>
                <span className="text-base text-brand font-bold">₹{payIntent.amount.toLocaleString("en-IN")}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                This environment is operating in demo mode. You can simulate the UPI verification:
              </p>
              <div className="rounded-lg bg-slate-100 p-2.5 font-mono text-xs text-brand break-all dark:bg-slate-800">
                {payIntent.upiIntent}
              </div>
            </div>

            <Button
              onClick={() => handleConfirmDemoPay(payingFor)}
              disabled={submitting}
              loading={submitting}
              variant="primary"
              className="w-full"
            >
              Simulate UPI Payment Verification
            </Button>

            <Button
              variant="ghost"
              onClick={() => handleCancelDemoPay(payingFor)}
              className="w-full text-xs text-slate-400"
            >
              Cancel Order
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
