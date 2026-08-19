import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { login } from './src/api/auth';
import * as SecureStore from 'expo-secure-store';
import { DashboardScreen } from './src/components/DashboardScreen';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Local network backend ping mapping strictly to Zod Schema
      const res = await login({ usernameEmail: email, password });
      if (res.success && res.data) {
        if (res.data.accessToken) {
          await SecureStore.setItemAsync('accessToken', res.data.accessToken);
        }
        setUser(res.data.user);
      }
    } catch (e: any) {
      setError(e.message || 'Login failed. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Logged-in Fallback Dashboard
  if (user) {
    return (
      <DashboardScreen
        user={user}
        onLogout={async () => {
          await SecureStore.deleteItemAsync('accessToken');
          setUser(null);
        }}
      />
    );
  }

  // Pure Opening Screen
  return (
    <View style={styles.container}>
      <Text style={styles.title}>RoboSphere</Text>
      <Text style={styles.subtitle}>Sign in to control your smart home</Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TextInput
        style={styles.input}
        placeholder="Enter your email"
        placeholderTextColor="#9ca3af"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />

      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        placeholderTextColor="#9ca3af"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Sign In</Text>}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    marginBottom: 36,
  },
  card: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  input: {
    width: '100%',
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    marginBottom: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#f87171',
    marginBottom: 16,
    textAlign: 'center',
  }
});
