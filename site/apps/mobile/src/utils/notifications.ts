import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
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
            console.log('Permission not granted to get push token for push notification!');
            return;
        }

        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

        try {
            // NOTE: For Expo Go testing without EAS project ID, you can sometimes omit projectId.
            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId,
            });
            token = tokenData.data;
        } catch (e: any) {
            const errStr = String(e);
            if (!errStr.includes("FirebaseApp is not initialized")) {
                console.log("Error fetching push token:", e);
            }
        }

    } else {
        console.log('Must use physical device for Push Notifications');
    }

    return token;
}
