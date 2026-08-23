import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, KeyboardAvoidingView, Platform, FlatList, DeviceEventEmitter } from 'react-native';
import { ArrowLeft, MessageSquare, Ticket, Send, CheckCheck, Trash2, Key } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from 'expo-haptics';
import { getMySupportChat, getMySupportTickets, sendSupportReply, submitSupport, SupportMessage, SupportTicket, deleteMySupportMessage } from '../api/support';

const SUBJECTS = [
    "Order / Delivery Help",
    "Product Question",
    "Warranty / Return",
    "OTA / Setup Help",
    "Device Not Working",
    "Feedback / Suggestion",
    "Other",
];

export function SupportScreen({ onClose, user }: { onClose: () => void, user?: any }) {
    const { theme } = useTheme();
    const [tab, setTab] = useState<'CHAT' | 'TICKETS'>('CHAT');

    // Chat State
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [draft, setDraft] = useState('');
    const [chatLoading, setChatLoading] = useState(true);
    const [chatSending, setChatSending] = useState(false);
    const flatListRef = useRef<FlatList>(null);

    // Tickets State
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [ticketsLoading, setTicketsLoading] = useState(true);

    // New Ticket State
    const [showingNewTicket, setShowingNewTicket] = useState(false);
    const [formSubject, setFormSubject] = useState(SUBJECTS[0]);
    const [formMessage, setFormMessage] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [ticketSubmitting, setTicketSubmitting] = useState(false);
    const [ticketMsg, setTicketMsg] = useState<{ ok: boolean, text: string } | null>(null);

    useEffect(() => {
        if (tab === 'CHAT') {
            loadChat();
        } else {
            loadTickets();
        }
    }, [tab]);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener('support_sync', () => loadChat(true));
        return () => sub.remove();
    }, []);

    const loadChat = async (isBackground = false) => {
        if (!isBackground) setChatLoading(true);
        const res = await getMySupportChat();
        if (res.success && res.data) {
            setMessages(res.data.messages || []);
        }
        if (!isBackground) setChatLoading(false);
    };

    const loadTickets = async () => {
        setTicketsLoading(true);
        const res = await getMySupportTickets();
        if (res.success && res.data) {
            setTickets(res.data);
        }
        setTicketsLoading(false);
    };

    const handleSendChat = async () => {
        if (!draft.trim() || chatSending) return;
        setChatSending(true);
        const res = await sendSupportReply(draft.trim());
        if (res.success) {
            setDraft('');
            await loadChat();
        }
        setChatSending(false);
    };

    const handleDeleteMsg = async (id: number) => {
        await deleteMySupportMessage(id);
        await loadChat();
    };

    const handleSubmitTicket = async () => {
        if (!formMessage.trim()) return;
        setTicketSubmitting(true);
        setTicketMsg(null);
        const res = await submitSupport({
            subject: formSubject,
            message: formMessage.trim(),
            phone: formPhone.trim() || undefined
        });
        if (res.success) {
            setTicketMsg({ ok: true, text: `Ticket #${res.data?.id} submitted successfully!` });
            setFormMessage('');
            setFormSubject(SUBJECTS[0]);
            setFormPhone('');
            await loadTickets();
            setTimeout(() => { setShowingNewTicket(false); setTicketMsg(null); }, 2000);
        } else {
            setTicketMsg({ ok: false, text: "Failed to submit ticket." });
        }
        setTicketSubmitting(false);
    };

    const renderMessage = ({ item }: { item: SupportMessage }) => {
        const isUser = item.senderRole === 'user';
        return (
            <View style={[styles.msgWrapper, isUser ? styles.msgRight : styles.msgLeft]}>
                <View style={[styles.msgBubble, {
                    backgroundColor: isUser ? theme.primary : theme.card,
                    borderColor: isUser ? theme.primary : theme.border,
                    borderWidth: 1
                }]}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: isUser ? '#ffffff90' : theme.textSecondary, marginBottom: 4, textTransform: 'uppercase' }}>
                        {isUser ? 'You' : 'Support'}
                    </Text>
                    <Text style={{ fontSize: 14, color: isUser ? '#fff' : theme.text, lineHeight: 20 }}>
                        {item.message}
                    </Text>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4, gap: 4 }}>
                        <Text style={{ fontSize: 9, color: isUser ? '#ffffff80' : theme.textSecondary }}>
                            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                        {isUser && (
                            <CheckCheck size={12} color={item.readByAdmin ? "#93c5fd" : "#ffffff70"} />
                        )}
                        {isUser && (
                            <TouchableOpacity onPress={() => handleDeleteMsg(item.id)} style={{ marginLeft: 6 }}>
                                <Trash2 size={12} color="#fca5a5" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={[styles.container, { backgroundColor: theme.background }]}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            {/* Header */}
            <View style={[styles.header, { borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={onClose} style={[styles.iconButton, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <ArrowLeft color={theme.text} size={20} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: theme.text }]}>Help & Support</Text>
                </View>
            </View>

            {/* Tab Bar */}
            <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 }}>
                <TouchableOpacity
                    onPress={() => setTab('CHAT')}
                    style={[styles.tab, { borderBottomColor: tab === 'CHAT' ? theme.primary : 'transparent' }]}
                >
                    <MessageSquare color={tab === 'CHAT' ? theme.primary : theme.textSecondary} size={18} style={{ marginRight: 8 }} />
                    <Text style={[styles.tabText, { color: tab === 'CHAT' ? theme.primary : theme.textSecondary }]}>Live Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setTab('TICKETS')}
                    style={[styles.tab, { borderBottomColor: tab === 'TICKETS' ? theme.primary : 'transparent' }]}
                >
                    <Ticket color={tab === 'TICKETS' ? theme.primary : theme.textSecondary} size={18} style={{ marginRight: 8 }} />
                    <Text style={[styles.tabText, { color: tab === 'TICKETS' ? theme.primary : theme.textSecondary }]}>My Tickets</Text>
                </TouchableOpacity>
            </View>

            {/* Content */}
            {tab === 'CHAT' ? (
                <View style={{ flex: 1 }}>
                    {chatLoading ? (
                        <ActivityIndicator style={{ flex: 1 }} color={theme.primary} />
                    ) : messages.length === 0 ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                            <MessageSquare color={theme.textSecondary} size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
                            <Text style={{ color: theme.textSecondary, textAlign: 'center' }}>No messages yet. Send a message to start talking with our support team!</Text>
                        </View>
                    ) : (
                        <FlatList
                            ref={flatListRef}
                            data={[...messages].reverse()}
                            keyExtractor={i => i.id.toString()}
                            renderItem={renderMessage}
                            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 20 }}
                            inverted={true}
                        />
                    )}

                    {/* Chat Input */}
                    <View style={[styles.inputBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <TextInput
                            placeholder="Type your message..."
                            placeholderTextColor={theme.textSecondary}
                            value={draft}
                            onChangeText={setDraft}
                            style={[styles.textInput, { color: theme.text, backgroundColor: theme.background, borderColor: theme.border }]}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.sendBtn, { backgroundColor: draft.trim() ? theme.primary : theme.border }]}
                            disabled={!draft.trim() || chatSending}
                            onPress={handleSendChat}
                        >
                            {chatSending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ padding: 20 }}>
                    <TouchableOpacity
                        style={[styles.newTicketBtn, { backgroundColor: theme.primary }]}
                        onPress={() => { Haptics.selectionAsync(); setShowingNewTicket(!showingNewTicket); }}
                    >
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>
                            {showingNewTicket ? 'View My Tickets' : '+ Create New Ticket'}
                        </Text>
                    </TouchableOpacity>

                    {showingNewTicket ? (
                        <View style={[styles.formCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>SUBJECT</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                                {SUBJECTS.map(subj => (
                                    <TouchableOpacity
                                        key={subj}
                                        onPress={() => setFormSubject(subj)}
                                        style={[styles.chip, { backgroundColor: formSubject === subj ? theme.primary + '20' : theme.background, borderColor: formSubject === subj ? theme.primary : theme.border }]}
                                    >
                                        <Text style={{ color: formSubject === subj ? theme.primary : theme.textSecondary, fontSize: 13, fontWeight: '600' }}>{subj}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>

                            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>PHONE (OPTIONAL)</Text>
                            <TextInput
                                placeholder="+91 ..."
                                placeholderTextColor={theme.textSecondary}
                                value={formPhone}
                                onChangeText={setFormPhone}
                                style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                            />

                            <Text style={[styles.formLabel, { color: theme.textSecondary }]}>MESSAGE *</Text>
                            <TextInput
                                placeholder="Describe your issue..."
                                placeholderTextColor={theme.textSecondary}
                                value={formMessage}
                                onChangeText={setFormMessage}
                                multiline
                                numberOfLines={4}
                                style={[styles.formInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text, minHeight: 80, textAlignVertical: 'top' }]}
                            />

                            <TouchableOpacity
                                onPress={handleSubmitTicket}
                                disabled={!formMessage.trim() || ticketSubmitting}
                                style={[styles.submitBtn, { backgroundColor: theme.primary, opacity: (!formMessage.trim() || ticketSubmitting) ? 0.5 : 1 }]}
                            >
                                {ticketSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={{ color: '#fff', fontWeight: 'bold' }}>Submit Ticket</Text>}
                            </TouchableOpacity>

                            {ticketMsg && (
                                <Text style={{ marginTop: 12, color: ticketMsg.ok ? '#10b981' : '#ef4444', textAlign: 'center', fontWeight: 'bold' }}>
                                    {ticketMsg.ok ? '✅ ' : '✗ '}{ticketMsg.text}
                                </Text>
                            )}
                        </View>
                    ) : (
                        <View>
                            {ticketsLoading ? (
                                <ActivityIndicator style={{ marginTop: 40 }} color={theme.primary} />
                            ) : tickets.length === 0 ? (
                                <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>You have no support tickets.</Text>
                            ) : (
                                tickets.map(ticket => (
                                    <View key={ticket.id} style={[styles.ticketCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8, alignItems: 'center' }}>
                                            <Text style={{ fontWeight: 'bold', color: theme.text, fontSize: 13 }}>#{ticket.id} • {ticket.subject}</Text>
                                            <View style={[styles.badge, { backgroundColor: theme.primary + '20' }]}>
                                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.primary, textTransform: 'uppercase' }}>{ticket.status}</Text>
                                            </View>
                                        </View>
                                        <Text style={{ color: theme.textSecondary, fontSize: 14, marginBottom: 12 }}>{ticket.message}</Text>
                                        <Text style={{ color: theme.textSecondary, fontSize: 11 }}>{new Date(ticket.createdAt).toLocaleString()}</Text>
                                    </View>
                                ))
                            )}
                        </View>
                    )}
                </ScrollView>
            )}
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1 },
    iconButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderBottomWidth: 2 },
    tabText: { fontSize: 15, fontWeight: 'bold' },
    inputBox: { flexDirection: 'row', padding: 12, paddingBottom: 24, borderTopWidth: 1, alignItems: 'flex-end', gap: 10 },
    textInput: { flex: 1, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, minHeight: 40, maxHeight: 100, fontSize: 15 },
    sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
    msgWrapper: { width: '100%', marginBottom: 12 },
    msgRight: { alignItems: 'flex-end' },
    msgLeft: { alignItems: 'flex-start' },
    msgBubble: { maxWidth: '85%', padding: 12, borderRadius: 16 },
    newTicketBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
    formCard: { padding: 20, borderRadius: 16, borderWidth: 1 },
    formLabel: { fontSize: 11, fontWeight: '800', marginBottom: 8, letterSpacing: 0.5 },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, borderWidth: 1, marginRight: 8 },
    formInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, marginBottom: 20 },
    submitBtn: { padding: 16, borderRadius: 12, alignItems: 'center' },
    ticketCard: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
    badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 }
});
