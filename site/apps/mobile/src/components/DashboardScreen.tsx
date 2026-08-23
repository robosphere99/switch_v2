import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Animated, Image, PanResponder, Dimensions, Modal, DeviceEventEmitter, TextInput, Platform, KeyboardAvoidingView } from 'react-native';
import { LogOut, Home as HomeIcon, Zap, Shield, Wifi, User, Activity, Bot, Bell, Plus, Trash2, Edit3, X } from 'lucide-react-native';
import { getHomes, getDevices, toggleDevice, getRooms, createDevice, deleteDeviceApi, createRoom, deleteRoomApi, updateDeviceApi } from '../api/hardware';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';
import { AssistantModal } from './AssistantModal';
import { NotificationCenterScreen } from './NotificationCenterScreen';
import { MembersScreen } from './MembersScreen';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useThemedAlert } from './ThemedAlert';

import { api, API_URL } from '../api/client';

const API_BASE = API_URL.replace(/\/api$/, '');

const DEVICE_EMOJIS: Record<string, string> = {
    bulb: '💡',
    fan: '🌀',
    tv: '📺',
    ac: '❄️',
    plug: '🔌',
    custom: '⚙️'
};

const GLOW_COLORS: Record<string, string> = {
    bulb: '#facc15', // yellow-400
    tv: '#f472b6',   // pink-400
    fan: '#38bdf8',  // sky-400
    ac: '#a78bfa',   // violet-400
    plug: '#34d399', // emerald-400
    custom: '#fb923c' // orange-400
};

const DeviceCard = ({
    device,
    isBlocked,
    canManage,
    onToggle,
    onEdit,
    onDelete,
    onLongPress
}: {
    device: any,
    isBlocked?: boolean,
    canManage?: boolean,
    onToggle: (id: number, status: string) => void,
    onEdit?: (device: any) => void,
    onDelete?: (device: any) => void,
    onLongPress: (device: any) => void
}) => {
    const { theme } = useTheme();
    const isON = device.status === 'on';
    const typeKey = device.type?.toLowerCase() || 'custom';
    const activeColor = GLOW_COLORS[typeKey] || theme.primary;

    // Animation References
    const animScale = useRef(new Animated.Value(1)).current;

    // Smooth interpolate for background and border glow
    const animGlow = useRef(new Animated.Value(isON ? 1 : 0)).current;
    useEffect(() => {
        Animated.timing(animGlow, { toValue: isON ? 1 : 0, duration: 400, useNativeDriver: false }).start();
    }, [isON]);

    const handlePress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        Animated.sequence([
            Animated.timing(animScale, { toValue: 0.94, duration: 100, useNativeDriver: true }),
            Animated.timing(animScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();
        onToggle(device.id, device.status);
    };

    const bgColor = animGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.card, 'rgba(21, 23, 26, 0.95)']
    });

    const borderColor = animGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.border, activeColor]
    });

    return (
        <Animated.View style={[
            { width: '48%', marginBottom: 16, height: 215 },
            { transform: [{ scale: animScale }], opacity: isBlocked ? 0.7 : 1 }
        ]}>
            <TouchableOpacity
                style={{ flex: 1 }}
                activeOpacity={0.9}
                disabled={isBlocked}
                onPress={handlePress}
                delayPressIn={100}
                onLongPress={() => onLongPress(device)}
            >
                <Animated.View style={[
                    {
                        flex: 1,
                        borderRadius: 20,
                        borderWidth: 2,
                        padding: 12,
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        overflow: 'hidden'
                    },
                    { backgroundColor: bgColor, borderColor: borderColor },
                    isON && { shadowColor: activeColor, shadowOpacity: 0.4, shadowRadius: 15, elevation: 10 }
                ]}>

                    {/* Admin Actions (Top Right) */}
                    {canManage && (
                        <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6, zIndex: 10 }}>
                            {onDelete && (
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation(); onDelete(device); }}
                                    style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' }}
                                >
                                    <Trash2 color="#ffffff" size={14} />
                                </TouchableOpacity>
                            )}
                            {onEdit && (
                                <TouchableOpacity
                                    onPress={(e) => { e.stopPropagation(); onEdit(device); }}
                                    style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#3b82f6', justifyContent: 'center', alignItems: 'center' }}
                                >
                                    <Edit3 color="#ffffff" size={14} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Central 3D Glowing Emoji */}
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 10 }}>
                        <Text style={{
                            fontSize: 55,
                            opacity: isON ? 1 : 0.35,
                            textShadowColor: isON ? activeColor : 'transparent',
                            textShadowOffset: { width: 0, height: 0 },
                            textShadowRadius: isON ? 25 : 0
                        }}>
                            {DEVICE_EMOJIS[typeKey] || '⚙️'}
                        </Text>
                    </View>

                    {/* Meta Section */}
                    <View style={{ alignItems: 'center', width: '100%', marginTop: 4 }}>
                        <Text style={{
                            fontSize: 15,
                            fontWeight: 'bold',
                            color: '#ffffff',
                            textAlign: 'center',
                            marginBottom: 6
                        }} numberOfLines={1}>
                            {device.name}
                        </Text>

                        {/* ON/OFF Pill */}
                        <View style={{
                            backgroundColor: isON ? '#10b981' : '#4b5563',
                            paddingHorizontal: 16,
                            paddingVertical: 5,
                            borderRadius: 16,
                            shadowColor: isON ? '#10b981' : 'transparent',
                            shadowOpacity: 0.6,
                            shadowRadius: 8,
                            elevation: isON ? 5 : 0,
                            marginBottom: 8
                        }}>
                            <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13, letterSpacing: 1 }}>
                                {isON ? 'ON' : 'OFF'}
                            </Text>
                        </View>

                        <Text style={{ fontSize: 10, color: theme.textSecondary, fontWeight: 'bold', textTransform: 'uppercase' }}>
                            {device.room?.name || 'Home'}
                        </Text>
                    </View>

                    {/* Dim Overlay when blocked */}
                    {isBlocked && (
                        <View style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundColor: 'rgba(0,0,0,0.5)',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 20
                        }}>
                            <Text style={{ fontSize: 40 }}>🔒</Text>
                        </View>
                    )}
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export function DashboardScreen({ user, onLogout }: { user: any, onLogout: () => void }) {
    const { theme } = useTheme();
    const { showAlert, AlertComponent } = useThemedAlert();
    const [loading, setLoading] = useState(true);
    const [homes, setHomes] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [blockedDevices, setBlockedDevices] = useState<{ [deviceId: number]: boolean }>({});
    const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [aiVisible, setAiVisible] = useState(false);
    const [notificationsVisible, setNotificationsVisible] = useState(false);
    const [membersVisible, setMembersVisible] = useState(false);
    const [unreadBadge, setUnreadBadge] = useState(0);

    const [createVisible, setCreateVisible] = useState(false);
    const [createBusy, setCreateBusy] = useState(false);
    const [rooms, setRooms] = useState<any[]>([]);
    const [createData, setCreateData] = useState({ id: null as number | null, name: '', type: 'bulb', roomId: null as number | null });
    const [newRoomName, setNewRoomName] = useState('');
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{ visible: boolean; title: string; message: string; onConfirm: () => void }>({
        visible: false,
        title: '',
        message: '',
        onConfirm: () => { }
    });

    // Activates Native Push Notifications (Background Sync & Permission Handling)
    usePushNotifications();


    useEffect(() => {
        loadData();
        const syncSub = DeviceEventEmitter.addListener('notification_sync', async () => {
            try {
                const badgeRes = await api.get('/notifications/unread-count');
                if (badgeRes?.data?.data !== undefined) setUnreadBadge(badgeRes.data.data);
            } catch (e) { }
        });

        const deviceSyncSub = DeviceEventEmitter.addListener('device_sync', (payload) => {
            setDevices(prevDevices =>
                prevDevices.map(d =>
                    (d.id === payload.id) ? { ...d, status: payload.status, offline: payload.offline } : d
                )
            );
        });

        return () => {
            syncSub.remove();
            deviceSyncSub.remove();
        };
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
            // Revert if API fails
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: currentStatus } : d));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });

            if (e.status === 429 || (e.message && e.message.toLowerCase().includes('minute'))) {
                setBlockedDevices(prev => ({ ...prev, [deviceId]: true }));
                setTimeout(() => {
                    setBlockedDevices(prev => {
                        const next = { ...prev };
                        delete next[deviceId];
                        return next;
                    });
                }, 60000);
                showAlert('Safety Lock Engaged', e.message);
            } else {
                showAlert('Control Error', e.message || 'Failed to toggle device. Connection issues.');
            }
        }
    };

    const handleOpenCreate = async () => {
        if (!selectedHomeId) return;
        setCreateData({ id: null, name: '', type: 'bulb', roomId: null });
        setCreateVisible(true);
        try {
            const res = await getRooms(selectedHomeId);
            if (res.success) {
                setRooms(res.data);
                setCreateData({ id: null, name: '', type: 'bulb', roomId: res.data.length > 0 ? res.data[0].id : null });
            } else {
                setCreateData({ id: null, name: '', type: 'bulb', roomId: null });
            }
        } catch (e) {
            setCreateData({ id: null, name: '', type: 'bulb', roomId: null });
            console.log(e);
        }
    };

    const handleOpenEdit = async (device: any) => {
        if (!selectedHomeId) return;
        setCreateData({ id: device.id, name: device.name, type: device.type, roomId: device.roomId || null });
        setCreateVisible(true);
        try {
            const res = await getRooms(selectedHomeId);
            if (res.success) setRooms(res.data);
        } catch (e) {
            console.log(e);
        }
    };

    const submitCreateRoom = async () => {
        if (!selectedHomeId || !newRoomName.trim()) return;
        setCreatingRoom(true);
        try {
            const res = await createRoom(selectedHomeId, newRoomName.trim());
            if (res.success && res.data) {
                const rms = await getRooms(selectedHomeId);
                if (rms.success) setRooms(rms.data);
                setCreateData({ ...createData, roomId: res.data.id });
                setNewRoomName('');
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            }
        } catch (e: any) {
            showAlert('Room Creation Failed', e.message);
        } finally {
            setCreatingRoom(false);
        }
    };

    const handleDeleteRoom = (roomId: number, roomName: string) => {
        setConfirmModal({
            visible: true,
            title: "Delete Room",
            message: `Are you sure you want to delete ${roomName}? Devices in this room will NOT be deleted, they will just become unassigned.`,
            onConfirm: async () => {
                if (!selectedHomeId) return;
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
                try {
                    await deleteRoomApi(selectedHomeId, roomId);
                    setRooms(prev => prev.filter(r => r.id !== roomId));
                    if (createData.roomId === roomId) {
                        setCreateData({ ...createData, roomId: null });
                    }
                } catch (e: any) {
                    showAlert('Cannot delete room', e.message);
                }
            }
        });
    };

    const submitCreateDevice = async () => {
        if (!selectedHomeId || !createData.name) return;
        setCreateBusy(true);
        try {
            if (createData.id) {
                await updateDeviceApi(selectedHomeId, createData.id, createData);
                showAlert("Success", "Device updated successfully.");
            } else {
                await createDevice(selectedHomeId, createData);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            }
            setCreateVisible(false);
            loadData();
        } catch (e: any) {
            showAlert(createData.id ? 'Update Failed' : 'Creation Failed', e.message);
        } finally {
            setCreateBusy(false);
        }
    };

    const handleDeleteDevice = (device: any) => {
        setConfirmModal({
            visible: true,
            title: "Delete Device",
            message: `Are you sure you want to delete ${device.name}?`,
            onConfirm: async () => {
                if (!selectedHomeId) return;
                try {
                    await deleteDeviceApi(selectedHomeId, device.id);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
                    loadData();
                } catch (e: any) {
                    showAlert("Delete Failed", e.message);
                }
            }
        });
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

    const currentHome = homes.find(h => (h.homeId || h.id) === selectedHomeId);
    const canManage = currentHome && (currentHome.role === 'owner' || currentHome.role === 'admin');

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <View style={styles.headerLeft}>
                    {/* Avatar - opens Members/Family screen */}
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                            setMembersVisible(true);
                        }}
                        style={[styles.avatarBtn, { backgroundColor: theme.primary + '25', borderColor: theme.primary + '60', overflow: 'hidden' }]}
                    >
                        {user?.avatarUrl ? (
                            <Image source={{ uri: user.avatarUrl.startsWith('http') ? user.avatarUrl : API_BASE + user.avatarUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 16 }}>
                                {(user?.username || 'U').slice(0, 2).toUpperCase()}
                            </Text>
                        )}
                    </TouchableOpacity>
                    <View>
                        <Text style={[styles.userName, { color: theme.text }]}>Hello, {capitalize(user?.username) || 'Commander'}!</Text>
                        <Text style={[styles.greetingLabel, { color: theme.textSecondary }]}>Welcome to your smart home</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                            handleOpenCreate();
                        }}
                        style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                    >
                        <Plus color={theme.textSecondary} size={20} />
                    </TouchableOpacity>
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
                            const hName = capitalize(home.homeName || home.name || home.home?.name) || `Home ${hId}`;

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
                            <DeviceCard
                                key={device.id}
                                device={device}
                                isBlocked={!!blockedDevices[device.id]}
                                canManage={canManage}
                                onToggle={handleToggle}
                                onEdit={handleOpenEdit}
                                onDelete={handleDeleteDevice}
                                onLongPress={handleOpenEdit}
                            />
                        ))
                    ) : (
                        <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border, width: '100%' }]}>
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No devices detected for this category.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Members/Family Modal */}
            <Modal visible={membersVisible} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setMembersVisible(false)}>
                <View style={{ flex: 1, backgroundColor: theme.background }}>
                    <MembersScreen
                        homeId={selectedHomeId || 0}
                        myRole={homes.find(h => (h.homeId || h.id) === selectedHomeId)?.role ?? homes[0]?.role ?? 'member'}
                        homeList={homes}
                        onClose={() => setMembersVisible(false)}
                    />
                </View>
            </Modal>

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
                style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                    setAiVisible(true);
                }}
            >
                <Bot color={theme.background} size={28} />
            </TouchableOpacity>

            {/* Create Device Modal */}
            <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                        <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, borderColor: theme.border, borderWidth: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>{createData.id ? 'Edit Device' : 'Create New Device'}</Text>
                                <TouchableOpacity onPress={() => setCreateVisible(false)}>
                                    <X color={theme.textSecondary} size={24} />
                                </TouchableOpacity>
                            </View>

                            <Text style={{ color: theme.textSecondary, marginBottom: 8 }}>Device Name</Text>
                            <TextInput
                                style={[styles.inputField, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                                value={createData.name}
                                onChangeText={t => setCreateData({ ...createData, name: t })}
                                placeholder="e.g. Ceiling Light"
                                placeholderTextColor={theme.textSecondary}
                            />

                            <Text style={{ color: theme.textSecondary, marginBottom: 8, marginTop: 16 }}>Device Type</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {['bulb', 'fan', 'ac', 'tv', 'plug', 'dimmer', 'custom'].map(t => (
                                    <TouchableOpacity
                                        key={t}
                                        style={[styles.filterChip, { marginBottom: 12, backgroundColor: createData.type === t ? theme.primary + '20' : theme.card, borderColor: createData.type === t ? theme.primary : theme.border }]}
                                        onPress={() => setCreateData({ ...createData, type: t })}
                                    >
                                        <Text style={{ color: createData.type === t ? theme.primary : theme.textSecondary, textTransform: 'capitalize' }}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={{ color: theme.textSecondary, marginBottom: 8, marginTop: 12 }}>Select Room</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {rooms.length === 0 && (
                                    <Text style={{ color: theme.textSecondary, fontStyle: 'italic', marginLeft: 4 }}>No rooms found.</Text>
                                )}
                                {rooms.map(r => (
                                    <TouchableOpacity
                                        key={r.id}
                                        delayLongPress={400}
                                        style={[styles.filterChip, { marginBottom: 12, backgroundColor: createData.roomId === r.id ? theme.primary + '20' : theme.card, borderColor: createData.roomId === r.id ? theme.primary : theme.border }]}
                                        onPress={() => setCreateData({ ...createData, roomId: r.id })}
                                        onLongPress={() => {
                                            Haptics.selectionAsync().catch(() => { });
                                            handleDeleteRoom(r.id, r.name);
                                        }}
                                    >
                                        <Text style={{ color: createData.roomId === r.id ? theme.primary : theme.textSecondary }}>{r.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, marginBottom: 16 }}>
                                <TextInput
                                    style={[styles.inputField, { flex: 1, paddingVertical: 10, paddingHorizontal: 12, color: theme.text, borderColor: theme.border, backgroundColor: theme.card, borderRadius: 8, fontSize: 14 }]}
                                    value={newRoomName}
                                    onChangeText={setNewRoomName}
                                    placeholder="New room name..."
                                    placeholderTextColor={theme.textSecondary}
                                />
                                <TouchableOpacity
                                    style={{ backgroundColor: theme.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, marginLeft: 8, opacity: (!newRoomName.trim() || creatingRoom) ? 0.5 : 1 }}
                                    onPress={submitCreateRoom}
                                    disabled={creatingRoom || !newRoomName.trim()}
                                >
                                    {creatingRoom ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Add</Text>}
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.submitButton, { backgroundColor: theme.primary, opacity: (!createData.name || createBusy) ? 0.5 : 1, marginBottom: createData.id ? 12 : 0 }]}
                                disabled={!createData.name || createBusy}
                                onPress={submitCreateDevice}
                            >
                                {createBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{createData.id ? 'Save Changes' : 'Create Device'}</Text>}
                            </TouchableOpacity>

                            {createData.id && (
                                <TouchableOpacity
                                    style={[styles.submitButton, { backgroundColor: theme.card, borderColor: theme.danger, borderWidth: 1 }]}
                                    onPress={() => {
                                        setCreateVisible(false);
                                        handleDeleteDevice({ id: createData.id, name: createData.name });
                                    }}
                                >
                                    <Text style={{ color: theme.danger || '#ef4444', fontSize: 16, fontWeight: 'bold' }}>Delete Device</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Custom Confirm Modal */}
            <Modal visible={confirmModal.visible} transparent animationType="fade" onRequestClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 }}>
                    <View style={{ backgroundColor: theme.background, borderRadius: 24, padding: 24, borderColor: theme.border, borderWidth: 1 }}>
                        <Text style={{ color: theme.text, fontSize: 20, fontWeight: 'bold', marginBottom: 12 }}>{confirmModal.title}</Text>
                        <Text style={{ color: theme.textSecondary, fontSize: 16, lineHeight: 24, marginBottom: 24 }}>{confirmModal.message}</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                            <TouchableOpacity
                                style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.card }}
                                onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                            >
                                <Text style={{ color: theme.text, fontWeight: 'bold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={{ paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, backgroundColor: theme.danger || '#ef4444' }}
                                onPress={() => {
                                    setConfirmModal(prev => ({ ...prev, visible: false }));
                                    confirmModal.onConfirm();
                                }}
                            >
                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
            {AlertComponent}
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
    headerLeft: { justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
    avatarBtn: {
        width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5
    },
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
    },

    inputField: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 14,
        fontSize: 16,
    },
    submitButton: {
        marginTop: 24,
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Platform.OS === 'ios' ? 20 : 0
    }
});
