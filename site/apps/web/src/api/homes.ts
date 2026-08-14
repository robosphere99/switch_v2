import type { ApiResponse, Device, Home, HomeMember, Room } from "@robosphere/shared";
import { api } from "./client";

export interface HomeListItem extends Home {
  members: { role: HomeMember["role"] }[];
  _count: { devices: number; members: number };
}

export async function listHomes(): Promise<ApiResponse<HomeListItem[]>> {
  const { data } = await api.get<ApiResponse<HomeListItem[]>>("/homes");
  return data;
}

export async function listMembers(homeId: number): Promise<ApiResponse<HomeMember[]>> {
  const { data } = await api.get<ApiResponse<HomeMember[]>>(`/homes/${homeId}/members`);
  return data;
}

export async function createHome(name: string): Promise<ApiResponse<Home>> {
  const { data } = await api.post<ApiResponse<Home>>("/homes", { name });
  return data;
}

export async function renameHome(homeId: number, name: string): Promise<ApiResponse<Home>> {
  const { data } = await api.patch<ApiResponse<Home>>(`/homes/${homeId}`, { name });
  return data;
}

export async function transferHome(homeId: number, newOwnerId: number): Promise<ApiResponse<Home>> {
  const { data } = await api.post<ApiResponse<Home>>(`/homes/${homeId}/transfer`, { newOwnerId });
  return data;
}

export async function deleteHome(homeId: number): Promise<ApiResponse<{ message: string }>> {
  const { data } = await api.delete<ApiResponse<{ message: string }>>(`/homes/${homeId}`);
  return data;
}

export interface HomeDetail extends Home {
  rooms: Room[];
  devices: Device[];
  members: HomeMember[];
  _count: { devices: number; members: number };
}

export async function getHomeDetail(homeId: number): Promise<ApiResponse<HomeDetail>> {
  const { data } = await api.get<ApiResponse<HomeDetail>>(`/homes/${homeId}`);
  return data;
}
