import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import * as oauthController from "../controllers/oauth.controller.js";

export const oauthRouter = Router();

const authorizeSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string(),
  homeId: z.number().int().positive(),
  provider: z.enum(["google", "alexa"]),
});

oauthRouter.post("/authorize", requireAuth, validateBody(authorizeSchema), oauthController.authorize);
oauthRouter.post("/token", oauthController.token);
