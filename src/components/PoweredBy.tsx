'use client'

import { useState } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────
// POWERED BY + MODEL MATCH (DEV_homepage_powered_by).
// Curated — three strong engines grouped by job, own styled chips
// (variant A, matches the Studio model selector), NOT a logo wall.
// Model Match: pick the project type → we recommend the engine and
// open Studio with that model preselected (?model=…). Simple
// mapping — the point is removing the model choice from the user.
// ─────────────────────────────────────────────────────────────

type Engine = { name: string; tag: string; model?: string }

const GROUPS: { group: string; items: Engine[] }[] = [
  { group: 'Image', items: [
    { name: 'Nano Banana', tag: 'Photoreal stills · fast' },
  ] },
  { group: 'Video', items: [
    { name: 'Seedance 2.0', tag: 'Native 4K · fast', model: 'seedance-2' },
    { name: 'Kling 3.0', tag: 'Cinematic · audio', model: 'kling-3' },
  ] },
]

const MATCH: { id: string; label: string; engine: string; why: string; href: string }[] = [
  { id: 'photo', label: 'Photo / still', engine: 'Nano Banana', why: 'crisp photoreal stills in seconds', href: '/studio' },
  { id: 'fast', label: 'Fast video · 4K', engine: 'Seedance 2.0', why: 'native 4K renders, quick turnaround', href: '/studio?model=seedance-2' },
  { id: 'cine', label: 'Cinematic · with audio', engine: 'Kling 3.0', why: 'film-grade motion with sound', href: '/studio?model=kling-3' },
]

function EngineChip({ e }: { e: Engine }) {
  return (
    <div
      className="rounded-xl px-4 py-3"
      style={{
        border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)',
        backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)',
        minWidth: 170,
      }}
    >
      <p className="text-sm font-bold" style={{ color: 'var(--accent-soft)', margin: 0 }}>{e.name}</p>
      <p className="text-[11px]" style={{ color: 'var(--fg-muted)', margin: '2px 0 0' }}>{e.tag}</p>
    </div>
  )
}

export default function PoweredBy() {
  const [pick, setPick] = useState<string | null>(null)
  const match = MATCH.find(m => m.id === pick) ?? null

  return (
    <section className="max-w-5xl mx-auto px-6" style={{ marginBottom: 64 }}>
      {/* ── Powered by ── */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Powered by the best AI models</h2>
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
          We pick the best model for each job — you don&apos;t have to.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-6 mb-12">
        {GROUPS.map(g => (
          <div key={g.group} className="flex items-stretch gap-3">
            <span
              className="text-[10px] font-bold uppercase tracking-wider self-center"
              style={{ color: 'var(--fg-subtle)', writingMode: 'vertical-rl' as never, transform: 'rotate(180deg)' }}
            >
              {g.group}
            </span>
            <div className="flex gap-3 flex-wrap">
              {g.items.map(e => <EngineChip key={e.name} e={e} />)}
            </div>
          </div>
        ))}
      </div>

      {/* ── Model Match ── */}
      <div
        className="rounded-2xl p-6 md:p-8"
        style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        <div className="text-center mb-5">
          <h3 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Model Match</h3>
          <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
            What are you making? We&apos;ll match the engine.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-4">
          {MATCH.map(m => (
            <button
              key={m.id}
              onClick={() => setPick(m.id)}
              className="text-xs font-bold px-4 py-2 rounded-full"
              style={pick === m.id
                ? { background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))', color: 'var(--on-accent)', border: 'none', cursor: 'pointer' }
                : { border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}
            >
              {m.label}
            </button>
          ))}
        </div>
        {match && (
          <div className="text-center">
            <p className="text-sm mb-3" style={{ color: 'var(--fg)' }}>
              → <strong style={{ color: 'var(--accent-soft)' }}>{match.engine}</strong>
              <span style={{ color: 'var(--fg-muted)' }}> — {match.why}</span>
            </p>
            <Link href={match.href} className="btn-primary inline-block text-sm px-6 py-2.5">
              Open in Studio →
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
