import { Router } from "express";
import { prisma } from "../lib/prisma";
import { updateOrderStatus } from "../services/shop.service";
import { verifyRazorpayWebhook } from "../services/payment.service";
import { logger } from "../lib/logger";

export const webhookRouter = Router();

// Endpoint for razorpay webhooks
// Make sure app.ts parses this route with express.raw(), so req.body is a Buffer
webhookRouter.post("/razorpay", async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string") {
        logger.warn("Razorpay Webhook: Missing signature");
        return res.status(401).send("Missing signature");
    }

    // Fallback to body parsing check
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : null;
    if (!rawBody) {
        logger.error("Razorpay Webhook: No raw body found. Ensure express.raw() is configured.");
        return res.status(400).send("No raw body found");
    }

    try {
        if (!verifyRazorpayWebhook(rawBody, signature)) {
            logger.warn("Razorpay Webhook: Invalid signature");
            return res.status(401).send("Invalid signature");
        }

        const payload = JSON.parse(rawBody);
        const event = payload.event;

        // We only care about successful payment or order paid webhook.
        // Razorpay sends "payment.captured" or "order.paid".
        if (event === "payment.captured" || event === "order.paid") {
            const paymentEntity = event === "payment.captured" ? payload.payload.payment.entity : null;
            const orderEntity = event === "order.paid" ? payload.payload.order.entity : null;

            const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id;
            const paymentId = paymentEntity?.id || null;

            if (!razorpayOrderId) {
                logger.warn("Razorpay Webhook: No order ID in payload for event " + event);
                return res.status(200).send("OK");
            }

            // Find the order in DB
            const order = await prisma.order.findFirst({
                where: { razorpayOrderId },
            });

            if (!order) {
                logger.warn(`Razorpay Webhook: Order not found for RP order ID ${razorpayOrderId}`);
                return res.status(200).send("OK");
            }

            // If it's already past pending, nothing to do
            if (order.status !== "pending") {
                return res.status(200).send("OK");
            }

            // Mark order as paid
            await prisma.order.update({
                where: { id: order.id },
                data: {
                    paidAt: new Date(),
                    paymentRef: paymentId || "Webhook Automatically Paid",
                },
            });

            // Invoke service logic to handle factory allocation
            await updateOrderStatus(order.id, "processing");

            logger.info(`Razorpay Webhook: Order ${order.id} marked as processing via webhook.`);
        }

        // Always return 200 OK to acknowledge webhook
        res.status(200).send("OK");
    } catch (error) {
        logger.error("Razorpay Webhook Error:", error instanceof Error ? error.message : String(error));
        res.status(500).send("Internal Error");
    }
});
