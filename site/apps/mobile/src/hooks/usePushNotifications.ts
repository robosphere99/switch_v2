import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { api } from '../api/client';

// Extremely critical for real-time foreground alerts with tone & vibration
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export function usePushNotifications() {
    const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

    useEffect(() => {
        registerForPushNotificationsAsync().then(token => {
            if (token) {
                setExpoPushToken(token);
                // Background Sync token with SwitchNest DB
                api.post('/auth/push-token', { token }).catch(err => console.log("[Push] Failed to sync token", err));
            }
        });
    }, []);

    async function registerForPushNotificationsAsync() {
        let token;

        // Custom Android Vibration & Sound Channel
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'SwitchNest Alerts',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#e11d48',
                sound: 'default' // uses system notification tone
            });
        }

        if (Device.isDevice) {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;

            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            if (finalStatus !== 'granted') {
                console.log('Failed to get permissions for push notifications!');
                return null;
            }

            try {
                token = (await Notifications.getExpoPushTokenAsync({
                    projectId: Constants.expoConfig?.extra?.eas?.projectId,
                })).data;
            } catch (e) {
                // Fallback for bare expo go workflows
                try {
                    token = (await Notifications.getExpoPushTokenAsync()).data;
                } catch (ex) {
                    console.log('Push token generation failure:', ex);
                }
            }
        } else {
            console.log('Must use physical device for Push Notifications');
        }

        return token;
    }

    return { expoPushToken };
}
