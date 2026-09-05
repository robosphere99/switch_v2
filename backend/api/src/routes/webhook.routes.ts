import { Router } from "express";
import * as webhookController from "../controllers/webhook.controller";

export const webhookRouter = Router();

// Endpoint for razorpay webhooks
// Make sure app.ts parses this route with express.raw(), so req.body is a Buffer
webhookRouter.post("/razorpay", webhookController.handleRazorpayWebhook);
