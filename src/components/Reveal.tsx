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
      { rootMargin: '0px 0px -40px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} className={`cine-reveal ${className}`}>{children}</div>
}
