'use client'

import { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// HERO SHOWREEL (DEV_flair_motion §3): the first screen breathes.
// Slow ken-burns zoom over cinematic location frames, crossfaded
// every 5s, plus a gentle scroll parallax (hero media moves a bit
// slower than the page). Everything transform/opacity, and both
// motions switch off for prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────

export type ShowreelFrame = { src: string; alt: string }

export default function HeroShowreel({ frames }: { frames: ShowreelFrame[] }) {
  const [idx, setIdx] = useState(0)
  const wrap = useRef<HTMLDivElement>(null)

  // crossfade every 5s (skip when the user prefers reduced motion)
  useEffect(() => {
    if (frames.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setIdx(i => (i + 1) % frames.length), 5000)
    return () => clearInterval(t)
  }, [frames.length])

  // gentle parallax — the media lags the scroll slightly (depth §1)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (wrap.current) wrap.current.style.transform = `translateY(${(Math.min(window.scrollY, 700) * 0.07).toFixed(1)}px)`
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf) }
  }, [])

  if (!frames.length) return null
  return (
    <div ref={wrap} style={{ willChange: 'transform' }}>
      <div
        className="cine-sheen"
        style={{
          position: 'relative', aspectRatio: '16/10', borderRadius: 14, overflow: 'hidden',
          border: '0.5px solid rgba(255,255,255,0.07)', backgroundColor: '#17151E',
          boxShadow: '0 26px 70px rgba(0,0,0,0.5)',
        }}
      >
        {frames.map((f, i) => (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            key={f.src}
            src={f.src}
            alt={f.alt}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
              opacity: i === idx ? 1 : 0, transition: 'opacity 1.2s ease',
              animation: i === idx ? 'cineKenburns 7s ease-out forwards' : 'none',
            }}
          />
        ))}
        {/* soft bottom vignette for depth — not a text scrim */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,15,0.35), transparent 40%)', pointerEvents: 'none' }} />
        {/* frame dots */}
        {frames.length > 1 && (
          <div style={{ position: 'absolute', bottom: 12, right: 14, display: 'flex', gap: 5, zIndex: 2 }}>
            {frames.map((_, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: i === idx ? '#CE95FB' : 'rgba(255,255,255,0.35)', transition: 'background-color .4s ease' }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
