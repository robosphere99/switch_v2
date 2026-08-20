import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { Clock, Trash2, Power } from 'lucide-react-native';
import { getHomes, getSchedules, deleteSchedule } from '../api/hardware';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';

export function AutomationsScreen() {
    const { theme } = useTheme();
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
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <View style={[styles.headerIconContainer, { backgroundColor: theme.primary }]}>
                    <Clock color="#ffffff" size={24} />
                </View>
                <Text style={[styles.pageTitle, { color: theme.text }]}>Routines & Timers</Text>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : schedules.length > 0 ? (
                    schedules.map((sched) => (
                        <View key={sched.id} style={[styles.cardContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            {/* Tone 1: Left Action Edge */}
                            <View style={[styles.toneLeft, { backgroundColor: sched.action === 'on' ? theme.primary : theme.border }]}>
                                <Power color={sched.action === 'on' ? theme.card : theme.textSecondary} size={24} />
                                <Text style={[styles.toneLeftText, { color: sched.action === 'on' ? theme.card : theme.textSecondary }]}>
                                    {sched.action.toUpperCase()}
                                </Text>
                            </View>

                            {/* Tone 2: Right Description Edge */}
                            <View style={styles.toneRight}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <View style={{ flex: 1, paddingRight: 10 }}>
                                        <Text style={[styles.deviceTarget, { color: theme.text }]}>
                                            {sched.device?.name || `Device #${sched.deviceId}`}
                                        </Text>
                                        <Text style={[styles.scheduleType, { color: theme.textSecondary }]}>
                                            {sched.type === 'once' ? 'ONE-TIME TRIGGER' : 'RECURRING TIMER'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity style={[styles.deleteBtn, { backgroundColor: theme.danger + '15' }]} onPress={() => handleDelete(sched.id)}>
                                        <Trash2 color={theme.danger} size={18} />
                                    </TouchableOpacity>
                                </View>

                                <View style={[styles.timeBox, { backgroundColor: theme.background }]}>
                                    <Clock color={theme.primary} size={14} style={{ marginRight: 6 }} />
                                    <Text style={[styles.scheduleTime, { color: theme.text }]}>
                                        {sched.type === 'once' && sched.runAt ? `Scheduled: ${getRelativeTimeString(sched.runAt)}` : ''}
                                        {sched.type === 'cron' ? `Cron Trigger: ${sched.cron}` : ''}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Clock color={theme.textSecondary} size={48} style={{ marginBottom: 16 }} />
                        <Text style={[styles.emptyText, { color: theme.text }]}>No Active Automations</Text>
                        <Text style={[styles.emptySub, { color: theme.textSecondary }]}>Set up timers and recurring routines from the Command Center Web Dashboard.</Text>
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

    cardContainer: {
        flexDirection: 'row',
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16,
        overflow: 'hidden'
    },
    toneLeft: {
        width: 76,
        justifyContent: 'center',
        alignItems: 'center',
    },
    toneLeftText: {
        fontWeight: '900',
        fontSize: 12,
        marginTop: 6,
        letterSpacing: 0.5
    },
    toneRight: {
        flex: 1,
        padding: 16,
    },
    deviceTarget: {
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 2
    },
    scheduleType: {
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 12,
        letterSpacing: 0.5
    },
    timeBox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
    },
    scheduleTime: {
        fontSize: 13,
        fontWeight: '700'
    },
    deleteBtn: {
        padding: 10,
        borderRadius: 14
    },

    emptyBox: { borderRadius: 24, padding: 40, borderWidth: 1, alignItems: 'center', marginVertical: 40 },
    emptyText: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
    emptySub: { textAlign: 'center', fontSize: 14, lineHeight: 22 },
});
