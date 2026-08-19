import { api, extractApiError } from './client';

export const login = async (credentials: { usernameEmail: string; password: string }) => {
    try {
        const res = await api.post('/auth/login', credentials);
        return res.data; // { success: true, data: { accessToken, refreshToken, user } }
    } catch (e) {
        throw extractApiError(e);
    }
};
