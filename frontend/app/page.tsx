'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { apiFetch } from '@/lib/api'

type AppState = 'idle' | 'listening' | 'processing' | 'result' | 'saving' | 'saved'

interface ParsedEvent {
  name: string
  birthday: string
  relationship: string
  notes: string
  language: string
}

interface Birthday {
  id: string
  name: string
  birthday: string
  relationship: string
  days_until: number
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
}

function DaysUntilBadge({ days }: { days: number }) {
  if (days === 0)
    return <span className="text-xs font-semibold text-[#7C3AED]">Today 🎂</span>
  if (days === 1)
    return <span className="text-xs font-semibold text-[#7C3AED]">Tomorrow</span>
  if (days <= 7)
    return <span className="text-xs font-semibold text-[#7C3AED]">{days}d</span>
  return <span className="text-xs text-[#3D3D50]">{days}d</span>
}

const supabase = createClient()

export default function Dashboard() {
  const router = useRouter()

  const [appState, setAppState] = useState<AppState>('idle')
  const [parsed, setParsed] = useState<ParsedEvent | null>(null)
  const [birthdays, setBirthdays] = useState<Birthday[]>([])
  const [error, setError] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [speechLang, setSpeechLang] = useState('en-US')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const hour = new Date().getHours()
  const timeGreeting = hour < 12 ? 'good morning' : hour < 17 ? 'good afternoon' : 'good evening'

  useEffect(() => {
    const saved = localStorage.getItem('speech-lang')
    setSpeechLang(saved || navigator.language || 'en-US')
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserEmail(user.email ?? user.user_metadata?.name ?? '')
    })
    apiFetch('/api/events/upcoming')
      .then((r) => r.json())
      .then((data) => setBirthdays(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const firstName = userEmail.split('@')[0].split('.')[0]
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : ''

  function handleButtonTap() {
    if (appState === 'idle') startListening()
    else if (appState === 'listening') stopListening()
  }

  function setLang(lang: string) {
    setSpeechLang(lang)
    localStorage.setItem('speech-lang', lang)
  }

  function startListening() {
    setError('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition not supported on this browser.')
      return
    }
    const recognition = new SR()
    recognition.lang = speechLang
    recognition.continuous = false
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript
      setAppState('processing')
      await parseTranscript(text)
    }
    recognition.onerror = () => {
      setAppState('idle')
      setError('Could not hear you. Tap to try again.')
    }
    recognition.onend = () => {
      setAppState((s) => (s === 'listening' ? 'idle' : s))
    }

    recognitionRef.current = recognition
    recognition.start()
    setAppState('listening')
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setAppState('idle')
  }

  async function parseTranscript(text: string) {
    try {
      const res = await apiFetch('/api/voice/parse', {
        method: 'POST',
        body: JSON.stringify({ transcript: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      setParsed({
        name: data.name ?? '',
        birthday: data.birthday ?? '',
        relationship: data.relationship ?? '',
        notes: data.notes ?? '',
        language: data.language ?? '',
      })
      setAppState('result')
    } catch (e) {
      setError((e as Error).message)
      setAppState('idle')
    }
  }

  async function confirmSave() {
    if (!parsed) return
    setAppState('saving')
    try {
      const personRes = await apiFetch('/api/people', {
        method: 'POST',
        body: JSON.stringify({ name: parsed.name, relationship: parsed.relationship, notes: parsed.notes, language: parsed.language }),
      })
      const personData = await personRes.json()
      if (!personRes.ok) throw new Error(personData.error || 'Failed to save person')

      const eventRes = await apiFetch('/api/events', {
        method: 'POST',
        body: JSON.stringify({ person_id: personData.id, type: 'birthday', event_date: parsed.birthday }),
      })
      const eventData = await eventRes.json()
      if (!eventRes.ok) throw new Error(eventData.error || 'Failed to save event')

      const list = await apiFetch('/api/events/upcoming').then((r) => r.json())
      setBirthdays(Array.isArray(list) ? list : [])
      setParsed(null)
      setAppState('saved')
      setTimeout(() => setAppState('idle'), 2000)
    } catch (e) {
      setError((e as Error).message)
      setAppState('result')
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function discard() {
    setParsed(null)
    setError('')
    setAppState('idle')
  }

  const isListening = appState === 'listening'
  const isBusy = appState === 'processing' || appState === 'saving'
  const isResult = appState === 'result'
  const isSaved = appState === 'saved'

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-[#0A0A0F] text-[#E8E8F0]">

      {/* ── Top bar ───────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-14 pb-2">
        <div className="min-w-0">
          <p className="text-sm text-[#6B6B80]">{timeGreeting}{displayName ? `, ${displayName}` : ''}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-[#E8E8F0]" style={{ letterSpacing: '-0.03em' }}>
            samantha
          </h1>
        </div>
        <button
          onPointerDown={signOut}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1C1C2E] text-xs font-semibold text-[#6B6B80] active:text-[#E8E8F0]"
        >
          {displayName ? displayName[0].toUpperCase() : '?'}
        </button>
      </div>

      {/* ── Center stage ──────────────────────────────── */}
      <div className="flex flex-1 flex-col items-center justify-center pb-52">

        {/* Big button with ripple rings */}
        <div className="relative flex items-center justify-center" style={{ width: 240, height: 240 }}>

          {/* Ripple rings — only when listening */}
          {isListening && (
            <>
              <div
                className="absolute rounded-full bg-[rgba(124,58,237,0.18)]"
                style={{ width: 240, height: 240, animation: 'shazam-ripple 2s ease-out infinite' }}
              />
              <div
                className="absolute rounded-full bg-[rgba(124,58,237,0.12)]"
                style={{ width: 240, height: 240, animation: 'shazam-ripple 2s ease-out 0.6s infinite' }}
              />
              <div
                className="absolute rounded-full bg-[rgba(124,58,237,0.07)]"
                style={{ width: 240, height: 240, animation: 'shazam-ripple 2s ease-out 1.2s infinite' }}
              />
            </>
          )}

          {/* Idle glow halo */}
          {appState === 'idle' && (
            <div
              className="absolute rounded-full"
              style={{
                width: 200,
                height: 200,
                background: 'radial-gradient(circle, rgba(124,58,237,0.13) 0%, transparent 70%)',
                animation: 'idle-breathe 3s ease-in-out infinite',
              }}
            />
          )}

          {/* The button */}
          <button
            onPointerDown={handleButtonTap}
            disabled={isBusy}
            className={[
              'relative z-10 flex h-[190px] w-[190px] items-center justify-center rounded-full transition-all duration-500 active:scale-95',
              appState === 'idle'
                ? 'bg-[#7C3AED] shadow-[0_0_70px_rgba(124,58,237,0.4)]'
                : '',
              isListening
                ? 'bg-[#9B5EF5] shadow-[0_0_90px_rgba(124,58,237,0.6)]'
                : '',
              isBusy
                ? 'bg-[#1C1C2E] shadow-none'
                : '',
              isResult
                ? 'bg-[#1D9E75] shadow-[0_0_70px_rgba(29,158,117,0.4)]'
                : '',
              isSaved
                ? 'bg-[#1D9E75] shadow-[0_0_90px_rgba(29,158,117,0.5)]'
                : '',
            ].join(' ')}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
          >
            {isBusy && (
              <svg className="h-12 w-12 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {(appState === 'idle' || isListening) && (
              <svg className="h-16 w-16 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
                <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.08A7 7 0 0019 11z" />
              </svg>
            )}
            {(isResult || isSaved) && (
              <svg className="h-14 w-14 text-white drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        </div>

        {/* ── Status text ─────────────────────────────── */}
        <div className="mt-8 flex flex-col items-center px-6 text-center">
          {appState === 'idle' && (
            <p className="text-sm text-[#6B6B80]">tap to add a birthday</p>
          )}
          {isListening && (
            <p className="animate-pulse text-sm font-medium text-[#7C3AED]">listening…</p>
          )}
          {appState === 'processing' && (
            <p className="text-sm text-[#6B6B80]">thinking…</p>
          )}
          {appState === 'saving' && (
            <p className="text-sm text-[#6B6B80]">saving…</p>
          )}
          {isSaved && (
            <p className="text-sm font-semibold text-[#1D9E75]">Saved!</p>
          )}
          {error && (
            <p className="mt-3 text-sm text-red-400">{error}</p>
          )}
        </div>

        {/* ── Language toggle ───────────────────────────── */}
        {!isBusy && !isResult && (
          <div className="mt-6 flex gap-1 rounded-full bg-[#13131F] p-1">
            <button
              onPointerDown={() => setLang('en-US')}
              className={[
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                speechLang === 'en-US'
                  ? 'bg-[#1C1C2E] text-[#E8E8F0]'
                  : 'text-[#3D3D50] active:text-[#6B6B80]',
              ].join(' ')}
            >
              🇺🇸 EN
            </button>
            <button
              onPointerDown={() => setLang('zh-TW')}
              className={[
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                speechLang === 'zh-TW'
                  ? 'bg-[#1C1C2E] text-[#E8E8F0]'
                  : 'text-[#3D3D50] active:text-[#6B6B80]',
              ].join(' ')}
            >
              🇹🇼 中文
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom sheet ───────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0">
        <div className="rounded-t-3xl bg-[#13131F] pb-10 pt-3 shadow-[0_-1px_0_rgba(255,255,255,0.04)]">
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[#1C1C2E]" />
          <div className="px-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#3D3D50]">
              Upcoming
            </p>
            <div className="max-h-44 space-y-1 overflow-y-auto">
              {birthdays.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#3D3D50]">No birthdays yet</p>
              ) : (
                birthdays.slice(0, 6).map((b) => (
                  <Link
                    key={b.id}
                    href={`/card/${b.id}`}
                    className="flex items-center justify-between rounded-2xl px-4 py-3 transition-colors active:bg-[#1C1C2E]"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-[#E8E8F0]">{b.name}</p>
                      <p className="text-xs text-[#6B6B80]">
                        {formatDate(b.birthday)}
                        {b.relationship ? ` · ${b.relationship}` : ''}
                      </p>
                    </div>
                    <DaysUntilBadge days={b.days_until} />
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Review modal ──────────────────────────────── */}
      {isResult && parsed && (
        <div className="absolute inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/60" onPointerDown={discard} />
          <div className="relative rounded-t-3xl bg-[#13131F] px-5 pb-10 pt-4 text-[#E8E8F0]">
            <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-[#1C1C2E]" />
            <div className="mb-4 flex items-center justify-between">
              <p className="text-base font-semibold text-[#E8E8F0]">Confirm details</p>
              <button onClick={discard} className="text-sm text-[#6B6B80] active:text-[#E8E8F0]">Cancel</button>
            </div>
            <div className="space-y-2">
              <input
                className="w-full rounded-xl bg-[#1C1C2E] px-4 py-3 text-base font-medium text-[#E8E8F0] placeholder-[#3D3D50] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                placeholder="Name"
                value={parsed.name}
                onChange={(e) => setParsed({ ...parsed, name: e.target.value })}
              />
              <input
                type="date"
                className="w-full rounded-xl bg-[#1C1C2E] px-4 py-3 text-sm text-[#6B6B80] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                value={parsed.birthday}
                onChange={(e) => setParsed({ ...parsed, birthday: e.target.value })}
              />
              <input
                className="w-full rounded-xl bg-[#1C1C2E] px-4 py-3 text-sm text-[#6B6B80] placeholder-[#3D3D50] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                placeholder="Relationship (e.g. best friend, mum)"
                value={parsed.relationship}
                onChange={(e) => setParsed({ ...parsed, relationship: e.target.value })}
              />
              <textarea
                className="w-full rounded-xl bg-[#1C1C2E] px-4 py-3 text-sm text-[#6B6B80] placeholder-[#3D3D50] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                placeholder="Notes (e.g. loves hiking, into coffee)"
                rows={2}
                value={parsed.notes}
                onChange={(e) => setParsed({ ...parsed, notes: e.target.value })}
              />
            </div>
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
            <button
              onClick={confirmSave}
              disabled={!parsed.name || !parsed.birthday}
              className="mt-4 w-full rounded-full bg-[#7C3AED] py-4 text-base font-semibold text-white shadow-lg shadow-purple-900/30 disabled:opacity-40 active:bg-[#9B5EF5]"
            >
              Save birthday
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
