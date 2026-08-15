import type { ApiResponse } from "@robosphere/shared";
import { api } from "./client";

/** Site-wide settings — public (login se pehle bhi), Admin → Settings se edit hote hain. */
export interface SiteSettings {
  siteName: string;
  supportEmail: string;
  supportPhone: string;
  supportAddress: string;
  supportHours: string;
  brandColor: string;
}

export async function getPublicSiteSettings(): Promise<ApiResponse<SiteSettings>> {
  const { data } = await api.get("/public/site-settings");
  return data;
}

export interface AssistantSuggestion {
  id: number;
  name: string;
  modelCode: string;
  relayCount: number;
  price: string;
  reason: string;
}

export interface AssistantReply {
  reply: string;
  products: AssistantSuggestion[];
  chips: string[];
}

export async function askAssistant(message: string): Promise<AssistantReply> {
  const { data } = await api.post("/public/assistant", { message });
  return data.data;
}

export async function sendContact(payload: {
  name: string;
  email?: string;
  phone?: string;
  subject?: string;
  message: string;
}): Promise<{ id: number; status: string }> {
  const { data } = await api.post("/public/contact", payload);
  return data.data;
}

export interface ContactMessageRow {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string;
  message: string;
  status: "new" | "read" | "done";
  createdAt: string;
  user?: { id: number; username: string; email: string | null; role: string } | null;
}

export interface SupportTicket {
  id: number;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
}

/** Logged-in user apni support tickets. */
export async function getMySupportTickets(): Promise<SupportTicket[]> {
  const { data } = await api.get("/public/support/my");
  return data.data;
}

/** Logged-in user apne account se support/feedback bheje (userId attach hota hai). */
export async function submitSupport(payload: {
  subject: string;
  message: string;
  phone?: string;
  orderNumber?: string;
}): Promise<{ id: number; status: string }> {
  const { data } = await api.post("/public/support", payload);
  return data.data;
}

export async function getAdminContact(): Promise<ContactMessageRow[]> {
  const { data } = await api.get("/admin/contact");
  return data.data;
}

export async function updateContactStatus(id: number, status: string): Promise<ContactMessageRow> {
  const { data } = await api.patch(`/admin/contact/${id}/status`, { status });
  return data.data;
}

export async function deleteContact(id: number): Promise<void> {
  await api.delete(`/admin/contact/${id}`);
}

/** Support chat — user side. */
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

/** User side chat settings — mute/pin (peer = support team). */
export interface SupportChatSetting {
  peerUserId: number;
  mutedAt: string | null;
  pinnedAt: string | null;
}

/** User: apna support thread (read mark karta hai). */
export async function getMySupportChat(): Promise<{ unread: number; messages: SupportMessage[] }> {
  const { data } = await api.get("/support/messages");
  return data.data;
}

/** User: support ko reply karo. */
export async function sendSupportReply(message: string, attachment?: SupportAttachment | null): Promise<SupportMessage> {
  const { data } = await api.post("/support/messages", {
    message,
    ...(attachment
      ? { attachmentName: attachment.name, attachmentType: attachment.type, attachmentData: attachment.data }
      : {}),
  });
  return data.data;
}

/** User: apna message delete. */
export async function deleteMySupportMessage(id: number): Promise<{ deleted: boolean }> {
  const { data } = await api.delete(`/support/messages/${id}`);
  return data.data;
}

/** User: poora thread clear. */
export async function clearMySupportChat(): Promise<{ cleared: number }> {
  const { data } = await api.delete("/support/messages");
  return data.data;
}

/** User: apni chat settings (mute/pin). */
export async function getMySupportSettings(): Promise<SupportChatSetting[]> {
  const { data } = await api.get("/support/settings");
  return data.data.settings;
}

/** User: support team conversation mute/pin karo. */
export async function setMySupportSettings(input: {
  peerUserId: number;
  muted?: boolean;
  pinned?: boolean;
}): Promise<SupportChatSetting> {
  const { data } = await api.put(`/support/settings/${input.peerUserId}`, input);
  return data.data;
}

/** Support chat attachment (optional) — photo/invoice/screenshot. */
export interface SupportAttachment {
  name: string;
  type: string;
  data: string; // base64
}
