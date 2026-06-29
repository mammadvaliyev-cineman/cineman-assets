'use client'

import { useState, useEffect } from 'react'
import AssetGrid from '@/components/AssetGrid'
import { supabase } from '@/lib/supabase'
import { Asset } from '@/lib/mock-data'

const categories = ['All', 'Aerial', 'Street', 'Nature', 'Abstract', 'Architecture', 'Action']
const types = ['All', 'Video Clip', 'LUT', 'Sound Design', 'Motion Graphics']
const plans = ['All', 'Starter', 'Pro', 'Enterprise']

export default function CatalogPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [type, setType] = useState('All')
  const [plan, setPlan] = useState('All')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
      if (data && !error) {
        setAssets(data.map((a: Record<string, unknown>) => ({
          id: String(a.id),
          title: String(a.title),
          type: a.type as Asset['type'],
          category: String(a.category),
          plan: a.plan as Asset['plan'],
          thumbnailUrl: String(a.thumbnail_url || ''),
          fileUrl: String(a.file_url || ''),
          tags: Array.isArray(a.tags) ? a.tags : [],
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = assets.filter(asset => {
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
        <p className="text-gray-400 mb-8">Browse premium AI-generated cinematic assets</p>
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
        {loading ? (
          <p className="text-gray-400">Loading assets...</p>
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-6">{filtered.length} assets found</p>
            <AssetGrid assets={filtered} />
          </>
        )}
      </div>
    </div>
  )
}
