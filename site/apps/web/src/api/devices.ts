import type { ApiResponse, Device, DeviceStatus, DeviceType } from "@robosphere/shared";
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

export async function getDeviceLogs(
  homeId: number,
  deviceId: number,
): Promise<ApiResponse<DeviceLogEntry[]>> {
  const { data } = await api.get<ApiResponse<DeviceLogEntry[]>>(
    `/homes/${homeId}/devices/${deviceId}/logs`,
  );
  return data;
}
