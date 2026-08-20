import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../theme/ThemeContext';
import { login, signup } from '../api/auth';
import * as SecureStore from 'expo-secure-store';
import { ScanFace, CheckSquare, Square } from 'lucide-react-native';

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
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    React.useEffect(() => {
        const loadSaved = async () => {
            const creds = await SecureStore.getItemAsync('savedCredentials');
            if (creds) {
                const parsed = JSON.parse(creds);
                if (parsed.email) setEmail(parsed.email);
                if (parsed.password) setPassword(parsed.password);
            }
        };
        loadSaved();
    }, []);

    const handleAuth = async () => {
        if (!email || !password || (isSignup && !username)) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
            setError('All required fields must be filled');
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
        setError('');
        setLoading(true);

        try {
            if (isSignup) {
                await signup({ username, email, password });
                const loginRes = await login({ usernameEmail: email, password });
                if (loginRes.success && loginRes.data) {
                    if (loginRes.data.accessToken) {
                        await SecureStore.setItemAsync('accessToken', loginRes.data.accessToken);
                    }
                    if (loginRes.data.refreshToken) {
                        await SecureStore.setItemAsync('refreshToken', loginRes.data.refreshToken);
                    }
                    await SecureStore.setItemAsync('user', JSON.stringify(loginRes.data.user));
                    await SecureStore.setItemAsync('loginTimestamp', String(Date.now()));
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                    onLoginSuccess(loginRes.data.user);
                }
            } else {
                const res = await login({ usernameEmail: email, password });
                if (res.success && res.data) {
                    if (res.data.accessToken) {
                        await SecureStore.setItemAsync('accessToken', res.data.accessToken);
                    }
                    if (res.data.refreshToken) {
                        await SecureStore.setItemAsync('refreshToken', res.data.refreshToken);
                    }
                    await SecureStore.setItemAsync('user', JSON.stringify(res.data.user));
                    await SecureStore.setItemAsync('loginTimestamp', String(Date.now()));

                    if (rememberMe) {
                        await SecureStore.setItemAsync('savedCredentials', JSON.stringify({ email, password }));
                    } else {
                        await SecureStore.deleteItemAsync('savedCredentials');
                    }

                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
                    onLoginSuccess(res.data.user);
                }
            }
        } catch (e: any) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => { });
            setError(e.message || 'Authentication failed. Please verify credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.container, { backgroundColor: theme.background }]}
        >
            <View style={styles.content}>
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
                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { color: theme.textSecondary }]}>USERNAME</Text>
                            <TextInput
                                style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text, marginBottom: 20 }]}
                                placeholder="Choose a username"
                                placeholderTextColor={theme.textSecondary + '80'}
                                autoCapitalize="none"
                                value={username}
                                onChangeText={(txt) => { setError(''); setUsername(txt); }}
                            />
                        </View>
                    )}

                    <View style={styles.inputContainer}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>{isSignup ? "EMAIL ADDRESS" : "EMAIL OR USERNAME"}</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            placeholder={isSignup ? "Enter your email" : "Enter email or username"}
                            placeholderTextColor={theme.textSecondary + '80'}
                            autoCapitalize="none"
                            keyboardType={isSignup ? "email-address" : "default"}
                            value={email}
                            onChangeText={(txt) => { setError(''); setEmail(txt); }}
                        />
                    </View>

                    <View style={[styles.inputContainer, { marginTop: 20 }]}>
                        <Text style={[styles.label, { color: theme.textSecondary }]}>PASSWORD</Text>
                        <TextInput
                            style={[styles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            placeholder={isSignup ? "Create a password" : "Enter your password"}
                            placeholderTextColor={theme.textSecondary + '80'}
                            secureTextEntry
                            value={password}
                            onChangeText={(txt) => { setError(''); setPassword(txt); }}
                        />
                    </View>

                    {!isSignup && (
                        <TouchableOpacity style={styles.checkboxRow} onPress={() => setRememberMe(!rememberMe)} activeOpacity={0.8}>
                            {rememberMe ? <CheckSquare color={theme.primary} size={20} /> : <Square color={theme.textSecondary} size={20} />}
                            <Text style={[styles.checkboxText, { color: theme.textSecondary }]}>Save password for future logins</Text>
                        </TouchableOpacity>
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
                        onPress={() => { setIsSignup(!isSignup); setError(''); }}
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
            </View>

            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: theme.textSecondary }]}>Protected by SecureStore Enclave</Text>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingBottom: height * 0.1, // Push up slightly
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
    }
});
