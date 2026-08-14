import type { ApiResponse } from "@robosphere/shared";
import { api } from "./client";

export interface ApiKeyView {
  id: number;
  userId: number;
  homeId: number | null;
  label: string | null;
  keyPrefix: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  rawKey?: string;
}

export async function listApiKeys(): Promise<ApiResponse<ApiKeyView[]>> {
  const { data } = await api.get<ApiResponse<ApiKeyView[]>>("/api-keys");
  return data;
}

export async function createApiKey(input: {
  label?: string;
  homeId?: number;
  expiresInDays?: number;
}): Promise<ApiResponse<ApiKeyView>> {
  const { data } = await api.post<ApiResponse<ApiKeyView>>("/api-keys", input);
  return data;
}

export async function revokeApiKey(id: number): Promise<ApiResponse<{ message: string }>> {
  const { data } = await api.delete<ApiResponse<{ message: string }>>(`/api-keys/${id}`);
  return data;
}
