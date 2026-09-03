import { api } from './client';

export interface SupportTicket {
    id: number;
    subject: string;
    message: string;
    status: string;
    createdAt: string;
}

export async function getMySupportTickets(): Promise<{ success: boolean; data?: SupportTicket[]; error?: any }> {
    try {
        const { data } = await api.get('/public/support/my');
        return { success: true, data: data.data };
    } catch (error: any) {
        return { success: false, error: error.response?.data?.error || error.message };
    }
}

export async function submitSupport(payload: {
    subject: string;
    message: string;
    phone?: string;
    orderNumber?: string;
}): Promise<{ success: boolean; data?: { id: number; status: string }; error?: any }> {
    try {
        const { data } = await api.post('/public/support', payload);
        return { success: true, data: data.data };
    } catch (error: any) {
        return { success: false, error: error.response?.data?.error || error.message };
    }
}

export interface SupportMessage {
    id: number;
    userId: number;
    senderRole: "admin" | "user";
    senderName: string;
    message: string;
    attachmentName: string | null;
    attachmentType: string | null;
    attachmentPath: string | null;
    readByUser: boolean;
    readByAdmin: boolean;
    deletedAt: string | null;
    createdAt: string;
}

export async function getMySupportChat(): Promise<{ success: boolean; data?: { unread: number; messages: SupportMessage[] }; error?: any }> {
    try {
        const { data } = await api.get('/support/messages');
        return { success: true, data: data.data };
    } catch (error: any) {
        return { success: false, error: error.response?.data?.error || error.message };
    }
}

export async function sendSupportReply(message: string): Promise<{ success: boolean; data?: SupportMessage; error?: any }> {
    try {
        const { data } = await api.post('/support/messages', { message });
        return { success: true, data: data.data };
    } catch (error: any) {
        return { success: false, error: error.response?.data?.error || error.message };
    }
}

export async function deleteMySupportMessage(id: number): Promise<{ success: boolean; data?: { deleted: boolean }; error?: any }> {
    try {
        const { data } = await api.delete(`/support/messages/${id}`);
        return { success: true, data: data.data };
    } catch (error: any) {
        return { success: false, error: error.response?.data?.error || error.message };
    }
}
