import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { X, Send, CheckCircle, Bot, Home as HomeIcon } from 'lucide-react-native';
import * as assistantApi from '../api/assistant';
import { getHomes } from '../api/hardware';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

export function AssistantModal({ isVisible, onClose, homeId }: { isVisible: boolean; onClose: () => void; homeId: number | null }) {
    const { theme } = useTheme();

    // Data State
    const [homes, setHomes] = useState<any[]>([]);
    const [activeHomeId, setActiveHomeId] = useState<number | null>(null);
    const [activeChatId, setActiveChatId] = useState<number | null>(null);
    const [messages, setMessages] = useState<assistantApi.AssistantMessage[]>([]);

    // UI State
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(true);
    const scrollViewRef = useRef<ScrollView>(null);

    useEffect(() => {
        if (isVisible) {
            if (homeId) setActiveHomeId(homeId);
            loadInitialData(homeId);
        } else {
            // Memory cleanup on close
            setMessages([]);
            setInput('');
        }
    }, [isVisible, homeId]);

    useEffect(() => {
        if (activeHomeId && isVisible) {
            loadChatForHome(activeHomeId);
        }
    }, [activeHomeId, isVisible]);

    const loadInitialData = async (presetHomeId: number | null) => {
        try {
            const aiPref = await SecureStore.getItemAsync('pref_ai_suggestions');
            if (aiPref !== null) {
                setShowSuggestions(aiPref === 'true');
            }

            const hRes = await getHomes();
            if (hRes.success) {
                setHomes(hRes.data);
                // If dashboard didn't specify a home, pick the first connected home
                if (!presetHomeId && hRes.data.length > 0) {
                    setActiveHomeId(hRes.data[0].id);
                }
            }
        } catch (e) {
            console.log('Init error', e);
        }
    };

    // The backend now securely maps createChat to always return the SINGLE permanent thread for a Home
    const loadChatForHome = async (hId: number) => {
        setLoading(true);
        try {
            const chatRes = await assistantApi.createChat(hId);
            if (chatRes.success) {
                const cId = chatRes.data.id;
                setActiveChatId(cId);
                const msgRes = await assistantApi.listMessages(cId);
                if (msgRes.success) {
                    setMessages(msgRes.data);
                }
            }
        } catch (e) {
            console.log('Thread fetch err', e);
        }
        setLoading(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: false }), 200);
    };

    const handleSend = async (overrideText?: string) => {
        const textToProcess = overrideText || input.trim();
        if (!textToProcess || !activeChatId) return;

        setInput('');
        setLoading(true);

        // Optimistic UX
        const tempMsg: assistantApi.AssistantMessage = {
            id: Date.now(), chatId: activeChatId, role: 'user', content: textToProcess, proposal: null, createdAt: new Date().toISOString()
        };
        setMessages(prev => [...prev, tempMsg]);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            const res = await assistantApi.sendMessage(activeChatId, textToProcess);
            if (res.success) {
                setMessages(prev => {
                    const filtered = prev.filter(m => m.id !== tempMsg.id);
                    return [...filtered, res.data.userMessage, res.data.assistantMessage];
                });
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            }
        } catch (e) {
            console.log("Send err", e);
        }
        setLoading(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    };

    const handleConfirm = async (messageId: number) => {
        if (!activeChatId) return;
        setLoading(true);
        try {
            const res = await assistantApi.confirmProposal(activeChatId, messageId);
            if (res.success) {
                setMessages(prev => [...prev, res.data.assistantMessage]);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            }
        } catch (e) {
            console.log('Confirm error', e);
        }
        setLoading(false);
        setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
    };

    return (
        <Modal visible={isVisible} animationType="slide" transparent={true} onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBg}>
                <View style={[styles.container, { backgroundColor: theme.background, borderColor: theme.border }]}>

                    {/* Header */}
                    <View style={[styles.header, { borderBottomColor: theme.border }]}>
                        <View style={styles.headerLeft}>
                            <Bot color={theme.accent} size={24} />
                            <Text style={[styles.headerTitle, { color: theme.text }]}>
                                AI Assist
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.card }]}>
                            <X color={theme.textSecondary} size={20} />
                        </TouchableOpacity>
                    </View>

                    {/* Context Switching Bar (1 Persistent thread per Home) */}
                    {homes.length > 1 && (
                        <View style={[styles.homeBar, { borderBottomColor: theme.border }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                {homes.map(h => (
                                    <TouchableOpacity
                                        key={h.id}
                                        style={[
                                            styles.homeChip,
                                            activeHomeId === h.id ? { backgroundColor: theme.primary, borderColor: theme.primary } : { borderColor: theme.border, backgroundColor: theme.card }
                                        ]}
                                        onPress={() => {
                                            if (activeHomeId !== h.id) setActiveHomeId(h.id);
                                        }}
                                    >
                                        {activeHomeId === h.id && <HomeIcon color="#fff" size={14} />}
                                        <Text style={{
                                            color: activeHomeId === h.id ? '#fff' : theme.textSecondary,
                                            fontSize: 13,
                                            fontWeight: activeHomeId === h.id ? '700' : '500'
                                        }}>
                                            {h.name}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Chat Area */}
                    <ScrollView ref={scrollViewRef} style={styles.chatArea} contentContainerStyle={{ padding: 20 }}>
                        {loading && messages.length === 0 && (
                            <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
                        )}
                        {!loading && messages.length === 0 && (
                            <View style={styles.emptyBox}>
                                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                                    Speak naturally to control this home.
                                </Text>
                            </View>
                        )}
                        {messages.map((msg, idx) => {
                            const isUser = msg.role === 'user';
                            return (
                                <View key={msg.id || idx} style={[styles.messageRow, { justifyContent: isUser ? 'flex-end' : 'flex-start' }]}>
                                    <View style={[
                                        styles.bubble,
                                        isUser ?
                                            { backgroundColor: theme.primary, borderBottomRightRadius: 4 } :
                                            { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderBottomLeftRadius: 4 }
                                    ]}>
                                        <Text style={[styles.messageText, { color: isUser ? '#ffffff' : theme.text }]}>{msg.content}</Text>

                                        {!isUser && msg.proposal && msg.proposal.length > 0 && (
                                            <View style={styles.proposalBox}>
                                                {msg.proposal.map((p, i) => (
                                                    <View key={i} style={styles.proposalItem}>
                                                        <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>{p.deviceName}</Text>
                                                        <Text style={{ color: p.action === 'on' ? '#4ade80' : '#f87171', fontWeight: 'bold' }}>
                                                            {p.action.toUpperCase()}
                                                        </Text>
                                                    </View>
                                                ))}
                                                <TouchableOpacity
                                                    style={[styles.confirmBtn, { backgroundColor: theme.accent }]}
                                                    disabled={loading}
                                                    onPress={() => handleConfirm(msg.id)}
                                                >
                                                    <CheckCircle color="#fff" size={16} />
                                                    <Text style={styles.confirmText}>Confirm & Execute</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            )
                        })}
                        {loading && messages.length > 0 && (
                            <View style={{ alignItems: 'flex-start', marginVertical: 10 }}>
                                <View style={[styles.bubble, { backgroundColor: theme.card, borderColor: theme.border, borderWidth: 1, borderBottomLeftRadius: 4, width: 60, alignItems: 'center' }]}>
                                    <ActivityIndicator size="small" color={theme.textSecondary} />
                                </View>
                            </View>
                        )}
                    </ScrollView>

                    {/* Suggestions Box */}
                    {showSuggestions && (
                        <View style={[styles.suggestionsWrapper, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                                {["Turn off everything", "Turn on the AC", "Are any devices left ON?", "Set the living room cool"].map((sug, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[styles.suggestionChip, { backgroundColor: theme.background, borderColor: theme.border }]}
                                        onPress={() => {
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
                                            handleSend(sug);
                                        }}
                                    >
                                        <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600' }}>{sug}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* Input Editor */}
                    <View style={[styles.inputRow, { backgroundColor: theme.card, borderTopColor: showSuggestions ? 'transparent' : theme.border }]}>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
                            placeholder=" saare lights off karo..."
                            placeholderTextColor={theme.textSecondary}
                            value={input}
                            onChangeText={setInput}
                            onSubmitEditing={() => handleSend()}
                        />
                        <TouchableOpacity style={[styles.sendBtn, { backgroundColor: input.trim() ? theme.accent : theme.border }]} disabled={!input.trim() || loading} onPress={() => handleSend()}>
                            <Send color="#ffffff" size={18} style={input.trim() ? { transform: [{ translateX: 2 }, { translateY: -2 }] } : {}} />
                        </TouchableOpacity>
                    </View>

                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    container: { height: '88%', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    headerTitle: { fontSize: 20, fontWeight: '800' },
    closeBtn: { padding: 8, borderRadius: 20 },

    // Context Bar
    homeBar: { flexDirection: 'row', padding: 12, borderBottomWidth: 1, alignItems: 'center' },
    homeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },

    // Chat Area 
    chatArea: { flex: 1 },
    emptyBox: { alignItems: 'center', marginTop: 40 },
    emptyText: { fontSize: 14, fontWeight: '500' },
    messageRow: { flexDirection: 'row', marginBottom: 16 },
    bubble: { maxWidth: '85%', padding: 14, borderRadius: 18 },
    messageText: { fontSize: 15, lineHeight: 22 },
    proposalBox: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    proposalItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 10, marginTop: 4, gap: 8 },
    confirmText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    suggestionsWrapper: { paddingVertical: 12, borderTopWidth: 1 },
    suggestionChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginRight: 8 },
    inputRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, alignItems: 'center', gap: 12 },
    input: { flex: 1, borderWidth: 1, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 14, fontSize: 16 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' }
});
