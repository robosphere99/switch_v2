import { useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { io, Socket } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from '../api/client';

const SOCKET_URL = API_URL.replace('/api', '');

export function useSocket(onDeviceUpdated?: (payload: any) => void) {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        let active = true;

        const initSocket = async () => {
            const token = await SecureStore.getItemAsync('accessToken');
            if (!token || !active) return;

            const socket = io(SOCKET_URL, {
                auth: { token },
                transports: ['websocket'], // Force websocket for React Native
            });

            // The backend emits 'device:updated' when any user interacts with a switch
            socket.on('device:updated', (payload) => {
                if (onDeviceUpdated) onDeviceUpdated(payload);
            });

            // Global Notification Hooks (Real-Time Universal Inbox)
            socket.on('notification:new', () => DeviceEventEmitter.emit('notification_sync'));
            socket.on('notification:deleted', () => DeviceEventEmitter.emit('notification_sync'));
            socket.on('notification:updated', () => DeviceEventEmitter.emit('notification_sync'));

            socketRef.current = socket;
        };
        initSocket();

        return () => {
            active = false;
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        };
    }, []);
}
