import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";
import { validateBody } from "../middleware/validate";
import * as apiKeyController from "../controllers/apiKey.controller";

export const apiKeyRouter = Router();

const createKeyLimiter = rateLimit({
  name: "api-key:create",
  windowMs: 60 * 60_000,
  max: 20,
  message: "Bahut zyada API keys bana rahe ho — 1 ghanta baad try karo",
});

const createSchema = z.object({
  label: z.string().min(1).max(100).optional(),
  homeId: z.coerce.number().int().positive().optional(),
  expiresInDays: z.coerce.number().int().positive().max(3650).optional(),
});

apiKeyRouter.get("/", requireAuth, apiKeyController.listApiKeys);
apiKeyRouter.post("/", requireAuth, createKeyLimiter, validateBody(createSchema), apiKeyController.createApiKey);
apiKeyRouter.delete("/:id", requireAuth, apiKeyController.deleteApiKey);
