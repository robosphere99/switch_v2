import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Image, DeviceEventEmitter, Share as RNShare, NativeModules, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import type { AutoUpdateState, AutoUpdateActions } from '../hooks/useAutoUpdate';
import { useTheme } from '../theme/ThemeContext';
import { ActivityScreen } from './ActivityScreen';
import { SupportScreen } from './SupportScreen';
import { Activity, User, Monitor, Sun, Moon, Bot, Shield, Bell, Zap, Headset, X, Share as ShareIcon, RefreshCw, CheckCircle, Cpu, Globe, Wifi, Camera } from 'lucide-react-native';
import * as Haptics from '../utils/haptics';
import * as SecureStore from 'expo-secure-store';
import * as ImagePicker from 'expo-image-picker';
import { useThemedAlert } from '../components/ThemedAlert';
import DateTimePicker from '@react-native-community/datetimepicker';
import QRCode from 'react-native-qrcode-svg';
import { APP_VERSION } from '../../App';
import { API_URL } from '../api/client';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getApkPath } from '../../modules/apk-extractor/src';
import * as Application from 'expo-application';

const API_BASE = API_URL.replace(/\/api$/, '');

export function SettingsScreen({ user, onLogout, initialView = 'MAIN', initialSupportDraft = '', updateState, updateActions }: { user?: any, onLogout: () => void, initialView?: 'MAIN' | 'TIMELINE' | 'APPEARANCE' | 'PROFILE' | 'NOTIFICATIONS' | 'SUPPORT', initialSupportDraft?: string, updateState?: AutoUpdateState, updateActions?: AutoUpdateActions }) {
    const { theme, mode, setMode, themeId, setThemeId, availableThemes } = useTheme();
    const [localUser, setLocalUser] = useState(user);
    const [aiSuggestions, setAiSuggestions] = useState(true);
    const [hapticsOn, setHapticsOn] = useState(Haptics.getHapticsEnabled());
    const [supportDraft, setSupportDraft] = useState(initialSupportDraft);

    useEffect(() => {
        setLocalUser(user);
    }, [user]);
    const [view, setView] = useState<'MAIN' | 'TIMELINE' | 'APPEARANCE' | 'PROFILE' | 'NOTIFICATIONS' | 'SUPPORT'>(initialView);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('navigate_support', (data) => {
            if (data?.draft) {
                setSupportDraft(data.draft);
            }
            setView('SUPPORT');
        });
        const subReset = DeviceEventEmitter.addListener('reset_settings_view', () => {
            setView('MAIN');
        });
        return () => {
            sub.remove();
            subReset.remove();
        };
    }, []);

    // Password Update States
    const [pwModalVisible, setPwModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    // Sessions States
    const [sessions, setSessions] = useState<any[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);

    // Edit Profile States
    const [editProfileVisible, setEditProfileVisible] = useState(false);
    const [editAvatarUrl, setEditAvatarUrl] = useState('');
    const [editDob, setEditDob] = useState('');
    const [editGender, setEditGender] = useState('');
    const [editPhone, setEditPhone] = useState('');
    const [editAddrState, setEditAddrState] = useState('');
    const [editAddrDistrict, setEditAddrDistrict] = useState('');
    const [editAddrPin, setEditAddrPin] = useState('');
    const [editAddrLandmark, setEditAddrLandmark] = useState('');
    const [editAddrStreet, setEditAddrStreet] = useState('');
    const [editingProfile, setEditingProfile] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [fullscreenAvatarVisible, setFullscreenAvatarVisible] = useState(false);
    const [shareModalVisible, setShareModalVisible] = useState(false);
    const [espModalVisible, setEspModalVisible] = useState(false);
    const [espIp, setEspIp] = useState('192.168.4.1');
    const [userBoards, setUserBoards] = useState<any[]>([]);
    const [loadingBoards, setLoadingBoards] = useState(false);
    const [selectedBoard, setSelectedBoard] = useState<any>(null);
    const [downloadingApk, setDownloadingApk] = useState(false);
    const [installDate, setInstallDate] = useState<string>('Loading...');
    const [isHomeAdmin, setIsHomeAdmin] = useState(false);
    const [webViewUrl, setWebViewUrl] = useState<string | null>(null);

    // Check if user is admin/owner of at least one home on mount
    useEffect(() => {
        (async () => {
            try {
                const { getHomes } = await import('../api/hardware');
                const homesData = await getHomes();
                const homes = homesData?.data || homesData || [];
                const hasAdminHome = Array.isArray(homes) && homes.some((h: any) => {
                    const role = h.role || h.members?.[0]?.role;
                    return role === 'admin' || role === 'owner';
                });
                setIsHomeAdmin(hasAdminHome || localUser?.role === 'admin' || localUser?.role === 'owner');
            } catch {
                // Fallback to global role
                setIsHomeAdmin(localUser?.role === 'admin' || localUser?.role === 'owner');
            }
        })();
    }, [localUser]);

    useEffect(() => {
        if (espModalVisible) {
            fetchUserBoards();
        }
    }, [espModalVisible]);

    const fetchUserBoards = async () => {
        setLoadingBoards(true);
        try {
            const { getHomes, getHardwareHomes } = await import('../api/hardware');
            const [homesRes, boardsRes] = await Promise.allSettled([
                getHomes(),
                getHardwareHomes()
            ]);

            const homesList = homesRes.status === 'fulfilled' ? (homesRes.value?.data || homesRes.value || []) : [];
            const boardsList = boardsRes.status === 'fulfilled' ? (boardsRes.value?.data || boardsRes.value || []) : [];

            // Map homeId to home object
            const homeMap = new Map<number, any>();
            homesList.forEach((h: any) => {
                const id = h.id || h.homeId;
                if (id) homeMap.set(id, h);
            });

            // Filter boards belonging to homes where the user is an Admin or Owner of that home
            const eligibleBoards = (Array.isArray(boardsList) ? boardsList : []).filter((b: any) => {
                const home = b.homeId ? homeMap.get(b.homeId) : null;
                const homeRole = home?.role || b.role;
                // Allow access if user is Admin/Owner of the Home OR global system admin
                return homeRole === 'admin' || homeRole === 'owner' || localUser?.role === 'admin' || localUser?.role === 'owner';
            }).map((b: any) => {
                const home = b.homeId ? homeMap.get(b.homeId) : null;
                return {
                    ...b,
                    homeName: home?.name || b.homeName || 'Home'
                };
            });

            setUserBoards(eligibleBoards);
            if (eligibleBoards.length > 0) {
                const first = eligibleBoards[0];
                setSelectedBoard(first);
                setEspIp(first.ipAddress || first.localIp || '192.168.4.1');
            } else {
                setSelectedBoard(null);
            }
        } catch (e) {
            console.warn("Could not fetch user boards for ESP WebServer", e);
        } finally {
            setLoadingBoards(false);
        }
    };

    useEffect(() => {
        const fetchInstallDate = async () => {
            try {
                const date = await Application.getLastUpdateTimeAsync();
                if (date) {
                    setInstallDate(date.toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                    }));
                } else {
                    const instDate = await Application.getInstallationTimeAsync();
                    if (instDate) {
                        setInstallDate(instDate.toLocaleString('en-IN', {
                            day: '2-digit', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', hour12: true
                        }));
                    } else {
                        setInstallDate('Unknown');
                    }
                }
            } catch (e) {
                setInstallDate('Unknown');
            }
        };
        fetchInstallDate();
    }, []);

    const handleManualUpdateCheck = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        if (updateState?.jsUpdateReady && updateActions?.reloadWithJsUpdate) {
            updateActions.reloadWithJsUpdate();
            return;
        }
        if (updateActions?.manualCheck) {
            const res = await updateActions.manualCheck();
            if (res && !res.hasUpdate && !updateState?.nativeUpdate && !updateState?.jsUpdateReady) {
                showAlert('App Up to Date ✅', `You are running the latest version of SwitchNest (v${APP_VERSION}). No new updates found.`);
            }
        }
    };

    useEffect(() => {
        if (editAddrPin.length === 6) {
            fetch(`https://api.postalpincode.in/pincode/${editAddrPin}`)
                .then(res => res.json())
                .then(data => {
                    if (data && data[0] && data[0].Status === "Success") {
                        const po = data[0].PostOffice[0];
                        if (po) {
                            setEditAddrDistrict(po.District);
                            setEditAddrState(po.State);
                        }
                    }
                })
                .catch(console.error);
        }
    }, [editAddrPin]);

    // Notification Prefs
    const [pushDeviceToggles, setPushDeviceToggles] = useState(user?.pushDeviceToggles ?? true);
    const [pushSystemAlerts, setPushSystemAlerts] = useState(user?.pushSystemAlerts ?? true);
    const { showAlert, AlertComponent } = useThemedAlert();

    useEffect(() => {
        if (view === 'PROFILE') {
            loadSessions();
        }
    }, [view]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('sessions_changed', () => {
            if (view === 'PROFILE') loadSessions();
        });
        return () => sub.remove();
    }, [view]);

    const loadSessions = async () => {
        if (sessions.length === 0) setLoadingSessions(true);
        try {
            let userSessionId = currentSessionId;
            if (!userSessionId) {
                const storedId = await SecureStore.getItemAsync('sessionId');
                if (storedId) {
                    userSessionId = Number(storedId);
                    setCurrentSessionId(userSessionId);
                }
            }

            const { api: apiInstance } = await import('../api/client');
            const res = await apiInstance.get('/auth/sessions');
            if (res.data?.success) {
                const sessionList = res.data.data;

                if (sessionList.length === 0) {
                    onLogout();
                    return;
                }

                // Discard stale session IDs from SecureStore if they don't actually exist
                if (userSessionId && !sessionList.find((s: any) => s.id === userSessionId)) {
                    userSessionId = null;
                    setCurrentSessionId(null);
                }

                sessionList.sort((a: any, b: any) => {
                    if (a.id === userSessionId) return -1;
                    if (b.id === userSessionId) return 1;
                    return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
                });
                setSessions(sessionList);
            }
        } catch (e) {
            console.warn("Failed to load sessions", e);
        } finally {
            setLoadingSessions(false);
        }
    };

    const handleRevokeOther = async () => {
        showAlert("Log out other sessions?", "This will immediately sign out all other active sessions.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout Others",
                style: "destructive",
                onPress: async () => {
                    try {
                        const { api: apiInstance } = await import('../api/client');
                        const res = await apiInstance.delete('/auth/sessions/other' + (currentSessionId ? `?currentSessionId=${currentSessionId}` : ''));

                        if (!res) {
                            showAlert("Fatal Client Error", "The network request returned absolutely nothing.");
                            return;
                        }

                        // Debug dump the actual msg response so we know for sure what backend sent
                        const backendMsg = res.data?.data?.message || "Successfully revoked other sessions.";

                        if (res.data?.data?.currentSessionId) {
                            setCurrentSessionId(res.data.data.currentSessionId);
                            await SecureStore.setItemAsync('sessionId', String(res.data.data.currentSessionId));
                        }

                        showAlert("Success", backendMsg);

                        loadSessions();
                    } catch (e: any) {
                        const msg = e.response?.data?.error?.message;
                        if (msg === "Please log out and log back in to use this feature.") {
                            showAlert("Session Upgrade Required", "Your session is using an older security format. We'll sign you out now so you can log back in securely.", [
                                { text: "OK", onPress: onLogout }
                            ]);
                        } else {
                            showAlert("Fatal Catch Error", "Caught an explicit error: " + (msg || e.message || "Unknown Network Catch"));
                        }
                    }
                }
            }
        ]);
    };

    const handleRevokeOne = async (sessionId: number) => {
        try {
            const { api: apiInstance } = await import('../api/client');
            await apiInstance.delete(`/auth/sessions/${sessionId}`);
            // Optimistically remove from list for immediate snappy UI
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            showAlert("Success", "Device session revoked.");
            loadSessions();
        } catch (e) {
            showAlert("Error", "Failed to revoke session.");
        }
    };

    const handleSaveProfile = async () => {
        setEditingProfile(true);
        try {
            const { api: apiInstance } = await import('../api/client');
            const payload: any = {};
            if (editAvatarUrl.trim()) payload.avatarUrl = editAvatarUrl.trim();
            if (editDob.trim()) payload.dob = editDob.trim();
            if (editGender.trim()) payload.gender = editGender.trim();
            if (editPhone.trim()) payload.phone = editPhone.trim();
            payload.address = JSON.stringify({ state: editAddrState, district: editAddrDistrict, pin: editAddrPin, landmark: editAddrLandmark, street: editAddrStreet });

            const res = await apiInstance.patch('/auth/me', payload);
            if (res.data?.success) {
                const updatedUser = { ...localUser, ...res.data.data };
                setLocalUser(updatedUser);
                setEditProfileVisible(false);
                // Sync to root App so Dashboard/Members get fresh profile
                await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
                DeviceEventEmitter.emit('profile_sync', updatedUser);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            }
        } catch (e: any) {
            showAlert("Error", e.response?.data?.error?.message || "Could not update profile.");
        } finally {
            setEditingProfile(false);
        }
    };

    const changePassword = async () => {
        if (!currentPassword || newPassword.length < 6) {
            showAlert("Invalid Input", "New password must be at least 6 characters.");
            return;
        }
        setPwLoading(true);
        try {
            // Re-using the initialized local api client which carries the JWT authorization tokens.
            const { api: apiInstance } = await import('../api/client');
            const res = await apiInstance.patch('/auth/me', {
                currentPassword,
                newPassword
            });
            if (res.data?.success) {
                showAlert("Success", "Password updated securely.");
                setPwModalVisible(false);
                setCurrentPassword('');
                setNewPassword('');
            } else {
                showAlert("Failed", res.data?.error?.message || "Could not update password.");
            }
        } catch (e: any) {
            showAlert("Error", e.response?.data?.error?.message || "An error occurred.");
        } finally {
            setPwLoading(false);
        }
    };

    useEffect(() => {
        const loadPrefs = async () => {
            const aiPref = await SecureStore.getItemAsync('pref_ai_suggestions');
            if (aiPref !== null) {
                setAiSuggestions(aiPref === 'true');
            }
        };
        loadPrefs();
    }, []);

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.2, // Aggressive Edge-side Compression (reduces 10MB to ~30KB)
        });
        if (!result.canceled) {
            uploadAvatarFile(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
        }
    };

    const takePhotoWithCamera = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
            showAlert("Permission Required", "Camera permission is needed to take a profile photo.");
            return;
        }
        let result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.2,
        });
        if (!result.canceled) {
            uploadAvatarFile(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
        }
    };

    const uploadAvatarFile = async (uri: string, type: string) => {
        const formData = new FormData();
        formData.append('avatar', { uri, name: 'avatar.jpg', type } as any);
        try {
            const { api: apiInstance } = await import('../api/client');
            const res = await apiInstance.post('/auth/me/avatar', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (res.data?.success) {
                const updatedUser = { ...localUser, ...res.data.data };
                setEditAvatarUrl(res.data.data.avatarUrl);
                setLocalUser(updatedUser);
                // Sync to root App so Dashboard/Members get the fresh avatar
                await SecureStore.setItemAsync('user', JSON.stringify(updatedUser));
                DeviceEventEmitter.emit('profile_sync', updatedUser);
                showAlert("Success", "Avatar uploaded successfully.");
            }
        } catch (e: any) {
            showAlert("Error", e.response?.data?.error?.message || "Failed to upload avatar");
        }
    };

    const handleAiSuggestionToggle = async (val: boolean) => {
        setAiSuggestions(val);
        await SecureStore.setItemAsync('pref_ai_suggestions', String(val));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    };

    const handleHapticsToggle = async (val: boolean) => {
        setHapticsOn(val);
        await Haptics.setHapticsEnabled(val);
        if (val) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        }
    };

    useEffect(() => {
        const fetchMe = async () => {
            try {
                const { api: apiInstance } = await import('../api/client');
                const res = await apiInstance.get('/auth/me');
                if (res.data?.success && res.data?.data) {
                    const freshUser = res.data.data;
                    setLocalUser(freshUser);
                    // Keep SecureStore + App.tsx root state in sync
                    await SecureStore.setItemAsync('user', JSON.stringify(freshUser));
                    DeviceEventEmitter.emit('profile_sync', freshUser);
                }
            } catch (e) { }
        }
        if (view === 'MAIN') fetchMe();

        async function fetchLocalPrefs() {
            try {
                const sa = await SecureStore.getItemAsync('pushSystemAlerts');
                const dt = await SecureStore.getItemAsync('pushDeviceToggles');
                setPushSystemAlerts(sa !== 'false');
                setPushDeviceToggles(dt !== 'false');
            } catch (e) { }
        }
        if (view === 'MAIN' || view === 'NOTIFICATIONS') fetchLocalPrefs();
    }, [view]);

    const toggleSystemAlerts = async (val: boolean) => {
        setPushSystemAlerts(val);
        Haptics.selectionAsync().catch(() => { });
        try {
            await SecureStore.setItemAsync('pushSystemAlerts', val ? 'true' : 'false');
            const token = await SecureStore.getItemAsync('expoPushToken');
            if (token) {
                const { api: apiInstance } = await import('../api/client');
                await apiInstance.post('/auth/push-token', { token, pushSystemAlerts: val });
            }
        } catch (e) { setPushSystemAlerts(!val); }
    };

    const toggleDeviceToggles = async (val: boolean) => {
        setPushDeviceToggles(val);
        Haptics.selectionAsync().catch(() => { });
        try {
            await SecureStore.setItemAsync('pushDeviceToggles', val ? 'true' : 'false');
            const token = await SecureStore.getItemAsync('expoPushToken');
            if (token) {
                const { api: apiInstance } = await import('../api/client');
                await apiInstance.post('/auth/push-token', { token, pushDeviceToggles: val });
            }
        } catch (e) { setPushDeviceToggles(!val); }
    };

    if (view === 'NOTIFICATIONS') {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={{ marginBottom: 30 }}>
                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 16 }]}
                        onPress={() => { Haptics.selectionAsync().catch(() => { }); setView('MAIN'); }}
                    >
                        <Text style={{ color: theme.primary, fontWeight: 'bold' }}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Push Alerts</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PREFERENCES</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 0, overflow: 'hidden', flexDirection: 'column' }]}>
                        <View style={[styles.appearanceRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                            <View style={styles.rowLeft}>
                                <Bell color={theme.primary} size={20} />
                                <View>
                                    <Text style={[styles.rowText, { color: theme.text }]}>System & Security</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>Login alerts, schedules, and warnings</Text>
                                </View>
                            </View>
                            <Switch
                                value={pushSystemAlerts}
                                onValueChange={toggleSystemAlerts}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor="#fff"
                            />
                        </View>
                        <View style={styles.appearanceRow}>
                            <View style={styles.rowLeft}>
                                <Zap color={theme.primary} size={20} />
                                <View>
                                    <Text style={[styles.rowText, { color: theme.text }]}>Device Controls</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>Get alerts when hardware is toggled</Text>
                                </View>
                            </View>
                            <Switch
                                value={pushDeviceToggles}
                                onValueChange={toggleDeviceToggles}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>
                </ScrollView>
            </View>
        );
    }

    if (view === 'SUPPORT') {
        return <SupportScreen onClose={() => setView('MAIN')} user={localUser} initialDraft={supportDraft} />;
    }

    if (view === 'TIMELINE') {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background }}>
                <View style={{ paddingTop: 60, paddingHorizontal: 24 }}>
                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => {
                            Haptics.selectionAsync().catch(() => { });
                            setView('MAIN');
                        }}
                    >
                        <Text style={{ color: theme.primary, fontWeight: 'bold' }}>← Back to Settings</Text>
                    </TouchableOpacity>
                </View>
                <ActivityScreen />
            </View>
        );
    }

    if (view === 'APPEARANCE') {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={{ marginBottom: 30 }}>
                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 16 }]}
                        onPress={() => { Haptics.selectionAsync().catch(() => { }); setView('MAIN'); }}
                    >
                        <Text style={{ color: theme.primary, fontWeight: 'bold' }}>← Back</Text>
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Appearance</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>MODES</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 0, overflow: 'hidden', flexDirection: 'column', marginBottom: 30 }]}>
                        <TouchableOpacity style={[styles.appearanceRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]} onPress={() => { Haptics.selectionAsync().catch(() => { }); setMode('light'); }}>
                            <View style={styles.rowLeft}>
                                <Sun color={mode === 'light' ? theme.primary : theme.textSecondary} size={20} />
                                <Text style={[styles.rowText, { color: mode === 'light' ? theme.primary : theme.text }]}>Light Mode</Text>
                            </View>
                            {mode === 'light' && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
                        </TouchableOpacity>

                        <TouchableOpacity style={[styles.appearanceRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]} onPress={() => { Haptics.selectionAsync().catch(() => { }); setMode('dark'); }}>
                            <View style={styles.rowLeft}>
                                <Moon color={mode === 'dark' ? theme.primary : theme.textSecondary} size={20} />
                                <Text style={[styles.rowText, { color: mode === 'dark' ? theme.primary : theme.text }]}>Dark Mode</Text>
                            </View>
                            {mode === 'dark' && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.appearanceRow} onPress={() => { Haptics.selectionAsync().catch(() => { }); setMode('auto'); }}>
                            <View style={styles.rowLeft}>
                                <Monitor color={mode === 'auto' ? theme.primary : theme.textSecondary} size={20} />
                                <Text style={[styles.rowText, { color: mode === 'auto' ? theme.primary : theme.text }]}>System Auto</Text>
                            </View>
                            {mode === 'auto' && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
                        </TouchableOpacity>
                    </View>

                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>PREMIUM THEMES</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={{ marginHorizontal: -24 }}
                        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12, marginBottom: 30 }}
                    >
                        {availableThemes.map(t => {
                            const isActive = themeId === t.id;
                            return (
                                <TouchableOpacity
                                    key={t.id}
                                    onPress={() => { Haptics.selectionAsync().catch(() => { }); setThemeId(t.id); }}
                                    style={{ alignItems: 'center', marginRight: 24, width: 70 }}
                                >
                                    <View
                                        style={[
                                            styles.themeCircle,
                                            {
                                                backgroundColor: t.background,
                                                borderColor: isActive ? t.primary : t.border,
                                                borderWidth: isActive ? 3 : 1,
                                                marginRight: 0
                                            },
                                            isActive && { transform: [{ scale: 1.1 }] }
                                        ]}
                                    >
                                        <View style={{ flex: 1, backgroundColor: t.primary, opacity: 0.9 }} />
                                        <View style={{ flex: 1, backgroundColor: t.accent, opacity: 0.9 }} />
                                    </View>
                                    <Text style={{
                                        marginTop: 10, fontSize: 11, fontWeight: isActive ? '700' : '500',
                                        color: isActive ? theme.primary : theme.textSecondary,
                                        textAlign: 'center'
                                    }}>
                                        {t.name}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </ScrollView>
            </View>
        );
    }

    if (view === 'PROFILE') {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={{ marginBottom: 30 }}>
                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 16 }]}
                        onPress={() => { Haptics.selectionAsync().catch(() => { }); setView('MAIN'); }}
                    >
                        <Text style={{ color: theme.primary, fontWeight: 'bold' }}>← Back</Text>
                    </TouchableOpacity>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
                        <TouchableOpacity
                            style={{ backgroundColor: theme.primary + '20', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                                setEditAvatarUrl(localUser?.avatarUrl || '');
                                setEditDob(localUser?.dob ? new Date(localUser.dob).toISOString().split('T')[0] : '');
                                setEditGender(localUser?.gender || '');
                                setEditPhone(localUser?.phone || '+91 ');
                                let initialAddr = { state: '', district: '', pin: '', landmark: '', street: '' };
                                if (localUser?.address) {
                                    try { initialAddr = JSON.parse(localUser.address); } catch { initialAddr.street = localUser.address; }
                                }
                                setEditAddrState(initialAddr.state || '');
                                setEditAddrDistrict(initialAddr.district || '');
                                setEditAddrPin(initialAddr.pin || '');
                                setEditAddrLandmark(initialAddr.landmark || '');
                                setEditAddrStreet(initialAddr.street || '');
                                setEditProfileVisible(true);
                            }}
                        >
                            <Text style={{ color: theme.primary, fontWeight: 'bold' }}>Edit Profile</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ alignItems: 'center', marginBottom: 30 }}>
                        <TouchableOpacity
                            style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary + '15', borderWidth: 3, borderColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16, overflow: 'hidden' }}
                            onPress={() => {
                                if (localUser?.avatarUrl) setFullscreenAvatarVisible(true);
                            }}
                        >
                            {localUser?.avatarUrl ? (
                                <Image source={{ uri: localUser.avatarUrl.startsWith('http') ? localUser.avatarUrl : API_BASE + localUser.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <Image source={{ uri: `https://api.dicebear.com/9.x/avataaars/png?seed=${localUser?.username || 'User'}` }} style={{ width: '100%', height: '100%' }} />
                            )}
                        </TouchableOpacity>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>{localUser?.username || 'Commander'}</Text>
                    </View>

                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACCOUNT DETAILS</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, flexDirection: 'column', alignItems: 'flex-start', marginBottom: 30 }]}>
                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>EMAIL ADDRESS</Text>
                        <Text style={{ color: theme.text, fontSize: 16, marginTop: 4, fontWeight: '500' }}>{localUser?.email || 'No email attached'}</Text>

                        <View style={{ height: 1, backgroundColor: theme.border, width: '100%', marginVertical: 16 }} />

                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>PHONE</Text>
                        <Text style={{ color: theme.primary, fontSize: 16, marginTop: 4, fontWeight: '600' }}>{localUser?.phone || 'Not set'}</Text>

                        <View style={{ height: 1, backgroundColor: theme.border, width: '100%', marginVertical: 16 }} />

                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>DOB & GENDER</Text>
                        <Text style={{ color: theme.text, fontSize: 16, marginTop: 4, fontWeight: '600' }}>
                            {(localUser?.dob ? new Date(localUser.dob).toLocaleDateString() : 'N/A')} • {localUser?.gender || 'N/A'}
                        </Text>

                        <View style={{ height: 1, backgroundColor: theme.border, width: '100%', marginVertical: 16 }} />

                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>ADDRESS</Text>
                        <Text style={{ color: theme.text, fontSize: 16, marginTop: 4, fontWeight: '500' }}>
                            {(() => {
                                if (!localUser?.address) return 'No Location Set';
                                try {
                                    const parsed = JSON.parse(localUser.address);
                                    let fragments = [];
                                    if (parsed.street) fragments.push(parsed.street);
                                    if (parsed.landmark) fragments.push(parsed.landmark);
                                    if (parsed.district) fragments.push(parsed.district);
                                    if (parsed.state) fragments.push(parsed.state);
                                    if (parsed.pin) fragments.push(parsed.pin);
                                    return fragments.join(", ") || localUser.address;
                                } catch (e) {
                                    return localUser.address;
                                }
                            })()}
                        </Text>

                        <View style={{ height: 1, backgroundColor: theme.border, width: '100%', marginVertical: 16 }} />

                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>SECURITY CLEARANCE</Text>
                        <Text style={{ color: theme.primary, fontSize: 16, marginTop: 4, fontWeight: '700', textTransform: 'uppercase' }}>{localUser?.role?.replace('_', ' ') || 'User'}</Text>
                    </View>

                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SECURITY</Text>
                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { }); setPwModalVisible(true); }}
                        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, justifyContent: 'space-between', flexDirection: 'row' }]}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Shield color={theme.primary} size={24} style={{ marginRight: 12 }} />
                            <View>
                                <Text style={[styles.cardTitle, { color: theme.text }]}>Change Password</Text>
                                <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Update your security credentials</Text>
                            </View>
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: 'bold' }}>›</Text>
                    </TouchableOpacity>

                    {/* Active Sessions UI */}
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 30 }]}>ACTIVE SESSIONS</Text>
                    {loadingSessions ? (
                        <ActivityIndicator size="small" color={theme.primary} style={{ marginTop: 16, marginBottom: 30 }} />
                    ) : (
                        <View style={{ marginBottom: 30 }}>
                            {sessions.map(sess => {
                                const isCurrent = sess.id === currentSessionId;
                                return (
                                    <View key={sess.id} style={[styles.card, { backgroundColor: isCurrent ? theme.primary + '11' : theme.card, borderColor: isCurrent ? theme.primary : theme.border, marginBottom: 12, flexDirection: 'column', alignItems: 'flex-start', padding: 14 }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, width: '100%', justifyContent: 'space-between' }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                <Monitor color={isCurrent ? theme.primary : theme.textSecondary} size={16} style={{ marginRight: 8 }} />
                                                <Text style={{ color: isCurrent ? theme.primary : theme.text, fontSize: 14, fontWeight: '600', flex: 1 }} numberOfLines={1}>
                                                    {sess.deviceInfo || 'Unknown Device'}
                                                </Text>
                                            </View>
                                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                                                {isCurrent ? (
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10b98115', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
                                                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981', marginRight: 4 }} />
                                                        <Text style={{ color: '#10b981', fontSize: 10, fontWeight: 'bold', textTransform: 'uppercase' }}>This session</Text>
                                                    </View>
                                                ) : (
                                                    <TouchableOpacity
                                                        onPress={() => handleRevokeOne(sess.id)}
                                                        style={{ backgroundColor: theme.danger + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}
                                                    >
                                                        <Text style={{ color: theme.danger, fontSize: 10, fontWeight: 'bold' }}>Remove</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        </View>
                                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginLeft: 24 }}>IP: {sess.ipAddress || 'Unknown Location'}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4, marginLeft: 24 }}>Started: {new Date(sess.createdAt).toLocaleString()}</Text>
                                    </View>
                                );
                            })}

                            {sessions.length > 1 && (
                                <TouchableOpacity
                                    onPress={handleRevokeOther}
                                    style={[styles.card, { backgroundColor: 'transparent', borderColor: '#ef4444', borderWidth: 1, justifyContent: 'center', marginTop: 8 }]}
                                >
                                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Log out all other sessions</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Password Change Overlay Modal */}
                <Modal visible={pwModalVisible} animationType="slide" transparent={true} onRequestClose={() => setPwModalVisible(false)}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
                            <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderTopWidth: 1, borderColor: theme.border }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>Update Password</Text>
                                    <TouchableOpacity onPress={() => setPwModalVisible(false)}>
                                        <Text style={{ color: theme.primary, fontWeight: '700' }}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '700' }}>CURRENT PASSWORD</Text>
                                <TextInput
                                    style={[{ backgroundColor: theme.card, color: theme.text, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }]}
                                    secureTextEntry
                                    placeholder="Enter current password"
                                    placeholderTextColor={theme.textSecondary}
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                />

                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '700' }}>NEW PASSWORD</Text>
                                <TextInput
                                    style={[{ backgroundColor: theme.card, color: theme.text, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 24 }]}
                                    secureTextEntry
                                    placeholder="Enter new password (min 6 chars)"
                                    placeholderTextColor={theme.textSecondary}
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                />

                                <TouchableOpacity
                                    onPress={changePassword}
                                    disabled={pwLoading}
                                    style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' }}
                                >
                                    {pwLoading ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 16 }}>Save Changes</Text>}
                                </TouchableOpacity>
                            </View>
                        </KeyboardAvoidingView>
                    </View>
                </Modal >

                {/* Edit Profile Modal */}
                < Modal visible={editProfileVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setEditProfileVisible(false)}>
                    <View style={{ flex: 1, backgroundColor: theme.background }}>
                        <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
                            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderColor: theme.border, marginBottom: 0 }]}>
                                <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.text }}>Edit Profile</Text>
                                <TouchableOpacity onPress={() => setEditProfileVisible(false)}>
                                    <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 16 }}>Close</Text>
                                </TouchableOpacity>
                            </View>
                            <ScrollView contentContainerStyle={{ padding: 24 }}>
                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '700' }}>PROFILE PHOTO</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, marginRight: 16, overflow: 'hidden' }}>
                                        <Image
                                            source={{ uri: editAvatarUrl ? (editAvatarUrl.startsWith('http') ? editAvatarUrl : API_BASE + editAvatarUrl) : `https://api.dicebear.com/9.x/avataaars/png?seed=${localUser?.username || 'User'}` }}
                                            style={{ width: '100%', height: '100%' }}
                                        />
                                    </View>
                                    <View style={{ flex: 1, flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity onPress={takePhotoWithCamera} style={{ backgroundColor: theme.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                                            <Camera color="#000" size={14} style={{ marginRight: 6 }} />
                                            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 13 }}>Camera</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={pickImage} style={{ backgroundColor: theme.primary + '20', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 13 }}>Gallery</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '700' }}>DATE OF BIRTH (YYYY-MM-DD)</Text>
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    style={[{ backgroundColor: theme.card, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }]}
                                >
                                    <Text style={{ color: editDob ? theme.text : theme.textSecondary }}>{editDob || "Select Date of Birth"}</Text>
                                </TouchableOpacity>
                                {showDatePicker && (
                                    <DateTimePicker
                                        value={editDob ? new Date(editDob) : new Date()}
                                        mode="date"
                                        display="default"
                                        onChange={(event: any, selectedDate?: Date) => {
                                            setShowDatePicker(false);
                                            if (event.type === 'set' && selectedDate) {
                                                setEditDob(selectedDate.toISOString().split('T')[0]);
                                            }
                                        }}
                                    />
                                )}

                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '700' }}>GENDER</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                    {['Male', 'Female', 'Prefer not to say'].map((g) => (
                                        <TouchableOpacity
                                            key={g}
                                            onPress={() => setEditGender(g)}
                                            style={{ flex: 1, padding: 12, borderWidth: 1, borderColor: editGender === g ? theme.primary : theme.border, borderRadius: 12, marginRight: g === 'Prefer not to say' ? 0 : 8, backgroundColor: editGender === g ? theme.primary + '20' : theme.card, alignItems: 'center' }}
                                        >
                                            <Text style={{ color: editGender === g ? theme.primary : theme.text, fontSize: 11, fontWeight: '600', textAlign: 'center' }}>{g}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '700' }}>PHONE NUMBER</Text>
                                <TextInput
                                    style={[{ backgroundColor: theme.card, color: theme.text, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16 }]}
                                    placeholder="+91 234 567 890"
                                    placeholderTextColor={theme.textSecondary}
                                    keyboardType="phone-pad"
                                    value={editPhone}
                                    onChangeText={setEditPhone}
                                />

                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: '700' }}>ADDRESS BREAKDOWN</Text>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <TextInput style={[{ flex: 1, backgroundColor: theme.card, color: theme.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginRight: 8 }]} placeholder="PIN Code" placeholderTextColor={theme.textSecondary} value={editAddrPin} onChangeText={setEditAddrPin} keyboardType="numeric" maxLength={6} />
                                    <View style={{ flex: 1 }} />
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                    <TextInput style={[{ flex: 1, backgroundColor: theme.card, color: theme.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginRight: 8 }]} placeholder="State" placeholderTextColor={theme.textSecondary} value={editAddrState} onChangeText={setEditAddrState} />
                                    <TextInput style={[{ flex: 1, backgroundColor: theme.card, color: theme.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border }]} placeholder="District" placeholderTextColor={theme.textSecondary} value={editAddrDistrict} onChangeText={setEditAddrDistrict} />
                                </View>
                                <TextInput style={[{ backgroundColor: theme.card, color: theme.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 16, minHeight: 60, textAlignVertical: 'top' }]} placeholder="Landmark (e.g., Near City Mall)" placeholderTextColor={theme.textSecondary} multiline value={editAddrLandmark} onChangeText={setEditAddrLandmark} />
                                <TextInput style={[{ backgroundColor: theme.card, color: theme.text, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border, marginBottom: 32, minHeight: 80, textAlignVertical: 'top' }]} placeholder="Street Address..." placeholderTextColor={theme.textSecondary} multiline value={editAddrStreet} onChangeText={setEditAddrStreet} />

                                <TouchableOpacity
                                    onPress={handleSaveProfile}
                                    disabled={editingProfile}
                                    style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 60 }}
                                >
                                    {editingProfile ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Save Changes</Text>}
                                </TouchableOpacity>
                            </ScrollView>
                        </KeyboardAvoidingView>
                    </View>
                </Modal >

                {/* Fullscreen Avatar Viewer */}
                < Modal visible={fullscreenAvatarVisible} transparent={true} animationType="fade" onRequestClose={() => setFullscreenAvatarVisible(false)}>
                    <TouchableOpacity style={{ flex: 1, backgroundColor: '#000000f0', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setFullscreenAvatarVisible(false)}>
                        <Image
                            source={{ uri: localUser?.avatarUrl ? (localUser.avatarUrl.startsWith('http') ? localUser.avatarUrl : API_BASE + localUser.avatarUrl) : undefined }}
                            style={{ width: '100%', height: '80%', resizeMode: 'contain' }}
                        />
                        <TouchableOpacity style={{ position: 'absolute', top: 50, right: 30 }} onPress={() => setFullscreenAvatarVisible(false)}>
                            <X color="#ffffff" size={32} />
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal >

                {AlertComponent}
            </View >
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }); setView('PROFILE'); }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {localUser?.avatarUrl ? (
                            <Image source={{ uri: localUser.avatarUrl.startsWith('http') ? localUser.avatarUrl : API_BASE + localUser.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <User color={theme.textSecondary} size={22} />
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APP CONFIGURATION</Text>
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 30 }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        setView('APPEARANCE');
                    }}
                >
                    <Monitor color={theme.primary} size={24} style={{ marginRight: 12 }} />
                    <View>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Appearance</Text>
                        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Themes, Light/Dark, and Mode</Text>
                    </View>
                </TouchableOpacity>

                <View style={{ marginBottom: 30 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SMART ASSISTANT</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 0, overflow: 'hidden', flexDirection: 'column' }]}>
                        <View style={[styles.appearanceRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Bot color={theme.text} size={24} style={{ marginRight: 12 }} />
                                <View>
                                    <Text style={{ fontSize: 16, color: theme.text }}>AI Suggestions</Text>
                                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>Smart scene recommendations</Text>
                                </View>
                            </View>
                            <Switch
                                value={aiSuggestions}
                                onValueChange={handleAiSuggestionToggle}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor="#fff"
                            />
                        </View>
                        <View style={styles.appearanceRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Activity color={theme.text} size={24} style={{ marginRight: 12 }} />
                                <View>
                                    <Text style={{ fontSize: 16, color: theme.text }}>Haptic Feedback</Text>
                                    <Text style={{ fontSize: 12, color: theme.textSecondary }}>Vibrations on interaction</Text>
                                </View>
                            </View>
                            <Switch
                                value={hapticsOn}
                                onValueChange={handleHapticsToggle}
                                trackColor={{ false: theme.border, true: theme.primary }}
                                thumbColor="#fff"
                            />
                        </View>
                    </View>
                </View>

                <View style={{ marginBottom: 30 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>NOTIFICATION ALERTS</Text>
                    <TouchableOpacity
                        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                            setView('NOTIFICATIONS');
                        }}
                    >
                        <Bell color={theme.primary} size={24} style={{ marginRight: 12 }} />
                        <View>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Push Settings</Text>
                            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Configure device and system alerts</Text>
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: 'bold', marginLeft: 'auto' }}>›</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ marginBottom: 30 }}>
                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APP & UPDATES</Text>
                    <TouchableOpacity
                        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 16 }]}
                        onPress={handleManualUpdateCheck}
                    >
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                            {updateState?.jsChecking || updateState?.jsDownloading ? (
                                <ActivityIndicator color={theme.primary} />
                            ) : updateState?.jsUpdateReady ? (
                                <CheckCircle color={'#10b981'} size={24} />
                            ) : (
                                <RefreshCw color={theme.primary} size={24} />
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>
                                {updateState?.jsChecking ? 'Checking...' : updateState?.jsDownloading ? 'Downloading OTA...' : updateState?.jsUpdateReady ? 'Restart to Apply Update' : 'Check for Updates'}
                            </Text>
                            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                                JS updates apply automatically · APK updates show a popup
                            </Text>
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: 'bold', marginLeft: 'auto' }}>›</Text>
                    </TouchableOpacity>

                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SHARE & INVITE</Text>
                    <TouchableOpacity
                        style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 16 }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                            setShareModalVisible(true);
                        }}
                    >
                        <ShareIcon color={theme.primary} size={24} style={{ marginRight: 12 }} />
                        <View>
                            <Text style={[styles.cardTitle, { color: theme.text }]}>Share App</Text>
                            <Text style={[styles.cardSub, { color: theme.textSecondary }]}>QR code and direct link</Text>
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: 'bold', marginLeft: 'auto' }}>›</Text>
                    </TouchableOpacity>

                    {isHomeAdmin && (
                        <>
                            <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: 12 }]}>ADVANCED & HARDWARE</Text>
                            <TouchableOpacity
                                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                                    setEspModalVisible(true);
                                }}
                            >
                                <Cpu color={theme.primary} size={24} style={{ marginRight: 12 }} />
                                <View>
                                    <Text style={[styles.cardTitle, { color: theme.text }]}>ESP WebServer Direct</Text>
                                    <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Directly connect to board webserver</Text>
                                </View>
                                <Text style={{ color: theme.textSecondary, fontSize: 18, fontWeight: 'bold', marginLeft: 'auto' }}>›</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>

                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACCOUNT & DATA</Text>
                <TouchableOpacity
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        setView('TIMELINE');
                    }}
                >
                    <Activity color={theme.primary} size={24} style={{ marginRight: 12 }} />
                    <View>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Audit Logs</Text>
                        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>View chronological history (Admins Only)</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 20 }]}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                        setView('SUPPORT');
                    }}
                >
                    <Headset color={theme.primary} size={24} style={{ marginRight: 12 }} />
                    <View>
                        <Text style={[styles.cardTitle, { color: theme.text }]}>Contact Support</Text>
                        <Text style={[styles.cardSub, { color: theme.textSecondary }]}>Get help with orders and devices</Text>
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 12 }]}
                    onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                        onLogout();
                    }}
                >
                    <User color="#ef4444" size={24} style={{ marginRight: 12 }} />
                    <Text style={[styles.cardTitle, { color: '#ef4444' }]}>Sign Out</Text>
                </TouchableOpacity>

                <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 80, opacity: 0.5 }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '700', letterSpacing: 2 }}>SWITCHNEST MOBILE</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 4 }}>Version {APP_VERSION} (OTA Protocol 2)</Text>
                    <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 2 }}>Last Updated: {installDate}</Text>
                </View>
            </ScrollView>

            {/* Share App Modal */}
            <Modal visible={shareModalVisible} transparent={true} animationType="slide" onRequestClose={() => setShareModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: '#000000e0', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: theme.background, width: '85%', borderRadius: 24, padding: 30, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}>
                        <Text style={{ color: theme.text, fontSize: 20, fontWeight: 'bold', marginBottom: 10 }}>Share SwitchNest</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 13, textAlign: 'center', marginBottom: 30, lineHeight: 20 }}>Scan this QR code to download the SwitchNest APK on any Android device.</Text>
                        
                        <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16, marginBottom: 30 }}>
                            <QRCode
                                value={API_BASE + '/api/public/apk'}
                                size={180}
                                color="black"
                                backgroundColor="white"
                            />
                        </View>

                        <TouchableOpacity
                            onPress={async () => {
                                if (downloadingApk) return;
                                setDownloadingApk(true);
                                try {
                                    const sourceApkPath = getApkPath();
                                    const fileUri = FileSystem.cacheDirectory + 'SwitchNest.apk';
                                    await FileSystem.copyAsync({ from: 'file://' + sourceApkPath, to: fileUri });
                                    
                                    const canShare = await Sharing.isAvailableAsync();
                                    if (canShare) {
                                        await Sharing.shareAsync(fileUri, {
                                            mimeType: 'application/vnd.android.package-archive',
                                            dialogTitle: 'Share SwitchNest App'
                                        });
                                    } else {
                                        Alert.alert("Not Supported", "Sharing files is not supported on this device.");
                                    }
                                } catch (error) {
                                    console.error(error);
                                    Alert.alert("Error", "Failed to extract and share the APK. Make sure to rebuild the app.");
                                } finally {
                                    setDownloadingApk(false);
                                }
                            }}
                            style={{ backgroundColor: theme.primary, paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', marginBottom: 12 }}
                        >
                            {downloadingApk ? <ActivityIndicator color="#000" /> : (
                                <>
                                    <ShareIcon color="#000" size={18} style={{ marginRight: 8 }} />
                                    <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Share APK File</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={async () => {
                                try {
                                    await RNShare.share({
                                        message: `Download the SwitchNest App here:\n\n${API_BASE}/api/public/apk`
                                    });
                                } catch (error) {
                                    console.error(error);
                                }
                            }}
                            style={{ backgroundColor: 'transparent', paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center', marginBottom: 12, borderWidth: 1, borderColor: theme.border }}
                        >
                            <ShareIcon color={theme.text} size={18} style={{ marginRight: 8 }} />
                            <Text style={{ color: theme.text, fontWeight: 'bold', fontSize: 16 }}>Share URL Link</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setShareModalVisible(false)}
                            style={{ paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
                        >
                            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ESP WebServer Direct Modal */}
            <Modal visible={espModalVisible} transparent={true} animationType="slide" onRequestClose={() => setEspModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: '#000000e0', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: theme.background, width: '85%', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: theme.border }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <Cpu color={theme.primary} size={24} style={{ marginRight: 10 }} />
                                <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>ESP WebServer Direct</Text>
                            </View>
                            <TouchableOpacity onPress={() => setEspModalVisible(false)}>
                                <X color={theme.textSecondary} size={22} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 20, lineHeight: 18 }}>
                            Connect directly to your ESP32 / ESP8266 board's local web server to manage WiFi credentials, firmware, or live debug console.
                        </Text>

                        {/* Board Name Selection Dropdown / Selector */}
                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700', marginBottom: 8, letterSpacing: 1 }}>
                            SELECT BOARD BY NAME
                        </Text>

                        {loadingBoards ? (
                            <ActivityIndicator size="small" color={theme.primary} style={{ marginVertical: 12 }} />
                        ) : userBoards.length > 0 ? (
                            <ScrollView style={{ maxHeight: 120, marginBottom: 16 }} nestedScrollEnabled showsVerticalScrollIndicator={true}>
                                {userBoards.map((b, idx) => {
                                    const boardName = b.boardName || b.name || b.label || `ESP Board ${idx + 1}`;
                                    const homeName = b.homeName || 'Home';
                                    const boardIp = b.ipAddress || b.localIp || b.ip || '192.168.4.1';
                                    const isSelected = selectedBoard?.id === b.id || espIp === boardIp;
                                    return (
                                        <TouchableOpacity
                                            key={b.id || idx}
                                            onPress={() => {
                                                setSelectedBoard(b);
                                                setEspIp(boardIp);
                                                Haptics.selectionAsync().catch(() => {});
                                            }}
                                            style={{
                                                flexDirection: 'row',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: 12,
                                                borderRadius: 10,
                                                backgroundColor: isSelected ? theme.primary + '20' : theme.card,
                                                borderWidth: 1,
                                                borderColor: isSelected ? theme.primary : theme.border,
                                                marginBottom: 6
                                            }}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                                                <Cpu color={isSelected ? theme.primary : theme.textSecondary} size={18} style={{ marginRight: 10 }} />
                                                <View>
                                                    <Text style={{ color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? '700' : '500', fontSize: 14 }}>
                                                        {boardName}
                                                    </Text>
                                                    <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 1 }}>
                                                        {homeName} • Admin Access Granted
                                                    </Text>
                                                </View>
                                            </View>
                                            {isSelected && <CheckCircle color={theme.primary} size={16} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        ) : (
                            <Text style={{ color: theme.textSecondary, fontSize: 12, fontStyle: 'italic', marginBottom: 12, lineHeight: 18 }}>
                                No boards found where you hold Home Admin or Owner access. Contact your Home Admin for permission.
                            </Text>
                        )}

                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
                            <TouchableOpacity
                                style={{ flex: 1, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, paddingVertical: 10, borderRadius: 10, alignItems: 'center' }}
                                onPress={() => { setSelectedBoard(null); setEspIp('192.168.4.1'); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }}
                            >
                                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>⚡ AP Mode (192.168.4.1)</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={() => {
                                const cleanIp = espIp.trim().replace(/^https?:\/\//, '');
                                if (!cleanIp) {
                                    Alert.alert("Invalid IP", "Please enter a valid IP address or hostname.");
                                    return;
                                }
                                const targetUrl = `http://${cleanIp}`;
                                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                                setEspModalVisible(false);
                                setWebViewUrl(targetUrl);
                            }}
                            style={{ backgroundColor: theme.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', marginBottom: 12 }}
                        >
                            <Wifi color="#000" size={18} style={{ marginRight: 8 }} />
                            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Open Internal WebServer</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => setEspModalVisible(false)}
                            style={{ paddingVertical: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
                        >
                            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Internal WebView Modal for ESP */}
            <Modal visible={!!webViewUrl} animationType="slide" onRequestClose={() => setWebViewUrl(null)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <View style={{ paddingTop: Platform.OS === 'ios' ? 50 : 20, paddingHorizontal: 16, paddingBottom: 16, backgroundColor: theme.card, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: theme.border }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <Cpu color={theme.primary} size={20} style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: theme.text, fontSize: 16, fontWeight: 'bold' }}>ESP WebServer</Text>
                                <Text style={{ color: theme.textSecondary, fontSize: 11 }} numberOfLines={1}>{webViewUrl}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setWebViewUrl(null)} style={{ padding: 8, backgroundColor: theme.primary + '20', borderRadius: 20 }}>
                            <X color={theme.primary} size={20} />
                        </TouchableOpacity>
                    </View>
                    {webViewUrl && (
                        <WebView
                            source={{ uri: webViewUrl }}
                            style={{ flex: 1, backgroundColor: theme.background }}
                            startInLoadingState={true}
                            renderLoading={() => (
                                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
                                    <ActivityIndicator size="large" color={theme.primary} />
                                </View>
                            )}
                            onError={(syntheticEvent) => {
                                const { nativeEvent } = syntheticEvent;
                                console.warn('WebView error: ', nativeEvent);
                            }}
                            onHttpError={(syntheticEvent) => {
                                const { nativeEvent } = syntheticEvent;
                                console.warn('WebView HTTP error: ', nativeEvent);
                            }}
                        />
                    )}
                </View>
            </Modal>

            {AlertComponent}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, paddingTop: 60 },
    header: { marginBottom: 30 },
    headerTitle: { fontSize: 32, fontWeight: 'bold' },
    card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
    cardTitle: { fontSize: 16, fontWeight: '600' },
    cardSub: { fontSize: 12, marginTop: 2 },
    backBtn: { borderRadius: 20, borderWidth: 1, padding: 10, alignSelf: 'flex-start' },
    sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
    appearanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowText: { fontSize: 16, fontWeight: '500' },
    dot: { width: 8, height: 8, borderRadius: 4 },
    themeCircle: { width: 56, height: 56, borderRadius: 28, overflow: 'hidden', flexDirection: 'row', marginBottom: 4 }
});
