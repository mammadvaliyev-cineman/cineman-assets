'use client'

import Link from 'next/link'
import { useTheme } from '@/components/ThemeProvider'

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
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

function FilmIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  )
}

export default function Navbar() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'

  return (
    <nav
      className="sticky top-0 z-50 backdrop-blur-xl border-b"
      style={{ backgroundColor: 'var(--nav-bg)', borderColor: 'var(--border)' }}
    >
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg" style={{ color: 'var(--fg)' }}>
          <span style={{ color: '#9765E0' }}><FilmIcon /></span>
          <span>
            Cineman{' '}
            <span style={{ background: 'linear-gradient(135deg, #9765E0, #00C2BA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Assets
            </span>
          </span>
        </Link>

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

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label="Toggle theme"
            className="p-2 rounded-lg transition-all duration-200"
            style={{ color: 'var(--fg-muted)', backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
          >
            {isDark ? <SunIcon /> : <MoonIcon />}
          </button>
          <Link href="/pricing" className="btn-primary text-sm px-4 py-2">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  )
}
