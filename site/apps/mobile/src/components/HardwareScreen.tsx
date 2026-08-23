import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, TextInput, KeyboardAvoidingView, Platform, Keyboard } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Cpu, Wifi, Server, X, PlusCircle, Monitor, Shield, Camera } from 'lucide-react-native';
import { getHardwareHomes, setEspLed, assignEspChannel } from '../api/hardware';
import { getClaimHomes, claimDevice } from '../api/shop';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useThemedAlert } from './ThemedAlert';

const getRelativeTime = (dateString: string) => {
    if (!dateString) return 'Never';
    const seconds = Math.floor((new Date().getTime() - new Date(dateString).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
};

export function HardwareScreen() {
    const { theme } = useTheme();
    const { showAlert, AlertComponent } = useThemedAlert();
    const [loading, setLoading] = useState(true);
    const [homes, setHomes] = useState<any[]>([]);
    const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);

    // Modal state for assigning devices
    const [mappingModal, setMappingModal] = useState<{ visible: boolean, espId: number | null, channel: number | null }>({ visible: false, espId: null, channel: null });
    const [detailsModal, setDetailsModal] = useState<any | null>(null);

    // Modal state for hardware activation
    const [activateModal, setActivateModal] = useState<{ visible: boolean, mode: 'manual' | 'camera' }>({ visible: false, mode: 'manual' });
    const [permission, requestPermission] = useCameraPermissions();
    const [serialCodeStr, setSerialCodeStr] = useState('');
    const [claimHomeId, setClaimHomeId] = useState<number | "">("");
    const [claimHomes, setClaimHomes] = useState<any[]>([]);
    const [claimBusy, setClaimBusy] = useState(false);

    const serialInputRef = useRef<TextInput>(null);

    useEffect(() => {
        const keyboardSub = Keyboard.addListener('keyboardDidHide', () => {
            serialInputRef.current?.blur();
        });
        return () => {
            keyboardSub.remove();
        };
    }, []);

    useEffect(() => {
        loadDashboards();
    }, []);

    const loadDashboards = async () => {
        setLoading(true);
        try {
            const res = await getHardwareHomes();
            if (res.success && res.data) {
                setHomes(res.data);
                if (res.data.length > 0 && !selectedHomeId) {
                    setSelectedHomeId(res.data[0].homeId);
                }
            }
        } catch (e) {
            console.log("Failed to load dashboards", e);
        } finally {
            setLoading(false);
        }
    };

    const currentHome = homes.find(h => h.homeId === selectedHomeId);

    const handleOpenActivate = async (mode: 'manual' | 'camera') => {
        if (mode === 'camera' && !permission?.granted) {
            const res = await requestPermission();
            if (!res.granted) {
                showAlert("Permission Refused", "Cannot scan QR without camera permissions.");
                return;
            }
        }
        setActivateModal({ visible: true, mode });
        setSerialCodeStr('');
        setClaimBusy(true);
        try {
            const hs = await getClaimHomes();
            setClaimHomes(hs);
            if (hs.length === 1) setClaimHomeId(hs[0].id);
        } catch (e: any) {
            showAlert("Error", e.message || "Could not load homes.");
        } finally {
            setClaimBusy(false);
        }
    };

    const handleSerialCodeChange = (text: string) => {
        const raw = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        if (!raw.startsWith('RS')) { setSerialCodeStr(raw); return; }
        const afterRS = raw.substring(2);
        const mMap: Record<string, string> = { 'FANDIM': 'FAN-DIM', 'DIM4S': 'DIM-4S', 'DIM3S': 'DIM-3S', '4CHIR': '4CH-IR', '16CH': '16CH', '8CH': '8CH', '6CH': '6CH', '5CH': '5CH', '4CH': '4CH', '2CH': '2CH', '1CH': '1CH', 'SNR2': 'SN-R2', 'SNR1': 'SN-R1' };
        const kModels = Object.keys(mMap).sort((a, b) => b.length - a.length);
        let matched = '';
        for (const m of kModels) {
            if (afterRS.startsWith(m)) { matched = m; break; }
        }
        if (matched) {
            const rem = afterRS.substring(matched.length);
            setSerialCodeStr(rem.length > 0 ? `RS-${mMap[matched]}-${rem}` : `RS-${mMap[matched]}`);
        } else if (raw.length > 2) {
            setSerialCodeStr(`RS-${afterRS}`);
        } else {
            setSerialCodeStr(raw);
        }
    };

    const handleBarcodeScanned = async (result: any) => {
        if (claimBusy) return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        let extractedSerial = result.data;
        if (extractedSerial.includes('serial=')) {
            extractedSerial = extractedSerial.split('serial=')[1].split('&')[0];
        }
        handleSerialCodeChange(extractedSerial);
        setActivateModal({ visible: true, mode: 'manual' });
    };

    const submitClaim = async () => {
        if (!serialCodeStr || typeof claimHomeId !== 'number') return;
        setClaimBusy(true);
        try {
            const res = await claimDevice(serialCodeStr.toUpperCase(), claimHomeId);
            showAlert("Success", `Device ${res.device.name} activated successfully.`);
            setActivateModal({ visible: false, mode: 'manual' });
            loadDashboards();
        } catch (e: any) {
            showAlert("Failed", e.message || "Failed to claim device.");
        } finally {
            setClaimBusy(false);
        }
    };

    const toggleLed = async (espId: number, currentEnabled: boolean) => {
        if (!currentHome) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        // Optimistic UI
        setHomes(prev => prev.map(h => h.homeId === currentHome.homeId ? {
            ...h, boards: h.boards.map((b: any) => b.id === espId ? { ...b, ledEnabled: !currentEnabled } : b)
        } : h));
        try {
            await setEspLed(currentHome.homeId, espId, !currentEnabled);
        } catch (e: any) {
            showAlert("LED Control failed", e.message);
            loadDashboards(); // revert
        }
    };

    const handleUnmap = async (deviceId: number) => {
        if (!currentHome) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => { });
        try {
            await assignEspChannel(currentHome.homeId, deviceId, null, null);
            loadDashboards();
        } catch (e: any) {
            showAlert("Unmap failed", e.message);
        }
    };

    const handleAssign = async (deviceId: number) => {
        if (!currentHome || !mappingModal.espId || !mappingModal.channel) return;
        setMappingModal({ visible: false, espId: null, channel: null });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
        try {
            await assignEspChannel(currentHome.homeId, deviceId, mappingModal.espId, mappingModal.channel);
            loadDashboards();
        } catch (e: any) {
            showAlert("Mapping failed", e.message);
        }
    };

    if (loading && homes.length === 0) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color={theme.primary} />
            </View>
        );
    }

    if (!loading && homes.length === 0) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <View style={[styles.header, { backgroundColor: theme.background }]}>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Hardware</Text>
                    <Text style={{ color: theme.textSecondary, marginTop: 4 }}>Cloud Physical Mappings</Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                    <Shield color={theme.textSecondary} size={48} style={{ marginBottom: 16 }} />
                    <Text style={{ color: theme.text, fontSize: 20, fontWeight: 'bold', marginBottom: 8 }}>Access Restricted</Text>
                    <Text style={{ color: theme.textSecondary, textAlign: 'center', fontSize: 16 }}>
                        You must be an Owner or Admin of a home to view and manage its internal hardware.
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <View style={[styles.header, { backgroundColor: theme.background, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }]}>
                <View>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Hardware</Text>
                    <Text style={{ color: theme.textSecondary, marginTop: 4 }}>Cloud Physical Mappings</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <TouchableOpacity style={[styles.headerActionBtn, { backgroundColor: theme.card, borderColor: theme.border }]} onPress={() => handleOpenActivate('camera')}>
                        <Camera color={theme.text} size={20} />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.headerActionBtn, { backgroundColor: theme.primary, borderColor: theme.primary }]} onPress={() => handleOpenActivate('manual')}>
                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>Activate</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {homes.length > 1 && (
                <View style={{ paddingHorizontal: 24, paddingBottom: 10 }}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {homes.map((home: any) => (
                            <TouchableOpacity
                                key={home.homeId}
                                style={[styles.filterChip, { backgroundColor: selectedHomeId === home.homeId ? theme.primary + '20' : theme.card, borderColor: selectedHomeId === home.homeId ? theme.primary : theme.border }]}
                                onPress={() => { Haptics.selectionAsync().catch(() => { }); setSelectedHomeId(home.homeId); }}
                            >
                                <Text style={[styles.filterText, { color: selectedHomeId === home.homeId ? theme.primary : theme.textSecondary }]}>{home.homeName}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {currentHome?.boards?.length === 0 ? (
                    <View style={[styles.emptyBox, { borderColor: theme.border, backgroundColor: theme.card }]}>
                        <Server color={theme.textSecondary} size={32} style={{ marginBottom: 12 }} />
                        <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>No hardware hubs registered to this home.</Text>
                    </View>
                ) : (
                    currentHome?.boards?.map((b: any) => {
                        // Compute array of blocks based on relay count
                        const relayCount = b.modelCode === "sn-r2" ? 2 : b.modelCode === "sn-r1" ? 1 : 4;
                        const channels = Array.from({ length: relayCount }, (_, i) => i + 1);

                        return (
                            <View key={b.id} style={[styles.boardCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                <View style={styles.boardHeaderRow}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 }}>
                                        <Cpu color={b.offline ? theme.textSecondary : theme.success || theme.primary} size={24} style={{ marginRight: 12, flexShrink: 0 }} />
                                        <View style={{ flexShrink: 1 }}>
                                            <Text style={{ color: theme.text, fontWeight: '700', fontSize: 16 }}>{b.name || b.serialCode}</Text>
                                            <Text style={{ color: b.offline ? '#ef4444' : theme.success || theme.primary, fontSize: 11, fontWeight: 'bold', marginTop: 2 }}>
                                                {b.offline ? `OFFLINE · ${getRelativeTime(b.lastSeen)}` : 'ONLINE'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 16, gap: 10 }}>
                                    <TouchableOpacity
                                        onPress={() => setDetailsModal(b)}
                                        style={[styles.ledBtn, { borderColor: theme.border, backgroundColor: 'transparent' }]}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.textSecondary }}>
                                            ℹ️ DETAILS
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => toggleLed(b.id, b.ledEnabled !== false)}
                                        style={[styles.ledBtn, { borderColor: b.ledEnabled !== false ? theme.primary : theme.border, backgroundColor: b.ledEnabled !== false ? theme.primary + '20' : 'transparent' }]}>
                                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: b.ledEnabled !== false ? theme.primary : theme.textSecondary }}>
                                            💡 LED {b.ledEnabled !== false ? 'ON' : 'OFF'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {channels.map(ch => {
                                    const mappedDev = b.devices?.find((d: any) => d.channel === ch);
                                    return (
                                        <View key={ch} style={[styles.channelRow, { borderColor: theme.border }]}>
                                            <View style={[styles.chBadge, { backgroundColor: theme.background }]}>
                                                <Text style={{ color: theme.primary, fontWeight: 'bold', fontSize: 12 }}>CH {ch}</Text>
                                            </View>

                                            {mappedDev ? (
                                                <>
                                                    <View style={{ flex: 1, paddingLeft: 10 }}>
                                                        <Text style={{ color: theme.text, fontWeight: '600' }} numberOfLines={1}>{mappedDev.name}</Text>
                                                        <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{mappedDev.type.toUpperCase()}</Text>
                                                    </View>
                                                    <TouchableOpacity onPress={() => handleUnmap(mappedDev.id)} style={[styles.unmapBtn, { backgroundColor: 'transparent', borderColor: '#ef4444' }]}>
                                                        <X color="#ef4444" size={16} />
                                                    </TouchableOpacity>
                                                </>
                                            ) : (
                                                <TouchableOpacity
                                                    style={{ flex: 1, paddingLeft: 10, flexDirection: 'row', alignItems: 'center', opacity: 0.7 }}
                                                    onPress={() => setMappingModal({ visible: true, espId: b.id, channel: ch })}
                                                >
                                                    <Text style={{ color: theme.textSecondary, fontStyle: 'italic', flex: 1 }}>Empty Channel</Text>
                                                    <PlusCircle color={theme.textSecondary} size={20} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    );
                                })}
                            </View>
                        );
                    })
                )}
            </ScrollView>

            {/* Activation Scanner / Manual Modal */}
            <Modal visible={activateModal.visible} transparent animationType="slide" onRequestClose={() => { if (!claimBusy) setActivateModal({ visible: false, mode: 'manual' }) }}>
                <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>

                        {activateModal.mode === 'camera' && (
                            <View style={{ flex: 1 }}>
                                <CameraView
                                    style={{ flex: 1 }}
                                    facing="back"
                                    barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
                                    onBarcodeScanned={handleBarcodeScanned}
                                />
                                <View style={{ position: 'absolute', top: 60, right: 24 }}>
                                    <TouchableOpacity style={{ padding: 12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 24 }} onPress={() => setActivateModal({ visible: false, mode: 'manual' })}>
                                        <X color="#fff" size={24} />
                                    </TouchableOpacity>
                                </View>
                                <View style={{ position: 'absolute', bottom: 60, alignSelf: 'center' }}>
                                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', textShadowColor: '#000', textShadowRadius: 4 }}>Scan QR Code on Device Box</Text>
                                </View>
                            </View>
                        )}

                        {activateModal.mode === 'manual' && (
                            <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, borderColor: theme.border, borderWidth: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                                    <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Activate Hardware</Text>
                                    <TouchableOpacity onPress={() => setActivateModal({ visible: false, mode: 'manual' })}>
                                        <X color={theme.textSecondary} size={24} />
                                    </TouchableOpacity>
                                </View>

                                <ScrollView>
                                    <Text style={{ color: theme.textSecondary, marginBottom: 8 }}>Serial Code</Text>
                                    <TextInput
                                        ref={serialInputRef}
                                        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                                        value={serialCodeStr}
                                        onChangeText={handleSerialCodeChange}
                                        placeholder="RS-4CH-XXXXXX"
                                        placeholderTextColor={theme.textSecondary}
                                        autoCapitalize="characters"
                                    />
                                    <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 6, fontStyle: 'italic', opacity: 0.8 }}>
                                        Type only key characters. Dashes (-) are added automatically.
                                    </Text>

                                    <Text style={{ color: theme.textSecondary, marginBottom: 8, marginTop: 16 }}>Select Home</Text>
                                    <View style={{ gap: 8 }}>
                                        {claimHomes.length === 0 && !claimBusy && (
                                            <Text style={{ color: theme.textSecondary }}>No available homes to claim to.</Text>
                                        )}
                                        {claimHomes.map(h => (
                                            <TouchableOpacity
                                                key={h.id}
                                                style={[styles.homeSelectBtn, { borderColor: claimHomeId === h.id ? theme.primary : theme.border, backgroundColor: claimHomeId === h.id ? theme.primary + '20' : theme.card }]}
                                                onPress={() => setClaimHomeId(h.id)}
                                            >
                                                <Text style={{ color: claimHomeId === h.id ? theme.primary : theme.text }}>{h.name}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.payButton, { backgroundColor: theme.primary, marginTop: 32, opacity: claimBusy || !claimHomeId || !serialCodeStr ? 0.5 : 1 }]}
                                        disabled={claimBusy || claimHomes.length === 0 || !claimHomeId || !serialCodeStr}
                                        onPress={submitClaim}
                                    >
                                        {claimBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.payButtonText}>Activate</Text>}
                                    </TouchableOpacity>
                                </ScrollView>
                            </View>
                        )}
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* Modal picker for Unassigned Devices */}
            <Modal visible={mappingModal.visible} transparent animationType="slide" onRequestClose={() => setMappingModal({ visible: false, espId: null, channel: null })}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, borderColor: theme.border, borderWidth: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Select Device for CH {mappingModal.channel}</Text>
                            <TouchableOpacity onPress={() => setMappingModal({ visible: false, espId: null, channel: null })}>
                                <X color={theme.textSecondary} size={24} />
                            </TouchableOpacity>
                        </View>

                        {currentHome?.unassignedDevices?.length === 0 ? (
                            <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>All devices are assigned. Create a new device first.</Text>
                        ) : (
                            <ScrollView>
                                {currentHome?.unassignedDevices?.map((ud: any) => (
                                    <TouchableOpacity
                                        key={ud.id}
                                        style={[styles.unassignedCard, { backgroundColor: theme.card, borderColor: theme.border }]}
                                        onPress={() => handleAssign(ud.id)}
                                    >
                                        <Monitor color={theme.primary} size={24} style={{ marginRight: 12 }} />
                                        <View>
                                            <Text style={{ color: theme.text, fontWeight: '600', fontSize: 16 }}>{ud.name}</Text>
                                            <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{ud.type.toUpperCase()}</Text>
                                        </View>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Modal picker for Details */}
            <Modal visible={!!detailsModal} transparent animationType="slide" onRequestClose={() => setDetailsModal(null)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
                    <View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, borderColor: theme.border, borderWidth: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ color: theme.text, fontSize: 18, fontWeight: 'bold' }}>Board Details</Text>
                            <TouchableOpacity onPress={() => setDetailsModal(null)}>
                                <X color={theme.textSecondary} size={24} />
                            </TouchableOpacity>
                        </View>

                        {detailsModal && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 'bold' }}>MAC ADDRESS</Text>
                                    <Text style={{ color: theme.text, fontSize: 16, marginTop: 4 }}>{detailsModal.macAddress}</Text>
                                </View>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 'bold' }}>IP ADDRESS</Text>
                                    <Text style={{ color: theme.text, fontSize: 16, marginTop: 4 }}>{detailsModal.ipAddress || 'Offline'}</Text>
                                </View>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 'bold' }}>FIRMWARE (OTA)</Text>
                                    <Text style={{ color: theme.text, fontSize: 16, marginTop: 4 }}>v{detailsModal.firmwareVersion}</Text>
                                </View>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 'bold' }}>HARDWARE MODEL</Text>
                                    <Text style={{ color: theme.text, fontSize: 16, marginTop: 4 }}>{detailsModal.modelCode}</Text>
                                </View>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 'bold' }}>FACTORY SERIAL</Text>
                                    <Text style={{ color: theme.text, fontSize: 16, marginTop: 4 }}>{detailsModal.serialCode}</Text>
                                </View>
                                <View style={{ marginBottom: 16 }}>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: 'bold' }}>LAST CONNECTED (HEARTBEAT)</Text>
                                    <Text style={{ color: theme.text, fontSize: 14, marginTop: 4 }}>{detailsModal.lastSeen ? `${new Date(detailsModal.lastSeen).toLocaleString()} (${getRelativeTime(detailsModal.lastSeen)})` : 'Never'}</Text>
                                </View>
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
            {AlertComponent}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { paddingTop: 64, paddingBottom: 16, paddingHorizontal: 24 },
    headerTitle: { fontSize: 32, fontWeight: 'bold' },
    headerActionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    filterChip: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 24, borderWidth: 1, marginRight: 12 },
    filterText: { fontWeight: '500' },
    emptyBox: { borderRadius: 16, padding: 30, borderWidth: 1, alignItems: 'center', marginVertical: 40 },
    boardCard: { borderRadius: 20, padding: 20, borderWidth: 1, marginBottom: 20 },
    boardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    ledBtn: { borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    badge: { fontSize: 10, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden', marginRight: 8, flexShrink: 1 },
    channelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1 },
    chBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    unmapBtn: { borderWidth: 1, borderRadius: 8, padding: 6 },
    unassignedCard: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
    input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, fontFamily: 'monospace' },
    homeSelectBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
    payButton: { padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    payButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
});
