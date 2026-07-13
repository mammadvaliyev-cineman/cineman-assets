'use client'

import Link from 'next/link'
import { useEffect, useState, useRef } from 'react'
import { useTheme } from '@/components/ThemeProvider'
import { useAuth } from '@/components/AuthProvider'
import { isAdminEmail, isRealAdminEmail, isViewingAsClient, toggleViewAsClient } from '@/components/AdminGate'
import { CreditGem } from '@/components/AssetGrid'
import TopupModal from '@/components/TopupModal'
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
          <stop offset="0%" style={{ stopColor: 'var(--accent-soft)' }} />
          <stop offset="100%" style={{ stopColor: 'var(--accent-deep)' }} />
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
  // profile avatar (profiles.avatar_url) replaces the letter badge
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
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
      const { data } = await supabase.from('profiles').select('credits, topup_credits, avatar_url').eq('id', user.id).single()
      if (data) { setCredits(Number(data.credits ?? 0) + Number(data.topup_credits ?? 0)); setAvatarUrl(data.avatar_url ?? null) }
    }
    load()
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (typeof d === 'number') tweenTo(d); else load()
    }
    const onProfile = (e: Event) => {
      const d = (e as CustomEvent).detail
      if (d && 'avatarUrl' in d) setAvatarUrl(d.avatarUrl ?? null)
    }
    window.addEventListener('cineman-profile-changed', onProfile)
    window.addEventListener('cineman-credits-changed', onChange)
    return () => {
      window.removeEventListener('cineman-credits-changed', onChange)
      window.removeEventListener('cineman-profile-changed', onProfile)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  // GLASS navbar (DEV_flair_motion §1): translucent + blur, and the
  // background gets a touch denser once the page is scrolled
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // TOP-UP modal (DEV_topup_credits) — hosted here so every page can
  // open it: balance chip, «Buy credits», and 402-flows via the event
  const [topupOpen, setTopupOpen] = useState(false)
  useEffect(() => {
    const open = () => setTopupOpen(true)
    window.addEventListener('cineman-open-topup', open)
    return () => window.removeEventListener('cineman-open-topup', open)
  }, [])

  // BRAND THEME toggle (owner's §7 rework): Purple <-> Yellow through the
  // --accent token set; instant, no reload. Admin-only while he compares.
  const [accentTheme, setAccentTheme] = useState<'purple' | 'yellow'>('purple')
  useEffect(() => {
    try {
      if (localStorage.getItem('cineman_theme') === 'yellow') {
        setAccentTheme('yellow')
        document.documentElement.setAttribute('data-theme', 'yellow')
      }
    } catch { /* noop */ }
  }, [])
  const toggleAccentTheme = () => {
    setAccentTheme(t => {
      const next = t === 'purple' ? 'yellow' : 'purple'
      try { localStorage.setItem('cineman_theme', next) } catch { /* noop */ }
      if (next === 'yellow') document.documentElement.setAttribute('data-theme', 'yellow')
      else document.documentElement.removeAttribute('data-theme')
      return next
    })
  }

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{
        backgroundColor: scrolled ? 'rgba(10, 10, 15, 0.86)' : 'rgba(10, 10, 15, 0.55)',
        borderColor: scrolled ? 'rgba(255,255,255,0.09)' : 'var(--border)',
        transition: 'background-color .25s ease, border-color .25s ease',
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
                background: 'linear-gradient(135deg, var(--accent), #00C2BA)',
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
              onMouseEnter={e => ((e.target as HTMLElement).style.color = 'var(--accent)')}
              onMouseLeave={e => ((e.target as HTMLElement).style.color = 'var(--fg-muted)')}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3">
          {/* Theme A/B switch (§7 rework): compare Purple vs Yellow accent */}
          {isRealAdminEmail(user?.email) && (
            <button
              onClick={toggleAccentTheme}
              title="Сменить акцент бренда (Purple ↔ Yellow)"
              className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--fg-muted)', cursor: 'pointer' }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: accentTheme === 'purple' ? '#9765E0' : '#EEB63C', display: 'inline-block' }} />
              {accentTheme === 'purple' ? 'Purple' : 'Yellow'}
            </button>
          )}
          {/* The «View as client» toggle lives in Admin → Dashboard (owner's
              spec §8). The navbar only shows the RETURN button while the
              client view is on — /admin itself is locked in that mode. */}
          {isRealAdminEmail(user?.email) && isViewingAsClient() && (
            <button
              onClick={toggleViewAsClient}
              title="Вернуться в админ-вид"
              className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: 'rgba(229,169,75,0.15)',
                border: '1px solid rgba(229,169,75,0.5)',
                color: '#E5A94B', cursor: 'pointer',
              }}
            >
              ← Back to admin
            </button>
          )}
          {/* Library moved to the catalog sidebar (owner's layout) */}
          {user && credits !== null && (
            <>
              <button
                onClick={() => setTopupOpen(true)}
                title="Ваши кредиты — клик, чтобы докупить"
                className="flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-full"
                style={{
                  backgroundColor: 'color-mix(in srgb, var(--accent) 14%, transparent)', color: 'var(--accent-soft)',
                  border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', cursor: 'pointer',
                  animation: pulse ? 'cine-chip-pulse .45s ease-out' : undefined,
                }}
              >
                <CreditGem size={14} />
                {credits}
              </button>
              <button
                onClick={() => setTopupOpen(true)}
                className="hidden md:inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: 'transparent', color: 'var(--accent-soft)',
                  border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)', cursor: 'pointer',
                }}
              >
                Buy credits
              </button>
            </>
          )}
          {user ? (
            <Link href="/profile" title="Profile" className="flex items-center">
              {(avatarUrl || user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={avatarUrl || user.user_metadata.avatar_url || user.user_metadata.picture}
                  alt=""
                  className="rounded-full transition-transform hover:scale-105"
                  style={{ width: 34, height: 34, border: '2px solid color-mix(in srgb, var(--accent) 60%, transparent)', objectFit: 'cover' }}
                />
              ) : (
                <span
                  className="rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ width: 34, height: 34, background: 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: 'var(--on-accent)' }}
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
      {topupOpen && <TopupModal onClose={() => setTopupOpen(false)} />}
    </nav>
  )
}
