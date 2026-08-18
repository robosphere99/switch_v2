import type { Router } from "express";
import { apiMounts, apiRouter } from "../routes";
import { installRouter } from "../routes/install.routes";

/**
 * OpenAPI 3.0 document builder — zero dependency (Plesk pe naye npm packages
 * risky hain). Paths Express router stack se AUTO-ENUMERATE hote hain taaki
 * naya route add karo to docs khud update ho jaye. Descriptions + schemas
 * yahan hand-written hain (source of truth = code, docs = guide).
 *
 * Serve at:
 *   GET /api/docs/openapi.json   → raw spec (editor.swagger.io me paste karo)
 *   GET /api/docs                → Swagger UI (CDN)
 *   GET /api/docs/plain          → offline-friendly HTML list
 */

// ---------------------------------------------------------------------------
// Router walk — har mounted route + method enumerate (Express 5 stack).
// ---------------------------------------------------------------------------

interface Endpoint {
  method: string;
  path: string;
}

function joinPath(prefix: string, p: string): string {
  const joined = `${prefix}/${p}`.replace(/\/+/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

function walkRouter(router: Router, prefix: string, out: Endpoint[], skipNested = false): void {
  const stack = (router as unknown as { stack?: unknown[] }).stack ?? [];
  for (const layer of stack) {
    const l = layer as {
      route?: { path?: string; methods?: Record<string, boolean> };
      handle?: { stack?: unknown[] };
    };
    if (l.route) {
      const full = joinPath(prefix, l.route.path ?? "");
      for (const method of Object.keys(l.route.methods ?? {})) {
        if (method === "_all") continue;
        out.push({ method: method.toUpperCase(), path: full });
      }
    } else if (l.handle?.stack && !skipNested) {
      // Express 5 mount layer pe path expose nahi karta — nested routers
      // alag se walk hote hain (apiMounts table se prefix ke saath).
      walkRouter(l.handle as Router, prefix, out);
    }
  }
}

// ---------------------------------------------------------------------------
// Endpoint descriptions — "METHOD /path" → summary. Naya endpoint bina
// description ke default summary ke saath dikhega (kabhi miss nahi hota).
// ---------------------------------------------------------------------------

const DESCRIPTIONS: Record<string, string> = {
  // ----- auth -----
  "POST /api/auth/signup": "Account banao — user apne pehle Home ka owner ban jata hai (tokens + home auto-create).",
  "POST /api/auth/login": "Username ya email + password se login → access/refresh token pair.",
  "POST /api/auth/refresh": "Refresh token rotate karke naya token pair do (purana revoke).",
  "POST /api/auth/logout": "Refresh token revoke (logout).",
  "POST /api/auth/forgot-password": "Email pe password reset link bhejo (30 min valid). User enumeration se bachne ke liye unknown email pe bhi { sent:true }.",
  "POST /api/auth/reset-password": "Reset token + naya password → password change, saare sessions logout.",
  "GET /api/auth/me": "Current logged-in user ka profile.",
  "PATCH /api/auth/me": "Profile update (username/email) + password change (currentPassword+newPassword).",
  "PUT /api/auth/theme": "Theme preference save (light/dark/system).",

  // ----- device API (ESP32) -----
  "GET /api/device/read-all": "ESP32: saare devices + status (api_key se). DB source of truth — board isko poll karta hai.",
  "POST /api/device/update": "ESP32: device status update (relay state report).",
  "POST /api/device/heartbeat": "ESP32: heartbeat — IP, firmware, MAC, serial, model + actual relay states report karo; response me OTA instruction mil sakta hai.",
  "POST /api/device/ota-progress": "ESP32: OTA download/apply progress report (0-100).",
  "GET /api/device/commands": "ESP32: pending commands. long=1&hold=20 → long-poll (max 25s hold).",
  "POST /api/device/commands/ack": "ESP32: command execute/fail acknowledge (command_id + status).",

  // ----- homes -----
  "POST /api/homes": "Naya home banao (creator owner banta hai).",
  "GET /api/homes": "Mere saare homes (memberships).",
  "GET /api/homes/my-boards": "Mere ESP boards (claimed serials → boards).",
  "GET /api/homes/:homeId": "Home detail (members + rooms + devices counts).",
  "PATCH /api/homes/:homeId": "Home rename (admin+).",
  "DELETE /api/homes/:homeId": "Home delete (sirf owner).",
  "POST /api/homes/:homeId/transfer": "Ownership transfer kisi member ko (sirf owner).",

  // ----- members -----
  "GET /api/homes/:homeId/members": "Home ke saare members (viewer+).",
  "GET /api/homes/:homeId/invitations": "Pending invitations list (admin+).",
  "POST /api/homes/:homeId/invitations": "Invite bhejo (email + role) → invite code generate (admin+).",
  "DELETE /api/homes/:homeId/invitations/:invitationId": "Invitation revoke (admin+).",
  "PATCH /api/homes/:homeId/members/:userId/role": "Member role change (admin+).",
  "DELETE /api/homes/:homeId/members/:userId": "Member remove (admin+) — access turant chala jata hai.",
  "PATCH /api/homes/:homeId/members/:userId/safety": "Child mode: restricted + daily ON-time limit (admin+).",
  "PUT /api/homes/:homeId/members/:userId/access": "Restricted member ke device grants replace karo (admin+).",
  "POST /api/homes/invitations/accept": "Invite code se home join karo (auth required).",

  // ----- devices -----
  "GET /api/homes/:homeId/devices": "Home ke devices (viewer+).",
  "POST /api/homes/:homeId/devices": "Device add karo (admin+).",
  "POST /api/homes/:homeId/devices/bulk-status": "Multiple devices ek saath on/off (member+).",
  "PATCH /api/homes/:homeId/devices/:deviceId": "Device rename / room assign (admin+).",
  "POST /api/homes/:homeId/devices/:deviceId/status": "Device on/off — command + log + realtime (member+).",
  "GET /api/homes/:homeId/devices/:deviceId/logs": "Device logs (viewer+).",
  "DELETE /api/homes/:homeId/devices/:deviceId": "Device delete (admin+).",
  "POST /api/homes/:homeId/devices/:deviceId/ota": "Is device ke board ko OTA update bhejo (admin+).",
  "PATCH /api/homes/:homeId/esp/:espId": "ESP board rename (admin+).",
  "GET /api/homes/:homeId/analytics/usage": "Usage analytics — toggles/day, on-time per device/member (viewer+).",
  "GET /api/homes/:homeId/automations/suggestions": "Phase 7 — usage patterns se automation suggestions (viewer+).",

  // ----- rooms -----
  "POST /api/homes/:homeId/rooms": "Room banao (admin+).",
  "DELETE /api/homes/:homeId/rooms/:roomId": "Room delete — devices roomless ho jate hain (admin+).",

  // ----- schedules -----
  "POST /api/homes/:homeId/schedules": "Timer/schedule banao — once/daily/weekly/cron (member+).",
  "GET /api/homes/:homeId/schedules": "Schedules list (viewer+).",
  "PATCH /api/homes/:homeId/schedules/:scheduleId": "Schedule update — enable/disable, action, time (member+).",
  "DELETE /api/homes/:homeId/schedules/:scheduleId": "Schedule delete (member+).",

  // ----- notifications -----
  "GET /api/notifications": "Meri notifications (page/pageSize/category/type/unread filters).",
  "GET /api/notifications/unread-count": "Unread count.",
  "POST /api/notifications/read-all": "Saari read mark karo.",
  "POST /api/notifications/:id/read": "Ek notification read.",
  "DELETE /api/notifications/:id": "Notification delete.",

  // ----- api keys -----
  "GET /api/api-keys/": "Meri API keys list.",
  "POST /api/api-keys/": "API key banao (raw key sirf ek baar — hash store hota hai).",
  "DELETE /api/api-keys/:id": "API key revoke.",

  // ----- assistant -----
  "POST /api/assistant/chats": "AI assist chat banao (home member).",
  "GET /api/assistant/chats": "Meri chats list.",
  "POST /api/assistant/chats/:chatId/messages": "Message bhejo — rule-based intent parser (EN/HI) reply + proposal deta hai.",
  "POST /api/assistant/chats/:chatId/confirm": "Proposal confirm → devices execute.",
  "GET /api/assistant/chats/:chatId/messages": "Chat history.",

  // ----- shop -----
  "GET /api/shop/products": "Active products catalog (public).",
  "POST /api/shop/orders": "Order place karo — serial reserve hota hai (COD/UPI/manual).",
  "GET /api/shop/orders": "Meri orders.",
  "POST /api/shop/orders/:id/cancel": "Pending order cancel — serial release.",
  "POST /api/shop/orders/:id/pay": "Payment initiate — Razorpay order ya demo UPI intent.",
  "POST /api/shop/orders/:id/pay/verify": "Razorpay checkout callback — signature verify → PAID.",
  "POST /api/shop/orders/:id/pay/demo": "Demo mode: order paid mark (bina real payment).",
  "GET /api/firmware/current": "Current firmware versions (isCurrent) — saare models.",

  // ----- claim / warranty -----
  "GET /api/claim/homes": "Mere homes jahan serial claim kar sakta hoon (owner/admin).",
  "POST /api/claim": "Serial code se device activate — board home se link (owner/admin).",
  "GET /api/warranty/status": "Serial + warranty status check (?serial=...).",
  "POST /api/warranty": "Warranty claim file karo.",
  "GET /api/warranty/mine": "Meri claims + devices.",

  // ----- public -----
  "GET /api/public/site-settings": "Public site settings (brand color, contact info) — login se pehle bhi.",
  "POST /api/public/assistant": "Public sales assistant chat (bina login) — product advisor.",
  "POST /api/public/assistant/admin": "Public assistant — admin panel preview (auth).",
  "POST /api/public/contact": "Contact form message bhejo (public).",
  "GET /api/public/support/my": "Meri support conversation (auth).",
  "POST /api/public/support": "Support message bhejo (auth).",

  // ----- support -----
  "GET /api/support/messages": "Meri support thread (read → unread mark).",
  "POST /api/support/messages": "Support ko message/reply + attachment (photo/PDF, max 2MB).",
  "DELETE /api/support/messages/:id": "Apna message delete (soft, WhatsApp-style).",
  "DELETE /api/support/messages": "Apna poora thread clear.",
  "GET /api/support/attachment/:id": "Attachment file serve (?token= ya Bearer) — owner/admin.",
  "GET /api/support/settings": "Meri chat settings (mute/pin).",
  "PUT /api/support/settings/:peerUserId": "Conversation mute/pin toggle.",
  "GET /api/support/admin/messages": "[ADMIN] User ka support thread.",
  "POST /api/support/admin/messages": "[ADMIN] User ko message bhejo → notification + email.",
  "GET /api/support/admin/unread-count": "[ADMIN] Unread conversations count (badge).",
  "GET /api/support/admin/conversations": "[ADMIN] Conversations inbox (WhatsApp-style).",
  "POST /api/support/admin/read-all": "[ADMIN] Saari chats read.",
  "POST /api/support/admin/thread-read": "[ADMIN] Ek user ki chat read/unread.",
  "GET /api/support/admin/context": "[ADMIN] User ka context — orders, homes, devices, boards.",
  "DELETE /api/support/admin/messages/:id": "[ADMIN] Koi message delete (moderation).",
  "DELETE /api/support/admin/messages": "[ADMIN] User ka poora thread clear.",

  // ----- admin -----
  "GET /api/admin/stats": "[ADMIN] Platform stats — users/homes/devices/active counts.",
  "GET /api/admin/settings": "[ADMIN] Platform settings.",
  "PUT /api/admin/settings": "[ADMIN] Settings update (site name, SMTP, limits...).",
  "POST /api/admin/settings/test-email": "[ADMIN] SMTP test email bhejo.",
  "GET /api/admin/users": "[ADMIN] Users list/search.",
  "PATCH /api/admin/users/:id/status": "[ADMIN] User suspend/unsuspend.",
  "PATCH /api/admin/users/:id/role": "[ADMIN] User role change (system_admin promote/demote).",
  "DELETE /api/admin/users/:id": "[ADMIN] User delete.",
  "GET /api/admin/homes": "[ADMIN] Saare homes.",
  "GET /api/admin/homes/:id": "[ADMIN] Home detail.",
  "PATCH /api/admin/homes/:id/status": "[ADMIN] Home suspend/unsuspend.",
  "DELETE /api/admin/homes/:id": "[ADMIN] Home delete.",
  "GET /api/admin/devices": "[ADMIN] Saare devices (saare homes).",
  "GET /api/admin/search": "[ADMIN] Global search (users/homes/devices/orders).",
  "GET /api/admin/api-keys": "[ADMIN] Saari API keys.",
  "POST /api/admin/api-keys": "[ADMIN] Kisi user ke liye API key banao.",
  "DELETE /api/admin/api-keys/:id": "[ADMIN] API key delete.",
  "GET /api/admin/find": "[ADMIN] Find — device/board by serial/MAC.",
  "GET /api/admin/audit": "[ADMIN] Audit logs.",
  "GET /api/admin/deploy-info": "[ADMIN] Deploy info — commit/branch/marker (ops).",
  "GET /api/admin/diagnostics": "[ADMIN] Diagnostics — DB, memory, leak state, health.",
  "GET /api/admin/logs": "[ADMIN] App log lines.",
  "GET /api/admin/esp": "[ADMIN] Saare ESP boards.",
  "POST /api/admin/esp/:id/key": "[ADMIN] Board ka API key banao/update.",
  "PATCH /api/admin/esp/:id": "[ADMIN] Board update (name, model...).",
  "GET /api/admin/esp/:id/history": "[ADMIN] Board heartbeat history.",
  "GET /api/admin/esp/:id/probe": "[ADMIN] Board connectivity probe.",
  "GET /api/admin/firmware": "[ADMIN] Firmware versions.",
  "POST /api/admin/firmware": "[ADMIN] Firmware .bin upload (multipart 'firmware').",
  "POST /api/admin/firmware/:id/activate": "[ADMIN] Firmware current mark karo.",
  "POST /api/admin/devices/:id/status": "[ADMIN] Kisi bhi home ke device ka status set.",
  "GET /api/admin/devices/:id/support": "[ADMIN] Device support info.",
  "POST /api/admin/devices/:id/clear-commands": "[ADMIN] Stuck commands clear.",
  "POST /api/admin/devices/:id/push-ota": "[ADMIN] Device ke board ko OTA push.",
  "POST /api/admin/devices/push-ota-all": "[ADMIN] Saare boards ko OTA push.",
  "GET /api/admin/products": "[ADMIN] Products.",
  "POST /api/admin/products": "[ADMIN] Product banao.",
  "PATCH /api/admin/products/:id": "[ADMIN] Product update.",
  "DELETE /api/admin/products/:id": "[ADMIN] Product delete.",
  "GET /api/admin/orders": "[ADMIN] Saare orders.",
  "GET /api/admin/orders/:id": "[ADMIN] Order detail.",
  "PATCH /api/admin/orders/:id/status": "[ADMIN] Order status flow (pending→paid→shipped→delivered).",
  "GET /api/admin/serials": "[ADMIN] Serial registry.",
  "GET /api/admin/serials/:code": "[ADMIN] Serial detail.",
  "POST /api/admin/serials/generate": "[ADMIN] Serials generate (productId, count).",
  "POST /api/admin/orders/:id/serials/generate": "[ADMIN] Order ke liye serials top-up.",
  "GET /api/admin/orders/:id/provision": "[ADMIN] Order provisioning (WiFi config + serials).",
  "POST /api/admin/serials/:code/mark-tested": "[ADMIN] Serial tested mark.",
  "GET /api/admin/warranty": "[ADMIN] Warranty claims.",
  "PATCH /api/admin/warranty/:id/status": "[ADMIN] Claim status (approved/rejected/resolved).",
  "GET /api/admin/contact": "[ADMIN] Contact messages.",
  "PATCH /api/admin/contact/:id/status": "[ADMIN] Contact message status.",
  "DELETE /api/admin/contact/:id": "[ADMIN] Contact message delete.",
  "POST /api/admin/reset": "[ADMIN] Factory reset (DB wipe + reinstall).",

  // ----- install -----
  "GET /api/install/status": "Install status probe (installed/db/tables).",
  "POST /api/install/connect": "DB connection test + create.",
  "POST /api/install/schema": "Saari tables banao (schema.sql).",
  "POST /api/install/admin": "Admin account + complete install.",
  "POST /api/install": "One-shot install: DB + tables + admin.",

  // ----- system -----
  "GET /api/health": "Health check — DB schema diag + build version (ops).",
  "GET /api/version": "API version (ops).",
};

// ---------------------------------------------------------------------------
// Security — path pattern se (device = api_key, public/install/docs = none,
// baaki = bearer JWT).
// ---------------------------------------------------------------------------

type Security = Array<Record<string, string[]>>;

function securityFor(path: string, method: string): Security | undefined {
  if (method === "GET" && (path === "/api/health" || path === "/api/version")) return undefined;
  if (path.startsWith("/api/device")) return [{ deviceApiKey: [] }];
  if (path.startsWith("/api/install") || path.startsWith("/api/public")) return undefined;
  if (path.startsWith("/api/docs")) return undefined;
  // Auth endpoints mostly public (login/signup/refresh/logout/forgot/reset)
  if (path.startsWith("/api/auth")) {
    if (method === "GET" || path.includes("/me") || path === "/api/auth/theme") {
      return [{ bearerAuth: [] }];
    }
    return undefined;
  }
  if (path.startsWith("/api/shop/products")) return undefined;
  return [{ bearerAuth: [] }];
}

// ---------------------------------------------------------------------------
// Request bodies — "METHOD path" → schema ref.
// ---------------------------------------------------------------------------

const BODIES: Record<string, string> = {
  "POST /api/auth/signup": "SignupBody",
  "POST /api/auth/login": "LoginBody",
  "POST /api/auth/refresh": "RefreshBody",
  "POST /api/auth/logout": "RefreshBody",
  "POST /api/auth/forgot-password": "ForgotPasswordBody",
  "POST /api/auth/reset-password": "ResetPasswordBody",
  "PATCH /api/auth/me": "UpdateProfileBody",
  "PUT /api/auth/theme": "ThemeBody",
  "POST /api/device/update": "DeviceUpdateBody",
  "POST /api/device/heartbeat": "HeartbeatBody",
  "POST /api/device/ota-progress": "OtaProgressBody",
  "POST /api/device/commands/ack": "AckBody",
  "POST /api/homes": "CreateHomeBody",
  "PATCH /api/homes/:homeId": "CreateHomeBody",
  "POST /api/homes/:homeId/transfer": "TransferBody",
  "POST /api/homes/:homeId/invitations": "InviteBody",
  "POST /api/homes/invitations/accept": "AcceptInviteBody",
  "PATCH /api/homes/:homeId/members/:userId/role": "RoleBody",
  "PATCH /api/homes/:homeId/members/:userId/safety": "SafetyBody",
  "PUT /api/homes/:homeId/members/:userId/access": "AccessBody",
  "POST /api/homes/:homeId/devices": "CreateDeviceBody",
  "POST /api/homes/:homeId/devices/bulk-status": "BulkStatusBody",
  "PATCH /api/homes/:homeId/devices/:deviceId": "UpdateDeviceBody",
  "POST /api/homes/:homeId/devices/:deviceId/status": "SetStatusBody",
  "PATCH /api/homes/:homeId/esp/:espId": "EspNameBody",
  "POST /api/homes/:homeId/rooms": "CreateRoomBody",
  "POST /api/homes/:homeId/schedules": "CreateScheduleBody",
  "PATCH /api/homes/:homeId/schedules/:scheduleId": "UpdateScheduleBody",
  "POST /api/api-keys/": "CreateApiKeyBody",
  "POST /api/assistant/chats": "CreateChatBody",
  "POST /api/assistant/chats/:chatId/messages": "ChatMessageBody",
  "POST /api/assistant/chats/:chatId/confirm": "ConfirmProposalBody",
  "POST /api/shop/orders": "CreateOrderBody",
  "POST /api/shop/orders/:id/pay/verify": "RazorpayVerifyBody",
  "POST /api/claim": "ClaimBody",
  "POST /api/warranty": "WarrantyClaimBody",
  "POST /api/public/contact": "ContactBody",
  "POST /api/public/support": "SupportSendBody",
  "POST /api/support/messages": "SupportSendBody",
  "POST /api/support/admin/messages": "SupportAdminSendBody",
  "PUT /api/support/settings/:peerUserId": "SupportSettingsBody",
};

// ---------------------------------------------------------------------------
// Schemas (components) — hand-written, shared types ke mirror.
// ---------------------------------------------------------------------------

const SCHEMAS: Record<string, unknown> = {
  // ---- envelope ----
  ErrorEnvelope: {
    type: "object",
    required: ["success", "error"],
    properties: {
      success: { type: "boolean", enum: [false] },
      error: {
        type: "object",
        required: ["code", "message"],
        properties: {
          code: { type: "string", example: "VALIDATION_ERROR" },
          message: { type: "string" },
          details: {},
        },
      },
    },
  },
  SuccessEnvelope: {
    type: "object",
    required: ["success", "data"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: {},
    },
  },

  // ---- auth ----
  SignupBody: {
    type: "object",
    required: ["username", "email", "password"],
    properties: {
      username: { type: "string", minLength: 3, maxLength: 50 },
      email: { type: "string", format: "email" },
      password: { type: "string", minLength: 6, maxLength: 255 },
      homeName: { type: "string", maxLength: 100 },
    },
  },
  LoginBody: {
    type: "object",
    required: ["usernameEmail", "password"],
    properties: {
      usernameEmail: { type: "string", example: "admin@robosphere.local" },
      password: { type: "string" },
    },
  },
  RefreshBody: { type: "object", required: ["refreshToken"], properties: { refreshToken: { type: "string" } } },
  ForgotPasswordBody: {
    type: "object",
    required: ["email"],
    properties: { email: { type: "string", format: "email" } },
  },
  ResetPasswordBody: {
    type: "object",
    required: ["token", "newPassword"],
    properties: {
      token: { type: "string", description: "Email link se aaya reset token" },
      newPassword: { type: "string", minLength: 6 },
    },
  },
  UpdateProfileBody: {
    type: "object",
    properties: {
      username: { type: "string", minLength: 3, maxLength: 50 },
      email: { type: "string", format: "email" },
      currentPassword: { type: "string", description: "Naya password set karne ke liye zaroori" },
      newPassword: { type: "string", minLength: 6 },
    },
  },
  ThemeBody: { type: "object", required: ["theme"], properties: { theme: { type: "string", enum: ["light", "dark", "system"] } } },

  User: {
    type: "object",
    properties: {
      id: { type: "integer" },
      username: { type: "string" },
      email: { type: "string" },
      role: { type: "string", enum: ["user", "system_admin"] },
      status: { type: "string", enum: ["active", "suspended"] },
      themePref: { type: "string", nullable: true },
    },
  },
  LoginResponse: {
    type: "object",
    properties: {
      accessToken: { type: "string" },
      refreshToken: { type: "string" },
      user: { $ref: "#/components/schemas/User" },
    },
  },

  // ---- homes / members ----
  CreateHomeBody: { type: "object", required: ["name"], properties: { name: { type: "string", maxLength: 100 } } },
  TransferBody: { type: "object", required: ["newOwnerId"], properties: { newOwnerId: { type: "integer" } } },
  InviteBody: {
    type: "object",
    required: ["email", "role"],
    properties: {
      email: { type: "string", format: "email" },
      role: { type: "string", enum: ["admin", "member", "viewer"] },
    },
  },
  AcceptInviteBody: { type: "object", required: ["inviteCode"], properties: { inviteCode: { type: "string", minLength: 6, maxLength: 12 } } },
  RoleBody: { type: "object", required: ["role"], properties: { role: { type: "string", enum: ["admin", "member", "viewer"] } } },
  SafetyBody: {
    type: "object",
    properties: {
      restricted: { type: "boolean" },
      dailyLimitMinutes: { type: "integer", minimum: 1, maximum: 1440, nullable: true },
    },
  },
  AccessBody: {
    type: "object",
    required: ["deviceIds"],
    properties: { deviceIds: { type: "array", maxItems: 100, items: { type: "integer" } } },
  },
  Home: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      ownerId: { type: "integer" },
      status: { type: "string", enum: ["active", "suspended"] },
      maxDevices: { type: "integer" },
      maxMembers: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ---- devices ----
  CreateDeviceBody: {
    type: "object",
    required: ["name", "type"],
    properties: {
      name: { type: "string", maxLength: 100 },
      type: { type: "string", enum: ["bulb", "fan", "ac", "tv", "plug", "custom"] },
      roomId: { type: "integer" },
      serialNumber: { type: "string", maxLength: 64 },
    },
  },
  UpdateDeviceBody: {
    type: "object",
    properties: {
      name: { type: "string", maxLength: 100 },
      roomId: { type: "integer", nullable: true },
    },
  },
  SetStatusBody: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["on", "off"] } } },
  BulkStatusBody: {
    type: "object",
    required: ["deviceIds", "status"],
    properties: {
      deviceIds: { type: "array", minItems: 1, maxItems: 50, items: { type: "integer" } },
      status: { type: "string", enum: ["on", "off"] },
    },
  },
  EspNameBody: { type: "object", required: ["name"], properties: { name: { type: "string", maxLength: 60 } } },
  Device: {
    type: "object",
    properties: {
      id: { type: "integer" },
      homeId: { type: "integer" },
      roomId: { type: "integer", nullable: true },
      name: { type: "string" },
      type: { type: "string", enum: ["bulb", "fan", "ac", "tv", "plug", "dimmer", "custom"] },
      status: { type: "string", enum: ["on", "off"] },
      customValue: { type: "string", nullable: true },
      serialNumber: { type: "string", nullable: true },
      firmwareVersion: { type: "string", nullable: true },
      ipAddress: { type: "string", nullable: true },
      lastSeen: { type: "string", format: "date-time", nullable: true },
      offline: { type: "boolean" },
      createdBy: { type: "integer" },
      createdAt: { type: "string", format: "date-time" },
      lastUpdated: { type: "string", format: "date-time" },
    },
  },

  // ---- schedules / rooms ----
  CreateScheduleBody: {
    type: "object",
    required: ["deviceId", "action", "type"],
    properties: {
      deviceId: { type: "integer" },
      action: { type: "string", enum: ["on", "off"] },
      type: { type: "string", enum: ["once", "daily", "weekly", "cron"] },
      runAt: { type: "string", format: "date-time", nullable: true, description: "once/daily/weekly ke liye base time" },
      cron: { type: "string", nullable: true, description: "type=cron: 5-field cron (minute hour dom month dow)", example: "0 7 * * *" },
    },
  },
  UpdateScheduleBody: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["on", "off"] },
      enabled: { type: "boolean" },
      runAt: { type: "string", format: "date-time", nullable: true },
      cron: { type: "string", nullable: true },
    },
  },
  CreateRoomBody: { type: "object", required: ["name"], properties: { name: { type: "string", maxLength: 100 } } },

  // ---- api keys ----
  CreateApiKeyBody: {
    type: "object",
    properties: {
      label: { type: "string", maxLength: 100 },
      homeId: { type: "integer", description: "Device key ke liye home select karo" },
      expiresInDays: { type: "integer", minimum: 1, maximum: 3650 },
    },
  },
  ApiKey: {
    type: "object",
    properties: {
      id: { type: "integer" },
      userId: { type: "integer" },
      homeId: { type: "integer", nullable: true },
      label: { type: "string", nullable: true },
      keyPrefix: { type: "string", description: "Raw key ka pehla 8 chars — display ke liye" },
      createdAt: { type: "string", format: "date-time" },
      expiresAt: { type: "string", format: "date-time", nullable: true },
      lastUsedAt: { type: "string", format: "date-time", nullable: true },
    },
  },

  // ---- assistant ----
  CreateChatBody: {
    type: "object",
    required: ["homeId"],
    properties: { homeId: { type: "integer" }, title: { type: "string", maxLength: 100 } },
  },
  ChatMessageBody: { type: "object", required: ["content"], properties: { content: { type: "string", minLength: 1, maxLength: 2000 } } },
  ConfirmProposalBody: { type: "object", required: ["messageId"], properties: { messageId: { type: "integer" } } },

  // ---- shop ----
  CreateOrderBody: {
    type: "object",
    required: ["items", "shipping", "paymentMethod"],
    properties: {
      items: {
        type: "array",
        minItems: 1,
        items: {
          type: "object",
          required: ["productId", "quantity"],
          properties: { productId: { type: "integer" }, quantity: { type: "integer", minimum: 1 } },
        },
      },
      shipping: {
        type: "object",
        required: ["name", "phone", "address"],
        properties: {
          name: { type: "string" },
          phone: { type: "string" },
          address: { type: "string" },
        },
      },
      wifi: {
        type: "object",
        properties: { ssid: { type: "string" }, password: { type: "string" } },
        description: "Pre-configured WiFi (order pe de do — board factory me flash hoke aayega)",
      },
      paymentMethod: { type: "string", enum: ["cod", "upi", "manual"] },
    },
  },
  RazorpayVerifyBody: {
    type: "object",
    required: ["razorpayOrderId", "razorpayPaymentId", "razorpaySignature"],
    properties: {
      razorpayOrderId: { type: "string" },
      razorpayPaymentId: { type: "string" },
      razorpaySignature: { type: "string" },
    },
  },
  Product: {
    type: "object",
    properties: {
      id: { type: "integer" },
      name: { type: "string" },
      modelCode: { type: "string" },
      relayCount: { type: "integer" },
      price: { type: "string", description: "Decimal as string", example: "799.00" },
      description: { type: "string", nullable: true },
      features: {},
      active: { type: "boolean" },
    },
  },
  Order: {
    type: "object",
    properties: {
      id: { type: "integer" },
      orderNumber: { type: "string" },
      userId: { type: "integer" },
      status: { type: "string", enum: ["pending", "paid", "shipped", "delivered", "cancelled"] },
      paymentMethod: { type: "string", enum: ["cod", "upi", "manual"] },
      totalAmount: { type: "string" },
      shippingName: { type: "string" },
      shippingPhone: { type: "string" },
      shippingAddress: { type: "string" },
      wifiSsid: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
    },
  },

  // ---- claim / warranty ----
  ClaimBody: {
    type: "object",
    required: ["serialCode", "homeId"],
    properties: {
      serialCode: { type: "string", example: "RS-4CH-ABCDEF", description: "Box sticker pe serial — ownership proof" },
      homeId: { type: "integer" },
    },
  },
  WarrantyClaimBody: {
    type: "object",
    required: ["serialCode", "reason"],
    properties: {
      serialCode: { type: "string" },
      reason: { type: "string", maxLength: 255 },
      description: { type: "string" },
    },
  },

  // ---- device API (ESP32) ----
  DeviceUpdateBody: {
    type: "object",
    required: ["device_id", "status"],
    properties: {
      api_key: { type: "string", description: "ya ?api_key= query param / Bearer header" },
      device_id: { type: "integer" },
      status: { type: "string", enum: ["on", "off"] },
    },
  },
  HeartbeatBody: {
    type: "object",
    required: ["device_id"],
    properties: {
      api_key: { type: "string" },
      device_id: { type: "integer" },
      ip: { type: "string" },
      fw_version: { type: "string" },
      mac: { type: "string" },
      ssid: { type: "string" },
      serial: { type: "string" },
      model: { type: "string" },
      states: { type: "string", description: "Actual relay states (comma-separated 1/0)" },
    },
  },
  OtaProgressBody: {
    type: "object",
    required: ["device_id", "progress"],
    properties: {
      api_key: { type: "string" },
      device_id: { type: "integer" },
      progress: { type: "integer", minimum: 0, maximum: 100 },
      status: { type: "string", maxLength: 32 },
    },
  },
  AckBody: {
    type: "object",
    required: ["command_id", "device_id", "status"],
    properties: {
      api_key: { type: "string" },
      command_id: { type: "integer" },
      device_id: { type: "integer" },
      status: { type: "string", enum: ["executed", "failed"] },
    },
  },

  // ---- support ----
  SupportSendBody: {
    type: "object",
    properties: {
      message: { type: "string", maxLength: 4000 },
      attachmentName: { type: "string", maxLength: 255 },
      attachmentType: { type: "string", description: "image/png|jpeg|gif|webp|heic, application/pdf, text/plain" },
      attachmentData: { type: "string", description: "base64 (max ~2MB)" },
    },
  },
  SupportAdminSendBody: {
    type: "object",
    required: ["userId"],
    properties: {
      userId: { type: "integer" },
      message: { type: "string", maxLength: 4000 },
      attachmentName: { type: "string" },
      attachmentType: { type: "string" },
      attachmentData: { type: "string" },
    },
  },
  SupportSettingsBody: {
    type: "object",
    properties: { muted: { type: "boolean" }, pinned: { type: "boolean" } },
  },

  // ---- public ----
  ContactBody: {
    type: "object",
    required: ["name", "message"],
    properties: {
      name: { type: "string" },
      email: { type: "string" },
      phone: { type: "string" },
      subject: { type: "string" },
      message: { type: "string" },
    },
  },
};

// ---------------------------------------------------------------------------
// Build the document.
// ---------------------------------------------------------------------------

function tagFor(path: string): string {
  const seg = path.replace(/^\/api\//, "").split("/")[0] ?? "system";
  const map: Record<string, string> = {
    auth: "Auth",
    device: "Device API (ESP32)",
    homes: "Homes",
    "api-keys": "API Keys",
    notifications: "Notifications",
    assistant: "AI Assistant",
    shop: "Shop",
    claim: "Activate (Serial)",
    warranty: "Warranty",
    public: "Public",
    support: "Support",
    admin: "Admin",
    install: "Install",
    firmware: "System",
    health: "System",
    version: "System",
  };
  return map[seg] ?? "Homes";
}

export interface OpenApiPathItem {
  summary?: string;
  tags?: string[];
  parameters?: unknown[];
  security?: Security;
  requestBody?: unknown;
  responses: Record<string, unknown>;
}

function paramsFor(path: string): unknown[] {
  const out: unknown[] = [];
  const re = /:([A-Za-z0-9_]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) {
    out.push({
      name: m[1],
      in: "path",
      required: true,
      schema: { type: "integer" },
      description: `\`${m[1]}\` — numeric ID`,
    });
  }
  return out;
}

export function buildOpenApiSpec(): Record<string, unknown> {
  const endpoints: Endpoint[] = [];
  // apiRouter ke direct routes (firmware/current) — nested mounts skip
  walkRouter(apiRouter, "/api", endpoints, true);
  // Mounted routers — prefix apiMounts se (routes/index.ts single source)
  for (const m of apiMounts) {
    walkRouter(m.router, `/api${m.prefix}`, endpoints);
  }
  // app.ts me direct routes
  walkRouter(installRouter, "/api/install", endpoints);
  endpoints.push({ method: "GET", path: "/api/health" });
  endpoints.push({ method: "GET", path: "/api/version" });

  const paths: Record<string, Record<string, OpenApiPathItem>> = {};
  const seen = new Set<string>();

  for (const ep of endpoints) {
    const key = `${ep.method} ${ep.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const desc = DESCRIPTIONS[key];
    const tag = tagFor(ep.path);
    const security = securityFor(ep.path, ep.method);
    const bodyRef = BODIES[key];

    const op: OpenApiPathItem = {
      tags: [tag],
      responses: {
        200: {
          description: "Success — standard envelope { success:true, data }",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/SuccessEnvelope" },
            },
          },
        },
        400: { description: "Validation error — { success:false, error }", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        401: { description: "Unauthorized — token/api_key missing ya invalid", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
        429: { description: "Rate limited — Retry-After header dekho", content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorEnvelope" } } } },
      },
    };
    if (desc) op.summary = desc;
    const params = paramsFor(ep.path);
    if (params.length) op.parameters = params;
    if (security) op.security = security;
    if (bodyRef) {
      op.requestBody = {
        required: true,
        content: { "application/json": { schema: { $ref: `#/components/schemas/${bodyRef}` } } },
      };
    }

    const p = paths[ep.path] ?? (paths[ep.path] = {});
    p[ep.method.toLowerCase()] = op;
  }

  return {
    openapi: "3.0.3",
    info: {
      title: "SwitchNest / RoboSphere API",
      description:
        "Smart-home IoT platform API — multi-tenant homes + devices + timers + shop.\n\n" +
        "**Auth:** saare endpoints `Authorization: Bearer <accessToken>` (login se).\n" +
        "**ESP32/device endpoints** (`/api/device/*`): `?api_key=rs_...` query param ya `Authorization: Bearer rs_...`.\n" +
        "**Envelope:** har response `{ success, data }` ya `{ success:false, error:{ code, message } }`.\n" +
        "**Rate limits (per IP, 429 + Retry-After header):** login 10/15min · signup 5/15min · forgot-password 5/h · API-key create 20/h · support send 10/min · contact form 5/h · public assistant 20/min · claim 20/h · warranty status 30/min + claim 10/h · assistant chat message 20/min + confirm 30/min · ESP32 device API 1200/600 per min.\n\n" +
        "Raw spec: `GET /api/docs/openapi.json` · Offline list: `GET /api/docs/plain`",
      version: "2.2.0",
      contact: { name: "SwitchNest Support" },
    },
    servers: [{ url: "/", description: "Same host (relative — local ya production dono pe chalega)" }],
    tags: [
      { name: "Device API (ESP32)", description: "ESP32 boards / machine clients — api_key auth, polling + command queue + OTA" },
      { name: "Auth", description: "Signup/login/refresh + password reset" },
      { name: "Homes", description: "Multi-tenant homes — family members, devices, rooms, schedules" },
      { name: "Shop", description: "Product catalog, orders, payment, serial activation" },
      { name: "Admin", description: "Platform administration (system_admin only)" },
      { name: "Public", description: "Bina login endpoints — site settings, contact, sales assistant" },
      { name: "Install", description: "First-run install wizard" },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Login/signup se mila access token",
        },
        deviceApiKey: {
          type: "apiKey",
          in: "query",
          name: "api_key",
          description: "Device key (rs_...) — home ke liye bana hua. ESP32 isi se auth karta hai.",
        },
      },
      schemas: SCHEMAS,
    },
  };
}

/** Bina built kare ek baar cache — server boot pe docs turant. */
let cached: Record<string, unknown> | null = null;
export function getOpenApiSpec(): Record<string, unknown> {
  if (!cached) cached = buildOpenApiSpec();
  return cached;
}
