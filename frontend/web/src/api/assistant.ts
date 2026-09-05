import type { ApiResponse } from "@robosphere/shared";
import { api } from "./client";

export interface ParsedAction {
  deviceId: number;
  deviceName: string;
  action: "on" | "off";
}

export interface AssistantChat {
  id: number;
  userId: number;
  homeId: number;
  title: string;
  createdAt: string;
}

export interface AssistantMessage {
  id: number;
  chatId: number;
  role: "user" | "assistant";
  content: string;
  proposal: ParsedAction[] | null;
  createdAt: string;
}

export async function createChat(homeId: number, title?: string): Promise<ApiResponse<AssistantChat>> {
  const { data } = await api.post<ApiResponse<AssistantChat>>("/assistant/chats", { homeId, title });
  return data;
}

export async function listChats(): Promise<ApiResponse<AssistantChat[]>> {
  const { data } = await api.get<ApiResponse<AssistantChat[]>>("/assistant/chats");
  return data;
}

export async function listMessages(chatId: number): Promise<ApiResponse<AssistantMessage[]>> {
  const { data } = await api.get<ApiResponse<AssistantMessage[]>>(`/assistant/chats/${chatId}/messages`);
  return data;
}

export async function sendMessage(
  chatId: number,
  content: string,
): Promise<ApiResponse<{ chat: AssistantChat; userMessage: AssistantMessage; assistantMessage: AssistantMessage }>> {
  const { data } = await api.post<ApiResponse<{ chat: AssistantChat; userMessage: AssistantMessage; assistantMessage: AssistantMessage }>>(
    `/assistant/chats/${chatId}/messages`,
    { content },
  );
  return data;
}

export async function confirmProposal(
  chatId: number,
  messageId: number,
): Promise<ApiResponse<{ results: Array<ParsedAction & { ok: boolean; error?: string }>; assistantMessage: AssistantMessage }>> {
  const { data } = await api.post<ApiResponse<{ results: Array<ParsedAction & { ok: boolean; error?: string }>; assistantMessage: AssistantMessage }>>(
    `/assistant/chats/${chatId}/confirm`,
    { messageId },
  );
  return data;
}
