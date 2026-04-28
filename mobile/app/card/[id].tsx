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
  Animated,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { getEvent, getCard, generateCard, updateCard, sendCard, updateEvent, deleteEvent } from '../../lib/api';
import { getLanguage } from '../../lib/storage';
import { Colors, Spacing, Radius, Typography } from '../../constants/theme';

type Step = 'mic' | 'message';

const TONE_CONFIG: Record<string, { emoji: string; label: string; desc: string }> = {
  birthday:    { emoji: '🎂', label: 'Birthday',    desc: 'warm & celebratory' },
  milestone:   { emoji: '⭐', label: 'Milestone',   desc: 'encouraging' },
  anniversary: { emoji: '💍', label: 'Anniversary', desc: 'deep warmth' },
  hard_date:   { emoji: '🕯️', label: 'Hard date',   desc: 'gentle tone' },
};

function daysUntilBirthday(birthdayStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [, month, day] = birthdayStr.split('-').map(Number);
  let next = new Date(today.getFullYear(), month - 1, day);
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export default function CardScreen() {
  const { id, card_id: cardIdParam } = useLocalSearchParams<{ id: string; card_id?: string }>();
  const router = useRouter();

  const [personName, setPersonName] = useState('');
  const [personPhone, setPersonPhone] = useState('');
  const [daysUntil, setDaysUntil] = useState(0);
  const [eventType, setEventType] = useState('birthday');
  const [loadingEvent, setLoadingEvent] = useState(true);

  const [step, setStep] = useState<Step>('mic');
  const [isListening, setIsListening] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [cardId, setCardId] = useState('');
  const [message, setMessage] = useState('');
  const [preGenerated, setPreGenerated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [showRecurringModal, setShowRecurringModal] = useState(false);

  const voiceNoteRef = useRef('');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    getEvent(id)
      .then((ev) => {
        setPersonName(ev.name);
        setPersonPhone(ev.phone ?? '');
        setDaysUntil(daysUntilBirthday(ev.birthday));
        setEventType(ev.event_type ?? 'birthday');
      })
      .catch((err) => Alert.alert('Error', err.message))
      .finally(() => setLoadingEvent(false));
  }, [id]);

  useEffect(() => {
    if (!cardIdParam) return;
    getCard(cardIdParam)
      .then((card) => {
        setCardId(card.id);
        setMessage(card.message);
        setPreGenerated(true);
        setStep('message');
      })
      .catch(() => {
        // Pre-generated card unavailable — fall through to normal mic flow
      });
  }, [cardIdParam]);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    voiceNoteRef.current = text;
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    stopPulse();
    if (voiceNoteRef.current.trim()) {
      autoGenerate(voiceNoteRef.current.trim());
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    stopPulse();
    if (event.error !== 'no-speech') {
      Alert.alert('Voice error', event.message ?? event.error);
    }
  });

  function startPulse() {
    pulseLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    pulseLoop.current.start();
  }

  function stopPulse() {
    pulseLoop.current?.stop();
    pulseAnim.setValue(1);
  }

  async function startListening() {
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed for voice input.');
      return;
    }
    voiceNoteRef.current = '';
    const lang = await getLanguage();
    ExpoSpeechRecognitionModule.start({
      lang: lang === 'zh' ? 'zh-TW' : 'en-US',
      continuous: false,
      interimResults: true,
    });
    setIsListening(true);
    startPulse();
  }

  function stopListening() {
    ExpoSpeechRecognitionModule.stop();
    setIsListening(false);
    stopPulse();
  }

  function handleMessageChange(text: string) {
    setMessage(text);
    if (!cardId) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateCard(cardId, text).catch(() => {});
    }, 1000);
  }

  async function autoGenerate(note: string) {
    setGenerating(true);
    try {
      const data = await generateCard(id, note);
      setCardId(data.id);
      setMessage(data.message);
      setStep('message');
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function share(channel: 'whatsapp' | 'imessage' | 'email') {
    if (!cardId) return;
    sendCard(cardId, channel).catch(() => {});

    const msg = encodeURIComponent(message);
    const ph = encodeURIComponent(personPhone.replace(/\s/g, ''));
    const urls: Record<string, string> = {
      whatsapp: personPhone
        ? `whatsapp://send?phone=${ph}&text=${msg}`
        : `whatsapp://send?text=${msg}`,
      imessage: personPhone
        ? `sms:${ph}&body=${msg}`
        : `sms:&body=${msg}`,
      email: `mailto:?subject=${encodeURIComponent('Happy Birthday!')}&body=${msg}`,
    };
    Linking.openURL(urls[channel]).catch(() =>
      Alert.alert('Could not open app', `Make sure ${channel} is installed.`)
    );

    // Show recurring modal after attempting to share
    setShowRecurringModal(true);
  }

  function handleRecurringYes() {
    setShowRecurringModal(false);
    updateEvent(id, true).catch(() => {});
    router.replace('/');
  }

  async function handleRecurringNo() {
    try {
      console.log('Deleting event:', id);
      const result = await deleteEvent(id);
      console.log('Delete result:', JSON.stringify(result));
      setShowRecurringModal(false);
      router.replace('/');
    } catch (err) {
      console.error('Delete failed:', err);
      Alert.alert('Error', 'Could not delete event');
    }
  }

  function handleDelete() {
    Alert.alert('Delete event?', 'This will remove the event and any saved cards.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteEvent(id);
            router.replace('/');
          } catch (err: any) {
            console.error('Delete event failed:', err?.message ?? err);
            Alert.alert('Error', err?.message ?? 'Could not delete event');
          }
        },
      },
    ]);
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
              <Text style={styles.personName}>{personName || 'Event'}</Text>
              {personName ? <Text style={styles.daysLabel}>{dayLabel}</Text> : null}
              {(() => {
                const tone = TONE_CONFIG[eventType];
                if (!tone) return null;
                return (
                  <View style={styles.tonePill}>
                    <Text style={styles.tonePillText}>
                      {tone.emoji} {tone.label} — {tone.desc}
                    </Text>
                  </View>
                );
              })()}
            </>
          )}
        </View>
        <TouchableOpacity onPress={handleDelete} style={styles.deleteBtn} activeOpacity={0.7}>
          <Text style={styles.deleteIcon}>🗑</Text>
        </TouchableOpacity>
      </View>

      {/* ── Step: mic ─────────────────────────────────────────────────────── */}
      {step === 'mic' && (
        <View style={styles.micScreen}>
          {generating ? (
            <>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.micScreenHint}>Writing your message…</Text>
            </>
          ) : (
            <>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={[styles.micBtn, isListening && styles.micBtnActive]}
                  onPress={isListening ? stopListening : startListening}
                  activeOpacity={0.75}
                >
                  <Text style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</Text>
                </TouchableOpacity>
              </Animated.View>
              <Text style={styles.micScreenHint}>
                {isListening ? 'Listening… tap to stop' : 'say anything...'}
              </Text>
            </>
          )}
        </View>
      )}

      {/* ── Step: message ─────────────────────────────────────────────────── */}
      {step === 'message' && (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {preGenerated && (
            <View style={styles.preGenBanner}>
              <Text style={styles.preGenBannerText}>💜 Samantha prepared this for you</Text>
              <View style={styles.preGenActions}>
                <TouchableOpacity
                  style={styles.preGenBtn}
                  onPress={() => { setStep('mic'); setPreGenerated(false); setIsEditing(false); }}
                  activeOpacity={0.75}
                >
                  <Text style={styles.preGenBtnText}>Re-record 🎤</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.preGenBtn, isEditing && styles.preGenBtnActive]}
                  onPress={() => setIsEditing((v) => !v)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.preGenBtnText, isEditing && styles.preGenBtnActiveText]}>
                    {isEditing ? 'Done ✓' : 'Edit ✏️'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your birthday message</Text>
            <TextInput
              style={[styles.input, styles.messageInput, preGenerated && !isEditing && styles.messageReadOnly]}
              value={message}
              onChangeText={handleMessageChange}
              multiline
              textAlignVertical="top"
              placeholderTextColor={Colors.textMuted}
              editable={!preGenerated || isEditing}
            />
          </View>

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
        </ScrollView>
      )}

      {/* ── Post-send recurring modal ──────────────────────────────────────── */}
      <Modal
        visible={showRecurringModal}
        transparent
        animationType="fade"
        onRequestClose={handleRecurringNo}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Sent! 🎉</Text>
            <Text style={styles.modalMessage}>
              Want Samantha to remind you again next year?
            </Text>
            <TouchableOpacity
              style={styles.modalBtnPrimary}
              onPress={handleRecurringYes}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBtnPrimaryText}>Yes, remind me next year 🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalBtnSecondary}
              onPress={handleRecurringNo}
              activeOpacity={0.85}
            >
              <Text style={styles.modalBtnSecondaryText}>No thanks</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  // ── Mic screen ──────────────────────────────────────────────────────────────
  micScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  micBtn: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  micBtnActive: {
    backgroundColor: 'rgba(226, 75, 74, 0.15)',
    borderColor: Colors.danger,
    shadowColor: Colors.danger,
  },
  micIcon: {
    fontSize: 36,
  },
  micScreenHint: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  // ── Message + share ─────────────────────────────────────────────────────────
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
  messageInput: {
    minHeight: 200,
    paddingTop: 13,
    lineHeight: 22,
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
  // ── Modal ────────────────────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
    gap: Spacing.md,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  modalBtnPrimary: {
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
  modalBtnPrimaryText: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  modalBtnSecondary: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalBtnSecondaryText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  deleteBtn: {
    padding: Spacing.xs,
  },
  deleteIcon: {
    fontSize: 20,
  },
  tonePill: {
    alignSelf: 'flex-start',
    marginTop: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    backgroundColor: 'rgba(124, 58, 237, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.3)',
  },
  tonePillText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  // ── Pre-generated banner ─────────────────────────────────────────────────────
  preGenBanner: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.25)',
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  preGenBannerText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  preGenActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  preGenBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 7,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
    backgroundColor: Colors.surface,
  },
  preGenBtnActive: {
    borderColor: 'rgba(124, 58, 237, 0.5)',
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  preGenBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  preGenBtnActiveText: {
    color: Colors.primary,
  },
  messageReadOnly: {
    borderColor: 'transparent',
    backgroundColor: Colors.surface,
  },
});
