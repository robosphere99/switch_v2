import { api, extractApiError } from './client';

export const login = async (credentials: { usernameEmail: string; password: string; revokeOtherSessions?: boolean }) => {
    try {
        const res = await api.post('/auth/login', credentials);
        return res.data; // { success: true, data: { accessToken, refreshToken, user } }
    } catch (e) {
        throw extractApiError(e);
    }
};

export const revokeUnauth = async (credentials: { usernameEmail: string; password: string; sessionId: number }) => {
    try {
        const res = await api.post('/auth/revoke-unauth', credentials);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const signup = async (userData: { username: string; email: string; password: string; homeName?: string }) => {
    try {
        const res = await api.post('/auth/signup', userData);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};

export const checkAvailability = async (query: { username?: string, email?: string }) => {
    try {
        const params = new URLSearchParams();
        if (query.username) params.append('username', query.username);
        if (query.email) params.append('email', query.email);
        const res = await api.get(`/auth/check?${params.toString()}`);
        return res.data;
    } catch (e) {
        throw extractApiError(e);
    }
};
