'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Asset } from '@/lib/mock-data'
import { CATEGORIES } from '@/config/categories'
import AssetGrid from '@/components/AssetGrid'
import MySpace from '@/components/MySpace'
import { useAuth } from '@/components/AuthProvider'
import { isAdminEmail } from '@/components/AdminGate'

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
  bookmark: 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z',
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
  // skull — Zombies top-level section (owner's spec)
  Zombie: 'M12 2a8 8 0 0 0-8 8c0 2.5 1.15 4.7 2.95 6.2V19a2 2 0 0 0 2 2h6.1a2 2 0 0 0 2-2v-2.8A8.06 8.06 0 0 0 20 10a8 8 0 0 0-8-8z|M9 11h.01|M15 11h.01|M10 17v1.5|M14 17v1.5',
  Fantasy: 'M12 3l1.9 5.8L19.7 11l-5.8 1.9L12 18.7l-1.9-5.8L4.3 11l5.8-2.2L12 3z|M19 3v4|M17 5h4',
  'Sci-Fi': 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z|M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z|M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0|M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
  Prop: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z|M3.3 7l8.7 5 8.7-5|M12 22V12',
  // small anchors for the filter pills + Free section
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 6v6l4 2',
  globe: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M2 12h20|M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  droplet: 'M12 2.7l5.7 5.6a8 8 0 1 1-11.4 0z',
  sort: 'M11 5h10|M11 9h7|M11 13h4|M3 17l3 3 3-3|M6 6v14',
  hourglass: 'M6 2h12|M6 22h12|M8 2v4l4 4 4-4V2|M8 22v-4l4-4 4 4v4',
  shuffle: 'M16 3h5v5|M4 20L21 3|M21 16v5h-5|M15 15l6 6|M4 4l5 5',
  flame: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
  diamond: 'M6 3h12l4 6-10 12L2 9l4-6z|M2 9h20',
  arrowDown: 'M12 5v14|M19 12l-7 7-7-7',
  arrowUp: 'M12 19V5|M5 12l7-7 7 7',
}

// ── Filter chip (select dropdown styled as pill) ──────────────
// ── Custom filter popover (DEV_batch_60 §1): NO native <select> anywhere.
// Graphite panel, uppercase group header, rounded rows, violet highlight
// + check on the selected item, keyboard (arrows/Enter/Esc), outside click.
// Items are SHORT (no «Style: …» prefix) — the header names the group once.
const CHECK_D = 'M20 6L9 17l-5-5'
type MenuOpt = { value: string; label: string; iconD?: string; iconColor?: string }

function FilterPopover({
  label, value, options, onChange, iconD, pillPrefix = true, resettable = true,
}: {
  label: string; value: string; options: MenuOpt[]; onChange: (v: string) => void
  iconD?: string; pillPrefix?: boolean; resettable?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  const active = resettable && value !== 'All'
  const current = options.find(o => o.value === value)
  const pillText = active ? `${pillPrefix ? label + ': ' : ''}${current?.label ?? value}` : (pillPrefix ? label : (current?.label ?? label))
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!open) { setOpen(true); setHi(0); return }
      setHi(h => (h + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
    } else if (e.key === 'Enter' && open && hi >= 0) {
      e.preventDefault(); onChange(options[hi].value); setOpen(false)
    }
  }
  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        onClick={() => setOpen(o => !o)}
        onKeyDown={onKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
          backgroundColor: active ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'var(--bg-subtle)',
          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 999, padding: `6px ${active ? 28 : 26}px 6px ${iconD ? 11 : 12}px`,
          fontSize: 13, color: active ? 'var(--accent)' : 'var(--fg-muted)',
          fontWeight: active ? 600 : 400, lineHeight: 1.4, position: 'relative',
          transition: 'border-color .15s ease, background-color .15s ease',
        }}
      >
        {iconD && <span style={{ display: 'flex', color: active ? 'var(--accent)' : 'var(--fg-subtle)' }}><LineIcon d={iconD} size={12} /></span>}
        {pillText}
        {active ? (
          <span
            role="button"
            onClick={e => { e.stopPropagation(); onChange('All'); setOpen(false) }}
            title={`Reset ${label}`}
            style={{
              position: 'absolute', right: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 16, height: 16, borderRadius: 999,
              backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)', color: '#EDE4FF', fontSize: 11, fontWeight: 700, lineHeight: 1,
            }}
          >
            ×
          </span>
        ) : (
          <span style={{ position: 'absolute', right: 9, pointerEvents: 'none', color: 'var(--fg-subtle)' }}><ChevronDown /></span>
        )}
      </button>
      {open && (
        <div
          role="listbox"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, minWidth: 200, zIndex: 60,
            backgroundColor: '#17151E', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12, padding: 6, boxShadow: '0 18px 48px rgba(0,0,0,0.55)',
          }}
        >
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--fg-subtle)', padding: '4px 10px 6px', margin: 0 }}>
            {label}
          </p>
          {options.map((o, i) => (
            <button
              key={o.value}
              role="option"
              aria-selected={value === o.value}
              onClick={() => { onChange(o.value); setOpen(false) }}
              onMouseEnter={() => setHi(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 8, fontSize: 13, border: 'none', cursor: 'pointer',
                backgroundColor: value === o.value ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : (hi === i ? 'rgba(255,255,255,0.05)' : 'transparent'),
                color: value === o.value ? 'var(--accent-soft)' : 'var(--fg)',
                fontWeight: value === o.value ? 600 : 400,
                transition: 'background-color .12s ease',
              }}
            >
              {o.iconD && <span style={{ display: 'flex', color: o.iconColor ?? (value === o.value ? 'var(--accent-soft)' : 'var(--fg-subtle)') }}><LineIcon d={o.iconD} size={13} /></span>}
              <span style={{ flex: 1 }}>{o.label}</span>
              {value === o.value && <span style={{ display: 'flex', color: 'var(--accent-soft)' }}><LineIcon d={CHECK_D} size={13} /></span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// same props as the old chip — call sites stay tiny
function FilterChip({
  label, value, options, onChange, iconD,
}: { label: string; value: string; options: string[]; onChange: (v: string) => void; iconD?: string }) {
  return (
    <FilterPopover
      label={label}
      value={value}
      options={options.map(o => ({ value: o, label: o }))}
      onChange={onChange}
      iconD={iconD}
    />
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
        backgroundColor: active ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
        fontWeight: active ? 600 : 400,
        borderLeft: active ? `3px solid ${color ?? 'var(--accent)'}` : '3px solid transparent',
      }}
    >
      {iconD && <span style={{ color: active ? (color ?? 'var(--accent)') : 'var(--fg-subtle)', display: 'flex' }}><LineIcon d={iconD} /></span>}
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
    isFree: Boolean(a.is_free),
    downloadCount: Number(a.download_count ?? 0),
    exclusivePrice: a.exclusive_price == null ? undefined : Number(a.exclusive_price),
    priceTier: String(a.price_tier ?? 'standard'),
    resolution: String(a.resolution ?? '2K'),
    exclusiveOwner: a.exclusive_owner ? String(a.exclusive_owner) : null,
    exclusiveSoldAt: a.exclusive_sold_at ? String(a.exclusive_sold_at) : null,
  }
}

// DEV_shelf_style §3: never 4+ grey studio sheets in a row (random sort
// only — explicit sorts keep their exact order). Colored frames (Location/
// Creature/Robot) break every run of three greys so the grid breathes.
const GREY_TYPES = new Set(['People', 'Animal', 'Zombie', 'Vehicle', 'Character'])
function breakGreyWalls<T extends { type: string }>(rows: T[]): T[] {
  const out = [...rows]
  let run = 0
  for (let i = 0; i < out.length; i++) {
    if (!GREY_TYPES.has(String(out[i].type))) { run = 0; continue }
    run++
    if (run >= 3) {
      const j = out.findIndex((r, k) => k > i && !GREY_TYPES.has(String(r.type)))
      if (j === -1) break
      const [colored] = out.splice(j, 1)
      out.splice(i, 0, colored)
      run = 0
    }
  }
  return out
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
  // Grid only (owner's spec): the list view is gone from the catalog
  const viewMode = 'grid' as const
  const [sortBy, setSortBy]           = useState<'random' | 'newest' | 'downloads' | '4k' | 'price-desc' | 'price-asc'>('random')
  // discrete preview steps — remembered across visits (DEV_batch_60 §2)
  const [previewSize, setPreviewSize] = useState(100)
  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem('cineman_preview'))
      if (Number.isFinite(saved) && saved >= 60 && saved <= 170) setPreviewSize(saved)
    } catch { /* noop */ }
  }, [])
  const [quickView, setQuickView]     = useState<'all' | 'fav' | 'dl' | 'downloads' | 'saved'>('all')
  // FREE section (lead funnel): sidebar entry that shows only is_free assets
  const [activeFree, setActiveFree]   = useState(false)
  // deep links: ?view=downloads|saved (старый /library), ?category=<id>
  // (homepage tiles), ?free=1 (Free picks «See all»)
  useEffect(() => {
    try {
      const p = new URLSearchParams(window.location.search)
      const v = p.get('view')
      if (v === 'downloads' || v === 'saved') setQuickView(v)
      const cat = p.get('category')
      if (cat && CATEGORIES.some(c => c.id === cat)) setActiveCat(cat)
      if (p.get('free') === '1') setActiveFree(true)
      // hero search deep-link (DEV_homepage_search): same engine as the
      // in-catalog search — title / category / tags
      const q = p.get('q')
      if (q) setSearch(q.slice(0, 80))
    } catch { /* noop */ }
  }, [])
  const [storeTick, setStoreTick]     = useState(0)

  // Favorites / download history live in localStorage (written by
  // the card buttons); re-read whenever they change
  useEffect(() => {
    const bump = () => setStoreTick(t => t + 1)
    window.addEventListener('cineman-store-changed', bump)
    return () => window.removeEventListener('cineman-store-changed', bump)
  }, [])

  // My downloads counter — separate PAGE links in the sidebar (owner's layout)
  const { user } = useAuth()
  // Catalog-size counters are ADMIN-ONLY (DEV_batch_60 §4) — and
  // isAdminEmail is false in «View as client», so they hide there too
  const isAdmin = isAdminEmail(user?.email)
  const [purchasedCount, setPurchasedCount] = useState(0)
  useEffect(() => {
    if (!user) { setPurchasedCount(0); return }
    supabase.from('purchases').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('hidden', false)
      .then(({ count }) => setPurchasedCount(count ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

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
          .order('created_at', { ascending: false })
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
        // break the «grey wall» of studio sheets (DEV_shelf_style §3)
        mapped = breakGreyWalls(mapped)
      } else if (sortBy === 'downloads') {
        mapped = [...mapped].sort((x, y) => (y.downloadCount ?? 0) - (x.downloadCount ?? 0))
      } else if (sortBy === '4k') {
        mapped = [...mapped].sort((x, y) => Number(y.resolution === '4K') - Number(x.resolution === '4K'))
      } else if (sortBy === 'price-desc' || sortBy === 'price-asc') {
        // EFFECTIVE price: Free assets count as 0 (their credit_cost may
        // still hold a number), so they sink to the bottom on high → low
        // and float to the top on low → high. Ties (the bulk of the
        // catalog shares one tier price) break by exclusive price, then
        // downloads — the order visibly changes and stays deterministic.
        const eff = (a: { isFree?: boolean; creditCost?: number }) => (a.isFree ? 0 : (a.creditCost ?? 0))
        const dir = sortBy === 'price-asc' ? 1 : -1
        mapped = [...mapped].sort((x, y) =>
          dir * (eff(x) - eff(y)) ||
          dir * ((x.exclusivePrice ?? 50) - (y.exclusivePrice ?? 50)) ||
          (y.downloadCount ?? 0) - (x.downloadCount ?? 0))
      }
      // 'newest' = the created_at desc order straight from the query
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
      if (activeFree && !a.isFree) return false
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
  }, [assets, search, activeCat, activeType, activeBrand, activeColor, activeClass, activeRType, activeGender, activeAge, activeEthnicity, activeSetting, activeTime, activeEra, activeSubcat, activeStyle, quickView, favIds, dlIds, activeFree])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  useEffect(() => { setPage(1) }, [search, activeCat, activeType, activeSubcat, activeBrand, activeColor, activeGender, activeAge, activeEthnicity, activeSetting, activeTime, activeEra, activeStyle, quickView, activeFree])

  const hasFilters = activeEra !== 'All' || activeStyle !== 'All' || activeCat !== 'All' || activeType !== 'All' || activeBrand !== 'All' || activeColor !== 'All' || activeGender !== 'All' || activeAge !== 'All' || activeEthnicity !== 'All' || activeSetting !== 'All' || activeTime !== 'All' || activeSubcat !== 'All' || search !== '' || activeFree
  const activeFilterCount = [activeCat !== 'All', activeType !== 'All', activeBrand !== 'All', activeColor !== 'All'].filter(Boolean).length

  function clearAll() {
    setActiveType('All'); setSearch('')
    setActiveBrand('All'); setActiveColor('All')
    setActiveGender('All'); setActiveAge('All'); setActiveEthnicity('All')
    setActiveSetting('All'); setActiveTime('All'); setActiveSubcat('All')
    setActiveStyle('All'); setActiveEra('All'); setActiveFree(false)
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

        {/* My space — SEPARATE PAGES (Library tabs), not catalog filters:
            they navigate away and can never stick across categories */}
        <div style={{ paddingTop: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
          <SidebarItem iconD={CAT_ICONS.download} label="My downloads" count={isAdmin ? purchasedCount : undefined} active={quickView === 'downloads'} color="#00C2BA" onClick={() => { setQuickView('downloads'); setActiveCat('All'); setSearch('') }} />
          <SidebarItem iconD={CAT_ICONS.bookmark} label="Saved" count={isAdmin ? favIds.size : undefined} active={quickView === 'saved'} color="var(--accent-soft)" onClick={() => { setQuickView('saved'); setActiveCat('All'); setSearch('') }} />
        </div>

        {/* Categories — All assets first, then the sections */}
        <div style={{ paddingTop: 6, flex: 1 }}>
          <p style={{ padding: '4px 16px 6px', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'var(--fg-subtle)', textTransform: 'uppercase' }}>
            Categories
          </p>
          <SidebarItem iconD={CAT_ICONS.grid} label="All assets" count={isAdmin ? assets.length : undefined} active={quickView === 'all' && activeCat === 'All' && !search && !activeFree} color="var(--accent)" onClick={() => { setQuickView('all'); setActiveCat('All'); setSearch(''); setActiveFree(false) }} />
          {CATEGORIES.filter(cat => assets.some(a => String(a.type) === cat.id) || activeCat === cat.id).map(cat => (
            <div key={cat.id}>
              <SidebarItem
                iconD={CAT_ICONS[cat.id] ?? CAT_ICONS.grid}
                label={cat.label}
                active={activeCat === cat.id && activeSubcat === 'All'}
                color={cat.color}
                onClick={() => { setQuickView('all'); setActiveCat(cat.id); setActiveSubcat('All'); setActiveFree(false) }}
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
                        background: activeSubcat === sub ? 'color-mix(in srgb, var(--accent) 14%, transparent)' : 'transparent',
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

      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main style={{ flex: 1, overflowY: 'auto', padding: '28px 36px' }}>

        {/* MY SPACE (spec A1): «My downloads» / «Saved» swap the main area
            only — the sidebar stays, exactly like switching a category */}
        {(quickView === 'downloads' || quickView === 'saved') ? (
          <>
            <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'flex', color: quickView === 'downloads' ? '#00C2BA' : 'var(--accent-soft)' }}>
                <LineIcon d={quickView === 'downloads' ? CAT_ICONS.download : CAT_ICONS.bookmark} size={22} />
              </span>
              {quickView === 'downloads' ? 'My downloads' : 'Saved'}
            </h1>
            <MySpace view={quickView} onSavedChanged={() => setStoreTick(t => t + 1)} />
          </>
        ) : (
        <>
        {/* Title */}
        <h1 style={{ fontSize: 26, fontWeight: 700, marginBottom: 20, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: 10 }}>
          {activeFree ? (
            <>
              <span style={{ display: 'flex', color: '#2DD4C4' }}><LineIcon d={CAT_ICONS.bolt} size={22} /></span>
              <span>Free assets</span>
            </>
          ) : activeCatObj ? (
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
              <FilterChip label="Asset Type" value={activeType} options={types} onChange={setActiveType} iconD={CAT_ICONS.grid} />
            )}
            {/* FREE — a filter chip, not a sidebar section (DEV_batch_60 §3) */}
            {(assets.some(a => a.isFree) || activeFree) && (
              <button
                onClick={() => setActiveFree(v => !v)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  backgroundColor: activeFree ? 'rgba(45,212,196,0.15)' : 'var(--bg-subtle)',
                  border: `1px solid ${activeFree ? '#2DD4C4' : 'var(--border)'}`,
                  borderRadius: 999, padding: '6px 14px', fontSize: 13, cursor: 'pointer',
                  color: activeFree ? '#2DD4C4' : 'var(--fg-muted)', fontWeight: activeFree ? 600 : 400,
                  transition: 'border-color .15s ease, background-color .15s ease',
                }}
              >
                <LineIcon d={CAT_ICONS.bolt} size={12} /> Free
              </button>
            )}
            {styleOptions.length > 2 && (
              <FilterChip label="Style" value={activeStyle} options={styleOptions} onChange={setActiveStyle} iconD={CAT_ICONS.Fantasy} />
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
                    <FilterChip label="Category" value={activeSubcat} options={curSubcats} onChange={setActiveSubcat} iconD={CAT_ICONS.sliders} />
                  )}
                  {curType === 'People' && (
                    <>
                      <FilterChip label="Gender"    value={activeGender}    options={['All', 'Man', 'Woman']} onChange={setActiveGender} iconD={CAT_ICONS.People} />
                      <FilterChip label="Age"       value={activeAge}       options={['All', 'Kids', 'Young', 'Middle-aged', 'Elderly']} onChange={setActiveAge} iconD={CAT_ICONS.clock} />
                      <FilterChip label="Ethnicity" value={activeEthnicity} options={['All', 'White', 'Black', 'East Asian', 'South Asian', 'Latino', 'Middle Eastern', 'Mixed']} onChange={setActiveEthnicity} iconD={CAT_ICONS.globe} />
                    </>
                  )}
                  {curType === 'Location' && (
                    <>
                      <FilterChip label="Setting" value={activeSetting} options={['All', 'Interior', 'Exterior']} onChange={setActiveSetting} iconD={CAT_ICONS.Location} />
                      <FilterChip label="Time"    value={activeTime}    options={['All', 'Dawn', 'Day', 'Golden Hour', 'Night']} onChange={setActiveTime} iconD={CAT_ICONS.clock} />
                      <FilterChip label="Era"     value={activeEra}     options={['All', 'Modern', 'Vintage', 'Medieval', 'Post-apocalyptic', 'Sci-fi']} onChange={setActiveEra} iconD={CAT_ICONS.hourglass} />
                    </>
                  )}
                  {curType === 'Vehicle' && (
                    <>
                      {vehBrands.length > 2 && <FilterChip label="Brand" value={activeBrand} options={vehBrands} onChange={setActiveBrand} iconD={CAT_ICONS.Vehicle} />}
                      {vehColors.length > 2 && <FilterChip label="Color" value={activeColor} options={vehColors} onChange={setActiveColor} iconD={CAT_ICONS.droplet} />}
                    </>
                  )}
                </>
              )
            })()}
            {hasFilters && (
              <button
                onClick={clearAll}
                style={{ fontSize: 12.5, color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 4px' }}
              >
                Clear all
              </button>
            )}
          </div>

          {/* Sort + View toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
            {/* Preview size — SLIDER (owner's rework of §2): the value applies
                INSTANTLY (no easing on the cards) and is saved in localStorage */}
            {viewMode === 'grid' && (
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginRight: 6 }} title="Preview size">
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>Preview</span>
                <input
                  type="range" min={60} max={170} step={5} value={previewSize}
                  className="cine-range"
                  onChange={e => { const v = Number(e.target.value); setPreviewSize(v); try { localStorage.setItem('cineman_preview', String(v)) } catch { /* noop */ } }}
                  style={{ width: 110 }}
                />
              </label>
            )}
            {/* Sort — custom popover with icons (DEV_batch_60 §1) */}
            <FilterPopover
              label="Sort by"
              value={sortBy}
              onChange={v => setSortBy(v as typeof sortBy)}
              iconD={CAT_ICONS.sort}
              pillPrefix={false}
              resettable={false}
              options={[
                { value: 'random', label: 'Random', iconD: CAT_ICONS.shuffle },
                { value: 'newest', label: 'Newest', iconD: CAT_ICONS.Fantasy },
                { value: 'downloads', label: 'Most downloaded', iconD: CAT_ICONS.flame },
                { value: '4k', label: '4K first', iconD: CAT_ICONS.diamond },
                { value: 'price-desc', label: 'Price: high → low', iconD: CAT_ICONS.arrowDown },
                { value: 'price-asc', label: 'Price: low → high', iconD: CAT_ICONS.arrowUp },
              ]}
            />
            {/* Grid only — the list view was removed (owner's spec) */}
          </div>
        </div>

        {/* Count */}
        {!loading && isAdmin && (
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
                    style={{ minWidth: 36, padding: '8px 10px', borderRadius: 8, fontSize: 13, cursor: 'pointer', border: '1px solid ' + (n === page ? 'var(--accent)' : 'var(--border)'), background: n === page ? 'linear-gradient(135deg,var(--accent),var(--accent-strong))' : 'var(--bg-subtle)', color: n === page ? '#fff' : 'var(--fg)', fontWeight: n === page ? 600 : 400 }}
                  >{n}</button>)}
            <button
              onClick={() => { setPage(p => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
              disabled={page === totalPages}
              style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, cursor: page === totalPages ? 'default' : 'pointer', border: '1px solid var(--border)', background: 'var(--bg-subtle)', color: page === totalPages ? 'var(--fg-subtle)' : 'var(--fg)', opacity: page === totalPages ? 0.5 : 1 }}
            >Next ›</button>
          </div>
        )}
        </>
        )}
      </main>
    </div>
  )
}
