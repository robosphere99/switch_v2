/**
 * @robosphere/shared
 * Domain types shared between the API and the web app.
 * Single source of truth for the v2 domain model.
 */

// ---------- Enums ----------

export const USER_ROLES = ["user", "system_admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const HOME_MEMBER_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type HomeMemberRole = (typeof HOME_MEMBER_ROLES)[number];

export const INVITATION_STATUSES = ["pending", "accepted", "expired", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const DEVICE_TYPES = ["bulb", "fan", "ac", "tv", "plug", "custom"] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];

export const DEVICE_STATUSES = ["on", "off"] as const;
export type DeviceStatus = (typeof DEVICE_STATUSES)[number];

export const COMMAND_STATUSES = ["pending", "executed", "failed", "cancelled"] as const;
export type CommandStatus = (typeof COMMAND_STATUSES)[number];

export const SCHEDULE_TYPES = ["once", "daily", "weekly", "cron"] as const;
export type ScheduleType = (typeof SCHEDULE_TYPES)[number];

export const NOTIFICATION_TYPES = ["info", "warning", "error"] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const NOTIFICATION_CATEGORIES = ["support", "device", "schedule", "system"] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

// ---------- Entities ----------

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface Home {
  id: number;
  name: string;
  ownerId: number;
  status: "active" | "suspended";
  maxDevices: number;
  maxMembers: number;
  createdAt: string;
}

export interface HomeMember {
  id: number;
  homeId: number;
  userId: number;
  role: HomeMemberRole;
  joinedAt: string;
  user?: User;
}

export interface Room {
  id: number;
  homeId: number;
  name: string;
  createdAt: string;
}

export interface Device {
  id: number;
  homeId: number;
  roomId: number | null;
  name: string;
  type: DeviceType;
  status: DeviceStatus;
  customValue: string | null;
  serialNumber: string | null;
  firmwareVersion: string | null;
  ipAddress: string | null;
  lastSeen: string | null;
  offline: boolean;
  createdBy: number;
  createdAt: string;
  lastUpdated: string;
  /** Physical ESP board jo is device ko control karta hai (board = N relays = N devices). */
  esp?: {
    id: number;
    name: string | null;
    serialCode: string | null;
    modelCode: string | null;
    offline: boolean;
    lastSeen: string | null;
  } | null;
}

export interface DeviceLog {
  id: number;
  deviceId: number;
  actorId: number | null;
  logType: string;
  logMessage: string;
  createdAt: string;
}

export interface DeviceCommand {
  id: number;
  deviceId: number;
  actorId: number | null;
  command: string;
  status: CommandStatus;
  createdAt: string;
  executedAt: string | null;
}

export interface Schedule {
  id: number;
  deviceId: number;
  createdBy: number;
  action: DeviceStatus;
  type: ScheduleType;
  runAt: string | null;
  cron: string | null;
  enabled: boolean;
  nextRun: string | null;
  lastRun: string | null;
  createdAt: string;
}

export interface ApiKey {
  id: number;
  userId: number;
  homeId: number | null;
  label: string | null;
  keyPrefix: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

// ---------- API envelope ----------

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---------- Auth payloads ----------

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface AccessTokenPayload {
  sub: number;
  username: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}
