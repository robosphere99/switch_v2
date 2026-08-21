import { useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../api/client';

const SOCKET_URL = API_URL.replace('/api', '');

export function useSocket(userId: number | null) {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        let active = true;

        const initSocket = async () => {
            if (!userId) return; // Wait for active user Session
            const token = await SecureStore.getItemAsync('accessToken');
            if (!token || !active) return;

            const socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket'], // Force websocket for React Native
            });

            // The backend emits 'device:updated' when any user interacts with a switch
            socket.on('device:updated', (payload) => {
                DeviceEventEmitter.emit('device_sync', payload);
            });

            // The backend emits 'esp:updated' when the physical ESP LED is toggled from Web/Mobile
            socket.on('esp:updated', (payload) => {
                DeviceEventEmitter.emit('device_sync', payload);
            });

            // Global Notification Hooks (Real-Time Universal Inbox)
            socket.on('notification:new', () => DeviceEventEmitter.emit('notification_sync'));
            socket.on('notification:deleted', () => DeviceEventEmitter.emit('notification_sync'));
            socket.on('notification:updated', () => DeviceEventEmitter.emit('notification_sync'));

            socket.on('schedule:sync', () => DeviceEventEmitter.emit('schedule_sync'));

            // Home Member Hooks
            socket.on('home-updated', (data) => DeviceEventEmitter.emit('home_updated', data));
            socket.on('home:access-revoked', (data) => DeviceEventEmitter.emit('access_revoked', data));

            // Support Hooks
            socket.on('support:new', () => DeviceEventEmitter.emit('support_sync'));

            socketRef.current = socket;
        };
        initSocket();

        return () => {
            active = false;
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, [userId]);
}
