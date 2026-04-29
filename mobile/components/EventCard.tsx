import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Spacing, Radius } from '../constants/theme';
import type { UpcomingEvent } from '../lib/api';

interface EventCardProps {
  event: UpcomingEvent;
  onPress: () => void;
  onLongPress: () => void;
  isDeleting?: boolean;
  onDelete?: () => void;
  onCancelDelete?: () => void;
}

function daysLabel(days: number) {
  if (days === 0) return 'Today!';
  if (days === 1) return 'Tomorrow';
  return `in ${days} days`;
}

function headline(event: UpcomingEvent) {
  if (event.event_type === 'birthday') return event.name;
  if (event.title) return `${event.name} · ${event.title}`;
  return event.name;
}

function displayEmoji(event: UpcomingEvent) {
  if (event.emoji) return event.emoji;
  const map: Record<string, string> = { birthday: '🎂', milestone: '⭐', anniversary: '💍', hard_date: '🕯️' };
  return map[event.event_type] ?? '🎂';
}

export function EventCard({ event, onPress, onLongPress, isDeleting, onDelete, onCancelDelete }: EventCardProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.75}
      style={[styles.card, isDeleting && styles.cardDeleting]}
    >
      <Text style={styles.emoji}>{displayEmoji(event)}</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.name} numberOfLines={1}>{headline(event)}</Text>
        <Text style={styles.date}>{event.birthday}</Text>
        <Text style={styles.days}>{daysLabel(event.days_until)}</Text>
      </View>
      {isDeleting ? (
        <View style={styles.deleteRow}>
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn}>
            <Text style={styles.deleteBtnText}>Delete</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onCancelDelete} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Text style={styles.chevron}>›</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
    borderColor: Colors.danger,
  },
  emoji: {
    fontSize: 28,
    width: 40,
    textAlign: 'center',
  },
  name: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '500',
  },
  date: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  days: {
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
    backgroundColor: Colors.danger,
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
});
