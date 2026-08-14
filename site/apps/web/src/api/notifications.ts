import type { ApiResponse } from "@robosphere/shared";
import { api } from "./client";

export interface Notification {
  id: number;
  userId: number;
  type: "info" | "warning" | "error";
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listNotifications(): Promise<ApiResponse<Notification[]>> {
  const { data } = await api.get<ApiResponse<Notification[]>>("/notifications");
  return data;
}

export async function unreadCount(): Promise<ApiResponse<number>> {
  const { data } = await api.get<ApiResponse<number>>("/notifications/unread-count");
  return data;
}

export async function markRead(id: number): Promise<ApiResponse<{ ok: boolean }>> {
  const { data } = await api.post<ApiResponse<{ ok: boolean }>>(`/notifications/${id}/read`);
  return data;
}

export async function markAllRead(): Promise<ApiResponse<{ ok: boolean }>> {
  const { data } = await api.post<ApiResponse<{ ok: boolean }>>("/notifications/read-all");
  return data;
}
