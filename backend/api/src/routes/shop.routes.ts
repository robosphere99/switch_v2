import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/auth";
import * as shopController from "../controllers/shop.controller";

export const shopRouter = Router();

import { cloudinaryBillingStorage } from "../lib/cloudinary";

const upload = multer({ storage: cloudinaryBillingStorage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB

// Public: products & reviews & coupons
shopRouter.get("/products", shopController.getProducts);
shopRouter.get("/products/:id/reviews", shopController.getProductReviews);
shopRouter.get("/coupons/validate", requireAuth, shopController.validateCoupon);

// Media Upload
shopRouter.post("/upload", requireAuth, upload.single("file"), shopController.uploadMedia);

// Product Reviews
shopRouter.post("/products/:id/reviews", requireAuth, shopController.addProductReview);

// Orders
shopRouter.post("/orders", requireAuth, shopController.createShopOrder);
shopRouter.get("/orders", requireAuth, shopController.getShopOrders);
shopRouter.get("/orders/:id/stickers", requireAuth, shopController.getOrderStickers);
shopRouter.post("/orders/:id/cancel", requireAuth, shopController.cancelShopOrder);

// Payment
shopRouter.post("/orders/:id/pay", requireAuth, shopController.initiatePayment);
shopRouter.post("/orders/:id/pay/verify", requireAuth, shopController.verifyPayment);
shopRouter.post("/orders/:id/pay/demo", requireAuth, shopController.demoPayment);

// WiFi
shopRouter.get("/wifi/current", requireAuth, shopController.getCurrentWifi);
