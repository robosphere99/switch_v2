import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Animated, Image, PanResponder, Dimensions, Modal, DeviceEventEmitter } from 'react-native';
import { LogOut, Home as HomeIcon, Zap, Shield, Wifi, User, Activity, Bot, Bell } from 'lucide-react-native';
import { getHomes, getDevices, toggleDevice } from '../api/hardware';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';
import { AssistantModal } from './AssistantModal';
import { NotificationCenterScreen } from './NotificationCenterScreen';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useSocket } from '../hooks/useSocket';
import { api } from '../api/client';

const DeviceCard = ({ device, onToggle }: { device: any, onToggle: (id: number, status: string) => void }) => {
    const { theme } = useTheme();
    const isON = device.status === 'on';

    // Animation References
    const animScale = useRef(new Animated.Value(1)).current;
    const animGlow = useRef(new Animated.Value(isON ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(animGlow, { toValue: isON ? 1 : 0, duration: 300, useNativeDriver: false }).start();
    }, [isON]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        Animated.sequence([
            Animated.timing(animScale, { toValue: 0.92, duration: 100, useNativeDriver: true }),
            Animated.timing(animScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        onToggle(device.id, device.status);
    };

    const bgColor = animGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.card, theme.card] // Keep card dark, let text/icons glow
    });

    const borderColor = animGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.border, theme.primary]
    });

    return (
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: animScale }] }]}>
            <TouchableOpacity activeOpacity={0.85} onPress={handlePress} delayPressIn={100}>
                <Animated.View style={[
                    styles.cardContent,
                    { backgroundColor: bgColor, borderColor: borderColor }
                ]}>
                    <View style={styles.cardHeader}>
                        <View style={[
                            styles.iconBox,
                            isON ? { backgroundColor: theme.primary, shadowColor: theme.primaryGlow, shadowOpacity: 0.8, shadowRadius: 8, elevation: 10 } : { backgroundColor: theme.border }
                        ]}>
                            <Zap color={isON ? '#000000' : theme.textSecondary} fill={isON ? '#000000' : 'transparent'} size={20} />
                        </View>
                        <View style={[styles.pillToggle, { backgroundColor: isON ? theme.primary : theme.border }]}>
                            <View style={[styles.pillNub, { transform: [{ translateX: isON ? 12 : 2 }] }]} />
                        </View>
                    </View>

                    <View style={{ marginTop: 12 }}>
                        <Text style={[styles.deviceName, { color: isON ? theme.primary : theme.text }]} numberOfLines={1}>{device.name}</Text>
                        <Text style={[styles.deviceSub, { color: theme.textSecondary }]} numberOfLines={1}>
                            {device.room?.name || 'Home'}
                        </Text>
                    </View>
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export function DashboardScreen({ user, onLogout }: { user: any, onLogout: () => void }) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [homes, setHomes] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [aiVisible, setAiVisible] = useState(false);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const [unreadBadge, setUnreadBadge] = useState(0);

    // Activates Native Push Notifications (Background Sync & Permission Handling)
    usePushNotifications();

    // Activates Real-Time Websocket Updates (Instantly syncs UI without pulling data)
    useSocket((payload) => {
        setDevices(prevDevices =>
            prevDevices.map(d =>
                (d.id === payload.id) ? { ...d, status: payload.status, offline: payload.offline } : d
            )
        );
    });

    useEffect(() => {
        loadData();
        const syncSub = DeviceEventEmitter.addListener('notification_sync', async () => {
            try {
                const badgeRes = await api.get('/notifications/unread-count');
                if (badgeRes?.data?.data !== undefined) setUnreadBadge(badgeRes.data.data);
            } catch (e) { }
        });
        return () => syncSub.remove();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const homesRes = await getHomes();
            if (homesRes.success && homesRes.data.length > 0) {
                const homeList = homesRes.data;
                setHomes(homeList);
                const homeId = homeList[0].homeId || homeList[0].id;
                setSelectedHomeId(homeId);

                const devicesRes = await getDevices(homeId);
                if (devicesRes.success) {
                    setDevices(devicesRes.data);
                }
            }

            try {
                const badgeRes = await api.get('/notifications/unread-count');
                if (badgeRes?.data?.data !== undefined) setUnreadBadge(badgeRes.data.data);
            } catch (e) { }
        } catch (e: any) {
            console.log('Failed to fetch data', e);
        } finally {
            setLoading(false);
        }
    };

    const handleHomeSelect = async (homeId: number) => {
        if (homeId === selectedHomeId) return;
        setSelectedHomeId(homeId);
        setActiveCategory('All');
        setLoading(true);
        try {
            const devicesRes = await getDevices(homeId);
            if (devicesRes.success) setDevices(devicesRes.data);
        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (deviceId: number, currentStatus: string) => {
        if (!selectedHomeId) return;

        // Fast Optimistic Update for zero-latency feel
        const newStatus = currentStatus === 'on' ? 'off' : 'on';
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: newStatus } : d));

        try {
            await toggleDevice(selectedHomeId, deviceId, newStatus);
        } catch (e: any) {
            Alert.alert('Control Error', e.message || 'Failed to toggle device. Connection issues.');
            // Revert if API fails
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: currentStatus } : d));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
        }
    };

    // Extract dynamic categories based on user's assigned rooms
    const categories = ['All', ...Array.from(new Set(devices.map(d => d.room?.name).filter(Boolean)))];

    // Filter devices before rendering
    const filteredDevices = devices.filter(d => activeCategory === 'All' || d.room?.name === activeCategory);

    // Dynamic Intelligence Computations
    const activeCount = devices.filter(d => d.status === 'on').length;
    const hour = new Date().getHours();
    const isMorning = hour >= 5 && hour < 12;
    const isAfternoon = hour >= 12 && hour < 18;
    const greeting = isMorning ? 'Good Morning' : isAfternoon ? 'Good Afternoon' : 'Good Evening';

    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.userName, { color: theme.text }]}>Hello, {capitalize(user?.username) || 'Commander'}!</Text>
                    <Text style={[styles.greetingLabel, { color: theme.textSecondary }]}>Welcome to your smart home</Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                            setNotificationsVisible(true);
                        }}
                        style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border, position: 'relative' }]}
                    >
                        <Bell color={theme.textSecondary} size={20} />
                        {unreadBadge > 0 && (
                            <View style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: theme.danger, borderWidth: 1.5, borderColor: theme.card, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 }}>
                                <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{unreadBadge > 99 ? '99+' : unreadBadge}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {homes.length > 1 && (
                <View style={{ paddingHorizontal: 24, paddingBottom: 10 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 24 }}>
                        {homes.map((home: any) => {
                            const hId = home.homeId || home.id;
                            const isSelected = selectedHomeId === hId;
                            const hName = capitalize(home.name || home.home?.name) || `Home ${hId}`;

                            return (
                                <TouchableOpacity
                                    key={`home-${hId}`}
                                    style={[styles.filterChip, { backgroundColor: isSelected ? theme.primary + '20' : theme.card, borderColor: isSelected ? theme.primary : theme.border }]}
                                    onPress={() => {
                                        Haptics.selectionAsync().catch(() => { });
                                        handleHomeSelect(hId);
                                    }}
                                >
                                    <Text style={[styles.filterText, { color: isSelected ? theme.primary : theme.textSecondary }]}>{hName}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 4 }}>
                {categories.map((cat: any) => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.filterChip, { backgroundColor: activeCategory === cat ? theme.text : theme.card, borderColor: activeCategory === cat ? theme.text : theme.border }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                            setActiveCategory(cat);
                        }}
                    >
                        <Text style={[styles.filterText, { color: activeCategory === cat ? theme.background : theme.textSecondary, fontWeight: activeCategory === cat ? '700' : '500' }]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                <View style={styles.gridContainer}>
                    {loading ? (
                        <View style={styles.centerBox}>
                            <ActivityIndicator size="large" color={theme.primary} />
                        </View>
                    ) : filteredDevices.length > 0 ? (
                        filteredDevices.map((device) => (
                            <DeviceCard key={device.id} device={device} onToggle={handleToggle} />
                        ))
                    ) : (
                        <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border, width: '100%' }]}>
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No devices detected for this category.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Notifications Modal (using Activity log feed) */}
            <Modal visible={notificationsVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => { setNotificationsVisible(false); loadData(); }}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <NotificationCenterScreen onClose={() => { setNotificationsVisible(false); loadData(); }} />
                </View>
            </Modal>

            {/* Smart Assistant Overlay Setup */}
            <AssistantModal
                isVisible={aiVisible}
                onClose={() => {
                    setAiVisible(false);
                    loadData(); // refreshing devices just in case AI altered them
                }}
                homeId={selectedHomeId}
            />

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.accent || theme.primary, shadowColor: theme.accentGlow || theme.primaryGlow }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                    setAiVisible(true);
                }}
            >
                <Bot color={theme.background} size={28} />
            </TouchableOpacity>

        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', width: '100%' },
    header: {
        paddingTop: 64,
        paddingBottom: 16,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: { justifyContent: 'center' },
    greetingLabel: { fontSize: 14, fontWeight: '500', opacity: 0.8, marginTop: 4 },
    userName: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
    headerRight: { flexDirection: 'row', gap: 10 },
    iconBtn: { padding: 10, borderRadius: 20, borderWidth: 1 },

    scrollArea: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
    gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    centerBox: { width: '100%', justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },
    emptyBox: { backgroundColor: '#1e293b', borderRadius: 20, padding: 30, borderWidth: 1, borderColor: '#334155', alignItems: 'center', marginVertical: 40 },
    emptyText: { color: '#9ca3af', textAlign: 'center', fontSize: 16, lineHeight: 24 },

    filterScroll: { maxHeight: 55, minHeight: 55 },
    filterChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 24, backgroundColor: '#1C1C1E', marginRight: 12, borderWidth: 1, borderColor: '#27272A' },
    filterText: { color: '#9ca3af', fontWeight: '500' },

    // Grid Card Styles
    cardWrapper: { width: '47.5%', marginBottom: 16 },
    cardContent: {
        borderRadius: 24,
        padding: 16,
        paddingTop: 20,
        borderWidth: 1.5,
        justifyContent: 'space-between',
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    iconBox: { padding: 8, borderRadius: 16 },
    pillToggle: { width: 34, height: 20, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 2 },
    pillNub: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#FFFFFF' },

    deviceName: { color: '#ffffff', fontWeight: '800', fontSize: 16, marginBottom: 2 },
    deviceSub: { color: '#94a3b8', fontSize: 12 },

    fab: {
        position: 'absolute',
        bottom: 25,
        alignSelf: 'center',
        width: 66,
        height: 66,
        borderRadius: 33,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 10,
        zIndex: 100
    }
});
