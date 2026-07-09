'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// AUTH — Supabase Auth with Google OAuth. The Google provider is
// enabled in the Supabase Dashboard (Auth → Providers → Google).
// ─────────────────────────────────────────────────────────────

// Flip to true once the Google provider is enabled in Supabase
// (Dashboard → Authentication → Providers → Google)
export const GOOGLE_AUTH_ENABLED = false

type AuthCtxType = {
  user: User | null
  loading: boolean
  signInGoogle: () => void
  signInEmail: (email: string) => Promise<string | null>
  signOut: () => void
}

const AuthCtx = createContext<AuthCtxType>({
  user: null,
  loading: true,
  signInGoogle: () => {},
  signInEmail: async () => null,
  signOut: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signInGoogle = () => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/account` : undefined,
      },
    })
  }

  // Magic link — works out of the box, no provider setup needed
  const signInEmail = async (email: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: typeof window !== 'undefined' ? window.location.href : undefined },
    })
    return error ? error.message : null
  }

  const signOut = () => { supabase.auth.signOut() }

  return (
    <AuthCtx.Provider value={{ user, loading, signInGoogle, signInEmail, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
