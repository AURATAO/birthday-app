import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { getLanguage, setLanguage } from '../lib/storage';

export default function SettingsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isChinese, setIsChinese] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? '');
    });
    getLanguage().then((lang) => setIsChinese(lang === 'zh'));
  }, []);

  async function handleLanguageToggle(value: boolean) {
    setIsChinese(value);
    await setLanguage(value ? 'zh' : 'en');
  }

  async function handleLogout() {
    Alert.alert(
      isChinese ? '退出登录' : 'Log out',
      isChinese ? '确定要退出吗？' : 'Are you sure you want to log out?',
      [
        { text: isChinese ? '取消' : 'Cancel', style: 'cancel' },
        {
          text: isChinese ? '退出' : 'Log out',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await supabase.auth.signOut();
            setLoggingOut(false);
          },
        },
      ]
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{isChinese ? '设置' : 'Settings'}</Text>
      </View>

      <View style={styles.content}>
        {/* Account section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{isChinese ? '账户' : 'Account'}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{isChinese ? '邮箱' : 'Email'}</Text>
              <Text style={styles.rowValue} numberOfLines={1}>{email}</Text>
            </View>
          </View>
        </View>

        {/* Language section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{isChinese ? '语言' : 'Language'}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>EN</Text>
              <Switch
                value={isChinese}
                onValueChange={handleLanguageToggle}
                trackColor={{ false: '#333', true: '#FF6B6B' }}
                thumbColor={isChinese ? '#FFFFFF' : '#888'}
              />
              <Text style={styles.rowLabel}>中文</Text>
            </View>
          </View>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, loggingOut && styles.logoutBtnDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>
            {loggingOut
              ? (isChinese ? '退出中...' : 'Logging out...')
              : (isChinese ? '退出登录' : 'Log out')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 32,
    gap: 16,
  },
  backBtn: {
    padding: 4,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 24,
    gap: 24,
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'right',
  },
  logoutBtn: {
    backgroundColor: '#FF3B3022',
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  logoutBtnDisabled: {
    opacity: 0.5,
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});
