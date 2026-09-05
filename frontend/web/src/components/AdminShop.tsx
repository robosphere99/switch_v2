import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { CopyText } from "./CopyText";
import { deleteContact, getAdminContact, updateContactStatus } from "../api/public";
import {
  createAdminProduct,
  deleteAdminProduct,
  deleteSerial,
  deleteSerials,
  generateSerials,
  getAdminOrders,
  getAdminProducts,
  getAdminWarranty,
  getSerialDetail,
  getSerials,
  updateAdminProduct,
  updateOrderStatus,
  updateOrderPaymentStatus,
  updateWarrantyStatus,
  uploadProductMedia,
  deleteProductMedia,
  type WarrantyClaimRow,
  type Order,
  type Product,
  type ProductMediaItem,
  type SerialRow,
} from "../api/shop";

const ORDER_BADGE: Record<string, string> = {
  pending: "bg-amber-500/20 text-amber-600",
  processing: "bg-blue-500/20 text-blue-700",
  paid: "bg-blue-500/20 text-blue-700",
  packed: "bg-indigo-500/20 text-indigo-400",
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

// ---------------- Edit Product Modal ----------------

function EditProductModal({ product, onClose, onSaved }: { product: Product; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: product.name,
    price: String(product.price),
    description: product.description || "",
    imageUrl: product.imageUrl || "",
  });

  const initialFeatures = product.features && typeof product.features === "object" && !Array.isArray(product.features)
    ? Object.entries(product.features).map(([k, v]) => ({ id: Math.random(), key: k, value: String(v) }))
    : [];
  const [featureList, setFeatureList] = useState(initialFeatures);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [mediaList, setMediaList] = useState<ProductMediaItem[]>(product.media || []);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  
  const mediaRef = useRef<HTMLInputElement>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);
    try {
      const parsedFeatures = featureList.reduce((acc, curr) => {
        if (curr.key.trim()) {
          let val: any = curr.value.trim();
          if (val.toLowerCase() === "true") val = true;
          else if (val.toLowerCase() === "false") val = false;
          else if (!isNaN(Number(val)) && val !== "") val = Number(val);
          acc[curr.key.trim()] = val;
        }
        return acc;
      }, {} as Record<string, any>);

      await updateAdminProduct(product.id, {
        name: form.name,
        price: Number(form.price),
        description: form.description,
        features: Object.keys(parsedFeatures).length > 0 ? (parsedFeatures as any) : undefined,
        imageUrl: form.imageUrl || undefined,
      });
      setMsg("✅ Product updated!");
      onSaved();
    } catch {
      setMsg("❌ Update failed");
    }
    setSaving(false);
  }

  async function handleUploadMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const media = await uploadProductMedia(product.id, file);
      setMediaList((prev) => [...prev, media]);
      // If it's an image and we don't have a main image yet, set it automatically
      if (media.type === "image" && !form.imageUrl) {
        setForm((f) => ({ ...f, imageUrl: media.url }));
      }
      setMsg("✅ Media uploaded");
    } catch (err) {
      console.error("Upload error:", err);
      setMsg("❌ Media upload failed");
    }
    setUploadingMedia(false);
    if (mediaRef.current) mediaRef.current.value = "";
  }

  async function handleDeleteMedia(mediaId: number) {
    if (!window.confirm("Delete this media?")) return;
    try {
      await deleteProductMedia(mediaId);
      setMediaList((prev) => {
        const item = prev.find(m => m.id === mediaId);
        if (item && item.url === form.imageUrl) {
          setForm(f => ({ ...f, imageUrl: "" }));
        }
        return prev.filter((m) => m.id !== mediaId);
      });
    } catch {
      setMsg("❌ Delete failed");
    }
  }

  const MEDIA_ICON: Record<string, string> = { image: "🖼️", video: "🎬", document: "📄" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" onClick={onClose}>
      <div 
        className="relative flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-night-600 bg-night-800 shadow-2xl" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-night-700 bg-night-900 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-white">Edit Product</h3>
            <p className="text-xs text-brand-300">{product.modelCode} · ID #{product.id}</p>
          </div>
          <button onClick={onClose} className="rounded-full bg-night-700 p-2 text-gray-400 transition-colors hover:bg-night-600 hover:text-white">
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {msg && (
            <div className={`mb-6 rounded-lg border p-3 text-sm font-medium ${msg.includes("✅") ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-red-500/20 bg-red-500/10 text-red-400"}`}>
              {msg}
            </div>
          )}

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            
            {/* Left Column: Product Details & Features */}
            <div className="space-y-6">
              <div>
                <h4 className="mb-4 text-sm font-bold uppercase tracking-wider text-brand-400">Product Details</h4>
                <form id="edit-product-form" onSubmit={handleSave} className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-gray-400">Name</label>
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-night-600 bg-night-900 px-4 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-gray-400">Price (₹)</label>
                    <input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="w-full rounded-xl border border-night-600 bg-night-900 px-4 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-semibold text-gray-400">Description</label>
                    <textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full resize-none rounded-xl border border-night-600 bg-night-900 px-4 py-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
                  </div>
                </form>
              </div>

              {/* Features Builder */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-brand-400">Features Builder</h4>
                  <button 
                    type="button"
                    onClick={() => setFeatureList([...featureList, { id: Math.random(), key: "", value: "" }])}
                    className="rounded text-xs font-bold text-brand hover:text-brand-300"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="space-y-2 rounded-xl border border-night-700 bg-night-800/50 p-4">
                  {featureList.length === 0 ? (
                    <div className="py-2 text-center text-xs text-gray-500">No features added.</div>
                  ) : (
                    featureList.map((feat, index) => (
                      <div key={feat.id} className="flex items-center gap-2">
                        <input 
                          placeholder="Key (e.g. wifi)" 
                          value={feat.key}
                          onChange={(e) => {
                            const newList = [...featureList];
                            newList[index].key = e.target.value;
                            setFeatureList(newList);
                          }}
                          className="w-1/3 rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 text-xs text-white focus:border-brand focus:outline-none"
                        />
                        <input 
                          placeholder="Value (e.g. true, 10A)" 
                          value={feat.value}
                          onChange={(e) => {
                            const newList = [...featureList];
                            newList[index].value = e.target.value;
                            setFeatureList(newList);
                          }}
                          className="flex-1 rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 text-xs text-white focus:border-brand focus:outline-none"
                        />
                        <button 
                          onClick={() => setFeatureList(featureList.filter((_, i) => i !== index))}
                          className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20"
                        >✕</button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Media Gallery */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h4 className="text-sm font-bold uppercase tracking-wider text-brand-400">Media Gallery</h4>
                <button 
                  onClick={() => mediaRef.current?.click()}
                  disabled={uploadingMedia}
                  className="flex items-center gap-1 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-white shadow-lg transition-all hover:bg-brand-500 disabled:opacity-50"
                >
                  {uploadingMedia ? "Uploading..." : "+ Upload File"}
                </button>
                <input ref={mediaRef} type="file" className="hidden" onChange={handleUploadMedia} accept="image/*,video/*,.pdf,.doc,.docx" />
              </div>
              
              {/* Cover Image Preview */}
              <div className="mb-6 rounded-xl border border-night-700 bg-night-900 p-4 shadow-inner">
                <div className="mb-2 text-xs font-semibold text-gray-400">Cover Image Preview</div>
                <div className="flex h-40 w-full items-center justify-center rounded-lg bg-night-950/50">
                  {form.imageUrl ? (
                    <img src={form.imageUrl} alt="Cover" className="h-full w-full object-contain p-2" />
                  ) : (
                    <span className="text-sm text-gray-600">No cover image selected</span>
                  )}
                </div>
              </div>

              {/* All Media Grid */}
              <div className="rounded-xl border border-night-700 bg-night-800/50 p-4">
                <h5 className="mb-3 text-xs font-semibold text-gray-400">Uploaded Files (Photos, PDFs, Videos)</h5>
                {mediaList.length === 0 ? (
                  <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-night-600 text-xs text-gray-500">
                    No files uploaded yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {mediaList.map((m) => (
                      <div key={m.id} className="group relative overflow-hidden rounded-xl border border-night-600 bg-night-900 transition-colors hover:border-brand-500/50">
                        {m.type === "image" ? (
                          <img src={m.url} alt="" className="h-24 w-full object-cover opacity-80 transition-opacity group-hover:opacity-100" />
                        ) : (
                          <div className="flex h-24 items-center justify-center bg-night-950 text-3xl">{MEDIA_ICON[m.type] || "📎"}</div>
                        )}
                        <div className="truncate bg-night-950 px-2 py-1.5 text-[10px] text-gray-400">
                          {m.url.split("/").pop()}
                        </div>
                        
                        {/* Hover Overlay Buttons */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 opacity-0 backdrop-blur-[2px] transition-opacity group-hover:opacity-100">
                          {m.type === "image" && m.url !== form.imageUrl && (
                            <button 
                              onClick={() => setForm({ ...form, imageUrl: m.url })}
                              className="rounded bg-brand px-3 py-1 text-[10px] font-bold text-white shadow-lg hover:bg-brand-400"
                            >
                              ★ Set as Cover
                            </button>
                          )}
                          {m.url === form.imageUrl && (
                            <span className="rounded bg-green-500/80 px-3 py-1 text-[10px] font-bold text-white shadow-lg">Current Cover</span>
                          )}
                          <button
                            onClick={() => handleDeleteMedia(m.id)}
                            className="rounded bg-red-600/90 px-3 py-1 text-[10px] font-bold text-white shadow-lg hover:bg-red-500"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 border-t border-night-700 bg-night-900 px-6 py-4">
          <button onClick={onClose} className="rounded-xl px-6 py-2.5 text-sm font-semibold text-gray-400 transition-colors hover:bg-night-800 hover:text-white">
            Cancel
          </button>
          <button type="submit" form="edit-product-form" disabled={saving} className="rounded-xl bg-brand px-8 py-2.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition-all hover:bg-brand-500 hover:shadow-brand/40 disabled:opacity-50">
            {saving ? "Saving..." : "Save Product"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- Products ----------------

function ProductsSection() {
  const queryClient = useQueryClient();
  const { data: products, isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: getAdminProducts,
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", modelCode: "", relayCount: "4", price: "", description: "", features: "", stockCount: "0" });
  const [msg, setMsg] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

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
        stockCount: Number(form.stockCount)
      } as any);
      setShowForm(false);
      setForm({ name: "", modelCode: "", relayCount: "4", price: "", description: "", features: "", stockCount: "0" });
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
          <input required placeholder="Stock Count *" type="number" min={0} value={form.stockCount} onChange={(e) => setForm({ ...form, stockCount: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm sm:col-span-2" />
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
              {p.relayCount} CH · ₹{Number(p.price).toLocaleString("en-IN")} · Stock: {(p as any).stockCount || 0} · {p._count.serials} serials
            </div>
            {p.description && <p className="mb-2 text-xs text-gray-600 line-clamp-2">{p.description}</p>}
            {(p.media?.length ?? 0) > 0 && <p className="mb-2 text-xs text-gray-600">📎 {p.media!.length} media file(s)</p>}
            <div className="flex gap-2 text-xs">
              <button onClick={() => setEditingProduct(p)} className="rounded bg-brand/20 px-2 py-1 text-brand hover:bg-brand/40">
                ✏️ Edit
              </button>
              <button onClick={() => toggleActive(p)} className="rounded bg-night-700 px-2 py-1 hover:bg-night-600">
                {p.active ? "Disable" : "Enable"}
              </button>
              <button onClick={async () => {
                 const amt = prompt('Kitna stock add karna hai?', '10');
                 if(!amt || isNaN(Number(amt))) return;
                 await updateAdminProduct(p.id, { stockCount: ((p as any).stockCount || 0) + Number(amt) } as any);
                 queryClient.invalidateQueries({ queryKey: ['admin-products'] });
              }} className="rounded bg-brand/20 px-2 py-1 text-brand hover:bg-brand/40">
                + Stock
              </button>
              <button onClick={() => handleDelete(p.id)} className="rounded bg-red-900/40 px-2 py-1 text-red-600 hover:bg-red-900/60">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          onClose={() => setEditingProduct(null)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["admin-products"] })}
        />
      )}
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
    const next: Record<string, string> = { pending: "processing", processing: "packed", packed: "shipped", shipped: "delivered" };
    const target = next[o.status];
    if (!target) return;
    await updateOrderStatus(o.id, target);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  }

  async function markPaidSettled(o: Order) {
    if (!window.confirm(`Cod/Remittance verify kar rahe ho? Order #${o.orderNumber} payments ko paid mark karna hai?`)) return;
    await updateOrderPaymentStatus(o.id, "paid");
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
              {o.items.map((i) => {
                const itemSerial = (o as any).serials?.find((s: any) => s.serialCode === i.serialCode);
                const isTested = Boolean(itemSerial?.testedAt);
                return (
                  <div key={i.id} className="flex justify-between items-center mb-1">
                    <span className="flex items-center gap-2">
                      {i.productName} × {i.quantity}
                      {i.serialCode && (
                        <span className="flex items-center gap-2">
                          <CopyText text={i.serialCode} className="text-xs font-mono text-brand bg-night-900 px-1 py-0.5 rounded" title="Right-click/hold = copy · click = details" onClick={() => setSerialDetail(i.serialCode)}>
                            {i.serialCode}
                          </CopyText>
                          {isTested ? (
                            <span className="rounded bg-green-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-green-500 uppercase">✅ Tested</span>
                          ) : (
                            <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-amber-500 uppercase">⏳ Untested</span>
                          )}
                        </span>
                      )}
                    </span>
                    <span>₹{(Number(i.price) * i.quantity).toLocaleString("en-IN")}</span>
                  </div>
                );
              })}
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
                  <button onClick={() => advance(o)} className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700">Process Order</button>
                  <button onClick={() => cancel(o)} className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-600">Cancel</button>
                </>
              )}
              {o.status === "processing" && (
                <>
                  <button onClick={() => advance(o)} className="rounded bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-700">Mark Packed</button>
                  <button onClick={() => cancel(o)} className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-600">Cancel</button>
                </>
              )}
              {o.status === "packed" && (
                <>
                  <button onClick={() => advance(o)} className="rounded bg-purple-600 px-3 py-1.5 font-semibold text-white hover:bg-purple-700">Mark Shipped</button>
                  <button onClick={() => cancel(o)} className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-600">Cancel</button>
                </>
              )}
              {o.status === "shipped" && (
                <button onClick={() => advance(o)} className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700">Mark Delivered</button>
              )}
              {o.paymentStatus !== "paid" && o.status !== "cancelled" && (
                <button onClick={() => markPaidSettled(o)} className="rounded bg-emerald-700/80 px-3 py-1.5 font-semibold text-emerald-100 border border-emerald-500 hover:bg-emerald-600">₹ Mark Paid</button>
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
  const [genProductId, setGenProductId] = useState<number | "">("");
  const [count, setCount] = useState(10);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [serialDetail, setSerialDetail] = useState<string | null>(null);
  // Filters
  const [filterProduct, setFilterProduct] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<string | "">("");
  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!genProductId) return;
    setGenMsg(null);
    try {
      const res = await generateSerials(Number(genProductId), count);
      setGenMsg(`✅ ${res.generated} serials generate hue: ${res.codes.slice(0, 3).join(", ")}…`);
      queryClient.invalidateQueries({ queryKey: ["admin-serials"] });
    } catch {
      setGenMsg("❌ Generate fail");
    }
  }

  async function handleDelete(code: string) {
    if (!window.confirm(`Serial "${code}" delete karna hai? Ye action undo nahi hoga.`)) return;
    try {
      await deleteSerial(code);
      queryClient.invalidateQueries({ queryKey: ["admin-serials"] });
    } catch {
      setGenMsg("❌ Delete fail — sirf available serials delete ho sakte hain");
    }
  }

  async function handleBulkDelete() {
    const codesToDelete = filteredSerials
      .filter((s) => s.status === "available" && selected.has(s.id))
      .map((s) => s.serialCode);
    if (codesToDelete.length === 0) return;
    if (!window.confirm(`${codesToDelete.length} serial${codesToDelete.length === 1 ? "" : "s"} delete karna hai? Ye action undo nahi hoga.`)) return;
    try {
      const res = await deleteSerials(codesToDelete);
      setSelected(new Set());
      setGenMsg(`✅ ${res.deleted} delete hue${res.skipped > 0 ? `, ${res.skipped} skipped (claimed/reserved)` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["admin-serials"] });
    } catch {
      setGenMsg("❌ Bulk delete fail");
    }
  }

  if (isLoading) return <p className="text-gray-500">Loading serials…</p>;

  const allSerials = serials ?? [];

  // Filtered list
  const filteredSerials = allSerials.filter((s) => {
    if (filterProduct !== "" && s.productId !== filterProduct) return false;
    if (filterStatus !== "" && s.status !== filterStatus) return false;
    return true;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSerials.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageSerials = filteredSerials.slice((safePage - 1) * pageSize, safePage * pageSize);

  const availableOnPage = pageSerials.filter((s) => s.status === "available");
  const allAvailableSelected = availableOnPage.length > 0 && availableOnPage.every((s) => selected.has(s.id));

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allAvailableSelected) {
      // Deselect all available on current page
      setSelected((prev) => {
        const next = new Set(prev);
        for (const s of availableOnPage) next.delete(s.id);
        return next;
      });
    } else {
      // Select all available on current page
      setSelected((prev) => {
        const next = new Set(prev);
        for (const s of availableOnPage) next.add(s.id);
        return next;
      });
    }
  }

  const counts = allSerials.reduce<Record<string, number>>((acc, s) => {
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
          <select value={genProductId} onChange={(e) => setGenProductId(Number(e.target.value))} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm">
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

      {/* Filters + Bulk Delete */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Filter Product</label>
          <select
            value={filterProduct}
            onChange={(e) => { setFilterProduct(e.target.value === "" ? "" : Number(e.target.value)); setSelected(new Set()); setPage(1); }}
            className="rounded border border-night-600 bg-night-900 px-3 py-1.5 text-sm"
          >
            <option value="">All products</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>{p.modelCode} — {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Filter Status</label>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setSelected(new Set()); setPage(1); }}
            className="rounded border border-night-600 bg-night-900 px-3 py-1.5 text-sm"
          >
            <option value="">All statuses</option>
            {Object.keys(counts).map((k) => (
              <option key={k} value={k}>{k} ({counts[k]})</option>
            ))}
          </select>
        </div>
        {selected.size > 0 && (
          <div className="ml-auto">
            <button
              onClick={handleBulkDelete}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-sm font-semibold text-red-400 transition hover:bg-red-500/20"
            >
              🗑️ Delete {selected.size} selected
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-brand/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-night-800 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allAvailableSelected}
                  onChange={toggleSelectAll}
                  className="h-3.5 w-3.5 cursor-pointer accent-red-500"
                  title="Select all available serials"
                />
              </th>
              <th className="px-3 py-2">Serial</th>
              <th className="px-3 py-2">Product</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Order</th>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {pageSerials.map((s: SerialRow) => (
              <tr key={s.id} className="border-t border-night-700">
                <td className="px-3 py-2">
                  {s.status === "available" && (
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggleSelect(s.id)}
                      className="h-3.5 w-3.5 cursor-pointer accent-red-500"
                    />
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-brand">
                  <CopyText text={s.serialCode} title="Right-click/hold = copy · click = details" onClick={() => setSerialDetail(s.serialCode)}>{s.serialCode}</CopyText>
                </td>
                <td className="px-3 py-2">{s.product.modelCode}</td>
                <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${SERIAL_BADGE[s.status] ?? ""}`}>{s.status}</span></td>
                <td className="px-3 py-2 text-xs text-gray-500">{s.order ? `#${s.order.orderNumber}` : s.orderId ? `#${s.orderId}` : "—"}</td>
                <td className="px-3 py-2 text-xs text-gray-500">
                  {s.user ? `${s.user.username}${s.user.email ? ` (${s.user.email})` : ""}` : s.userId ? `User #${s.userId}` : "—"}
                </td>
                <td className="px-3 py-2">
                  {s.status === "available" && (
                    <button
                      onClick={() => handleDelete(s.serialCode)}
                      className="rounded bg-red-900/40 px-2 py-1 text-[11px] font-semibold text-red-500 hover:bg-red-900/60"
                      title="Delete serial"
                    >
                      🗑️
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredSerials.length === 0 && allSerials.length > 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Filter se kuch nahi mila — filter badal ke dekho.</td></tr>
            )}
            {allSerials.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Koi serial nahi — upar generate karo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {filteredSerials.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[11px] text-gray-500">
            <span>Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filteredSerials.length)} of {filteredSerials.length}</span>
            {selected.size > 0 && <span>· {selected.size} selected</span>}
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); setSelected(new Set()); }}
              className="rounded border border-night-600 bg-night-900 px-1.5 py-0.5 text-[11px]"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="rounded border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-night-700 disabled:opacity-40"
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (safePage <= 4) {
                pageNum = i + 1;
              } else if (safePage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = safePage - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold ${pageNum === safePage
                    ? "border border-brand bg-brand/20 text-brand"
                    : "border border-gray-200 text-gray-500 hover:bg-night-700"
                    }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 7 && (
              <span className="px-1 text-xs text-gray-600">…</span>
            )}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="rounded border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-500 hover:bg-night-700 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
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
