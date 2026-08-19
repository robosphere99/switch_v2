import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Clock, Trash2, Power } from 'lucide-react-native';
import { getHomes, getSchedules, deleteSchedule } from '../api/hardware';
import * as Haptics from 'expo-haptics';

export function AutomationsScreen() {
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [homeId, setHomeId] = useState<number | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            const homesRes = await getHomes();
            if (homesRes.success && homesRes.data.length > 0) {
                const activeHome = homesRes.data[0].homeId || homesRes.data[0].id;
                setHomeId(activeHome);

                const schedRes = await getSchedules(activeHome);
                if (schedRes.success) {
                    setSchedules(schedRes.data);
                }
            }
        } catch (e) {
            console.log('Failed to fetch routines', e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (scheduleId: number) => {
        if (!homeId) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        Alert.alert("Remove Routine", "Are you sure you want to stop this automation?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Delete",
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteSchedule(homeId, scheduleId);
                        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                    } catch (e) {
                        Alert.alert("Error", "Could not delete this routine.");
                    }
                }
            }
        ])
    };

    const getRelativeTimeString = (runAt: string) => {
        const d = new Date(runAt);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' on ' + d.toLocaleDateString();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerIconContainer}>
                    <Clock color="#ffffff" size={24} />
                </View>
                <Text style={styles.pageTitle}>Routines & Timers</Text>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color="#3b82f6" />
                    </View>
                ) : schedules.length > 0 ? (
                    schedules.map((sched) => (
                        <View key={sched.id} style={styles.card}>
                            <View style={styles.cardInfo}>
                                <Text style={styles.deviceTarget}>
                                    {sched.device?.name || `Device #${sched.deviceId}`}
                                </Text>

                                <View style={styles.badgeRow}>
                                    <View style={[styles.badge, sched.action === 'on' ? styles.badgeON : styles.badgeOFF]}>
                                        <Power color={sched.action === 'on' ? '#ffffff' : '#9ca3af'} size={12} style={{ marginRight: 4 }} />
                                        <Text style={[styles.badgeText, sched.action === 'on' ? styles.badgeTextON : styles.badgeTextOFF]}>
                                            TURN {sched.action.toUpperCase()}
                                        </Text>
                                    </View>
                                    <View style={styles.badgeNeutral}>
                                        <Text style={styles.badgeTextNeutral}>
                                            {sched.type === 'once' ? 'ONE-TIME' : sched.type.toUpperCase()}
                                        </Text>
                                    </View>
                                </View>

                                <Text style={styles.scheduleTime}>
                                    {sched.type === 'once' && sched.runAt ? `Scheduled for ${getRelativeTimeString(sched.runAt)}` : ''}
                                    {sched.type === 'cron' ? `Cron Trigger: ${sched.cron}` : ''}
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(sched.id)}>
                                <Trash2 color="#f87171" size={20} />
                            </TouchableOpacity>
                        </View>
                    ))
                ) : (
                    <View style={styles.emptyBox}>
                        <Clock color="#475569" size={48} style={{ marginBottom: 16 }} />
                        <Text style={styles.emptyText}>No Active Automations</Text>
                        <Text style={styles.emptySub}>Set up timers and recurring routines from the Command Center Web Dashboard.</Text>
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
        paddingTop: 64,
        paddingBottom: 24,
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerIconContainer: { backgroundColor: '#3b82f6', padding: 12, borderRadius: 24, marginRight: 16 },
    pageTitle: { color: '#f8fafc', fontSize: 26, fontWeight: '900' },
    scrollArea: { flex: 1, paddingHorizontal: 24, paddingTop: 8 },
    centerBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 100 },

    card: {
        backgroundColor: '#1e293b',
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: '#334155',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardInfo: { flex: 1 },
    deviceTarget: { color: '#ffffff', fontSize: 18, fontWeight: '800', marginBottom: 10 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginRight: 8 },
    badgeON: { backgroundColor: '#2563eb' },
    badgeOFF: { backgroundColor: '#334155' },
    badgeText: { fontSize: 11, fontWeight: '800' },
    badgeTextON: { color: '#ffffff' },
    badgeTextOFF: { color: '#94a3b8' },
    badgeNeutral: { backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badgeTextNeutral: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
    scheduleTime: { color: '#9ca3af', fontSize: 13, marginTop: 4 },

    deleteBtn: { padding: 12, backgroundColor: '#451a20', borderRadius: 16 },

    emptyBox: { backgroundColor: '#1e293b', borderRadius: 24, padding: 40, borderWidth: 1, borderColor: '#334155', alignItems: 'center', marginVertical: 40 },
    emptyText: { color: '#ffffff', fontSize: 20, fontWeight: '800', marginBottom: 12 },
    emptySub: { color: '#9ca3af', textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
