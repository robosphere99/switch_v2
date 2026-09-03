import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import * as warrantyController from "../controllers/warranty.controller";

export const warrantyRouter = Router();

const statusLimiter = rateLimit({
  name: "warranty:status",
  windowMs: 60_000,
  max: 30,
  message: "Bahut zyada serial checks — thodi der baad try karo",
});
const claimLimiter = rateLimit({
  name: "warranty:claim",
  windowMs: 60 * 60_000,
  max: 10,
  message: "Bahut zyada claim attempts — 1 ghanta baad try karo",
});
const mineLimiter = rateLimit({
  name: "warranty:mine",
  windowMs: 60_000,
  max: 60,
});

warrantyRouter.use(requireAuth);

warrantyRouter.get("/status", statusLimiter, warrantyController.getWarrantyStatus);
warrantyRouter.post("/", claimLimiter, warrantyController.fileWarrantyClaim);
warrantyRouter.get("/mine", mineLimiter, warrantyController.getMyWarranty);
