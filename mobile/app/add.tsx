import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { parseVoice, createPerson, createEvent } from '../lib/api';
import { Colors, Spacing, Radius, Typography } from '../constants/theme';

export default function AddScreen() {
  const router = useRouter();

  const [transcript, setTranscript] = useState('');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [relationship, setRelationship] = useState('');
  const [notes, setNotes] = useState('');
  const [phone, setPhone] = useState('');

  async function handleParse() {
    if (!transcript.trim()) return;
    setParsing(true);
    try {
      const parsed = await parseVoice(transcript.trim());
      if (parsed.name) setName(parsed.name);
      if (parsed.birthday) setBirthday(parsed.birthday);
      if (parsed.relationship) setRelationship(parsed.relationship);
      if (parsed.notes) setNotes(parsed.notes);
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
      Alert.alert('Required', 'Please enter a birthday date (YYYY-MM-DD).');
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
        type: 'birthday',
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Save failed', err.message);
    } finally {
      setSaving(false);
    }
  }

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
        <Text style={styles.title}>Add Birthday</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Voice transcript — text for now, voice enabled with EAS build */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Voice transcript</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder={'e.g. "My mom\'s birthday is March 15, she loves cooking..."'}
            placeholderTextColor={Colors.textMuted}
            value={transcript}
            onChangeText={setTranscript}
            multiline
            textAlignVertical="top"
          />
          <TouchableOpacity
            style={[styles.parseBtn, (!transcript.trim() || parsing) && styles.btnDisabled]}
            onPress={handleParse}
            disabled={!transcript.trim() || parsing}
            activeOpacity={0.8}
          >
            {parsing ? (
              <ActivityIndicator color={Colors.primary} size="small" />
            ) : (
              <Text style={styles.parseBtnText}>Auto-fill from transcript</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Name */}
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

        {/* Birthday */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Birthday *</Text>
          <TextInput
            style={styles.input}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
            value={birthday}
            onChangeText={setBirthday}
            keyboardType="numbers-and-punctuation"
          />
        </View>

        {/* Relationship */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Relationship</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Mom, Best friend, Partner"
            placeholderTextColor={Colors.textMuted}
            value={relationship}
            onChangeText={setRelationship}
          />
        </View>

        {/* Phone */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            placeholder="+1 555 000 0000"
            placeholderTextColor={Colors.textMuted}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notes</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            placeholder="Anything special to remember about them..."
            placeholderTextColor={Colors.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator color={Colors.textPrimary} />
          ) : (
            <Text style={styles.saveBtnText}>Save Birthday</Text>
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
  parseBtn: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  parseBtnText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.surfaceHigh,
    marginVertical: Spacing.xs,
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
