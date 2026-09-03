import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { Prisma, type User } from "@prisma/client";
import type { AuthUser, LoginResponse } from "@robosphere/shared";
import { env } from "../config/env";
import { prisma, getEffectiveDbUrl } from "../lib/prisma";
import { AppError } from "../lib/response";
import { logger } from "../lib/logger";
import { persistEnvKey } from "../lib/envPersist";
import { getSiteSettings } from "./siteSettings.service";
import { sendPasswordResetEmail } from "../lib/email.service";
import { emitToUser, emitToSession } from "../lib/socket";

function toAuthUser(user: User): AuthUser {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    themePref: user.themePref,
    avatarUrl: user.avatarUrl ?? null,
    dob: user.dob ? user.dob.toISOString().split("T")[0] : null,
    gender: user.gender ?? null,
    phone: user.phone ?? null,
    address: user.address ?? null,
  };
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function parseExpiryMs(durationStr: string): number {
  const match = durationStr.match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const val = parseInt(match[1], 10);
  const unit = match[2];
  if (unit === "s") return val * 1000;
  if (unit === "m") return val * 60 * 1000;
  if (unit === "h") return val * 60 * 60 * 1000;
  if (unit === "d") return val * 24 * 60 * 60 * 1000;
  return 15 * 60 * 1000;
}

// jti (random nonce) guarantees unique tokens even when issued in the same second.
function signAccessToken(user: User, sessionId?: number): string {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      ver: user.tokenVersion,
      jti: crypto.randomUUID(),
      sid: sessionId,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES as SignOptions["expiresIn"] },
  );
}

function signRefreshToken(user: User): string {
  return jwt.sign({ sub: user.id, ver: user.tokenVersion, jti: crypto.randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES as SignOptions["expiresIn"],
  });
}

/**
 * Sign up a new user.
 * On success the user automatically becomes the OWNER of a new Home
 * (the v2 model: devices belong to homes, not individuals).
 */
export async function signup(input: {
  username: string;
  email: string;
  password: string;
  homeName?: string;
}, deviceInfo?: string, ipAddress?: string): Promise<LoginResponse> {
  const existingUsername = await prisma.user.findFirst({ where: { username: input.username }, select: { id: true } });
  if (existingUsername) {
    throw new AppError("USERNAME_TAKEN", `Username '${input.username}' is already taken. Please choose another username.`, 409);
  }
  const existingEmail = await prisma.user.findFirst({ where: { email: input.email }, select: { id: true } });
  if (existingEmail) {
    throw new AppError("EMAIL_TAKEN", `Email '${input.email}' is already registered. Please log in or use another email.`, 409);
  }

  const password = await bcrypt.hash(input.password, 10);

  let user: User;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          password,
          role: "user",
          status: "active",
          pushDeviceToggles: true,
          pushSystemAlerts: true,
          tokenVersion: 0,
        },
      });

      // Auto-create the user's first home (they become the owner).
      await tx.home.create({
        data: {
          name: input.homeName?.trim() || `${input.username}'s Home`,
          ownerId: created.id,
          members: {
            create: { userId: created.id, role: "owner", joinedAt: new Date() },
          },
        },
      });

      return created;
    });
  } catch (err) {
    logger.error("[signup] Error during user creation transaction", err instanceof Error ? err.stack : err);
    throw err;
  }

  return issueTokens(user, deviceInfo, ipAddress);
}

/** Update profile fields (username/email) and/or password. */
export async function updateProfile(
  userId: number,
  input: {
    username?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
    pushDeviceToggles?: boolean;
    pushSystemAlerts?: boolean;
    avatarUrl?: string | null;
    dob?: string | null;
    gender?: string | null;
    phone?: string | null;
    address?: string | null;
  },
): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  const data: Prisma.UserUpdateInput = {};

  if (input.username && input.username !== user.username) {
    const taken = await prisma.user.findUnique({ where: { username: input.username } });
    if (taken) throw new AppError("USERNAME_TAKEN", "Username already taken", 409);
    data.username = input.username;
  }

  if (input.email && input.email !== user.email) {
    const taken = await prisma.user.findUnique({ where: { email: input.email } });
    if (taken) throw new AppError("EMAIL_TAKEN", "Email already taken", 409);
    data.email = input.email;
  }

  if (input.newPassword) {
    if (!input.currentPassword) {
      throw new AppError("CURRENT_PASSWORD_REQUIRED", "Current password required to set a new one", 400);
    }
    if (!(await bcrypt.compare(input.currentPassword, user.password))) {
      throw new AppError("WRONG_PASSWORD", "Current password is incorrect", 401);
    }
    data.password = await bcrypt.hash(input.newPassword, 10);
    // Password change → tokenVersion bump: saare purane access tokens turant invalid.
    data.tokenVersion = { increment: 1 };
  }

  if (input.avatarUrl !== undefined) data.avatarUrl = input.avatarUrl;
  if (input.dob !== undefined) data.dob = input.dob ? new Date(input.dob) : null;
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.address !== undefined) data.address = input.address;

  let updated = user as any;
  if (Object.keys(data).length > 0) {
    updated = await prisma.user.update({ where: { id: userId }, data });
  }

  if (input.pushDeviceToggles !== undefined || input.pushSystemAlerts !== undefined) {
    const dt = input.pushDeviceToggles !== undefined ? (input.pushDeviceToggles ? 1 : 0) : null;
    const sa = input.pushSystemAlerts !== undefined ? (input.pushSystemAlerts ? 1 : 0) : null;

    try {
      if (dt !== null && sa !== null) {
        await prisma.$executeRawUnsafe(`UPDATE \`User\` SET push_device_toggles = ${dt}, push_system_alerts = ${sa} WHERE id = ${userId}`);
      } else if (dt !== null) {
        await prisma.$executeRawUnsafe(`UPDATE \`User\` SET push_device_toggles = ${dt} WHERE id = ${userId}`);
      } else if (sa !== null) {
        await prisma.$executeRawUnsafe(`UPDATE \`User\` SET push_system_alerts = ${sa} WHERE id = ${userId}`);
      }
    } catch (e: any) {
      console.error("Failed to hot-patch push preferences:", e);
    }
  }

  if (input.newPassword) {
    // Purane refresh tokens bhi revoke — har session (jis device se login tha) logout.
    await prisma.refreshToken.deleteMany({ where: { userId } });
    // System admin ka password change → site/.env (ADMIN_PASSWORD) me bhi sync
    // karo — install wizard fallback, seed aur docs har jagah same value rahe.
    // Best-effort: env write fail ho to sirf log (DB me change ho chuka hai).
    if (user.role === "system_admin") {
      const res = persistEnvKey("ADMIN_PASSWORD", input.newPassword);
      logger.info(
        res.ok ? "Admin password changed — .env ADMIN_PASSWORD synced" : "Admin password changed — .env sync FAILED",
        res.ok ? { path: res.path } : undefined,
      );
    }
  }
  return toAuthUser(updated);
}

/** Save theme preference on the account — light/dark/system (cross-device). */
export async function updateThemePref(userId: number, theme: string): Promise<AuthUser> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { themePref: theme },
  });
  return toAuthUser(updated);
}

export async function checkAvailability(username?: string, email?: string) {
  const result = { usernameAvailable: true, emailAvailable: true };

  if (username) {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) result.usernameAvailable = false;
  }

  if (email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) result.emailAvailable = false;
  }

  return result;
}

/** Login with username OR email + password. */
export async function login(usernameEmail: string, password: string, deviceInfo?: string, ipAddress?: string, revokeOtherSessions?: boolean): Promise<LoginResponse> {
  let user: User | null = null;
  try {
    user = await prisma.user.findFirst({
      where: { OR: [{ username: usernameEmail }, { email: usernameEmail }] },
    });
  } catch (_pErr) {
    // Prisma query failed — try direct mysql2 lookup as fallback
    try {
      const mysql = (await import("mysql2/promise")).default;
      const dbUrl = getEffectiveDbUrl();
      const u = new URL(dbUrl);
      const conn = await mysql.createConnection({
        host: u.hostname === "localhost" ? "127.0.0.1" : u.hostname,
        port: Number(u.port || 3306),
        user: decodeURIComponent(u.username),
        password: decodeURIComponent(u.password),
        database: decodeURIComponent(u.pathname.replace(/^\//, "")),
        connectTimeout: 5000,
      });
      const [rows] = await conn.query(
        "SELECT id, username, email, password, role, status, token_version AS tokenVersion, created_at AS createdAt FROM users WHERE username = ? OR email = ? LIMIT 1",
        [usernameEmail, usernameEmail],
      );
      await conn.end().catch(() => undefined);
      if (Array.isArray(rows) && rows.length > 0) {
        user = rows[0] as User;
      }
    } catch (_mErr) {
      logger.error("[login] Direct mysql user lookup error", _mErr);
    }
  }

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid username/email or password", 401);
  }

  if (user.status !== "active") {
    throw new AppError("ACCOUNT_SUSPENDED", "Account is suspended", 403);
  }

  let enrichDevice = deviceInfo || "Unknown Device";
  if (ipAddress && ipAddress !== "::1" && ipAddress !== "127.0.0.1" && !ipAddress.startsWith("192.168.") && !ipAddress.startsWith("10.")) {
    try {
      const resp = await fetch(`http://ip-api.com/json/${ipAddress}?fields=city,region`);
      const loc = await resp.json() as any;
      if (loc && loc.city) {
        enrichDevice = `${enrichDevice} • ${loc.city}, ${loc.region}`;
      }
    } catch { } // ignore
  } else if (ipAddress?.startsWith("192.168.") || ipAddress?.startsWith("10.") || ipAddress === "::1" || ipAddress === "127.0.0.1") {
    enrichDevice = `${enrichDevice} • Local Network`;
  }


  // Best-effort: loginCount/lastLoginAt columns may not exist yet on older DBs.
  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    // Column missing or other DB issue — login still succeeds.
    try {
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch {
      // lastLoginAt also missing — just skip stats update.
    }
  }
  return issueTokens(user, enrichDevice, ipAddress, revokeOtherSessions);
}

const MAX_ACTIVE_SESSIONS = 3;

/** Issue a fresh access + refresh token pair, persisting the refresh token hash. */
async function issueTokens(user: User, deviceInfo?: string, ipAddress?: string, revokeOtherSessions?: boolean): Promise<LoginResponse> {
  if (revokeOtherSessions) {
    try {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    } catch (_err) {}
    try {
      emitToUser(user.id, "auth:force_logout", { message: "Sessions revoked from new login request." });
    } catch (_err) {}
  }

  const refreshToken = signRefreshToken(user);
  const tokenHash = hashToken(refreshToken);
  const exp = new Date(Date.now() + parseExpiryMs(env.JWT_REFRESH_EXPIRES));

  let sessionId = 1;
  try {
    const session = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: exp,
      },
    });
    sessionId = session.id;
  } catch (_rErr) {
    try {
      await prisma.$executeRawUnsafe(
        "INSERT INTO refresh_tokens (userId, token_hash, expires_at, created_at) VALUES (?, ?, ?, NOW(3))",
        user.id,
        tokenHash,
        exp,
      );
    } catch (_mErr) {
      logger.error("[login] refreshToken fallback error", _mErr);
    }
  }

  try {
    emitToUser(user.id, "auth:sessions_changed", {});
    emitToSession(sessionId, "auth:session_created", { sessionId });
  } catch (_e) {}

  const accessToken = signAccessToken(user, sessionId);

  return {
    user: toAuthUser(user),
    accessToken,
    refreshToken,
    tokens: {
      accessToken,
      refreshToken,
    },
  };
}

/** Rotate a refresh token into a new token pair. */
export async function refresh(refreshToken: string, deviceInfo?: string, ipAddress?: string): Promise<LoginResponse> {
  let payload: { sub: number };
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as unknown as { sub: number };
  } catch {
    throw new AppError("INVALID_REFRESH_TOKEN", "Invalid or expired refresh token", 401);
  }

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
  });
  if (!stored || stored.revokedAt) {
    throw new AppError("INVALID_REFRESH_TOKEN", "Refresh token has been revoked", 401);
  }

  // Revoke the old token, issue a new pair (rotation).
  await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User no longer exists", 401);

  // Password change ke baad purane refresh tokens bhi invalid (tokenVersion mismatch).
  const tokenVer = (payload as unknown as { ver?: number }).ver;
  if (tokenVer !== user.tokenVersion) {
    await prisma.refreshToken
      .updateMany({ where: { tokenHash: hashToken(refreshToken) }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    throw new AppError("INVALID_REFRESH_TOKEN", "Session invalidated — dobara login karo", 401);
  }

  // Optional: Add logic here to touch the 'lastActive' tracker for this session if required
  return issueTokens(user, deviceInfo, ipAddress);
}

/** Revoke a refresh token and wipe ALL device push bridges for the user (logout). */
export async function logout(refreshToken?: string, pushToken?: string): Promise<void> {
  let userId: number | undefined;

  if (refreshToken) {
    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
    });
    if (stored) {
      userId = stored.userId;
      await prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });
    }
  }

  // Delete ALL push subscriptions for this user so no device gets notifications after logout
  if (userId) {
    await prisma.pushSubscription.deleteMany({
      where: { userId }
    }).catch(() => { });
  } else if (pushToken) {
    // Fallback: if we couldn't resolve userId, try matching by token directly
    await prisma.pushSubscription.deleteMany({
      where: { token: pushToken }
    }).catch(() => { });
  }
}

// ---------------------------------------------------------------------------
// Password reset (forgot-password) — 1-use hashed token, 30 min expiry.
// ---------------------------------------------------------------------------

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Forgot-password: email pe reset link bhejo.
 * User enumeration se bachne ke liye hamesha `{ sent: true }` — email exist
 * na kare to bhi same response (bass koi mail nahi jata).
 * SMTP configured nahi hai to reset link console/file-log me log hota hai
 * (dev me kaam karne ke liye) — response me kabhi token nahi aata.
 */
export async function requestPasswordReset(email: string, origin?: string): Promise<{ sent: true }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { sent: true }; // same response — email exist nahi karne par bhi

  // Pehle se pending (unused) tokens invalidate — ek time me sirf ek active link.
  await prisma.passwordResetToken.updateMany({
    where: { userId: user.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const s = await getSiteSettings().catch(() => null);
  const siteName = s?.siteName || "SwitchNest";
  const siteUrl = (origin || s?.siteUrl || "").replace(/\/$/, "");
  const resetUrl = siteUrl
    ? `${siteUrl}/reset-password?token=${encodeURIComponent(rawToken)}`
    : "";

  const emailResult = await sendPasswordResetEmail({
    to: user.email,
    userName: user.username,
    resetUrl,
    siteName,
  }).catch(() => ({ ok: false, error: "email service error" }));

  if (!emailResult.ok) {
    // SMTP nahi hai (ya fail) — link log karo taaki dev/self-hosted pe
    // bina SMTP ke bhi reset ho sake. Response me kabhi nahi (security).
    const hint = resetUrl || `${rawToken} (siteUrl set nahi hai)`;
    logger.info(`[auth] password reset link for ${user.email}: ${hint}`);
  }
  return { sent: true };
}

/** Reset token ko verify karke password badlo — purane saare sessions logout. */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const tokenHash = hashToken(token);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("INVALID_RESET_TOKEN", "Reset link invalid ya expired hai — naya link maango", 400);
  }

  const user = await prisma.user.findUnique({ where: { id: record.userId } });
  if (!user) throw new AppError("USER_NOT_FOUND", "User not found", 404);

  const password = await bcrypt.hash(newPassword, 10);

  await prisma.$transaction([
    // Password change → tokenVersion bump: purane access tokens turant invalid.
    prisma.user.update({
      where: { id: user.id },
      data: { password, tokenVersion: { increment: 1 } },
    }),
    // Saare refresh tokens revoke — har device se logout.
    prisma.refreshToken.deleteMany({ where: { userId: user.id } }),
    // Is token ko 1-use mark + baaki pending tokens bhi invalidate.
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

  // System admin ka password reset → site/.env ADMIN_PASSWORD bhi sync.
  if (user.role === "system_admin") {
    const res = persistEnvKey("ADMIN_PASSWORD", newPassword);
    logger.info(
      res.ok ? "Admin password reset — .env ADMIN_PASSWORD synced" : "Admin password reset — .env sync FAILED",
      res.ok ? { path: res.path } : undefined,
    );
  }
}

// ---------------------------------------------------------------------------
// Active Session Controls 
// ---------------------------------------------------------------------------
export async function listSessions(userId: number) {
  return prisma.refreshToken.findMany({
    where: { userId, revokedAt: null },
    select: { id: true, deviceInfo: true, ipAddress: true, lastActive: true, createdAt: true },
    orderBy: { lastActive: 'desc' }
  });
}

export async function revokeAllSessions(userId: number) {
  const t = await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() }
    }),
    prisma.user.update({
      where: { id: userId },
      data: { tokenVersion: { increment: 1 } }
    })
  ]);

  emitToUser(userId, "auth:force_logout", { message: "Your sessions have been globally revoked." });
  emitToUser(userId, "auth:sessions_changed", {});
}

export async function revokeOtherSessions(userId: number, currentSessionId: number) {
  const otherSessions = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, id: { not: currentSessionId } },
  });

  if (otherSessions.length === 0) return { count: 0 };

  const result = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, id: { not: currentSessionId } },
    data: { revokedAt: new Date() }
  });

  for (const session of otherSessions) {
    emitToSession(session.id, "auth:force_logout", { message: "Session revoked from main device." });
  }
  emitToUser(userId, "auth:sessions_changed", {});
  return { count: result.count };
}

export async function revokeSession(userId: number, sessionId: number) {
  await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId, revokedAt: null },
    data: { revokedAt: new Date() }
  });
  emitToSession(sessionId, "auth:force_logout", { message: "Your session was manually revoked." });
  emitToUser(userId, "auth:sessions_changed", {});
}

/** Pre-auth session management */
export async function revokeUnauthSession(usernameEmail: string, password: string, sessionId: number) {
  const user = await prisma.user.findFirst({
    where: { OR: [{ username: usernameEmail }, { email: usernameEmail }] },
  });

  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new AppError("INVALID_CREDENTIALS", "Invalid credentials", 401);
  }

  await prisma.refreshToken.updateMany({
    where: { id: sessionId, userId: user.id },
    data: { revokedAt: new Date() }
  });

  emitToSession(sessionId, "auth:force_logout", { message: "Your session was terminated from another device." });
  emitToUser(user.id, "auth:sessions_changed", {});

  return prisma.refreshToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}
