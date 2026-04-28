import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { Slot, useRouter, useSegments } from 'expo-router';
import { apiFetch } from '../lib/api';
import * as Notifications from 'expo-notifications';
import * as Contacts from 'expo-contacts';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

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
  const registrationDone = useRef(false);
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
    if (registrationDone.current) return;
    registrationDone.current = true;

    Notifications.setNotificationCategoryAsync('HAS_PHONE', [
      {
        identifier: 'SEND_WHATSAPP',
        buttonTitle: 'Send WhatsApp 💬',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'EDIT',
        buttonTitle: 'Edit ✏️',
        options: { opensAppToForeground: true },
      },
    ]).catch(() => {});

    Notifications.setNotificationCategoryAsync('NO_PHONE', [
      {
        identifier: 'OPEN',
        buttonTitle: 'Open →',
        options: { opensAppToForeground: true },
      },
    ]).catch(() => {});

    Contacts.requestPermissionsAsync().catch(() => {});

    registerForPushNotifications().then(async (token) => {
      if (!token) return;

      const { data: { session } } = await supabase.auth.getSession();
      console.log('Saving token, session exists:', !!session);
      console.log('API URL:', process.env.EXPO_PUBLIC_API_URL);
      console.log('Token:', token);

      if (!session?.access_token) {
        console.error('No session token!');
        return;
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_API_URL}/api/push-token`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            token: token,
            platform: Platform.OS
          })
        }
      );

      const result = await response.json();
      console.log('Save token status:', response.status);
      console.log('Save token result:', JSON.stringify(result));
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    return () => {
      notificationListener.current?.remove();
    };
  }, [session]);

  useEffect(() => {
    function handleNotificationResponse(response: Notifications.NotificationResponse) {
      const { actionIdentifier, notification } = response;
      const data = notification.request.content.data as any;
      console.log('Notification action:', actionIdentifier, JSON.stringify(data));

      if (actionIdentifier === 'SEND_WHATSAPP') {
        const msg = encodeURIComponent(data.message || '');
        const phone = encodeURIComponent((data.phone || '').replace(/\s/g, ''));
        Linking.openURL(`whatsapp://send?phone=${phone}&text=${msg}`).catch(() => {});
        if (data.card_id) {
          apiFetch(`/api/card/${data.card_id}/send`, {
            method: 'POST',
            body: JSON.stringify({ channel: 'whatsapp' }),
          }).catch(() => {});
        }
        return;
      }

      if (
        actionIdentifier === 'EDIT' ||
        actionIdentifier === 'OPEN' ||
        actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER
      ) {
        if (data?.screen === 'card' && data?.event_id) {
          const cardParam = data.card_id ? `?card_id=${data.card_id}` : '';
          setTimeout(() => {
            router.push(`/card/${data.event_id}${cardParam}`);
          }, 500);
        }
      }
    }

    // App open / backgrounded
    const subscription = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    // Cold start
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
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
