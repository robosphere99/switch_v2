import * as ExpoHaptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

let hapticsEnabled = true;

// Initialize from secure store
SecureStore.getItemAsync('pref_haptics').then(val => {
    if (val === 'false') {
        hapticsEnabled = false;
    }
}).catch(() => {});

export const setHapticsEnabled = async (enabled: boolean) => {
    hapticsEnabled = enabled;
    await SecureStore.setItemAsync('pref_haptics', enabled ? 'true' : 'false');
};

export const getHapticsEnabled = () => hapticsEnabled;

export const impactAsync = async (style?: ExpoHaptics.ImpactFeedbackStyle) => {
    if (hapticsEnabled) {
        return ExpoHaptics.impactAsync(style);
    }
};

export const notificationAsync = async (type?: ExpoHaptics.NotificationFeedbackType) => {
    if (hapticsEnabled) {
        return ExpoHaptics.notificationAsync(type);
    }
};

export const selectionAsync = async () => {
    if (hapticsEnabled) {
        return ExpoHaptics.selectionAsync();
    }
};

export const ImpactFeedbackStyle = ExpoHaptics.ImpactFeedbackStyle;
export const NotificationFeedbackType = ExpoHaptics.NotificationFeedbackType;
