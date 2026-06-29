'use client'

import Link from 'next/link'
import { useTheme } from '@/components/ThemeProvider'

// ── Cineman Logo Icon (matches brand logo exactly) ───────────
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
      {/* Rounded square background */}
      <rect width="40" height="40" rx="9" ry="9" fill="url(#cl-grad)" />
      {/* Outer ring — 16 dots, r≈12 */}
      {Array.from({ length: 16 }, (_, i) => (
        <rect
          key={`o${i}`}
          x="19"
          y="6.5"
          width="2"
          height="3"
          rx="0.6"
          fill="white"
          fillOpacity="0.92"
          transform={`rotate(${i * 22.5}, 20, 20)`}
        />
      ))}
      {/* Middle ring — 12 dots, r≈8 */}
      {Array.from({ length: 12 }, (_, i) => (
        <rect
          key={`m${i}`}
          x="19.1"
          y="11.2"
          width="1.8"
          height="2.4"
          rx="0.4"
          fill="white"
          fillOpacity="0.72"
          transform={`rotate(${i * 30}, 20, 20)`}
        />
      ))}
      {/* Inner ring — 8 dots, r≈5 */}
      {Array.from({ length: 8 }, (_, i) => (
        <rect
          key={`i${i}`}
          x="19.3"
          y="14.8"
          width="1.4"
          height="1.8"
          rx="0.35"
          fill="white"
          fillOpacity="0.52"
          transform={`rotate(${i * 45}, 20, 20)`}
        />
      ))}
    </svg>
  )
}

// ── Theme icons ──────────────────────────────────────────────
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  )
}

// ── Navbar ───────────────────────────────────────────────────
export default function Navbar() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

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
              ASSETS
            </span>
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-8">
          {[
            { href: '/catalog', label: 'Catalog' },
            { href: '/pricing', label: 'Pricing' },
            { href: '/admin', label: 'Admin' },
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
          {/* Theme toggle */}
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="p-2 rounded-lg transition-all duration-200"
            style={{
              color: 'var(--fg-muted)',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
            }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>

          {/* CTA */}
          <Link href="/pricing" className="btn-primary text-sm px-4 py-2">
            Get Started
          </Link>

          {/* Mobile menu */}
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
