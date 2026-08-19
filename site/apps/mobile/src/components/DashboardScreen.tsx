import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Animated, Image, PanResponder, Dimensions } from 'react-native';
import { LogOut, Home as HomeIcon, Zap, Shield, Wifi, User, Activity, Bot } from 'lucide-react-native';
import { getHomes, getDevices, toggleDevice } from '../api/hardware';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';
import { AssistantModal } from './AssistantModal';

const DeviceCard = ({ device, onToggle }: { device: any, onToggle: (id: number, status: string) => void }) => {
    const { theme } = useTheme();
    const isON = device.status === 'on';

    // Animation References
    const animScale = useRef(new Animated.Value(1)).current;
    const animGlow = useRef(new Animated.Value(isON ? 1 : 0)).current;
    const fillAnim = useRef(new Animated.Value(isON ? 1 : 0)).current;
    const panX = useRef(new Animated.Value(0)).current;
    const screenWidth = Dimensions.get('window').width;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(animGlow, { toValue: isON ? 1 : 0, duration: 300, useNativeDriver: false }),
            Animated.timing(fillAnim, { toValue: isON ? 1 : 0, duration: 500, useNativeDriver: false })
        ]).start();
    }, [isON]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 15,
            onPanResponderGrant: () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                Animated.timing(animScale, { toValue: 0.95, duration: 150, useNativeDriver: true }).start();
            },
            onPanResponderMove: Animated.event([null, { dx: panX }], { useNativeDriver: false }),
            onPanResponderRelease: (_, gestureState) => {
                Animated.timing(animScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();

                if (gestureState.dx > 80 && !isON) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                    onToggle(device.id, device.status);
                } else if (gestureState.dx < -80 && isON) {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                    onToggle(device.id, device.status);
                }
                Animated.spring(panX, { toValue: 0, bounciness: 12, useNativeDriver: false }).start();
            }
        })
    ).current;

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
        outputRange: [theme.card, theme.card === '#1e293b' ? '#0f172a' : theme.card]
    });

    const borderColor = animGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [theme.border, theme.primary]
    });

    const fillWidth = fillAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%']
    });

    const swipeTranslate = panX.interpolate({
        inputRange: [-screenWidth, screenWidth],
        outputRange: [-screenWidth, screenWidth],
        extrapolate: 'clamp'
    });

    return (
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: animScale }, { translateX: swipeTranslate }] }]} {...panResponder.panHandlers}>
            <TouchableOpacity activeOpacity={1} onPress={handlePress} delayPressIn={100}>
                <Animated.View style={[
                    styles.cardContent,
                    { backgroundColor: bgColor, borderColor: borderColor, overflow: 'hidden' }
                ]}>
                    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.primary, opacity: 0.15, width: fillWidth }]} />
                    <View style={{ zIndex: 1 }}>
                        <Text style={[styles.deviceName, { color: theme.text }]}>{device.name}</Text>
                        <Text style={[styles.deviceSub, { color: theme.textSecondary }]}>
                            {device.type?.toUpperCase()} • {device.room?.name || 'Home'}
                        </Text>
                    </View>
                    <View style={[
                        styles.iconWrapper,
                        isON ? { backgroundColor: theme.primary, shadowColor: theme.primary, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 } : { backgroundColor: theme.border },
                        { zIndex: 1 }
                    ]}>
                        <Zap color={isON ? '#ffffff' : theme.textSecondary} fill={isON ? '#ffffff' : 'transparent'} size={24} />
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

    useEffect(() => {
        loadData();
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
        } catch (e: any) {
            console.log('Failed to fetch data', e);
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

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <View style={styles.headerLeft}>
                    <Text style={[styles.greetingLabel, { color: theme.textSecondary }]}>{greeting},</Text>
                    <Text style={[styles.userName, { color: theme.text }]}>{user?.username || 'Commander'}</Text>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={[styles.iconBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => Alert.alert("System Health", "All SwitchNest Micro-services are fully operational.")}>
                        <Activity color={theme.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onLogout} style={[styles.iconBtn, { backgroundColor: theme.danger + '20', borderColor: theme.danger + '40' }]}>
                        <LogOut color={theme.danger} size={20} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.filterScroll, { borderBottomColor: theme.border }]} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}>
                {categories.map((cat: any) => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.filterChip, { backgroundColor: activeCategory === cat ? theme.primary : theme.card, borderColor: activeCategory === cat ? theme.primaryGlow : theme.border }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                            setActiveCategory(cat);
                        }}
                    >
                        <Text style={[styles.filterText, { color: activeCategory === cat ? '#ffffff' : theme.textSecondary }]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                <Text style={[styles.sectionTitle, { color: theme.text }]}>My Devices</Text>

                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : filteredDevices.length > 0 ? (
                    filteredDevices.map((device) => (
                        <DeviceCard key={device.id} device={device} onToggle={handleToggle} />
                    ))
                ) : (
                    <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No devices detected for this category.</Text>
                    </View>
                )}
                <View style={{ height: 120 }} />
            </ScrollView>

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
                style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primary }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                    setAiVisible(true);
                }}
            >
                <Bot color="#ffffff" size={28} />
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
    greetingLabel: { fontSize: 14, fontWeight: '700', letterSpacing: 0.5, marginBottom: 2 },
    userName: { fontSize: 26, fontWeight: '900', letterSpacing: -0.5 },
    headerRight: { flexDirection: 'row', gap: 10 },
    iconBtn: { padding: 10, borderRadius: 18, borderWidth: 1 },

    scrollArea: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
    sectionTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },
    emptyBox: { backgroundColor: '#1e293b', borderRadius: 20, padding: 30, borderWidth: 1, borderColor: '#334155', alignItems: 'center', marginVertical: 40 },
    emptyText: { color: '#9ca3af', textAlign: 'center', fontSize: 16, lineHeight: 24 },

    filterScroll: { maxHeight: 65, minHeight: 65, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    filterChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: '#1e293b', marginRight: 12, borderWidth: 1, borderColor: '#334155' },
    filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#60a5fa' },
    filterText: { color: '#9ca3af', fontWeight: 'bold' },
    filterTextActive: { color: '#ffffff' },

    // Custom Card Styles
    cardWrapper: { marginBottom: 18 },
    cardContent: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1.5,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        shadowColor: '#60a5fa',
        shadowOffset: { width: 0, height: 6 },
        shadowRadius: 16,
        elevation: 8,
    },
    deviceName: { color: '#ffffff', fontWeight: '800', fontSize: 18, marginBottom: 4 },
    deviceSub: { color: '#94a3b8', fontSize: 13 },
    iconWrapper: { padding: 14, borderRadius: 24 },
    iconWrapperON: {
        backgroundColor: '#3b82f6',
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10
    },
    iconWrapperOFF: { backgroundColor: '#334155' },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 24,
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 8,
        zIndex: 100
    }
});
