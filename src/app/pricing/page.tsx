const PLANS = [
  {
    name: 'Starter',
    price: 9.99,
    description: 'Perfect for independent creators',
    accent: '#CE95FB',
    badge: null,
    popular: false,
    features: [
      'Access to 50+ starter assets',
      '720p video quality',
      'Personal use license',
      'Standard support',
    ],
  },
  {
    name: 'Pro',
    price: 24.99,
    description: 'For professional filmmakers',
    accent: '#9765E0',
    badge: 'Most Popular',
    popular: true,
    features: [
      'Access to 200+ pro assets',
      '4K video quality',
      'Commercial use license',
      'Priority support',
      'Early access to new assets',
      'Bulk download',
    ],
  },
  {
    name: 'Enterprise',
    price: 79.99,
    description: 'For studios and agencies',
    accent: '#00C2BA',
    badge: 'Best Value',
    popular: false,
    features: [
      'Unlimited asset access',
      '8K video quality',
      'Full commercial license',
      'Dedicated support',
      'Custom asset requests',
      'Team collaboration',
    ],
  },
]

const FAQ = [
  { q: 'Can I cancel anytime?', a: 'Yes. Cancel anytime from your account dashboard. No lock-in, no hidden fees.' },
  { q: 'What file formats are included?', a: 'Photos: JPG, PNG, TIFF. Videos: MP4 (H.264/H.265), ProRes. Motion: MOV, GIF.' },
  { q: 'Is commercial use allowed?', a: 'Pro and Enterprise plans include a full commercial license. Starter is for personal use only.' },
  { q: 'How do I upgrade my plan?', a: 'Go to Account → Subscription → Upgrade. Your billing is prorated automatically.' },
]

export default function PricingPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16">
      <div className="text-center mb-16">
        <span
          className="inline-block text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-5"
          style={{ backgroundColor: 'rgba(151,101,224,0.12)', color: '#9765E0', border: '1px solid rgba(151,101,224,0.25)' }}
        >
          Simple Pricing
        </span>
        <h1 className="text-5xl font-bold mb-4" style={{ color: 'var(--fg)' }}>
          Choose Your Plan
        </h1>
        <p className="text-lg max-w-xl mx-auto" style={{ color: 'var(--fg-muted)' }}>
          Start free for 7 days. No credit card required. Upgrade or cancel anytime.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-20">
        {PLANS.map(plan => (
          <div
            key={plan.name}
            className="relative card p-8 flex flex-col"
            style={{
              borderColor: plan.popular ? plan.accent : 'var(--border)',
              borderWidth: plan.popular ? 2 : 1,
              boxShadow: plan.popular ? `0 0 32px ${plan.accent}30` : undefined,
            }}
          >
            {plan.badge && (
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold px-4 py-1 rounded-full"
                style={{ background: `linear-gradient(135deg, ${plan.accent}, #534FA5)`, color: 'white', whiteSpace: 'nowrap' }}
              >
                {plan.badge}
              </span>
            )}
            <div className="mb-6">
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--fg)' }}>{plan.name}</h2>
              <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>{plan.description}</p>
            </div>
            <div className="mb-8">
              <span className="text-5xl font-bold" style={{ color: plan.accent }}>${plan.price}</span>
              <span className="ml-2 text-sm" style={{ color: 'var(--fg-muted)' }}>/month</span>
            </div>
            <ul className="space-y-3 mb-8 flex-1">
              {plan.features.map(f => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <span style={{ color: plan.accent, marginTop: 2 }}>✓</span>
                  <span style={{ color: 'var(--fg-muted)' }}>{f}</span>
                </li>
              ))}
            </ul>
            <button
              className={plan.popular ? 'btn-primary w-full' : 'btn-secondary w-full'}
              style={!plan.popular ? { borderColor: plan.accent, color: plan.accent } : undefined}
            >
              Get {plan.name}
            </button>
          </div>
        ))}
      </div>

      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-8" style={{ color: 'var(--fg)' }}>
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="card p-6">
              <h3 className="font-semibold mb-2" style={{ color: 'var(--fg)' }}>{q}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--fg-muted)' }}>{a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
