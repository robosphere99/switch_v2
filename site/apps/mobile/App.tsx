import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { DashboardScreen } from './src/components/DashboardScreen';
import { AutomationsScreen } from './src/components/AutomationsScreen';
import { LoginScreen } from './src/components/LoginScreen';
import { SettingsScreen } from './src/components/SettingsScreen';
import { Clock, Home as HomeIcon, Settings, Activity } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';

function MainApp() {
  const { theme } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'HOME' | 'AUTOMATIONS' | 'SETTINGS'>('HOME');
  const [isRestoring, setIsRestoring] = useState(true);
  const [biometricFailed, setBiometricFailed] = useState(false);
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
      setIsRestoring(false);
    };
    restoreAuth();
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
          }}
        />
      );
    }
    if (activeTab === 'AUTOMATIONS') {
      return <AutomationsScreen />;
    }
    if (activeTab === 'SETTINGS') {
      return (
        <SettingsScreen
          user={user}
          onLogout={async () => {
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('user');
            setUser(null);
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
    const setNav = (tab: 'HOME' | 'AUTOMATIONS' | 'SETTINGS') => {
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

          <TouchableOpacity style={styles.navItem} onPress={() => setNav('AUTOMATIONS')}>
            <Clock color={activeTab === 'AUTOMATIONS' ? theme.primary : theme.textSecondary} size={24} />
            <Text style={[styles.navText, { color: activeTab === 'AUTOMATIONS' ? theme.primary : theme.textSecondary }]}>Routines</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setNav('SETTINGS')}>
            <Settings color={activeTab === 'SETTINGS' ? theme.primary : theme.textSecondary} size={24} />
            <Text style={[styles.navText, { color: activeTab === 'SETTINGS' ? theme.primary : theme.textSecondary }]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isRestoring) {
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
