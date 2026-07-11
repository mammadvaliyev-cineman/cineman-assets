'use client'

import { useState } from 'react'

// Pricing page — copy is verbatim from the owner's latest spec:
// sentence case, NO emoji (inline SVG bolt), accent on Pro only,
// license as a large pill, Monthly/Yearly toggle (~17% off yearly),
// one-currency footer: Download 5 · Generation 5 (4K 10) · Top up 100=$10.
// Commercial license on Personal AND Pro — plans differ by volume.

// Credit currency = turquoise brilliant-cut gem (owner's spec)
function Bolt({ size = 14 }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'inline', verticalAlign: '-0.15em' }}>
      <polygon points="8,5 12,5 12,10 4,10" fill="#5EEAD4" />
      <polygon points="12,5 16,5 20,10 12,10" fill="#2DD4C4" />
      <polygon points="4,10 12,10 12,21" fill="#2DD4C4" />
      <polygon points="12,10 20,10 12,21" fill="#0F9E8E" />
      <polygon points="8,5 9.6,5 6,10 4,10" fill="#ffffff" fillOpacity="0.5" />
    </svg>
  )
}

// Render a string where every ⚡ becomes the SVG bolt (no emoji on screen)
function withBolt(text: string, color?: string) {
  const parts = text.split('⚡')
  return parts.map((p, i) => (
    <span key={i}>{p}{i < parts.length - 1 && <Bolt color={color} />}</span>
  ))
}

const PLANS = [
  {
    name: 'Free',
    monthly: 0,
    yearly: 0,
    subtitle: 'Try the full catalog',
    accent: '#CE95FB',
    badge: null,
    popular: false,
    license: 'Personal use only',
    commercial: false,
    features: [
      '15 credits / mo (~3 assets — download or generate)',
      'Generate missing assets with AI',
      'Realistic + cartoon styles',
      'Browse the entire catalog',
      'Full-res, no watermark',
    ],
    cta: 'Get started',
  },
  {
    name: 'Personal',
    monthly: 12,
    yearly: 120, // $/yr — ~2 months free
    subtitle: 'For solo creators',
    accent: '#9765E0',
    badge: null,
    popular: false,
    license: 'Commercial license',
    commercial: true,
    features: [
      '150 credits / mo (~30 assets — download or generate)',
      'Generate missing assets with AI',
      'Realistic + cartoon styles',
      'Save favorites & collections',
      'Full-res, no watermark',
      'Priority support',
    ],
    cta: 'Choose Personal',
  },
  {
    name: 'Pro',
    monthly: 25,
    yearly: 250, // $/yr — ~2 months free
    subtitle: 'For creators who sell more',
    accent: '#00C2BA',
    badge: 'Most popular',
    popular: true,
    license: 'Commercial license',
    commercial: true,
    features: [
      '500 credits / mo (~100 assets — download or generate)',
      'Generate missing assets with AI',
      '4K generation',
      'Exclusive buyouts · 50⚡ each',
      'Save favorites & collections',
      'Early access to new assets',
      'Priority support',
    ],
    cta: 'Choose Pro',
  },
]

const FAQ = [
  {
    q: 'How do credits work?',
    a: 'Credits are one currency for downloads and for generating a missing asset. A standard download is 5 credits, generation is 5 (4K is 10), an exclusive buyout is 50. Credits refresh monthly with your plan, and you can top up anytime — 100 credits for $10.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel anytime from your account dashboard. No lock-in, no hidden fees.',
  },
  {
    q: 'What file formats are included?',
    a: 'All assets are delivered as high-resolution JPG and PNG files, ready for production use.',
  },
  {
    q: 'Is commercial use allowed?',
    a: 'Personal and Pro include a full commercial license for advertising, film, and social media. Free is for personal use only.',
  },
]

export default function PricingPage() {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')

  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <span
          className="inline-block text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5"
          style={{
            backgroundColor: 'rgba(151,101,224,0.12)',
            color: '#9765E0',
            border: '1px solid rgba(151,101,224,0.25)',
          }}
        >
          Simple pricing
        </span>
        <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--fg)' }}>
          Choose your plan
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--fg-muted)' }}>
          Start free. No card required. Upgrade or cancel anytime.
        </p>
      </div>

      {/* Billing period toggle */}
      <div className="flex justify-center mb-10">
        <div
          className="flex items-center gap-1 rounded-full p-1"
          style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}
        >
          {(['monthly', 'yearly'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-5 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={
                period === p
                  ? { background: 'linear-gradient(135deg, #9765E0, #534FA5)', color: 'white' }
                  : { color: 'var(--fg-muted)' }
              }
            >
              {p === 'monthly' ? 'Monthly' : 'Yearly · save ~17%'}
            </button>
          ))}
        </div>
      </div>

      {/* Plans — pt-4 keeps the absolute badge unclipped */}
      <div className="grid md:grid-cols-3 gap-6 pt-4 mb-8">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className="relative card p-8 flex flex-col"
            style={{
              overflow: 'visible', // .card clips overflow — would cut the badge
              borderColor: plan.popular ? plan.accent : 'var(--border)',
              borderWidth: plan.popular ? 2 : 1,
            }}
          >
            {plan.badge && (
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full"
                style={{
                  background: `linear-gradient(135deg, ${plan.accent}, #534FA5)`,
                  color: 'white',
                  whiteSpace: 'nowrap',
                }}
              >
                {plan.badge}
              </span>
            )}

            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--fg)' }}>
                {plan.name}
              </h2>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                {plan.subtitle}
              </p>
            </div>

            <div className="mb-5">
              <span className="text-5xl font-bold" style={{ color: plan.accent }}>
                ${period === 'yearly' ? plan.yearly : plan.monthly}
              </span>
              <span className="ml-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                {period === 'yearly' ? '/yr' : '/mo'}
              </span>
              {period === 'yearly' && plan.monthly > 0 && (
                <span className="block text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>
                  ≈ ${Math.round(plan.yearly / 12 * 10) / 10}/mo — 2 months free
                </span>
              )}
            </div>

            {/* License — the pill users compare first */}
            <div
              className="mb-6 text-sm font-bold px-4 py-2 rounded-lg text-center"
              style={
                plan.commercial
                  ? {
                      color: '#00C2BA',
                      backgroundColor: 'rgba(0,194,186,0.10)',
                      border: '1px solid rgba(0,194,186,0.35)',
                    }
                  : {
                      color: 'var(--fg-muted)',
                      backgroundColor: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--border)',
                    }
              }
            >
              {plan.license}
            </div>

            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span style={{ color: plan.accent, marginTop: 2 }}>✓</span>
                  <span style={{ color: 'var(--fg-muted)' }}>{withBolt(f, plan.accent)}</span>
                </li>
              ))}
            </ul>

            <button
              className={plan.popular ? 'btn-primary w-full' : 'btn-secondary w-full'}
              style={
                !plan.popular
                  ? { borderColor: plan.accent, color: plan.accent }
                  : undefined
              }
            >
              {plan.cta}
            </button>
          </div>
        ))}
      </div>

      {/* One currency — downloads + generation */}
      <div className="text-center mb-20">
        <p className="text-sm mb-1" style={{ color: 'var(--fg-muted)' }}>
          Credits work for <span style={{ color: 'var(--fg)', fontWeight: 600 }}>downloads and generating a missing asset</span> — one currency.
        </p>
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
          {withBolt('Standard 5⚡ · 4K 10⚡ (same for download or generate) · Top up anytime: 100 credits = $10')}
        </p>
      </div>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8" style={{ color: 'var(--fg)' }}>
          Frequently asked questions
        </h2>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="card p-6">
              <h3 className="font-semibold mb-2" style={{ color: 'var(--fg)' }}>
                {q}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
                {a}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
