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
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Voice from '@react-native-voice/voice';
import { supabase } from '../lib/supabase';
import { getUpcomingBirthdays } from '../lib/api';

interface Birthday {
  id: string;
  name: string;
  days_until: number;
  date: string;
  emoji?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [birthdays, setBirthdays] = useState<Birthday[]>([]);
  const [loading, setLoading] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
    });
    fetchBirthdays();

    Voice.onSpeechStart = () => setIsListening(true);
    Voice.onSpeechEnd = () => setIsListening(false);
    Voice.onSpeechError = () => setIsListening(false);

    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
      pulseLoop.current?.stop();
    };
  }, []);

  useEffect(() => {
    if (isListening) {
      pulseLoop.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.18,
            duration: 700,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 700,
            useNativeDriver: true,
          }),
        ])
      );
      pulseLoop.current.start();
    } else {
      pulseLoop.current?.stop();
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [isListening]);

  async function fetchBirthdays() {
    try {
      const data = await getUpcomingBirthdays();
      setBirthdays(data?.events ?? data ?? []);
    } catch (err: any) {
      Alert.alert('Error', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleMicPress() {
    if (isListening) {
      try {
        await Voice.stop();
      } catch {}
      return;
    }
    try {
      await Voice.start('en-US');
    } catch (err: any) {
      Alert.alert('Microphone error', err.message);
    }
  }

  const firstName = userEmail.split('@')[0].split('.')[0];
  const displayName = firstName.charAt(0).toUpperCase() + firstName.slice(1);

  const renderBirthday = useCallback(({ item }: { item: Birthday }) => {
    const isToday = item.days_until === 0;
    const isTomorrow = item.days_until === 1;
    const label = isToday ? 'Today!' : isTomorrow ? 'Tomorrow' : `in ${item.days_until} days`;
    const emoji = item.emoji ?? '🎂';

    return (
      <TouchableOpacity
        style={styles.birthdayCard}
        onPress={() => router.push(`/card/${item.id}`)}
        activeOpacity={0.75}
      >
        <View style={styles.birthdayAvatar}>
          <Text style={styles.birthdayEmoji}>{emoji}</Text>
        </View>
        <View style={styles.birthdayInfo}>
          <Text style={styles.birthdayName}>{item.name}</Text>
          <Text style={styles.birthdayDate}>{item.date}</Text>
        </View>
        <View style={[styles.daysBadge, isToday && styles.daysBadgeToday]}>
          <Text style={[styles.daysText, isToday && styles.daysTextToday]}>{label}</Text>
        </View>
      </TouchableOpacity>
    );
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey {displayName}! 👋</Text>
          <Text style={styles.subGreeting}>Who do you want to celebrate?</Text>
        </View>
        <TouchableOpacity onPress={() => router.push('/settings')} style={styles.settingsBtn}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Mic Section */}
      <View style={styles.micSection}>
        <Text style={styles.micLabel}>
          {isListening ? 'Listening...' : 'Tap to search'}
        </Text>
        <Animated.View style={[styles.micOuter, { transform: [{ scale: pulseAnim }] }]}>
          <View style={styles.micRing}>
            <TouchableOpacity
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={handleMicPress}
              activeOpacity={0.9}
            >
              <Text style={styles.micIcon}>{isListening ? '⏹' : '🎤'}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      {/* Birthdays List */}
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>Upcoming Birthdays</Text>
        {loading ? (
          <ActivityIndicator color="#FF6B6B" style={{ marginTop: 32 }} />
        ) : birthdays.length === 0 ? (
          <Text style={styles.emptyText}>No upcoming birthdays</Text>
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
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 24,
    marginBottom: 8,
  },
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subGreeting: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  settingsBtn: {
    padding: 4,
  },
  settingsIcon: {
    fontSize: 24,
  },
  micSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  micLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  micOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255, 107, 107, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micRing: {
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FF6B6B',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  micButtonActive: {
    backgroundColor: '#FF3B3B',
  },
  micIcon: {
    fontSize: 36,
  },
  listSection: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  listContent: {
    paddingBottom: 32,
    gap: 12,
  },
  birthdayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    padding: 16,
    gap: 14,
  },
  birthdayAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  birthdayEmoji: {
    fontSize: 24,
  },
  birthdayInfo: {
    flex: 1,
  },
  birthdayName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  birthdayDate: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  daysBadge: {
    backgroundColor: '#2A2A2A',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  daysBadgeToday: {
    backgroundColor: '#FF6B6B22',
    borderWidth: 1,
    borderColor: '#FF6B6B',
  },
  daysText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#888',
  },
  daysTextToday: {
    color: '#FF6B6B',
  },
  emptyText: {
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 16,
  },
});
