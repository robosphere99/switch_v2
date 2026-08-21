import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Animated, DeviceEventEmitter } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { DashboardScreen } from './src/components/DashboardScreen';
import { AutomationsScreen } from './src/components/AutomationsScreen';
import { LoginScreen } from './src/components/LoginScreen';
import { SettingsScreen } from './src/components/SettingsScreen';
import { HardwareScreen } from './src/components/HardwareScreen';
import { ShopScreen } from './src/components/ShopScreen';
import { Server, LogOut, Home as HomeIcon, Zap, Shield, Wifi, User, Activity, Bot, ShoppingCart } from 'lucide-react-native';
import { Clock, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { getSystemVersion } from './src/api/hardware';
import { useSocket } from './src/hooks/useSocket';
import { Linking, LogBox } from 'react-native';

// Suppress known development warnings that pollute the Expo Go screen
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported',
  'Require cycle:',
]);

// Physical App Hardcoded Manifest Version (Increment this for new APK generation!)
export const APP_VERSION = '1.0.0';

const compareSemver = (v1: string, v2: string) => {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((p1[i] || 0) < (p2[i] || 0)) return -1;
    if ((p1[i] || 0) > (p2[i] || 0)) return 1;
  }
  return 0;
};

function MainApp() {
  const { theme, bindUser } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'HOME' | 'HARDWARE' | 'AUTOMATIONS' | 'SETTINGS' | 'SHOP'>('HOME');
  const [isRestoring, setIsRestoring] = useState(true);
  const [biometricFailed, setBiometricFailed] = useState(false);

  // Initialize Global Socket Engine
  // Engine spins up securely only when the active `user` context exists (and restarts cleanly on logout).
  useSocket(user?.id ?? null);

  React.useEffect(() => {
    if (user && user.id) {
      bindUser(String(user.id));
    } else {
      setActiveTab('HOME');
    }
  }, [user]);

  // Update Guard States
  const [updateRequired, setUpdateRequired] = useState(false);
  const [updateOptions, setUpdateOptions] = useState<any>(null);

  const fadeAnim = useRef(new Animated.Value(1)).current;

  const triggerBiometrics = async (storedUser: any) => {
    const authRes = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock SwitchNest Security',
      fallbackLabel: 'Use Device PIN',
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
    });

    if (authRes.success) {
      setUser(JSON.parse(storedUser));
      setBiometricFailed(false);
    } else {
      setBiometricFailed(true);
    }
  };

  React.useEffect(() => {
    const restoreAuth = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync('user');
        const loginTimestamp = await SecureStore.getItemAsync('loginTimestamp') || String(Date.now());
        const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

        if (storedUser) {
          if (Date.now() - parseInt(loginTimestamp) > SEVEN_DAYS_MS) {
            // Expired Session - Force Relogin
            await SecureStore.deleteItemAsync('user');
            await SecureStore.deleteItemAsync('loginTimestamp');
            setUser(null);
          } else {
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const isEnrolled = await LocalAuthentication.isEnrolledAsync();

            if (hasHardware && isEnrolled) {
              await triggerBiometrics(storedUser);
            } else {
              // Hardware missing/not-enrolled, let them in without friction
              setUser(JSON.parse(storedUser));
            }
          }
        }
      } catch (e) { }

      // Parallel Version Verification
      try {
        const sysVersion = await getSystemVersion();
        if (sysVersion?.data?.mobileAppOptions) {
          const opts = sysVersion.data.mobileAppOptions;
          if (opts.minRequiredVersion && compareSemver(APP_VERSION, opts.minRequiredVersion) < 0) {
            setUpdateOptions(opts);
            setUpdateRequired(true);
          }
        }
      } catch (err) {
        console.log('Update check failed (safe bypass):', err);
      }

      setIsRestoring(false);
    };

    const handleUnauthorized = async () => {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('user');
      setUser(null);
    };
    const authSub = DeviceEventEmitter.addListener('auth_unauthorized', handleUnauthorized);

    restoreAuth();

    return () => {
      authSub.remove();
    };
  }, []);

  // Custom Micro-Router Fallback
  const renderTab = () => {
    if (activeTab === 'HOME') {
      return (
        <DashboardScreen
          user={user}
          onLogout={async () => {
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('user');
            setUser(null);
            setActiveTab('HOME');
          }}
        />
      );
    }
    if (activeTab === 'HARDWARE') {
      return <HardwareScreen />;
    }
    if (activeTab === 'AUTOMATIONS') {
      return <AutomationsScreen />;
    }
    if (activeTab === 'SHOP') {
      return <ShopScreen />;
    }
    if (activeTab === 'SETTINGS') {
      return (
        <SettingsScreen
          user={user}
          onLogout={async () => {
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('user');
            setUser(null);
            setActiveTab('HOME');
          }}
        />
      );
    }
    return (
      <View style={styles.comingSoon}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Feature unlocks in Phase 11.</Text>
      </View>
    );
  };

  if (user) {
    const setNav = (tab: 'HOME' | 'HARDWARE' | 'AUTOMATIONS' | 'SETTINGS' | 'SHOP') => {
      if (activeTab === tab) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

      fadeAnim.setValue(0.1); // Drop opacity
      setActiveTab(tab);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }).start();
    };

    return (
      <View style={{ flex: 1, backgroundColor: theme.background }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>{renderTab()}</Animated.View>

        {/* Premium Bottom Navbar */}
        <View style={[styles.bottomNav, { backgroundColor: theme.tabBar, borderColor: theme.border }]}>
          <TouchableOpacity style={styles.navItem} onPress={() => setNav('HOME')}>
            <HomeIcon color={activeTab === 'HOME' ? theme.primary : theme.textSecondary} size={24} />
            <Text style={[styles.navText, { color: activeTab === 'HOME' ? theme.primary : theme.textSecondary }]}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setNav('HARDWARE')}>
            <Server color={activeTab === 'HARDWARE' ? theme.primary : theme.textSecondary} size={24} />
            <Text style={[styles.navText, { color: activeTab === 'HARDWARE' ? theme.primary : theme.textSecondary }]}>Boards</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setNav('AUTOMATIONS')}>
            <Clock color={activeTab === 'AUTOMATIONS' ? theme.primary : theme.textSecondary} size={24} />
            <Text style={[styles.navText, { color: activeTab === 'AUTOMATIONS' ? theme.primary : theme.textSecondary }]}>Routines</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setNav('SHOP')}>
            <ShoppingCart color={activeTab === 'SHOP' ? theme.primary : theme.textSecondary} size={24} />
            <Text style={[styles.navText, { color: activeTab === 'SHOP' ? theme.primary : theme.textSecondary }]}>Store</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setNav('SETTINGS')}>
            <Settings color={activeTab === 'SETTINGS' ? theme.primary : theme.textSecondary} size={24} />
            <Text style={[styles.navText, { color: activeTab === 'SETTINGS' ? theme.primary : theme.textSecondary }]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (updateRequired && updateOptions) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Activity color={theme.accent || theme.primary} size={64} style={{ marginBottom: 20 }} />
        <Text style={[styles.title, { color: theme.text, textAlign: 'center' }]}>Update {"\n"}Required</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary, textAlign: 'center', marginTop: 10 }]}>
          {updateOptions.updateMessage || 'A mandatory update is required to continue using this application.'}
        </Text>
        <Text style={{ color: theme.textSecondary, marginBottom: 40 }}>
          Installed: v{APP_VERSION}  •  Required: v{updateOptions.minRequiredVersion}
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.accent || theme.primary }]}
          onPress={() => Linking.openURL(updateOptions.downloadUrl)}
        >
          <Text style={styles.buttonText}>Download Latest Version</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isRestoring || updateRequired) {
    return (
      <View style={[styles.container, { flex: 1, backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // Pure Opening Screen (If biometric failed, allow retry)
  return <LoginScreen
    onLoginSuccess={setUser}
    onBiometricRetry={biometricFailed ? async () => {
      const storedUser = await SecureStore.getItemAsync('user');
      if (storedUser) triggerBiometrics(storedUser);
    } : undefined}
  />;
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 36,
  },
  card: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#f87171',
    marginBottom: 16,
    textAlign: 'center',
  },
  comingSoon: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 32, // SafeArea padding for bottom
    paddingTop: 16,
    borderTopWidth: 1,
  },
  navItem: { alignItems: 'center', flex: 1 },
  navText: { fontSize: 13, marginTop: 6, fontWeight: '700' },
});
