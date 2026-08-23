import type { ApiResponse, User, UserStatus, Home } from "@robosphere/shared";
import { api } from "./client";

export interface LeakState {
  running: boolean;
  startedAt: string;
  lastCheckedAt: string | null;
  leaking: boolean;
  detail: {
    pid: number;
    growthPct: number;
    spanH: number;
    rssFirst: number;
    rssLast: number;
    firstTs: string;
    lastTs: string;
  } | null;
  thresholdPct: number;
  windowH: number;
  incidents: Array<Record<string, unknown>>;
}

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
  orders: number;
  pendingOrders: number;
  ordersToday: number;
  ordersThisMonth: number;
  revenueTotal: number;
  revenueThisMonth: number;
  newUsers7d: number;
  supportMessages: number;
  contactMessages: number;
  deviceLogs24h: number;
  requests: { today: number; last24h: number; total: number };
  usersByDay: Record<string, number>;
  ordersByDay: Record<string, number>;
  revenueByDay: Record<string, number>;
  leak: LeakState | null;
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
} export async function getStats(): Promise<ApiResponse<AdminStats>> {
  const { data } = await api.get<ApiResponse<AdminStats>>("/admin/stats");
  return data;
}

export interface SiteSettingsPayload {
  siteName?: string;
  supportEmail?: string;
  supportPhone?: string;
  supportAddress?: string;
  supportHours?: string;
  brandColor?: string;
  siteUrl?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  /** Naya password hi bhejo; blank = purana rakho */
  smtpPass?: string;
  smtpFrom?: string;
  smtpSecure?: boolean;
  /** AI assistant config — UI se (env ke bajaye). Blank key = purana rakho. */
  aiProvider?: "openai" | "gemini" | "ollama" | "";
  aiApiKey?: string;
  aiBaseUrl?: string;
  aiModel?: string;
  deviceTelemetryRetentionDays?: number;
  supportTicketMediaRetentionDays?: number;
  chatHistoryRetentionDays?: number;
}

export interface AdminSettings extends SiteSettingsPayload {
  smtpPassSet: boolean;
  aiApiKeySet: boolean;
}

export async function getAdminSettings(): Promise<ApiResponse<AdminSettings>> {
  const { data } = await api.get("/admin/settings");
  return data;
}

export async function updateAdminSettings(patch: SiteSettingsPayload): Promise<ApiResponse<AdminSettings>> {
  const { data } = await api.put("/admin/settings", patch);
  return data;
}

/** SMTP test mail — admin ke email pe. */
export async function testAdminEmail(): Promise<ApiResponse<{ sent: boolean }>> {
  const { data } = await api.post("/admin/settings/test-email");
  return data;
}

/** AI config test — chhota completion call, sahi chalta hai ya nahi. */
export async function testAdminAi(): Promise<ApiResponse<{ ok: boolean; reply?: string; provider?: string; model?: string }>> {
  const { data } = await api.post("/admin/settings/ai-test");
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

export async function createUser(payload: { username: string; email: string; password: string; role?: string }): Promise<ApiResponse<AdminUser>> {
  const { data } = await api.post<ApiResponse<AdminUser>>("/admin/users", payload);
  return data;
}

export async function resetUserPassword(id: number, password: string): Promise<ApiResponse<{ reset: boolean; message: string }>> {
  const { data } = await api.post<ApiResponse<{ reset: boolean; message: string }>>(`/admin/users/${id}/reset-password`, { password });
  return data;
}

export async function sendResetEmail(id: number): Promise<ApiResponse<{ sent: boolean; message: string }>> {
  const { data } = await api.post<ApiResponse<{ sent: boolean; message: string }>>(`/admin/users/${id}/send-reset-email`);
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
  crashes: Array<{ line: string; count: number }>;
  iisnodeLogs: Array<{ name: string; path: string; size: number; lines: string[] }>;
}

export async function getAdminLogs(): Promise<ApiResponse<AdminLogsResponse>> {
  const { data } = await api.get<ApiResponse<AdminLogsResponse>>("/admin/logs");
  return data;
}

/** ---------- Startup diagnostics (boot/heartbeat/exit — 503 diagnosis) ---------- */

export interface AdminDiagnostics {
  logPath: string | null;
  logBytes: number;
  error?: string;
  process: {
    pid: number;
    uptimeSec: number;
    rssMB: number;
    heapMB: number;
    node: string;
    startedAt: string;
  };
  boot: string[];
  exits: string[];
  crashes: string[];
  serverErrors: string[];
  stats: { reqEnd: number; reqAbort: number; exitsInTail: number; bootsInTail: number };
  hbSeries: Array<{ ts: string; pid: number; uptime: number; rss: number; heap: number | null }>;
  healthCheck: {
    running: boolean;
    intervalSec: number;
    startedAt: string;
    lastCheck: { ts: string; ok: boolean; status: number | null; ms: number; err: string | null } | null;
    checksTotal: number;
    checksOk: number;
    successRate: number | null;
    activeIncident: { id: string; startedAt: string; lastStatus: number | null; lastErr: string | null } | null;
    checking: boolean;
    incidents: Array<{
      ts: string;
      type: string;
      id: string;
      failCount?: number;
      lastStatus?: number | null;
      lastErr?: string | null;
      end?: { ts: string; durationSec: number; recoveredStatus?: number | null } | null;
    }>;
  };
  leak: LeakState | null;
}

export async function getAdminDiagnostics(): Promise<ApiResponse<AdminDiagnostics>> {
  const { data } = await api.get<ApiResponse<AdminDiagnostics>>("/admin/diagnostics");
  return data;
}

export interface DeploySync {
  /** `local` = dev machine (git checkout) GitHub main se aage hai — alarm nahi. */
  status: "synced" | "pending" | "lagging" | "local" | "unknown";
  deployedCommit: string | null;
  deployedSource?: "marker" | "git" | "build" | null;
  latestCommit: string | null;
  ageMin: number | null;
  since: string | null;
}

export interface DeployInfo {
  marker: { deployedAt?: string; commit?: string; branch?: string } | null;
  git: { commit: string; branch: string } | null;
  build: { commit: string; builtAt: string } | null;
  deployedAt: string | null;
  latest: { commit: string; branch: string; ts: string } | null;
  sync: DeploySync | null;
  ci: {
    status: "pass" | "fail" | "pending" | "unknown";
    runId?: number;
    workflow?: string;
    createdAt?: string;
    updatedAt?: string;
    reason?: string;
  } | null;
  processUptimeSec: number;
  startedAt: string;
}

export async function getDeployInfo(): Promise<ApiResponse<DeployInfo>> {
  return api.get("/admin/deploy-info").then((r) => r.data);
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
  attachmentData: string | null; // legacy: base64 blob (purane messages)
  attachmentPath: string | null; // naya: disk file (hardware/attachments)
  readByUser: boolean;
  readByAdmin: boolean;
  deletedAt: string | null;
  createdAt: string;
}

/** Per-conversation settings — mute (🔕) + pin (📌). */
export interface SupportChatSetting {
  peerUserId: number;
  mutedAt: string | null;
  pinnedAt: string | null;
}

/** Admin: meri chat settings (har user ke liye). */
export async function getSupportSettings(): Promise<ApiResponse<{ settings: SupportChatSetting[] }>> {
  const { data } = await api.get<ApiResponse<{ settings: SupportChatSetting[] }>>("/support/settings");
  return data;
}

/** Admin: kisi user ki conversation mute/pin karo. */
export async function setSupportSettings(
  peerUserId: number,
  input: { muted?: boolean; pinned?: boolean },
): Promise<ApiResponse<SupportChatSetting>> {
  const { data } = await api.put<ApiResponse<SupportChatSetting>>(`/support/settings/${peerUserId}`, input);
  return data;
}

/** Admin: koi bhi message delete (moderation). */
export async function deleteSupportMessage(id: number): Promise<ApiResponse<{ deleted: boolean }>> {
  const { data } = await api.delete<ApiResponse<{ deleted: boolean }>>(`/support/admin/messages/${id}`);
  return data;
}

/** Admin: kisi user ka poora thread clear. */
export async function clearSupportConversation(userId: number): Promise<ApiResponse<{ cleared: number }>> {
  const { data } = await api.delete<ApiResponse<{ cleared: number }>>(`/support/admin/messages`, {
    params: { peerUserId: userId },
  });
  return data;
}

/** Admin: kisi EK user ki chat read/unread mark (context-menu se). */
export async function setSupportThreadRead(userId: number, read: boolean): Promise<ApiResponse<{ updated: number }>> {
  const { data } = await api.post<ApiResponse<{ updated: number }>>(`/support/admin/thread-read`, {
    userId,
    read,
  });
  return data;
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

/** WhatsApp-style inbox — ek row per user jisne support me baat ki. */
export interface SupportConversation {
  userId: number;
  username: string;
  email: string | null;
  lastPreview: string;
  lastSenderRole: "admin" | "user";
  lastAt: string;
  unreadCount: number;
}

export async function getSupportConversations(): Promise<
  ApiResponse<{ conversations: SupportConversation[]; totalUnread: number }>
> {
  const { data } = await api.get<ApiResponse<{ conversations: SupportConversation[]; totalUnread: number }>>(
    "/support/admin/conversations",
  );
  return data;
}

/** Admin: saari support chats "read" mark karo — badge turant hat jata hai. */
export async function markAllSupportRead(): Promise<ApiResponse<{ unread: number }>> {
  const { data } = await api.post<ApiResponse<{ unread: number }>>("/support/admin/read-all");
  return data;
}

/** Support inbox: user ka context (orders / homes / devices / ESP boards). */
export interface SupportUserContext {
  user: {
    id: number;
    username: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
    lastLoginAt: string | null;
  };
  homes: Array<{
    id: number;
    name: string;
    status: string;
    memberRole: string;
    owner: { id: number; username: string } | null;
    _count: { devices: number; members: number; rooms: number };
  }>;
  devices: Array<{
    id: number;
    name: string;
    type: string;
    status: string;
    serialNumber: string | null;
    offline: boolean;
    lastSeen: string | null;
    room: { name: string } | null;
    home: { name: string };
  }>;
  esps: Array<{
    id: number;
    name: string | null;
    macAddress: string;
    serialCode: string | null;
    modelCode: string | null;
    firmwareVersion: string | null;
    offline: boolean;
    ipAddress: string | null;
    lastSeen: string | null;
    home: { name: string };
  }>;
  orders: Array<{
    id: number;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    totalAmount: string;
    shippingPhone: string;
    createdAt: string;
    _count: { items: number };
  }>;
}

export async function getSupportUserContext(userId: number): Promise<ApiResponse<SupportUserContext>> {
  const { data } = await api.get<ApiResponse<SupportUserContext>>("/support/admin/context", {
    params: { userId },
  });
  return data;
}

export interface ResetResult {
  reset: boolean;
  mode: "data" | "factory";
  message: string;
}

/** Danger zone — admin power: site reset (data = test data clear; factory = sab clear + setup mode). */
export async function resetSite(mode: "data" | "factory"): Promise<ApiResponse<ResetResult>> {
  const { data } = await api.post("/admin/reset", { mode, confirm: "RESET" });
  return data;
}

export async function updateOrderStatus(id: number, status: string): Promise<ApiResponse<unknown>> {
  const { data } = await api.patch(`/admin/orders/${id}/status`, { status });
  return data;
}

export async function updateOrderPaymentStatus(id: number, paymentStatus: string): Promise<ApiResponse<unknown>> {
  const { data } = await api.patch(`/admin/orders/${id}/payment-status`, { paymentStatus });
  return data;
}
