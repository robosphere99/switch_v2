import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import crypto from "crypto";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { AppError, ok } from "../lib/response.js";

export const oauthRouter = Router();

// Validation schema for authorizing a connection
const authorizeSchema = z.object({
  client_id: z.string(),
  redirect_uri: z.string().url(),
  state: z.string(),
  homeId: z.number().int().positive(),
  provider: z.enum(["google", "alexa"]),
});

/**
 * 1. POST /api/oauth/authorize
 * Called by frontend Consent page after user selects a Home and clicks "Allow".
 * Generates an Authorization Code and returns the final redirect URL.
 */
oauthRouter.post("/authorize", requireAuth, async (req: Request, res: Response) => {
  const parsed = authorizeSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new AppError("BAD_REQUEST", "Invalid oauth authorize payload", 400, parsed.error.flatten());
  }

  const { client_id, redirect_uri, state, homeId, provider } = parsed.data;
  const userId = req.user!.sub; // from requireAuth

  // Verify client exists
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id },
  });
  if (!client) {
    throw new AppError("BAD_REQUEST", "Invalid client_id");
  }

  // Verify the redirect_uri belongs to the client (simple check)
  if (!client.redirectUris.includes(redirect_uri)) {
    throw new AppError("BAD_REQUEST", "Invalid redirect_uri for this client");
  }

  // Verify user has access to this home (must be owner or admin for voice control ideally, but we'll accept any member)
  const membership = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of the selected Home.");
  }

  // Ensure IntegrationConnection exists
  await prisma.integrationConnection.upsert({
    where: {
      userId_provider: {
        userId,
        provider,
      },
    },
    update: {
      homeId,
      status: "active",
      updatedAt: new Date(),
    },
    create: {
      userId,
      homeId,
      provider,
      status: "active",
    },
  });

  // Generate an Authorization Code
  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins expiry

  await prisma.oAuthAuthCode.create({
    data: {
      code,
      clientId: client.clientId,
      userId,
      homeId,
      redirectUri: redirect_uri,
      expiresAt,
    },
  });

  // Return the redirect URL for the frontend to navigate to
  const url = new URL(redirect_uri);
  url.searchParams.append("code", code);
  url.searchParams.append("state", state);

  ok(res, { redirectUrl: url.toString() });
});

/**
 * 2. POST /api/oauth/token
 * Called by Google/Alexa explicitly (server-to-server) to exchange the auth code for tokens,
 * or exchange a refresh token for a new access token.
 */
oauthRouter.post("/token", async (req: Request, res: Response) => {
  // OAuth bodies are commonly x-www-form-urlencoded
  const { grant_type, client_id, client_secret, code, redirect_uri, refresh_token } = req.body;

  if (!client_id || !client_secret) {
    return res.status(401).json({ error: "invalid_client" });
  }

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id },
  });

  if (!client || client.clientSecret !== client_secret) {
    return res.status(401).json({ error: "invalid_client" });
  }

  if (grant_type === "authorization_code") {
    if (!code || !redirect_uri) {
      return res.status(400).json({ error: "invalid_request" });
    }

    const authCode = await prisma.oAuthAuthCode.findUnique({
      where: { code },
    });

    if (!authCode) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code not found" });
    }
    if (authCode.clientId !== client_id || authCode.redirectUri !== redirect_uri) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    if (authCode.expiresAt < new Date()) {
      return res.status(400).json({ error: "invalid_grant", error_description: "Code expired" });
    }

    // Delete used auth code
    await prisma.oAuthAuthCode.delete({ where: { id: authCode.id } });

    // Generate tokens
    const accessToken = crypto.randomBytes(48).toString("hex");
    const refreshToken = crypto.randomBytes(48).toString("hex");

    // Tokens typically expire in a few hours/days (e.g. 30 days)
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.oAuthToken.create({
      data: {
        accessToken,
        refreshToken,
        clientId: client_id,
        userId: authCode.userId,
        homeId: authCode.homeId,
        expiresAt,
      },
    });

    return res.json({
      token_type: "Bearer",
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 30 * 24 * 60 * 60, // seconds
    });

  } else if (grant_type === "refresh_token") {
    if (!refresh_token) {
      return res.status(400).json({ error: "invalid_request" });
    }

    const tokenRecord = await prisma.oAuthToken.findUnique({
      where: { refreshToken: refresh_token },
    });

    if (!tokenRecord || tokenRecord.clientId !== client_id) {
      return res.status(400).json({ error: "invalid_grant" });
    }

    // Optionally check if IntegrationConnection is still active
    const conn = await prisma.integrationConnection.findFirst({
      where: { userId: tokenRecord.userId, homeId: tokenRecord.homeId, status: "active" }
    });

    if (!conn) {
      // Integration was disconnected by user
      await prisma.oAuthToken.delete({ where: { id: tokenRecord.id } });
      return res.status(400).json({ error: "invalid_grant", error_description: "Integration revoked" });
    }

    // Generate new Access Token
    const newAccessToken = crypto.randomBytes(48).toString("hex");
    // Optionally rotate refresh token as well for extra security, but keeping it static is easier for this spec
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updated = await prisma.oAuthToken.update({
      where: { id: tokenRecord.id },
      data: {
        accessToken: newAccessToken,
        expiresAt,
      },
    });

    return res.json({
      token_type: "Bearer",
      access_token: updated.accessToken,
      refresh_token: updated.refreshToken, // Same as before
      expires_in: 30 * 24 * 60 * 60,
    });
  }

  return res.status(400).json({ error: "unsupported_grant_type" });
});
