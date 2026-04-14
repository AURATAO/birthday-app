import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import * as Contacts from 'expo-contacts';
import { parseVoice, createPerson, createEvent } from '../lib/api';
import { getLanguage } from '../lib/storage';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

type Step = 'mic' | 'contacts' | 'confirm';

interface ContactMatch {
  id: string;
  name: string;
  phone: string;
}

export default function AddScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('mic');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState('birthday');
  const [emoji, setEmoji] = useState('🎂');
  const [recurring, setRecurring] = useState(true);
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState('');

  const [contactMatches, setContactMatches] = useState<ContactMatch[]>([]);
  const [selectedContact, setSelectedContact] = useState<ContactMatch | null>(null);
  const [manualPhone, setManualPhone] = useState('');

  const transcriptRef = useRef('');
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    transcriptRef.current = text;
    setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    stopPulse();
    if (transcriptRef.current.trim()) {
      autoParse(transcriptRef.current.trim());
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
    transcriptRef.current = '';
    setTranscript('');
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

  async function autoParse(text: string) {
    setParsing(true);
    try {
      const parsed = await parseVoice(text);
      if (parsed.name) setName(parsed.name);
      if (parsed.date) setBirthday(parsed.date);
      // Combine relationship + notes into a single personal note
      const combined = [parsed.relationship, parsed.notes].filter(Boolean).join(', ');
      setNotes(combined);
      if (parsed.category) setCategory(parsed.category);
      if (parsed.emoji) setEmoji(parsed.emoji);
      setRecurring(parsed.recurring ?? true);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.language) setLanguage(parsed.language);

      await searchContacts(parsed.name ?? '');
    } catch (err: any) {
      Alert.alert('Parse error', err.message);
    } finally {
      setParsing(false);
    }
  }

  async function searchContacts(personName: string) {
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted' || !personName.trim()) {
        setContactMatches([]);
        setStep('contacts');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Name],
        name: personName,
      });
      const matches: ContactMatch[] = data
        .filter(c => c.phoneNumbers && c.phoneNumbers.length > 0)
        .map(c => ({
          id: c.id ?? '',
          name: c.name ?? '',
          phone: c.phoneNumbers![0].number ?? '',
        }));
      setContactMatches(matches);
    } catch {
      setContactMatches([]);
    }
    setStep('contacts');
  }

  function selectContact(contact: ContactMatch) {
    setSelectedContact(contact);
    setPhone(contact.phone);
    setStep('confirm');
  }

  function clearContact() {
    setSelectedContact(null);
    setPhone('');
  }

  async function handleSave() {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter a name.');
      return;
    }
    if (!birthday.trim()) {
      Alert.alert('Required', 'Please enter a date (YYYY-MM-DD).');
      return;
    }
    setSaving(true);
    try {
      const finalPhone = (selectedContact?.phone || manualPhone || phone).trim();
      const { id: personId } = await createPerson({
        name: name.trim(),
        notes: notes.trim(),
        phone: finalPhone || undefined,
        language: language || undefined,
      });
      await createEvent({
        person_id: personId,
        event_date: birthday.trim(),
        type: category,
        title: title.trim() || undefined,
        emoji,
        recurring,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Step: mic ──────────────────────────────────────────────────────────────
  if (step === 'mic') {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Add Birthday</Text>
        </View>

        <View style={styles.micScreen}>
          {parsing ? (
            <>
              <ActivityIndicator color={Colors.primary} size="large" />
              <Text style={styles.micScreenHint}>Understanding…</Text>
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
                {isListening
                  ? 'Listening… tap to stop'
                  : 'Say something like\n"Aura\'s birthday is May 3rd, she\'s my best friend and loves red wine"'}
              </Text>

              {transcript ? (
                <View style={styles.transcriptBox}>
                  <Text style={styles.transcriptText}>{transcript}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </View>
    );
  }

  // ── Step: contacts ─────────────────────────────────────────────────────────
  if (step === 'contacts') {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <StatusBar style="light" />

        <View style={styles.header}>
          <TouchableOpacity onPress={() => setStep('mic')} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Link Contact</Text>
        </View>

        {contactMatches.length > 0 ? (
          <>
            <Text style={styles.contactsHint}>Matching contacts for "{name}"</Text>
            <FlatList
              data={contactMatches}
              keyExtractor={item => item.id + item.phone}
              contentContainerStyle={styles.contactsList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.contactRow}
                  onPress={() => selectContact(item)}
                  activeOpacity={0.75}
                >
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactAvatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.contactPhone}>{item.phone}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </>
        ) : (
          <View style={styles.noMatchBox}>
            <Text style={styles.noMatchText}>No contacts found for "{name}"</Text>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Phone number (optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="+1 555 000 0000"
                placeholderTextColor={Colors.textMuted}
                value={manualPhone}
                onChangeText={setManualPhone}
                keyboardType="phone-pad"
              />
            </View>
          </View>
        )}

        <View style={styles.contactsFooter}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setStep('confirm')}
            activeOpacity={0.75}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Step: confirm ──────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => setStep('contacts')} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Confirm Details</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            placeholder="Full name"
            placeholderTextColor={Colors.textMuted}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Date *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            value={birthday}
            onChangeText={setBirthday}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Note</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Anything personal to remember about them…"
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>

        {selectedContact ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Contact</Text>
            <View style={styles.selectedContactRow}>
              <View style={styles.contactAvatar}>
                <Text style={styles.contactAvatarText}>
                  {selectedContact.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{selectedContact.name}</Text>
                <Text style={styles.contactPhone}>{selectedContact.phone}</Text>
              </View>
              <TouchableOpacity onPress={clearContact} style={styles.clearBtn}>
                <Text style={styles.clearBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Phone (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="+1 555 000 0000"
              placeholderTextColor={Colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Save</Text>
          )}
        </TouchableOpacity>
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
    marginBottom: Spacing.xl,
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
  // ── Mic screen ──────────────────────────────────────────────────────────────
  micScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
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
  transcriptBox: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
    width: '100%',
  },
  transcriptText: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  // ── Contacts screen ─────────────────────────────────────────────────────────
  contactsHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  contactsList: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactAvatarText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  contactInfo: {
    flex: 1,
    gap: 2,
  },
  contactName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  contactPhone: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  noMatchBox: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.lg,
  },
  noMatchText: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xl,
  },
  contactsFooter: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    paddingTop: Spacing.lg,
  },
  skipBtn: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  skipText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '500',
  },
  // ── Confirm screen ──────────────────────────────────────────────────────────
  scroll: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 52,
    gap: Spacing.md,
  },
  section: {
    gap: Spacing.xs,
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
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  inputMultiline: {
    minHeight: 88,
    paddingTop: 13,
  },
  selectedContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  clearBtn: {
    padding: Spacing.xs,
  },
  clearBtnText: {
    color: Colors.textMuted,
    fontSize: 16,
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    marginTop: Spacing.sm,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  saveBtnText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
