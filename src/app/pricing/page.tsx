const PLANS = [
  {
    name: 'Free',
    price: 0,
    description: 'Try the full catalog',
    accent: '#CE95FB',
    badge: null,
    popular: false,
    license: 'Personal use only',
    commercial: false,
    features: [
      '⚡ 15 credits every month (~3 assets/mo)',
      'Browse the entire catalog',
      'Full-resolution PNG/JPG downloads',
    ],
  },
  {
    name: 'Personal',
    price: 12,
    description: 'For hobby & personal projects',
    accent: '#9765E0',
    badge: null,
    popular: false,
    license: 'Personal use only',
    commercial: false,
    features: [
      '⚡ 150 credits every month (~30 assets/mo)',
      'Full-resolution PNG/JPG downloads',
      'Priority support',
    ],
  },
  {
    name: 'Pro',
    price: 25,
    description: 'For creators who sell their work',
    accent: '#00C2BA',
    badge: 'Most Popular',
    popular: true,
    license: 'Commercial license',
    commercial: true,
    features: [
      'Everything in Personal, plus…',
      '⚡ 500 credits every month (~100 assets/mo)',
      'Exclusive buyouts — 50 credits',
      'Priority support & early access',
    ],
  },
]

const FAQ = [
  {
    q: 'How do credits work?',
    a: 'Every download costs credits: a standard asset is 5 credits, top assets up to 20, an exclusive buyout is 50. Credits refresh monthly with your plan, and you can top up anytime on any plan — 100 credits for $10.',
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
    a: 'The Pro plan includes a full commercial license for advertising, film, and social media. Free and Personal are for personal use only.',
  },
]

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      {/* Header */}
      <div className="text-center mb-16">
        <span
          className="inline-block text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5"
          style={{
            backgroundColor: 'rgba(151,101,224,0.12)',
            color: '#9765E0',
            border: '1px solid rgba(151,101,224,0.25)',
          }}
        >
          Simple Pricing
        </span>
        <h1
          className="text-5xl font-bold mb-4"
          style={{ color: 'var(--fg)' }}
        >
          Choose Your Plan
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--fg-muted)' }}>
          Start free. No credit card required. Upgrade or cancel anytime.
        </p>
      </div>

      {/* Plans — pt-4 so absolute badges are never clipped */}
      <div className="grid md:grid-cols-3 gap-6 pt-4 mb-6">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className="relative card p-8 flex flex-col"
            style={{
              overflow: 'visible', // .card has overflow-hidden — would clip the badge
              borderColor: plan.popular ? plan.accent : 'var(--border)',
              borderWidth: plan.popular ? 2 : 1,
              boxShadow: plan.popular ? `0 0 32px ${plan.accent}30` : undefined,
            }}
          >
            {/* Badge */}
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

            {/* Plan name + desc */}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--fg)' }}>
                {plan.name}
              </h2>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
                {plan.description}
              </p>
            </div>

            {/* Price */}
            <div className="mb-5">
              <span className="text-5xl font-bold" style={{ color: plan.accent }}>
                ${plan.price}
              </span>
              <span className="ml-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                /month
              </span>
            </div>

            {/* License — the key differentiator */}
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
              {plan.commercial ? '💼 ' : ''}{plan.license}
            </div>

            {/* Features */}
            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span style={{ color: plan.accent, marginTop: 2 }}>✓</span>
                  <span style={{ color: 'var(--fg-muted)' }}>{f}</span>
                </li>
              ))}
            </ul>

            {/* CTA */}
            <button
              className={plan.popular ? 'btn-primary w-full' : 'btn-secondary w-full'}
              style={
                !plan.popular
                  ? { borderColor: plan.accent, color: plan.accent }
                  : undefined
              }
            >
              Get {plan.name}
            </button>
          </div>
        ))}
      </div>

      {/* Top-up — applies to every plan */}
      <p className="text-center text-sm mb-20" style={{ color: 'var(--fg-muted)' }}>
        ⚡ Need more? Top up anytime on any plan — <span style={{ color: 'var(--fg)', fontWeight: 600 }}>100 credits = $10</span>
      </p>

      {/* FAQ */}
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8" style={{ color: 'var(--fg)' }}>
          Frequently Asked Questions
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
