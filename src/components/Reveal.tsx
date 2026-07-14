'use client'

import { useEffect, useRef } from 'react'

// Soft section reveal on scroll (DEV_shelf_style §4): opacity + 8px rise,
// fires once per section — never per card, never looping.
export default function Reveal({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('cine-in'); io.disconnect() } },
      // generous margin + failsafe — sections never leave a blank void
      { rootMargin: '0px 0px 30% 0px' },
    )
    io.observe(el)
    const t = setTimeout(() => el.classList.add('cine-in'), 1500)
    return () => { io.disconnect(); clearTimeout(t) }
  }, [])
  return <div ref={ref} className={`cine-reveal ${className}`}>{children}</div>
}
