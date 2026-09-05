import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import * as claimController from "../controllers/claim.controller";

export const claimRouter = Router();

const claimLimiter = rateLimit({
  name: "claim:create",
  windowMs: 60 * 60_000,
  max: 20,
  message: "Bahut zyada claim attempts — 1 ghanta baad try karo",
});
const claimHomesLimiter = rateLimit({
  name: "claim:homes",
  windowMs: 60_000,
  max: 60,
});

claimRouter.use(requireAuth);

claimRouter.get("/homes", claimHomesLimiter, claimController.getClaimableHomes);
claimRouter.post("/", claimLimiter, claimController.claimDevice);
