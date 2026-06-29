import Link from 'next/link'
import AssetGrid from '@/components/AssetGrid'
import { featuredAssets } from '@/lib/mock-data'

export default function HomePage() {
  return (
    <div>
      <section className="relative py-24 px-6 text-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#E8B84B]/5 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto relative">
          <span className="badge bg-[#E8B84B]/10 text-[#E8B84B] border border-[#E8B84B]/20 mb-4 inline-block">
            AI-Powered Cinema
          </span>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Cinematic Assets<br />
            <span className="text-[#E8B84B]">Powered by AI</span>
          </h1>
          <p className="text-xl text-gray-400 mb-10 max-w-2xl mx-auto">
            Premium AI-generated video clips, LUTs, and cinematic assets for filmmakers and content creators.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link href="/catalog" className="btn-primary">Browse Catalog</Link>
            <Link href="/pricing" className="btn-secondary">View Pricing</Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-3xl font-bold">Featured Assets</h2>
            <Link href="/catalog" className="text-[#E8B84B] hover:underline text-sm font-medium">
              View all →
            </Link>
          </div>
          <AssetGrid assets={featuredAssets} />
        </div>
      </section>

      <section className="py-20 px-6 text-center">
        <div className="max-w-2xl mx-auto card p-12">
          <h2 className="text-3xl font-bold mb-4">Start Creating Today</h2>
          <p className="text-gray-400 mb-8">
            Join filmmakers and creators using Cineman Assets to elevate their productions.
          </p>
          <Link href="/pricing" className="btn-primary">Get Started</Link>
        </div>
      </section>
    </div>
  )
}
