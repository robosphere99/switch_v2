import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, ScrollView, Modal, TextInput, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ActivityScreen } from './ActivityScreen';
import { Activity, User, Monitor, Sun, Moon, Bot, Shield, Bell, Zap } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import { APP_VERSION } from '../../App';

export function SettingsScreen({ user, onLogout }: { user?: any, onLogout: () => void }) {
    const { theme, mode, setMode, themeId, setThemeId, availableThemes } = useTheme();
    const [aiSuggestions, setAiSuggestions] = useState(true);
    const [view, setView] = useState<'MAIN' | 'TIMELINE' | 'APPEARANCE' | 'PROFILE' | 'NOTIFICATIONS'>('MAIN');

    // Password Update States
    const [pwModalVisible, setPwModalVisible] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [pwLoading, setPwLoading] = useState(false);

    // Sessions States
    const [sessions, setSessions] = useState<any[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    // Notification Prefs
    const [pushDeviceToggles, setPushDeviceToggles] = useState(user?.pushDeviceToggles ?? true);
    const [pushSystemAlerts, setPushSystemAlerts] = useState(user?.pushSystemAlerts ?? true);

    useEffect(() => {
        if (view === 'PROFILE') {
            loadSessions();
        }
    }, [view]);

    const loadSessions = async () => {
        setLoadingSessions(true);
        try {
            const { api: apiInstance } = await import('../api/client');
            const res = await apiInstance.get('/auth/sessions');
            if (res.data?.success) {
                setSessions(res.data.data);
            }
        } catch (e) {
            console.warn("Failed to load sessions", e);
        } finally {
            setLoadingSessions(false);
        }
    };

    const handleRevokeAll = async () => {
        Alert.alert("Log out all devices?", "This will immediately sign out all active sessions including this one.", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Logout All",
                style: "destructive",
                onPress: async () => {
                    try {
                        const { api: apiInstance } = await import('../api/client');
                        await apiInstance.delete('/auth/sessions/all');
                        Alert.alert("Success", "All remote sessions have been revoked.");
                        onLogout();
                    } catch (e) {
                        Alert.alert("Error", "Failed to revoke sessions.");
                    }
                }
            }
        ]);
    };

    const changePassword = async () => {
        if (!currentPassword || newPassword.length < 6) {
            Alert.alert("Invalid Input", "New password must be at least 6 characters.");
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
                Alert.alert("Success", "Password updated securely.");
                setPwModalVisible(false);
                setCurrentPassword('');
                setNewPassword('');
            } else {
                Alert.alert("Failed", res.data?.error?.message || "Could not update password.");
            }
        } catch (e: any) {
            Alert.alert("Error", e.response?.data?.error?.message || "An error occurred.");
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

    const handleAiSuggestionToggle = async (val: boolean) => {
        setAiSuggestions(val);
        await SecureStore.setItemAsync('pref_ai_suggestions', String(val));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
    };

    useEffect(() => {
        const fetchMe = async () => {
            try {
                const { api: apiInstance } = await import('../api/client');
                const res = await apiInstance.get('/auth/me');
                if (res.data?.success && res.data?.data) {
                    // Ignored 1:1 user push settings fetching; preferring SecureStore token defaults instead
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
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Profile</Text>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                    <View style={{ alignItems: 'center', marginBottom: 30 }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.primary + '15', borderWidth: 3, borderColor: theme.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <User color={theme.primary} size={40} />
                        </View>
                        <Text style={{ fontSize: 24, fontWeight: '800', color: theme.text }}>{user?.username || 'Commander'}</Text>
                        <Text style={{ fontSize: 13, color: theme.textSecondary, marginTop: 6, fontWeight: '500' }}>IDENTIFIER: #{user?.id || '----'}</Text>
                    </View>

                    <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACCOUNT DETAILS</Text>
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, flexDirection: 'column', alignItems: 'flex-start', marginBottom: 30 }]}>
                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>EMAIL ADDRESS</Text>
                        <Text style={{ color: theme.text, fontSize: 16, marginTop: 4, fontWeight: '500' }}>{user?.email || 'No email attached'}</Text>

                        <View style={{ height: 1, backgroundColor: theme.border, width: '100%', marginVertical: 16 }} />

                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '700' }}>SECURITY CLEARANCE</Text>
                        <Text style={{ color: theme.primary, fontSize: 16, marginTop: 4, fontWeight: '700', textTransform: 'uppercase' }}>{user?.role?.replace('_', ' ') || 'User'}</Text>
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
                            {sessions.map(sess => (
                                <View key={sess.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginBottom: 12, flexDirection: 'column', alignItems: 'flex-start', padding: 14 }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                        <Monitor color={theme.textSecondary} size={16} style={{ marginRight: 8 }} />
                                        <Text style={{ color: theme.text, fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
                                            {sess.deviceInfo || 'Unknown Device'}
                                        </Text>
                                    </View>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginLeft: 24 }}>IP: {sess.ipAddress || 'Unknown Location'}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 10, marginTop: 4, marginLeft: 24 }}>Started: {new Date(sess.createdAt).toLocaleString()}</Text>
                                </View>
                            ))}

                            {sessions.length > 0 && (
                                <TouchableOpacity
                                    onPress={handleRevokeAll}
                                    style={[styles.card, { backgroundColor: 'transparent', borderColor: '#ef4444', borderWidth: 1, justifyContent: 'center', marginTop: 8 }]}
                                >
                                    <Text style={{ color: '#ef4444', fontWeight: 'bold' }}>Log out of all devices</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </ScrollView>

                {/* Password Change Overlay Modal */}
                <Modal visible={pwModalVisible} animationType="slide" transparent={true} onRequestClose={() => setPwModalVisible(false)}>
                    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
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
                </Modal>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
                <TouchableOpacity onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { }); setView('PROFILE'); }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignItems: 'center', justifyContent: 'center' }}>
                        <User color={theme.textSecondary} size={22} />
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
                        <View style={styles.appearanceRow}>
                            <View style={styles.rowLeft}>
                                <Bot color={theme.primary} size={20} />
                                <Text style={[styles.rowText, { color: theme.text }]}>Floating Suggestions</Text>
                            </View>
                            <Switch
                                value={aiSuggestions}
                                onValueChange={handleAiSuggestionToggle}
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
                </View>
            </ScrollView>
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
