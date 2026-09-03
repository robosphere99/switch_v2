import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';

export const LIVE_WEBSITE_URL = 'https://onlineswitch.bhartitechnical.com/api';
const SERVER_URL_KEY = 'custom_server_url';

let cachedServerUrl: string | null = null;

export async function getActiveServerUrl(): Promise<string> {
    if (cachedServerUrl) return cachedServerUrl;
    try {
        const stored = await SecureStore.getItemAsync(SERVER_URL_KEY);
        if (stored && stored.trim()) {
            cachedServerUrl = stored.trim();
            return cachedServerUrl;
        }
    } catch (e) {
        console.warn('[client] Failed reading stored server URL:', e);
    }
    cachedServerUrl = process.env.EXPO_PUBLIC_API_URL || LIVE_WEBSITE_URL;
    return cachedServerUrl;
}

export async function setCustomServerUrl(url: string | null): Promise<string> {
    try {
        if (url && url.trim()) {
            let cleanUrl = url.trim().replace(/\/+$/, '');
            if (!cleanUrl.endsWith('/api') && !cleanUrl.includes('/api/')) {
                cleanUrl = `${cleanUrl}/api`;
            }
            await SecureStore.setItemAsync(SERVER_URL_KEY, cleanUrl);
            cachedServerUrl = cleanUrl;
        } else {
            await SecureStore.deleteItemAsync(SERVER_URL_KEY);
            cachedServerUrl = process.env.EXPO_PUBLIC_API_URL || LIVE_WEBSITE_URL;
        }
        api.defaults.baseURL = cachedServerUrl;
        DeviceEventEmitter.emit('server_url_changed', cachedServerUrl);
        return cachedServerUrl;
    } catch (e) {
        console.error('[client] Error saving custom server URL:', e);
        return cachedServerUrl || LIVE_WEBSITE_URL;
    }
}

export const API_URL = process.env.EXPO_PUBLIC_API_URL || LIVE_WEBSITE_URL;
console.log('[DEBUG] API_URL Default Initialized as:', API_URL);

export const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

api.interceptors.request.use(async (config) => {
    try {
        const activeUrl = await getActiveServerUrl();
        config.baseURL = activeUrl;
        
        const token = await SecureStore.getItemAsync('accessToken');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error("Error preparing request:", error);
    }
    return config;
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) prom.reject(error);
        else prom.resolve(token as string);
    });
    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    originalRequest.headers.Authorization = 'Bearer ' + token;
                    return api(originalRequest);
                }).catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                const refreshToken = await SecureStore.getItemAsync('refreshToken');
                if (!refreshToken) throw new Error("No refresh token cached");

                const activeUrl = await getActiveServerUrl();
                const { data } = await axios.post(`${activeUrl}/auth/refresh`, { refreshToken });

                if (data.success && data.data?.accessToken) {
                    await SecureStore.setItemAsync('accessToken', data.data.accessToken);
                    if (data.data.refreshToken) {
                        await SecureStore.setItemAsync('refreshToken', data.data.refreshToken);
                    }
                    if (data.data.sessionId) {
                        await SecureStore.setItemAsync('sessionId', String(data.data.sessionId));
                    }

                    api.defaults.headers.common['Authorization'] = 'Bearer ' + data.data.accessToken;
                    originalRequest.headers.Authorization = 'Bearer ' + data.data.accessToken;

                    processQueue(null, data.data.accessToken);
                    return api(originalRequest);
                }
            } catch (refreshError) {
                processQueue(refreshError, null);
                DeviceEventEmitter.emit('auth_unauthorized');
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        return Promise.reject(error);
    }
);

export const extractApiError = (error: any) => {
    if (error.response?.data?.error) {
        return error.response.data.error;
    }
    return { message: error.message || "Unknown error occurred" };
};

