import { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import crypto from "crypto";
import { AppError, ok } from "../lib/response.js";

/**
 * POST /api/oauth/authorize
 * Called by frontend Consent page after user selects a Home and clicks "Allow".
 * Generates an Authorization Code and returns the final redirect URL.
 */
export const authorize = async (req: Request, res: Response) => {
  const { client_id, redirect_uri, state, homeId, provider } = req.body;
  const userId = req.user!.sub;

  const client = await prisma.oAuthClient.findUnique({
    where: { clientId: client_id },
  });
  if (!client) {
    throw new AppError("BAD_REQUEST", "Invalid client_id");
  }

  if (!client.redirectUris.includes(redirect_uri)) {
    throw new AppError("BAD_REQUEST", "Invalid redirect_uri for this client");
  }

  const membership = await prisma.homeMember.findUnique({
    where: { homeId_userId: { homeId, userId } },
  });
  if (!membership) {
    throw new AppError("FORBIDDEN", "You are not a member of the selected Home.");
  }

  await prisma.integrationConnection.upsert({
    where: { userId_provider: { userId, provider } },
    update: { homeId, status: "active", updatedAt: new Date() },
    create: { userId, homeId, provider, status: "active" },
  });

  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

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

  const url = new URL(redirect_uri);
  url.searchParams.append("code", code);
  url.searchParams.append("state", state);

  ok(res, { redirectUrl: url.toString() });
};

/**
 * POST /api/oauth/token
 * Called by Google/Alexa to exchange the auth code for tokens,
 * or exchange a refresh token for a new access token.
 */
export const token = async (req: Request, res: Response) => {
  const {
    grant_type,
    client_id,
    client_secret,
    code,
    redirect_uri,
    refresh_token,
  } = req.body;

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

    const authCode = await prisma.oAuthAuthCode.findUnique({ where: { code } });

    if (!authCode) {
      return res
        .status(400)
        .json({ error: "invalid_grant", error_description: "Code not found" });
    }
    if (
      authCode.clientId !== client_id ||
      authCode.redirectUri !== redirect_uri
    ) {
      return res.status(400).json({ error: "invalid_grant" });
    }
    if (authCode.expiresAt < new Date()) {
      return res
        .status(400)
        .json({ error: "invalid_grant", error_description: "Code expired" });
    }

    await prisma.oAuthAuthCode.delete({ where: { id: authCode.id } });

    const accessToken = crypto.randomBytes(48).toString("hex");
    const refreshToken = crypto.randomBytes(48).toString("hex");
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
      expires_in: 30 * 24 * 60 * 60,
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

    const conn = await prisma.integrationConnection.findFirst({
      where: {
        userId: tokenRecord.userId,
        homeId: tokenRecord.homeId,
        status: "active",
      },
    });

    if (!conn) {
      await prisma.oAuthToken.delete({ where: { id: tokenRecord.id } });
      return res.status(400).json({
        error: "invalid_grant",
        error_description: "Integration revoked",
      });
    }

    const newAccessToken = crypto.randomBytes(48).toString("hex");
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const updated = await prisma.oAuthToken.update({
      where: { id: tokenRecord.id },
      data: { accessToken: newAccessToken, expiresAt },
    });

    return res.json({
      token_type: "Bearer",
      access_token: updated.accessToken,
      refresh_token: updated.refreshToken,
      expires_in: 30 * 24 * 60 * 60,
    });
  }

  return res.status(400).json({ error: "unsupported_grant_type" });
};
