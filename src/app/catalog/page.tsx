'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { Asset } from '@/lib/mock-data'
import { CATEGORIES } from '@/config/categories'
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

// ── Thin line icon (lucide-style, multi-path via |) ──────────
function LineIcon({ d, size = 15 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}
const CAT_ICONS: Record<string, string> = {
  grid: 'M3 3h7v7H3z|M14 3h7v7h-7z|M14 14h7v7h-7z|M3 14h7v7H3z',
  heart: 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  sliders: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M2 14h4|M10 8h4|M18 16h4',
  Character: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  People: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  Animal: 'M12 13c-2.8 0-5 2-5 4.5 0 1.4 1.1 2.5 2.5 2.5h5c1.4 0 2.5-1.1 2.5-2.5 0-2.5-2.2-4.5-5-4.5z|M6 9.5a1.8 2.2 0 1 0 0-.01|M18 9.5a1.8 2.2 0 1 0 0-.01|M9.2 5.5a1.8 2.2 0 1 0 0-.01|M14.8 5.5a1.8 2.2 0 1 0 0-.01',
  Robot: 'M6 8h12a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z|M12 8V4|M9 13h.01|M15 13h.01|M2 12v3|M22 12v3',
  Location: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z|M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  Vehicle: 'M19 17h2v-4l-2-5H5l-2 5v4h2|M6.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z|M14.5 17a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z|M5 13h14',
  Architecture: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18|M2 22h20|M10 7h1|M13 7h1|M10 11h1|M13 11h1|M10 15h1|M13 15h1',
  Nature: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z|M2 21c0-3 1.85-5.36 5.08-6',
  Creature: 'M12 5c-4.4 0-7 3.1-7 7 0 2.9 1.9 4.9 4 6l1 3h4l1-3c2.1-1.1 4-3.1 4-6 0-3.9-2.6-7-7-7z|M9.5 11.5h.01|M14.5 11.5h.01',
  Fantasy: 'M12 3l1.9 5.8L19.7 11l-5.8 1.9L12 18.7l-1.9-5.8L4.3 11l5.8-2.2L12 3z|M19 3v4|M17 5h4',
  'Sci-Fi': 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z|M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z|M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0|M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  Prop: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z|M3.3 7l8.7 5 8.7-5|M12 22V12',
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
  iconD, label, count, active, color, onClick,
}: { iconD?: string; label: string; count?: number; active: boolean; color?: string; onClick: () => void }) {
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
      {iconD && <span style={{ color: active ? (color ?? '#9765E0') : 'var(--fg-subtle)', display: 'flex' }}><LineIcon d={iconD} /></span>}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {count !== undefined && count > 0 && (
        <span style={{ fontSize: 11, color: 'var(--fg-subtle)', flexShrink: 0 }}>{count.toLocaleString()}</span>
      )}
    </button>
  )
}

// Small on-the-fly resized thumbnail via Supabase image transform —
// ~28KB vs the full ~310KB web image, so the 2000-card grid loads fast.
// resize=contain is REQUIRED: without it Supabase CROPS a 440px-wide
// vertical strip out of wide sheets instead of scaling them down
// (proven: 1400x781 original → 440x781 crop vs 440x245 contain).
function thumbUrl(url: string): string {
  if (!url || !url.includes('/storage/v1/object/public/')) return url
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=440&quality=62&resize=contain'
}

// Display label → tag value for animal classes and robot types
const CLASS_MAP: Record<string, string> = {
  'Pets': 'pets', 'Predators': 'predators', 'Wild Mammals': 'wild-mammals',
  'Birds': 'birds', 'Fish & Sea': 'fish-sea', 'Insects': 'insects', 'Reptiles': 'reptiles',
}
const STYLE_MAP: Record<string, string> = {
  'Realistic': 'realistic', 'Cartoon': 'cartoon', 'Anime': 'anime', '3D': '3d',
}
const RTYPE_MAP: Record<string, string> = {
  'Humanoid': 'humanoid', 'Android': 'android', 'Mech': 'mech', 'Endoskeleton': 'endoskeleton',
}

function toAsset(a: Record<string, unknown>): Asset {
  return {
    id: String(a.id),
    title: String(a.title ?? ''),
    type: (a.type as Asset['type']) ?? 'photo',
    category: String(a.category ?? ''),
    url: String(a.file_url ?? ''),
    // Catalog sells the full turnaround sheet — show the original,
    // face-crop thumbnails are for Studio cards only
    thumbnail: thumbUrl(String(a.file_url ?? a.thumbnail_url ?? '')),
    plan: (a.plan as Asset['plan']) ?? 'starter',
    tags: Array.isArray(a.tags) ? a.tags : [],
    fileUrl: String(a.file_url ?? ''),
    creditCost: a.credit_cost == null ? undefined : Number(a.credit_cost),
    exclusivePrice: a.exclusive_price == null ? undefined : Number(a.exclusive_price),
    priceTier: String(a.price_tier ?? 'standard'),
    resolution: String(a.resolution ?? '2K'),
    exclusiveOwner: a.exclusive_owner ? String(a.exclusive_owner) : null,
    exclusiveSoldAt: a.exclusive_sold_at ? String(a.exclusive_sold_at) : null,
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
  const PER_PAGE = 100
  const [page, setPage] = useState(1)
  const [search, setSearch]           = useState('')
  const [activeCat, setActiveCat]     = useState('All')   // CATEGORIES[].id or 'All'
  const [activeType, setActiveType]   = useState('All')   // Asset type filter
  // Vehicle-specific filters (tag-based: brand:/color:)
  const [activeBrand, setActiveBrand] = useState('All')
  const [activeColor, setActiveColor] = useState('All')
  // Animal/Robot sub-filters (tag-based: class:/rtype:)
  const [activeClass, setActiveClass] = useState('All')
  const [activeRType, setActiveRType] = useState('All')
  // Character-specific filters (tag-based)
  const [activeGender, setActiveGender] = useState('All')
  const [activeAge, setActiveAge] = useState('All')
  const [activeEthnicity, setActiveEthnicity] = useState('All')
  // Location-specific filters
  const [activeSetting, setActiveSetting] = useState('All')
  const [activeTime, setActiveTime] = useState('All')
  const [activeEra, setActiveEra] = useState('All')
  // Subcategory filter (contextual for any selected type)
  const [activeSubcat, setActiveSubcat] = useState('All')
  // Style is orthogonal to sections (cartoon People, cartoon Locations…):
  // a style: tag, NOT a category. No tag = realistic (no backfill needed).
  const [activeStyle, setActiveStyle] = useState('All')

  // Human-only filters (Gender/Age/Ethnicity) make sense only for people —
  // not for Animals / Aliens / Creatures / Monsters / Robots
  const isPeopleSubcat = activeSubcat === 'All' || activeSubcat.toLowerCase().startsWith('people')

  // Switching main section resets every contextual filter — otherwise a
  // stale "Man + Kids + White" carries into Animals and shows 0 results
  useEffect(() => {
    setActiveGender('All'); setActiveAge('All'); setActiveEthnicity('All')
    setActiveSetting('All'); setActiveTime('All')
    setActiveBrand('All'); setActiveColor('All')
    setActiveClass('All'); setActiveRType('All')
    setActiveSubcat('All')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat, activeType])

  // Any subcategory switch resets the human filters — option sets differ
  // between subcats (Man/Woman vs Boy/Girl), stale values give 0 results
  useEffect(() => {
    setActiveGender('All'); setActiveAge('All'); setActiveEthnicity('All')
    setActiveClass('All'); setActiveRType('All')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSubcat])
  const [viewMode, setViewMode]       = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy]           = useState<'random' | 'recent' | 'oldest'>('random')
  const [previewSize, setPreviewSize] = useState(100)
  const [quickView, setQuickView]     = useState<'all' | 'fav' | 'dl'>('all')
  const [storeTick, setStoreTick]     = useState(0)

  // Favorites / download history live in localStorage (written by
  // the card buttons); re-read whenever they change
  useEffect(() => {
    const bump = () => setStoreTick(t => t + 1)
    window.addEventListener('cineman-store-changed', bump)
    return () => window.removeEventListener('cineman-store-changed', bump)
  }, [])

  const favIds = useMemo(() => {
    void storeTick
    try { return new Set<string>(JSON.parse(localStorage.getItem('cineman_favs') ?? '[]')) } catch { return new Set<string>() }
  }, [storeTick])
  const dlIds = useMemo(() => {
    void storeTick
    try { return new Set<string>(JSON.parse(localStorage.getItem('cineman_dl_ids') ?? '[]')) } catch { return new Set<string>() }
  }, [storeTick])

  useEffect(() => {
    async function load() {
      setLoading(true)
      // Paginate: Supabase caps a single query at 1000 rows. With 2000+
      // assets that silently hid half the base (e.g. all Characters).
      const PAGE = 1000
      const all: Record<string, unknown>[] = []
      for (let from = 0; from < 50000; from += PAGE) {
        const { data, error } = await supabase.from('assets').select('*')
          .neq('type', 'Config').neq('type', 'Generation').neq('type', 'Usage')
          .eq('is_public', true) // hidden assets never reach the public catalog
          .order('created_at', { ascending: sortBy === 'oldest' })
          .range(from, from + PAGE - 1)
        if (error || !data) break
        all.push(...(data as Record<string, unknown>[]))
        if (data.length < PAGE) break
      }
      // Pricing: NULL credit_cost = "follows tier default" — resolve the
      // effective price once here so every card/button shows a real number
      const { data: pd } = await supabase.from('pricing_defaults').select('tier, credits')
      const tierPrice: Record<string, number> = {}
      for (const r of pd || []) tierPrice[String(r.tier)] = Number(r.credits)
      let mapped = all.map(toAsset).map(a => ({
        ...a,
        creditCost: a.creditCost ?? tierPrice[a.priceTier || 'standard'] ?? 5,
        exclusivePrice: a.exclusivePrice ?? tierPrice['exclusive'] ?? 50,
      }))
      // Random is the default: similar shoots land next to each other by
      // created_at, shuffling makes every category feel diverse.
      // Categories are NOT mixed — filtering happens after ordering.
      if (sortBy === 'random') {
        for (let i = mapped.length - 1; i > 0; i--) {
          const k = Math.floor(Math.random() * (i + 1))
          ;[mapped[i], mapped[k]] = [mapped[k], mapped[i]]
        }
      }
      setAssets(mapped)
      setLoading(false)
    }
    load()
  }, [sortBy])

  const types = useMemo(() => ['All', ...Array.from(new Set(assets.map(a => a.type))).filter(Boolean).sort()], [assets])
  // Subcategories come from the ACTUAL loaded assets (not a hardcoded
  // config) so the filter values always match a.category exactly.
  const charSubcats = useMemo(() => ['All', ...Array.from(new Set(assets.filter(a => String(a.type) === 'Character').map(a => a.category).filter(Boolean))).sort()], [assets])
  const locSubcats  = useMemo(() => ['All', ...Array.from(new Set(assets.filter(a => String(a.type) === 'Location').map(a => a.category).filter(Boolean))).sort()], [assets])
  const vehSubcats  = useMemo(() => ['All', ...Array.from(new Set(assets.filter(a => String(a.type) === 'Vehicle').map(a => a.category).filter(Boolean))).sort()], [assets])
  // Brand/Color options come from the ACTUAL prefix tags (brand:/color:)
  const vehBrands = useMemo(() => {
    const set = new Set<string>()
    for (const a of assets) {
      if (String(a.type) !== 'Vehicle') continue
      for (const t of a.tags) if (t.startsWith('brand:')) set.add(t.slice(6))
    }
    return ['All', ...Array.from(set).sort()]
  }, [assets])
  const vehColors = useMemo(() => {
    const set = new Set<string>()
    for (const a of assets) {
      if (String(a.type) !== 'Vehicle') continue
      for (const t of a.tags) if (t.startsWith('color:')) set.add(t.slice(6))
    }
    return ['All', ...Array.from(set).sort()]
  }, [assets])
  // Class/Type options: show only labels that exist in the data
  const animalClasses = useMemo(() => {
    const present = new Set<string>()
    for (const a of assets) for (const t of a.tags) if (String(t).startsWith('class:')) present.add(String(t).slice(6))
    return ['All', ...Object.keys(CLASS_MAP).filter(label => present.has(CLASS_MAP[label]))]
  }, [assets])
  const robotTypes = useMemo(() => {
    const present = new Set<string>()
    for (const a of assets) for (const t of a.tags) if (String(t).startsWith('rtype:')) present.add(String(t).slice(6))
    return ['All', ...Object.keys(RTYPE_MAP).filter(label => present.has(RTYPE_MAP[label]))]
  }, [assets])
  // Style chip appears only when styled assets actually exist —
  // a one-option "Realistic" chip is noise
  const styleOptions = useMemo(() => {
    const present = new Set<string>()
    for (const a of assets) for (const t of a.tags) if (String(t).toLowerCase().startsWith('style:')) present.add(String(t).toLowerCase().slice(6))
    const extra = Object.keys(STYLE_MAP).filter(l => l !== 'Realistic' && present.has(STYLE_MAP[l]))
    return extra.length > 0 ? ['All', 'Realistic', ...extra] : ['All']
  }, [assets])
  const subcatsForType = useMemo(() => {
    const m: Record<string, string[]> = {}
    for (const a of assets) {
      const t = String(a.type), c = a.category
      if (!t || !c) continue
      ;(m[t] ||= []).push(c)
    }
    const out: Record<string, string[]> = {}
    for (const t in m) out[t] = Array.from(new Set(m[t])).sort()
    return out
  }, [assets])

  const filtered = useMemo(() => {
    return assets.filter(a => {
      if (quickView === 'fav' && !favIds.has(a.id)) return false
      if (quickView === 'dl' && !dlIds.has(a.id)) return false
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.tags.some(t => t.toLowerCase().includes(q))
      // Sidebar category ₒ filters by a.type (main category)
      const matchCat = activeCat === 'All' || a.type === activeCat
      const matchType = activeType === 'All' || a.type === activeType
      const tagsLower = a.tags.map(t => t.toLowerCase())
      // Vehicle filters — exact prefix-tag match (brand:bmw / color:dark-blue)
      const matchBrand = activeBrand === 'All' || tagsLower.includes(`brand:${activeBrand.toLowerCase()}`)
      const matchColor = activeColor === 'All' || tagsLower.includes(`color:${activeColor.toLowerCase()}`)
      // Human filters match the STRUCTURAL prefix tags (g:/age:/eth:) —
      // present on ~100% of people. Plain-word matching missed 95% of them.
      const GENDER_MAP: Record<string, string> = { 'Man': 'g:man', 'Woman': 'g:woman', 'Boy': 'g:man', 'Girl': 'g:woman' }
      const AGE_MAP: Record<string, string[]> = {
        'Kids': ['age:child', 'age:teen'],
        'Child': ['age:child'],
        'Teen': ['age:teen'],
        'Young': ['age:young'],
        'Middle-aged': ['age:adult'],
        'Elderly': ['age:senior'],
      }
      const ETH_MAP: Record<string, string> = {
        'White': 'eth:white', 'Black': 'eth:black', 'East Asian': 'eth:asian',
        'South Asian': 'eth:south-asian', 'Latino': 'eth:latino', 'Middle Eastern': 'eth:mena', 'Mixed': 'eth:mixed',
      }
      const matchGender = activeGender === 'All' || tagsLower.includes(GENDER_MAP[activeGender] || '')
      const matchAge = activeAge === 'All' || (AGE_MAP[activeAge] || []).some(x => tagsLower.includes(x))
      const matchEthnicity = activeEthnicity === 'All' || tagsLower.includes(ETH_MAP[activeEthnicity] || '')
      // Animal class / Robot type — exact prefix-tag match
      // Style: absence of a style: tag means realistic (default)
      const hasStyleTag = tagsLower.some(t => t.startsWith('style:'))
      const matchStyle = activeStyle === 'All'
        || (activeStyle === 'Realistic'
          ? (!hasStyleTag || tagsLower.includes('style:realistic'))
          : tagsLower.includes(`style:${STYLE_MAP[activeStyle] || ''}`))
      const matchClass = activeClass === 'All' || tagsLower.includes(`class:${CLASS_MAP[activeClass] || ''}`)
      const matchRType = activeRType === 'All' || tagsLower.includes(`rtype:${RTYPE_MAP[activeRType] || ''}`)
      // Location filters: prefix tags first (place:/time:), word fallback
      // for the ~half of locations that predate the structural pass
      const SETTING_MAP: Record<string, string[]> = {
        'Interior': ['interior', 'indoor', 'indoors', 'room'],
        'Exterior': ['exterior', 'outdoor', 'outdoors', 'street', 'aerial', 'landscape'],
      }
      const TIME_MAP: Record<string, string[]> = {
        'Dawn': ['dawn', 'sunrise', 'morning'],
        'Day': ['day', 'daylight', 'midday', 'afternoon'],
        'Golden Hour': ['golden hour', 'sunset', 'dusk'],
        'Night': ['night', 'midnight', 'neon', 'evening'],
      }
      const TIME_TAG: Record<string, string> = { 'Dawn': 'time:dawn', 'Day': 'time:day', 'Golden Hour': 'time:golden', 'Night': 'time:night' }
      const blob = (tagsLower.join(' ') + ' ' + a.category.toLowerCase() + ' ' + a.title.toLowerCase())
      const matchSetting = activeSetting === 'All'
        || tagsLower.includes(activeSetting === 'Interior' ? 'place:interior' : 'place:exterior')
        || (SETTING_MAP[activeSetting] || []).some(x => blob.includes(x))
      const matchTime = activeTime === 'All'
        || tagsLower.includes(TIME_TAG[activeTime] || '')
        || (TIME_MAP[activeTime] || []).some(x => blob.includes(x))
      // Era: era: tags first (retag route), keyword fallback for stragglers
      const ERA_TAG: Record<string, string> = { 'Vintage': 'era:vintage', 'Medieval': 'era:medieval', 'Modern': 'era:modern', 'Post-apocalyptic': 'era:post-apoc', 'Sci-fi': 'era:scifi' }
      const ERA_WORDS: Record<string, string[]> = {
        'Vintage': ['vintage', 'retro', 'classic'],
        'Medieval': ['medieval', 'village', 'castle'],
        'Modern': ['modern', 'tech', 'glass', 'brutalist'],
        'Post-apocalyptic': ['ruined', 'ruins', 'warzone', 'wasteland', 'abandoned'],
        'Sci-fi': ['scifi', 'sci-fi', 'spaceship', 'mars', 'cyberpunk', 'futuristic'],
      }
      const matchEra = activeEra === 'All'
        || tagsLower.includes(ERA_TAG[activeEra] || '')
        || (ERA_WORDS[activeEra] || []).some(x => blob.includes(x))
      const matchSubcat = activeSubcat === 'All' || a.category.toLowerCase() === activeSubcat.toLowerCase()
      return matchSearch && matchCat && matchType && matchBrand && matchColor && matchClass && matchRType && matchGender && matchAge && matchEthnicity && matchSetting && matchTime && matchEra && matchSubcat && matchStyle
    })
  }, [assets, search, activeCat, activeType, activeBrand, activeColor, activeClass, activeRType, activeGender, activeAge, activeEthnicity, activeSetting, activeTime, activeEra, activeSubcat, activeStyle, quickView, favIds, dlIds])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  useEffect(() => { setPage(1) }, [search, activeCat, activeType, activeSubcat, activeBrand, activeColor, activeGender, activeAge, activeEthnicity, activeSetting, activeTime, activeEra, activeStyle, quickView])

  const hasFilters = activeEra !== 'All' || activeStyle !== 'All' || activeCat !== 'All' || activeType !== 'All' || activeBrand !== 'All' || activeColor !== 'All' || activeGender !== 'All' || activeAge !== 'All' || activeEthnicity !== 'All' || activeSetting !== 'All' || activeTime !== 'All' || activeSubcat !== 'All' || search !== ''
  const activeFilterCount = [activeCat !== 'All', activeType !== 'All', activeBrand !== 'All', activeColor !== 'All'].filter(Boolean).length

  function clearAll() {
    setActiveType('All'); setSearch('')
    setActiveBrand('All'); setActiveColor('All')
    setActiveGender('All'); setActiveAge('All'); setActiveEthnicity('All')
    setActiveSetting('All'); setActiveTime('All'); setActiveSubcat('All')
    setActiveStyle('All'); setActiveEra('All')
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
          <SidebarItem iconD={CAT_ICONS.grid} label="All Assets" count={assets.length} active={quickView === 'all' && activeCat === 'All' && !search} color="#9765E0" onClick={() => { setQuickView('all'); setActiveCat('All'); setSearch('') }} />
          {/* spec C1: one Library entry point — the separate Downloads view
              is gone (it lives in Library → Purchased); hearts became Saved */}
          <SidebarItem iconD={CAT_ICONS.heart} label="Saved" count={favIds.size} active={quickView === 'fav'} color="#CE95FB" onClick={() => setQuickView(quickView === 'fav' ? 'all' : 'fav')} />
        </div>

        {/* Categories */}
        <div style={{ paddingTop: 6, flex: 1 }}>
          <p style={{ padding: '4px 16px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--fg-subtle)', textTransform: 'uppercase' }}>
            Categories
          </p>
          <SidebarItem iconD={CAT_ICONS.grid} label="All Categories" active={activeCat === 'All'} color="#9765E0" onClick={() => setActiveCat('All')} />
          {CATEGORIES.filter(cat => assets.some(a => String(a.type) === cat.id) || activeCat === cat.id).map(cat => (
            <div key={cat.id}>
              <SidebarItem
                iconD={CAT_ICONS[cat.id] ?? CAT_ICONS.grid}
                label={cat.label}
                active={activeCat === cat.id && activeSubcat === 'All'}
                color={cat.color}
                onClick={() => { setActiveCat(cat.id); setActiveSubcat('All') }}
              />
              {activeCat === cat.id && (subcatsForType[cat.id] || []).length > 0 && (
                <div style={{ marginLeft: 20, borderLeft: '1px solid var(--border)', paddingLeft: 6, marginBottom: 4 }}>
                  {(subcatsForType[cat.id] || []).map(sub => (
                    <button
                      key={sub}
                      onClick={() => { setActiveCat(cat.id); setActiveSubcat(activeSubcat === sub ? 'All' : sub) }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '5px 12px', fontSize: 12.5, borderRadius: 6, cursor: 'pointer',
                        color: activeSubcat === sub ? 'var(--fg)' : 'var(--fg-muted)',
                        background: activeSubcat === sub ? 'rgba(151,101,224,0.14)' : 'transparent',
                        fontWeight: activeSubcat === sub ? 600 : 400,
                        border: 'none',
                      }}
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            <span style={{ display: 'flex', color: 'var(--fg-subtle)' }}><LineIcon d={CAT_ICONS.sliders} size={14} /></span>
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
              <span style={{ display: 'flex', color: activeCatObj.color }}><LineIcon d={CAT_ICONS[activeCatObj.id] ?? CAT_ICONS.grid} size={22} /></span>
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
            {styleOptions.length > 2 && (
              <FilterChip label="Style" value={activeStyle} options={styleOptions} onChange={setActiveStyle} />
            )}
            {(() => {
              // Contextual filters: one Category chip per section + filters
              // that make sense for THAT section only
              const curType = activeCat !== 'All' ? activeCat : (activeType !== 'All' ? activeType : '')
              if (!curType) return null
              const curSubcats = ['All', ...(subcatsForType[curType] || [])]
              return (
                <>
                  {/* People: NO Category chip — Men/Women/Kids duplicated the
                      Gender/Age tags (Women vs Woman bug). One concept = one
                      dimension: chips come from tag prefixes only. */}
                  {curSubcats.length > 2 && curType !== 'People' && (
                    <FilterChip label="Category" value={activeSubcat} options={curSubcats} onChange={setActiveSubcat} />
                  )}
                  {curType === 'People' && (
                    <>
                      <FilterChip label="Gender"    value={activeGender}    options={['All', 'Man', 'Woman']} onChange={setActiveGender} />
                      <FilterChip label="Age"       value={activeAge}       options={['All', 'Kids', 'Young', 'Middle-aged', 'Elderly']} onChange={setActiveAge} />
                      <FilterChip label="Ethnicity" value={activeEthnicity} options={['All', 'White', 'Black', 'East Asian', 'South Asian', 'Latino', 'Middle Eastern', 'Mixed']} onChange={setActiveEthnicity} />
                    </>
                  )}
                  {curType === 'Location' && (
                    <>
                      <FilterChip label="Setting" value={activeSetting} options={['All', 'Interior', 'Exterior']} onChange={setActiveSetting} />
                      <FilterChip label="Time"    value={activeTime}    options={['All', 'Dawn', 'Day', 'Golden Hour', 'Night']} onChange={setActiveTime} />
                      <FilterChip label="Era"     value={activeEra}     options={['All', 'Modern', 'Vintage', 'Medieval', 'Post-apocalyptic', 'Sci-fi']} onChange={setActiveEra} />
                    </>
                  )}
                  {curType === 'Vehicle' && (
                    <>
                      {vehBrands.length > 2 && <FilterChip label="Brand" value={activeBrand} options={vehBrands} onChange={setActiveBrand} />}
                      {vehColors.length > 2 && <FilterChip label="Color" value={activeColor} options={vehColors} onChange={setActiveColor} />}
                    </>
                  )}
                </>
              )
            })()}
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
            {viewMode === 'grid' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>Preview Size</span>
                <input
                  type="range"
                  className="cine-range"
                  min={60}
                  max={160}
                  step={10}
                  value={previewSize}
                  onChange={e => setPreviewSize(Number(e.target.value))}
                  style={{ width: 130 }}
                />
                <span style={{ fontSize: 12, color: '#a78bfa', width: 38, fontWeight: 600 }}>{previewSize}%</span>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as 'random' | 'recent' | 'oldest')}
                style={{
                  appearance: 'none', WebkitAppearance: 'none',
                  backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '6px 28px 6px 12px', fontSize: 13,
                  color: 'var(--fg-muted)', cursor: 'pointer',
                }}
              >
                <option value="random">Sort by: Random</option>
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
        {loading ? <Skeleton /> : <AssetGrid assets={paged} viewMode={viewMode} previewSize={previewSize} />}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 32, flexWrap: 'wrap' }}>
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={page === 1}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: page === 1 ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: page === 1 ? 'var(--fg-subtle)' : 'var(--fg)', opacity: page === 1 ? 0.5 : 1 }}
            >‹ Prev</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === totalPages || Math.abs(n - page) <= 2)
              .reduce<(number | string)[]>((acc, n, i, arr) => { if (i > 0 && n - (arr[i - 1] as number) > 1) acc.push('…'); acc.push(n); return acc }, [])
              .map((n, i) => typeof n === 'string'
                ? <span key={'e' + i} style={{ color: 'var(--fg-subtle)', padding: '0 4px' }}>…</span>
                : <button key={n} onClick={() => { setPage(n); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                    style={{ minWidth: 36, padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: '1px solid ' + (n === page ? '#9765E0' : 'var(--border)'), background: n === page ? 'linear-gradient(135deg,#9765E0,#534FA5)' : 'var(--bg-subtle)', color: n === page ? '#fff' : 'var(--fg)', fontWeight: n === page ? 600 : 400 }}
                  >{n}</button>)}
            <button
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={page === totalPages}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: page === totalPages ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: page === totalPages ? 'var(--fg-subtle)' : 'var(--fg)', opacity: page === totalPages ? 0.5 : 1 }}
            >Next ›</button>
          </div>
        )}
      </main>
    </div>
  )
}
