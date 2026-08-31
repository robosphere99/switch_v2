const fs = require('fs');
const path = require('path');
const os = require('os');

// Dynamic IP detection
function updateLocalIp() {
    let localIp = '127.0.0.1';
    const interfaces = os.networkInterfaces();
    const sortedNames = Object.keys(interfaces).sort((a, b) => {
        const isAWiFi = a.toLowerCase().includes('wi-fi') || a.toLowerCase().includes('wireless');
        const isBWiFi = b.toLowerCase().includes('wi-fi') || b.toLowerCase().includes('wireless');
        return isAWiFi === isBWiFi ? 0 : isAWiFi ? -1 : 1;
    });

    for (const name of sortedNames) {
        if (name.toLowerCase().includes('vbox') || name.toLowerCase().includes('vmware') || name.toLowerCase().includes('wsl') || name.toLowerCase().includes('virtual')) continue;
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
        if (localIp !== '127.0.0.1') break;
    }

    const envPath = path.join(__dirname, '.env');
    if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        const regex = /(EXPO_PUBLIC_API_URL=http:\/\/)[^:]+(:\d+\/api)/g;
        if (regex.test(content)) {
            content = content.replace(regex, `$1${localIp}$2`);
            fs.writeFileSync(envPath, content, 'utf8');
            console.log(`[SwitchNest IP Auto-Updater] Updated EXPO_PUBLIC_API_URL to http://${localIp}:4000/api`);
        } else {
            const lines = content.split('\n');
            let found = false;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].startsWith('EXPO_PUBLIC_API_URL=')) {
                    lines[i] = `EXPO_PUBLIC_API_URL=http://${localIp}:4000/api`;
                    found = true;
                    break;
                }
            }
            if (!found) {
                lines.push(`EXPO_PUBLIC_API_URL=http://${localIp}:4000/api`);
            }
            fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
            console.log(`[SwitchNest IP Auto-Updater] Written EXPO_PUBLIC_API_URL to http://${localIp}:4000/api`);
        }
    } else {
        const content = `EXPO_PUBLIC_API_URL=http://${localIp}:4000/api\nEXPO_PUBLIC_RAZORPAY_KEY_ID="rzp_test_TSVHF7cuVgmwiF"\n`;
        fs.writeFileSync(envPath, content, 'utf8');
        console.log(`[SwitchNest IP Auto-Updater] Created .env file and set EXPO_PUBLIC_API_URL to http://${localIp}:4000/api`);
    }
}

// Execute IP detection
try {
    updateLocalIp();
} catch (e) {
    console.warn('[SwitchNest IP Auto-Updater] Failed to auto-update local IP:', e.message);
}

module.exports = {
    expo: {
        name: "mobile",
        slug: "mobile",
        version: "1.0.1",
        runtimeVersion: {
            policy: "appVersion"
        },
        orientation: "default",
        icon: "./assets/icon.png",
        userInterfaceStyle: "automatic",
        ios: {
            supportsTablet: true,
            infoPlist: {
                NSFaceIDUsageDescription: "SwitchNest uses Face ID to securely authenticate you into your smart home command center."
            }
        },
        android: {
            adaptiveIcon: {
                backgroundColor: "#E6F4FE",
                foregroundImage: "./assets/android-icon-foreground.png",
                backgroundImage: "./assets/android-icon-background.png",
                monochromeImage: "./assets/android-icon-monochrome.png"
            },
            predictiveBackGestureEnabled: false,
            package: "com.robosphere.mobile",
            permissions: [
                "android.permission.FOREGROUND_SERVICE",
                "android.permission.FOREGROUND_SERVICE_MEDIA_PROJECTION"
            ]
        },
        web: {
            favicon: "./assets/favicon.png"
        },
        extra: {
            eas: {
                projectId: "538b7c36-6d64-4158-a985-a01d5880736d"
            }
        },
        updates: {
            url: "https://u.expo.dev/538b7c36-6d64-4158-a985-a01d5880736d"
        },
        plugins: [
            "@react-native-community/datetimepicker",
            [
                "expo-build-properties",
                {
                    "android": {
                        "usesCleartextTraffic": true
                    }
                }
            ],
            "expo-updates",
            "expo-asset",
            "@novartc/expo-config-plugin-incall-manager",
            "./plugins/withApkCopier.js"
        ]
    }
};
