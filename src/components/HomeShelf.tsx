'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTilt } from '@/components/Tilt'

// ─────────────────────────────────────────────────────────────
// HOME SHELF — a horizontal «store shelf» row (Homepage v2 §5,
// styled per DEV_shelf_style): every card sits on the same warm
// graphite mat (#17151E), the sheet is shown WHOLE (contain, air
// around it), and the title/chip/price rest on a bottom scrim so
// they read on any background. Shimmer skeleton while loading,
// hover = zoom 1.03 + violet ring. No gloss on shelf cards.
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

function ShelfCard({ it, index }: { it: ShelfItem; index: number }) {
  const [loaded, setLoaded] = useState(false)
  const tilt = useTilt(6)
  return (
    <Link
      href={it.href}
      className="group cine-ring cine-shadow cine-stagger"
      {...tilt}
      style={{
        width: 320, flexShrink: 0, scrollSnapAlign: 'start',
        borderRadius: 12, overflow: 'hidden',
        border: '0.5px solid rgba(255,255,255,0.07)',
        backgroundColor: '#17151E',
        textDecoration: 'none', display: 'block', willChange: 'transform',
        ['--stg' as never]: `${index * 45}ms`,
      }}
    >
      {/* Full sheet on the graphite mat — contain + air, never cropped.
          NO text on the photo (owner's rollback) — caption lives below. */}
      <div className={loaded ? '' : 'cine-shimmer'} style={{ aspectRatio: '3/2', overflow: 'hidden', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={it.img}
          alt={it.title}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          // cached images complete before hydration — don't miss the event
          ref={el => { if (el && el.complete && el.naturalWidth > 0) setLoaded(true) }}
          style={{
            width: '100%', height: '100%', objectFit: 'contain', display: 'block',
            padding: 10, opacity: loaded ? 1 : 0, transition: 'opacity .3s ease',
          }}
        />
        {it.isFree && (
          <span
            className="absolute top-2 left-2 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-md"
            style={{ color: '#0A1F1C', backgroundColor: '#2DD4C4', boxShadow: '0 2px 10px rgba(45,212,196,0.4)', zIndex: 2 }}
          >
            Free
          </span>
        )}
        {/* watermark-style corner: small, unobtrusive */}
        <span
          className="absolute bottom-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.75)', zIndex: 2 }}
        >
          {it.resolution}
        </span>
      </div>
      {/* Caption UNDER the image (owner's rollback) */}
      <div style={{ padding: '10px 12px' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0 }}>
          {it.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: it.typeColor + '2e', color: it.typeColor }}>
            {it.type}
          </span>
          <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 700, color: it.isFree ? '#2DD4C4' : 'var(--fg)' }}>
            {it.isFree ? 'Free' : (<><Gem /> {it.price}</>)}
          </span>
        </div>
      </div>
    </Link>
  )
}

export default function HomeShelf({
  title, accent = 'var(--accent)', seeAllHref, items, badge,
}: {
  title: string
  accent?: string
  seeAllHref: string
  items: ShelfItem[]
  badge?: string
}) {
  const row = useRef<HTMLDivElement>(null)
  const section = useRef<HTMLElement>(null)
  const scroll = (dir: number) => row.current?.scrollBy({ left: dir * 660, behavior: 'smooth' })
  // soft self-reveal on scroll (once)
  useEffect(() => {
    const el = section.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('cine-in'); io.disconnect() } },
      // generous margin: shelves fade in BEFORE they reach the viewport,
      // so there is never a blank void between sections (owner's polish §3)
      { rootMargin: '0px 0px 30% 0px' },
    )
    io.observe(el)
    // failsafe: if the observer never fires (background tab, cache), show anyway
    const t = setTimeout(() => el.classList.add('cine-in'), 1500)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [])
  if (!items.length) return null
  return (
    <section ref={section} className="max-w-7xl mx-auto px-6 cine-reveal" style={{ marginBottom: 56 }}>
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
        {items.map((it, i) => <ShelfCard key={it.id} it={it} index={i} />)}
      </div>
    </section>
  )
}
