import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CopyText } from "./CopyText";
import { deleteContact, getAdminContact, updateContactStatus } from "../api/public";
import {
  createAdminProduct,
  deleteAdminProduct,
  generateSerials,
  getAdminOrders,
  getAdminProducts,
  getAdminWarranty,
  getSerialDetail,
  getSerials,
  updateAdminProduct,
  updateOrderStatus,
  updateWarrantyStatus,
  type WarrantyClaimRow,
  type Order,
  type Product,
  type SerialRow,
} from "../api/shop";

const ORDER_BADGE: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-600",
  paid: "bg-blue-500/20 text-blue-700",
  shipped: "bg-purple-500/20 text-purple-300",
  delivered: "bg-green-500/20 text-green-700",
  cancelled: "bg-red-500/20 text-red-600",
};

const SERIAL_BADGE: Record<string, string> = {
  available: "bg-gray-500/20 text-gray-600",
  reserved: "bg-amber-500/20 text-amber-600",
  shipped: "bg-purple-500/20 text-purple-300",
  delivered: "bg-green-500/20 text-green-700",
  claimed: "bg-brand/20 text-brand",
};

// ---------------- Products ----------------

function ProductsSection() {
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: getAdminProducts,
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", modelCode: "", relayCount: "4", price: "", description: "", features: "" });
  const [msg, setMsg] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await createAdminProduct({
        name: form.name,
        modelCode: form.modelCode,
        relayCount: Number(form.relayCount),
        price: Number(form.price),
        description: form.description || undefined,
        features: form.features || undefined,
      });
      setShowForm(false);
      setForm({ name: "", modelCode: "", relayCount: "4", price: "", description: "", features: "" });
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      setMsg("✅ Product add ho gaya");
    } catch {
      setMsg("❌ Product add fail — modelCode unique hona chahiye");
    }
  }

  async function toggleActive(p: Product) {
    await updateAdminProduct(p.id, { active: !p.active });
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Product delete karna hai? Serials bhi hatenge.")) return;
    await deleteAdminProduct(id);
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  }

  if (isLoading) return <p className="text-gray-500">Loading products…</p>;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold">Products</h2>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          {showForm ? "Cancel" : "+ New Product"}
        </button>
      </div>

      {msg && <div className="mb-4 rounded bg-night-700 p-3 text-sm">{msg}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 grid gap-3 rounded-xl border border-brand/20 bg-night-800 p-5 sm:grid-cols-2">
          <input required placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
          <input required placeholder="Model code * (e.g. 4CH, DIM-4S)" value={form.modelCode} onChange={(e) => setForm({ ...form, modelCode: e.target.value.toUpperCase() })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
          <input required placeholder="Relay count *" type="number" min={1} value={form.relayCount} onChange={(e) => setForm({ ...form, relayCount: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
          <input required placeholder="Price ₹ *" type="number" min={1} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
          <input placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder='Features JSON (optional) e.g. {"channels":4,"ir":true}' value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm sm:col-span-2" />
          <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white sm:col-span-2">
            Create Product
          </button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {products?.map((p) => (
          <div key={p.id} className={`rounded-xl border p-5 ${p.active ? "border-brand/20 bg-night-800" : "border-gray-200 bg-night-900 opacity-60"}`}>
            <div className="mb-1 flex items-center justify-between">
              <span className="font-semibold">{p.name}</span>
              <span className="rounded bg-brand/20 px-2 py-0.5 text-xs font-bold text-brand">{p.modelCode}</span>
            </div>
            <div className="mb-2 text-sm text-gray-500">
              {p.relayCount} CH · ₹{Number(p.price).toLocaleString("en-IN")} · {p._count.serials} serials
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={() => toggleActive(p)} className="rounded bg-night-700 px-2 py-1 hover:bg-night-600">
                {p.active ? "Disable" : "Enable"}
              </button>
              <button onClick={() => handleDelete(p.id)} className="rounded bg-red-900/40 px-2 py-1 text-red-600 hover:bg-red-900/60">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------- Orders ----------------

function OrdersSection() {
  const queryClient = useQueryClient();
  const { data: orders, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: getAdminOrders,
    refetchInterval: 10_000,
  });
  const [serialDetail, setSerialDetail] = useState<string | null>(null);

  async function advance(o: Order) {
    const next: Record<string, string> = { pending: "paid", paid: "shipped", shipped: "delivered" };
    const target = next[o.status];
    if (!target) return;
    await updateOrderStatus(o.id, target);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  async function cancel(o: Order) {
    if (!window.confirm(`Order #${o.orderNumber} cancel karna hai?`)) return;
    await updateOrderStatus(o.id, "cancelled");
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  if (isLoading) return <p className="text-gray-500">Loading orders…</p>;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Orders ({orders?.length ?? 0})</h2>
      <div className="space-y-4">
        {orders?.length === 0 && <p className="text-gray-500">Koi order nahi.</p>}
        {orders?.map((o) => (
          <div key={o.id} className="rounded-xl border border-brand/20 bg-night-800 p-5">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <CopyText text={o.orderNumber} className="font-bold" title="Hold to copy order #">
                  #{o.orderNumber}
                </CopyText>
                <span className="ml-2 text-sm text-gray-500">{o.user?.username} ({o.user?.email})</span>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${ORDER_BADGE[o.status] ?? ""}`}>{o.status}</span>
            </div>
            <div className="mb-3 text-sm text-gray-600">
              {o.items.map((i) => (
                <div key={i.id} className="flex justify-between">
                  <span>{i.productName} × {i.quantity} {i.serialCode && <CopyText text={i.serialCode} className="text-xs text-brand" title="Right-click/hold = copy · click = details" onClick={() => setSerialDetail(i.serialCode)}>({i.serialCode})</CopyText>}</span>
                  <span>₹{(Number(i.price) * i.quantity).toLocaleString("en-IN")}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-brand/20 pt-2 font-bold">
                <span>Total · {o.paymentMethod.toUpperCase()}</span>
                <span>₹{Number(o.totalAmount).toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              📍 {o.shippingName} · {o.shippingPhone} · {o.shippingAddress}
              {o.wifiSsid && <span className="ml-3">📶 {o.wifiSsid}</span>}
            </div>
            <div className="mt-3 flex gap-2 text-xs">
              <button
                onClick={() => window.open(`/admin/bill/${o.id}`, "_blank")}
                className="rounded bg-night-700 px-3 py-1.5 font-semibold text-gray-300 hover:bg-night-600"
                title="Invoice/Bill print — items + serials + buyer"
              >
                🖨️ Bill
              </button>
              {o.status === "pending" && (
                <>
                  <button onClick={() => advance(o)} className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700">Mark Paid</button>
                  <button onClick={() => cancel(o)} className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-600">Cancel</button>
                </>
              )}
              {o.status === "paid" && (
                <>
                  <button onClick={() => advance(o)} className="rounded bg-purple-600 px-3 py-1.5 font-semibold text-white hover:bg-purple-700">Mark Shipped</button>
                  <button onClick={() => cancel(o)} className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-600">Cancel</button>
                </>
              )}
              {o.status === "shipped" && (
                <button onClick={() => advance(o)} className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700">Mark Delivered</button>
              )}
            </div>
          </div>
        ))}
      </div>
      {serialDetail && (
        <SerialDetailsModal code={serialDetail} onClose={() => setSerialDetail(null)} />
      )}
    </div>
  );
}

// ---------------- Serials ----------------

function SerialsSection() {
  const queryClient = useQueryClient();
  const { data: products } = useQuery({ queryKey: ["admin-products"], queryFn: getAdminProducts });
  const { data: serials, isLoading } = useQuery({
    queryKey: ["admin-serials"],
    queryFn: () => getSerials(),
    refetchInterval: 10_000,
  });
  const [productId, setProductId] = useState<number | "">("");
  const [count, setCount] = useState(10);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [serialDetail, setSerialDetail] = useState<string | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!productId) return;
    setGenMsg(null);
    try {
      const res = await generateSerials(Number(productId), count);
      setGenMsg(`✅ ${res.generated} serials generate hue: ${res.codes.slice(0, 3).join(", ")}…`);
      queryClient.invalidateQueries({ queryKey: ["admin-serials"] });
    } catch {
      setGenMsg("❌ Generate fail");
    }
  }

  if (isLoading) return <p className="text-gray-500">Loading serials…</p>;

  const counts = (serials ?? []).reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Serial Registry</h2>
      <p className="mb-3 text-xs text-gray-500">Right-click serial = copy · Click serial = details (kisne claim kiya, order, warranty)</p>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} className={`rounded-full px-3 py-1 font-semibold ${SERIAL_BADGE[k] ?? ""}`}>
            {k}: {v}
          </span>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => window.open("/admin/print", "_blank")}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white"
        >
          🖨️ Print Stickers
        </button>
        <span className="text-xs text-gray-500">Sticker/QR sheet — box pe chipkane ke liye (naya tab me khulta hai)</span>
      </div>

      <form onSubmit={handleGenerate} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-brand/20 bg-night-800 p-5">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Product</label>
          <select value={productId} onChange={(e) => setProductId(Number(e.target.value))} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm">
            <option value="">Choose product…</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>{p.modelCode} — {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Count</label>
          <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-24 rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white">
          Generate Serials
        </button>
        {genMsg && <span className="text-xs text-gray-500">{genMsg}</span>}
      </form>

      <div className="overflow-x-auto rounded-xl border border-brand/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-night-800 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Serial</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">User</th>
            </tr>
          </thead>
          <tbody>
            {serials?.map((s: SerialRow) => (
              <tr key={s.id} className="border-t border-night-700">
                <td className="px-3 py-2 font-mono text-xs text-brand">
                  <CopyText text={s.serialCode} title="Right-click/hold = copy · click = details" onClick={() => setSerialDetail(s.serialCode)}>{s.serialCode}</CopyText>
                </td>
                <td className="px-3 py-2">{s.product.modelCode}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SERIAL_BADGE[s.status] ?? ""}`}>{s.status}</span></td>
                <td className="px-3 py-2 text-xs text-gray-500">{s.order ? `#${s.order.orderNumber}` : s.orderId ? `#${s.orderId}` : "—"}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {s.user ? `${s.user.username}${s.user.email ? ` (${s.user.email})` : ""}` : s.userId ? `User #${s.userId}` : "—"}
                </td>
              </tr>
            ))}
            {serials?.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-gray-500">Koi serial nahi — upar generate karo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {serialDetail && (
        <SerialDetailsModal code={serialDetail} onClose={() => setSerialDetail(null)} />
      )}
    </div>
  );
}

// ---------------- Serial details modal ----------------

function SerialDetailsModal({ code, onClose }: { code: string; onClose: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-serial-detail", code],
    queryFn: () => getSerialDetail(code),
    enabled: Boolean(code),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-brand/20 bg-night-800 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">🔑 Serial Details</h3>
          <button onClick={onClose} className="rounded bg-night-700 px-2.5 py-1 text-xs font-semibold hover:bg-night-600">✕ Close</button>
        </div>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : data ? (
          <div className="space-y-2 text-sm">
            <SerialInfo
              row="Serial"
              value={
                <CopyText text={data.serialCode} className="font-mono text-brand" title="Right-click/hold = copy">
                  {data.serialCode}
                </CopyText>
              }
            />
            <SerialInfo row="Product" value={`${data.product.modelCode} — ${data.product.name}`} />
            <SerialInfo row="Status" value={data.status} />
            <SerialInfo row="Order" value={data.order ? `#${data.order.orderNumber} (${data.order.status})` : "—"} />
            <SerialInfo row="Claimed by" value={data.user ? `${data.user.username} (${data.user.email})` : "—"} />
            <SerialInfo row="Home" value={data.home ? data.home.name : "—"} />
            <SerialInfo row="Created" value={data.createdAt ? new Date(data.createdAt).toLocaleString() : "—"} />
            <SerialInfo row="Claimed at" value={data.claimedAt ? new Date(data.claimedAt).toLocaleString() : "—"} />
            <SerialInfo row="Tested at" value={data.testedAt ? new Date(data.testedAt).toLocaleString() : "—"} />
            <SerialInfo
              row="Warranty"
              value={
                data.warrantyExpiresAt
                  ? `${data.warrantyStatus} · till ${new Date(data.warrantyExpiresAt).toLocaleDateString()}`
                  : "—"
              }
            />
          </div>
        ) : (
          <p className="text-sm text-red-400">Serial detail load nahi hua</p>
        )}
      </div>
    </div>
  );
}

function SerialInfo({ row, value }: { row: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-night-700 pb-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{row}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

export function AdminShop() {
  return (
    <div>
      <ProductsSection />
      <div className="my-10 border-t border-brand/20" />
      <OrdersSection />
      <div className="my-10 border-t border-brand/20" />
      <SerialsSection />
      <div className="my-10 border-t border-brand/20" />
      <WarrantySection />
      <div className="my-10 border-t border-brand/20" />
      <ContactSection />
    </div>
  );
}

// ---------------- Warranty ----------------

const CLAIM_BADGE_ADMIN: Record<string, string> = {
  submitted: "bg-amber-500/20 text-amber-600",
  approved: "bg-green-500/20 text-green-700",
  rejected: "bg-red-500/20 text-red-600",
  resolved: "bg-blue-500/20 text-blue-700",
};

function WarrantySection() {
  const queryClient = useQueryClient();
  const { data: claims, isLoading } = useQuery({
    queryKey: ["admin-warranty"],
    queryFn: getAdminWarranty,
    refetchInterval: 10_000,
  });

  async function setStatus(c: WarrantyClaimRow, status: string) {
    if (!window.confirm(`${c.serialCode} claim ko "${status}" karna hai?`)) return;
    await updateWarrantyStatus(c.id, status);
    queryClient.invalidateQueries({ queryKey: ["admin-warranty"] });
  }

  if (isLoading) return <p className="text-gray-500">Loading warranty claims…</p>;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Warranty Claims ({claims?.length ?? 0})</h2>
      {claims?.length === 0 ? (
        <p className="text-gray-500">Koi claim nahi.</p>
      ) : (
        <div className="space-y-4">
          {claims?.map((c) => (
            <div key={c.id} className="rounded-xl border border-brand/20 bg-night-800 p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CopyText text={c.serialCode} className="font-mono text-sm text-brand" title="Hold to copy serial">{c.serialCode}</CopyText>
                  <span className="ml-3 text-sm text-gray-500">{c.serial?.product?.name ?? ""}</span>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-bold ${CLAIM_BADGE_ADMIN[c.status] ?? ""}`}>{c.status}</span>
              </div>
              <div className="text-sm text-gray-600">
                <span className="text-gray-500">User:</span> {c.user?.username} ({c.user?.email})
              </div>
              <div className="text-sm text-gray-600">
                <span className="text-gray-500">Reason:</span> {c.reason}
              </div>
              {c.description && <div className="mt-1 text-sm text-gray-500">{c.description}</div>}
              <div className="mt-2 text-xs text-gray-500">{new Date(c.createdAt).toLocaleString()}</div>
              <div className="mt-3 flex gap-2 text-xs">
                {c.status === "submitted" && (
                  <>
                    <button onClick={() => setStatus(c, "approved")} className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700">Approve</button>
                    <button onClick={() => setStatus(c, "rejected")} className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-600">Reject</button>
                  </>
                )}
                {c.status === "approved" && (
                  <button onClick={() => setStatus(c, "resolved")} className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700">Mark Resolved</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Contact / Feedback ----------------

function ContactSection() {
  const queryClient = useQueryClient();
  const { data: msgs, isLoading } = useQuery({
    queryKey: ["admin-contact"],
    queryFn: getAdminContact,
    refetchInterval: 10_000,
  });

  async function setStatus(id: number, status: string) {
    await updateContactStatus(id, status);
    queryClient.invalidateQueries({ queryKey: ["admin-contact"] });
  }

  async function remove(id: number) {
    if (!window.confirm("Message delete karna hai?")) return;
    await deleteContact(id);
    queryClient.invalidateQueries({ queryKey: ["admin-contact"] });
  }

  if (isLoading) return <p className="text-gray-500">Loading messages…</p>;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Contact / Feedback ({msgs?.filter((m) => m.status === "new").length ?? 0} new)</h2>
      {msgs?.length === 0 ? (
        <p className="text-gray-500">Koi message nahi.</p>
      ) : (
        <div className="space-y-3">
          {msgs?.map((m) => (
            <div key={m.id} className="rounded-xl border border-brand/20 bg-night-800 p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-bold text-night-950">{m.name}</span>
                  {m.user ? (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400" title={`Account: ${m.user.email ?? ""}`}>
                      👤 {m.user.username}
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-gray-100/50 px-1.5 py-0.5 text-[10px] text-gray-500">Public</span>
                  )}
                  {m.email && <span className="ml-2 text-gray-500">{m.email}</span>}
                  {m.phone && <span className="ml-2 text-gray-500">{m.phone}</span>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m.status === "new" ? "bg-amber-500/20 text-amber-600" : m.status === "read" ? "bg-blue-500/20 text-blue-700" : "bg-green-500/20 text-green-700"}`}>
                  {m.status}
                </span>
              </div>
              <div className="text-xs text-gray-500">{m.subject} · {new Date(m.createdAt).toLocaleString()}</div>
              <p className="mt-2 text-sm text-gray-600">{m.message}</p>
              <div className="mt-3 flex gap-2 text-xs">
                {m.status === "new" && (
                  <button onClick={() => setStatus(m.id, "read")} className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700">Mark Read</button>
                )}
                {m.status !== "done" && (
                  <button onClick={() => setStatus(m.id, "done")} className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700">Done</button>
                )}
                <button onClick={() => remove(m.id)} className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-600">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
