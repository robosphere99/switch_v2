import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator, Animated, DeviceEventEmitter, Modal, Dimensions, BackHandler, ToastAndroid } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { AutomationsScreen } from './src/screens/AutomationsScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { HardwareScreen } from './src/screens/HardwareScreen';
import { ShopScreen } from './src/screens/ShopScreen';
const ActiveCallScreen = React.lazy(() => import('./src/screens/ActiveCallScreen'));
import { Server, LogOut, Home as HomeIcon, Zap, Shield, Wifi, User, Activity, Bot, ShoppingCart, Download, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react-native';
import { Clock, Settings } from 'lucide-react-native';
import * as Haptics from './src/utils/haptics';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { useSocket } from './src/hooks/useSocket';
import { Linking, LogBox } from 'react-native';
import { OrdersScreen } from './src/screens/OrdersScreen';
import { NetworkMonitor } from './src/components/NetworkMonitor';
import { useAutoUpdate } from './src/hooks/useAutoUpdate';

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('support-calls', {
    name: 'Support Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 500, 500, 500, 500, 500],
    lightColor: '#00e5ff',
  }).catch((err) => console.warn('Failed to set notification channel:', err));
}

// Suppress known development warnings that pollute the Expo Go screen
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  '`expo-notifications` functionality is not fully supported',
  'Require cycle:',
]);

import * as Application from 'expo-application';

// Dynamic App Version - Fetched directly from native AndroidManifest so we never hardcode it again!
export const APP_VERSION = Application.nativeApplicationVersion || '1.0.11';
const { width: SCREEN_WIDTH } = Dimensions.get('window');

class WebRTCErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("WebRTC Error Boundary caught an error (likely missing native modules):", error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

function MainApp() {
  const { theme, bindUser } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'HOME' | 'HARDWARE' | 'AUTOMATIONS' | 'SETTINGS' | 'SHOP'>('HOME');
  const [settingsInitialView, setSettingsInitialView] = useState<'MAIN' | 'TIMELINE' | 'APPEARANCE' | 'PROFILE' | 'NOTIFICATIONS' | 'SUPPORT'>('MAIN');
  const [supportDraft, setSupportDraft] = useState('');

  // Auto-Update Engine (JS OTA + Native APK)
  const [updateState, updateActions] = useAutoUpdate();
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

  // Legacy update guard states removed — handled by useAutoUpdate hook

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

      // Version check now handled by useAutoUpdate hook

      setIsRestoring(false);
    };

    const handleUnauthorized = async () => {
      await SecureStore.deleteItemAsync('accessToken');
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('refreshToken');
      await SecureStore.deleteItemAsync('sessionId');
      setUser(null);
    };
    const authSub = DeviceEventEmitter.addListener('auth_unauthorized', handleUnauthorized);
    const forceLogoutSub = DeviceEventEmitter.addListener('auth:force_logout', handleUnauthorized);
    const profileSub = DeviceEventEmitter.addListener('profile_sync', (updatedUser: any) => {
      setUser(updatedUser);
    });
    const navSupportSub = DeviceEventEmitter.addListener('navigate_support', (data) => {
      setSettingsInitialView('SUPPORT');
      if (data?.draft) setSupportDraft(data.draft);
      setActiveTab('SETTINGS');
    });

    restoreAuth();

    return () => {
      authSub.remove();
      forceLogoutSub.remove();
      profileSub.remove();
      navSupportSub.remove();
    };
  }, []);
  React.useEffect(() => {
    let currentCount = 0;
    const backAction = () => {
      // If logged in and not on HOME tab, just navigate to HOME
      if (user && activeTab !== 'HOME') {
        setActiveTab('HOME');
        return true;
      }
      
      // If on HOME tab or not logged in, require double back to exit
      if (currentCount === 1) {
        BackHandler.exitApp();
        return true;
      }
      currentCount += 1;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      setTimeout(() => {
        currentCount = 0;
      }, 2000);
      return true;
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
    return () => backHandler.remove();
  }, [activeTab, user]);

  // Custom Micro-Router Fallback
  const renderTab = () => {
    if (activeTab === 'HOME') {
      return (
        <DashboardScreen
          user={user}
          onLogout={async () => {
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('user');
            await SecureStore.deleteItemAsync('refreshToken');
            await SecureStore.deleteItemAsync('sessionId');
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
          initialView={settingsInitialView}
          initialSupportDraft={supportDraft}
          updateState={updateState}
          updateActions={updateActions}
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
      if (activeTab === tab) {
        if (tab === 'SETTINGS') {
          DeviceEventEmitter.emit('reset_settings_view');
        }
        return;
      }
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

        {/* ── JS OTA Update Banner (subtle bottom toast) ── */}
        {updateState.jsUpdateReady && (
          <TouchableOpacity
            onPress={updateActions.reloadWithJsUpdate}
            activeOpacity={0.85}
            style={[styles.otaBanner, { backgroundColor: theme.primary }]}
          >
            <CheckCircle color="#000" size={18} style={{ marginRight: 8 }} />
            <Text style={styles.otaBannerText}>Update ready — tap to restart</Text>
          </TouchableOpacity>
        )}

        {/* ── Native APK Update Modal ── */}
        <Modal
          visible={!!updateState.nativeUpdate}
          transparent={true}
          animationType="fade"
          onRequestClose={() => updateActions.dismissNativeUpdate()}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.updateModal, { backgroundColor: theme.background, borderColor: theme.border }]}>
              {/* Header */}
              <View style={{ alignItems: 'center', marginBottom: 20 }}>
                <View style={[styles.updateIconWrap, { backgroundColor: theme.primary + '20' }]}>
                  {updateState.nativeError ? (
                    <AlertTriangle color="#ef4444" size={32} />
                  ) : updateState.nativeDownloading ? (
                    <Download color={theme.primary} size={32} />
                  ) : (
                    <Zap color={theme.primary} size={32} />
                  )}
                </View>
                <Text style={[styles.updateTitle, { color: theme.text }]}>
                  {updateState.nativeError ? 'Update Failed' : updateState.nativeDownloading ? 'Downloading...' : `Update Available`}
                </Text>
                {updateState.nativeUpdate && !updateState.nativeError && !updateState.nativeDownloading && (
                  <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4 }}>
                    v{APP_VERSION}  →  v{updateState.nativeUpdate.latestVersion}
                  </Text>
                )}
              </View>

              {/* Release Notes */}
              {updateState.nativeUpdate?.releaseNotes && !updateState.nativeError && !updateState.nativeDownloading && (
                <View style={[styles.releaseNotesBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 6 }}>WHAT'S NEW</Text>
                  <Text style={{ color: theme.text, fontSize: 13, lineHeight: 20 }}>{updateState.nativeUpdate.releaseNotes}</Text>
                </View>
              )}

              {/* Error message */}
              {updateState.nativeError && (
                <View style={[styles.releaseNotesBox, { backgroundColor: '#ef444415', borderColor: '#ef444440' }]}>
                  <Text style={{ color: '#ef4444', fontSize: 13, lineHeight: 20 }}>{updateState.nativeError}</Text>
                </View>
              )}

              {/* Download Progress */}
              {updateState.nativeDownloading && (
                <View style={{ marginBottom: 20 }}>
                  <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                    <View style={[styles.progressBar, { width: `${updateState.nativeProgress * 100}%`, backgroundColor: theme.primary }]} />
                  </View>
                  <Text style={{ color: theme.textSecondary, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
                    {Math.round(updateState.nativeProgress * 100)}% downloaded
                  </Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={{ width: '100%' }}>
                {updateState.nativeError ? (
                  /* Error state: Retry + Dismiss */
                  <>
                    <TouchableOpacity
                      onPress={updateActions.retryNativeDownload}
                      style={[styles.updateBtn, { backgroundColor: theme.primary }]}
                    >
                      <RefreshCw color="#000" size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.updateBtnText}>Retry Download</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={updateActions.dismissNativeUpdate}
                      style={[styles.updateBtnSecondary, { borderColor: theme.border }]}
                    >
                      <Text style={[styles.updateBtnSecondaryText, { color: theme.text }]}>Dismiss</Text>
                    </TouchableOpacity>
                  </>
                ) : updateState.nativeDownloading ? (
                  /* Downloading state: just show spinner */
                  <ActivityIndicator color={theme.primary} style={{ marginVertical: 8 }} />
                ) : (
                  /* Ready state: Update Now + Later */
                  <>
                    <TouchableOpacity
                      onPress={updateActions.downloadAndInstallNative}
                      style={[styles.updateBtn, { backgroundColor: theme.primary }]}
                    >
                      <Download color="#000" size={18} style={{ marginRight: 8 }} />
                      <Text style={styles.updateBtnText}>Update Now</Text>
                    </TouchableOpacity>
                    {!updateState.nativeUpdate?.isMandatory && (
                      <TouchableOpacity
                        onPress={updateActions.dismissNativeUpdate}
                        style={[styles.updateBtnSecondary, { borderColor: theme.border }]}
                      >
                        <Text style={[styles.updateBtnSecondaryText, { color: theme.text }]}>Later</Text>
                      </TouchableOpacity>
                    )}
                    {updateState.nativeUpdate?.isMandatory && (
                      <Text style={{ color: theme.textSecondary, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
                        This update is mandatory to continue using the app.
                      </Text>
                    )}
                  </>
                )}
              </View>
            </View>
          </View>
        </Modal>

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

          <TouchableOpacity style={styles.navItem} onPress={() => {
            setSettingsInitialView('MAIN');
            setNav('SETTINGS');
          }}>
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
        <React.Suspense fallback={null}>
          <WebRTCErrorBoundary>
            <ActiveCallScreen />
          </WebRTCErrorBoundary>
        </React.Suspense>
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

  /* ── OTA Banner ── */
  otaBanner: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  otaBannerText: {
    color: '#000',
    fontWeight: '700',
    fontSize: 14,
  },

  /* ── Native Update Modal ── */
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000cc',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  updateModal: {
    width: SCREEN_WIDTH - 48,
    maxWidth: 380,
    borderRadius: 24,
    padding: 28,
    borderWidth: 1,
    alignItems: 'center',
  },
  updateIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  updateTitle: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  releaseNotesBox: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  updateBtnText: {
    color: '#000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  updateBtnSecondary: {
    paddingVertical: 12,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    marginTop: 10,
  },
  updateBtnSecondaryText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
