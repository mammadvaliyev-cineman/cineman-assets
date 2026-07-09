'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// ─────────────────────────────────────────────────────────────
// AUTH — Supabase Auth with Google OAuth. The Google provider is
// enabled in the Supabase Dashboard (Auth → Providers → Google).
// ─────────────────────────────────────────────────────────────

type AuthCtxType = {
  user: User | null
  loading: boolean
  signInGoogle: () => void
  signOut: () => void
}

const AuthCtx = createContext<AuthCtxType>({
  user: null,
  loading: true,
  signInGoogle: () => {},
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

  const signOut = () => { supabase.auth.signOut() }

  return (
    <AuthCtx.Provider value={{ user, loading, signInGoogle, signOut }}>
      {children}
    </AuthCtx.Provider>
  )
}

export const useAuth = () => useContext(AuthCtx)
