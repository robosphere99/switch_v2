import { Request, Response } from "express";
import { prisma } from "../lib/prisma";

// Middleware to extract and verify OAuth Access Token for Alexa requests
export const requireAlexaAuth = async (req: Request, res: Response, next: any) => {
    // Alexa passes token within the payload: req.body.directive.endpoint.scope.token or req.body.directive.payload.scope.token
    const directive = req.body.directive;
    let token = null;

    if (directive?.endpoint?.scope?.token) token = directive.endpoint.scope.token;
    else if (directive?.payload?.scope?.token) token = directive.payload.scope.token;
    else if (directive?.payload?.grantee?.token) token = directive.payload.grantee.token;

    if (!token) {
        return res.status(401).json({ error: "Missing token in directive" });
    }

    const oauthToken = await prisma.oAuthToken.findUnique({
        where: { accessToken: token },
    });

    if (!oauthToken || oauthToken.expiresAt < new Date()) {
        return res.status(401).json({ error: "Invalid or expired token" });
    }

    const conn = await prisma.integrationConnection.findFirst({
        where: { userId: oauthToken.userId, homeId: oauthToken.homeId, provider: "alexa", status: "active" }
    });

    if (!conn) {
        return res.status(401).json({ error: "Alexa integration revoked" });
    }

    (req as any).oauthToken = oauthToken;
    next();
};
