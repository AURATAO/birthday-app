import { useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { savePushToken } from '../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  try {
    console.log('Starting push registration...');

    if (!Device.isDevice) {
      console.log('Not a physical device - skipping');
      return null;
    }

    const { status } = await Notifications.requestPermissionsAsync();
    console.log('Permission status:', status);

    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please enable notifications in Settings');
      return null;
    }

    const projectId =
      process.env.EXPO_PUBLIC_PROJECT_ID ??
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId;
    console.log('Project ID:', projectId);

    if (!projectId) {
      console.error('No projectId found!');
      Alert.alert('Error', 'Missing projectId — check app.json or .env');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('PUSH TOKEN:', tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error('Push registration failed:', error);
    Alert.alert('Error', String(error));
    return null;
  }
}

function AuthGuard({ session }: { session: Session | null }) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    const inAuthGroup = segments[0] === 'login';
    if (!session && !inAuthGroup) {
      router.replace('/login');
    } else if (session && inAuthGroup) {
      router.replace('/');
    }
  }, [session, segments]);

  return null;
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;

    registerForPushNotifications().then((token) => {
      if (token) savePushToken(token).catch(() => {});
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    return () => {
      notificationListener.current?.remove();
    };
  }, [session]);

  useEffect(() => {
    // App open: user taps notification while app is running or backgrounded
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as any;
      console.log('Notification response data:', JSON.stringify(data));
      if (data?.screen === 'card' && data?.event_id) {
        console.log('Navigating to card:', data.event_id);
        setTimeout(() => {
          router.push(`/card/${data.event_id}`);
        }, 500);
      }
    });

    // Cold start: app was closed when user tapped the notification
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data as any;
        console.log('Last notification data:', JSON.stringify(data));
        if (data?.screen === 'card' && data?.event_id) {
          setTimeout(() => {
            router.push(`/card/${data.event_id}`);
          }, 1000);
        }
      }
    });

    return () => subscription.remove();
  }, []);

  if (!ready) return null;

  return (
    <>
      <AuthGuard session={session} />
      <Slot />
    </>
  );
}
