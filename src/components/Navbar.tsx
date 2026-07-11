'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { useAuth } from '@/components/AuthProvider'
import { isAdminEmail } from '@/components/AdminGate'
import { supabase } from '@/lib/supabase'

// ── Cineman Logo Icon ─────────────────────────────────────────
function CinemanLogoIcon({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="cl-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#CE95FB" />
          <stop offset="100%" stopColor="#36009C" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="9" ry="9" fill="url(#cl-grad)" />
      {Array.from({ length: 16 }, (_, i) => (
        <rect key={`o${i}`} x="19" y="6.5" width="2" height="3" rx="0.6"
          fill="white" fillOpacity="0.92"
          transform={`rotate(${i * 22.5}, 20, 20)`} />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={`m${i}`} x="19.1" y="11.2" width="1.8" height="2.4" rx="0.4"
          fill="white" fillOpacity="0.72"
          transform={`rotate(${i * 30}, 20, 20)`} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <rect key={`i${i}`} x="19.3" y="14.8" width="1.4" height="1.8" rx="0.35"
          fill="white" fillOpacity="0.52"
          transform={`rotate(${i * 45}, 20, 20)`} />
      ))}
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

// ── Navbar ───────────────────────────────────────────────────
export default function Navbar() {
  useTheme() // keeps dark theme applied; light mode disabled for now
  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)

  // ⚡ credit balance — own profile via RLS; refreshed after downloads
  const [credits, setCredits] = useState<number | null>(null)
  const [pulse, setPulse] = useState(false)
  const creditsRef = useRef<number | null>(null)
  creditsRef.current = credits
  // Spend feedback: tween the number down (~420ms) + pulse the chip,
  // so the user SEES credits leaving (master handoff §3)
  const tweenTo = (target: number) => {
    const from = creditsRef.current
    if (from === null || from === target) { setCredits(target); return }
    setPulse(true)
    setTimeout(() => setPulse(false), 500)
    const start = performance.now(), dur = 420
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      setCredits(Math.round(from + (target - from) * eased))
      if (k < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
    // rAF freezes in background tabs — guarantee the final value lands
    setTimeout(() => setCredits(target), dur + 120)
  }
  useEffect(() => {
    if (!user) { setCredits(null); return }
    const load = async () => {
      const { data } = await supabase.from('profiles').select('credits').eq('id', user.id).single()
      if (data) setCredits(data.credits)
    }
    load()
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (typeof d === 'number') tweenTo(d); else load()
    }
    window.addEventListener('cineman-credits-changed', onChange)
    return () => window.removeEventListener('cineman-credits-changed', onChange)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{
        backgroundColor: 'var(--nav-bg)',
        borderColor: 'var(--border)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 select-none">
          <CinemanLogoIcon size={36} />
          <span className="font-bold text-lg tracking-tight" style={{ color: 'var(--fg)' }}>
            CINEMAN{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #9765E0, #00C2BA)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              AI
            </span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { href: '/studio', label: 'Cineman Studio' },
            { href: '/catalog', label: 'AI Assets' },
            { href: '/pricing', label: 'Pricing' },
            ...(isAdmin ? [
              { href: '/engine', label: 'Engine' },
              { href: '/admin', label: 'Admin' },
            ] : []),
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm font-medium transition-colors duration-150"
              style={{ color: 'var(--fg-muted)' }}
              onMouseEnter={e => ((e.target as HTMLElement).style.color = '#9765E0')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--fg-muted)')}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {user && (
            <Link href="/favorites" title="My favorites & collections" className="text-sm font-medium" style={{ color: 'var(--fg-muted)' }}>
              ♥
            </Link>
          )}
          {user && credits !== null && (
            <Link
              href="/pricing"
              title="Ваши кредиты — клик, чтобы пополнить"
              className="flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-full"
              style={{
                backgroundColor: 'rgba(151,101,224,0.14)', color: '#CE95FB', border: '1px solid rgba(151,101,224,0.35)',
                animation: pulse ? 'cine-chip-pulse .45s ease-out' : undefined,
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#CE95FB" stroke="none"><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z" /></svg>
              {credits}
            </Link>
          )}
          {user ? (
            <Link href="/account" title="My account" className="flex items-center">
              {(user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={user.user_metadata.avatar_url || user.user_metadata.picture}
                  alt=""
                  className="rounded-full transition-transform hover:scale-105"
                  style={{ width: 34, height: 34, border: '2px solid rgba(151,101,224,0.6)' }}
                />
              ) : (
                <span
                  className="rounded-full flex items-center justify-center text-sm font-bold text-white"
                  style={{ width: 34, height: 34, background: 'linear-gradient(135deg,#9765E0,#534FA5)' }}
                >
                  {String(user.email || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </Link>
          ) : (
            <Link
              href="/account"
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ color: 'var(--fg-muted)', border: '1px solid var(--border)' }}
            >
              Sign in
            </Link>
          )}
          <Link href="/pricing" className="btn-primary text-sm px-4 py-2">
            Get Started
          </Link>

          <button
            className="md:hidden p-2 rounded-lg"
            style={{ color: 'var(--fg-muted)' }}
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>
        </div>
      </div>
    </nav>
  )
}
