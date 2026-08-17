import type { ApiResponse, Device, DeviceStatus, DeviceType, UsageAnalytics } from "@robosphere/shared";
import { api } from "./client";

export interface CreateDeviceInput {
  name: string;
  type: DeviceType;
  roomId?: number;
}

export interface DeviceLogEntry {
  id: number;
  deviceId: number;
  actorId: number | null;
  logType: string;
  logMessage: string;
  createdAt: string;
  actor: { id: number; username: string } | null;
}

export async function listDevices(homeId: number): Promise<ApiResponse<Device[]>> {
  const { data } = await api.get<ApiResponse<Device[]>>(`/homes/${homeId}/devices`);
  return data;
}

export async function createDevice(
  homeId: number,
  input: CreateDeviceInput,
): Promise<ApiResponse<Device>> {
  const { data } = await api.post<ApiResponse<Device>>(`/homes/${homeId}/devices`, input);
  return data;
}

export async function setDeviceStatus(
  homeId: number,
  deviceId: number,
  status: DeviceStatus,
): Promise<ApiResponse<Device>> {
  const { data } = await api.post<ApiResponse<Device>>(
    `/homes/${homeId}/devices/${deviceId}/status`,
    { status },
  );
  return data;
}

export async function bulkSetDeviceStatus(
  homeId: number,
  deviceIds: number[],
  status: DeviceStatus,
): Promise<ApiResponse<Device[]>> {
  const { data } = await api.post<ApiResponse<Device[]>>(
    `/homes/${homeId}/devices/bulk-status`,
    { deviceIds, status },
  );
  return data;
}

export async function updateDevice(
  homeId: number,
  deviceId: number,
  patch: { name?: string; roomId?: number | null },
): Promise<ApiResponse<Device>> {
  const { data } = await api.patch<ApiResponse<Device>>(
    `/homes/${homeId}/devices/${deviceId}`,
    patch,
  );
  return data;
}

export async function deleteDevice(
  homeId: number,
  deviceId: number,
): Promise<ApiResponse<{ message: string }>> {
  const { data } = await api.delete<ApiResponse<{ message: string }>>(
    `/homes/${homeId}/devices/${deviceId}`,
  );
  return data;
}

export async function renameEsp(
  homeId: number,
  espId: number,
  name: string,
): Promise<ApiResponse<{ id: number; name: string }>> {
  const { data } = await api.patch<ApiResponse<{ id: number; name: string }>>(
    `/homes/${homeId}/esp/${espId}`,
    { name },
  );
  return data;
}

export async function getUsageAnalytics(
  homeId: number,
  days = 7,
): Promise<ApiResponse<UsageAnalytics>> {
  const { data } = await api.get<ApiResponse<UsageAnalytics>>(
    `/homes/${homeId}/analytics/usage?days=${days}`,
  );
  return data;
}

export async function getDeviceLogs(
  homeId: number,
  deviceId: number,
): Promise<ApiResponse<DeviceLogEntry[]>> {
  const { data } = await api.get<ApiResponse<DeviceLogEntry[]>>(
    `/homes/${homeId}/devices/${deviceId}/logs`,
  );
  return data;
}

export interface MyBoardDevice {
  id: number;
  name: string;
  type: string;
  status: "on" | "off";
  offline: boolean;
  lastSeen: string | null;
}

export interface MyBoard {
  id: number;
  homeId: number;
  name: string | null;
  serialCode: string | null;
  modelCode: string | null;
  macAddress: string;
  ssid: string | null;
  ipAddress: string | null;
  firmwareVersion: string | null;
  offline: boolean;
  lastSeen: string | null;
  devices: MyBoardDevice[];
}

export interface MyBoardsGroup {
  homeId: number;
  homeName: string;
  role: string;
  boards: MyBoard[];
}

export async function listMyBoards(): Promise<ApiResponse<MyBoardsGroup[]>> {
  const { data } = await api.get<ApiResponse<MyBoardsGroup[]>>("/homes/my-boards");
  return data;
}

export interface CurrentFirmware {
  modelCode: string;
  version: string;
  releaseNotes: string | null;
}

/** User board pe firmware OTA push kare. */
export async function requestOta(
  homeId: number,
  deviceId: number,
): Promise<ApiResponse<{ version: string; model: string; message: string }>> {
  const { data } = await api.post<ApiResponse<{ version: string; model: string; message: string }>>(
    `/homes/${homeId}/devices/${deviceId}/ota`,
  );
  return data;
}

/** Current published firmware versions — "update available" badge ke liye. */
export async function getCurrentFirmware(): Promise<ApiResponse<CurrentFirmware[]>> {
  const { data } = await api.get<ApiResponse<CurrentFirmware[]>>("/firmware/current");
  return data;
}

/** v1.2.10 vs v1.2.9 — numeric compare; latest > current means update available. */
export function isNewerVersion(latest: string | undefined | null, current: string | undefined | null): boolean {
  if (!latest || !current) return false;
  if (latest === current) return false;
  const a = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const b = current.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}
