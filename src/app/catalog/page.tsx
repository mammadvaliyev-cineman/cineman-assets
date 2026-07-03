'use client'

import { useState, useEffect, useMemo } from 'react'
import AssetGrid from '@/components/AssetGrid'
import { supabase } from '@/lib/supabase'
import { Asset } from '@/lib/mock-data'

function SearchIcon() {
  return (
    <svg
      width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
      style={{ color: 'var(--fg-subtle)' }}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function toAsset(a: Record<string, unknown>): Asset {
  return {
    id: String(a.id),
    title: String(a.title ?? ''),
    type: (a.type as Asset['type']) ?? 'photo',
    category: String(a.category ?? ''),
    url: String(a.file_url ?? ''),
    thumbnail: String(a.thumbnail_url ?? ''),
    plan: (a.plan as Asset['plan']) ?? 'starter',
    tags: Array.isArray(a.tags) ? a.tags : [],
    fileUrl: String(a.file_url ?? ''),
  }
}

export default function CatalogPage() {
  const [assets, setAssets]           = useState<Asset[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [activeType, setActiveType]   = useState('All')
  const [activeCat, setActiveCat]     = useState('All')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false })
      if (data && !error) setAssets(data.map(toAsset))
      setLoading(false)
    }
    load()
  }, [])

  const types      = useMemo(() => ['All', ...Array.from(new Set(assets.map(a => a.type))).filter(Boolean).sort()], [assets])
  const categories = useMemo(() => ['All', ...Array.from(new Set(assets.map(a => a.category))).filter(Boolean).sort()], [assets])

  const filtered = useMemo(() => {
    return assets.filter(a => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      const matchType = activeType === 'All' || a.type === activeType
      const matchCat  = activeCat  === 'All' || a.category === activeCat
      return matchSearch && matchType && matchCat
    })
  }, [assets, search, activeType, activeCat])

  const hasFilters = activeType !== 'All' || activeCat !== 'All' || search !== ''

  function clearFilters() {
    setActiveType('All')
    setActiveCat('All')
    setSearch('')
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--fg)' }}>
          Asset{' '}
          <span style={{ background: 'linear-gradient(135deg, #9765E0, #00C2BA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Catalog
          </span>
        </h1>
        <p style={{ color: 'var(--fg-muted)' }}>
          {loading ? 'Loading…' : `${assets.length} AI-generated cinematic assets`}
        </p>
      </div>

      {/* Search + Filters — single row */}
      <div className="flex gap-3 items-center mb-8 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon />
          <input
            type="text"
            placeholder="Search by title, category, tag…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field pl-10 w-full"
          />
        </div>

        {/* Type dropdown */}
        {!loading && types.length > 2 && (
          <div className="relative">
            <select
              value={activeType}
              onChange={e => { setActiveType(e.target.value); setActiveCat('All') }}
              className="input-field text-sm pr-8 appearance-none cursor-pointer"
              style={{ minWidth: 120, paddingRight: 28 }}
            >
              {types.map(t => (
                <option key={t} value={t}>{t === 'All' ? 'All types' : t}</option>
              ))}
            </select>
            <ChevronIcon />
          </div>
        )}

        {/* Category dropdown */}
        {!loading && categories.length > 2 && (
          <div className="relative">
            <select
              value={activeCat}
              onChange={e => setActiveCat(e.target.value)}
              className="input-field text-sm pr-8 appearance-none cursor-pointer"
              style={{ minWidth: 140, paddingRight: 28 }}
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All categories' : c}</option>
              ))}
            </select>
            <ChevronIcon />
          </div>
        )}

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="text-xs px-3 py-2 rounded-lg transition-all"
            style={{ color: '#9765E0', backgroundColor: 'rgba(151,101,224,0.1)', whiteSpace: 'nowrap' }}
          >
            Clear ×
          </button>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-sm mb-6" style={{ color: 'var(--fg-subtle)' }}>
          {filtered.length} {filtered.length === 1 ? 'asset' : 'assets'} found
        </p>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl overflow-hidden animate-pulse"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            >
              <div className="aspect-video" style={{ backgroundColor: 'var(--bg-subtle)' }} />
              <div className="p-4 space-y-2">
                <div className="h-4 rounded" style={{ backgroundColor: 'var(--bg-subtle)', width: '70%' }} />
                <div className="h-3 rounded" style={{ backgroundColor: 'var(--bg-subtle)', width: '45%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Grid */}
      {!loading && <AssetGrid assets={filtered} />}
    </div>
  )
}
