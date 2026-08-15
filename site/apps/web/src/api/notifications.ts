import type { ApiResponse } from "@robosphere/shared";
import { api } from "./client";

export type NotificationCategory = "support" | "device" | "schedule" | "system";

export interface Notification {
  id: number;
  userId: number;
  category: NotificationCategory | string;
  type: "info" | "warning" | "error";
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationPage {
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ListNotificationsParams {
  page?: number;
  pageSize?: number;
  category?: string;
  type?: string;
  unread?: boolean;
}

export async function listNotifications(
  params: ListNotificationsParams = {},
): Promise<ApiResponse<NotificationPage>> {
  const { data } = await api.get<ApiResponse<NotificationPage>>("/notifications", {
    params: {
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      category: params.category ?? "all",
      type: params.type ?? "all",
      ...(params.unread ? { unread: "1" } : {}),
    },
  });
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

export async function removeNotification(id: number): Promise<ApiResponse<{ ok: boolean }>> {
  const { data } = await api.delete<ApiResponse<{ ok: boolean }>>(`/notifications/${id}`);
  return data;
}
