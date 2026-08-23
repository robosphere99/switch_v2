import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { DeviceEventEmitter } from 'react-native';

// Using EXPO_PUBLIC_ variables allows you to change the IP for physical device testing.
// Defaulting to 10.0.2.2 for Android emulators if no env is set.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api';
console.log('[DEBUG] API_URL Initialized as:', API_URL);

export const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
});

api.interceptors.request.use(async (config) => {
    try {
        const token = await SecureStore.getItemAsync('accessToken');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
    } catch (error) {
        console.error("Error retrieving token:", error);
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

                const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

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
