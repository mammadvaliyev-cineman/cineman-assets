'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────
// ACCOUNT — личный кабинет: профиль, мои генерации, избранное.
// ─────────────────────────────────────────────────────────────

type Row = {
  id: string
  title: string
  type: string
  category: string
  file_url: string
  thumbnail_url: string | null
  created_at: string
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
    </svg>
  )
}

export default function AccountPage() {
  const { user, loading, signInGoogle, signOut } = useAuth()
  const [generations, setGenerations] = useState<Row[]>([])
  const [favorites, setFavorites] = useState<Row[]>([])

  useEffect(() => {
    if (!user) return
    supabase
      .from('assets')
      .select('id,title,type,category,file_url,thumbnail_url,created_at')
      .eq('type', 'Generation')
      .order('created_at', { ascending: false })
      .limit(24)
      .then(({ data }) => { if (data) setGenerations(data as Row[]) })
    try {
      const favIds: string[] = JSON.parse(localStorage.getItem('cineman_favs') ?? '[]')
      if (favIds.length) {
        supabase
          .from('assets')
          .select('id,title,type,category,file_url,thumbnail_url,created_at')
          .in('id', favIds.slice(0, 50))
          .then(({ data }) => { if (data) setFavorites(data as Row[]) })
      }
    } catch { /* ignore */ }
  }, [user])

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center" style={{ color: 'var(--fg-muted)' }}>Loading…</div>
  }

  // ── Signed out: Google sign-in card ─────────────────────────
  if (!user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="card p-10 max-w-md w-full text-center fade-in-up">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/cineman-mascot.png" alt="" width={90} height={90} className="mx-auto mb-5 object-contain" style={{ filter: 'drop-shadow(0 10px 20px rgba(139,92,246,0.35))' }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Welcome to Cineman</h1>
          <p className="text-sm mb-8" style={{ color: 'var(--fg-muted)' }}>
            Sign in to keep your generations, favorites and downloads in one place.
          </p>
          <button
            onClick={signInGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-semibold text-sm transition-all hover:-translate-y-0.5"
            style={{ backgroundColor: '#fff', color: '#1a1a2e', boxShadow: '0 8px 24px rgba(0,0,0,0.35)' }}
          >
            <GoogleIcon /> Continue with Google
          </button>
          <p className="text-xs mt-4" style={{ color: 'var(--fg-subtle)' }}>
            One click — no passwords.
          </p>
        </div>
      </div>
    )
  }

  // ── Signed in: profile + library ────────────────────────────
  const meta = user.user_metadata || {}
  const avatar = meta.avatar_url || meta.picture
  const name = meta.full_name || meta.name || user.email

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <div className="flex items-center gap-5 mb-10 fade-in-up">
        {avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatar} alt="" className="rounded-full" style={{ width: 72, height: 72, border: '2px solid rgba(151,101,224,0.5)' }} />
        ) : (
          <div className="rounded-full flex items-center justify-center text-2xl font-bold text-white" style={{ width: 72, height: 72, background: 'linear-gradient(135deg,#9765E0,#534FA5)' }}>
            {String(name || '?').charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--fg)' }}>{name}</h1>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{user.email}</p>
        </div>
        <button
          onClick={signOut}
          className="px-4 py-2 rounded-xl text-sm transition-colors"
          style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
        >
          Sign out
        </button>
      </div>

      {/* My Generations */}
      <section className="mb-12 fade-in-up">
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>My Generations</h2>
        {generations.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>No generations yet — direct your first shot in the Studio.</p>
            <Link href="/studio" className="btn-primary text-sm">Open Cineman Studio →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {generations.map(g => (
              <div key={g.id} className="card overflow-hidden">
                {g.file_url.endsWith('.mp4') ? (
                  <video src={g.file_url} controls className="w-full aspect-video object-cover" preload="metadata" />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={g.thumbnail_url || g.file_url} alt={g.title} className="w-full aspect-video object-cover" loading="lazy" />
                )}
                <div className="p-3 flex items-center justify-between">
                  <span className="text-xs" style={{ color: 'var(--fg-muted)' }}>{g.category} · {new Date(g.created_at).toLocaleDateString()}</span>
                  <a href={g.file_url} download className="text-xs font-semibold" style={{ color: '#9765E0' }}>Download</a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Favorites */}
      <section className="fade-in-up">
        <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>Favorites</h2>
        {favorites.length === 0 ? (
          <div className="card p-8 text-center">
            <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>Tap the heart on any asset in the catalog — it will appear here.</p>
            <Link href="/catalog" className="btn-secondary text-sm">Browse AI Assets →</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {favorites.map(f => (
              <div key={f.id} className="card overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.file_url} alt={f.title} className="w-full aspect-video object-cover" loading="lazy" />
                <div className="p-3">
                  <p className="text-xs font-medium truncate" style={{ color: 'var(--fg)' }}>{f.title}</p>
                  <p className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>{f.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
