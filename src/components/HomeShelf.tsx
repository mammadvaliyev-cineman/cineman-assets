'use client'

import { useRef } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────
// HOME SHELF — a horizontal «store shelf» row (Homepage v2 §5).
// Native horizontal scroll + arrow buttons on desktop, cards in
// the same visual language as the catalog. 8-12 items + See all.
// ─────────────────────────────────────────────────────────────

export type ShelfItem = {
  id: string
  title: string
  img: string
  type: string
  typeColor: string
  price: number
  isFree: boolean
  resolution: string
  href: string
}

function Gem({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6 3h12l4 6-10 12L2 9l4-6z" fill="#2DD4C4" opacity="0.9" />
      <path d="M6 3h12l4 6H2l4-6z" fill="#5EEAD4" opacity="0.85" />
    </svg>
  )
}

const arrowStyle: React.CSSProperties = {
  width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border)',
  backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-muted)', cursor: 'pointer',
  alignItems: 'center', justifyContent: 'center', fontSize: 16, lineHeight: 1,
}

export default function HomeShelf({
  title, accent = '#9765E0', seeAllHref, items, badge,
}: {
  title: string
  accent?: string
  seeAllHref: string
  items: ShelfItem[]
  badge?: string
}) {
  const row = useRef<HTMLDivElement>(null)
  const scroll = (dir: number) => row.current?.scrollBy({ left: dir * 660, behavior: 'smooth' })
  if (!items.length) return null
  return (
    <section className="max-w-7xl mx-auto px-6" style={{ marginBottom: 56 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold flex items-center gap-2.5" style={{ color: 'var(--fg)' }}>
          {title}
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md" style={{ backgroundColor: accent + '26', color: accent }}>
              {badge}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <Link href={seeAllHref} className="text-sm font-semibold mr-1" style={{ color: accent }}>See all →</Link>
          <button onClick={() => scroll(-1)} className="hidden md:flex" style={arrowStyle} aria-label="Scroll left">‹</button>
          <button onClick={() => scroll(1)} className="hidden md:flex" style={arrowStyle} aria-label="Scroll right">›</button>
        </div>
      </div>
      <div
        ref={row}
        style={{ display: 'flex', gap: 14, overflowX: 'auto', scrollSnapType: 'x mandatory', paddingBottom: 8, scrollbarWidth: 'none' }}
      >
        {items.map(it => (
          <Link
            key={it.id}
            href={it.href}
            className="group hover:-translate-y-1 transition-transform duration-200"
            style={{
              width: 200, flexShrink: 0, scrollSnapAlign: 'start',
              borderRadius: 12, overflow: 'hidden',
              border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)',
              textDecoration: 'none',
            }}
          >
            <div style={{ aspectRatio: '4/5', overflow: 'hidden', position: 'relative', backgroundColor: 'var(--bg-subtle)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.img}
                alt={it.title}
                loading="lazy"
                className="group-hover:scale-[1.03] transition-transform duration-200"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              {it.isFree && (
                <span
                  className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
                  style={{ color: '#0A1F1C', backgroundColor: '#2DD4C4', boxShadow: '0 2px 10px rgba(45,212,196,0.4)' }}
                >
                  Free
                </span>
              )}
              <span
                className="absolute bottom-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.25)', color: 'rgba(255,255,255,0.85)' }}
              >
                {it.resolution}
              </span>
            </div>
            <div style={{ padding: '10px 12px' }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
                {it.title}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: it.typeColor + '2e', color: it.typeColor }}>
                  {it.type}
                </span>
                <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: it.isFree ? '#2DD4C4' : 'var(--fg)' }}>
                  {it.isFree ? 'Free' : (<><Gem /> {it.price}</>)}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
