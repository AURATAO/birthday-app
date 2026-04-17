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
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { getLanguage, setLanguage } from '../lib/storage';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

export default function SettingsScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isChinese, setIsChinese] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  const openPrivacy = async () => {
    await WebBrowser.openBrowserAsync(
      'https://birthday-app-rouge-iota.vercel.app/privacy',
      {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        toolbarColor: '#0A0A0F',
      }
    );
  };

  async function handleDeleteAccount() {
    Alert.alert(
      isChinese ? '删除账户' : 'Delete account',
      isChinese
        ? '这将永久删除您的所有数据，无法恢复。确定吗？'
        : 'This will permanently delete all your data. This cannot be undone.',
      [
        { text: isChinese ? '取消' : 'Cancel', style: 'cancel' },
        {
          text: isChinese ? '删除' : 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const { data } = await supabase.auth.getSession();
              const token = data.session?.access_token;
              const apiUrl = process.env.EXPO_PUBLIC_API_URL;
              if (token && apiUrl) {
                await fetch(`${apiUrl}/api/account`, {
                  method: 'DELETE',
                  headers: { Authorization: `Bearer ${token}` },
                });
              }
            } catch {}
            await supabase.auth.signOut();
            setDeletingAccount(false);
          },
        },
      ]
    );
  }

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
                trackColor={{ false: Colors.surfaceHigh, true: Colors.primary }}
                thumbColor={Colors.textPrimary}
              />
              <Text style={styles.rowLabel}>中文</Text>
            </View>
          </View>
        </View>

        {/* Privacy Policy */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{isChinese ? '法律' : 'Legal'}</Text>
          <View style={styles.card}>
            <TouchableOpacity
              onPress={openPrivacy}
              activeOpacity={0.7}
              style={styles.row}
            >
              <View>
                <Text style={styles.rowLabel}>{isChinese ? '隐私政策' : 'Privacy Policy'}</Text>
                <Text style={styles.rowSubLabel}>{isChinese ? '我们如何处理您的数据' : 'How we handle your data'}</Text>
              </View>
              <Text style={styles.rowChevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* DEBUG: Copy Token */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={async () => {
            const { data: { session } } = await supabase.auth.getSession();
            console.log('MY TOKEN:', session?.access_token);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.logoutText}>Copy Token</Text>
        </TouchableOpacity>

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

        {/* Delete account */}
        <TouchableOpacity
          style={[styles.deleteBtn, deletingAccount && styles.logoutBtnDisabled]}
          onPress={handleDeleteAccount}
          disabled={deletingAccount}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteText}>
            {deletingAccount
              ? (isChinese ? '删除中...' : 'Deleting...')
              : (isChinese ? '删除账户' : 'Delete account')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xxl,
    gap: Spacing.lg,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  backIcon: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  title: {
    ...Typography.h2,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  rowLabel: {
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  rowValue: {
    fontSize: 14,
    color: Colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  logoutBtn: {
    backgroundColor: `rgba(226, 75, 74, 0.1)`,
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  logoutBtnDisabled: {
    opacity: 0.5,
  },
  logoutText: {
    color: Colors.danger,
    fontSize: 15,
    fontWeight: '600',
  },
  deleteBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  deleteText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '500',
  },
  rowSubLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  rowChevron: {
    fontSize: 20,
    color: Colors.textMuted,
  },
});
