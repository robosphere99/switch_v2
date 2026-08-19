import { api } from './client';

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

export const createChat = async (homeId: number, title?: string) => {
    const { data } = await api.post('/assistant/chats', { homeId, title });
    return data;
};

export const sendMessage = async (chatId: number, content: string) => {
    const { data } = await api.post(`/assistant/chats/${chatId}/messages`, { content });
    return data;
};

export const confirmProposal = async (chatId: number, messageId: number) => {
    const { data } = await api.post(`/assistant/chats/${chatId}/confirm`, { messageId });
    return data;
};

export const listChats = async () => {
    const { data } = await api.get('/assistant/chats');
    return data;
};

export const listMessages = async (chatId: number) => {
    const { data } = await api.get(`/assistant/chats/${chatId}/messages`);
    return data;
};
