import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { getEvent, generateCard, updateCard, sendCard } from '../../lib/api';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

function daysUntilBirthday(birthdayStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [, month, day] = birthdayStr.split('-').map(Number);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [personName, setPersonName] = useState('');
  const [daysUntil, setDaysUntil] = useState(0);
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [voiceNote, setVoiceNote] = useState('');
  const [generating, setGenerating] = useState(false);

  const [cardId, setCardId] = useState('');
  const [message, setMessage] = useState('');

  // Debounced save for edited message
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    getEvent(id)
      .then((ev) => {
        setPersonName(ev.name);
        setDaysUntil(daysUntilBirthday(ev.birthday));
      })
      .catch((err) => Alert.alert('Error', err.message))
      .finally(() => setLoadingEvent(false));
  }, [id]);

  function handleMessageChange(text: string) {
    setMessage(text);
    if (!cardId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateCard(cardId, text).catch(() => {});
    }, 1000);
  }

  async function handleGenerate() {
    if (!voiceNote.trim()) {
      Alert.alert('Required', 'Tell me something about what you want to say.');
      return;
    }
    setGenerating(true);
    try {
      const data = await generateCard(id, voiceNote.trim());
      setCardId(data.id);
      setMessage(data.message);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function share(channel: 'whatsapp' | 'imessage' | 'email') {
    if (!cardId) return;

    // Mark card as sent, fire-and-forget — don't block the share
    sendCard(cardId, channel).catch(() => {});

    const msg = encodeURIComponent(message);
    const urls: Record<string, string> = {
      whatsapp: `whatsapp://send?text=${msg}`,
      imessage: `sms:&body=${msg}`,
      email: `mailto:?subject=${encodeURIComponent('Happy Birthday!')}&body=${msg}`,
    };
    Linking.openURL(urls[channel]).catch(() =>
      Alert.alert('Could not open app', `Make sure ${channel} is installed.`)
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {loadingEvent ? (
            <ActivityIndicator color={Colors.primary} />
          ) : (
            <>
              <Text style={styles.personName}>{personName || 'Birthday Card'}</Text>
              {personName ? <Text style={styles.daysLabel}>{dayLabel}</Text> : null}
            </>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Voice note input */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Say anything you want to tell them</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={`What do you want to say to ${personName || 'them'}?`}
            placeholderTextColor={Colors.textMuted}
            value={voiceNote}
            onChangeText={setVoiceNote}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.generateBtn, (generating || !voiceNote.trim()) && styles.btnDisabled]}
            onPress={handleGenerate}
            disabled={generating || !voiceNote.trim()}
            activeOpacity={0.85}
          >
            {generating ? (
              <ActivityIndicator color={Colors.textPrimary} size="small" />
            ) : (
              <Text style={styles.generateBtnText}>✦ Generate message</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Generated message */}
        {message ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your birthday message</Text>
            <TextInput
              style={[styles.input, styles.messageInput]}
              value={message}
              onChangeText={handleMessageChange}
              multiline
              textAlignVertical="top"
              placeholderTextColor={Colors.textMuted}
            />

            {/* Share buttons */}
            <View style={styles.shareRow}>
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
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    gap: Spacing.lg,
  },
  backBtn: {
    padding: Spacing.xs,
  },
  backIcon: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  headerInfo: {
    flex: 1,
  },
  personName: {
    ...Typography.h2,
    fontWeight: '600',
  },
  daysLabel: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 2,
    fontWeight: '500',
  },
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 52,
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
    letterSpacing: 1.1,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  inputMultiline: {
    minHeight: 100,
    paddingTop: 13,
  },
  messageInput: {
    minHeight: 160,
    paddingTop: 13,
    lineHeight: 22,
  },
  generateBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  generateBtnText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  shareRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  shareBtn: {
    flex: 1,
    borderRadius: Radius.md,
    paddingVertical: 14,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  whatsappBtn: {
    backgroundColor: 'rgba(37, 211, 102, 0.12)',
    borderWidth: 1,
    borderColor: Colors.whatsapp,
  },
  imessageBtn: {
    backgroundColor: 'rgba(28, 122, 239, 0.12)',
    borderWidth: 1,
    borderColor: Colors.imessage,
  },
  emailBtn: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.email,
  },
  shareBtnIcon: {
    fontSize: 20,
  },
  shareBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
