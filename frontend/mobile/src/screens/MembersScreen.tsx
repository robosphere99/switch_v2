import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, ScrollView, TouchableOpacity, TextInput,
    ActivityIndicator, Alert, StyleSheet, Modal, Share, Image, Clipboard, Switch, SafeAreaView, Platform, StatusBar
} from 'react-native';
import {
    X, UserPlus, Users, Copy, Share2,
    Trash2, ChevronDown, Key, CheckCheck
} from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import * as Haptics from '../utils/haptics';
import {
    inviteMember, listInvitations, revokeInvitation,
    changeMemberRole, removeMember, acceptInvite, updateMemberSafety, setMemberDeviceAccess
} from '../api/members';
import { getHomeMembers, getDevices } from '../api/hardware';
import { DeviceEventEmitter } from 'react-native';
import { API_URL } from '../api/client';
import { useThemedAlert } from '../components/ThemedAlert';

const API_BASE = API_URL.replace(/\/api$/, '');

type Role = 'owner' | 'admin' | 'member' | 'viewer';

const ROLE_CONFIG: Record<Role, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    owner: { label: 'Owner', color: '#f59e0b', bg: '#f59e0b22', icon: null },
    admin: { label: 'Admin', color: '#3b82f6', bg: '#3b82f622', icon: null },
    member: { label: 'Member', color: '#10b981', bg: '#10b98122', icon: null },
    viewer: { label: 'Viewer', color: '#6b7280', bg: '#6b728022', icon: null },
};

function RoleBadge({ role, showChevron }: { role: Role, showChevron?: boolean }) {
    const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.viewer;
    return (
        <View style={{ backgroundColor: cfg.bg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: cfg.color + '55', flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: cfg.color, fontWeight: '800', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{cfg.label}</Text>
            {showChevron && <ChevronDown color={cfg.color} size={14} />}
        </View>
    );
}

export function MembersScreen({ homeId, myRole, homeList, onClose }: {
    homeId: number;
    myRole: Role;
    homeList: any[];
    onClose: () => void;
}) {
    const { theme } = useTheme();
    const { showAlert, AlertComponent } = useThemedAlert();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [activeHomeId, setActiveHomeId] = useState(homeId);

    // Invite form state
    const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
    const [inviting, setInviting] = useState(false);
    const [createdCode, setCreatedCode] = useState<string | null>(null);
    const [inviteUserFound, setInviteUserFound] = useState<boolean | null>(null);

    // Join home state
    const [joinCode, setJoinCode] = useState('');
    const [joining, setJoining] = useState(false);
    const [joinMsg, setJoinMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [joinModalVisible, setJoinModalVisible] = useState(false);

    // FIX: Derive role dynamically from the currently active home (not static prop)
    const activeHome = homeList.find((h: any) => (h.homeId || h.id) === activeHomeId);
    // Extract role from the active home object, supporting both flat and nested schemas
    const derivedRole = activeHome?.role ?? activeHome?.members?.[0]?.role ?? myRole;
    const canManage = derivedRole === 'owner' || derivedRole === 'admin';

    const loadData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [membRes, invRes] = await Promise.all([
                getHomeMembers(activeHomeId),
                canManage ? listInvitations(activeHomeId) : Promise.resolve({ success: false, data: [] }),
            ]);
            if (membRes?.success) setMembers(membRes.data);
            if (invRes?.success) setInvitations(invRes.data);
        } catch (e) {
            console.log('MembersScreen loadData error', e);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [activeHomeId, canManage]);

    useEffect(() => { loadData(); }, [loadData]);

    // Real-time auto refresh for MembersScreen
    useEffect(() => {
        const sub1 = DeviceEventEmitter.addListener('home_updated', (data: any) => {
            if (data.homeId === activeHomeId) loadData(true);
        });
        const sub2 = DeviceEventEmitter.addListener('access_revoked', (data: any) => {
            if (data.homeId === activeHomeId) loadData(true);
        });
        return () => {
            sub1.remove();
            sub2.remove();
        };
    }, [activeHomeId, loadData]);

    const handleInvite = async () => {
        setInviting(true);
        setCreatedCode(null);
        setInviteUserFound(null);
        try {
            const res = await inviteMember(activeHomeId, undefined, inviteRole);
            if (res?.success) {
                setCreatedCode(res.data?.inviteCode);
                setInviteUserFound(res.data?.userFound ?? false);
                loadData();
            } else {
                showAlert('Failed', res?.error?.message || 'Please try again.');
            }
        } catch (e: any) {
            showAlert('Error', e?.message || 'Invite failed');
        } finally {
            setInviting(false);
        }
    };

    const handleCopyCode = (code: string) => {
        Clipboard.setString(code);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showAlert('Copied!', `Invite code "${code}" copied to clipboard.`);
    };

    const handleShareCode = async (code: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const joinLink = `https://switchnest.app/join?code=${code}`;
        const message =
            `🏠 *You're invited to join my SwitchNest Smart Home!*\n\n` +
            `Use this invite code to join:\n\n` +
            `🔑 *${code}*\n\n` +
            `Or tap the link to join directly:\n${joinLink}\n\n` +
            `Steps:\n1. Download SwitchNest from Play Store / App Store\n2. Register or log in\n3. Go to Family section and enter the code\n\nSee you inside! 🚀`;
        try {
            await Share.share({ message, url: joinLink, title: 'Join my SwitchNest Home' });
        } catch (e) { console.log(e); }
    };

    const handleRevoke = async (invId: number) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await revokeInvitation(activeHomeId, invId);
            setInvitations(prev => prev.filter(i => i.id !== invId));
        } catch (e) { console.log(e); }
    };

    const handleRoleChange = async (userId: number, role: Role) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await changeMemberRole(activeHomeId, userId, role);
            setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role } : m));
        } catch (e: any) {
            showAlert('Error', e?.message || 'Could not change role');
        }
    };

    const handleRemove = (userId: number, username: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        showAlert(
            'Remove Member',
            `Remove "${username}" from this home?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove', style: 'destructive', onPress: async () => {
                        try {
                            await removeMember(activeHomeId, userId);
                            setMembers(prev => prev.filter(m => m.userId !== userId));
                        } catch (e: any) {
                            showAlert('Error', e?.message || 'Could not remove member');
                        }
                    }
                }
            ]
        );
    };

    const handleJoin = async () => {
        if (joinCode.trim().length < 6) return;
        setJoining(true);
        setJoinMsg(null);
        try {
            const res = await acceptInvite(joinCode.trim());
            if (res?.success) {
                setJoinMsg({ ok: true, text: `Joined "${res.data?.name}" successfully! Pull to refresh.` });
                setJoinCode('');
            } else {
                setJoinMsg({ ok: false, text: res?.error?.message || 'Invalid invite code.' });
            }
        } catch (e: any) {
            setJoinMsg({ ok: false, text: e?.message || 'Join failed.' });
        } finally {
            setJoining(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.background, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
            {/* Header */}
            <View style={[styles.header, { borderColor: theme.border }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Users color={theme.primary} size={24} />
                    <Text style={[styles.title, { color: theme.text }]}>Family</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setJoinModalVisible(true); }} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: theme.primary + '20', borderRadius: 12 }}>
                        <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 12 }}>Join Home</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                        <X color={theme.textSecondary} size={26} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
                {/* Home Switcher */}
                {homeList.length > 1 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                        {homeList.map((h: any) => {
                            const hId = h.homeId || h.id;
                            const isActive = hId === activeHomeId;
                            return (
                                <TouchableOpacity
                                    key={hId}
                                    onPress={() => { Haptics.selectionAsync(); setActiveHomeId(hId); }}
                                    style={{
                                        paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 10,
                                        backgroundColor: isActive ? theme.primary + '20' : theme.card,
                                        borderWidth: 1, borderColor: isActive ? theme.primary : theme.border
                                    }}
                                >
                                    <Text style={{ color: isActive ? theme.primary : theme.textSecondary, fontWeight: '700' }}>
                                        🏠 {h.homeName || h.name || h.home?.name || `Home ${hId}`}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                )}

                {/* Invite Form (only admin/owner) */}
                {canManage && (
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.primary + '30' }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <UserPlus color={theme.primary} size={18} />
                            <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>INVITE A FAMILY MEMBER</Text>
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 14 }}>
                            Pick a role and generate an invite code. Share it via WhatsApp, Telegram, or any app.
                        </Text>

                        {/* Role Selector */}
                        <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 8 }}>Role:</Text>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
                            {([
                                { r: 'admin' as const, emoji: '🛡️', desc: 'Full control' },
                                { r: 'member' as const, emoji: '👤', desc: 'Use devices' },
                                { r: 'viewer' as const, emoji: '👁️', desc: 'View only' },
                            ]).map(({ r, emoji, desc }) => (
                                <TouchableOpacity
                                    key={r}
                                    onPress={() => { Haptics.selectionAsync(); setInviteRole(r); }}
                                    style={{
                                        flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center',
                                        borderWidth: 1.5,
                                        backgroundColor: inviteRole === r ? theme.primary + '20' : theme.background,
                                        borderColor: inviteRole === r ? theme.primary : theme.border
                                    }}
                                >
                                    <Text style={{ fontSize: 18, marginBottom: 2 }}>{emoji}</Text>
                                    <Text style={{ color: inviteRole === r ? theme.primary : theme.textSecondary, fontWeight: inviteRole === r ? '700' : '500', fontSize: 12, textTransform: 'capitalize' }}>{r}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 10 }}>{desc}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={handleInvite}
                            disabled={inviting}
                            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                        >
                            {inviting ? <ActivityIndicator color="#000" size="small" /> : (
                                <>
                                    <UserPlus color="#000" size={16} />
                                    <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>Create Invite Code</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        {/* Invite Result: two different UX paths */}
                        {createdCode && inviteUserFound === true && (
                            // ✅ User already on SwitchNest — clean "sent" confirmation
                            <View style={{ marginTop: 16, backgroundColor: '#10b98115', borderRadius: 14, padding: 16, borderWidth: 1.5, borderColor: '#10b98140', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#10b98130', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCheck color="#10b981" size={22} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 15 }}>Invite Sent!</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 12, marginTop: 3 }}>
                                        They're already on SwitchNest. An invite notification has been sent to their account.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {createdCode && inviteUserFound === false && (
                            // 📋 User not registered — show full invite card with code + share
                            <View style={{ marginTop: 16, backgroundColor: '#f59e0b10', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#f59e0b40' }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <Text style={{ fontSize: 16 }}>📬</Text>
                                    <Text style={{ color: '#f59e0b', fontWeight: '700', fontSize: 14 }}>Not on SwitchNest yet</Text>
                                </View>
                                <Text style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 14 }}>
                                    Invite code generated! Share it — they can use it after downloading and signing up.
                                </Text>

                                {/* Code chip + action buttons */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <TouchableOpacity
                                        onLongPress={() => handleCopyCode(createdCode)}
                                        delayLongPress={300}
                                        onPress={() => handleCopyCode(createdCode)}
                                        style={{
                                            flex: 1, backgroundColor: '#0d1117', borderRadius: 10, paddingVertical: 14,
                                            alignItems: 'center', borderWidth: 1, borderColor: '#f59e0b50'
                                        }}
                                    >
                                        <Text style={{ color: '#f59e0b', fontWeight: '900', fontSize: 28, letterSpacing: 6, fontVariant: ['tabular-nums'] }}>
                                            {createdCode}
                                        </Text>
                                        <Text style={{ color: '#f59e0b80', fontSize: 10, marginTop: 4 }}>Tap or hold to copy</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => handleShareCode(createdCode)}
                                        style={{
                                            width: 52, height: 52, borderRadius: 14,
                                            backgroundColor: theme.primary, alignItems: 'center', justifyContent: 'center'
                                        }}
                                    >
                                        <Share2 color="#000" size={22} />
                                    </TouchableOpacity>
                                </View>

                                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 12, lineHeight: 16 }}>
                                    📲 Share via WhatsApp / Telegram with a ready-made invite message.{'\n'}
                                    They open SwitchNest → Family → Join Home and enter this code.
                                </Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Pending Invitations */}
                {canManage && invitations.length > 0 && (
                    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 12 }}>⏳ PENDING INVITATIONS</Text>
                        {invitations.map((inv: any) => (
                            <View key={inv.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: theme.border }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ color: theme.text, fontWeight: '600', fontSize: 14 }}>{inv.email}</Text>
                                    <Text style={{ color: theme.primary, fontSize: 11, fontFamily: 'monospace', marginTop: 2 }}>{inv.inviteCode} • {inv.role}</Text>
                                    <Text style={{ color: theme.textSecondary, fontSize: 11 }}>Expires {new Date(inv.expiresAt).toLocaleDateString()}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleRevoke(inv.id)} style={{ padding: 6 }}>
                                    <Text style={{ color: '#ef4444', fontWeight: '700', fontSize: 12 }}>Revoke</Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </View>
                )}

                {/* Members List */}
                <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    <Text style={{ color: theme.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: 12 }}>👨‍👩‍👧‍👦 HOME MEMBERS</Text>
                    {loading ? (
                        <ActivityIndicator size="large" color={theme.primary} style={{ marginVertical: 20 }} />
                    ) : members.length > 0 ? (
                        members.map((m: any) => (
                            <MemberRow
                                key={m.id || m.userId}
                                member={m}
                                homeId={activeHomeId}
                                canManage={canManage}
                                onRoleChange={handleRoleChange}
                                onRemove={handleRemove}
                                loadData={loadData}
                            />
                        ))
                    ) : (
                        <Text style={{ color: theme.textSecondary, textAlign: 'center', paddingVertical: 20 }}>No members found.</Text>
                    )}
                </View>
            </ScrollView>

            {/* Join Home Modal */}
            <Modal visible={joinModalVisible} transparent animationType="fade" onRequestClose={() => setJoinModalVisible(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center', padding: 20 }} activeOpacity={1} onPress={() => setJoinModalVisible(false)}>
                    <View style={[styles.card, { backgroundColor: theme.card.includes('rgba') ? theme.background : theme.card, borderColor: theme.primary + '40', borderWidth: 2, width: '100%', maxWidth: 400, marginTop: 0 }]} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Key color={theme.primary} size={18} />
                                <Text style={{ color: theme.primary, fontWeight: '800', fontSize: 15 }}>
                                    JOIN A HOME
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setJoinModalVisible(false)} style={{ padding: 4 }}>
                                <X color={theme.textSecondary} size={20} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 18, lineHeight: 18 }}>
                            Got an invite code for a different home? Enter it here to join.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TextInput
                                placeholder="e.g. 5YTHFA4M"
                                placeholderTextColor={theme.textSecondary}
                                autoCapitalize="characters"
                                autoCorrect={false}
                                value={joinCode}
                                onChangeText={t => setJoinCode(t.toUpperCase())}
                                style={[styles.input, { flex: 1, borderColor: theme.border, color: theme.text, marginBottom: 0, fontFamily: 'monospace', letterSpacing: 3, fontSize: 16 }]}
                            />
                            <TouchableOpacity
                                onPress={handleJoin}
                                disabled={joinCode.trim().length < 6 || joining}
                                style={[styles.actionBtn, { backgroundColor: '#10b981', paddingHorizontal: 24, opacity: joinCode.trim().length < 6 ? 0.5 : 1 }]}
                            >
                                {joining ? <ActivityIndicator color="#fff" size="small" /> : (
                                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>Join</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                        {joinMsg && (
                            <Text style={{ marginTop: 14, color: joinMsg.ok ? '#10b981' : '#ef4444', fontWeight: '600', fontSize: 14 }}>
                                {joinMsg.ok ? '✅ ' : '✗ '}{joinMsg.text}
                            </Text>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
            {AlertComponent}
        </SafeAreaView>
    );
}

function MemberRow({ member, homeId, canManage, onRoleChange, onRemove, loadData }: {
    member: any;
    homeId: number;
    canManage: boolean;
    onRoleChange: (userId: number, role: Role) => void;
    onRemove: (userId: number, username: string) => void;
    loadData: (silent?: boolean) => void;
}) {
    const { theme } = useTheme();
    const { showAlert } = useThemedAlert();
    const [rolePickerVisible, setRolePickerVisible] = useState(false);
    const username = member.user?.username || member.username || 'Unknown';
    const email = member.user?.email || member.email || '';
    const role: Role = member.role || 'viewer';
    const isOwner = role === 'owner';
    const avatarUrl = member.user?.avatarUrl || member.avatarUrl;

    const initials = username.slice(0, 2).toUpperCase();

    return (
        <View style={{ paddingVertical: 12, borderBottomWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.primary + '30', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        {avatarUrl ? (
                            <Image source={{ uri: avatarUrl.startsWith('http') ? avatarUrl : API_BASE + avatarUrl }} style={{ width: '100%', height: '100%' }} />
                        ) : (
                            <Text style={{ color: theme.primary, fontWeight: '900', fontSize: 14 }}>{initials}</Text>
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ color: theme.text, fontWeight: '700', fontSize: 15 }}>{username}</Text>
                        {!!email && <Text style={{ color: theme.textSecondary, fontSize: 12 }}>{email}</Text>}
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {canManage && !isOwner ? (
                        <TouchableOpacity
                            onPress={() => { Haptics.selectionAsync(); setRolePickerVisible(true); }}
                            style={{ paddingVertical: 4 }}
                        >
                            <RoleBadge role={role} showChevron={true} />
                        </TouchableOpacity>
                    ) : (
                        <RoleBadge role={role} />
                    )}
                    {canManage && !isOwner && (
                        <TouchableOpacity onPress={() => onRemove(member.userId, username)} style={{ padding: 4 }}>
                            <Trash2 color="#ef4444" size={16} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Child Mode Switch (Only visible to Family Admins/Owners) */}
            {canManage && role !== 'owner' && (
                <View style={{ marginTop: 12, paddingLeft: 52 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Switch
                            value={member.restricted}
                            onValueChange={async (val) => {
                                Haptics.selectionAsync();
                                try {
                                    await updateMemberSafety(homeId, member.userId, { restricted: val });
                                    loadData(true);
                                } catch (e: any) {
                                    showAlert('Error', e?.message || 'Could not update child mode');
                                }
                            }}
                            trackColor={{ false: theme.border, true: '#f59e0b' }}
                            thumbColor="#fff"
                            style={{ transform: [{ scale: 0.8 }], marginLeft: -8 }}
                        />
                        <Text style={{ color: theme.textSecondary, fontSize: 11, marginLeft: 6 }}>
                            👶 Child mode — sirf granted devices ka control
                        </Text>
                    </View>

                    {member.restricted && (
                        <View style={{ marginTop: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '600' }}>⚡ Rate limit:</Text>
                                <TextInput
                                    style={{
                                        borderWidth: 1, borderColor: theme.border, borderRadius: 8, backgroundColor: theme.background,
                                        color: theme.text, paddingHorizontal: 12, paddingVertical: 6, width: 70, textAlign: 'center', fontSize: 13, fontWeight: '700'
                                    }}
                                    keyboardType="number-pad"
                                    defaultValue={String(member.dailyLimitMinutes ?? 5)}
                                    onEndEditing={async (e) => {
                                        const v = Number(e.nativeEvent.text);
                                        if (Number.isFinite(v) && v > 0 && v !== member.dailyLimitMinutes) {
                                            try { await updateMemberSafety(homeId, member.userId, { dailyLimitMinutes: v }); loadData(true); }
                                            catch (err) { showAlert('Error', 'Failed to update limit'); }
                                        }
                                    }}
                                />
                                <Text style={{ color: theme.textSecondary, fontSize: 10, flex: 1 }}>toggles/min — spam block protection</Text>
                            </View>

                            <DeviceAccessPicker homeId={homeId} member={member} showAlert={showAlert} />
                        </View>
                    )}
                </View>
            )}

            {/* Role Picker Modal */}
            <Modal visible={rolePickerVisible} transparent animationType="fade" onRequestClose={() => setRolePickerVisible(false)}>
                <TouchableOpacity style={{ flex: 1, backgroundColor: '#00000090', justifyContent: 'center', alignItems: 'center' }} activeOpacity={1} onPress={() => setRolePickerVisible(false)}>
                    <View style={{ backgroundColor: theme.card.includes('rgba') ? theme.background : theme.card, borderRadius: 20, padding: 24, width: '85%', maxWidth: 360, borderWidth: 1, borderColor: theme.border, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 15 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <Text style={{ color: theme.text, fontWeight: '800', fontSize: 17, letterSpacing: 0.5 }}>Change Role</Text>
                            <TouchableOpacity onPress={() => setRolePickerVisible(false)} style={{ padding: 4, backgroundColor: theme.background, borderRadius: 12 }}>
                                <X color={theme.textSecondary} size={18} />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: theme.textSecondary, fontSize: 13, marginBottom: 16 }}>Select a new permission level for {username}.</Text>

                        {(['admin', 'member', 'viewer'] as const).map(r => {
                            const cfg = ROLE_CONFIG[r];
                            return (
                                <TouchableOpacity
                                    key={r}
                                    onPress={() => {
                                        onRoleChange(member.userId, r);
                                        setRolePickerVisible(false);
                                    }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                                        paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, marginBottom: 10,
                                        backgroundColor: role === r ? cfg.bg : theme.background,
                                        borderWidth: 1, borderColor: role === r ? cfg.color : theme.border
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Text style={{ color: role === r ? cfg.color : theme.text, fontWeight: role === r ? '800' : '600', fontSize: 15, textTransform: 'capitalize' }}>{cfg.label}</Text>
                                    </View>
                                    {role === r && <CheckCheck color={cfg.color} size={18} />}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
}

function DeviceAccessPicker({ homeId, member, showAlert }: { homeId: number; member: any; showAlert: any }) {
    const { theme } = useTheme();
    const [devices, setDevices] = useState<any[]>([]);
    const [selected, setSelected] = useState<Set<number>>(new Set((member.deviceAccess || []).map((d: any) => d.deviceId)));
    const [saved, setSaved] = useState(true);
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        getDevices(homeId).then(res => { if (res?.success) setDevices(res.data); }).catch(() => { });
    }, [homeId]);

    const toggle = (id: number) => {
        setSaved(false);
        setSelected(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelected(new Set(devices.map(d => d.id)));
        setSaved(false);
    };

    const deselectAll = () => {
        setSelected(new Set());
        setSaved(false);
    };

    const save = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setSaving(true);
        try {
            await setMemberDeviceAccess(homeId, member.userId, Array.from(selected));
            setSaved(true);
        } catch (e: any) {
            showAlert('Error', e?.message || 'Could not save access');
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={{ backgroundColor: theme.background, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: theme.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: expanded ? 12 : 0 }}>
                <TouchableOpacity onPress={() => { Haptics.selectionAsync(); setExpanded(!expanded); }} style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Text style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '800' }}>
                        🔓 DEVICES ACCESS ({devices.length > 0 ? `${selected.size}/${devices.length}` : "…"})
                    </Text>
                    <ChevronDown color={theme.textSecondary} size={14} style={{ marginLeft: 6, transform: [{ rotate: expanded ? '180deg' : '0deg' }] }} />
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={save}
                    disabled={saving || saved || devices.length === 0}
                    style={{ backgroundColor: saved ? theme.primary + '40' : theme.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, opacity: (saved || devices.length === 0) ? 0.6 : 1 }}
                >
                    <Text style={{ color: saved ? theme.primary : '#000', fontSize: 10, fontWeight: '800' }}>
                        {saving ? "SAVING..." : saved ? "✓ SAVED" : "💾 SAVE ACCESS"}
                    </Text>
                </TouchableOpacity>
            </View>

            {expanded && (
                <>
                    {devices.length === 0 ? (
                        <Text style={{ color: theme.textSecondary, fontSize: 11, fontStyle: 'italic', paddingTop: 6 }}>Is home me abhi koi device nahi hai.</Text>
                    ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, marginTop: -4 }}>
                            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); selectAll(); }}>
                                <Text style={{ color: theme.primary, fontSize: 12, fontWeight: '700' }}>Select All</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => { Haptics.selectionAsync(); deselectAll(); }}>
                                <Text style={{ color: theme.textSecondary, fontSize: 12, fontWeight: '700' }}>Clear All</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                        {devices.map(d => {
                            const isSelected = selected.has(d.id);
                            return (
                                <TouchableOpacity
                                    key={d.id}
                                    onPress={() => { Haptics.selectionAsync(); toggle(d.id); }}
                                    style={{
                                        flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
                                        width: '100%',
                                        backgroundColor: isSelected ? theme.primary + '15' : theme.card,
                                        borderColor: isSelected ? theme.primary + '60' : theme.border
                                    }}
                                >
                                    <View style={{ width: 14, height: 14, borderRadius: 4, borderWidth: 1.5, borderColor: isSelected ? theme.primary : theme.textSecondary, backgroundColor: isSelected ? theme.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                        {isSelected && <Text style={{ color: '#000', fontSize: 10, fontWeight: '900', marginTop: -1 }}>✓</Text>}
                                    </View>
                                    <Text style={{ fontSize: 14 }}>
                                        {d.type === 'bulb' ? '💡' : d.type === 'fan' ? '🌀' : d.type === 'tv' ? '📺' : d.type === 'ac' ? '❄️' : d.type === 'plug' ? '🔌' : '🔘'}
                                    </Text>
                                    <Text style={{ color: isSelected ? theme.text : theme.textSecondary, fontSize: 12, fontWeight: isSelected ? '700' : '500', flex: 1 }} numberOfLines={1}>{d.name}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16, borderBottomWidth: 1
    },
    title: { fontSize: 22, fontWeight: '900' },
    card: {
        borderRadius: 16, borderWidth: 1, padding: 16, marginBottom: 16
    },
    input: {
        borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
        marginBottom: 10, fontSize: 15
    },
    actionBtn: {
        paddingVertical: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6
    }
});
