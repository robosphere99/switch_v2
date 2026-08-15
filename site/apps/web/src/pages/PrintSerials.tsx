import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getAdminProducts, getSerials, type Product, type SerialRow } from "../api/shop";
import { useAuthStore } from "../stores/auth";

const STATUSES = ["available", "reserved", "shipped", "delivered", "claimed"] as const;

function Sticker({ row, productName, origin }: { row: SerialRow; productName: string; origin: string }) {
  const [qr, setQr] = useState<string | null>(null);
  const activateUrl = `${origin}/activate?serial=${row.serialCode}`;

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(activateUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 160,
      color: { dark: "#0b0b16", light: "#ffffff" },
    })
      .then((url) => {
        if (alive) setQr(url);
      })
      .catch(() => setQr(null));
    return () => {
      alive = false;
    };
  }, [activateUrl]);

  return (
    <div className="sticker">
      <div className="sticker-brand">
        <span className="sticker-logo">🚀</span>
        <span className="sticker-name">SwitchNest</span>
      </div>
      <div className="sticker-model">{productName}</div>
      <div className="sticker-body">
        <div className="sticker-code">{row.serialCode}</div>
        {qr ? (
          <img src={qr} alt={row.serialCode} className="sticker-qr" />
        ) : (
          <div className="sticker-qr sticker-qr-empty">QR</div>
        )}
      </div>
      <div className="sticker-foot">Scan to activate · SwitchNest IoT</div>
    </div>
  );
}

export function PrintSerials() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [params] = useSearchParams();

  const [products, setProducts] = useState<Product[]>([]);
  const [serials, setSerials] = useState<SerialRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [status, setStatus] = useState<string>(params.get("status") ?? "available");
  const [productId, setProductId] = useState<string>(params.get("productId") ?? "");

  const origin = useMemo(() => window.location.origin, []);

  useEffect(() => {
    if (user?.role !== "system_admin") {
      navigate("/dashboard", { replace: true });
      return;
    }
    getAdminProducts().then(setProducts).catch(() => setProducts([]));
  }, [user, navigate]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (status) qs.set("status", status);
      if (productId) qs.set("productId", productId);
      const rows = await getSerials({ status: status || undefined, productId: productId ? Number(productId) : undefined });
      setSerials(rows);
    } catch (e) {
      setError("Serials load nahi hue");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, productId]);

  const productName = (id: number) => products.find((p) => p.id === id)?.name ?? "SwitchNest Board";

  return (
    <div className="print-root mx-auto max-w-5xl px-4 py-8">
      <style>{`
        .print-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin-bottom: 16px; }
        .print-toolbar label { font-size: 12px; color: #9ca3af; display: block; margin-bottom: 4px; }
        .print-toolbar select {
          background: #1a1a2e; border: 1px solid #374151; color: #e5e7eb;
          border-radius: 8px; padding: 6px 10px; font-size: 14px;
        }
        .print-toolbar .btn {
          background: #2563eb; color: #fff;
          border: 0; border-radius: 8px; padding: 8px 16px; font-weight: 600; cursor: pointer;
        }
        .print-toolbar .btn-secondary {
          background: transparent; border: 1px solid #06b6d4; color: #06b6d4;
        }
        .sticker-sheet { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .sticker {
          border: 1px dashed #c0c0c0; border-radius: 6px; padding: 10px 12px;
          background: #ffffff; color: #111; break-inside: avoid; page-break-inside: avoid;
        }
        .sticker-brand { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
        .sticker-logo { font-size: 14px; }
        .sticker-name { font-weight: 800; font-size: 13px; letter-spacing: 0.5px; }
        .sticker-model { font-size: 10px; color: #444; margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .sticker-body { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .sticker-code { font-family: Consolas, monospace; font-weight: 700; font-size: 16px; letter-spacing: 0.5px; }
        .sticker-qr { width: 74px; height: 74px; }
        .sticker-qr-empty { display: flex; align-items: center; justify-content: center; background: #eee; color: #999; font-size: 10px; }
        .sticker-foot { font-size: 8px; color: #666; margin-top: 4px; text-align: right; }
        .print-hint { color: #9ca3af; font-size: 12px; margin-bottom: 12px; }
        @media print {
          body { background: #fff !important; }
          .print-toolbar, .print-hint, header, nav { display: none !important; }
          .print-root { max-width: 100%; padding: 0; }
          .sticker-sheet { grid-template-columns: repeat(2, 1fr); gap: 6px; }
          .sticker { border: 1px dashed #999; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>

      <div className="print-toolbar">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Product</label>
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">All products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.modelCode} — {p.name}</option>
            ))}
          </select>
        </div>
        <button className="btn" onClick={() => window.print()}>🖨️ Print Stickers</button>
        <button className="btn btn-secondary" onClick={() => window.close()}>✕ Close</button>
        <span className="print-hint" style={{ marginLeft: "auto", marginBottom: 0 }}>
          {loading ? "Loading…" : `${serials.length} stickers ready`}
        </span>
      </div>

      {error && <div style={{ color: "#f87171", marginBottom: 12 }}>{error}</div>}

      {serials.length === 0 && !loading && (
        <div style={{ color: "#9ca3af" }}>Koi serial nahi mile is filter me — status/product badal ke dekho.</div>
      )}

      <div className="sticker-sheet">
        {serials.map((row) => (
          <Sticker key={row.id} row={row} productName={productName(row.productId)} origin={origin} />
        ))}
      </div>
    </div>
  );
}
