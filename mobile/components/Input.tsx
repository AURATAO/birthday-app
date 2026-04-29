import { StyleSheet, Text, TextInput, View } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { Colors, Spacing, Radius } from '../constants/theme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

export function Input({ label, value, onChangeText, placeholder, multiline, keyboardType, autoCapitalize }: InputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'auto'}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize={autoCapitalize ?? 'none'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.xs,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  input: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 13,
    color: Colors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  multiline: {
    minHeight: 80,
    paddingTop: 13,
  },
});
