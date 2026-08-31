import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert, StyleSheet, Modal, DeviceEventEmitter, TextInput } from 'react-native';
import { Clock, Trash2, Power, Plus, X } from 'lucide-react-native';
import { getHomes, getSchedules, deleteSchedule, getDevices, createSchedule } from '../api/hardware';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';
import { useThemedAlert } from './ThemedAlert';

const Countdown = ({ targetDate, primaryColor }: { targetDate: string, primaryColor: string }) => {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        const update = () => {
            const diff = new Date(targetDate).getTime() - Date.now();
            if (diff <= 0) {
                setTimeLeft('Executing...');
                return;
            }
            const d = Math.floor(diff / (1000 * 60 * 60 * 24));
            const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
            const m = Math.floor((diff / 1000 / 60) % 60);
            const s = Math.floor((diff / 1000) % 60);

            if (d > 0) {
                setTimeLeft(`In ${d}d ${h}h`);
            } else if (h > 0) {
                setTimeLeft(`In ${h}h ${m}m`);
            } else {
                setTimeLeft(`In ${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }
        };
        update();
        const intv = setInterval(update, 1000);
        return () => clearInterval(intv);
    }, [targetDate]);

    return <Text style={{ color: primaryColor, fontSize: 13, fontWeight: 'bold' }}>{timeLeft}</Text>;
}

export function AutomationsScreen() {
    const { theme } = useTheme();
    const { showAlert, AlertComponent } = useThemedAlert();
    const [loading, setLoading] = useState(true);
    const [schedules, setSchedules] = useState<any[]>([]);
    const [devices, setDevices] = useState<any[]>([]);
    const [homeId, setHomeId] = useState<number | null>(null);

    const [creationModal, setCreationModal] = useState(false);
    const [creationTab, setCreationTab] = useState<'timer' | 'schedule'>('timer');
    const [customTimer, setCustomTimer] = useState(false);
    const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
    const [form, setForm] = useState<{ deviceId: number | null, action: 'on' | 'off', runAt: string, cronHour: string, cronMin: string, cronAmPm: 'AM' | 'PM', schedType: 'daily' | 'weekly', customMonth: string, customDay: string }>({
        deviceId: null, action: 'on', runAt: '', cronHour: '12', cronMin: '00', cronAmPm: 'PM', schedType: 'daily', customMonth: (new Date().getMonth() + 1).toString().padStart(2, '0'), customDay: (new Date().getDate()).toString().padStart(2, '0')
    });

    const [filter, setFilter] = useState<'upcoming' | 'completed'>('upcoming');

    useEffect(() => {
        loadData();
        const syncSub = DeviceEventEmitter.addListener('schedule_sync', loadData);
        return () => syncSub.remove();
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

                const devRes = await getDevices(activeHome);
                if (devRes.success) {
                    setDevices(devRes.data);
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
        showAlert("Remove Routine", "Are you sure you want to stop this automation?", [
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
                        showAlert("Error", "Could not delete this routine.");
                    }
                }
            }
        ])
    };

    const handleQuickTime = (minutesToAdd?: number | 'custom', setTimeHour?: number) => {
        setCustomTimer(false);
        if (minutesToAdd === 'custom') {
            setCustomTimer(true);
            return;
        }

        let date = (form.runAt && typeof minutesToAdd === 'number') ? new Date(form.runAt) : new Date();
        if (typeof minutesToAdd === 'number') {
            date = new Date(date.getTime() + minutesToAdd * 60000);
        } else if (setTimeHour !== undefined) {
            if (date.getHours() >= setTimeHour) {
                date.setDate(date.getDate() + 1);
            }
            date.setHours(setTimeHour, 0, 0, 0);
        }
        
        date.setSeconds(0, 0);
        setForm(prev => ({ ...prev, runAt: date.toISOString() }));
    };

    const applyCustomRunAt = () => {
        let h = parseInt(form.cronHour);
        if (isNaN(h) || h < 1 || h > 12) h = 12;
        if (form.cronAmPm === 'PM' && h !== 12) h += 12;
        if (form.cronAmPm === 'AM' && h === 12) h = 0;
        let m = parseInt(form.cronMin);
        if (isNaN(m) || m < 0 || m > 59) m = 0;

        let mon = parseInt(form.customMonth) - 1;
        let d = parseInt(form.customDay);

        const act = new Date();
        act.setMonth(mon);
        act.setDate(d);
        act.setHours(h, m, 0, 0);

        if (act.getTime() < new Date().getTime()) {
            act.setFullYear(act.getFullYear() + 1);
        }

        setForm(p => ({ ...p, runAt: act.toISOString() }));
    }

    const handleSubmit = async () => {
        if (!homeId || !form.deviceId) {
            showAlert("Incomplete", "Please select a device.");
            return;
        }

        let submitType = creationTab === 'timer' ? 'once' : form.schedType;
        let submitCron = null;
        let submitRunAt = creationTab === 'timer' ? form.runAt : null;

        if (creationTab === 'schedule') {
            let h = parseInt(form.cronHour);
            if (isNaN(h) || h < 1 || h > 12) h = 12;
            if (form.cronAmPm === 'PM' && h !== 12) h += 12;
            if (form.cronAmPm === 'AM' && h === 12) h = 0;
            let m = parseInt(form.cronMin);
            if (isNaN(m) || m < 0 || m > 59) m = 0;

            submitCron = `${m} ${h} * * ${form.schedType === 'weekly' && selectedDays.length > 0 ? selectedDays.join(',') : '*'}`;
        } else {
            if (customTimer) {
                applyCustomRunAt();
                submitRunAt = form.runAt;
            } else if (!form.runAt) {
                showAlert("Incomplete", "Pick a quick timer.");
                return;
            }
        }

        setCreationModal(false);
        setLoading(true);
        try {
            await createSchedule(homeId, form.deviceId, submitType as any, form.action, submitRunAt as any, submitCron as any);
            await loadData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        } catch (e: any) {
            showAlert("Failed", e.message);
        } finally {
            setLoading(false);
            setForm({ deviceId: null, action: 'on', runAt: '', cronHour: '12', cronMin: '00', cronAmPm: 'PM', schedType: 'daily', customMonth: (new Date().getMonth() + 1).toString().padStart(2, '0'), customDay: (new Date().getDate()).toString().padStart(2, '0') });
        }
    };

    const getRelativeTimeString = (runAt: string) => {
        const d = new Date(runAt);
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' on ' + d.toLocaleDateString();
    };

    const filteredSchedules = schedules.filter(s => {
        const isPast = !s.enabled || (s.nextRun && new Date(s.nextRun).getTime() <= Date.now());
        if (filter === 'upcoming') return !isPast;
        return isPast;
    });

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.headerIconContainer, { backgroundColor: theme.primary }]}>
                        <Clock color="#ffffff" size={24} />
                    </View>
                    <Text style={[styles.pageTitle, { color: theme.text }]}>Automations</Text>
                </View>
            </View>

            <View style={{ flexDirection: 'row', paddingHorizontal: 24, marginBottom: 20, gap: 12 }}>
                <TouchableOpacity onPress={() => setFilter('upcoming')} style={[styles.filterBtn, { backgroundColor: filter === 'upcoming' ? theme.primary : theme.card, borderColor: filter === 'upcoming' ? theme.primary : theme.border }]}>
                    <Text style={{ color: filter === 'upcoming' ? '#000' : theme.textSecondary, fontWeight: 'bold' }}>Upcoming</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setFilter('completed')} style={[styles.filterBtn, { backgroundColor: filter === 'completed' ? theme.primary : theme.card, borderColor: filter === 'completed' ? theme.primary : theme.border }]}>
                    <Text style={{ color: filter === 'completed' ? '#000' : theme.textSecondary, fontWeight: 'bold' }}>Completed</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
                {loading ? (
                    <View style={styles.centerBox}>
                        <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                ) : filteredSchedules.length > 0 ? (
                    filteredSchedules.map((sched) => (
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

                                <View style={[styles.timeBox, { backgroundColor: theme.background, justifyContent: 'space-between', alignItems: 'center' }]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 8 }}>
                                        <Clock color={theme.primary} size={14} style={{ marginRight: 6, flexShrink: 0 }} />
                                        <Text style={[styles.scheduleTime, { color: theme.text, flexShrink: 1 }]} numberOfLines={2}>
                                            {sched.type === 'once' && sched.runAt ? `Scheduled: ${getRelativeTimeString(sched.runAt)}` : ''}
                                            {sched.type !== 'once' ? `Recurring: ${sched.cron}` : ''}
                                        </Text>
                                    </View>
                                    {filter === 'upcoming' && sched.nextRun && (
                                        <View style={{ flexShrink: 0 }}>
                                            <Countdown targetDate={sched.nextRun} primaryColor={theme.primary} />
                                        </View>
                                    )}
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

            <TouchableOpacity
                style={[styles.fab, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow || theme.primary }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                    setCreationModal(true);
                }}
            >
                <Plus color={theme.background} size={28} />
            </TouchableOpacity>

            <Modal visible={creationModal} transparent animationType="slide" onRequestClose={() => setCreationModal(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40, borderColor: theme.border, borderWidth: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Timers & Schedules</Text>
                            <TouchableOpacity onPress={() => setCreationModal(false)}>
                                <X color={theme.textSecondary} size={24} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                            <TouchableOpacity onPress={() => setCreationTab('timer')} style={[styles.actionBtn, { flex: 1, backgroundColor: creationTab === 'timer' ? theme.primary : theme.card, borderColor: theme.border }]}>
                                <Text style={{ textAlign: 'center', fontWeight: 'bold', color: creationTab === 'timer' ? '#000' : theme.text }}>⏳ Quick Timer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setCreationTab('schedule')} style={[styles.actionBtn, { flex: 1, backgroundColor: creationTab === 'schedule' ? theme.primary : theme.card, borderColor: theme.border }]}>
                                <Text style={{ textAlign: 'center', fontWeight: 'bold', color: creationTab === 'schedule' ? '#000' : theme.text }}>📅 Routine</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: 'bold' }}>SELECT DEVICE</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }}>
                            {devices.map(d => (
                                <TouchableOpacity
                                    key={d.id}
                                    onPress={() => setForm(p => ({ ...p, deviceId: d.id }))}
                                    style={[styles.chip, { backgroundColor: form.deviceId === d.id ? theme.primary : theme.card, borderColor: form.deviceId === d.id ? theme.primary : theme.border }]}
                                >
                                    <Text style={{ color: form.deviceId === d.id ? '#000' : theme.textSecondary, fontWeight: form.deviceId === d.id ? '700' : '500' }}>{d.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: 'bold' }}>ACTION</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                            <TouchableOpacity onPress={() => setForm(p => ({ ...p, action: 'on' }))} style={[styles.actionBtn, { flex: 1, backgroundColor: form.action === 'on' ? (theme.success || theme.primary) : theme.card, borderColor: theme.border }]}>
                                <Text style={{ textAlign: 'center', fontWeight: 'bold', color: form.action === 'on' ? '#000' : theme.text }}>Turn ON</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setForm(p => ({ ...p, action: 'off' }))} style={[styles.actionBtn, { flex: 1, backgroundColor: form.action === 'off' ? (theme.danger || '#ef4444') : theme.card, borderColor: theme.border }]}>
                                <Text style={{ textAlign: 'center', fontWeight: 'bold', color: form.action === 'off' ? '#fff' : theme.text }}>Turn OFF</Text>
                            </TouchableOpacity>
                        </View>

                        {creationTab === 'timer' ? (
                            <>
                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: 'bold' }}>TRIGGER (QUICK TIME)</Text>
                                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                                    <TouchableOpacity onPress={() => handleQuickTime(5)} style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text, fontSize: 13 }}>⏱ +5 min</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleQuickTime(60)} style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text, fontSize: 13 }}>⏱ +1 hour</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleQuickTime(-5)} style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text, fontSize: 13 }}>⏱ -5 min</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleQuickTime(-1)} style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text, fontSize: 13 }}>⏱ -1 min</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleQuickTime(undefined, 21)} style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text, fontSize: 13 }}>🌙 Tonight 9 PM</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleQuickTime(undefined, 9)} style={[styles.pill, { borderColor: theme.border, backgroundColor: theme.card }]}><Text style={{ color: theme.text, fontSize: 13 }}>🌅 Tomorrow 9 AM</Text></TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleQuickTime('custom')} style={[styles.pill, { borderColor: theme.border, backgroundColor: customTimer ? theme.primary : theme.card }]}><Text style={{ color: customTimer ? '#000' : theme.text, fontSize: 13 }}>🎯 Custom...</Text></TouchableOpacity>
                                </View>

                                {customTimer && (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 10, justifyContent: 'center' }}>
                                        <TextInput
                                            value={form.customMonth} onChangeText={t => setForm(p => ({ ...p, customMonth: t }))}
                                            style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text, fontSize: 16, textAlign: 'center' }]}
                                            keyboardType="numeric" maxLength={2} placeholder="MM" placeholderTextColor={theme.textSecondary}
                                        />
                                        <Text style={{ color: theme.text, fontSize: 24 }}>/</Text>
                                        <TextInput
                                            value={form.customDay} onChangeText={t => setForm(p => ({ ...p, customDay: t }))}
                                            style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text, fontSize: 16, textAlign: 'center' }]}
                                            keyboardType="numeric" maxLength={2} placeholder="DD" placeholderTextColor={theme.textSecondary}
                                        />

                                        <View style={{ width: 10 }} />
                                        <TextInput
                                            value={form.cronHour} onChangeText={t => setForm(p => ({ ...p, cronHour: t }))}
                                            style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text, fontSize: 16, textAlign: 'center' }]}
                                            keyboardType="numeric" maxLength={2} placeholder="HH" placeholderTextColor={theme.textSecondary}
                                        />
                                        <Text style={{ color: theme.text, fontSize: 24 }}>:</Text>
                                        <TextInput
                                            value={form.cronMin} onChangeText={t => setForm(p => ({ ...p, cronMin: t }))}
                                            style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.card, color: theme.text, fontSize: 16, textAlign: 'center' }]}
                                            keyboardType="numeric" maxLength={2} placeholder="MM" placeholderTextColor={theme.textSecondary}
                                        />
                                        <TouchableOpacity onPress={() => setForm(p => ({ ...p, cronAmPm: p.cronAmPm === 'AM' ? 'PM' : 'AM' }))} style={[styles.amPmBtn, { backgroundColor: theme.primary, borderColor: theme.border }]}>
                                            <Text style={{ color: '#000', fontWeight: 'bold' }}>{form.cronAmPm}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {!customTimer && form.runAt !== '' && (
                                    <Text style={{ color: theme.primary, marginBottom: 16, textAlign: 'center', fontSize: 12, fontWeight: 'bold' }}>
                                        ✔ Will run at: {new Date(form.runAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on {new Date(form.runAt).toLocaleDateString()}
                                    </Text>
                                )}
                            </>
                        ) : (
                            <>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity onPress={() => setForm(p => ({ ...p, schedType: 'daily' }))} style={{ paddingVertical: 6, paddingHorizontal: 16, borderRadius: 12, backgroundColor: form.schedType === 'daily' ? theme.primary : 'transparent', borderWidth: 1, borderColor: form.schedType === 'daily' ? theme.primary : theme.border }}>
                                            <Text style={{ color: form.schedType === 'daily' ? '#000' : theme.text }}>Daily</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setForm(p => ({ ...p, schedType: 'weekly' }))} style={{ paddingVertical: 6, paddingHorizontal: 16, borderRadius: 12, backgroundColor: form.schedType === 'weekly' ? theme.primary : 'transparent', borderWidth: 1, borderColor: form.schedType === 'weekly' ? theme.primary : theme.border }}>
                                            <Text style={{ color: form.schedType === 'weekly' ? '#000' : theme.text }}>Weekly</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {form.schedType === 'weekly' && (
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => {
                                            const isActive = selectedDays.includes(idx);
                                            return (
                                                <TouchableOpacity key={idx} onPress={() => {
                                                    if (isActive) setSelectedDays(p => p.filter(d => d !== idx));
                                                    else setSelectedDays(p => [...p, idx]);
                                                }} style={[{ width: 38, height: 38, borderRadius: 19, borderWidth: 1, justifyContent: 'center', alignItems: 'center' }, isActive ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.border, backgroundColor: theme.card }]}>
                                                    <Text style={{ color: isActive ? '#000' : theme.text, fontWeight: 'bold' }}>{day}</Text>
                                                </TouchableOpacity>
                                            )
                                        })}
                                    </View>
                                )}

                                <Text style={{ color: theme.textSecondary, marginBottom: 8, fontSize: 12, fontWeight: 'bold' }}>EXECUTION TIME</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 10, justifyContent: 'center' }}>
                                    <TouchableOpacity
                                        style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.card }]}
                                        onPress={() => {
                                            let h = parseInt(form.cronHour);
                                            h = h >= 12 ? 1 : h + 1;
                                            setForm(p => ({ ...p, cronHour: h.toString().padStart(2, '0') }));
                                        }}
                                    >
                                        <Text style={{ color: theme.text, fontSize: 24, fontWeight: 'bold' }}>{form.cronHour}</Text>
                                    </TouchableOpacity>
                                    <Text style={{ color: theme.text, fontSize: 24, fontWeight: 'bold' }}>:</Text>
                                    <TouchableOpacity
                                        style={[styles.inputBox, { borderColor: theme.border, backgroundColor: theme.card }]}
                                        onPress={() => {
                                            let m = parseInt(form.cronMin);
                                            m = m >= 55 ? 0 : m + 5;
                                            setForm(p => ({ ...p, cronMin: m.toString().padStart(2, '0') }));
                                        }}
                                    >
                                        <Text style={{ color: theme.text, fontSize: 24, fontWeight: 'bold' }}>{form.cronMin}</Text>
                                    </TouchableOpacity>
                                    <View style={{ width: 10 }} />
                                    <View>
                                        <TouchableOpacity onPress={() => setForm(p => ({ ...p, cronAmPm: 'AM' }))} style={[styles.amPmBtn, { backgroundColor: form.cronAmPm === 'AM' ? theme.primary : theme.card, borderColor: theme.border }]}>
                                            <Text style={{ color: form.cronAmPm === 'AM' ? '#000' : theme.textSecondary, fontWeight: 'bold' }}>AM</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setForm(p => ({ ...p, cronAmPm: 'PM' }))} style={[styles.amPmBtn, { backgroundColor: form.cronAmPm === 'PM' ? theme.primary : theme.card, borderColor: theme.border, marginTop: 4 }]}>
                                            <Text style={{ color: form.cronAmPm === 'PM' ? '#000' : theme.textSecondary, fontWeight: 'bold' }}>PM</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </>
                        )}

                        <TouchableOpacity onPress={handleSubmit} style={{ backgroundColor: theme.primary, padding: 16, borderRadius: 12, alignItems: 'center' }}>
                            <Text style={{ color: '#000', fontWeight: 'bold', fontSize: 16 }}>Add Schedule</Text>
                        </TouchableOpacity>
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
    chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, borderWidth: 1, marginRight: 8 },
    actionBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1 },
    pill: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },

    inputBox: { paddingVertical: 12, paddingHorizontal: 20, borderRadius: 12, borderWidth: 1, alignItems: 'center' },
    amPmBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
    filterBtn: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center' }
});
