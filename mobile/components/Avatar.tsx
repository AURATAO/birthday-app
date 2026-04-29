import { StyleSheet, Text, View } from 'react-native';
import { Colors, Radius } from '../constants/theme';

interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 40 }: AvatarProps) {
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    color: Colors.textPrimary,
    fontWeight: '600',
  },
});
