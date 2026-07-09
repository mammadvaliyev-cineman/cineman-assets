'use client'

import { useState, ReactNode } from 'react'
import { useAuth, GOOGLE_AUTH_ENABLED } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────
// ADMIN GATE — wraps /admin and /engine. Only allowlisted emails
// get through. Client-side check is for UX only; every write API
// re-verifies the session token on the server.
// ─────────────────────────────────────────────────────────────

const ADMIN_EMAILS = ['mammadvaliyev@gmail.com']

export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}

export async function adminHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export default function AdminGate({ children }: { children: ReactNode }) {
  const { user, loading, signInGoogle, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState('')

  const sendLink = async () => {
    setErr('')
    if (!isAdminEmail(email)) { setErr('This email has no admin access'); return }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
    })
    if (error) setErr(error.message)
    else setSent(true)
  }

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center" style={{ color: 'var(--fg-muted)' }}>Checking access…</div>
  }

  if (user && isAdminEmail(user.email)) return <>{children}</>

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="card p-10 max-w-md w-full text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/cineman-mascot.png" alt="" width={80} height={80} className="mx-auto mb-4 object-contain" />
        <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Admin access</h1>

        {user ? (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
              Signed in as {user.email} — this account has no admin rights.
            </p>
            <button onClick={signOut} className="px-5 py-2.5 rounded-xl text-sm" style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>
              Sign out
            </button>
          </>
        ) : sent ? (
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Magic link sent to <strong style={{ color: '#9765E0' }}>{email}</strong>. Open it from this device.
          </p>
        ) : (
          <>
            <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
              Sign in with the owner account to continue.
            </p>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendLink()}
                placeholder="admin email"
                className="input-field flex-1"
              />
              <button
                onClick={sendLink}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#9765E0,#534FA5)' }}
              >
                Send link
              </button>
            </div>
            {GOOGLE_AUTH_ENABLED && (
              <button onClick={signInGoogle} className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
                or continue with Google
              </button>
            )}
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>
              A sign-in link will arrive by email — open it on this device.
            </p>
            {err && <p className="text-xs mt-3" style={{ color: '#ff5f5f' }}>{err}</p>}
          </>
        )}
      </div>
    </div>
  )
}
