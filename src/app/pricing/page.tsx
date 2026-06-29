import Link from 'next/link'

const plans = [
  {
    name: 'Starter',
    price: '$9.99',
    period: '/month',
    description: 'Perfect for independent creators',
    features: [
      'Access to 50+ starter assets',
      '720p video quality',
      'Personal use license',
      'Standard support',
    ],
    cta: 'Get Starter',
    highlight: false,
  },
  {
    name: 'Pro',
    price: '$24.99',
    period: '/month',
    description: 'For professional filmmakers',
    features: [
      'Access to 200+ pro assets',
      '4K video quality',
      'Commercial use license',
      'Priority support',
      'Early access to new assets',
    ],
    cta: 'Get Pro',
    highlight: true,
  },
  {
    name: 'Enterprise',
    price: '$79.99',
    period: '/month',
    description: 'For studios and agencies',
    features: [
      'Unlimited asset access',
      '8K video quality',
      'Full commercial license',
      'Dedicated support',
      'Custom asset requests',
      'Team collaboration',
    ],
    cta: 'Get Enterprise',
    highlight: false,
  },
]

const faqs = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes, you can cancel your subscription at any time. Your access continues until the end of your billing period.',
  },
  {
    q: 'What license do I get?',
    a: 'Starter includes personal use. Pro and Enterprise include commercial licensing for client work and monetized content.',
  },
  {
    q: 'Are assets truly AI-generated?',
    a: 'Yes, all assets are generated using cutting-edge AI video and image models, curated for cinematic quality.',
  },
]

export default function PricingPage() {
  return (
    <div className="py-16 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h1 className="text-5xl font-bold mb-4">Simple Pricing</h1>
          <p className="text-xl text-gray-400">Unlock premium AI cinematic assets for any budget</p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-6 mb-20">
          {plans.map(plan => (
            <div
              key={plan.name}
              className={`card p-8 flex flex-col ${plan.highlight ? 'border-[#E8B84B] ring-1 ring-[#E8B84B]' : ''}`}
            >
              {plan.highlight && (
                <span className="badge bg-[#E8B84B] text-black mb-4 self-start">Most Popular</span>
              )}
              <h2 className="text-2xl font-bold mb-1">{plan.name}</h2>
              <p className="text-gray-400 text-sm mb-4">{plan.description}</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-[#E8B84B]">{plan.price}</span>
                <span className="text-gray-400">{plan.period}</span>
              </div>
              <ul className="space-y-2 mb-8 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-[#E8B84B] mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="#"
                className={`text-center py-3 px-6 rounded-lg font-semibold transition-colors ${
                  plan.highlight
                    ? 'bg-[#E8B84B] text-black hover:bg-[#d4a43d]'
                    : 'border border-[#E8B84B] text-[#E8B84B] hover:bg-[#E8B84B] hover:text-black'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8">FAQ</h2>
          <div className="space-y-4">
            {faqs.map(faq => (
              <div key={faq.q} className="card p-6">
                <h3 className="font-semibold mb-2">{faq.q}</h3>
                <p className="text-gray-400 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
