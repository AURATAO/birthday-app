import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Colors, Spacing, Radius } from '../constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
}

export function Button({ label, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], (disabled || loading) && styles.disabled]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : Colors.textPrimary} />
      ) : (
        <Text style={[styles.label, labelStyles[variant]]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  primary: {
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  secondary: {
    backgroundColor: Colors.surfaceHigh,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  danger: {
    backgroundColor: 'rgba(226, 75, 74, 0.1)',
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  ghost: {
    paddingVertical: Spacing.md,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});

const labelStyles = StyleSheet.create({
  primary: { color: '#fff' },
  secondary: { color: Colors.textSecondary },
  danger: { color: Colors.danger },
  ghost: { color: Colors.textMuted, fontSize: 13 },
});
