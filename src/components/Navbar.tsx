'use client'

import Link from 'next/link'
import { useTheme } from '@/components/ThemeProvider'
import { useAuth } from '@/components/AuthProvider'

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
  const { user, signInGoogle } = useAuth()

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
            <button
              onClick={signInGoogle}
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ color: 'var(--fg-muted)', border: '1px solid var(--border)' }}
            >
              Sign in
            </button>
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
