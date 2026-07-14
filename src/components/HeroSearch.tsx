'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────
// HERO SEARCH (DEV_homepage_search) — the stock-style discovery
// tool, big and focal. Enter / icon click → /catalog?q=…
// Trending chips below (owner edits them in Admin → Settings,
// homepage-config.trending). A chip that names a category jumps
// straight to that category filter; anything else runs a search.
// Works for anonymous visitors — browsing is free.
// ─────────────────────────────────────────────────────────────

const CAT_MAP: Record<string, string> = {
  people: 'People', portraits: 'People', animals: 'Animal', creatures: 'Creature',
  zombies: 'Zombie', robots: 'Robot', locations: 'Location', vehicles: 'Vehicle',
}

function hrefFor(term: string): string {
  const cat = CAT_MAP[term.trim().toLowerCase()]
  return cat ? `/catalog?category=${encodeURIComponent(cat)}` : `/catalog?q=${encodeURIComponent(term.trim())}`
}

export default function HeroSearch({ trending }: { trending: string[] }) {
  const [q, setQ] = useState('')
  const go = () => { if (q.trim()) window.location.href = `/catalog?q=${encodeURIComponent(q.trim())}` }

  return (
    <div className="mb-8" style={{ maxWidth: 560 }}>
      <div
        className="flex items-stretch rounded-xl overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-subtle)',
          border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
          boxShadow: '0 0 30px color-mix(in srgb, var(--accent) 10%, transparent)',
        }}
      >
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') go() }}
          placeholder="Search cinematic assets — or describe a scene"
          aria-label="Search assets"
          className="flex-1 text-[15px]"
          style={{ padding: '15px 18px', background: 'none', border: 'none', outline: 'none', color: 'var(--fg)', minWidth: 0 }}
        />
        <button
          onClick={go}
          aria-label="Search"
          className="flex items-center justify-center px-5"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))', border: 'none', cursor: 'pointer', color: 'var(--on-accent)' }}
        >
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>

      {trending.length > 0 && (
        <div className="flex items-center flex-wrap gap-2 mt-3">
          <span className="text-xs font-semibold" style={{ color: 'var(--fg-subtle)' }}>Trending:</span>
          {trending.map(t => (
            <a
              key={t}
              href={hrefFor(t)}
              className="text-xs font-semibold px-3 py-1 rounded-full transition-colors"
              style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)', textDecoration: 'none' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'color-mix(in srgb, var(--accent) 55%, transparent)'; el.style.color = 'var(--accent-soft)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.borderColor = 'var(--border)'; el.style.color = 'var(--fg-muted)' }}
            >
              {t}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
