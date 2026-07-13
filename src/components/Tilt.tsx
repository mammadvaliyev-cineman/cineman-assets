'use client'

// ─────────────────────────────────────────────────────────────
// 3D-TILT hover (DEV_flair_motion §2): the card leans toward the
// cursor (~6-8° with perspective) and the image inside drifts a
// touch (parallax-image). Smooth 150-250ms, GPU transforms only.
// Disabled on touch devices and for prefers-reduced-motion.
// ─────────────────────────────────────────────────────────────

function motionAllowed(): boolean {
  return typeof window !== 'undefined'
    && window.matchMedia('(pointer: fine)').matches
    && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useTilt(max = 7) {
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!motionAllowed()) return
    const el = e.currentTarget as HTMLElement
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transition = 'transform .15s ease-out'
    el.style.transform = `perspective(700px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-3px)`
    const img = el.querySelector('img') as HTMLElement | null
    if (img) {
      img.style.transition = 'transform .2s ease-out'
      img.style.transform = `scale(1.05) translate(${(px * -5).toFixed(1)}px, ${(py * -5).toFixed(1)}px)`
    }
  }
  const onPointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget as HTMLElement
    el.style.transition = 'transform .3s ease'
    el.style.transform = ''
    const img = el.querySelector('img') as HTMLElement | null
    if (img) { img.style.transition = 'transform .3s ease'; img.style.transform = '' }
  }
  return { onPointerMove, onPointerLeave }
}

export default function Tilt({
  children, max = 7, className = '', style,
}: { children: React.ReactNode; max?: number; className?: string; style?: React.CSSProperties }) {
  const { onPointerMove, onPointerLeave } = useTilt(max)
  return (
    <div onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className={className} style={{ willChange: 'transform', ...style }}>
      {children}
    </div>
  )
}
