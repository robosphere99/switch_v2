import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import * as googleController from "../controllers/google.controller.js";

export const googleRouter = Router();

/** Middleware to extract and verify OAuth Access Token for Google requests */
const requireGoogleAuth = async (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Bearer token" });
  }
  const token = authHeader.substring(7);

  const oauthToken = await prisma.oAuthToken.findUnique({
    where: { accessToken: token },
  });

  if (!oauthToken || oauthToken.expiresAt < new Date()) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }

  const conn = await prisma.integrationConnection.findFirst({
    where: {
      userId: oauthToken.userId,
      homeId: oauthToken.homeId,
      provider: "google",
      status: "active",
    },
  });

  if (!conn) {
    return res.status(401).json({ error: "Google integration revoked" });
  }

  (req as any).oauthToken = oauthToken;
  next();
};

googleRouter.post("/fulfillment", requireGoogleAuth, googleController.fulfillment);
