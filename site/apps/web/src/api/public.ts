import { api } from "./client";

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
