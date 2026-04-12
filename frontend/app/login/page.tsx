'use client'

export const dynamic = 'force-dynamic'

import { Suspense, useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useSearchParams } from 'next/navigation'

function LoginContent() {
  const [email, setEmail] = useState('')
  const [magicLinkSent, setMagicLinkSent] = useState(false)
  const [loading, setLoading] = useState<'google' | 'magic' | null>(null)
  const [error, setError] = useState('')
  const searchParams = useSearchParams()
  const callbackError = searchParams.get('error')

  const supabase = createClient()

  async function signInWithGoogle() {
    setError('')
    setLoading('google')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(null)
    }
  }

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setError('')
    setLoading('magic')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    setLoading(null)
    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-between bg-[#0A0A0F] px-6 py-20">

      {/* Hero */}
      <div className="flex flex-1 flex-col items-center justify-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[#7C3AED] bg-[rgba(124,58,237,0.12)] text-2xl text-[#7C3AED]">
          ✦
        </div>
        <div>
          <h1 className="text-4xl font-semibold tracking-tight text-[#E8E8F0]" style={{ letterSpacing: '-0.04em' }}>
            samantha
          </h1>
          <p className="mt-2 text-sm text-[#6B6B80]">your personal relationship assistant</p>
        </div>
      </div>

      {/* Auth card */}
      <div className="w-full max-w-sm space-y-3">

        {callbackError && (
          <div className="rounded-xl bg-red-500/10 px-4 py-3">
            <p className="text-sm text-red-400">Sign in failed. Please try again.</p>
          </div>
        )}

        {magicLinkSent ? (
          <div className="flex flex-col items-center rounded-3xl bg-[#13131F] px-6 py-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(29,158,117,0.15)]">
              <svg className="h-6 w-6 text-[#1D9E75]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-[#E8E8F0]">Check your email</h2>
            <p className="mt-2 text-sm text-[#6B6B80]">
              We sent a link to<br />
              <span className="font-medium text-[#E8E8F0]">{email}</span>
            </p>
            <button
              onClick={() => { setMagicLinkSent(false); setEmail('') }}
              className="mt-5 text-sm text-[#6B6B80] hover:text-[#E8E8F0]"
            >
              Use a different email
            </button>
          </div>
        ) : (
          <>
            {/* Google */}
            <button
              onClick={signInWithGoogle}
              disabled={loading !== null}
              className="flex h-13 w-full items-center justify-center gap-3 rounded-2xl bg-[#E8E8F0] py-3.5 text-sm font-semibold text-[#0A0A0F] shadow-sm transition-opacity active:opacity-80 disabled:opacity-50"
            >
              {loading === 'google' ? (
                <svg className="h-5 w-5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-[#1C1C2E]" />
              <span className="text-xs text-[#3D3D50]">or</span>
              <div className="h-px flex-1 bg-[#1C1C2E]" />
            </div>

            {/* Magic link */}
            <form onSubmit={sendMagicLink} className="space-y-2">
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-2xl bg-[#13131F] px-4 py-3.5 text-sm text-[#E8E8F0] placeholder-[#3D3D50] outline-none focus:ring-1 focus:ring-[#7C3AED]"
              />
              <button
                type="submit"
                disabled={loading !== null || !email.trim()}
                className="flex h-12 w-full items-center justify-center rounded-2xl bg-[#7C3AED] text-sm font-semibold text-white transition-opacity active:opacity-80 disabled:opacity-40"
              >
                {loading === 'magic' ? (
                  <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  'Send magic link'
                )}
              </button>
            </form>

            {error && (
              <p className="text-center text-sm text-red-400">{error}</p>
            )}
          </>
        )}

        <p className="text-center text-xs text-[#3D3D50]">
          By continuing you agree to our Terms &amp; Privacy Policy
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
