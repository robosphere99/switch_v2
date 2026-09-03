import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import QRCode from "qrcode";
import { getAdminOrder, type Order } from "../api/shop";
import { useAuthStore } from "../stores/auth";

const STATUS_BADGE: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-600",
  paid: "bg-blue-500/20 text-blue-700",
  shipped: "bg-purple-500/20 text-purple-300",
  delivered: "bg-green-500/20 text-green-700",
  cancelled: "bg-red-500/20 text-red-600",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function money(n: string | number): string {
  return "₹" + Number(n).toLocaleString("en-IN");
}

export function PrintBill() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifyQr, setVerifyQr] = useState<string | null>(null);

  // Bill QR — scan karne pe public verify page khulta hai (genuineness + factory tested).
  useEffect(() => {
    if (!order?.verifyToken) {
      setVerifyQr(null);
      return;
    }
    const url = `${window.location.origin}/verify/bill/${order.verifyToken}`;
    let alive = true;
    QRCode.toDataURL(url, { errorCorrectionLevel: "M", margin: 1, width: 130, color: { dark: "#0b0b16", light: "#ffffff" } })
      .then((u) => alive && setVerifyQr(u))
      .catch(() => alive && setVerifyQr(null));
    return () => {
      alive = false;
    };
  }, [order]);

  useEffect(() => {
    if (user?.role !== "system_admin") {
      navigate("/dashboard", { replace: true });
      return;
    }
    const id = Number(orderId);
    if (!id) {
      setError("Order ID missing");
      setLoading(false);
      return;
    }
    getAdminOrder(id)
      .then(setOrder)
      .catch(() => setError("Order load nahi hua — order exist karta hai? (sirf verified-payment orders)"))
      .finally(() => setLoading(false));
  }, [user, navigate, orderId]);

  const totalQty = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

  return (
    <div className="print-root mx-auto max-w-3xl px-4 py-8">
      <style>{`
        .bill-toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; }
        .bill-toolbar .btn {
          background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px;
          font-weight: 600; cursor: pointer;
        }
        .bill-toolbar .btn-secondary { background: transparent; border: 1px solid #2563eb; color: #2563eb; }
        .bill { background: #ffffff; color: #111; border-radius: 10px; padding: 28px; }
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
        .bill-verify { display: flex; align-items: center; gap: 14px; margin-top: 14px; border: 1px solid #16a34a; background: #f0fdf4; border-radius: 8px; padding: 10px 14px; }
        .bill-verify img { width: 84px; height: 84px; }
        .bill-verify .bvt { font-size: 12px; color: #14532d; }
        .bill-verify .bvt b { font-size: 13px; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
        @media print {
          html { color-scheme: light; }
          body { background: #fff !important; }
          .bill-toolbar, header, nav { display: none !important; }
          .print-root { max-width: 100%; padding: 0; }
          .bill { box-shadow: none; border-radius: 0; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="bill-toolbar">
        <button className="btn" onClick={() => window.print()}>🖨️ Print Bill</button>
        <button className="btn btn-secondary" onClick={() => window.close()}>✕ Close</button>
        <button className="btn btn-secondary" onClick={() => navigate("/admin")}>← Admin</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>
          {loading ? "Loading…" : order ? `Bill #${order.orderNumber}` : ""}
        </span>
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: 12 }}>{error}</div>}
      {loading && <div style={{ color: "#9ca3af" }}>Order load ho raha hai…</div>}

      {order && (
        <div className="bill">
          <div className="bill-header">
            <div>
              <div className="bill-brand">🚀 SwitchNest</div>
              <div className="bill-title">Invoice / Bill of Sale — IoT Relay Boards</div>
            </div>
            <div className="bill-meta">
              <div>
                Bill No: <b>#{order.orderNumber}</b>
              </div>
              <div>Date: {fmtDate(order.createdAt)}</div>
              <div>
                Status:{" "}
                <span className={`badge ${STATUS_BADGE[order.status] ?? ""}`}>{order.status}</span>
              </div>
              <div style={{ color: "#16a34a", fontWeight: 700, fontSize: 11, marginTop: 4 }}>🛡️ Genuine · Factory tested</div>
            </div>
          </div>

          <div className="bill-grid">
            <div className="bill-section">
              <div className="bill-label">Billed To</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                <b>{order.shippingName}</b>
                <br />
                {order.shippingPhone}
                <br />
                {order.shippingAddress}
              </div>
              {order.user && (
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                  {order.user.username} · {order.user.email}
                </div>
              )}
            </div>
            <div className="bill-section">
              <div className="bill-label">Payment</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>
                Method: <b>{order.paymentMethod.toUpperCase()}</b>
                <br />
                Status: {order.paymentStatus}
                <br />
                Paid at: {fmtDate(order.paidAt)}
                <br />
                {order.paymentRef && (
                  <>
                    Ref: <span className="bill-serial">{order.paymentRef}</span>
                  </>
                )}
              </div>
              {order.wifiSsid && (
                <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
                  📶 WiFi (factory): {order.wifiSsid}
                </div>
              )}
            </div>
          </div>

          <div className="bill-section">
            <div className="bill-label">Items ({totalQty} board{totalQty === 1 ? "" : "s"})</div>
            <table className="bill-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th style={{ textAlign: "right" }}>Qty</th>
                  <th style={{ textAlign: "right" }}>Unit</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Serial(s)</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.productName}</td>
                    <td style={{ textAlign: "right" }}>{i.quantity}</td>
                    <td style={{ textAlign: "right" }}>{money(i.price)}</td>
                    <td style={{ textAlign: "right" }}>{money(Number(i.price) * i.quantity)}</td>
                    <td className="bill-serial">{i.serialCode ?? "—"}</td>
                  </tr>
                ))}
                <tr className="bill-total">
                  <td colSpan={3}>Total</td>
                  <td style={{ textAlign: "right" }}>{money(order.totalAmount)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>

          {/* Verify QR — scan karne pe site khul kar bill + genuineness + factory test dikhata hai */}
          {verifyQr ? (
            <div className="bill-verify">
              <img src={verifyQr} alt="Verify bill QR" />
              <div className="bvt">
                <b>✅ Scan to verify this bill</b>
                <br />
                QR scan karo → SwitchNest site khulega — bill genuine hai, kis order ka hai, saare serial factory tested hain ya nahi — sab verify hoga.
                <br />
                <span style={{ fontFamily: "Consolas, monospace", fontSize: 10, opacity: 0.75 }}>
                  {window.location.origin}/verify/bill/{order.verifyToken}
                </span>
              </div>
            </div>
          ) : (
            <div className="bill-foot">
              <b>🛡️ Verify:</b> {window.location.origin}/verify/bill/{order.verifyToken ?? "—"}
            </div>
          )}

          <div className="bill-foot">
            Serial codes box sticker pe bhi hain — user Activate page pe daal kar device apne home me add karta hai.
            <br />
            Factory note: har board flash + relay self-test pass karke ship hota hai. Warranty claim ke liye serial code chahiye.
          </div>
        </div>
      )}
    </div>
  );
}
