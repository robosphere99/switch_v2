import { Router } from "express";
import multer from 'multer';
import path from 'path';
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { audit } from "../services/audit.service";
import { createOrder, updateOrderStatus } from "../services/shop.service";
import { createRazorpayOrder, razorpayConfigured, verifyRazorpaySignature } from "../services/payment.service";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);

export const shopRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB


// ---------- Public: products ----------

shopRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { media: true },
    orderBy: { id: "asc" },
  });
  ok(res, products);
});


// ---------- Media Upload ----------
shopRouter.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) throw new AppError('BAD_REQUEST', 'No file uploaded');
  ok(res, { url: `/uploads/${req.file.filename}` });
});

// ---------- Product Reviews ----------
shopRouter.get('/products/:id/reviews', async (req, res) => {
  const reviews = await prisma.productReview.findMany({
    where: { productId: Number(req.params.id) },
    include: { user: { select: { username: true, avatarUrl: true } }, media: true },
    orderBy: { createdAt: 'desc' }
  });
  ok(res, reviews);
});

shopRouter.post('/products/:id/reviews', requireAuth, async (req, res) => {
  const productId = Number(req.params.id);
  const { rating, comment, mediaUrls } = req.body;
  if (!rating || rating < 1 || rating > 5) throw new AppError('BAD_REQUEST', 'Valid rating (1-5) required');
  
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError('NOT_FOUND', 'Product not found');

  const review = await prisma.$transaction(async (tx) => {
    const rev = await tx.productReview.create({
      data: {
        productId,
        userId: req.user!.sub,
        rating,
        comment,
        media: {
          create: (mediaUrls || []).map((url: string) => ({ url, type: url.match(/\.(mp4|mov|webm)$/i) ? 'video' : 'image' }))
        }
      },
      include: { media: true, user: { select: { username: true } } }
    });

    // Update aggregate rating
    const all = await tx.productReview.findMany({ where: { productId }, select: { rating: true } });
    const total = all.length;
    const avg = all.reduce((sum, r) => sum + Number(r.rating), 0) / total;
    
    await tx.product.update({
      where: { id: productId },
      data: { rating: avg, totalReviews: total }
    });
    
    return rev;
  });
  
  ok(res, review, 201);
});

// ---------- Auth: orders ----------

shopRouter.post("/orders", requireAuth, async (req, res) => {
  const { items, shipping, wifi, paymentMethod } = req.body ?? {};
  if (!Array.isArray(items) || !items.length) {
    throw new AppError("BAD_REQUEST", "Cart is empty");
  }
  if (!shipping?.name || !shipping?.phone || !shipping?.address) {
    throw new AppError("BAD_REQUEST", "Shipping name, phone and address are required");
  }
  const method = String(paymentMethod ?? "cod");
  if (!["cod", "upi", "manual"].includes(method)) {
    throw new AppError("BAD_REQUEST", "Invalid payment method");
  }

  const order = await createOrder({
    userId: req.user!.sub,
    items: items.map((i: { productId?: unknown; quantity?: unknown }) => ({
      productId: Number(i.productId),
      quantity: Number(i.quantity),
    })),
    shipping: {
      name: String(shipping.name).slice(0, 100),
      phone: String(shipping.phone).slice(0, 20),
      address: String(shipping.address).slice(0, 255),
    },
    wifi: wifi?.ssid || wifi?.password
      ? { ssid: String(wifi.ssid ?? ""), password: String(wifi.password ?? "") }
      : undefined,
    paymentMethod: method as "cod" | "upi" | "manual",
  });

  await audit(req.user!.sub, "shop.order.create", {
    entity: "order",
    entityId: order.id,
    meta: { orderNumber: order.orderNumber, total: Number(order.totalAmount) },
  });
  ok(res, order, 201);
});

shopRouter.get("/orders", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.sub },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  // Har order pe allClaimed flag — saare serials already activate ho chuke hain?
  // UI isse "Activate Now" button chhupata hai (delivered order pe bhi).
  const serialCodes = [...new Set(orders.flatMap((o) => o.items.map((i) => i.serialCode).filter(Boolean) as string[]))];
  const claimedSet = new Set<string>();
  if (serialCodes.length > 0) {
    const rows = await prisma.serialRegistry.findMany({
      where: { serialCode: { in: serialCodes } },
      select: { serialCode: true, status: true },
    });
    for (const r of rows) {
      if (r.status === "claimed") claimedSet.add(r.serialCode);
    }
  }
  ok(
    res,
    orders.map((o) => {
      const codes = (o.items.map((i) => i.serialCode).filter(Boolean) as string[]);
      return {
        ...o,
        allClaimed: codes.length > 0 && codes.every((c) => claimedSet.has(c)),
      };
    }),
  );
});

/** Order ke stickers (hotspot naam + QR) — sirf order ka apna user dekh sakta hai.
 * Har serial ke saath order ke andar device number (orderIdx) + total (orderTotal)
 * aata hai — `username_XXXXXX_2` jaisa hotspot naam banane ke liye.
 */
shopRouter.get("/orders/:id/stickers", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    select: { id: true, orderNumber: true, userId: true, status: true },
  });
  if (!order || order.userId !== req.user!.sub) {
    throw new AppError("NOT_FOUND", "Order not found", 404);
  }
  const serials = await prisma.serialRegistry.findMany({
    where: { orderId: id },
    include: {
      product: { select: { id: true, name: true, modelCode: true } },
      user: { select: { id: true, username: true, email: true } },
      order: { select: { id: true, orderNumber: true, status: true } },
    },
    orderBy: { id: "asc" },
  });
  const enriched = serials.map((s, i) => ({
    ...s,
    orderIdx: i + 1,
    orderTotal: serials.length,
  }));
  ok(res, { orderId: id, orderNumber: order.orderNumber, status: order.status, serials: enriched });
});

shopRouter.post("/orders/:id/cancel", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user!.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be cancelled");
  }
  await updateOrderStatus(id, "cancelled");
  await audit(req.user!.sub, "shop.order.cancel", { entity: "order", entityId: id });
  ok(res, { cancelled: true });
});

// ---------- Payment (Razorpay + demo mode) ----------

/** Payment initiate — Razorpay configured ho to order banao, warna demo UPI intent. */
shopRouter.post("/orders/:id/pay", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  console.log(`[BACKEND PAYMENT DEBUG] Initiate payment requested for Order ID: ${id}`);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user!.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be paid");
  }
  if (order.paymentMethod === "cod") {
    throw new AppError("BAD_REQUEST", "COD order me online payment nahi hoti");
  }

  if (razorpayConfigured()) {
    const rp = await createRazorpayOrder(Number(order.totalAmount), `order_${order.id}`);
    await prisma.order.update({
      where: { id },
      data: { razorpayOrderId: String(rp.id) },
    });
    await audit(req.user!.sub, "shop.payment.initiate", {
      entity: "order", entityId: id, meta: { razorpayOrderId: rp.id, total: Number(order.totalAmount) },
    });
    ok(res, { mode: "razorpay", razorpayOrderId: rp.id, amount: Number(order.totalAmount), keyId: process.env.RAZORPAY_KEY_ID ?? "" });
  } else {
    const upiIntent = `upi://pay?pa=switchnest@okaxis&pn=SwitchNest&am=${Number(order.totalAmount).toFixed(2)}&tn=Order%20${order.orderNumber}`;
    await audit(req.user!.sub, "shop.payment.initiate", {
      entity: "order", entityId: id, meta: { mode: "demo", upiIntent, total: Number(order.totalAmount) },
    });
    ok(res, { mode: "demo", upiIntent, amount: Number(order.totalAmount), note: "Demo mode — UPI app se pay karke 'Paid' verify karo" });
  }
});

/** Razorpay checkout callback — signature verify karke order PAID. */
shopRouter.post("/orders/:id/pay/verify", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body ?? {};
  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new AppError("BAD_REQUEST", "razorpayOrderId, razorpayPaymentId, razorpaySignature required");
  }
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user!.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.razorpayOrderId !== razorpayOrderId) {
    throw new AppError("BAD_REQUEST", "Razorpay order mismatch");
  }
  if (!verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)) {
    throw new AppError("PAYMENT_ERROR", "Signature verify fail");
  }
  await prisma.order.update({ where: { id }, data: { paidAt: new Date(), paymentRef: razorpayPaymentId } });

  // NATIVELY INVOKE the inventory allocation engine via the shared service layer
  const updatedOrder = await updateOrderStatus(id, "processing");

  await audit(req.user!.sub, "shop.payment.verified", { entity: "order", entityId: id, meta: { paymentId: razorpayPaymentId } });
  ok(res, { paid: true, status: "processing", paymentRef: razorpayPaymentId });
});

/** Demo mode — UPI manual pay ke baad admin/tester mark paid. */
shopRouter.post("/orders/:id/pay/demo", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== req.user!.sub) {
    throw new AppError("NOT_FOUND", "Order not found");
  }
  if (order.status !== "pending") {
    throw new AppError("BAD_REQUEST", "Only pending orders can be paid");
  }
  if (order.paymentMethod === "cod") {
    throw new AppError("BAD_REQUEST", "COD order me online payment nahi hoti");
  }
  const ref = `DEMO-${Date.now()}`;
  await prisma.order.update({ where: { id }, data: { paidAt: new Date(), paymentRef: ref } });

  // NATIVELY INVOKE the inventory allocation engine via the shared service layer
  await updateOrderStatus(id, "processing");

  await audit(req.user!.sub, "shop.payment.demo", { entity: "order", entityId: id, meta: { ref, total: Number(order.totalAmount) } });
  ok(res, { paid: true, status: "processing", paymentRef: ref });
});

shopRouter.get("/wifi/current", requireAuth, async (req, res) => {
  const platform = os.platform();
  try {
    let ssid: string | null = null;
    if (platform === "win32") {
      const { stdout } = await execAsync("netsh wlan show interfaces");
      const match = stdout.match(/^\s*SSID\s*:\s*(.+)$/m);
      ssid = match ? match[1].trim() : null;
    } else if (platform === "darwin") {
      const { stdout } = await execAsync("/System/Library/PrivateFrameworks/Apple80211.framework/Resources/airport -I");
      const match = stdout.match(/^\s*SSID\s*:\s*(.+)$/m);
      ssid = match ? match[1].trim() : null;
    } else {
      const { stdout } = await execAsync("iwgetid -r");
      ssid = stdout.trim() || null;
    }
    ok(res, { ssid });
  } catch (err) {
    console.error("Failed to query WiFi interface:", err);
    ok(res, { ssid: null });
  }
});
