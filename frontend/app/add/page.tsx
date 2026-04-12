'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'

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
  const [speechLang, setSpeechLang] = useState('en-US')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    const saved = localStorage.getItem('speech-lang')
    setSpeechLang(saved || navigator.language || 'en-US')
  }, [])

  function setLang(lang: string) {
    setSpeechLang(lang)
    localStorage.setItem('speech-lang', lang)
  }

  function startListening() {
    setError('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition is not supported on this browser.')
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
      const res = await apiFetch('/api/voice/parse', {
        method: 'POST',
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
      const res = await apiFetch('/api/birthdays', {
        method: 'POST',
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
    <div className="min-h-screen bg-[#0A0A0F] text-[#E8E8F0]">
      {/* Header */}
      <div className="flex items-center gap-4 px-5 pt-14 pb-6">
        <Link
          href="/"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#13131F] text-[#6B6B80] active:bg-[#1C1C2E]"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-xl font-semibold text-[#E8E8F0]">Add Birthday</h1>
      </div>

      <div className="px-5 pb-16 space-y-4">
        {/* Mic section */}
        <div className="flex flex-col items-center rounded-2xl bg-[#13131F] border border-[#1C1C2E] p-6">
          <p className="mb-5 text-center text-sm text-[#6B6B80]">
            Tap the mic and say something like&nbsp;
            <span className="italic text-[#E8E8F0]">&ldquo;Marco&apos;s birthday is September 6th&rdquo;</span>
          </p>

          <button
            onPointerDown={listening ? stopListening : startListening}
            disabled={parsing}
            className={[
              'flex h-20 w-20 items-center justify-center rounded-full text-white transition-transform active:scale-95',
              listening
                ? 'bg-[#9B5EF5] shadow-[0_0_40px_rgba(124,58,237,0.5)] animate-pulse'
                : 'bg-[#7C3AED] shadow-[0_0_30px_rgba(124,58,237,0.3)]',
              parsing ? 'opacity-50' : '',
            ].join(' ')}
            aria-label={listening ? 'Stop listening' : 'Start listening'}
          >
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
              <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.08A7 7 0 0019 11z" />
            </svg>
          </button>

          {listening && <p className="mt-4 animate-pulse text-sm font-medium text-[#7C3AED]">listening…</p>}
          {parsing && <p className="mt-4 text-sm text-[#6B6B80]">parsing…</p>}
          {transcript && !listening && !parsing && (
            <p className="mt-4 text-center text-sm italic text-[#6B6B80]">&ldquo;{transcript}&rdquo;</p>
          )}

          {/* Language toggle */}
          <div className="mt-5 flex gap-1 rounded-full bg-[#1C1C2E] p-1">
            <button
              type="button"
              onPointerDown={() => setLang('en-US')}
              className={[
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                speechLang === 'en-US'
                  ? 'bg-[#13131F] text-[#E8E8F0]'
                  : 'text-[#3D3D50] active:text-[#6B6B80]',
              ].join(' ')}
            >
              🇺🇸 EN
            </button>
            <button
              type="button"
              onPointerDown={() => setLang('zh-TW')}
              className={[
                'rounded-full px-4 py-1.5 text-xs font-medium transition-colors',
                speechLang === 'zh-TW'
                  ? 'bg-[#13131F] text-[#E8E8F0]'
                  : 'text-[#3D3D50] active:text-[#6B6B80]',
              ].join(' ')}
            >
              🇹🇼 中文
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="rounded-2xl bg-[#13131F] border border-[#1C1C2E] p-4 space-y-4">
            {[
              { label: 'Name *', key: 'name', type: 'text', placeholder: 'e.g. Marco' },
              { label: 'Birthday *', key: 'birthday', type: 'date', placeholder: '' },
              { label: 'Relationship', key: 'relationship', type: 'text', placeholder: 'e.g. Best friend, Brother' },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-semibold uppercase tracking-wide text-[#3D3D50]">
                  {label}
                </label>
                <input
                  type={type}
                  value={form[key as keyof FormData]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="mt-1 w-full rounded-xl bg-[#1C1C2E] px-4 py-3 text-base text-[#E8E8F0] placeholder-[#3D3D50] outline-none focus:ring-1 focus:ring-[#7C3AED]"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-[#3D3D50]">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Things you love about them, inside jokes, etc."
                rows={3}
                className="mt-1 w-full resize-none rounded-xl bg-[#1C1C2E] px-4 py-3 text-base text-[#E8E8F0] placeholder-[#3D3D50] outline-none focus:ring-1 focus:ring-[#7C3AED]"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 px-4 py-3">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || parsing}
            className="flex h-14 w-full items-center justify-center rounded-full bg-[#7C3AED] text-base font-semibold text-white shadow-lg shadow-purple-900/30 disabled:opacity-50 active:bg-[#9B5EF5]"
          >
            {saving ? 'Saving…' : 'Save Birthday'}
          </button>
        </form>
      </div>
    </div>
  )
}
