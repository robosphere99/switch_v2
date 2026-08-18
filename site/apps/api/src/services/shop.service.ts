import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { encryptSecret } from "../lib/crypto";
import { AppError } from "../lib/response";
import { createNotificationWithEmail } from "./notification.service";

export interface CreateOrderInput {
  userId: number;
  items: Array<{ productId: number; quantity: number }>;
  shipping: { name: string; phone: string; address: string };
  wifi?: { ssid?: string; password?: string };
  paymentMethod: "cod" | "upi" | "manual";
}

const ORDER_STATUS_FLOW: Record<string, string[]> = {
  pending: ["paid", "cancelled"],
  paid: ["shipped", "cancelled"],
  shipped: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export function makeOrderNumber(): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `RS${t}${r}`;
}

export function makeSerialCode(modelCode: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let rnd = "";
  for (let i = 0; i < 6; i++) rnd += chars[Math.floor(Math.random() * chars.length)];
  return `RS-${modelCode}-${rnd}`;
}

async function reserveSerials(
  tx: Prisma.TransactionClient,
  orderId: number,
  productId: number,
  qty: number,
): Promise<string[]> {
  const found = await tx.serialRegistry.findMany({
    where: { productId, status: "available" },
    orderBy: { id: "asc" },
    take: qty,
  });
  if (!found.length) return [];
  await tx.serialRegistry.updateMany({
    where: { id: { in: found.map((f) => f.id) } },
    data: { status: "reserved", orderId },
  });
  return found.map((f) => f.serialCode);
}

export async function createOrder(input: CreateOrderInput) {
  if (!input.items.length) throw new AppError("BAD_REQUEST", "Cart is empty");

  const products = await prisma.product.findMany({
    where: { id: { in: input.items.map((i) => i.productId) }, active: true },
  });
  if (!products.length) throw new AppError("NOT_FOUND", "No valid products in cart");

  const productMap = new Map(products.map((p) => [p.id, p]));
  let total = 0;
  for (const it of input.items) {
    const prod = productMap.get(it.productId);
    if (!prod) throw new AppError("NOT_FOUND", `Product ${it.productId} not found`);
    if (!Number.isInteger(it.quantity) || it.quantity < 1) {
      throw new AppError("BAD_REQUEST", `Invalid quantity for ${prod.name}`);
    }
    total += Number(prod.price) * it.quantity;
  }

  const wifiPasswordEnc = input.wifi?.password ? encryptSecret(input.wifi.password) : null;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber: makeOrderNumber(),
        userId: input.userId,
        paymentMethod: input.paymentMethod,
        paymentStatus: input.paymentMethod === "cod" ? "pending" : "unpaid",
        totalAmount: total,
        shippingName: input.shipping.name,
        shippingPhone: input.shipping.phone,
        shippingAddress: input.shipping.address,
        wifiSsid: input.wifi?.ssid?.trim() || null,
        wifiPasswordEnc,
      },
    });
    for (const it of input.items) {
      const prod = productMap.get(it.productId)!;
      const serials = await reserveSerials(tx, created.id, prod.id, it.quantity);
      await tx.orderItem.create({
        data: {
          orderId: created.id,
          productId: prod.id,
          productName: prod.name,
          price: prod.price,
          quantity: it.quantity,
          serialCode: serials[0] ?? null,
        },
      });
    }
    return tx.order.findUniqueOrThrow({
      where: { id: created.id },
      include: { items: true },
    });
  });

  // Order place hote hi user ko INFO notification + EMAIL (Phase 6).
  try {
    await createNotificationWithEmail(
      input.userId,
      {
        category: "system",
        type: "info",
        title: "📦 Order placed",
        body: `Order ${order.orderNumber} — ₹${Number(order.totalAmount).toLocaleString("en-IN")}, ${order.items.length} item(s). Status: ${order.status}.`,
      },
      {
        emailSubject: `📦 Order ${order.orderNumber} placed — ₹${Number(order.totalAmount).toLocaleString("en-IN")}`,
        ctaUrl: "/orders",
        ctaLabel: "Order dekho",
      },
    );
  } catch (err) {
    // Notification failure se order kabhi fail na ho.
    console.error("[shop] order notification failed", err);
  }

  return order;
}

export async function generateSerials(productId: number, count: number): Promise<string[]> {
  if (count < 1 || count > 500) throw new AppError("BAD_REQUEST", "Count must be between 1 and 500");
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("NOT_FOUND", "Product not found");

  const data: Array<{ serialCode: string; productId: number }> = [];
  while (data.length < count) {
    const code = makeSerialCode(product.modelCode);
    const exists = await prisma.serialRegistry.findUnique({ where: { serialCode: code } });
    if (!exists) data.push({ serialCode: code, productId });
  }
  await prisma.serialRegistry.createMany({ data });
  return data.map((d) => d.serialCode);
}

export async function updateOrderStatus(orderId: number, status: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  if (!(status in ORDER_STATUS_FLOW)) {
    throw new AppError("BAD_REQUEST", `Invalid status ${status}`);
  }
  const allowed = ORDER_STATUS_FLOW[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw new AppError("BAD_REQUEST", `Cannot move order from ${order.status} to ${status}`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (status === "cancelled") {
      // Release reserved serials back to stock.
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id },
        data: { status: "available", orderId: null },
      });
    } else if (status === "shipped") {
      // Make sure every item has a serial — top up from available stock.
      for (const item of order.items) {
        if (item.serialCode) continue;
        const need = item.quantity;
        const found = await tx.serialRegistry.findMany({
          where: { productId: item.productId, status: "available" },
          orderBy: { id: "asc" },
          take: need,
        });
        if (found.length) {
          await tx.serialRegistry.updateMany({
            where: { id: { in: found.map((f) => f.id) } },
            data: { status: "shipped", orderId: order.id },
          });
          await tx.orderItem.update({
            where: { id: item.id },
            data: { serialCode: found[0].serialCode },
          });
        }
      }
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id, status: "reserved" },
        data: { status: "shipped" },
      });
    } else if (status === "delivered") {
      await tx.serialRegistry.updateMany({
        where: { orderId: order.id, status: { in: ["shipped", "reserved"] } },
        data: { status: "delivered" },
      });
    }

    return tx.order.update({
      where: { id: order.id },
      data: {
        status: status as "pending" | "paid" | "shipped" | "delivered" | "cancelled",
        paymentStatus: status === "paid" ? "paid" : order.paymentStatus,
        ...(status === "shipped" ? { shippedAt: new Date() } : {}),
        ...(status === "delivered" ? { deliveredAt: new Date() } : {}),
      },
      include: { items: true, user: { select: { id: true, username: true, email: true } } },
    });
  });

  // Payment verified → user ko notification + EMAIL.
  if (status === "paid") {
    try {
      await createNotificationWithEmail(
        updated.userId,
        {
          category: "system",
          type: "info",
          title: "✅ Payment verified",
          body: `Order ${updated.orderNumber} ka payment verify ho gaya — aapka order taiyaar ho raha hai.`,
        },
        { emailSubject: `✅ Payment verified — order ${updated.orderNumber}`, ctaUrl: "/orders", ctaLabel: "Order dekho" },
      );
    } catch (err) {
      console.error("[shop] payment notification failed", err);
    }
  }

  // Serial keys user ko notification + EMAIL me — shipped/delivered pe turant pata chale.
  if (status === "shipped" || status === "delivered") {
    const serialCodes = (updated.items ?? [])
      .map((i) => i.serialCode)
      .filter((c): c is string => Boolean(c));
    const keys = serialCodes.length ? serialCodes.join(", ") : "box sticker pe milenge";
    try {
      await createNotificationWithEmail(
        updated.userId,
        {
          category: "system",
          type: "info",
          title: status === "shipped" ? "🚚 Order shipped" : "📦 Order delivered",
          body:
            status === "shipped"
              ? `Order ${updated.orderNumber} ship ho gaya. Aapke serial keys: ${keys} — Activate page pe daal kar device link karo.`
              : `Order ${updated.orderNumber} deliver ho gaya! Serial keys: ${keys} — Activate page pe daal kar device add karo (box sticker pe bhi hain).`,
        },
        {
          emailSubject: status === "shipped" ? `🚚 Order ${updated.orderNumber} shipped` : `📦 Order ${updated.orderNumber} delivered`,
          emailBody:
            status === "shipped"
              ? `Order ${updated.orderNumber} ship ho gaya. Serial keys: ${keys}\n\nActivate page pe serial daal kar device link karo.`
              : `Order ${updated.orderNumber} deliver ho gaya! Serial keys: ${keys}\n\nActivate page pe serial daal kar device add karo (box sticker pe bhi hain).`,
          ctaUrl: status === "shipped" ? "/activate" : "/activate",
          ctaLabel: "Device activate karo",
        },
      );
    } catch (err) {
      console.error("[shop] status notification failed", err);
    }
  }

  return updated;
}
