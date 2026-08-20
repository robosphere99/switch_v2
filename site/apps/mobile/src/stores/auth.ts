import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
    id: number;
    username: string;
    email: string;
    role?: string;
}

interface AuthState {
    user: User | null;
    accessToken: string | null;
    isLoading: boolean;
    setAuth: (user: User, token: string) => Promise<void>;
    logout: () => Promise<void>;
    loadStoredAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    accessToken: null,
    isLoading: true,

    setAuth: async (user, token) => {
        try {
            await SecureStore.setItemAsync('accessToken', token);
            await SecureStore.setItemAsync('user', JSON.stringify(user));
            set({ user, accessToken: token });
        } catch (e) {
            console.error("Failed to save auth state");
        }
    },

    logout: async () => {
        try {
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            const pushToken = await SecureStore.getItemAsync('expoPushToken');

            // Notify backend to proactively revoke the physical push notification bridge & JWT
            if (refreshToken || pushToken) {
                try {
                    const { api } = await import('../api/client');
                    await api.post('/auth/logout', { refreshToken, pushToken }).catch(() => { });
                } catch (e) {
                    console.log("[AuthStore] Logout network sync failed, preceding locally");
                }
            }

            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('refreshToken');
            await SecureStore.deleteItemAsync('user');
            set({ user: null, accessToken: null });
        } catch (e) {
            console.error("Failed to clear auth state");
        }
    },

    loadStoredAuth: async () => {
        set({ isLoading: true });
        try {
            const token = await SecureStore.getItemAsync('accessToken');
            const userStr = await SecureStore.getItemAsync('user');
            if (token && userStr) {
                set({ accessToken: token, user: JSON.parse(userStr), isLoading: false });
            } else {
                set({ isLoading: false });
            }
        } catch (e) {
            console.error("Error loading stored auth", e);
            set({ isLoading: false });
        }
    }
}));
