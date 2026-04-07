'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface FormData {
  name: string
  birthday: string
  relationship: string
  notes: string
}

export default function AddBirthday() {
  const router = useRouter()
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<FormData>({
    name: '',
    birthday: '',
    relationship: '',
    notes: '',
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  function startListening() {
    setError('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

    if (!SR) {
      setError('Speech recognition is not supported on this browser.')
      return
    }

    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = async (event: any) => {
      const text = event.results[0][0].transcript
      setTranscript(text)
      setListening(false)
      await parseTranscript(text)
    }

    recognition.onerror = () => {
      setListening(false)
      setError('Could not hear you. Please try again.')
    }

    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  function stopListening() {
    recognitionRef.current?.stop()
    setListening(false)
  }

  async function parseTranscript(text: string) {
    setParsing(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/voice/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Parse failed')
      setForm((f) => ({
        ...f,
        name: data.name || f.name,
        birthday: data.birthday || f.birthday,
      }))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setParsing(false)
    }
  }

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!form.name || !form.birthday) {
      setError('Name and birthday are required.')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/birthdays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      router.push('/')
    } catch (e) {
      setError((e as Error).message)
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-rose-50">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white px-5 pt-14 pb-5 shadow-sm">
        <Link href="/" className="text-rose-500">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Add Birthday</h1>
      </div>

      <div className="px-4 py-8 pb-16">
        {/* Mic section */}
        <div className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-5 text-sm font-medium text-gray-500">
            Tap the mic and say something like&nbsp;
            <span className="italic text-gray-700">&ldquo;Marco&apos;s birthday is September 6th&rdquo;</span>
          </p>

          <button
            onPointerDown={listening ? stopListening : startListening}
            disabled={parsing}
            className={[
              'flex h-20 w-20 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95',
              listening ? 'bg-rose-600 ring-4 ring-rose-300 ring-offset-2 animate-pulse' : 'bg-rose-500',
              parsing ? 'opacity-50' : '',
            ].join(' ')}
            aria-label={listening ? 'Stop listening' : 'Start listening'}
          >
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
              <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.08A7 7 0 0019 11z" />
            </svg>
          </button>

          {listening && (
            <p className="mt-4 text-sm font-medium text-rose-500">Listening…</p>
          )}
          {parsing && (
            <p className="mt-4 text-sm font-medium text-gray-400">Parsing…</p>
          )}
          {transcript && !listening && !parsing && (
            <p className="mt-4 text-center text-sm text-gray-500 italic">&ldquo;{transcript}&rdquo;</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Marco"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-rose-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Birthday *
              </label>
              <input
                type="date"
                value={form.birthday}
                onChange={(e) => setForm((f) => ({ ...f, birthday: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-rose-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Relationship
              </label>
              <input
                type="text"
                value={form.relationship}
                onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
                placeholder="e.g. Best friend, Brother, Colleague"
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-rose-400 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Things you love about them, inside jokes, etc."
                rows={3}
                className="mt-1 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-rose-400 focus:bg-white resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || parsing}
            className="flex h-14 w-full items-center justify-center rounded-full bg-rose-500 text-base font-semibold text-white shadow-md disabled:opacity-50 active:bg-rose-600"
          >
            {saving ? 'Saving…' : 'Save Birthday'}
          </button>
        </form>
      </div>
    </div>
  )
}
