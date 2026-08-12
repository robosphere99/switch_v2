import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { prisma } from "../lib/prisma";
import { AppError, ok } from "../lib/response";
import { audit } from "../services/audit.service";
import { createOrder } from "../services/shop.service";
import { createRazorpayOrder, razorpayConfigured, verifyRazorpaySignature } from "../services/payment.service";

export const shopRouter = Router();

// ---------- Public: products ----------

shopRouter.get("/products", async (_req, res) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  });
  ok(res, products);
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
  ok(res, orders);
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
  await prisma.$transaction([
    prisma.serialRegistry.updateMany({
      where: { orderId: id },
      data: { status: "available", orderId: null },
    }),
    prisma.order.update({ where: { id }, data: { status: "cancelled" } }),
  ]);
  await audit(req.user!.sub, "shop.order.cancel", { entity: "order", entityId: id });
  ok(res, { cancelled: true });
});

// ---------- Payment (Razorpay + demo mode) ----------

/** Payment initiate — Razorpay configured ho to order banao, warna demo UPI intent. */
shopRouter.post("/orders/:id/pay", requireAuth, async (req, res) => {
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
    const upiIntent = `upi://pay?pa=robosphere@okaxis&pn=RoboSphere&am=${Number(order.totalAmount).toFixed(2)}&tn=Order%20${order.orderNumber}`;
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
  await prisma.order.update({ where: { id }, data: { status: "paid", paidAt: new Date(), paymentRef: razorpayPaymentId } });
  await audit(req.user!.sub, "shop.payment.verified", { entity: "order", entityId: id, meta: { paymentId: razorpayPaymentId } });
  ok(res, { paid: true, status: "paid", paymentRef: razorpayPaymentId });
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
  await prisma.order.update({ where: { id }, data: { status: "paid", paidAt: new Date(), paymentRef: ref } });
  await audit(req.user!.sub, "shop.payment.demo", { entity: "order", entityId: id, meta: { ref, total: Number(order.totalAmount) } });
  ok(res, { paid: true, status: "paid", paymentRef: ref });
});
