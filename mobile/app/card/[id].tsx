import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Animated,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Voice from '@react-native-voice/voice';
import { generateCard } from '../../lib/api';

const LANGUAGE_KEY = 'app_language';

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [generating, setGenerating] = useState(false);
  const [personName, setPersonName] = useState('');
  const [daysUntil, setDaysUntil] = useState(0);
  const [language, setLanguage] = useState<'en' | 'zh'>('en');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    // Load language preference
    import('../../lib/storage').then(({ getLanguage }) =>
      getLanguage().then((lang) => setLanguage(lang as 'en' | 'zh'))
    ).catch(() => {});

    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechError = () => setIsListening(false);
    Voice.onSpeechResults = (e) => {
      const text = e.value?.[0] ?? '';
      setTranscript(text);
    };

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      pulseLoop.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (isListening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 700, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start();

      if (transcript) {
        handleGenerate(transcript);
      }
    }
  }, [isListening]);

  async function handleMicPress() {
    if (isListening) {
      await Voice.stop();
      return;
    }
    setTranscript('');
    try {
      await Voice.start(language === 'zh' ? 'zh-CN' : 'en-US');
    } catch (err: any) {
      Alert.alert('Microphone error', err.message);
    }
  }

  async function handleGenerate(text: string) {
    if (!text.trim()) return;
    setGenerating(true);
    try {
      const data = await generateCard(id, text, language);
      setGeneratedMessage(data.message ?? data.card ?? '');
      if (data.name) setPersonName(data.name);
      if (data.days_until !== undefined) setDaysUntil(data.days_until);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setGenerating(false);
    }
  }

  function share(platform: 'whatsapp' | 'imessage' | 'email') {
    const msg = encodeURIComponent(generatedMessage);
    const urls: Record<string, string> = {
      whatsapp: `whatsapp://send?text=${msg}`,
      imessage: `sms:&body=${msg}`,
      email: `mailto:?subject=${encodeURIComponent('Happy Birthday!')}&body=${msg}`,
    };
    Linking.openURL(urls[platform]).catch(() =>
      Alert.alert('Could not open app', `Make sure ${platform} is installed.`)
    );
  }

  const dayLabel =
    daysUntil === 0 ? "It's today!" : daysUntil === 1 ? 'Tomorrow' : `in ${daysUntil} days`;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.personName}>{personName || 'Birthday Card'}</Text>
          {daysUntil > 0 || personName ? (
            <Text style={styles.daysLabel}>{dayLabel}</Text>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Mic */}
        <View style={styles.micSection}>
          <Text style={styles.micPrompt}>
            {language === 'zh'
              ? '说说你想对他们说的话'
              : 'Say anything you want to tell them'}
          </Text>
          <Animated.View style={[styles.micOuter, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.micRing}>
              <TouchableOpacity
                style={[styles.micButton, isListening && styles.micButtonActive]}
                onPress={handleMicPress}
                activeOpacity={0.9}
              >
                <Text style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>

          {transcript ? (
            <Text style={styles.transcript}>"{transcript}"</Text>
          ) : null}
        </View>

        {/* Generated message */}
        {generating ? (
          <View style={styles.generatingBox}>
            <ActivityIndicator color="#FF6B6B" />
            <Text style={styles.generatingText}>Crafting your message...</Text>
          </View>
        ) : generatedMessage ? (
          <View style={styles.messageSection}>
            <Text style={styles.messageSectionTitle}>
              {language === 'zh' ? '你的祝福消息' : 'Your Birthday Message'}
            </Text>
            <TextInput
              style={styles.messageInput}
              value={generatedMessage}
              onChangeText={setGeneratedMessage}
              multiline
              textAlignVertical="top"
              placeholderTextColor="#555"
            />

            <View style={styles.shareButtons}>
              <TouchableOpacity
                style={[styles.shareBtn, styles.whatsappBtn]}
                onPress={() => share('whatsapp')}
                activeOpacity={0.8}
              >
                <Text style={styles.shareBtnIcon}>💬</Text>
                <Text style={styles.shareBtnText}>WhatsApp</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBtn, styles.imessageBtn]}
                onPress={() => share('imessage')}
                activeOpacity={0.8}
              >
                <Text style={styles.shareBtnIcon}>💬</Text>
                <Text style={styles.shareBtnText}>iMessage</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shareBtn, styles.emailBtn]}
                onPress={() => share('email')}
                activeOpacity={0.8}
              >
                <Text style={styles.shareBtnIcon}>✉️</Text>
                <Text style={styles.shareBtnText}>Email</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
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
    marginBottom: 8,
    gap: 16,
  },
  backBtn: {
    padding: 4,
  },
  backIcon: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  headerInfo: {
    flex: 1,
  },
  personName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  daysLabel: {
    fontSize: 13,
    color: '#FF6B6B',
    marginTop: 2,
    fontWeight: '500',
  },
  scrollContent: {
    paddingBottom: 48,
  },
  micSection: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 24,
  },
  micPrompt: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
  },
  micOuter: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRing: {
    width: 106,
    height: 106,
    borderRadius: 53,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: '#FF3B3B',
  },
  micIcon: {
    fontSize: 30,
  },
  transcript: {
    marginTop: 20,
    color: '#AAA',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  generatingBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  generatingText: {
    color: '#888',
    fontSize: 14,
  },
  messageSection: {
    paddingHorizontal: 24,
    gap: 16,
  },
  messageSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  messageInput: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    minHeight: 160,
  },
  shareButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  shareBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    gap: 6,
  },
  whatsappBtn: {
    backgroundColor: '#25D36622',
    borderWidth: 1,
    borderColor: '#25D366',
  },
  imessageBtn: {
    backgroundColor: '#34AADC22',
    borderWidth: 1,
    borderColor: '#34AADC',
  },
  emailBtn: {
    backgroundColor: '#FF6B6B22',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  shareBtnIcon: {
    fontSize: 20,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
