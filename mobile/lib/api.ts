import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function getUpcomingBirthdays() {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/events/upcoming`, { headers });
  if (!res.ok) throw new Error('Failed to fetch birthdays');
  return res.json();
}

export async function generateCard(eventId: string, voiceNote: string, language: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/card/generate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ event_id: eventId, voice_note: voiceNote, language }),
  });
  if (!res.ok) throw new Error('Failed to generate card');
  return res.json();
}

export async function savePushToken(token: string) {
  const headers = await authHeaders();
  const res = await fetch(`${API_URL}/api/push-token`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error('Failed to save push token');
  return res.json();
}
