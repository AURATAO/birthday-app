import { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius } from '../constants/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);

  const REDIRECT_URL = 'samantha://auth/callback';

  async function handleGoogleLogin() {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const params = new URLSearchParams(
          url.hash ? url.hash.slice(1) : url.search.slice(1)
        );
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      }
    } catch (err: any) {
      Alert.alert('Login failed', err.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.hero}>
        <View style={styles.logoMark}>
          <Text style={styles.logoSymbol}>✦</Text>
        </View>
        <Text style={styles.title}>samantha</Text>
        <Text style={styles.tagline}>your personal relationship assistant</Text>
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.googleButton, loading && styles.googleButtonDisabled]}
          onPress={handleGoogleLogin}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={Colors.background} />
          ) : (
            <>
              <Text style={styles.googleIcon}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.legalText}>
          By continuing you agree to our Terms & Privacy Policy
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: Spacing.xxl,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  logoMark: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  logoSymbol: {
    fontSize: 30,
    color: Colors.primary,
  },
  title: {
    fontSize: 36,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  footer: {
    width: '100%',
    gap: Spacing.md,
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    gap: Spacing.md,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    fontSize: 17,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.background,
  },
  legalText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
