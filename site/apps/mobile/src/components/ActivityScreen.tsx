import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, ScrollView } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { getHomes, getHomeActivity, getDevices, getHomeMembers } from '../api/hardware';
import * as Haptics from 'expo-haptics';
import { Clock, Zap, Power, AlertCircle, Filter, Calendar, User } from 'lucide-react-native';

export function ActivityScreen() {
    const { theme } = useTheme();
    const [homes, setHomes] = useState<any[]>([]);
    const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
    const [devices, setDevices] = useState<any[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<number | null>(null);
    const [members, setMembers] = useState<any[]>([]);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [selectedTimeRange, setSelectedTimeRange] = useState<string>("");
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        loadHomes();
    }, []);

    const loadHomes = async () => {
        setLoading(true);
        const homesRes = await getHomes();
        if (homesRes.success && homesRes.data.length > 0) {
            const adminHomes = homesRes.data.filter((h: any) => {
                const role = h.role || (h.members && h.members[0] && h.members[0].role);
                return role === 'admin' || role === 'owner' || role === 'system_admin';
            });
            setHomes(adminHomes);

            if (adminHomes.length > 0) {
                const initialHomeId = adminHomes[0].homeId || adminHomes[0].id;
                setSelectedHomeId(initialHomeId);
                await fetchDevices(initialHomeId);
                await fetchMembers(initialHomeId);
                await fetchLogs(initialHomeId, null, null, "");
            }
        }
        setLoading(false);
    };

    const fetchDevices = async (homeId: number) => {
        const res = await getDevices(homeId);
        if (res.success) {
            setDevices(res.data);
        }
    }

    const fetchMembers = async (homeId: number) => {
        const res = await getHomeMembers(homeId);
        if (res.success) {
            setMembers(res.data);
        }
    };

    const fetchLogs = async (homeId: number, deviceId: number | null, userId: number | null, timeRange: string) => {
        const logRes = await getHomeActivity(homeId, 50, deviceId || undefined, userId || undefined, timeRange);
        if (logRes.success && logRes.data) {
            const logsArray = Array.isArray(logRes.data) ? logRes.data : logRes.data.data;
            if (Array.isArray(logsArray)) {
                setLogs(logsArray);
            }
        }
    };

    const onRefresh = async () => {
        if (!selectedHomeId) return;
        setRefreshing(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        await fetchDevices(selectedHomeId);
        await fetchMembers(selectedHomeId);
        await fetchLogs(selectedHomeId, selectedDeviceId, selectedUserId, selectedTimeRange);
        setRefreshing(false);
    };

    const capitalize = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : '';

    const renderLogItem = ({ item }: { item: any }) => {
        const timeStr = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateStr = new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });

        let ActionIcon = Zap;
        let iconColor = theme.primary;

        if (item.logMessage.toLowerCase().includes('turned on')) {
            ActionIcon = Power;
            iconColor = '#10b981'; // Green
        } else if (item.logMessage.toLowerCase().includes('turned off')) {
            ActionIcon = Power;
            iconColor = '#ef4444'; // Red
        } else if (item.logType === 'error') {
            ActionIcon = AlertCircle;
            iconColor = '#f59e0b'; // Orange
        }

        return (
            <View style={[styles.logCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[styles.iconContainer, { backgroundColor: iconColor + '20' }]}>
                    <ActionIcon color={iconColor} size={20} />
                </View>
                <View style={styles.logContent}>
                    <Text style={[styles.logMessage, { color: theme.text }]}>
                        <Text style={{ fontWeight: 'bold' }}>{capitalize(item.actor?.username || 'System')}</Text> {item.logMessage.replace('Device status changed to', 'turned')} <Text style={{ fontWeight: '600' }}>{item.device?.name || 'Device'}</Text>
                    </Text>
                    <View style={styles.timeContainer}>
                        <Clock color={theme.textSecondary} size={12} style={{ marginRight: 4 }} />
                        <Text style={[styles.logTime, { color: theme.textSecondary }]}>{dateStr} at {timeStr}</Text>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.background }]}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Activity Timeline</Text>
                <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>Audit log of all hardware interactions</Text>
            </View>

            {homes.length > 1 && (
                <View style={styles.homeSelector}>
                    {homes.map((home: any) => {
                        const hId = home.homeId || home.id;
                        const isSelected = selectedHomeId === hId;
                        const hName = capitalize(home.name || home.home?.name) || `Home ${hId}`;
                        return (
                            <TouchableOpacity
                                key={`history-home-${hId}`}
                                style={[styles.filterChip, { backgroundColor: isSelected ? theme.primary + '20' : theme.card, borderColor: isSelected ? theme.primary : theme.border }]}
                                onPress={() => {
                                    Haptics.selectionAsync().catch(() => { });
                                    setSelectedHomeId(hId);
                                    setSelectedDeviceId(null);
                                    setSelectedUserId(null);
                                    setSelectedTimeRange("");
                                    fetchDevices(hId);
                                    fetchMembers(hId);
                                    fetchLogs(hId, null, null, "");
                                }}
                            >
                                <Text style={[styles.filterText, { color: isSelected ? theme.primary : theme.textSecondary, fontWeight: isSelected ? '600' : '400' }]}>{hName}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {devices.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 24, marginBottom: 12 }}>
                        <Filter color={theme.textSecondary} size={16} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginLeft: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Advanced Filters</Text>
                    </View>

                    {/* Time Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ paddingHorizontal: 24, paddingRight: 40, gap: 10 }}>
                        <View style={{ justifyContent: 'center', marginRight: 2 }}><Calendar color={theme.textSecondary} size={14} /></View>
                        {['', '24h', '7d', '30d'].map(t => {
                            const isSelected = selectedTimeRange === t;
                            const label = t === '' ? 'Any Time' : t === '24h' ? 'Last 24h' : t === '7d' ? 'Last 7 Days' : 'Last 30 Days';
                            return (
                                <TouchableOpacity key={`time-${t}`} style={[styles.filterChip, { backgroundColor: isSelected ? theme.primary + '20' : theme.card, borderColor: isSelected ? theme.primary : theme.border }]} onPress={() => { setSelectedTimeRange(t); if (selectedHomeId) fetchLogs(selectedHomeId, selectedDeviceId, selectedUserId, t); }}>
                                    <Text style={[styles.filterText, { color: isSelected ? theme.primary : theme.textSecondary, fontWeight: isSelected ? '600' : '400' }]}>{label}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>

                    {/* Member Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }} contentContainerStyle={{ paddingHorizontal: 24, paddingRight: 40, gap: 10 }}>
                        <View style={{ justifyContent: 'center', marginRight: 2 }}><User color={theme.textSecondary} size={14} /></View>
                        <TouchableOpacity style={[styles.filterChip, { backgroundColor: selectedUserId === null ? theme.primary + '20' : theme.card, borderColor: selectedUserId === null ? theme.primary : theme.border }]} onPress={() => { setSelectedUserId(null); if (selectedHomeId) fetchLogs(selectedHomeId, selectedDeviceId, null, selectedTimeRange); }}>
                            <Text style={[styles.filterText, { color: selectedUserId === null ? theme.primary : theme.textSecondary, fontWeight: selectedUserId === null ? '600' : '400' }]}>Everyone</Text>
                        </TouchableOpacity>
                        {members.map((m: any) => {
                            const isSelected = selectedUserId === m.userId;
                            return (
                                <TouchableOpacity key={`user-${m.userId}`} style={[styles.filterChip, { backgroundColor: isSelected ? theme.primary + '20' : theme.card, borderColor: isSelected ? theme.primary : theme.border }]} onPress={() => { setSelectedUserId(m.userId); if (selectedHomeId) fetchLogs(selectedHomeId, selectedDeviceId, m.userId, selectedTimeRange); }}>
                                    <Text style={[styles.filterText, { color: isSelected ? theme.primary : theme.textSecondary, fontWeight: isSelected ? '600' : '400' }]}>{capitalize(m.user?.username || 'Unknown')}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>

                    {/* Device Filter */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, paddingRight: 40, gap: 10 }}>
                        <View style={{ justifyContent: 'center', marginRight: 2 }}><Zap color={theme.textSecondary} size={14} /></View>
                        <TouchableOpacity style={[styles.filterChip, { backgroundColor: selectedDeviceId === null ? theme.primary + '20' : theme.card, borderColor: selectedDeviceId === null ? theme.primary : theme.border }]} onPress={() => { setSelectedDeviceId(null); if (selectedHomeId) fetchLogs(selectedHomeId, null, selectedUserId, selectedTimeRange); }}>
                            <Text style={[styles.filterText, { color: selectedDeviceId === null ? theme.primary : theme.textSecondary, fontWeight: selectedDeviceId === null ? '600' : '400' }]}>All Hardware</Text>
                        </TouchableOpacity>
                        {devices.map((device: any) => {
                            const isSelected = selectedDeviceId === device.id;
                            return (
                                <TouchableOpacity key={`dev-${device.id}`} style={[styles.filterChip, { backgroundColor: isSelected ? theme.primary + '20' : theme.card, borderColor: isSelected ? theme.primary : theme.border }]} onPress={() => { setSelectedDeviceId(device.id); if (selectedHomeId) fetchLogs(selectedHomeId, device.id, selectedUserId, selectedTimeRange); }}>
                                    <Text style={[styles.filterText, { color: isSelected ? theme.primary : theme.textSecondary, fontWeight: isSelected ? '600' : '400' }]}>{capitalize(device.name)}</Text>
                                </TouchableOpacity>
                            )
                        })}
                    </ScrollView>
                </View>
            )}

            {loading ? (
                <View style={styles.centerBox}>
                    <ActivityIndicator size="large" color={theme.primary} />
                </View>
            ) : (
                <FlatList
                    data={logs}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderLogItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
                    ListEmptyComponent={
                        <View style={styles.emptyBox}>
                            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No activity recorded yet for this home.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 },
    headerTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 4 },
    headerSubtitle: { fontSize: 14 },
    homeSelector: { flexDirection: 'row', paddingHorizontal: 24, marginBottom: 16, flexWrap: 'wrap', gap: 10 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
    filterText: { fontSize: 14 },
    listContent: { paddingHorizontal: 24, paddingBottom: 100 },
    logCard: { flexDirection: 'row', padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12, alignItems: 'center' },
    iconContainer: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    logContent: { flex: 1 },
    logMessage: { fontSize: 15, lineHeight: 22, paddingBottom: 4 },
    timeContainer: { flexDirection: 'row', alignItems: 'center' },
    logTime: { fontSize: 12 },
    centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    emptyBox: { padding: 40, alignItems: 'center' },
    emptyText: { textAlign: 'center', fontSize: 15 },
});
