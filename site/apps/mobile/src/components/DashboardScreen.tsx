import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { LogOut, Home as HomeIcon, Zap } from 'lucide-react-native';
import { getHomes, getDevices, toggleDevice } from '../api/hardware';

export function DashboardScreen({ user, onLogout }: { user: any, onLogout: () => void }) {
    const [loading, setLoading] = useState(true);
    const [homes, setHomes] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);

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

        // Fast Optimistic Update
        const newStatus = currentStatus === 'on' ? 'off' : 'on';
        setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: newStatus } : d));

        try {
            await toggleDevice(selectedHomeId, deviceId, newStatus);
        } catch (e: any) {
            Alert.alert('Control Error', e.message || 'Failed to toggle device. Connection issues.');
            // Revert if API fails
            setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, status: currentStatus } : d));
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <View style={styles.iconContainer}>
                        <HomeIcon color="#ffffff" size={20} />
                    </View>
                    <View>
                        <Text style={styles.dashboardLabel}>Dashboard</Text>
                        <Text style={styles.userName}>{user?.username || 'User'}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
                    <LogOut color="#ffffff" size={18} />
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollArea}>
                <Text style={styles.sectionTitle}>My Devices</Text>

                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                    </View>
                ) : devices.length > 0 ? (
                    devices.map((device) => (
                        <View key={device.id} style={styles.deviceCard}>
                            <View>
                                <Text style={styles.deviceName}>{device.name}</Text>
                                <Text style={styles.deviceSub}>
                                    {device.type?.toUpperCase()} • {device.room?.name || 'Home'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => handleToggle(device.id, device.status)}
                                style={[
                                    styles.toggleButton,
                                    device.status === 'on' ? styles.toggleOn : styles.toggleOff
                                ]}
                            >
                                <Zap color={device.status === 'on' ? '#ffffff' : '#9ca3af'} size={20} />
                            </TouchableOpacity>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyBox}>
                        <Text style={styles.emptyText}>No devices detected in this home. Check backend logs.</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a', width: '100%' },
    header: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 24, backgroundColor: '#1e293b', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#334155' },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    iconContainer: { backgroundColor: '#3b82f6', padding: 8, borderRadius: 24, marginRight: 12 },
    dashboardLabel: { color: '#9ca3af', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1 },
    userName: { color: '#ffffff', fontSize: 18, fontWeight: 'bold' },
    logoutButton: { padding: 8, borderRadius: 8, backgroundColor: '#ef4444', borderWidth: 1, borderColor: '#f87171' },
    scrollArea: { flex: 1, paddingHorizontal: 24, paddingTop: 24 },
    sectionTitle: { color: '#ffffff', fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 80 },
    emptyBox: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155', alignItems: 'center', paddingVertical: 40 },
    emptyText: { color: '#9ca3af', textAlign: 'center' },
    deviceCard: { backgroundColor: '#1e293b', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#334155', marginBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    deviceName: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
    deviceSub: { color: '#9ca3af', fontSize: 12, marginTop: 4 },
    toggleButton: { padding: 12, borderRadius: 24, borderWidth: 1 },
    toggleOn: { backgroundColor: '#10b981', borderColor: '#34d399' },
    toggleOff: { backgroundColor: '#334155', borderColor: '#475569' }
});
