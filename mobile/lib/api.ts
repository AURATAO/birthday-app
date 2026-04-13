import { Platform } from 'react-native';
import { supabase } from './supabase';

const API_URL = process.env.EXPO_PUBLIC_API_URL!;

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return res.json();
}

// Events
export const getUpcomingBirthdays = () =>
  apiFetch<UpcomingEvent[]>('/api/events/upcoming');

export const getEvent = (id: string) =>
  apiFetch<EventDetail>(`/api/events/${id}`);

// People
export const createPerson = (body: CreatePersonBody) =>
  apiFetch<{ id: string }>('/api/people', { method: 'POST', body: JSON.stringify(body) });

export const updatePerson = (id: string, body: UpdatePersonBody) =>
  apiFetch(`/api/people/${id}`, { method: 'PUT', body: JSON.stringify(body) });

export const updateEvent = (id: string, recurring: boolean) =>
  apiFetch(`/api/events/${id}`, { method: 'PUT', body: JSON.stringify({ recurring }) });

export const deletePerson = (id: string) =>
  apiFetch(`/api/people/${id}`, { method: 'DELETE' });

export const createEvent = (body: CreateEventBody) =>
  apiFetch<{ id: string }>('/api/events', { method: 'POST', body: JSON.stringify(body) });

// Voice
export const parseVoice = (transcript: string) =>
  apiFetch<ParsedPerson>('/api/voice/parse', {
    method: 'POST',
    body: JSON.stringify({ transcript }),
  });

// Cards — birthday_id is an event id; voice_transcript matches the Go handler
export const generateCard = (birthdayId: string, voiceTranscript: string) =>
  apiFetch<{ id: string; message: string }>('/api/card/generate', {
    method: 'POST',
    body: JSON.stringify({ birthday_id: birthdayId, voice_transcript: voiceTranscript }),
  });

export const updateCard = (cardId: string, editedMessage: string) =>
  apiFetch(`/api/card/${cardId}`, {
    method: 'PUT',
    body: JSON.stringify({ edited_message: editedMessage }),
  });

export const deleteCard = (cardId: string) =>
  apiFetch(`/api/card/${cardId}`, { method: 'DELETE' });

export const sendCard = (cardId: string, channel: string) =>
  apiFetch(`/api/card/${cardId}/send`, {
    method: 'POST',
    body: JSON.stringify({ channel }),
  });

// Push tokens — platform sourced from device at call site
export const savePushToken = (token: string) =>
  apiFetch('/api/push-token', {
    method: 'POST',
    body: JSON.stringify({ token, platform: Platform.OS }),
  });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UpcomingEvent {
  id: string;
  person_id: string;
  name: string;
  relationship: string;
  birthday: string;
  event_type: string;
  emoji: string;
  title: string;
  days_until: number;
  remind_days: number;
}

export interface EventDetail {
  id: string;
  name: string;
  relationship: string;
  birthday: string; // YYYY-MM-DD
  event_type: string;
  emoji: string;
  remind_days: number;
}

export interface ParsedPerson {
  name: string;
  date: string;
  relationship: string;
  notes: string;
  language: string;
  category: 'birthday' | 'milestone' | 'anniversary' | 'hard_date';
  emoji: string;
  recurring: boolean;
  title: string;
}

export interface CreatePersonBody {
  name: string;
  relationship?: string;
  notes?: string;
  phone?: string;
  language?: string;
}

export interface UpdatePersonBody {
  name?: string;
  relationship?: string;
  notes?: string;
  phone?: string;
}

export interface CreateEventBody {
  person_id: string;
  event_date: string;
  type?: string;
  title?: string;
  emoji?: string;
  recurring?: boolean;
}
