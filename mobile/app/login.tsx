import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Colors, Spacing, Radius } from '../constants/theme';

const BG = '#0A0A0F';

WebBrowser.maybeCompleteAuthSession();

const PRIVACY_URL = 'https://birthday-app-rouge-iota.vercel.app/privacy';
const REDIRECT_URL = 'samantha://auth/callback';

const openPrivacy = async () => {
  await WebBrowser.openBrowserAsync(PRIVACY_URL, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
    toolbarColor: '#0A0A0F',
  });
};

export default function LoginScreen() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [magicSent, setMagicSent] = useState(false);

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

  const sendMagicLink = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email,
      options: {
        emailRedirectTo: REDIRECT_URL,
      },
    });
    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setMagicSent(true);
    }
    setLoading(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: BG }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: BG }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={{ backgroundColor: BG }}
            contentContainerStyle={{ flexGrow: 1, backgroundColor: BG, padding: 24 }}
            keyboardShouldPersistTaps="handled"
          >
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
                style={[styles.googleButton, loading && styles.buttonDisabled]}
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

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {magicSent ? (
                <Text style={styles.successText}>
                  Check your email! We sent you a login link ✉️
                </Text>
              ) : (
                <>
                  <TextInput
                    style={styles.emailInput}
                    placeholder="your@email.com"
                    placeholderTextColor={Colors.textSecondary}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoCorrect={false}
                  />
                  <TouchableOpacity
                    style={[styles.magicButton, loading && styles.buttonDisabled]}
                    onPress={sendMagicLink}
                    disabled={loading}
                    activeOpacity={0.85}
                  >
                    {loading ? (
                      <ActivityIndicator color={Colors.textPrimary} />
                    ) : (
                      <Text style={styles.magicButtonText}>Send magic link</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}

              <Text style={styles.legalText}>
                By continuing you agree to our{' '}
                <Text onPress={openPrivacy} style={styles.legalLink}>
                  Privacy Policy
                </Text>
              </Text>
            </View>
          </View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
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
    marginTop: 40,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.textPrimary,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  buttonDisabled: {
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.textMuted,
    opacity: 0.3,
  },
  dividerText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  emailInput: {
    width: '100%',
    backgroundColor: Colors.primaryLight,
    borderRadius: Radius.lg,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    fontSize: 15,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  magicButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7C3AED',
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: Spacing.xl,
    width: '100%',
  },
  magicButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  successText: {
    fontSize: 15,
    color: Colors.textPrimary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  legalText: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  legalLink: {
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
});
