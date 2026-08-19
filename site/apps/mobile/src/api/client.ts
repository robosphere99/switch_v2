import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

// Using EXPO_PUBLIC_ variables allows you to change the IP for physical device testing.
// Defaulting to 10.0.2.2 for Android emulators if no env is set.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:4000/api';

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

export const extractApiError = (error: any) => {
    if (error.response?.data?.error) {
        return error.response.data.error;
    }
    return { message: error.message || "Unknown error occurred" };
};
