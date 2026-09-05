import { prisma } from '../lib/prisma';
import crypto from 'crypto';

function generateRandomToken(length = 40): string {
  return crypto.randomBytes(length).toString('hex');
}

export class OAuthService {
  /**
   * Helper to ensure the client exists. In a real system, you would manage these in a dashboard.
   */
  static async getOrCreateClient(clientId: string, name: string): Promise<string> {
    let client = await prisma.oAuthClient.findUnique({
      where: { clientId }
    });
    
    if (!client) {
      client = await prisma.oAuthClient.create({
        data: {
          clientId,
          clientSecret: generateRandomToken(32),
          name,
          redirectUris: '[]' // Accept anything for local dev
        }
      });
    }
    return client.id;
  }

  static async generateAuthCode(userId: number, homeId: number, clientIdStr: string, redirectUri: string) {
    const client = await prisma.oAuthClient.findUnique({ where: { clientId: clientIdStr } });
    if (!client) throw new Error('Invalid client_id');

    const code = generateRandomToken(20);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const authCode = await prisma.oAuthAuthCode.create({
      data: {
        code,
        clientId: client.clientId,
        userId,
        homeId,
        redirectUri,
        expiresAt
      }
    });

    return authCode.code;
  }

  static async exchangeCodeForToken(code: string, clientIdStr: string, clientSecret: string, redirectUri: string) {
    const client = await prisma.oAuthClient.findUnique({ where: { clientId: clientIdStr } });
    if (!client || client.clientSecret !== clientSecret) {
      throw new Error('invalid_client');
    }

    const authCode = await prisma.oAuthAuthCode.findUnique({
      where: { code }
    });

    if (!authCode || authCode.clientId !== client.clientId || authCode.redirectUri !== redirectUri) {
      throw new Error('invalid_grant');
    }

    if (authCode.expiresAt < new Date()) {
      await prisma.oAuthAuthCode.delete({ where: { id: authCode.id } });
      throw new Error('invalid_grant');
    }

    // Exchange valid code for tokens
    const accessToken = generateRandomToken(40);
    const refreshToken = generateRandomToken(40);
    const expiresIn = 3600 * 24 * 30; // 30 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const tokenRecord = await prisma.oAuthToken.create({
      data: {
        accessToken,
        refreshToken,
        clientId: client.clientId,
        userId: authCode.userId,
        homeId: authCode.homeId,
        expiresAt
      }
    });

    // Code is single-use
    await prisma.oAuthAuthCode.delete({ where: { id: authCode.id } });

    return {
      access_token: tokenRecord.accessToken,
      token_type: 'Bearer',
      refresh_token: tokenRecord.refreshToken,
      expires_in: expiresIn
    };
  }

  static async refreshAccessToken(refreshTokenStr: string, clientIdStr: string, clientSecret: string) {
    const client = await prisma.oAuthClient.findUnique({ where: { clientId: clientIdStr } });
    if (!client || client.clientSecret !== clientSecret) {
      throw new Error('invalid_client');
    }

    const oldToken = await prisma.oAuthToken.findUnique({
      where: { refreshToken: refreshTokenStr }
    });

    if (!oldToken || oldToken.clientId !== client.clientId) {
      throw new Error('invalid_grant');
    }

    // Rotate refresh token
    const newAccessToken = generateRandomToken(40);
    const newRefreshToken = generateRandomToken(40);
    const expiresIn = 3600 * 24 * 30; // 30 days
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    const updatedToken = await prisma.oAuthToken.update({
      where: { id: oldToken.id },
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt
      }
    });

    return {
      access_token: updatedToken.accessToken,
      token_type: 'Bearer',
      refresh_token: updatedToken.refreshToken,
      expires_in: expiresIn
    };
  }

  static async validateAccessToken(accessTokenStr: string) {
    const token = await prisma.oAuthToken.findUnique({
      where: { accessToken: accessTokenStr },
      include: { user: true, home: true }
    });

    if (!token || token.expiresAt < new Date()) {
      return null;
    }

    return token;
  }
}
