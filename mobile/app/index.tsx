import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Animated,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { supabase } from '../lib/supabase';
import { getUpcomingBirthdays, deletePerson, UpcomingEvent } from '../lib/api';
import { Colors, Spacing, Radius } from '../constants/theme';

export default function HomeScreen() {
  const router = useRouter();
  const [birthdays, setBirthdays] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState('');

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Anim = useRef(new Animated.Value(1)).current;
  const ring2Anim = useRef(new Animated.Value(1)).current;

  // Idle ripple animation — runs continuously
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
    });

    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ring1Anim, { toValue: 1.14, duration: 1200, useNativeDriver: true }),
          Animated.timing(ring1Anim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(ring2Anim, { toValue: 1.22, duration: 1500, useNativeDriver: true }),
          Animated.timing(ring2Anim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // Refresh list every time screen comes into focus (e.g. returning from /add)
  useFocusEffect(
    useCallback(() => {
      fetchBirthdays();
    }, [])
  );

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
    Alert.alert(
      'Delete Birthday',
      `Remove ${item.name}'s birthday?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePerson(item.person_id);
              setBirthdays((prev) => prev.filter((b) => b.id !== item.id));
            } catch (err: any) {
              Alert.alert('Error', err.message);
            }
          },
        },
      ]
    );
  }

  const firstName = userEmail.split('@')[0].split('.')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'good morning' : hour < 17 ? 'good afternoon' : 'good evening';

  const renderRightActions = useCallback(
    (item: UpcomingEvent) => (
      <TouchableOpacity
        style={styles.deleteAction}
        onPress={() => handleDelete(item)}
        activeOpacity={0.8}
      >
        <Text style={styles.deleteActionText}>Delete</Text>
      </TouchableOpacity>
    ),
    []
  );

  const renderBirthday = useCallback(({ item }: { item: UpcomingEvent }) => {
    const isToday = item.days_until === 0;
    const isTomorrow = item.days_until === 1;
    const label = isToday ? 'Today!' : isTomorrow ? 'Tomorrow' : `in ${item.days_until} days`;

    return (
      <ReanimatedSwipeable
        renderRightActions={() => renderRightActions(item)}
        overshootRight={false}
        friction={2}
      >
        <TouchableOpacity
          style={styles.birthdayCard}
          onPress={() => router.push(`/card/${item.id}`)}
          activeOpacity={0.75}
        >
          <View style={styles.birthdayAvatar}>
            <Text style={styles.birthdayEmoji}>🎂</Text>
          </View>
          <View style={styles.birthdayInfo}>
            <Text style={styles.birthdayName}>{item.name}</Text>
            <Text style={styles.birthdayDate}>
              {item.relationship ? `${item.relationship} · ` : ''}{item.birthday}
            </Text>
          </View>
          <View style={[styles.daysBadge, isToday && styles.daysBadgeToday]}>
            <Text style={[styles.daysText, isToday && styles.daysTextToday]}>{label}</Text>
          </View>
        </TouchableOpacity>
      </ReanimatedSwipeable>
    );
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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

        {/* Mic Section — taps navigate to /add */}
        <View style={styles.micSection}>
          <Animated.View style={[styles.micRing2, { transform: [{ scale: ring2Anim }] }]}>
            <Animated.View style={[styles.micRing1, { transform: [{ scale: ring1Anim }] }]}>
              <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                <TouchableOpacity
                  style={styles.micButton}
                  onPress={() => router.push('/add' as any)}
                  activeOpacity={0.9}
                >
                  <Text style={styles.micIcon}>🎤</Text>
                </TouchableOpacity>
              </Animated.View>
            </Animated.View>
          </Animated.View>
          <Text style={styles.micLabel}>tap to add a birthday</Text>
        </View>

        {/* Birthdays List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {loading ? (
            <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
          ) : birthdays.length === 0 ? (
            <Text style={styles.emptyText}>No upcoming birthdays — add one above</Text>
          ) : (
            <FlatList
              data={birthdays}
              keyExtractor={(item) => item.id}
              renderItem={renderBirthday}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </View>
    </GestureHandlerRootView>
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
  settingsBtn: {
    padding: Spacing.xs,
  },
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
  micSection: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  micRing2: {
    width: 172,
    height: 172,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRing1: {
    width: 140,
    height: 140,
    borderRadius: Radius.full,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
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
  micIcon: {
    fontSize: 38,
  },
  micLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: Spacing.lg,
    letterSpacing: 0.3,
  },
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
    marginBottom: Spacing.md,
  },
  listContent: {
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceHigh,
  },
  birthdayAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayEmoji: {
    fontSize: 22,
  },
  birthdayInfo: {
    flex: 1,
  },
  birthdayName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  birthdayDate: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  daysBadge: {
    backgroundColor: Colors.surfaceHigh,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  daysBadgeToday: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  daysText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  daysTextToday: {
    color: Colors.primary,
  },
  emptyText: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  deleteAction: {
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
    width: 88,
    borderRadius: Radius.lg,
    marginLeft: Spacing.sm,
  },
  deleteActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
