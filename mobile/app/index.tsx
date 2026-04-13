import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  KeyboardAvoidingView,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';
import { supabase } from '../lib/supabase';
import {
  getUpcomingBirthdays,
  deletePerson,
  parseVoice,
  createPerson,
  createEvent,
  UpcomingEvent,
} from '../lib/api';
import { getLanguage } from '../lib/storage';
import { Colors, Spacing, Radius } from '../constants/theme';

type CategoryKey = 'birthday' | 'milestone' | 'anniversary' | 'hard_date';

const CATEGORY_CONFIG: { key: CategoryKey; emoji: string; label: string }[] = [
  { key: 'birthday',    emoji: '🎂', label: 'Birthday' },
  { key: 'milestone',   emoji: '⭐', label: 'Milestone' },
  { key: 'anniversary', emoji: '💍', label: 'Anniversary' },
  { key: 'hard_date',   emoji: '🕯️', label: 'Hard date' },
];

function defaultEmojiForCategory(cat: string): string {
  return CATEGORY_CONFIG.find(c => c.key === cat)?.emoji ?? '🎂';
}

function displayEmojiForEvent(item: UpcomingEvent): string {
  if (item.emoji) return item.emoji;
  return defaultEmojiForCategory(item.event_type);
}

export default function HomeScreen() {
  const router = useRouter();

  // List state
  const [birthdays, setBirthdays] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  // Recording state
  const [isListening, setIsListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const transcriptRef = useRef('');

  // Form / bottom sheet state
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<CategoryKey>('birthday');
  const [emoji, setEmoji] = useState('🎂');
  const [parsedRecurring, setParsedRecurring] = useState(true);
  const [parsedTitle, setParsedTitle] = useState('');
  const [saving, setSaving] = useState(false);

  // Animations — only active during recording
  const tapAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(1)).current;
  const ring2Anim = useRef(new Animated.Value(1)).current;
  const listeningLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchBirthdays();
    }, [])
  );

  // ── Speech events ────────────────────────────────────────────────────────────

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    transcriptRef.current = text;
    setTranscript(text);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
    stopRingPulse();
    if (transcriptRef.current.trim()) {
      autoParse(transcriptRef.current.trim());
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    setIsListening(false);
    stopRingPulse();
    if (event.error !== 'no-speech') {
      Alert.alert('Voice error', event.message ?? event.error);
    }
  });

  // ── Animations ───────────────────────────────────────────────────────────────

  function startRingPulse() {
    listeningLoop.current = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(ring1Anim, { toValue: 1.14, duration: 700, useNativeDriver: true }),
          Animated.timing(ring1Anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ring2Anim, { toValue: 1.22, duration: 1000, useNativeDriver: true }),
          Animated.timing(ring2Anim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]),
      ])
    );
    listeningLoop.current.start();
  }

  function stopRingPulse() {
    listeningLoop.current?.stop();
    ring1Anim.setValue(1);
    ring2Anim.setValue(1);
  }

  function animateTap() {
    Animated.sequence([
      Animated.timing(tapAnim, { toValue: 1.08, duration: 100, useNativeDriver: true }),
      Animated.timing(tapAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  }

  // ── Data ─────────────────────────────────────────────────────────────────────

  async function fetchBirthdays() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    try {
      const data = await getUpcomingBirthdays();
      setBirthdays(Array.isArray(data) ? data : []);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(item: UpcomingEvent) {
    try {
      await deletePerson(item.person_id);
      setBirthdays((prev) => prev.filter((b) => b.id !== item.id));
      setDeletingId(null);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    }
  }

  // ── Voice flow ───────────────────────────────────────────────────────────────

  async function handleButtonPress() {
    animateTap();
    if (isListening) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      stopRingPulse();
    } else {
      await startListening();
    }
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
    startRingPulse();
  }

  async function autoParse(text: string) {
    setParsing(true);
    try {
      const parsed = await parseVoice(text);
      setName(parsed.name ?? '');
      setBirthday(parsed.date ?? '');
      setRelationship(parsed.relationship ?? '');
      setNotes(parsed.notes ?? '');
      setPhone('');
      const cat = (parsed.category as CategoryKey) ?? 'birthday';
      setCategory(cat);
      setEmoji(parsed.emoji || defaultEmojiForCategory(cat));
      setParsedRecurring(parsed.recurring ?? true);
      setParsedTitle(parsed.title ?? '');
      setShowForm(true);
    } catch (err: any) {
      Alert.alert('Parse error', err.message);
    } finally {
      setParsing(false);
    }
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
      const { id: personId } = await createPerson({
        name: name.trim(),
        relationship: relationship.trim(),
        notes: notes.trim(),
        phone: phone.trim(),
      });
      await createEvent({
        person_id: personId,
        event_date: birthday.trim(),
        type: category,
        title: parsedTitle.trim() || undefined,
        emoji,
        recurring: parsedRecurring,
      });
      dismissForm();
      setTranscript('');
      fetchBirthdays();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

  function dismissForm() {
    setShowForm(false);
    setName('');
    setBirthday('');
    setRelationship('');
    setNotes('');
    setPhone('');
    setCategory('birthday');
    setEmoji('🎂');
    setParsedRecurring(true);
    setParsedTitle('');
  }

  // ── Derived display values ────────────────────────────────────────────────────

  const firstName = userEmail.split('@')[0].split('.')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'good morning' : hour < 17 ? 'good afternoon' : 'good evening';

  const filteredBirthdays = activeFilter === 'all'
    ? birthdays
    : birthdays.filter(b => b.event_type === activeFilter);

  // ── Render ───────────────────────────────────────────────────────────────────

  const getCardTitle = (item: UpcomingEvent) => {
    if (item.event_type === 'birthday') return item.name;
    if (item.title) return `${item.name} · ${item.title}`;
    return item.name;
  };

  const renderBirthday = useCallback(({ item }: { item: UpcomingEvent }) => {
    const isDeleting = deletingId === item.id;
    const displayEmoji = displayEmojiForEvent(item);
    const headline = getCardTitle(item);
    const daysLabel = item.days_until === 0 ? 'Today!' : item.days_until === 1 ? 'Tomorrow' : `in ${item.days_until} days`;
    return (
      <TouchableOpacity
        onPress={() => !deletingId && router.push(`/card/${item.id}`)}
        onLongPress={() => setDeletingId(item.id)}
        activeOpacity={0.75}
        style={[styles.card, isDeleting && styles.cardDeleting]}
      >
        {/* Emoji — fixed 40 wide, never clips */}
        <Text style={styles.cardEmoji}>{displayEmoji}</Text>

        {/* Text — flex:1 takes remaining space, prevents cutoff */}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardName} numberOfLines={1}>{headline}</Text>
          <Text style={styles.cardDate}>{item.birthday}</Text>
          <Text style={styles.daysText}>{daysLabel}</Text>
        </View>

        {/* Arrow — fixed on far right */}
        {isDeleting ? (
          <View style={styles.deleteRow}>
            <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setDeletingId(null)} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.chevron}>›</Text>
        )}
      </TouchableOpacity>
    );
  }, [deletingId]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>
            {greeting},{displayName ? ` ${displayName}` : ''}
          </Text>
          <Text style={styles.appName}>samantha</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
          <View style={styles.settingsCircle}>
            <Text style={styles.settingsInitial}>
              {displayName ? displayName[0].toUpperCase() : '?'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* S button — top half, fixed */}
      <View style={styles.buttonSection}>
        {parsing ? (
          <>
            <ActivityIndicator color={Colors.primary} size="large" />
            <Text style={styles.buttonLabel}>Understanding…</Text>
          </>
        ) : (
          <>
            <Animated.View style={{ transform: [{ scale: tapAnim }] }}>
              <Animated.View style={[styles.ring2, { transform: [{ scale: ring2Anim }] }]}>
                <Animated.View style={[styles.ring1, { transform: [{ scale: ring1Anim }] }]}>
                  <TouchableOpacity
                    style={[styles.sButton, isListening && styles.sButtonListening]}
                    onPress={handleButtonPress}
                    activeOpacity={0.9}
                  >
                    {isListening ? (
                      <View style={styles.stopSquare} />
                    ) : (
                      <Text style={styles.sLogo}>S</Text>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
            </Animated.View>
            <Text style={styles.buttonLabel}>
              {isListening ? 'Listening… tap to stop' : 'tap to add a moment'}
            </Text>
            {isListening && transcript ? (
              <Text style={styles.transcriptText} numberOfLines={2}>{transcript}</Text>
            ) : null}
          </>
        )}
      </View>

      {/* Event list — bottom half, scrollable */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Upcoming</Text>

        {/* Category filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {[{ key: 'all', label: 'All' }, ...CATEGORY_CONFIG.map(c => ({ key: c.key, label: c.emoji }))].map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterTab, activeFilter === f.key && styles.filterTabActive]}
              onPress={() => setActiveFilter(f.key)}
            >
              <Text style={[styles.filterTabText, activeFilter === f.key && styles.filterTabTextActive, f.key !== 'all' && { fontSize: 22 }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
        ) : filteredBirthdays.length === 0 ? (
          <Text style={styles.emptyText}>
            {activeFilter === 'all' ? 'No upcoming moments — add one above' : 'None in this category'}
          </Text>
        ) : (
          <FlatList
            data={filteredBirthdays}
            keyExtractor={(item) => item.id}
            renderItem={renderBirthday}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Bottom sheet — confirm details */}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={dismissForm}
      >
        <KeyboardAvoidingView
          style={styles.sheetOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={styles.sheetBackdrop} activeOpacity={1} onPress={dismissForm} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />

            {/* Large emoji + tappable category pills */}
            <View style={styles.categoryHeader}>
              <Text style={styles.categoryEmoji}>{emoji}</Text>
              <View style={styles.categoryPills}>
                {CATEGORY_CONFIG.map(c => (
                  <TouchableOpacity
                    key={c.key}
                    style={[styles.categoryPill, category === c.key && styles.categoryPillActive]}
                    onPress={() => {
                      setCategory(c.key);
                      setEmoji(c.emoji);
                    }}
                  >
                    <Text style={[styles.categoryPillText, category === c.key && styles.categoryPillTextActive]}>
                      {c.emoji} {c.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {([
                { label: 'Name *', value: name, onChange: setName, placeholder: 'Full name', caps: 'words' as const },
                { label: 'Date *', value: birthday, onChange: setBirthday, placeholder: 'YYYY-MM-DD', keyboard: 'numbers-and-punctuation' as const },
                { label: 'Relationship', value: relationship, onChange: setRelationship, placeholder: 'e.g. Mom, Best friend' },
                { label: 'Phone', value: phone, onChange: setPhone, placeholder: '+1 555 000 0000', keyboard: 'phone-pad' as const },
                { label: 'Notes', value: notes, onChange: setNotes, placeholder: 'Anything special…', multi: true },
              ] as const).map((f) => (
                <View key={f.label} style={styles.formField}>
                  <Text style={styles.formLabel}>{f.label}</Text>
                  <TextInput
                    style={[styles.formInput, 'multi' in f && f.multi && styles.formInputMulti]}
                    value={f.value}
                    onChangeText={f.onChange}
                    placeholder={f.placeholder}
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize={'caps' in f ? f.caps : 'none'}
                    keyboardType={'keyboard' in f ? f.keyboard : 'default'}
                    multiline={'multi' in f && f.multi}
                    textAlignVertical={'multi' in f && f.multi ? 'top' : 'auto'}
                  />
                </View>
              ))}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.45 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
              <View style={{ height: 32 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  greeting: {
    fontSize: 15,
    fontWeight: '400',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  appName: {
    fontSize: 26,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  settingsBtn: { padding: Spacing.xs },
  settingsCircle: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  settingsInitial: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // ── S Button (top half) ─────────────────────────────────────────────────────
  buttonSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  ring2: {
    width: 170,
    height: 170,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring1: {
    width: 138,
    height: 138,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sButton: {
    width: 108,
    height: 108,
    borderRadius: Radius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
  sButtonListening: {
    backgroundColor: Colors.danger,
    shadowColor: Colors.danger,
  },
  sLogo: {
    fontFamily: 'serif',
    fontStyle: 'italic',
    fontSize: 56,
    fontWeight: '300',
    color: 'white',
  },
  stopSquare: {
    width: 22,
    height: 22,
    borderRadius: 4,
    backgroundColor: 'white',
  },
  buttonLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    letterSpacing: 0.3,
  },
  transcriptText: {
    color: Colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    fontStyle: 'italic',
  },

  // ── Event list (bottom half) ─────────────────────────────────────────────────
  listSection: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  filterScroll: {
    marginBottom: Spacing.md,
    flexGrow: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
  },
  filterTab: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  filterTabActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  filterTabText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: Colors.textPrimary,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardDeleting: {
    backgroundColor: '#3D0A0A',
    borderColor: '#E24B4A',
  },
  cardEmoji: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  cardName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  cardDate: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  daysText: {
    color: Colors.primary,
    fontSize: 12,
    marginTop: 2,
  },
  chevron: {
    color: Colors.textMuted,
    fontSize: 18,
  },
  deleteRow: {
    flexDirection: 'row',
    gap: 8,
  },
  deleteBtn: {
    backgroundColor: '#E24B4A',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  deleteBtnText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  cancelBtn: {
    backgroundColor: Colors.surfaceHigh,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  cancelBtnText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },

  // ── Bottom sheet ─────────────────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
    borderBottomWidth: 0,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
    alignSelf: 'center',
    marginBottom: Spacing.lg,
  },

  // ── Category header in sheet ─────────────────────────────────────────────────
  categoryHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  categoryEmoji: {
    fontSize: 48,
  },
  categoryPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    justifyContent: 'center',
  },
  categoryPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  categoryPillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  categoryPillText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  categoryPillTextActive: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },

  // ── Form fields ──────────────────────────────────────────────────────────────
  formField: {
    marginBottom: Spacing.md,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: Spacing.xs,
  },
  formInput: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  formInputMulti: {
    minHeight: 80,
    paddingTop: 13,
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
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
