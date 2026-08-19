import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../stores/auth';
import { login } from '../api/auth';
import tw from 'twrnc';

export function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const setAuth = useAuthStore((s) => s.setAuth);

    const handleLogin = async () => {
        setError(null);
        setLoading(true);
        try {
            const res = await login({ email, password });
            if (res.success && res.data) {
                await setAuth(res.data.user, res.data.accessToken);
            }
        } catch (e: any) {
            setError(e.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={tw`flex-1 items-center justify-center px-6 bg-slate-900 w-full`}>
            <Text style={tw`text-4xl font-bold text-blue-500 mb-2`}>SwitchNest</Text>
            <Text style={tw`text-gray-400 mb-8 text-center text-base`}>Sign in to control your smart home</Text>

            {error && (
                <View style={tw`bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-6 w-full`}>
                    <Text style={tw`text-red-400 text-center`}>{error}</Text>
                </View>
            )}

            <TextInput
                style={tw`w-full bg-slate-800 border border-gray-700 rounded-xl px-4 py-3 text-white mb-4`}
                placeholder="Email address"
                placeholderTextColor="#9ca3af"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
            />

            <TextInput
                style={tw`w-full bg-slate-800 border border-gray-700 rounded-xl px-4 py-3 text-white mb-6`}
                placeholder="Password"
                placeholderTextColor="#9ca3af"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
            />

            <TouchableOpacity
                style={tw`w-full bg-blue-500 rounded-xl py-3 items-center justify-center flex-row`}
                onPress={handleLogin}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#ffffff" style={tw`mr-2`} />
                ) : null}
                <Text style={tw`text-white font-bold text-base`}>
                    {loading ? "Signing in..." : "Sign In"}
                </Text>
            </TouchableOpacity>
        </View>
    );
}
