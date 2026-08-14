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
  home: { id: number; name: string; owner: { username: string } };
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

export async function getEspDevices(): Promise<ApiResponse<EspListResponse>> {
  const { data } = await api.get<ApiResponse<EspListResponse>>("/admin/esp");
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
