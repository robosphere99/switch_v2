import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { ActivityScreen } from './ActivityScreen';
import { Activity, User, Monitor, Sun, Moon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export function SettingsScreen({ user, onLogout }: { user: any; onLogout: () => void }) {
    const { theme, mode, setMode } = useTheme();
    const [view, setView] = useState<'MAIN' | 'TIMELINE'>('MAIN');

    if (view === 'TIMELINE') {
        return (
            <View style={{ flex: 1, backgroundColor: theme.background }}>
                <View style={{ paddingTop: 60, paddingHorizontal: 24 }}>
                    <TouchableOpacity
                        style={[styles.backBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
                        onPress={() => {
                            Haptics.selectionAsync().catch(() => { });
                            setView('MAIN');
                        }}
                    >
                        <Text style={{ color: theme.primary, fontWeight: 'bold' }}>← Back to Settings</Text>
                    </TouchableOpacity>
                </View>
                <ActivityScreen />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: theme.text }]}>Settings</Text>
            </View>

            <View style={{ marginBottom: 30 }}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>APPEARANCE</Text>
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, padding: 0, overflow: 'hidden', flexDirection: 'column' }]}>
                    <TouchableOpacity style={[styles.appearanceRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]} onPress={() => { Haptics.selectionAsync().catch(() => { }); setMode('light'); }}>
                        <View style={styles.rowLeft}>
                            <Sun color={mode === 'light' ? theme.primary : theme.textSecondary} size={20} />
                            <Text style={[styles.rowText, { color: mode === 'light' ? theme.primary : theme.text }]}>Light Mode</Text>
                        </View>
                        {mode === 'light' && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.appearanceRow} onPress={() => { Haptics.selectionAsync().catch(() => { }); setMode('dark'); }}>
                        <View style={styles.rowLeft}>
                            <Moon color={mode === 'dark' ? theme.primary : theme.textSecondary} size={20} />
                            <Text style={[styles.rowText, { color: mode === 'dark' ? theme.primary : theme.text }]}>Dark Mode</Text>
                        </View>
                        {mode === 'dark' && <View style={[styles.dot, { backgroundColor: theme.primary }]} />}
                    </TouchableOpacity>
                </View>
            </View>

            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACCOUNT & DATA</Text>
            <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                    setView('TIMELINE');
                }}
            >
                <Activity color={theme.primary} size={24} style={{ marginRight: 12 }} />
                <View>
                    <Text style={[styles.cardTitle, { color: theme.text }]}>Audit Logs</Text>
                    <Text style={[styles.cardSub, { color: theme.textSecondary }]}>View chronological history (Admins Only)</Text>
                </View>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border, marginTop: 20 }]}
                onPress={() => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                    onLogout();
                }}
            >
                <User color="#ef4444" size={24} style={{ marginRight: 12 }} />
                <Text style={[styles.cardTitle, { color: '#ef4444' }]}>Sign Out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, paddingTop: 60 },
    header: { marginBottom: 30 },
    headerTitle: { fontSize: 32, fontWeight: 'bold' },
    card: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1 },
    cardTitle: { fontSize: 16, fontWeight: '600' },
    cardSub: { fontSize: 12, marginTop: 2 },
    backBtn: { borderRadius: 20, borderWidth: 1, padding: 10, alignSelf: 'flex-start' },
    sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
    appearanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    rowText: { fontSize: 16, fontWeight: '500' },
    dot: { width: 8, height: 8, borderRadius: 4 }
});
