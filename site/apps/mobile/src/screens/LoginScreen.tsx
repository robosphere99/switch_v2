import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Dimensions, Modal, ScrollView } from 'react-native';
import * as Haptics from '../utils/haptics';
import { useTheme } from '../theme/ThemeContext';
import { login, revokeUnauth, signup } from '../api/auth';
import * as SecureStore from 'expo-secure-store';
import { ScanFace, CheckSquare, Square, Eye, EyeOff, AlertCircle } from 'lucide-react-native';

type Props = {
    onLoginSuccess: (user: any) => void;
    onBiometricRetry?: () => void;
};

const { height } = Dimensions.get('window');

export function LoginScreen({ onLoginSuccess, onBiometricRetry }: Props) {
    const { theme } = useTheme();
    const [isSignup, setIsSignup] = useState(false);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [revokeOtherSessions, setRevokeOtherSessions] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [activeSessions, setActiveSessions] = useState<any[]>([]);
    const [showPassword, setShowPassword] = useState(false);

    // Track username/email availability during signup
    const [usernameAvail, setUsernameAvail] = useState<boolean | null>(null);
    const [emailAvail, setEmailAvail] = useState<boolean | null>(null);

    // Track original saved credentials separately so we can clear/restore them on mode toggle
    const [savedEmail, setSavedEmail] = useState('');
    const [savedPassword, setSavedPassword] = useState('');

    React.useEffect(() => {
        const loadSaved = async () => {
            const creds = await SecureStore.getItemAsync('savedCredentials');
            if (creds) {
                const parsed = JSON.parse(creds);
                if (parsed.email) {
                    setEmail(parsed.email);
                    setSavedEmail(parsed.email);
                }
                if (parsed.password) {
                    setPassword(parsed.password);
                    setSavedPassword(parsed.password);
                }
            }
        };
        loadSaved();
    }, []);

    React.useEffect(() => {
        if (!isSignup) return;

        let active = true;
        const delayCheck = setTimeout(async () => {
            const checkUname = username.length > 2;
            const checkEmail = email.length > 5 && email.includes('@');

            if (checkUname || checkEmail) {
                try {
                    const { checkAvailability } = await import('../api/auth');
                    const res = await checkAvailability({
                        username: checkUname ? username : undefined,
                        email: checkEmail ? email : undefined
                    });
                    if (active && res.success && res.data) {
                        if (checkUname && res.data.usernameAvailable !== undefined) {
                            setUsernameAvail(res.data.usernameAvailable);
                        }
                        if (checkEmail && res.data.emailAvailable !== undefined) {
                            setEmailAvail(res.data.emailAvailable);
                        }
                    }
                } catch (e) {
                    // Ignore background typing validation errors
                }
            }
            if (!checkUname) setUsernameAvail(null);
            if (!checkEmail) setEmailAvail(null);
        }, 600);

        return () => {
            active = false;
            clearTimeout(delayCheck);
        };
    }, [username, email, isSignup]);

    const handleAuth = async () => {
        if (!email || !password || (isSignup && !username)) {
            setError('Please fill in all fields');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { });
            return;
        }

        if (activeSessions.length >= 3) return; // Block login if we are over the limit

        setLoading(true);
        setError('');

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

        try {
            const credentials = { usernameEmail: email, password, revokeOtherSessions };
            const loginRes = isSignup
                ? await (async () => {
                    await signup({ username, email, password });
                    return await login(credentials);
                })()
                : await login(credentials);

            if (loginRes.success && loginRes.data) {
                if (loginRes.data.accessToken) {
                    await SecureStore.setItemAsync('accessToken', loginRes.data.accessToken);
                }
                if (loginRes.data.refreshToken) {
                    await SecureStore.setItemAsync('refreshToken', loginRes.data.refreshToken);
                }
                if (loginRes.data.sessionId) {
                    await SecureStore.setItemAsync('sessionId', String(loginRes.data.sessionId));
                }
                await SecureStore.setItemAsync('user', JSON.stringify(loginRes.data.user));
                await SecureStore.setItemAsync('loginTimestamp', String(Date.now()));

                if (!isSignup && rememberMe) {
                    await SecureStore.setItemAsync('savedCredentials', JSON.stringify({ email, password }));
                } else if (!isSignup) {
                    await SecureStore.deleteItemAsync('savedCredentials');
                }

                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                onLoginSuccess(loginRes.data.user);
            }
        } catch (e: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
            if (e.code === "SESSION_LIMIT_REACHED") {
                setActiveSessions(e.details || []);
            } else {
                setError(e.message || 'Authentication failed. Please verify credentials.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeSession = async (sessionId: number) => {
        setLoading(true);
        try {
            const res = await revokeUnauth({ usernameEmail: email, password, sessionId });
            if (res.success && res.data) {
                setActiveSessions(res.data);
            } else {
                setError((res as any).error?.message || "Failed to revoke session");
            }
        } catch (e: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
            setError(e.message || 'Failed to revoke session.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.container, { backgroundColor: theme.background }]}
        >
            <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <Text style={[styles.title, { color: theme.text }]}>Switch<Text style={{ color: theme.primary }}>Nest</Text></Text>
                    <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Intelligent automation awaits</Text>
                </View>

                <View style={styles.form}>
                    {error ? (
                        <View style={[styles.errorBox, { backgroundColor: theme.danger + '20', borderColor: theme.danger + '40' }]}>
                            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
                        </View>
                    ) : null}

                    {isSignup && (
                        <View style={[styles.inputContainer, { marginBottom: 20 }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={[styles.label, { color: theme.textSecondary }]}>USERNAME</Text>
                            </View>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.card, borderColor: usernameAvail === false ? theme.danger : theme.border, color: theme.text }]}
                                placeholder="Choose a username"
                                placeholderTextColor={theme.textSecondary + '80'}
                                autoCapitalize="none"
                                value={username}
                                onChangeText={(txt) => { setError(''); setUsername(txt); setUsernameAvail(null); }}
                            />
                            {usernameAvail === false && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 4 }}>
                                    <AlertCircle color={theme.danger} size={14} style={{ marginRight: 6 }} />
                                    <Text style={{ color: theme.danger, fontSize: 12 }}>That username is taken. Try another.</Text>
                                </View>
                            )}
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>{isSignup ? "EMAIL ADDRESS" : "EMAIL OR USERNAME"}</Text>
                        </View>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.card, borderColor: (isSignup && emailAvail === false) ? theme.danger : theme.border, color: theme.text }]}
                            placeholder={isSignup ? "Enter your email" : "Enter email or username"}
                            placeholderTextColor={theme.textSecondary + '80'}
                            autoCapitalize="none"
                            keyboardType={isSignup ? "email-address" : "default"}
                            value={email}
                            onChangeText={(txt) => { setError(''); setEmail(txt); setEmailAvail(null); }}
                        />
                        {(isSignup && emailAvail === false) && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, marginLeft: 4 }}>
                                <AlertCircle color={theme.danger} size={14} style={{ marginRight: 6 }} />
                                <Text style={{ color: theme.danger, fontSize: 12 }}>That email is already registered.</Text>
                            </View>
                        )}
                    </View>

                    <View style={[styles.inputContainer, { marginTop: 20 }]}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>PASSWORD</Text>
                        <View style={{ position: 'relative', width: '100%', justifyContent: 'center' }}>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text, paddingRight: 40 }]}
                                placeholder={isSignup ? "Create a password" : "Enter your password"}
                                placeholderTextColor={theme.textSecondary + '80'}
                                secureTextEntry={!showPassword}
                                value={password}
                                onChangeText={(txt) => { setError(''); setPassword(txt); }}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: 12 }}
                            >
                                {showPassword ? <EyeOff color={theme.textSecondary} size={20} /> : <Eye color={theme.textSecondary} size={20} />}
                            </TouchableOpacity>
                        </View>
                    </View>

                    {!isSignup && (
                        <>
                            <TouchableOpacity style={styles.checkboxRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.8}>
                                {rememberMe ? <CheckSquare color={theme.primary} size={20} /> : <Square color={theme.textSecondary} size={20} />}
                                <Text style={[styles.checkboxText, { color: theme.textSecondary }]}>Save password for future logins</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.checkboxRow, { marginTop: 8 }]} onPress={() => setRevokeOtherSessions(!revokeOtherSessions)} activeOpacity={0.8}>
                                {revokeOtherSessions ? <CheckSquare color={theme.primary} size={20} /> : <Square color={theme.textSecondary} size={20} />}
                                <Text style={[styles.checkboxText, { color: theme.textSecondary }]}>Logout from all other devices</Text>
                            </TouchableOpacity>
                        </>
                    )}

                    <TouchableOpacity
                        style={[styles.button, { backgroundColor: theme.primary, shadowColor: theme.primaryGlow }]}
                        onPress={handleAuth}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{isSignup ? "Create Account" : "Authenticate"}</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ marginTop: 24, alignItems: 'center' }}
                        onPress={() => {
                            if (!isSignup) {
                                // Switching to signup -> Clear autofilled values
                                setEmail('');
                                setPassword('');
                                setUsernameAvail(null);
                                setEmailAvail(null);
                            } else {
                                // Switching back to login -> Restore original autofill
                                setEmail(savedEmail);
                                setPassword(savedPassword);
                                setUsernameAvail(null);
                                setEmailAvail(null);
                            }
                            setIsSignup(!isSignup);
                            setError('');
                        }}
                    >
                        <Text style={{ color: theme.textSecondary, fontSize: 13 }}>
                            {isSignup ? "Already have an account? " : "Don't have an account? "}
                            <Text style={{ color: theme.primary, fontWeight: '700' }}>
                                {isSignup ? "Sign In" : "Sign Up"}
                            </Text>
                        </Text>
                    </TouchableOpacity>

                    {(!isSignup && onBiometricRetry) && (
                        <TouchableOpacity
                            style={[styles.bioButton, { backgroundColor: theme.primary + '15', borderColor: theme.primary + '30' }]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                                onBiometricRetry();
                            }}
                        >
                            <ScanFace color={theme.primary} size={28} />
                            <Text style={[styles.bioText, { color: theme.primary }]}>Login with FaceID / TouchID</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </ScrollView>

            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: theme.textSecondary }]}>Protected by SecureStore Enclave</Text>
            </View>

            <Modal visible={activeSessions.length > 0} transparent animationType="fade">
                <View style={[styles.modalOverlay, { backgroundColor: theme.background }]}>
                    <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <Text style={[styles.modalTitle, { color: theme.text }]}>Device Limit Reached</Text>
                        <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                            You are logged in on the maximum number of devices. Please remove one session to proceed.
                        </Text>
                        <ScrollView style={{ maxHeight: 300, width: '100%', marginVertical: 16 }}>
                            {activeSessions.map((s) => (
                                <View key={s.id} style={[styles.sessionCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <Text style={[styles.sessionDevice, { color: theme.text }]} numberOfLines={1}>
                                            {s.deviceInfo || 'Unknown Device'}
                                        </Text>
                                        <Text style={[styles.sessionIp, { color: theme.textSecondary }]}>IP: {s.ipAddress}</Text>
                                    </View>
                                    <TouchableOpacity
                                        style={[styles.revokeBtn, { backgroundColor: theme.danger + '20' }]}
                                        onPress={() => handleRevokeSession(s.id)}
                                        disabled={loading}
                                    >
                                        <Text style={[styles.revokeText, { color: theme.danger }]}>Remove</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </ScrollView>

                        <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginTop: 8 }}>
                            <TouchableOpacity style={[styles.cancelModalBtn, { flex: 1, backgroundColor: theme.border }]} onPress={() => { setActiveSessions([]); setError(''); }}>
                                <Text style={[styles.cancelModalText, { color: theme.text, textAlign: 'center' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.cancelModalBtn, { flex: 1, backgroundColor: theme.primary, opacity: (activeSessions.length >= 3 || loading) ? 0.6 : 1 }]}
                                disabled={activeSessions.length >= 3 || loading}
                                onPress={() => handleAuth()}
                            >
                                <Text style={[styles.cancelModalText, { color: '#fff', textAlign: 'center' }]}>
                                    {loading ? "Working..." : "Login"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flexGrow: 1,
        paddingTop: height * 0.12,
        paddingHorizontal: 32,
        paddingBottom: 40,
    },
    header: {
        marginBottom: 48,
        alignItems: 'center',
    },
    title: {
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 16,
        marginTop: 8,
        fontWeight: '500',
        letterSpacing: 0.5,
    },
    form: {
        width: '100%',
    },
    errorBox: {
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 24,
    },
    errorText: {
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    inputContainer: {
        width: '100%',
    },
    label: {
        fontSize: 11,
        fontWeight: '800',
        marginBottom: 8,
        letterSpacing: 1,
        paddingLeft: 4,
    },
    input: {
        width: '100%',
        borderWidth: 1,
        borderRadius: 16,
        paddingHorizontal: 20,
        paddingVertical: 18,
        fontSize: 16,
        fontWeight: '500',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 18,
        paddingLeft: 4,
        gap: 10
    },
    checkboxText: {
        fontSize: 13,
        fontWeight: '600'
    },
    button: {
        width: '100%',
        borderRadius: 16,
        paddingVertical: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 32,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 8,
    },
    buttonText: {
        color: '#ffffff',
        fontSize: 17,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
    bioButton: {
        width: '100%',
        borderRadius: 16,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        borderWidth: 1,
        flexDirection: 'row',
        gap: 12
    },
    bioText: {
        fontSize: 15,
        fontWeight: '700'
    },
    footer: {
        position: 'absolute',
        bottom: 40,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 12,
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    modalBox: {
        width: '100%',
        borderRadius: 20,
        borderWidth: 1,
        padding: 24,
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 8,
    },
    sessionCard: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 10,
    },
    sessionDevice: {
        fontSize: 14,
        fontWeight: '700',
    },
    sessionIp: {
        fontSize: 12,
        marginTop: 2,
    },
    revokeBtn: {
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
    },
    revokeText: {
        color: '#ef4444',
        fontSize: 12,
        fontWeight: 'bold',
    },
    cancelModalBtn: {
        width: '100%',
        padding: 14,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelModalText: {
        fontWeight: '700',
        fontSize: 15,
    }
});
