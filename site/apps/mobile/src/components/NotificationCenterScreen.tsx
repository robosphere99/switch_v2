import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, RefreshControl, DeviceEventEmitter } from 'react-native';
import { Zap, Clock, ShieldAlert, Cpu, CheckCheck, XCircle, X, BellRing, Settings, CornerDownRight, Trash2 } from 'lucide-react-native';
import { api } from '../api/client';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';

export function NotificationCenterScreen({ onClose }: { onClose?: () => void }) {
    const { theme } = useTheme();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);

    const parseBody = (body: any) => {
        if (!body) return { text: '' };
        try {
            const parsed = typeof body === 'string' ? JSON.parse(body) : body;
            return { text: parsed.t || String(body) };
        } catch {
            return { text: String(body) };
        }
    };

    // Filters
    const [category, setCategory] = useState('all');
    const [type, setType] = useState('all');
    const [unreadOnly, setUnreadOnly] = useState(false);

    useEffect(() => {
        loadData();
        const sub = DeviceEventEmitter.addListener('notification_sync', () => {
            loadData(true); // Silent reload on remote edits!
        });
        return () => sub.remove();
    }, [category, type, unreadOnly]);

    const loadData = async (isRefresh = false) => {
        if (!isRefresh) setLoading(true);
        try {
            const countRes = await api.get('/notifications/unread-count');
            setUnreadCount(countRes.data.data);

            const feedRes = await api.get('/notifications', {
                params: { category, type, unread: unreadOnly ? '1' : '0' }
            });
            setNotifications(feedRes.data.data.items || []);
        } catch (e) {
            console.log('Failed to fetch notifications', e);
        } finally {
            if (!isRefresh) setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData(true);
        setRefreshing(false);
    };

    const markAllRead = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        try {
            await api.post('/notifications/read-all');
            setUnreadCount(0);
            setNotifications(prev => prev.map(n => ({ ...n, status: 'read' })));
        } catch (e) {
            Alert.alert('Error', 'Failed to mark as read');
        }
    };

    const markRead = async (id: number) => {
        try {
            await api.post(`/notifications/${id}/read`);
            setUnreadCount(Math.max(0, unreadCount - 1));
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'read' } : n));
        } catch (e) {
            console.log(e);
        }
    };

    const deleteNotification = async (id: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        setNotifications(prev => prev.filter(n => n.id !== id)); // Optimistic direct removal
        try {
            await api.delete(`/notifications/${id}`);
        } catch (e) {
            console.log('Failed to delete notification', e);
        }
    };

    const deleteAll = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
        Alert.alert(
            "Clear Everything",
            "Are you sure you want to permanently delete all notifications?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Clear All",
                    style: "destructive",
                    onPress: async () => {
                        setNotifications([]);
                        setUnreadCount(0);
                        try {
                            await api.delete('/notifications/delete-all');
                        } catch (e) { console.log(e); }
                    }
                }
            ]
        );
    };

    const getIcon = (cat: string) => {
        switch (cat) {
            case 'device': return <Cpu size={16} color={theme.textSecondary} />;
            case 'schedule': return <Clock size={16} color={theme.textSecondary} />;
            case 'support': return <ShieldAlert size={16} color={theme.textSecondary} />;
            case 'system': return <Settings size={16} color={theme.textSecondary} />;
            default: return <BellRing size={16} color={theme.textSecondary} />;
        }
    };

    const getColor = (typ: string) => {
        switch (typ) {
            case 'error': return theme.danger || '#ef4444';
            case 'warning': return '#f59e0b';
            case 'info': return theme.primary || '#3b82f6';
            default: return theme.textSecondary;
        }
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.headerBlock}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <BellRing color={theme.primary} size={26} />
                        <Text style={[styles.title, { color: theme.text, fontSize: 24 }]}>Notifications</Text>
                    </View>
                    {onClose && (
                        <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                            <X size={28} color={theme.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Text style={[styles.subtitle, { color: theme.textSecondary, flex: 1, marginRight: 16 }]}>
                        <Text style={{ color: theme.primary, fontWeight: '700' }}>{unreadCount} unread</Text> — system updates and routines.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={markAllRead} style={[styles.markAllBtn, { borderColor: theme.border, backgroundColor: theme.card }]}>
                            <CheckCheck size={15} color={theme.primary} />
                            <Text style={{ color: theme.primary, fontWeight: '600', fontSize: 13, marginLeft: 4 }}>Read UI</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={deleteAll} style={[styles.markAllBtn, { borderColor: '#ef444450', backgroundColor: '#ef444410' }]}>
                            <Trash2 size={15} color="#ef4444" />
                            <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13, marginLeft: 4 }}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Top Filter Row 1 */}
            <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['all', 'support', 'device', 'schedule', 'system'].map((cat) => (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.filterChip, {
                                backgroundColor: category === cat ? theme.primary + '20' : theme.card,
                                borderColor: category === cat ? theme.primary : theme.border
                            }]}
                            onPress={() => {
                                Haptics.selectionAsync().catch(() => { });
                                setCategory(cat);
                            }}
                        >
                            <Text style={{
                                color: category === cat ? theme.primary : theme.textSecondary,
                                fontWeight: category === cat ? '700' : '500',
                                textTransform: 'capitalize'
                            }}>{cat}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Bottom Filter Row 2 */}
            <View style={{ paddingHorizontal: 20, marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {['all', 'info', 'warning', 'error'].map((typ) => (
                        <TouchableOpacity
                            key={typ}
                            style={[styles.filterChip, {
                                backgroundColor: type === typ ? theme.text : theme.card,
                                borderColor: type === typ ? theme.text : theme.border
                            }]}
                            onPress={() => {
                                Haptics.selectionAsync().catch(() => { });
                                setType(typ);
                            }}
                        >
                            <Text style={{
                                color: type === typ ? theme.background : theme.textSecondary,
                                fontWeight: type === typ ? '700' : '500',
                                textTransform: typ === 'all' ? 'none' : 'capitalize'
                            }}>{typ === 'all' ? 'Sab types' : typ}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
                <TouchableOpacity
                    onPress={() => setUnreadOnly(!unreadOnly)}
                    style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 12 }}
                >
                    <View style={[{ width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: theme.border, marginRight: 6, alignItems: 'center', justifyContent: 'center' }, unreadOnly && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
                        {unreadOnly && <CheckCheck size={12} color={theme.background} />}
                    </View>
                    <Text style={{ color: theme.textSecondary, fontSize: 13, fontWeight: '500' }}>Unread only</Text>
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />
                }
            >
                {loading ? (
                    <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 50 }} />
                ) : notifications.length > 0 ? (
                    notifications.map((item) => (
                        <View key={item.id} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            {/* Card Header Row */}
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <Text style={[styles.cardTitle, { color: theme.text }]}>
                                        {item.title}
                                    </Text>

                                    <View style={[styles.badge, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                        {getIcon(item.category)}
                                        <Text style={[styles.badgeText, { color: theme.textSecondary }]}>{item.category}</Text>
                                    </View>
                                    <View style={[styles.badge, { backgroundColor: getColor(item.type) + '15', borderColor: getColor(item.type) + '50' }]}>
                                        <Text style={[styles.badgeText, { color: getColor(item.type), fontWeight: '700', textTransform: 'uppercase' }]}>{item.type}</Text>
                                    </View>

                                    {item.status === 'unread' && (
                                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.primary, marginLeft: 8 }} />
                                    )}
                                </View>
                                <TouchableOpacity
                                    onPress={() => deleteNotification(item.id)}
                                    style={{ padding: 4 }}
                                >
                                    <XCircle size={20} color={theme.textSecondary + '80'} />
                                </TouchableOpacity>
                            </View>

                            {/* Card Body */}
                            <Text style={[styles.cardBody, { color: theme.textSecondary }]}>{parseBody(item.body).text}</Text>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                                <Text style={{ fontSize: 11, color: theme.textSecondary + '80', fontWeight: '500' }}>
                                    {new Date(item.createdAt).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
                                    <CornerDownRight size={12} color={theme.primary} style={{ marginRight: 4 }} />
                                    <Text style={{ color: theme.primary, fontSize: 11, fontWeight: '700' }}>support kholo — draft ready</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                ) : (
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <BellRing color={theme.border} size={64} />
                        <Text style={{ color: theme.textSecondary, marginTop: 16, fontSize: 16, fontWeight: '500' }}>Feed all caught up</Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerBlock: {
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 24,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        letterSpacing: -0.5
    },
    subtitle: {
        fontSize: 14,
        marginTop: 6,
        lineHeight: 20
    },
    markAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 10,
    },
    card: {
        borderRadius: 16,
        borderWidth: 1,
        padding: 16,
        marginBottom: 16,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: '800',
        marginRight: 10,
        lineHeight: 22,
        marginBottom: 8
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        borderWidth: 1,
        marginRight: 8,
        marginBottom: 8
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '600',
        marginLeft: 4,
        textTransform: 'capitalize'
    },
    cardBody: {
        fontSize: 14,
        lineHeight: 22,
    }
});
