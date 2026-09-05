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
  const [serialQrs, setSerialQrs] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<"all" | "bill" | "stickers">("all");

  // Bill Verify QR
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

  // Serial Activation QRs for stickers
  useEffect(() => {
    if (!order?.items) return;
    const qrs: Record<string, string> = {};
    let alive = true;

    Promise.all(
      order.items.map(async (item) => {
        const code = item.serialCode || `SN-${order.orderNumber}-${item.id}`;
        const url = `${window.location.origin}/activate?serial=${encodeURIComponent(code)}`;
        try {
          const dataUrl = await QRCode.toDataURL(url, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 90,
            color: { dark: "#0b0b16", light: "#ffffff" },
          });
          qrs[code] = dataUrl;
        } catch {
          // ignore
        }
      })
    ).then(() => {
      if (alive) setSerialQrs(qrs);
    });

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
    <div className="print-root mx-auto max-w-4xl px-4 py-8">
      <style>{`
        .bill-toolbar { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 16px; }
        .bill-toolbar .btn {
          background: #2563eb; color: #fff; border: 0; border-radius: 8px; padding: 8px 14px;
          font-weight: 600; font-size: 13px; cursor: pointer; transition: all 0.15s;
        }
        .bill-toolbar .btn:hover { background: #1d4ed8; }
        .bill-toolbar .btn-secondary { background: #f3f4f6; border: 1px solid #d1d5db; color: #374151; }
        .bill-toolbar .btn-secondary:hover { background: #e5e7eb; }
        .bill-toolbar .btn-active { background: #1e40af; color: #fff; border-color: #1e40af; }
        
        .bill { background: #ffffff; color: #111; border-radius: 10px; padding: 28px; border: 1px solid #e5e7eb; }
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

        /* Stickers Styling */
        .stickers-wrapper { margin-top: 24px; }
        .sticker-card {
          background: #ffffff; color: #111827; border: 2px dashed #374151; border-radius: 12px;
          padding: 20px; margin-bottom: 20px; font-family: system-ui, -apple-system, sans-serif;
        }
        .sticker-header {
          display: flex; justify-content: space-between; align-items: center;
          border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 12px;
        }
        .sticker-title { font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .sticker-tag { background: #111827; color: #fff; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; }
        
        .shipping-grid { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; margin-bottom: 12px; }
        .ship-to-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; }
        .ship-to-title { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #6b7280; letter-spacing: 0.5px; margin-bottom: 4px; }
        .ship-name { font-size: 16px; font-weight: 800; color: #111827; }
        .ship-address { font-size: 13px; color: #374151; line-height: 1.4; margin-top: 4px; white-space: pre-line; }
        .ship-phone { font-size: 13px; font-weight: 700; color: #2563eb; margin-top: 6px; }

        .ship-meta-box { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; font-size: 12px; line-height: 1.5; }
        .cod-badge { display: inline-block; background: #dc2626; color: #fff; font-weight: 800; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin-top: 4px; }

        .items-mini-table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 8px; }
        .items-mini-table th { text-align: left; background: #e5e7eb; padding: 4px 8px; font-weight: 700; }
        .items-mini-table td { border-bottom: 1px solid #e5e7eb; padding: 4px 8px; }

        /* Product Box Stickers Grid */
        .product-stickers-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; margin-top: 16px; }
        .prod-sticker {
          background: #ffffff; color: #111827; border: 2px solid #2563eb; border-radius: 10px;
          padding: 14px; position: relative; overflow: hidden;
        }
        .prod-sticker-top { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        .prod-sticker-title { font-size: 14px; font-weight: 800; color: #1e40af; }
        .prod-sticker-model { font-size: 11px; font-weight: 700; background: #dbeafe; color: #1e40af; padding: 1px 6px; border-radius: 4px; display: inline-block; margin-top: 2px; }
        
        .prod-sticker-body { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 10px; }
        .serial-box { background: #0f172a; color: #38bdf8; font-family: Consolas, monospace; font-size: 15px; font-weight: 800; padding: 6px 10px; border-radius: 6px; letter-spacing: 1px; }
        .badge-strip { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
        .badge-pill { font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; color: #475569; }

        @media print {
          html { color-scheme: light; }
          body { background: #fff !important; }
          .bill-toolbar, header, nav { display: none !important; }
          .print-root { max-width: 100%; padding: 0; }
          .bill, .sticker-card, .prod-sticker { box-shadow: none; }
          .page-break { page-break-before: always; break-before: page; margin-top: 0; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      {/* Control Toolbar */}
      <div className="bill-toolbar">
        <button className="btn" onClick={() => window.print()}>🖨️ Print Now</button>
        <button
          className={`btn btn-secondary ${viewMode === "all" ? "btn-active" : ""}`}
          onClick={() => setViewMode("all")}
        >
          📄 Bill + 🏷️ Stickers
        </button>
        <button
          className={`btn btn-secondary ${viewMode === "bill" ? "btn-active" : ""}`}
          onClick={() => setViewMode("bill")}
        >
          📄 Bill Only
        </button>
        <button
          className={`btn btn-secondary ${viewMode === "stickers" ? "btn-active" : ""}`}
          onClick={() => setViewMode("stickers")}
        >
          🏷️ Stickers Only
        </button>
        <button className="btn btn-secondary" onClick={() => window.close()}>✕ Close</button>
        <button className="btn btn-secondary" onClick={() => navigate("/admin")}>← Admin</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
          {loading ? "Loading…" : order ? `Order #${order.orderNumber}` : ""}
        </span>
      </div>

      {error && <div style={{ color: "#dc2626", marginBottom: 12, fontWeight: 600 }}>{error}</div>}
      {loading && <div style={{ color: "#9ca3af" }}>Order load ho raha hai…</div>}

      {order && (
        <div>
          {/* SECTION 1: BILL INVOICE */}
          {(viewMode === "all" || viewMode === "bill") && (
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
                    {Number(order.discountAmount) > 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: "right", color: "#16a34a", fontWeight: 600 }}>
                          Discount {(order as any).coupon?.code ? `(${(order as any).coupon.code})` : ''}
                        </td>
                        <td style={{ textAlign: "right", color: "#16a34a", fontWeight: 600 }}>
                          -{money(order.discountAmount ?? 0)}
                        </td>
                        <td />
                      </tr>
                    )}
                    <tr className="bill-total">
                      <td colSpan={3}>Total</td>
                      <td style={{ textAlign: "right" }}>{money(order.totalAmount)}</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </div>

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

          {/* SECTION 2: PRINTABLE STICKERS (SHIPPING & PRODUCT SERIAL STICKERS) */}
          {(viewMode === "all" || viewMode === "stickers") && (
            <div className={`stickers-wrapper ${viewMode === "all" ? "page-break" : ""}`}>
              {/* Shipping Label Sticker */}
              <div className="sticker-card">
                <div className="sticker-header">
                  <div>
                    <div className="sticker-title">🚀 SwitchNest Express Logistics</div>
                    <div style={{ fontSize: 11, color: "#4b5563" }}>Package Shipping &amp; Delivery Label</div>
                  </div>
                  <div className="sticker-tag">ORDER #{order.orderNumber}</div>
                </div>

                <div className="shipping-grid">
                  <div className="ship-to-box">
                    <div className="ship-to-title">Deliver To:</div>
                    <div className="ship-name">{order.shippingName}</div>
                    <div className="ship-phone">📞 {order.shippingPhone}</div>
                    <div className="ship-address">{order.shippingAddress}</div>
                  </div>

                  <div className="ship-meta-box">
                    <div><b>Date:</b> {fmtDate(order.createdAt)}</div>
                    <div><b>Payment:</b> {order.paymentMethod.toUpperCase()} ({order.paymentStatus})</div>
                    {order.paymentMethod === "cod" && order.paymentStatus !== "paid" && (
                      <div className="cod-badge">
                        ⚠️ CASH ON DELIVERY: {money(order.totalAmount)}
                      </div>
                    )}
                    {verifyQr && (
                      <div style={{ marginTop: 8, textAlign: "center" }}>
                        <img src={verifyQr} alt="Order QR" style={{ width: 70, height: 70, margin: "0 auto" }} />
                        <div style={{ fontSize: 9, color: "#6b7280", marginTop: 2 }}>Scan to Track / Verify</div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 4 }}>
                    Package Contents ({totalQty} Item{totalQty > 1 ? "s" : ""}):
                  </div>
                  <table className="items-mini-table">
                    <thead>
                      <tr>
                        <th>Product Item</th>
                        <th style={{ width: 60, textAlign: "center" }}>Qty</th>
                        <th>Serial Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((i) => (
                        <tr key={i.id}>
                          <td style={{ fontWeight: 600 }}>{i.productName}</td>
                          <td style={{ textAlign: "center" }}>{i.quantity}</td>
                          <td style={{ fontFamily: "Consolas, monospace", fontWeight: 700 }}>{i.serialCode ?? "SN-GENUINE"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px dashed #9ca3af", fontSize: 10, color: "#6b7280", display: "flex", justifyContent: "space-between" }}>
                  <div><b>From:</b> SwitchNest Smart Home Hardware Lab, India</div>
                  <div>Support: support@switchnest.com</div>
                </div>
              </div>

              {/* Product Box Serial Stickers */}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#374151", marginBottom: 8 }}>
                  🏷️ Product Box Serial Stickers (Attach on Hardware Boxes):
                </div>

                <div className="product-stickers-grid">
                  {order.items.map((item) => {
                    const code = item.serialCode || `SN-${order.orderNumber}-${item.id}`;
                    const qrUrl = serialQrs[code];
                    return (
                      <div key={item.id} className="prod-sticker">
                        <div className="prod-sticker-top">
                          <div>
                            <div className="prod-sticker-title">🚀 SwitchNest</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginTop: 2 }}>
                              {item.productName}
                            </div>
                            <span className="prod-sticker-model">
                              Model: {(item as any).modelCode || "IoT Relay Board"}
                            </span>
                          </div>
                        </div>

                        <div className="prod-sticker-body">
                          <div>
                            <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: "#64748b", marginBottom: 2 }}>
                              SERIAL NUMBER / ACTIVATION CODE
                            </div>
                            <div className="serial-box">{code}</div>

                            <div className="badge-strip">
                              <span className="badge-pill" style={{ background: "#dcfce7", color: "#166534", borderColor: "#86efac" }}>
                                ✅ FACTORY TESTED
                              </span>
                              <span className="badge-pill">🛡️ 1 YR WARRANTY</span>
                              <span className="badge-pill">🇮🇳 MADE IN INDIA</span>
                            </div>

                            {order.wifiSsid && (
                              <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, marginTop: 4 }}>
                                📶 WiFi: {order.wifiSsid}
                              </div>
                            )}
                          </div>

                          {qrUrl && (
                            <div style={{ textAlign: "center", flexShrink: 0 }}>
                              <img src={qrUrl} alt="Activation QR" style={{ width: 75, height: 75 }} />
                              <div style={{ fontSize: 8, textAlign: "center", color: "#64748b", fontWeight: 700, marginTop: 2 }}>
                                Scan to Activate
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
