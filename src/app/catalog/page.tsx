'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Asset } from '@/lib/mock-data'
import { CATEGORIES, STYLES, MOODS, LIGHTING } from '@/config/categories'
import AssetGrid from '@/components/AssetGrid'

// ── Icons ────────────────────────────────────────────────────
function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )
}
function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  )
}
function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
  )
}
function ChevronDown() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none', flexShrink: 0 }}>
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  )
}

// ── Filter chip (select dropdown styled as pill) ──────────────
function FilterChip({
  label, value, options, onChange,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  const active = value !== 'All'
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          backgroundColor: active ? 'rgba(151,101,224,0.15)' : 'var(--bg-subtle)',
          border: `1px solid ${active ? '#9765E0' : 'var(--border)'}`,
          borderRadius: 8,
          padding: '6px 28px 6px 12px',
          fontSize: 13,
          color: active ? '#9765E0' : 'var(--fg-muted)',
          fontWeight: active ? 600 : 400,
          cursor: 'pointer',
          lineHeight: 1.4,
        }}
      >
        <option value="All">{label} ▾</option>
        {options.filter(o => o !== 'All').map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <span style={{ position: 'absolute', right: 8, pointerEvents: 'none', color: active ? '#9765E0' : 'var(--fg-subtle)' }}>
        <ChevronDown />
      </span>
    </div>
  )
}

// ── Sidebar item ─────────────────────────────────────────────
function SidebarItem({
  emoji, label, count, active, color, onClick,
}: { emoji?: string; label: string; count?: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-all"
      style={{
        color: active ? 'var(--fg)' : 'var(--fg-muted)',
        backgroundColor: active ? 'rgba(151,101,224,0.12)' : 'transparent',
        fontWeight: active ? 600 : 400,
        borderLeft: active ? `3px solid ${color ?? '#9765E0'}` : '3px solid transparent',
      }}
    >
      {emoji && <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{emoji}</span>}
      <span style={{ flex: 1, truncate: true, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: 11, color: 'var(--fg-subtle)', flexShrink: 0 }}>{count.toLocaleString()}</span>
      )}
    </button>
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

// ── Loading skeleton ─────────────────────────────────────────
function Skeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-xl overflow-hidden animate-pulse" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div style={{ aspectRatio: '16/9', backgroundColor: 'var(--bg-subtle)' }} />
          <div className="p-4 space-y-2">
            <div className="h-4 rounded" style={{ backgroundColor: 'var(--bg-subtle)', width: '70%' }} />
            <div className="h-3 rounded" style={{ backgroundColor: 'var(--bg-subtle)', width: '45%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main catalog page ────────────────────────────────────────
export default function CatalogPage() {
  const [assets, setAssets]           = useState<Asset[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [activeCat, setActiveCat]     = useState('All')   // CATEGORIES[].id or 'All'
  const [activeType, setActiveType]   = useState('All')   // Asset type filter
  const [activeStyle, setActiveStyle] = useState('All')
  const [activeMood, setActiveMood]   = useState('All')
  const [activeLighting, setActiveLighting] = useState('All')
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy]           = useState<'recent' | 'oldest'>('recent')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const q = supabase.from('assets').select('*')
      const { data, error } = await q.order('created_at', { ascending: sortBy === 'oldest' })
      if (data && !error) setAssets(data.map(toAsset))
      setLoading(false)
    }
    load()
  }, [sortBy])

  const types = useMemo(() => ['All', ...Array.from(new Set(assets.map(a => a.type))).filter(Boolean).sort()], [assets])

  const filtered = useMemo(() => {
    return assets.filter(a => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      // Sidebar category → filters by a.type (main category)
      const matchCat = activeCat === 'All' || a.type === activeCat
      const matchType = activeType === 'All' || a.type === activeType
      const matchStyle = activeStyle === 'All' || a.tags.some(t => t.toLowerCase().includes(activeStyle.toLowerCase()))
      const matchMood = activeMood === 'All' || a.tags.some(t => t.toLowerCase().includes(activeMood.toLowerCase()))
      const matchLighting = activeLighting === 'All' || a.tags.some(t => t.toLowerCase().includes(activeLighting.toLowerCase()))
      return matchSearch && matchCat && matchType && matchStyle && matchMood && matchLighting
    })
  }, [assets, search, activeCat, activeType, activeStyle, activeMood, activeLighting])

  const hasFilters = activeCat !== 'All' || activeType !== 'All' || activeStyle !== 'All' || activeMood !== 'All' || activeLighting !== 'All' || search !== ''
  const activeFilterCount = [activeCat !== 'All', activeType !== 'All', activeStyle !== 'All', activeMood !== 'All', activeLighting !== 'All'].filter(Boolean).length

  function clearAll() {
    setActiveCat('All'); setActiveType('All'); setActiveStyle('All')
    setActiveMood('All'); setActiveLighting('All'); setSearch('')
  }

  const activeCatObj = CATEGORIES.find(c => c.id === activeCat)

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 61px)', overflow: 'hidden' }}>

      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      <aside style={{
        width: 228,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        borderRight: '1px solid var(--border)',
        backgroundColor: 'var(--bg-card)',
      }}>
        {/* Sidebar search */}
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }}>
              <SearchIcon size={14} />
            </span>
            <input
              type="text"
              placeholder="Search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                paddingLeft: 30,
                paddingRight: 10,
                paddingTop: 7,
                paddingBottom: 7,
                fontSize: 13,
                backgroundColor: 'var(--bg-subtle)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--fg)',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Quick nav */}
        <div style={{ paddingTop: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          <SidebarItem emoji="⊞" label="All Assets" count={assets.length} active={activeCat === 'All' && !search} color="#9765E0" onClick={() => { setActiveCat('All'); setSearch('') }} />
          <SidebarItem emoji="♡" label="Favorites" active={false} color="#CE95FB" onClick={() => {}} />
          <SidebarItem emoji="↓" label="Downloads" active={false} color="#00C2BA" onClick={() => {}} />
        </div>

        {/* Categories */}
        <div style={{ paddingTop: 6, flex: 1 }}>
          <p style={{ padding: '4px 16px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--fg-subtle)', textTransform: 'uppercase' }}>
            Categories
          </p>
          <SidebarItem emoji="⊞" label="All Categories" active={activeCat === 'All'} color="#9765E0" onClick={() => setActiveCat('All')} />
          {CATEGORIES.map(cat => (
            <SidebarItem
              key={cat.id}
              emoji={cat.emoji}
              label={cat.label}
              active={activeCat === cat.id}
              color={cat.color}
              onClick={() => setActiveCat(cat.id)}
            />
          ))}
        </div>

        {/* Filters badge at bottom */}
        <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={clearAll}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              color: 'var(--fg-muted)',
              backgroundColor: 'var(--bg-subtle)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
            }}
          >
            <span>⚙</span>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span style={{ marginLeft: 'auto', backgroundColor: '#9765E0', color: 'white', fontSize: 10, fontWeight: 700, borderRadius: 9999, padding: '1px 7px' }}>
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>

        {/* Title */}
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeCatObj ? (
            <>
              <span>{activeCatObj.emoji}</span>
              <span>{activeCatObj.label}</span>
            </>
          ) : 'All Assets'}
        </h1>

        {/* Big search */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <span style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-subtle)', pointerEvents: 'none' }}>
            <SearchIcon size={18} />
          </span>
          <input
            type="text"
            placeholder='Search anything… (e.g., "cyberpunk city", "astronaut", "luxury office")'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-field"
            style={{ paddingLeft: 46, paddingRight: 72, width: '100%', fontSize: 14 }}
          />
          <span style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 11, color: 'var(--fg-subtle)', backgroundColor: 'var(--bg-subtle)',
            padding: '2px 7px', borderRadius: 5, border: '1px solid var(--border)',
          }}>
            Ctrl K
          </span>
        </div>

        {/* Filter chips row + Sort + View */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          {/* Chips */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {types.length > 2 && (
              <FilterChip label="Asset Type" value={activeType} options={types} onChange={setActiveType} />
            )}
            <FilterChip label="Style"    value={activeStyle}    options={['All', ...STYLES]}   onChange={setActiveStyle} />
            <FilterChip label="Lighting" value={activeLighting} options={['All', ...LIGHTING]}  onChange={setActiveLighting} />
            <FilterChip label="Mood"     value={activeMood}     options={['All', ...MOODS]}     onChange={setActiveMood} />
            {hasFilters && (
              <button
                onClick={clearAll}
                style={{ fontSize: 13, color: '#9765E0', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Sort + View toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'recent' | 'oldest')}
                style={{
                  appearance: 'none', WebkitAppearance: 'none',
                  backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '6px 28px 6px 12px', fontSize: 13,
                  color: 'var(--fg-muted)', cursor: 'pointer',
                }}
              >
                <option value="recent">Sort by: Recent</option>
                <option value="oldest">Sort by: Oldest</option>
              </select>
              <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--fg-subtle)' }}>
                <ChevronDown />
              </span>
            </div>
            <button
              onClick={() => setViewMode('grid')}
              title="Grid view"
              style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'grid' ? 'rgba(151,101,224,0.2)' : 'var(--bg-subtle)', color: viewMode === 'grid' ? '#9765E0' : 'var(--fg-muted)' }}
            >
              <GridIcon />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="List view"
              style={{ padding: 8, borderRadius: 8, border: 'none', cursor: 'pointer', backgroundColor: viewMode === 'list' ? 'rgba(151,101,224,0.2)' : 'var(--bg-subtle)', color: viewMode === 'list' ? '#9765E0' : 'var(--fg-muted)' }}
            >
              <ListIcon />
            </button>
          </div>
        </div>

        {/* Count */}
        {!loading && (
          <p style={{ fontSize: 13, color: 'var(--fg-subtle)', marginBottom: 20 }}>
            {filtered.length.toLocaleString()} assets found
          </p>
        )}

        {/* Content */}
        {loading ? <Skeleton /> : <AssetGrid assets={filtered} viewMode={viewMode} />}
      </main>
    </div>
  )
}
