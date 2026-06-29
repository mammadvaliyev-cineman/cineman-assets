'use client'

import { useState } from 'react'
import AssetGrid from '@/components/AssetGrid'
import { allAssets } from '@/lib/mock-data'

const categories = ['All', 'Aerial', 'Street', 'Nature', 'Abstract', 'Architecture', 'Action']
const types = ['All', 'Video Clip', 'LUT', 'Sound Design', 'Motion Graphics']
const plans = ['All', 'Starter', 'Pro', 'Enterprise']

export default function CatalogPage() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [type, setType] = useState('All')
  const [plan, setPlan] = useState('All')

  const filtered = allAssets.filter(asset => {
    const matchSearch = asset.title.toLowerCase().includes(search.toLowerCase())
    const matchCategory = category === 'All' || asset.category === category
    const matchType = type === 'All' || asset.type === type
    const matchPlan = plan === 'All' || asset.plan === plan.toLowerCase()
    return matchSearch && matchCategory && matchType && matchPlan
  })

  return (
    <div className="py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-2">Asset Catalog</h1>
        <p className="text-gray-400 mb-8">Browse {allAssets.length} premium AI-generated assets</p>

        <div className="flex flex-wrap gap-4 mb-8">
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input flex-1 min-w-[200px]"
          />
          <select value={category} onChange={e => setCategory(e.target.value)} className="input">
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={type} onChange={e => setType(e.target.value)} className="input">
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={plan} onChange={e => setPlan(e.target.value)} className="input">
            {plans.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        <p className="text-sm text-gray-500 mb-6">{filtered.length} assets found</p>
        <AssetGrid assets={filtered} />
      </div>
    </div>
  )
}
