'use client'

import { useState, useEffect, useMemo } from 'react'
import AssetGrid from '@/components/AssetGrid'
import { supabase } from '@/lib/supabase'
import { Asset } from '@/lib/mock-data'

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--fg-subtle)' }}>
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )
}

function toAsset(a: Record<string, unknown>): Asset {
  const id = String(a.id)
  return {
    id,
    title: String(a.title ?? ''),
    type: (a.type as Asset['type']) ?? 'photo',
    category: String(a.category ?? ''),
    url: `/api/image/${id}`,
    thumbnail: `/api/image/${id}`,
    plan: (a.plan as Asset['plan']) ?? 'starter',
    tags: Array.isArray(a.tags) ? a.tags : [],
    fileUrl: id, // pass only ID — download route resolves URL server-side
  }
}

export default function CatalogPage() {
  const [assets, setAssets]     = useState<Asset[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [activeType, setActiveType]   = useState('All')
  const [activeCat, setActiveCat]     = useState('All')
  const [activePlan, setActivePlan]   = useState('All')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('assets').select('id, title, type, category, plan, tags, created_at').order('created_at', { ascending: false })
      if (data && !error) setAssets(data.map(toAsset))
      setLoading(false)
    }
    load()
  }, [])

  // Derive filters from real data
  const types      = useMemo(() => ['All', ...Array.from(new Set(assets.map(a => a.type))).filter(Boolean).sort()], [assets])
  const categories = useMemo(() => ['All', ...Array.from(new Set(assets.map(a => a.category))).filter(Boolean).sort()], [assets])
  const plans      = ['All', 'starter', 'pro', 'enterprise']

  const filtered = useMemo(() => assets.filter(a => {
    const q = search.toLowerCase()
    return (
      (!q || a.title.toLowerCase().includes(q) || a.category.toLowerCase().includes(q) || a.tags.some(t => t.toLowerCase().includes(q))) &&
      (activeType === 'All' || a.type === activeType) &&
      (activeCat  === 'All' || a.category === activeCat) &&
      (activePlan === 'All' || a.plan === activePlan)
    )
  }), [assets, search, activeType, activeCat, activePlan])

  function FilterRow({ label, options, active, onChange }: { label: string; options: string[]; active: string; onChange: (v: string) => void }) {
    if (options.length <= 1) return null
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--fg-subtle)', minWidth: 64 }}>{label}</span>
        <div className="flex gap-2 flex-wrap">
          {options.map(opt => (
            <button key={opt} onClick={() => onChange(opt)} className={`filter-btn ${active === opt ? 'active' : ''}`}>{opt}</button>
          ))}
        </div>
      </div>
    )
  }

  const hasFilters = activeType !== 'All' || activeCat !== 'All' || activePlan !== 'All' || search

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--fg)' }}>
          Asset{' '}
          <span style={{ background: 'linear-gradient(135deg, #9765E0, #00C2BA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Catalog
          </span>
        </h1>
        <p style={{ color: 'var(--fg-muted)' }}>
          {loading ? 'Loading assets…' : `${assets.length} AI-generated cinematic assets`}
        </p>
      </div>

      <div className="relative mb-6">
        <SearchIcon />
        <input type="text" placeholder="Search by title, category, tag…" value={search}
          onChange={e => setSearch(e.target.value)} className="input-field pl-10" />
      </div>

      {!loading && assets.length > 0 && (
        <div className="flex flex-col gap-3 mb-8 p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <FilterRow label="Type"     options={types}      active={activeType}  onChange={v => { setActiveType(v); setActiveCat('All') }} />
          <FilterRow label="Category" options={categories} active={activeCat}   onChange={setActiveCat} />
          <FilterRow label="Plan"     options={plans}      active={activePlan}  onChange={setActivePlan} />
        </div>
      )}

      {!loading && (
        <p className="text-sm mb-6" style={{ color: 'var(--fg-subtle)' }}>
          {filtered.length} {filtered.length === 1 ? 'asset' : 'assets'} found
          {hasFilters && (
            <button onClick={() => { setActiveType('All'); setActiveCat('All'); setActivePlan('All'); setSearch('') }}
              className="ml-3 text-xs underline" style={{ color: '#9765E0' }}>
              Clear filters
            </button>
          )}
        </p>
      )}

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="aspect-video" style={{ backgroundColor: 'var(--bg-subtle)' }} />
              <div className="p-4 space-y-2">
                <div className="h-4 rounded" style={{ backgroundColor: 'var(--bg-subtle)', width: '70%' }} />
                <div className="h-3 rounded" style={{ backgroundColor: 'var(--bg-subtle)', width: '45%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && <AssetGrid assets={filtered} />}
    </div>
  )
}
