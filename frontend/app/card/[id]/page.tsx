'use client'

import { useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function CardPage() {
  const { id } = useParams<{ id: string }>()

  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
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
      await generateCard(text)
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

  async function generateCard(voiceTranscript: string) {
    setGenerating(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('http://localhost:8080/api/card/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ birthday_id: id, voice_transcript: voiceTranscript }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setMessage(data.message)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setGenerating(false)
    }
  }

  function sendViaWhatsApp() {
    const encoded = encodeURIComponent(message)
    window.location.href = `whatsapp://send?text=${encoded}`
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
        <h1 className="text-xl font-bold text-gray-900">Create Card</h1>
      </div>

      <div className="px-4 py-8 space-y-4 pb-16">
        {/* Mic section */}
        <div className="flex flex-col items-center rounded-2xl bg-white p-6 shadow-sm">
          <p className="mb-2 text-base font-semibold text-gray-800">
            {message ? 'Record again to regenerate' : 'Speak your feelings'}
          </p>
          <p className="mb-6 text-center text-sm text-gray-400">
            Share what you want to say — Claude will craft the perfect message
          </p>

          <button
            onPointerDown={listening ? stopListening : startListening}
            disabled={generating}
            className={[
              'flex h-24 w-24 items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95',
              listening ? 'bg-rose-600 ring-4 ring-rose-300 ring-offset-2 animate-pulse' : 'bg-rose-500',
              generating ? 'opacity-50' : '',
            ].join(' ')}
            aria-label={listening ? 'Stop recording' : 'Start recording'}
          >
            {generating ? (
              <svg className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-9 w-9" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3z" />
                <path d="M19 11a1 1 0 10-2 0 5 5 0 01-10 0 1 1 0 10-2 0 7 7 0 006 6.92V20H9a1 1 0 100 2h6a1 1 0 100-2h-2v-2.08A7 7 0 0019 11z" />
              </svg>
            )}
          </button>

          {listening && <p className="mt-4 text-sm font-medium text-rose-500">Listening…</p>}
          {generating && <p className="mt-4 text-sm font-medium text-gray-400">Generating your message…</p>}

          {transcript && !listening && !generating && (
            <p className="mt-4 text-center text-sm italic text-gray-400">&ldquo;{transcript}&rdquo;</p>
          )}
        </div>

        {/* Error */}
        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
        )}

        {/* Generated message */}
        {message && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-white p-4 shadow-sm">
              <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Your Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-900 outline-none focus:border-rose-400 focus:bg-white resize-none leading-relaxed"
              />
              <p className="mt-2 text-xs text-gray-400">Feel free to edit before sending</p>
            </div>

            <button
              onClick={sendViaWhatsApp}
              className="flex h-14 w-full items-center justify-center gap-3 rounded-full bg-green-500 text-base font-semibold text-white shadow-md active:bg-green-600"
            >
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Send via WhatsApp
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
