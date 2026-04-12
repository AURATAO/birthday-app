'use client'

import { useState, useRef, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

interface EventDetail {
  id: string
  name: string
  relationship: string
  birthday: string
  days_until?: number
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
  })
}

type CardState = 'idle' | 'listening' | 'generating' | 'done'

export default function CardPage() {
  const { id } = useParams<{ id: string }>()

  const [event, setEvent] = useState<EventDetail | null>(null)
  const [cardState, setCardState] = useState<CardState>('idle')
  const [liveText, setLiveText] = useState('')
  const [transcript, setTranscript] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    apiFetch(`/api/events/${id}`)
      .then((r) => r.json())
      .then((data) => setEvent(data))
      .catch(() => setError('Could not load birthday details.'))
  }, [id])

  function handleMicTap() {
    if (cardState === 'idle' || cardState === 'done') startListening()
    else if (cardState === 'listening') stopListening()
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
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript
        else interim += event.results[i][0].transcript
      }
      if (interim) setLiveText(interim)
      if (final) {
        setLiveText('')
        setTranscript(final)
        setCardState('generating')
        await generateCard(final)
      }
    }
    recognition.onerror = () => {
      setLiveText('')
      setCardState('idle')
      setError('Could not hear you. Tap to try again.')
    }
    recognition.onend = () => {
      setLiveText('')
      setCardState((s: CardState) => (s === 'listening' ? 'idle' : s))
    }

    recognitionRef.current = recognition
    recognition.start()
    setCardState('listening')
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setLiveText('')
    setCardState('idle')
  }

  async function generateCard(voiceTranscript: string) {
    setMessage('')
    try {
      const res = await apiFetch('/api/card/generate', {
        method: 'POST',
        body: JSON.stringify({ birthday_id: id, voice_transcript: voiceTranscript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setMessage(data.message)
      setCardState('done')
    } catch (e) {
      setError((e as Error).message)
      setCardState('idle')
    }
  }

  function sendViaWhatsApp() {
    window.open(`whatsapp://send?text=${encodeURIComponent(message)}`)
  }
  function sendViaIMessage() {
    window.open(`sms:&body=${encodeURIComponent(message)}`)
  }
  function sendViaEmail() {
    window.open(`mailto:?subject=Happy Birthday!&body=${encodeURIComponent(message)}`)
  }

  const isListening = cardState === 'listening'
  const isGenerating = cardState === 'generating'
  const isDone = cardState === 'done'

  const daysUntil = event?.days_until
  const dayLabel =
    daysUntil === 0 ? "It's today!" : daysUntil === 1 ? 'Tomorrow' : daysUntil != null ? `in ${daysUntil} days` : null

  return (
    <div className="relative flex min-h-screen flex-col bg-[#0A0A0F] text-[#E8E8F0]">

      {/* ── Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 pt-14 pb-6">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#13131F] text-[#6B6B80] active:bg-[#1C1C2E]"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          {event ? (
            <>
              <h1 className="truncate text-xl font-semibold text-[#E8E8F0]">{event.name}</h1>
              <p className="text-sm text-[#7C3AED]">
                {dayLabel ?? formatDate(event.birthday)}
                {!dayLabel && event.relationship ? ` · ${event.relationship}` : ''}
              </p>
            </>
          ) : (
            <div className="space-y-1.5">
              <div className="h-5 w-32 animate-pulse rounded-lg bg-[#1C1C2E]" />
              <div className="h-3.5 w-24 animate-pulse rounded-lg bg-[#13131F]" />
            </div>
          )}
        </div>
      </div>

      {/* ── Mic section ────────────────────────────────── */}
      <div className="flex flex-col items-center px-5 pt-4 pb-8">
        <p className="mb-8 text-center text-sm text-[#6B6B80]">
          {isDone ? 'Tap to record again' : 'Say anything you want to tell them…'}
        </p>

        <div className="relative flex items-center justify-center" style={{ width: 160, height: 160 }}>
          {isListening && (
            <>
              <div
                className="absolute rounded-full bg-[rgba(124,58,237,0.2)]"
                style={{ width: 160, height: 160, animation: 'shazam-ripple 2s ease-out infinite' }}
              />
              <div
                className="absolute rounded-full bg-[rgba(124,58,237,0.12)]"
                style={{ width: 160, height: 160, animation: 'shazam-ripple 2s ease-out 0.7s infinite' }}
              />
            </>
          )}

          <button
            onPointerDown={handleMicTap}
            disabled={isGenerating}
            className={[
              'relative z-10 flex h-[130px] w-[130px] items-center justify-center rounded-full transition-all duration-300 active:scale-95',
              isListening
                ? 'bg-[#7C3AED] shadow-[0_0_70px_rgba(124,58,237,0.55)]'
                : isGenerating
                ? 'bg-[#1C1C2E] shadow-none'
                : isDone
                ? 'bg-[rgba(124,58,237,0.5)] shadow-[0_0_40px_rgba(124,58,237,0.25)]'
                : 'bg-[#7C3AED] shadow-[0_0_50px_rgba(124,58,237,0.35)]',
            ].join(' ')}
            aria-label={isListening ? 'Stop recording' : 'Start recording'}
          >
            {isGenerating ? (
              <svg className="h-10 w-10 animate-spin text-white/40" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-12 w-12 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
                <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.08A7 7 0 0019 11z" />
              </svg>
            )}
          </button>
        </div>

        <div className="mt-5 h-6 text-center">
          {isListening && (
            <p className={liveText ? 'text-sm text-[#E8E8F0]' : 'animate-pulse text-sm text-[#7C3AED]'}>
              {liveText || 'listening…'}
            </p>
          )}
          {isGenerating && (
            <p className="text-sm text-[#6B6B80]">writing your message…</p>
          )}
          {!isListening && !isGenerating && transcript && (
            <p className="text-sm italic text-[#3D3D50]">&ldquo;{transcript}&rdquo;</p>
          )}
        </div>
      </div>

      {/* ── Error ──────────────────────────────────────── */}
      {error && (
        <div className="mx-5 rounded-2xl bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* ── Generated message ──────────────────────────── */}
      {message && (
        <div className="mx-5 mt-2 space-y-3 pb-10">
          <div className="rounded-2xl bg-[#13131F] border border-[#1C1C2E] px-5 py-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#3D3D50]">Your message</p>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full resize-none bg-transparent text-base leading-relaxed text-[#E8E8F0] outline-none placeholder-[#3D3D50]"
            />
            <p className="mt-2 text-xs text-[#3D3D50]">Edit before sending</p>
          </div>

          <button
            onClick={sendViaWhatsApp}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#25D366] bg-[rgba(37,211,102,0.1)] text-base font-semibold text-[#25D366] active:opacity-80"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Send via WhatsApp
          </button>

          <button
            onClick={sendViaIMessage}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#1C7AEF] bg-[rgba(28,122,239,0.1)] text-base font-semibold text-[#1C7AEF] active:opacity-80"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.908 1.405 5.51 3.6 7.24L4.5 22l3.558-1.738A10.786 10.786 0 0012 20.485c5.523 0 10-4.144 10-9.242S17.523 2 12 2z" />
            </svg>
            Send via iMessage
          </button>

          <button
            onClick={sendViaEmail}
            className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl border border-[#4A4A5A] bg-[#13131F] text-base font-semibold text-[#6B6B80] active:opacity-80"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
            </svg>
            Send via Email
          </button>
        </div>
      )}
    </div>
  )
}
