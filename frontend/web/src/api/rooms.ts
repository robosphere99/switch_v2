import type { ApiResponse, Room } from "@robosphere/shared";
import { api } from "./client";

export async function createRoom(
  homeId: number,
  name: string,
): Promise<ApiResponse<Room>> {
  const { data } = await api.post<ApiResponse<Room>>(`/homes/${homeId}/rooms`, { name });
  return data;
}

export async function deleteRoom(
  homeId: number,
  roomId: number,
): Promise<ApiResponse<{ message: string }>> {
  const { data } = await api.delete<ApiResponse<{ message: string }>>(
    `/homes/${homeId}/rooms/${roomId}`,
  );
  return data;
}
