import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo } from "react";
import { CopyText } from "./CopyText";
import { deleteContact, getAdminContact, updateContactStatus } from "../api/public";
import { listCoupons, createCoupon, updateCoupon, deleteCoupon } from "../api/admin";
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
    upcoming: product.upcoming || false,
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
        upcoming: form.upcoming,
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
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <input type="checkbox" id="edit-upcoming" checked={form.upcoming} onChange={(e) => setForm({ ...form, upcoming: e.target.checked })} className="h-4 w-4 rounded border-night-600 bg-night-900 text-brand focus:ring-brand focus:ring-offset-night-800" />
                    <label htmlFor="edit-upcoming" className="text-sm font-semibold text-gray-300">Mark as Upcoming (Disabled "Add to Cart")</label>
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
  const [newProd, setNewProd] = useState({ name: "", modelCode: "", relayCount: "4", price: "", description: "", imageUrl: "", features: "", stockCount: "0", upcoming: false });
  const [msg, setMsg] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    try {
      await createAdminProduct({
        name: newProd.name,
        modelCode: newProd.modelCode,
        relayCount: Number(newProd.relayCount),
        price: Number(newProd.price),
        description: newProd.description || undefined,
        imageUrl: newProd.imageUrl || undefined,
        features: newProd.features || undefined,
        stockCount: parseInt(newProd.stockCount) || 0,
        upcoming: newProd.upcoming,
      } as any);
      setShowForm(false);
      setNewProd({ name: "", modelCode: "", relayCount: "4", price: "", description: "", imageUrl: "", features: "", stockCount: "0", upcoming: false });
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
          <input required placeholder="Name *" value={newProd.name} onChange={(e) => setNewProd({ ...newProd, name: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
          <input required placeholder="Model code * (e.g. 4CH, DIM-4S)" value={newProd.modelCode} onChange={(e) => setNewProd({ ...newProd, modelCode: e.target.value.toUpperCase() })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
          <input required placeholder="Relay count *" type="number" min={1} value={newProd.relayCount} onChange={(e) => setNewProd({ ...newProd, relayCount: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
          <input required placeholder="Price ₹ *" type="number" min={1} value={newProd.price} onChange={(e) => setNewProd({ ...newProd, price: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm" />
          <input required placeholder="Stock Count *" type="number" min={0} value={newProd.stockCount} onChange={(e) => setNewProd({ ...newProd, stockCount: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder="Description" value={newProd.description} onChange={(e) => setNewProd({ ...newProd, description: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm sm:col-span-2" />
          <input placeholder='Features JSON (optional) e.g. {"channels":4,"ir":true}' value={newProd.features} onChange={(e) => setNewProd({ ...newProd, features: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm sm:col-span-2" />
          <div className="flex items-center gap-2">
            <input type="checkbox" id="create-upcoming" checked={newProd.upcoming} onChange={(e) => setNewProd({ ...newProd, upcoming: e.target.checked })} className="h-4 w-4 rounded border-night-600 bg-night-900 text-brand focus:ring-brand focus:ring-offset-night-800" />
            <label htmlFor="create-upcoming" className="text-sm font-semibold text-gray-300">Mark as Upcoming</label>
          </div>
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

  // Search & Filtering States
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState<number>(1);

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

  // Filter & Search Logic
  const filteredOrders = useMemo(() => {
    if (!orders) return [];
    const q = search.trim().toLowerCase();

    return orders.filter((o) => {
      // Status filter
      if (statusFilter !== "all" && o.status !== statusFilter) return false;

      // Payment Method filter
      if (paymentFilter !== "all" && o.paymentMethod.toLowerCase() !== paymentFilter.toLowerCase()) return false;

      // Search query filter
      if (q) {
        const matchesNumber = o.orderNumber.toLowerCase().includes(q);
        const matchesUser = o.user?.username.toLowerCase().includes(q) || o.user?.email.toLowerCase().includes(q);
        const matchesShipping =
          o.shippingName.toLowerCase().includes(q) ||
          o.shippingPhone.toLowerCase().includes(q) ||
          o.shippingAddress.toLowerCase().includes(q);
        const matchesItems = o.items.some(
          (i) =>
            i.productName.toLowerCase().includes(q) ||
            (i.serialCode && i.serialCode.toLowerCase().includes(q))
        );
        if (!matchesNumber && !matchesUser && !matchesShipping && !matchesItems) {
          return false;
        }
      }

      return true;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, paymentFilter, pageSize]);

  // Pagination Logic
  const totalItems = filteredOrders.length;
  const totalPages = pageSize > 0 ? Math.ceil(totalItems / pageSize) : 1;
  const currentPage = Math.min(page, Math.max(1, totalPages));

  const displayedOrders = useMemo(() => {
    if (pageSize <= 0) return filteredOrders;
    const start = (currentPage - 1) * pageSize;
    return filteredOrders.slice(start, start + pageSize);
  }, [filteredOrders, currentPage, pageSize]);

  if (isLoading) return <p className="text-gray-500">Loading orders…</p>;

  const startItemNum = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItemNum = pageSize <= 0 ? totalItems : Math.min(currentPage * pageSize, totalItems);

  return (
    <div>
      {/* Title & Stats */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">
          Orders <span className="text-sm font-normal text-gray-400">({filteredOrders.length} of {orders?.length ?? 0})</span>
        </h2>
        {totalItems > 0 && (
          <div className="text-xs text-gray-400">
            Showing <span className="font-semibold text-white">{startItemNum}–{endItemNum}</span> of <span className="font-semibold text-white">{totalItems}</span> orders
          </div>
        )}
      </div>

      {/* Search, Filter & Limit Controls */}
      <div className="mb-6 rounded-xl border border-brand/20 bg-night-800 p-4 space-y-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search by Order #, Customer Name, Email, Phone, Address, Product, Serial Code..."
            className="w-full rounded-lg border border-night-600 bg-night-900 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white"
            >
              ✕ Clear
            </button>
          )}
        </div>

        {/* Filters & Limit Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Status Filter Tabs / Select */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-gray-400 mr-1">Status:</span>
            {["all", "pending", "processing", "packed", "shipped", "delivered", "cancelled"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 capitalize font-semibold transition ${
                  statusFilter === st
                    ? "bg-brand text-white shadow-sm"
                    : "bg-night-900 text-gray-400 hover:bg-night-700 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Payment & Limit Dropdowns */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-400">Payment:</span>
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="rounded-lg border border-night-600 bg-night-900 px-2.5 py-1 text-xs text-white focus:border-brand focus:outline-none"
              >
                <option value="all">All Methods</option>
                <option value="cod">COD</option>
                <option value="upi">UPI</option>
                <option value="card">Card</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-gray-400">Per Page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-lg border border-night-600 bg-night-900 px-2.5 py-1 text-xs text-white focus:border-brand focus:outline-none"
              >
                <option value={5}>5 Orders</option>
                <option value={10}>10 Orders</option>
                <option value={20}>20 Orders</option>
                <option value={50}>50 Orders</option>
                <option value={0}>Show All</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {displayedOrders.length === 0 && (
          <div className="rounded-xl border border-brand/10 bg-night-800/50 p-8 text-center text-gray-400">
            {orders?.length === 0 ? "Koi order nahi hai." : "Is filter/search se koi order nahi mila."}
          </div>
        )}

        {displayedOrders.map((o) => (
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

      {/* Pagination Controls */}
      {pageSize > 0 && totalPages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-night-800 p-4 text-xs">
          <div className="text-gray-400">
            Page <span className="font-semibold text-white">{currentPage}</span> of <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 font-semibold text-gray-300 hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <span key={p} className="flex items-center">
                    {showEllipsis && <span className="px-1 text-gray-500">…</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`h-7 min-w-[28px] rounded-lg px-2 text-xs font-semibold transition ${
                        currentPage === p
                          ? "bg-brand text-white"
                          : "bg-night-900 text-gray-400 hover:bg-night-700 hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}

            <button
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 font-semibold text-gray-300 hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed"
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
  const [search, setSearch] = useState("");
  const [filterProduct, setFilterProduct] = useState<number | "">("");
  const [filterStatus, setFilterStatus] = useState<string | "">("");
  // Selection
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // Filtered list with search
  const filteredSerials = allSerials.filter((s) => {
    if (filterProduct !== "" && s.productId !== filterProduct) return false;
    if (filterStatus !== "" && s.status !== filterStatus) return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const matchCode = s.serialCode.toLowerCase().includes(q);
      const matchProduct = s.product.name.toLowerCase().includes(q) || s.product.modelCode.toLowerCase().includes(q);
      const matchOrder = (s.order ? s.order.orderNumber : String(s.orderId || "")).toLowerCase().includes(q);
      const matchUser = (s.user ? `${s.user.username} ${s.user.email || ""}` : String(s.userId || "")).toLowerCase().includes(q);

      if (!matchCode && !matchProduct && !matchOrder && !matchUser) return false;
    }

    return true;
  });

  // Pagination
  const effectivePageSize = pageSize > 0 ? pageSize : filteredSerials.length || 1;
  const totalPages = Math.max(1, Math.ceil(filteredSerials.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const pageSerials = pageSize > 0 ? filteredSerials.slice((safePage - 1) * pageSize, safePage * pageSize) : filteredSerials;

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
      setSelected((prev) => {
        const next = new Set(prev);
        for (const s of availableOnPage) next.delete(s.id);
        return next;
      });
    } else {
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

  const startItemNum = filteredSerials.length === 0 ? 0 : (safePage - 1) * effectivePageSize + 1;
  const endItemNum = pageSize <= 0 ? filteredSerials.length : Math.min(safePage * effectivePageSize, filteredSerials.length);

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Serial Registry ({filteredSerials.length} of {allSerials.length})</h2>
      <p className="mb-3 text-xs text-gray-500">Right-click serial = copy · Click serial = details (kisne claim kiya, order, warranty)</p>

      <div className="mb-4 flex flex-wrap gap-2 text-xs">
        {Object.entries(counts).map(([k, v]) => (
          <button
            key={k}
            onClick={() => { setFilterStatus(filterStatus === k ? "" : k); setPage(1); }}
            className={`rounded-full px-3 py-1 font-semibold transition cursor-pointer ${
              filterStatus === k ? "ring-2 ring-white" : ""
            } ${SERIAL_BADGE[k] ?? ""}`}
          >
            {k}: {v}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => window.open("/admin/print", "_blank")}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90"
        >
          🖨️ Print Stickers
        </button>
        <span className="text-xs text-gray-500">Sticker/QR sheet — box pe chipkane ke liye (naya tab me khulta hai)</span>
      </div>

      <form onSubmit={handleGenerate} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-brand/20 bg-night-800 p-5">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Product</label>
          <select value={genProductId} onChange={(e) => setGenProductId(Number(e.target.value))} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm text-white">
            <option value="">Choose product…</option>
            {products?.map((p) => (
              <option key={p.id} value={p.id}>{p.modelCode} — {p.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Count</label>
          <input type="number" min={1} max={500} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-24 rounded border border-night-600 bg-night-900 px-3 py-2 text-sm text-white" />
        </div>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand/90">
          Generate Serials
        </button>
        {genMsg && <span className="text-xs text-gray-500">{genMsg}</span>}
      </form>

      {/* Filters + Search + Per Page + Bulk Delete */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-end gap-3 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[220px] flex-1">
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Search Serials</label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setSelected(new Set()); setPage(1); }}
              placeholder="🔍 Search Code, Product, Order #, User..."
              className="w-full rounded border border-night-600 bg-night-900 px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:border-brand focus:outline-none"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-6 text-xs text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Product Filter */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Filter Product</label>
            <select
              value={filterProduct}
              onChange={(e) => { setFilterProduct(e.target.value === "" ? "" : Number(e.target.value)); setSelected(new Set()); setPage(1); }}
              className="rounded border border-night-600 bg-night-900 px-3 py-1.5 text-xs text-white focus:border-brand"
            >
              <option value="">All products</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>{p.modelCode} — {p.name}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Filter Status</label>
            <select
              value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); setSelected(new Set()); setPage(1); }}
              className="rounded border border-night-600 bg-night-900 px-3 py-1.5 text-xs text-white focus:border-brand"
            >
              <option value="">All statuses</option>
              {Object.keys(counts).map((k) => (
                <option key={k} value={k}>{k} ({counts[k]})</option>
              ))}
            </select>
          </div>

          {/* Per Page Select */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-gray-500">Per Page</label>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); setSelected(new Set()); }}
              className="rounded border border-night-600 bg-night-900 px-2.5 py-1.5 text-xs text-white focus:border-brand"
            >
              <option value={5}>5 / page</option>
              <option value={10}>10 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={0}>Show All</option>
            </select>
          </div>
        </div>

        {selected.size > 0 && (
          <div className="self-end">
            <button
              onClick={handleBulkDelete}
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-1.5 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
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
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Filter/Search se kuch nahi mila — filter badal ke dekho.</td></tr>
            )}
            {allSerials.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Koi serial nahi — upar generate karo.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {filteredSerials.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-gray-400">
            <span>Showing <span className="font-semibold text-white">{startItemNum}–{endItemNum}</span> of <span className="font-semibold text-white">{filteredSerials.length}</span> serials</span>
            {selected.size > 0 && <span className="text-brand font-semibold">· {selected.size} selected</span>}
          </div>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="rounded border border-night-600 bg-night-900 px-2.5 py-1 text-xs font-semibold text-gray-300 hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed"
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
                      ? "border border-brand bg-brand text-white"
                      : "border border-night-600 bg-night-900 text-gray-400 hover:bg-night-700 hover:text-white"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="rounded border border-night-600 bg-night-900 px-2.5 py-1 text-xs font-semibold text-gray-300 hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          )}
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
      <CouponsSection />
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState<number>(5);
  const [page, setPage] = useState<number>(1);

  async function setStatus(c: WarrantyClaimRow, status: string) {
    if (!window.confirm(`${c.serialCode} claim ko "${status}" karna hai?`)) return;
    await updateWarrantyStatus(c.id, status);
    queryClient.invalidateQueries({ queryKey: ["admin-warranty"] });
  }

  const allClaims = claims ?? [];

  const filteredClaims = useMemo(() => {
    return allClaims.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchSerial = c.serialCode.toLowerCase().includes(q);
        const matchProduct = (c.serial?.product?.name || "").toLowerCase().includes(q);
        const matchUser = (c.user ? `${c.user.username} ${c.user.email || ""}` : "").toLowerCase().includes(q);
        const matchReason = (c.reason || "").toLowerCase().includes(q);
        const matchDesc = (c.description || "").toLowerCase().includes(q);

        if (!matchSerial && !matchProduct && !matchUser && !matchReason && !matchDesc) return false;
      }

      return true;
    });
  }, [allClaims, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const effectivePageSize = pageSize > 0 ? pageSize : filteredClaims.length || 1;
  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const pageClaims = pageSize > 0 ? filteredClaims.slice((safePage - 1) * pageSize, safePage * pageSize) : filteredClaims;

  if (isLoading) return <p className="text-gray-500">Loading warranty claims…</p>;

  const startItemNum = filteredClaims.length === 0 ? 0 : (safePage - 1) * effectivePageSize + 1;
  const endItemNum = pageSize <= 0 ? filteredClaims.length : Math.min(safePage * effectivePageSize, filteredClaims.length);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">
          Warranty Claims <span className="text-sm font-normal text-gray-400">({filteredClaims.length} of {allClaims.length})</span>
        </h2>
        {filteredClaims.length > 0 && (
          <div className="text-xs text-gray-400">
            Showing <span className="font-semibold text-white">{startItemNum}–{endItemNum}</span> of <span className="font-semibold text-white">{filteredClaims.length}</span> claims
          </div>
        )}
      </div>

      {/* Filter Controls */}
      <div className="mb-6 rounded-xl border border-brand/20 bg-night-800 p-4 space-y-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search Serial Code, Product Name, User, Reason, Description..."
            className="w-full rounded-lg border border-night-600 bg-night-900 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white">
              ✕ Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-gray-400 mr-1">Status:</span>
            {["all", "submitted", "approved", "rejected", "resolved"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 capitalize font-semibold transition ${
                  statusFilter === st ? "bg-brand text-white shadow-sm" : "bg-night-900 text-gray-400 hover:bg-night-700 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-400">Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-night-600 bg-night-900 px-2.5 py-1 text-xs text-white focus:border-brand focus:outline-none"
            >
              <option value={5}>5 Claims</option>
              <option value={10}>10 Claims</option>
              <option value={20}>20 Claims</option>
              <option value={50}>50 Claims</option>
              <option value={0}>Show All</option>
            </select>
          </div>
        </div>
      </div>

      {pageClaims.length === 0 ? (
        <div className="rounded-xl border border-brand/10 bg-night-800/50 p-8 text-center text-gray-400">
          {allClaims.length === 0 ? "Koi claim nahi." : "Is filter/search se koi claim nahi mila."}
        </div>
      ) : (
        <div className="space-y-4">
          {pageClaims.map((c) => (
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

      {pageSize > 0 && totalPages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-night-800 p-4 text-xs">
          <div className="text-gray-400">
            Page <span className="font-semibold text-white">{safePage}</span> of <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 font-semibold text-gray-300 hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <span key={p} className="flex items-center">
                    {showEllipsis && <span className="px-1 text-gray-500">…</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`h-7 min-w-[28px] rounded-lg px-2 text-xs font-semibold transition ${
                        safePage === p ? "bg-brand text-white" : "bg-night-900 text-gray-400 hover:bg-night-700 hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}

            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 font-semibold text-gray-300 hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
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

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState<number>(5);
  const [page, setPage] = useState<number>(1);

  async function setStatus(id: number, status: string) {
    await updateContactStatus(id, status);
    queryClient.invalidateQueries({ queryKey: ["admin-contact"] });
  }

  async function remove(id: number) {
    if (!window.confirm("Message delete karna hai?")) return;
    await deleteContact(id);
    queryClient.invalidateQueries({ queryKey: ["admin-contact"] });
  }

  const allMsgs = msgs ?? [];
  const newCount = allMsgs.filter((m) => m.status === "new").length;

  const filteredMsgs = useMemo(() => {
    return allMsgs.filter((m) => {
      if (statusFilter !== "all" && m.status !== statusFilter) return false;

      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchName = m.name.toLowerCase().includes(q);
        const matchUser = (m.user ? `${m.user.username} ${m.user.email || ""}` : "").toLowerCase().includes(q);
        const matchEmail = (m.email || "").toLowerCase().includes(q);
        const matchPhone = (m.phone || "").toLowerCase().includes(q);
        const matchSub = (m.subject || "").toLowerCase().includes(q);
        const matchMsg = (m.message || "").toLowerCase().includes(q);

        if (!matchName && !matchUser && !matchEmail && !matchPhone && !matchSub && !matchMsg) return false;
      }

      return true;
    });
  }, [allMsgs, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, pageSize]);

  const effectivePageSize = pageSize > 0 ? pageSize : filteredMsgs.length || 1;
  const totalPages = Math.max(1, Math.ceil(filteredMsgs.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const pageMsgs = pageSize > 0 ? filteredMsgs.slice((safePage - 1) * pageSize, safePage * pageSize) : filteredMsgs;

  if (isLoading) return <p className="text-gray-500">Loading messages…</p>;

  const startItemNum = filteredMsgs.length === 0 ? 0 : (safePage - 1) * effectivePageSize + 1;
  const endItemNum = pageSize <= 0 ? filteredMsgs.length : Math.min(safePage * effectivePageSize, filteredMsgs.length);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold">
          Contact / Feedback <span className="text-sm font-normal text-amber-500 font-semibold">({newCount} new)</span>
        </h2>
        {filteredMsgs.length > 0 && (
          <div className="text-xs text-gray-400">
            Showing <span className="font-semibold text-white">{startItemNum}–{endItemNum}</span> of <span className="font-semibold text-white">{filteredMsgs.length}</span> messages
          </div>
        )}
      </div>

      {/* Filter Controls */}
      <div className="mb-6 rounded-xl border border-brand/20 bg-night-800 p-4 space-y-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search Name, Account, Email, Phone, Subject, Message..."
            className="w-full rounded-lg border border-night-600 bg-night-900 px-4 py-2 text-sm text-white placeholder-gray-500 focus:border-brand focus:outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-white">
              ✕ Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-semibold text-gray-400 mr-1">Status:</span>
            {["all", "new", "read", "done"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`rounded-lg px-2.5 py-1 capitalize font-semibold transition ${
                  statusFilter === st ? "bg-brand text-white shadow-sm" : "bg-night-900 text-gray-400 hover:bg-night-700 hover:text-white"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-gray-400">Per Page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="rounded-lg border border-night-600 bg-night-900 px-2.5 py-1 text-xs text-white focus:border-brand focus:outline-none"
            >
              <option value={5}>5 Messages</option>
              <option value={10}>10 Messages</option>
              <option value={20}>20 Messages</option>
              <option value={50}>50 Messages</option>
              <option value={0}>Show All</option>
            </select>
          </div>
        </div>
      </div>

      {pageMsgs.length === 0 ? (
        <div className="rounded-xl border border-brand/10 bg-night-800/50 p-8 text-center text-gray-400">
          {allMsgs.length === 0 ? "Koi message nahi." : "Is filter/search se koi message nahi mila."}
        </div>
      ) : (
        <div className="space-y-3">
          {pageMsgs.map((m) => (
            <div key={m.id} className="rounded-xl border border-brand/20 bg-night-800 p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <span className="font-bold text-white">{m.name}</span>
                  {m.user ? (
                    <span className="ml-2 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400" title={`Account: ${m.user.email ?? ""}`}>
                      👤 {m.user.username}
                    </span>
                  ) : (
                    <span className="ml-2 rounded bg-night-900 px-1.5 py-0.5 text-[10px] text-gray-400 border border-night-600">Public</span>
                  )}
                  {m.email && <span className="ml-2 text-gray-400">{m.email}</span>}
                  {m.phone && <span className="ml-2 text-gray-400">{m.phone}</span>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${m.status === "new" ? "bg-amber-500/20 text-amber-600" : m.status === "read" ? "bg-blue-500/20 text-blue-700" : "bg-green-500/20 text-green-700"}`}>
                  {m.status}
                </span>
              </div>
              <div className="text-xs text-gray-400">{m.subject} · {new Date(m.createdAt).toLocaleString()}</div>
              <p className="mt-2 text-sm text-gray-200">{m.message}</p>
              <div className="mt-3 flex gap-2 text-xs">
                {m.status === "new" && (
                  <button onClick={() => setStatus(m.id, "read")} className="rounded bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700">Mark Read</button>
                )}
                {m.status !== "done" && (
                  <button onClick={() => setStatus(m.id, "done")} className="rounded bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700">Done</button>
                )}
                <button onClick={() => remove(m.id)} className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-400 hover:bg-red-900/60">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {pageSize > 0 && totalPages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/20 bg-night-800 p-4 text-xs">
          <div className="text-gray-400">
            Page <span className="font-semibold text-white">{safePage}</span> of <span className="font-semibold text-white">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 font-semibold text-gray-300 hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>

            {Array.from({ length: totalPages }, (_, idx) => idx + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .map((p, idx, arr) => {
                const prev = arr[idx - 1];
                const showEllipsis = prev && p - prev > 1;
                return (
                  <span key={p} className="flex items-center">
                    {showEllipsis && <span className="px-1 text-gray-500">…</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`h-7 min-w-[28px] rounded-lg px-2 text-xs font-semibold transition ${
                        safePage === p ? "bg-brand text-white" : "bg-night-900 text-gray-400 hover:bg-night-700 hover:text-white"
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}

            <button
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-lg border border-night-600 bg-night-900 px-3 py-1.5 font-semibold text-gray-300 hover:bg-night-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------- Coupons ----------------

function CouponsSection() {
  const queryClient = useQueryClient();
  const { data: coupons, isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: async () => {
      const res = await listCoupons();
      return res.success ? res.data : [];
    },
  });

  const [editingId, setEditingId] = useState<number | null>(null);

  const [form, setForm] = useState({
    code: "",
    discountType: "percentage",
    discountValue: "",
    minOrderAmount: "",
    maxDiscount: "",
    usageLimit: "",
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.code || !form.discountValue) return alert("Code and Discount Value required");
    const payload = {
      code: form.code,
      discountType: form.discountType as "percentage" | "fixed",
      discountValue: form.discountValue,
      minOrderAmount: form.minOrderAmount || null,
      maxDiscount: form.maxDiscount || null,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit) : null,
    };
    if (editingId) {
      await updateCoupon(editingId, payload);
    } else {
      await createCoupon(payload);
    }
    setForm({ code: "", discountType: "percentage", discountValue: "", minOrderAmount: "", maxDiscount: "", usageLimit: "" });
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
  }

  function handleEdit(c: any) {
    setEditingId(c.id);
    setForm({
      code: c.code,
      discountType: c.discountType,
      discountValue: c.discountValue,
      minOrderAmount: c.minOrderAmount || "",
      maxDiscount: c.maxDiscount || "",
      usageLimit: c.usageLimit ? String(c.usageLimit) : "",
    });
  }

  async function toggleActive(id: number, active: boolean) {
    await updateCoupon(id, { active });
    queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
  }

  async function handleDelete(id: number) {
    if (!window.confirm("Delete coupon?")) return;
    await deleteCoupon(id);
    queryClient.invalidateQueries({ queryKey: ["admin-coupons"] });
  }

  if (isLoading) return <p className="text-gray-500">Loading coupons…</p>;

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Coupons</h2>
      <form onSubmit={handleSave} className="mb-6 grid gap-4 rounded-xl border border-brand/20 bg-night-800 p-5 sm:grid-cols-2 lg:grid-cols-3">
        <input required placeholder="Code (e.g. FESTIVAL10) *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm text-white" />
        <select value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm text-white">
          <option value="percentage">Percentage (%)</option>
          <option value="fixed">Fixed Amount (₹)</option>
        </select>
        <input required placeholder={`Discount Value ${form.discountType === 'percentage' ? '(%)' : '(₹)'} *`} type="number" min={0} step="0.01" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm text-white" />
        <input placeholder="Min Order Amount (₹)" type="number" min={0} step="0.01" value={form.minOrderAmount} onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm text-white" />
        {form.discountType === 'percentage' && (
          <input placeholder="Max Discount (₹)" type="number" min={0} step="0.01" value={form.maxDiscount} onChange={(e) => setForm({ ...form, maxDiscount: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm text-white" />
        )}
        <input placeholder="Usage Limit (total uses)" type="number" min={1} value={form.usageLimit} onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} className="rounded border border-night-600 bg-night-900 px-3 py-2 text-sm text-white" />
        <div className="col-span-full flex gap-3">
          <button type="submit" className="rounded-lg bg-brand px-6 py-2 font-semibold text-white">{editingId ? "Update Coupon" : "Create Coupon"}</button>
          {editingId && (
            <button type="button" onClick={() => { setEditingId(null); setForm({ code: "", discountType: "percentage", discountValue: "", minOrderAmount: "", maxDiscount: "", usageLimit: "" }); }} className="rounded-lg bg-night-700 px-6 py-2 font-semibold text-white">Cancel</button>
          )}
        </div>
      </form>

      <div className="space-y-3">
        {coupons?.length === 0 ? <p className="text-gray-500">Koi active coupon nahi.</p> : coupons?.map(c => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-night-700 bg-night-900 p-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-lg">{c.code}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${c.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                  {c.active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-sm text-gray-400 mt-1">
                Discount: <span className="text-white font-medium">{c.discountType === 'percentage' ? `${c.discountValue}%` : `₹${c.discountValue}`}</span>
                {c.minOrderAmount && ` | Min Order: ₹${c.minOrderAmount}`}
                {c.maxDiscount && c.discountType === 'percentage' && ` | Max: ₹${c.maxDiscount}`}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Uses: {c.usedCount} {c.usageLimit ? `/ ${c.usageLimit}` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => handleEdit(c)} className="rounded border border-brand/40 bg-brand/10 px-3 py-1.5 text-sm font-semibold text-brand hover:bg-brand/20">
                Edit
              </button>
              <button onClick={() => toggleActive(c.id, !c.active)} className="rounded bg-night-800 px-3 py-1.5 text-sm font-semibold hover:bg-night-700 text-white">
                {c.active ? 'Deactivate' : 'Activate'}
              </button>
              <button onClick={() => handleDelete(c.id)} className="rounded bg-red-900/40 px-3 py-1.5 text-sm font-semibold text-red-500 hover:bg-red-900/60">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
