import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { login } from './src/api/auth';
import * as SecureStore from 'expo-secure-store';
import { DashboardScreen } from './src/components/DashboardScreen';
import { AutomationsScreen } from './src/components/AutomationsScreen';
import { Clock, Home as HomeIcon, Settings } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'HOME' | 'AUTOMATIONS' | 'SETTINGS'>('HOME');
  const [isRestoring, setIsRestoring] = useState(true);

  React.useEffect(() => {
    const restoreAuth = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync('user');
        if (storedUser) setUser(JSON.parse(storedUser));
      } catch (e) { }
      setIsRestoring(false);
    };
    restoreAuth();
  }, []);

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
        await SecureStore.setItemAsync('user', JSON.stringify(res.data.user));
        setUser(res.data.user);
      }
    } catch (e: any) {
      setError(e.message || 'Login failed. Make sure backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Custom Micro-Router Fallback
  const renderTab = () => {
    if (activeTab === 'HOME') {
      return (
        <DashboardScreen
          user={user}
          onLogout={async () => {
            await SecureStore.deleteItemAsync('accessToken');
            await SecureStore.deleteItemAsync('user');
            setUser(null);
          }}
        />
      );
    }
    if (activeTab === 'AUTOMATIONS') {
      return <AutomationsScreen />;
    }
    return (
      <View style={styles.comingSoon}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Feature unlocks in Phase 11.</Text>
      </View>
    );
  };

  if (user) {
    const setNav = (tab: 'HOME' | 'AUTOMATIONS' | 'SETTINGS') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
      setActiveTab(tab);
    };

    return (
      <View style={{ flex: 1, backgroundColor: '#0f172a' }}>
        <View style={{ flex: 1 }}>{renderTab()}</View>

        {/* Premium Bottom Navbar */}
        <View style={styles.bottomNav}>
          <TouchableOpacity style={styles.navItem} onPress={() => setNav('HOME')}>
            <HomeIcon color={activeTab === 'HOME' ? '#3b82f6' : '#64748b'} size={24} />
            <Text style={[styles.navText, activeTab === 'HOME' && styles.navTextActive]}>Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setNav('AUTOMATIONS')}>
            <Clock color={activeTab === 'AUTOMATIONS' ? '#3b82f6' : '#64748b'} size={24} />
            <Text style={[styles.navText, activeTab === 'AUTOMATIONS' && styles.navTextActive]}>Automations</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.navItem} onPress={() => setNav('SETTINGS')}>
            <Settings color={activeTab === 'SETTINGS' ? '#3b82f6' : '#64748b'} size={24} />
            <Text style={[styles.navText, activeTab === 'SETTINGS' && styles.navTextActive]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (isRestoring) {
    return (
      <View style={[styles.container, { flex: 1 }]}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
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
  },
  comingSoon: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#1e293b',
    paddingBottom: 32, // SafeArea padding for bottom
    paddingTop: 16,
    borderTopWidth: 1,
    borderColor: '#334155'
  },
  navItem: { alignItems: 'center', flex: 1 },
  navText: { color: '#64748b', fontSize: 13, marginTop: 6, fontWeight: '700' },
  navTextActive: { color: '#3b82f6' }
});
