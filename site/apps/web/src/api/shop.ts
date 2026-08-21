import { api } from "./client";

// ---------- Types ----------

export interface Product {
  id: number;
  name: string;
  modelCode: string;
  relayCount: number;
  price: string;
  description: string | null;
  features: Record<string, unknown> | null;
  imageUrl: string | null;
  active: boolean;
  createdAt: string;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  productName: string;
  price: string;
  quantity: number;
  serialCode: string | null;
}

export interface Order {
  id: number;
  orderNumber: string;
  userId: number;
  status: "pending" | "processing" | "packed" | "shipped" | "delivered" | "cancelled";
  paymentMethod: "cod" | "upi" | "manual";
  paymentStatus: string;
  paymentRef: string | null;
  razorpayOrderId: string | null;
  paidAt: string | null;
  totalAmount: string;
  shippingName: string;
  shippingPhone: string;
  shippingAddress: string;
  wifiSsid: string | null;
  createdAt: string;
  /** Bill QR ke liye HMAC-signed verify token (admin order detail me aata hai). */
  verifyToken?: string;
  items: OrderItem[];
  user?: { id: number; username: string; email: string };
}

export interface SerialRow {
  id: number;
  serialCode: string;
  productId: number;
  orderId: number | null;
  userId: number | null;
  homeId: number | null;
  status: "available" | "reserved" | "shipped" | "delivered" | "claimed";
  createdAt: string;
  claimedAt: string | null;
  product: { id: number; name: string; modelCode: string };
  user?: { id: number; username: string; email: string } | null;
  order?: { id: number; orderNumber: string; status: string } | null;
  orderIdx?: number;   // order ke andar device number (1-based) — sticker hotspot ke liye
  orderTotal?: number; // order me total serials
}

export interface SerialDetail {
  id: number;
  serialCode: string;
  productId: number;
  orderId: number | null;
  userId: number | null;
  homeId: number | null;
  status: string;
  createdAt: string;
  claimedAt: string | null;
  testedAt: string | null;
  warrantyExpiresAt: string | null;
  warrantyStatus: string;
  product: { id: number; name: string; modelCode: string };
  user?: { id: number; username: string; email: string } | null;
  order?: { id: number; orderNumber: string; status: string } | null;
  home?: { id: number; name: string } | null;
}

// ---------- Shop (public) ----------

export async function getProducts(): Promise<Product[]> {
  const { data } = await api.get("/shop/products");
  return data.data;
}

// ---------- Orders ----------

export async function createOrder(payload: {
  items: Array<{ productId: number; quantity: number }>;
  shipping: { name: string; phone: string; address: string };
  wifi?: { ssid: string; password: string };
  paymentMethod: "cod" | "upi" | "manual";
}): Promise<Order> {
  const { data } = await api.post("/shop/orders", payload);
  return data.data;
}

export async function getMyOrders(): Promise<Order[]> {
  const { data } = await api.get("/shop/orders");
  return data.data;
}

export async function cancelOrder(id: number): Promise<void> {
  await api.post(`/shop/orders/${id}/cancel`);
}

// ---------- Claim ----------

export async function getClaimHomes(): Promise<Array<{ id: number; name: string }>> {
  const { data } = await api.get("/claim/homes");
  return data.data;
}

export async function claimDevice(serialCode: string, homeId: number) {
  const { data } = await api.post("/claim", { serialCode, homeId });
  return data.data;
}

// ---------- Admin ----------

export async function getAdminProducts(): Promise<Array<Product & { _count: { serials: number } }>> {
  const { data } = await api.get("/admin/products");
  return data.data;
}

export async function createAdminProduct(payload: {
  name: string;
  modelCode: string;
  relayCount: number;
  price: number;
  description?: string;
  features?: string;
  imageUrl?: string;
}): Promise<Product> {
  const { data } = await api.post("/admin/products", payload);
  return data.data;
}

export async function updateAdminProduct(
  id: number,
  payload: Partial<{ name: string; price: number; description: string; features: string; imageUrl: string; active: boolean }>,
): Promise<Product> {
  const { data } = await api.patch(`/admin/products/${id}`, payload);
  return data.data;
}

export async function deleteAdminProduct(id: number): Promise<void> {
  await api.delete(`/admin/products/${id}`);
}

export async function getAdminOrders(): Promise<Order[]> {
  const { data } = await api.get("/admin/orders");
  return data.data;
}

export async function getAdminOrder(id: number): Promise<Order> {
  const { data } = await api.get(`/admin/orders/${id}`);
  return data.data;
}

export async function updateOrderStatus(id: number, status: string): Promise<Order> {
  const { data } = await api.patch(`/admin/orders/${id}/status`, { status });
  return data.data;
}

export async function updateOrderPaymentStatus(id: number, paymentStatus: string): Promise<Order> {
  const { data } = await api.patch(`/admin/orders/${id}/payment-status`, { paymentStatus });
  return data.data;
}

export async function getSerials(filters?: { status?: string; productId?: number }): Promise<SerialRow[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.productId) params.set("productId", String(filters.productId));
  const qs = params.toString();
  const { data } = await api.get(`/admin/serials${qs ? `?${qs}` : ""}`);
  return data.data;
}

export async function generateSerials(productId: number, count: number): Promise<{ generated: number; codes: string[] }> {
  const { data } = await api.post("/admin/serials/generate", { productId, count });
  return data.data;
}

export async function getSerialDetail(serialCode: string): Promise<SerialDetail> {
  const { data } = await api.get(`/admin/serials/${encodeURIComponent(serialCode)}`);
  return data.data;
}

export async function deleteSerial(serialCode: string): Promise<void> {
  await api.delete(`/admin/serials/${encodeURIComponent(serialCode)}`);
}

export async function deleteSerials(codes: string[]): Promise<{ deleted: number; skipped: number }> {
  const { data } = await api.delete("/admin/serials", { data: { codes } });
  return data.data;
}

// ---------- Payment ----------

export interface PayIntent {
  mode: "razorpay" | "demo";
  razorpayOrderId?: string;
  keyId?: string;
  upiIntent?: string;
  amount: number;
  note?: string;
}

export async function initiatePayment(orderId: number): Promise<PayIntent> {
  const { data } = await api.post(`/shop/orders/${orderId}/pay`);
  return data.data;
}

export async function verifyPayment(orderId: number, payload: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}) {
  const { data } = await api.post(`/shop/orders/${orderId}/pay/verify`, payload);
  return data.data;
}

export async function demoPay(orderId: number): Promise<{ paid: boolean; status: string; paymentRef: string }> {
  const { data } = await api.post(`/shop/orders/${orderId}/pay/demo`);
  return data.data;
}

// ---------- Warranty ----------

export interface WarrantyDevice {
  serialCode: string;
  productName?: string;
  modelCode?: string;
  product?: { name: string; modelCode: string };
  warrantyStatus: string;
  warrantyExpiresAt: string | null;
  claimedAt: string | null;
}

export interface WarrantyClaimRow {
  id: number;
  serialCode: string;
  userId: number;
  reason: string;
  description: string | null;
  status: "submitted" | "approved" | "rejected" | "resolved";
  createdAt: string;
  user?: { id: number; username: string; email: string };
  serial?: { serialCode: string; warrantyStatus: string; warrantyExpiresAt: string | null; product?: { name: string; modelCode: string } } | null;
}

export async function getWarrantyStatus(serial: string): Promise<WarrantyDevice> {
  const { data } = await api.get(`/warranty/status?serial=${encodeURIComponent(serial)}`);
  return data.data;
}

export async function fileWarrantyClaim(payload: { serialCode: string; reason: string; description?: string }) {
  const { data } = await api.post("/warranty", payload);
  return data.data;
}

export async function getMyWarranty(): Promise<{ claims: WarrantyClaimRow[]; serials: WarrantyDevice[] }> {
  const { data } = await api.get("/warranty/mine");
  return data.data;
}

export async function getAdminWarranty(): Promise<WarrantyClaimRow[]> {
  const { data } = await api.get("/admin/warranty");
  return data.data;
}

export async function updateWarrantyStatus(id: number, status: string): Promise<{ id: number; status: string }> {
  const { data } = await api.patch(`/admin/warranty/${id}/status`, { status });
  return data.data;
}
