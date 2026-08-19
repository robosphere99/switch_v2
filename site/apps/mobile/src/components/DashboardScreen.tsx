import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Animated } from 'react-native';
import { LogOut, Home as HomeIcon, Zap } from 'lucide-react-native';
import { getHomes, getDevices, toggleDevice } from '../api/hardware';
import * as Haptics from 'expo-haptics';

const DeviceCard = ({ device, onToggle }: { device: any, onToggle: (id: number, status: string) => void }) => {
    const isON = device.status === 'on';

    // Animation References
    const animScale = useRef(new Animated.Value(1)).current;
    const animGlow = useRef(new Animated.Value(isON ? 1 : 0)).current;

    // React to status changes securely
    useEffect(() => {
        Animated.timing(animGlow, {
            toValue: isON ? 1 : 0,
            duration: 350,
            useNativeDriver: false, // Color interpolation requires JS driver
        }).start();
    }, [isON]);

    const handlePress = () => {
        // Premium physical tactile feel when pressing the smart switch
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

        // Bubble scale visual effect
        Animated.sequence([
            Animated.timing(animScale, { toValue: 0.94, duration: 100, useNativeDriver: true }),
            Animated.timing(animScale, { toValue: 1, duration: 150, useNativeDriver: true }),
        ]).start();

        onToggle(device.id, device.status);
    };

    // Color dynamic blending arrays
    const bgColor = animGlow.interpolate({
        inputRange: [0, 1],
        outputRange: ['#1e293b', '#1e3a8a'] // from slate-800 to deep-blue-900 glow
    });
    const borderColor = animGlow.interpolate({
        inputRange: [0, 1],
        outputRange: ['#334155', '#60a5fa'] // slate-700 to bright neon blue
    });
    const shadowOpacity = animGlow.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.4]
    });

    return (
        <Animated.View style={[styles.cardWrapper, { transform: [{ scale: animScale }] }]}>
            <TouchableOpacity activeOpacity={0.8} onPress={handlePress}>
                <Animated.View style={[
                    styles.cardContent,
                    { backgroundColor: bgColor, borderColor: borderColor, shadowOpacity: shadowOpacity }
                ]}>
                    <View>
                        <Text style={styles.deviceName}>{device.name}</Text>
                        <Text style={styles.deviceSub}>
                            {device.type?.toUpperCase()} • {device.room?.name || 'Home'}
                        </Text>
                    </View>
                    <View style={[styles.iconWrapper, isON ? styles.iconWrapperON : styles.iconWrapperOFF]}>
                        <Zap color={isON ? '#ffffff' : '#9ca3af'} fill={isON ? '#ffffff' : 'transparent'} size={24} />
                    </View>
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
    );
};

export function DashboardScreen({ user, onLogout }: { user: any, onLogout: () => void }) {
    const [loading, setLoading] = useState(true);
    const [homes, setHomes] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
    const [activeCategory, setActiveCategory] = useState<string>('All');

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

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconContainer}>
                        <HomeIcon color="#ffffff" size={20} />
                    </View>
                    <View>
                        <Text style={styles.dashboardLabel}>Dashboard</Text>
                        <Text style={styles.userName}>{user?.username || 'User'}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
                    <LogOut color="#f87171" size={20} />
                </TouchableOpacity>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll} contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}>
                {categories.map((cat: any) => (
                    <TouchableOpacity
                        key={cat}
                        style={[styles.filterChip, activeCategory === cat && styles.filterChipActive]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                            setActiveCategory(cat);
                        }}
                    >
                        <Text style={[styles.filterText, activeCategory === cat && styles.filterTextActive]}>{cat}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionTitle}>My Devices</Text>

                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                    </View>
                ) : filteredDevices.length > 0 ? (
                    filteredDevices.map((device) => (
                        <DeviceCard key={device.id} device={device} onToggle={handleToggle} />
                    ))
                ) : (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>No devices detected for this category.</Text>
                    </View>
                )}
                <View style={{ height: 120 }} />
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', width: '100%' },
    header: {
        paddingTop: 56,
        paddingBottom: 20,
        paddingHorizontal: 24,
        backgroundColor: '#0f172a',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    headerIconContainer: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 24, marginRight: 14 },
    dashboardLabel: { color: '#9ca3af', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5 },
    userName: { color: '#f8fafc', fontSize: 20, fontWeight: '800' },
    logoutButton: { padding: 10, borderRadius: 16, backgroundColor: '#1e293b' },
    scrollArea: { flex: 1, paddingHorizontal: 24, paddingTop: 12 },
    sectionTitle: { color: '#ffffff', fontSize: 24, fontWeight: '900', marginBottom: 20 },
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
    iconWrapperOFF: { backgroundColor: '#334155' }
});
