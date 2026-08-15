import type { ApiResponse, User, UserStatus, Home } from "@robosphere/shared";
import { api } from "./client";

export interface AdminStats {
  users: number;
  homes: number;
  devices: number;
  activeToday: number;
  onlineDevices: number;
  pendingCommands: number;
  apiKeys: number;
  auditCount: number;
  espBoards: number;
  offlineBoards: number;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: User["role"];
  status: UserStatus;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { ownedHomes: number; memberships: number };
}

export interface AdminHome extends Home {
  owner: { id: number; username: string; email: string };
  _count: { devices: number; members: number; rooms: number };
}

export interface AdminHomeDetail extends AdminHome {
  members: Array<{ id: number; role: string; user: { id: number; username: string; email: string } }>;
  devices: Array<{ id: number; name: string; type: string; status: string; lastSeen: string | null }>;
  rooms: Array<{ id: number; name: string }>;
}

export interface AdminDevice {
  id: number;
  homeId: number;
  roomId: number | null;
  name: string;
  type: string;
  status: string;
  serialNumber: string | null;
  lastSeen: string | null;
  online: boolean;
  createdAt: string;
  home: { id: number; name: string; owner: { username: string } };
  room: { name: string } | null;
  _count: { commands: number; logs: number };
}

export interface AdminApiKey {
  id: number;
  keyPrefix: string;
  label: string | null;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  user: { id: number; username: string; email: string };
  home: { id: number; name: string } | null;
}

export interface AdminAuditLog {
  id: number;
  actorId: number | null;
  homeId: number | null;
  action: string;
  entity: string | null;
  entityId: number | null;
  meta: unknown;
  createdAt: string;
  actor: { id: number; username: string } | null;
}

export interface GlobalSearchResult {
  q: string;
  users: Array<{ id: number; username: string; email: string; role: string; status: string }>;
  homes: Array<{ id: number; name: string; status: string; owner: { username: string } | null; _count: { devices: number; members: number } }>;
  devices: Array<{ id: number; name: string; type: string; status: string; serialNumber: string | null; ipAddress: string | null; home: { name: string } | null }>;
  esps: Array<{ id: number; name: string | null; serialCode: string | null; modelCode: string | null; ipAddress: string | null; offline: boolean; home: { name: string } | null }>;
  orders: Array<{ id: number; orderNumber: string; status: string; paymentStatus: string; totalAmount: string; createdAt: string; user: { username: string } | null }>;
  serials: Array<{ id: number; serialCode: string; status: string; orderId: number | null; product: { name: string } | null; user: { username: string } | null }>;
}

export async function globalSearch(q: string): Promise<ApiResponse<GlobalSearchResult>> {
  const { data } = await api.get<ApiResponse<GlobalSearchResult>>("/admin/search", { params: { q } });
  return data;
}

export async function getStats(): Promise<ApiResponse<AdminStats>> {
  const { data } = await api.get<ApiResponse<AdminStats>>("/admin/stats");
  return data;
}

export async function listUsers(q?: string): Promise<ApiResponse<AdminUser[]>> {
  const { data } = await api.get<ApiResponse<AdminUser[]>>("/admin/users", { params: { q } });
  return data;
}

export async function setUserStatus(id: number, status: UserStatus): Promise<ApiResponse<AdminUser>> {
  const { data } = await api.patch<ApiResponse<AdminUser>>(`/admin/users/${id}/status`, { status });
  return data;
}

export async function setUserRole(id: number, role: "user" | "system_admin"): Promise<ApiResponse<AdminUser>> {
  const { data } = await api.patch<ApiResponse<AdminUser>>(`/admin/users/${id}/role`, { role });
  return data;
}

export async function deleteUser(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/admin/users/${id}`);
  return data;
}

export async function listAllHomes(q?: string): Promise<ApiResponse<AdminHome[]>> {
  const { data } = await api.get<ApiResponse<AdminHome[]>>("/admin/homes", { params: { q } });
  return data;
}

export async function getHomeDetail(id: number): Promise<ApiResponse<AdminHomeDetail>> {
  const { data } = await api.get<ApiResponse<AdminHomeDetail>>(`/admin/homes/${id}`);
  return data;
}

export async function setHomeStatus(id: number, status: "active" | "suspended"): Promise<ApiResponse<Home>> {
  const { data } = await api.patch<ApiResponse<Home>>(`/admin/homes/${id}/status`, { status });
  return data;
}

export async function deleteHome(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/admin/homes/${id}`);
  return data;
}

export async function listAllDevices(q?: string): Promise<ApiResponse<AdminDevice[]>> {
  const { data } = await api.get<ApiResponse<AdminDevice[]>>("/admin/devices", { params: { q } });
  return data;
}

export async function listAllApiKeys(): Promise<ApiResponse<AdminApiKey[]>> {
  const { data } = await api.get<ApiResponse<AdminApiKey[]>>("/admin/api-keys");
  return data;
}

export async function deleteApiKey(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/admin/api-keys/${id}`);
  return data;
}

export async function listAuditLogs(action?: string): Promise<ApiResponse<AdminAuditLog[]>> {
  const { data } = await api.get<ApiResponse<AdminAuditLog[]>>("/admin/audit", { params: { action } });
  return data;
}

// ---------- ESP / OTA ----------

/** Ek PHYSICAL ESP board (MAC se identity) — under me uske saare devices. */
export interface EspBoard {
  id: number;
  homeId: number;
  macAddress: string;
  name: string | null;
  ssid: string | null;
  serialCode: string | null;
  modelCode: string | null;
  ipAddress: string | null;
  firmwareVersion: string | null;
  lastSeen: string | null;
  offline: boolean;
  otaPendingVersion: string | null;
  otaRequestedAt: string | null;
  otaProgress: number | null;
  otaStatus: string | null;
  home: {
    id: number;
    name: string;
    ownerId: number;
    owner: { username: string };
    apiKeys: { keyPrefix: string; label: string | null; createdAt: string }[];
  };
  devices: { id: number; name: string; type: string; status: string; room: { name: string } | null }[];
}

/** Devices jinko abhi tak koi ESP report nahi kiya (legacy / no ESP yet). */
export interface UnlinkedDevice {
  id: number;
  homeId: number;
  name: string;
  type: string;
  status: string;
  firmwareVersion: string | null;
  ipAddress: string | null;
  lastSeen: string | null;
  offline: boolean;
  serialNumber: string | null;
  home: { name: string };
}

export interface FirmwareVersion {
  id: number;
  version: string;
  url: string;
  releaseNotes: string | null;
  modelCode: string;
  isCurrent: boolean;
  createdAt: string;
}

export interface EspListResponse {
  esps: EspBoard[];
  unlinked: UnlinkedDevice[];
  currentVersion: string | null;
}

export interface FirmwareListResponse {
  versions: FirmwareVersion[];
  current: FirmwareVersion | null;
}

export async function getEspDevices(q?: string): Promise<ApiResponse<EspListResponse>> {
  const { data } = await api.get<ApiResponse<EspListResponse>>("/admin/esp", { params: { q } });
  return data;
}

/** Admin support: ESP ke home ke liye fresh API key issue (support/help ke liye). */
export async function issueEspKey(espId: number): Promise<ApiResponse<{ apiKey: string; keyPrefix: string }>> {
  const { data } = await api.post<ApiResponse<{ apiKey: string; keyPrefix: string }>>(`/admin/esp/${espId}/key`);
  return data;
}

export async function getFirmwareList(): Promise<ApiResponse<FirmwareListResponse>> {
  const { data } = await api.get<ApiResponse<FirmwareListResponse>>("/admin/firmware");
  return data;
}

export async function uploadFirmware(form: FormData): Promise<ApiResponse<{ version: string; modelCode: string; releaseNotes: string; published: boolean; url: string }>> {
  const { data } = await api.post<ApiResponse<{ version: string; modelCode: string; releaseNotes: string; published: boolean; url: string }>>(
    "/admin/firmware",
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return data;
}

export async function activateFirmware(id: number): Promise<ApiResponse<{ id: number; version: string; isCurrent: boolean }>> {
  const { data } = await api.post<ApiResponse<{ id: number; version: string; isCurrent: boolean }>>(`/admin/firmware/${id}/activate`);
  return data;
}

export async function pushOta(deviceId: number): Promise<ApiResponse<{ deviceId: number; version: string; message: string }>> {
  const { data } = await api.post<ApiResponse<{ deviceId: number; version: string; message: string }>>(`/admin/devices/${deviceId}/push-ota`);
  return data;
}

export interface EspProbeResult {
  reachable: boolean;
  reason?: string;
  latencyMs?: number;
  statusCode?: number;
}

export async function probeEsp(deviceId: number): Promise<ApiResponse<EspProbeResult>> {
  const { data } = await api.get<ApiResponse<EspProbeResult>>(`/admin/esp/${deviceId}/probe`);
  return data;
}

export async function pushOtaAll(): Promise<ApiResponse<{ count: number; version: string }>> {
  const { data } = await api.post<ApiResponse<{ count: number; version: string }>>("/admin/devices/push-ota-all");
  return data;
}

/** Admin ESP board ka friendly naam badle (PATCH /admin/esp/:id). */
export async function renameEsp(id: number, name: string): Promise<ApiResponse<{ id: number; name: string }>> {
  const { data } = await api.patch<ApiResponse<{ id: number; name: string }>>(`/admin/esp/${id}`, { name });
  return data;
}

/** Server app.log + crashguard lines — 503 crash ka asli reason yahan dikhta hai. */
export interface AdminLogsResponse {
  path: string | null;
  totalLines: number;
  lines: string[];
  crashes: string[];
  iisnodeLogs: Array<{ name: string; path: string; size: number; lines: string[] }>;
}

export async function getAdminLogs(): Promise<ApiResponse<AdminLogsResponse>> {
  const { data } = await api.get<ApiResponse<AdminLogsResponse>>("/admin/logs");
  return data;
}

/** ---------- Device support (customer service) ---------- */

export interface AdminDeviceSupport {
  id: number;
  name: string;
  type: string;
  status: string;
  serialNumber: string | null;
  firmwareVersion: string | null;
  ipAddress: string | null;
  lastSeen: string | null;
  online: boolean;
  offline: boolean | null;
  createdAt: string;
  home: {
    id: number;
    name: string;
    owner: { id: number; username: string; email: string };
    apiKeys: Array<{ keyPrefix: string; label: string | null; createdAt: string }>;
  };
  room: { name: string } | null;
  esp: {
    id: number;
    macAddress: string;
    name: string | null;
    ssid: string | null;
    serialCode: string | null;
    modelCode: string | null;
    ipAddress: string | null;
    firmwareVersion: string | null;
    lastSeen: string | null;
    offline: boolean;
    otaPendingVersion: string | null;
    otaProgress: number | null;
    otaStatus: string | null;
    devices: Array<{ id: number; name: string; type: string; status: string; customValue: string | null; lastSeen: string | null }>;
  } | null;
  logs: Array<{ id: number; logType: string; logMessage: string; createdAt: string; actor: { username: string } | null }>;
  commands: Array<{ id: number; command: string; status: string; createdAt: string; executedAt: string | null }>;
}

export async function getDeviceSupport(id: number): Promise<ApiResponse<AdminDeviceSupport>> {
  const { data } = await api.get<ApiResponse<AdminDeviceSupport>>(`/admin/devices/${id}/support`);
  return data;
}

/** Admin se device ON/OFF (support ke liye) — command enqueue karta hai, board next poll pe apply karega. */
export async function adminSetDeviceStatus(id: number, status: "on" | "off"): Promise<ApiResponse<{ id: number; status: string }>> {
  const { data } = await api.post<ApiResponse<{ id: number; status: string }>>(`/admin/devices/${id}/status`, { status });
  return data;
}

/** Fix: stuck pending commands clear karo. */
export async function clearDeviceCommands(id: number): Promise<ApiResponse<{ cleared: number }>> {
  const { data } = await api.post<ApiResponse<{ cleared: number }>>(`/admin/devices/${id}/clear-commands`);
  return data;
}

export interface EspRenameEvent {
  id: number;
  action: string;
  entity: string;
  entityId: number;
  meta: { from?: string | null; to?: string | null };
  createdAt: string;
  actor: { id: number; username: string } | null;
}

/** Board ki rename history (user + admin dono ke renames). */
export async function getEspHistory(espId: number): Promise<ApiResponse<EspRenameEvent[]>> {
  const { data } = await api.get<ApiResponse<EspRenameEvent[]>>(`/admin/esp/${espId}/history`);
  return data;
}

export interface FindResult {
  q: string;
  users: Array<{
    id: number;
    username: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    _count: { homes: number; devices: number; orders: number };
  }>;
  orders: Array<{
    id: number;
    orderNumber: string;
    status: string;
    shippingName: string;
    shippingPhone: string;
    totalAmount: string;
    createdAt: string;
    userId: number;
    user: { username: string; email: string } | null;
  }>;
  serials: Array<{
    id: number;
    serialCode: string;
    status: string;
    warrantyStatus: string;
    warrantyExpiresAt: string | null;
    orderId: number | null;
    userId: number | null;
    homeId: number | null;
    product: { name: string; modelCode: string } | null;
    order: { orderNumber: string } | null;
    user: { id: number; username: string; email: string } | null;
    home: { id: number; name: string } | null;
  }>;
  boards: Array<{
    id: number;
    name: string | null;
    macAddress: string;
    serialCode: string | null;
    modelCode: string | null;
    offline: boolean;
    lastSeen: string | null;
    firmwareVersion: string | null;
    homeId: number;
    home: { id: number; name: string; owner: { id: number; username: string; email: string } | null } | null;
  }>;
  devices: Array<{
    id: number;
    name: string;
    type: string;
    status: string;
    serialNumber: string | null;
    offline: boolean;
    home: { id: number; name: string; owner: { id: number; username: string; email: string } | null } | null;
  }>;
  messages: Array<{
    id: number;
    name: string;
    phone: string | null;
    email: string | null;
    subject: string;
    status: string;
    createdAt: string;
    userId: number | null;
  }>;
  claims: Array<{
    id: number;
    serialCode: string;
    reason: string;
    status: string;
    createdAt: string;
    userId: number;
    user: { id: number; username: string; email: string } | null;
  }>;
}

/** Customer support 'find by anything' — phone / order / serial / MAC / naam. */
export async function findAnything(q: string): Promise<ApiResponse<FindResult>> {
  const { data } = await api.get<ApiResponse<FindResult>>("/admin/find", { params: { q } });
  return data;
}

/** Support chat — admin <-> user. */
export interface SupportMessage {
  id: number;
  userId: number;
  senderRole: "admin" | "user";
  senderName: string;
  message: string;
  attachmentName: string | null;
  attachmentType: string | null;
  attachmentData: string | null;
  readByUser: boolean;
  readByAdmin: boolean;
  createdAt: string;
}

/** Support chat attachment (optional) — photo/invoice/screenshot. */
export interface SupportAttachment {
  name: string;
  type: string;
  data: string; // base64
}

/** Admin: kisi user ka poora support thread. */
export async function getSupportMessages(userId: number): Promise<ApiResponse<{ userId: number; unread: number; messages: SupportMessage[] }>> {
  const { data } = await api.get<ApiResponse<{ userId: number; unread: number; messages: SupportMessage[] }>>(
    "/support/admin/messages",
    { params: { userId } },
  );
  return data;
}

/** Admin: user ko support message bhejo. */
export async function sendSupportMessage(userId: number, message: string, attachment?: SupportAttachment | null): Promise<ApiResponse<SupportMessage>> {
  const { data } = await api.post<ApiResponse<SupportMessage>>("/support/admin/messages", {
    userId,
    message,
    ...(attachment
      ? { attachmentName: attachment.name, attachmentType: attachment.type, attachmentData: attachment.data }
      : {}),
  });
  return data;
}

/** Admin: unread support replies count (badge). */
export async function getSupportUnread(): Promise<ApiResponse<{ unread: number }>> {
  const { data } = await api.get<ApiResponse<{ unread: number }>>("/support/admin/unread-count");
  return data;
}
