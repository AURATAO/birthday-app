import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Spacing, Radius } from '../constants/theme';

interface CategoryPillProps {
  category: string;
  emoji?: string;
  label?: string;
  selected: boolean;
  onPress: () => void;
}

export function CategoryPill({ category, emoji, label, selected, onPress }: CategoryPillProps) {
  const isAll = category === 'all';
  return (
    <TouchableOpacity
      style={[styles.pill, selected && styles.pillActive]}
      onPress={onPress}
    >
      {isAll ? (
        <Text style={[styles.text, selected && styles.textActive]}>{label ?? 'All'}</Text>
      ) : (
        <View style={styles.emojiWrap}>
          <Text style={[styles.emojiText, selected && styles.textActive]}>{emoji}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 40,
    paddingHorizontal: Spacing.md,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  text: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '500',
    lineHeight: 16,
  },
  textActive: {
    color: Colors.textPrimary,
  },
  emojiWrap: {
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
});
