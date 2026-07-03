'use client'

import { useState, useEffect } from 'react'
import { Asset } from '@/lib/mock-data'

// ── Type badge config ─────────────────────────────────────────
const TYPE_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  Location:          { bg: 'rgba(151,101,224,0.75)', color: '#EEE8FF', icon: '📍' },
  Character:         { bg: 'rgba(206,149,251,0.75)', color: '#1a0a2e', icon: '🎭' },
  Vehicle:           { bg: 'rgba(83,79,165,0.75)',   color: '#EEE8FF', icon: '🚗' },
  Architecture:      { bg: 'rgba(54,0,156,0.75)',    color: '#CE95FB', icon: '🏛'  },
  Nature:            { bg: 'rgba(0,194,100,0.7)',    color: '#EEE8FF', icon: '🌿' },
  Creature:          { bg: 'rgba(220,80,80,0.7)',    color: '#EEE8FF', icon: '🐉' },
  Fantasy:           { bg: 'rgba(206,149,251,0.75)', color: '#1a0a2e', icon: '✨' },
  'Sci-Fi':          { bg: 'rgba(0,194,186,0.7)',    color: '#EEE8FF', icon: '🚀' },
  Prop:              { bg: 'rgba(151,101,224,0.6)',   color: '#EEE8FF', icon: '📦' },
  photo:             { bg: 'rgba(83,79,165,0.7)',    color: '#EEE8FF', icon: '📷' },
  video:             { bg: 'rgba(54,0,156,0.75)',    color: '#CE95FB', icon: '▶'  },
  'Video Clip':      { bg: 'rgba(54,0,156,0.75)',    color: '#CE95FB', icon: '▶'  },
  LUT:               { bg: 'rgba(0,194,186,0.7)',    color: '#EEE8FF', icon: '🎨' },
  'Sound Design':    { bg: 'rgba(151,101,224,0.7)',  color: '#EEE8FF', icon: '🔊' },
  'Motion Graphics': { bg: 'rgba(83,79,165,0.7)',    color: '#EEE8FF', icon: '✨' },
}

// ── Download tracking (localStorage, resets daily) ────────────
const FREE_LIMIT = 3

function getTodayKey() { return new Date().toISOString().slice(0, 10) }

function getFreeDownloadsUsed(): number {
  try {
    const raw = localStorage.getItem('cineman_free_dl')
    if (!raw) return 0
    const { date, count } = JSON.parse(raw)
    if (date !== getTodayKey()) return 0
    return Number(count) || 0
  } catch { return 0 }
}

function incrementFreeDownloads(): number {
  const used = getFreeDownloadsUsed() + 1
  localStorage.setItem('cineman_free_dl', JSON.stringify({ date: getTodayKey(), count: used }))
  return used
}

// ── Favorites (localStorage, persisted) ──────────────────────
function getFavs(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem('cineman_favs') ?? '[]')) } catch { return new Set() }
}

function toggleFav(id: string): Set<string> {
  const favs = getFavs()
  if (favs.has(id)) favs.delete(id); else favs.add(id)
  localStorage.setItem('cineman_favs', JSON.stringify([...favs]))
  return new Set(favs)
}

// ── Icons ────────────────────────────────────────────────────
function DownloadIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? '#CE95FB' : 'none'} stroke={filled ? '#CE95FB' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  )
}

// ── Upgrade modal ─────────────────────────────────────────────
function UpgradeModal({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8,5,15,0.80)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-md w-full rounded-2xl p-8 text-center"
        style={{
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(151,101,224,0.08) 100%)',
          border: '1px solid rgba(151,101,224,0.35)',
          boxShadow: '0 0 60px rgba(151,101,224,0.25)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4" style={{ color: 'var(--fg-subtle)' }}>
          <CloseIcon />
        </button>

        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Limit reached</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
          You&apos;ve used your <strong style={{ color: '#CE95FB' }}>{FREE_LIMIT} free downloads</strong> for today.
          Subscribe to download more assets.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { name: 'Basic',  price: '$9.99',  color: '#CE95FB', downloads: '50 / mo'  },
            { name: 'Pro',    price: '$24.99', color: '#9765E0', downloads: '150 / mo' },
            { name: 'Ultra',  price: '$79.99', color: '#00C2BA', downloads: '500 / mo' },
          ].map(p => (
            <div
              key={p.name}
              className="rounded-xl p-3"
              style={{ backgroundColor: 'var(--bg-subtle)', border: `1px solid ${p.color}30` }}
            >
              <div className="font-bold text-base mb-0.5" style={{ color: p.color }}>{p.price}</div>
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--fg)' }}>{p.name}</div>
              <div className="text-xs" style={{ color: 'var(--fg-muted)' }}>{p.downloads}</div>
            </div>
          ))}
        </div>

        <a
          href="/pricing"
          className="block w-full py-3 rounded-xl font-bold text-sm text-white text-center"
          style={{ background: 'linear-gradient(135deg, #9765E0, #534FA5)', boxShadow: '0 0 20px rgba(151,101,224,0.4)' }}
        >
          View Plans →
        </a>
        <p className="text-xs mt-3" style={{ color: 'var(--fg-subtle)' }}>Cancel anytime. Resets monthly.</p>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="text-6xl mb-4">🎬</div>
      <p className="text-lg font-medium mb-2" style={{ color: 'var(--fg)' }}>No assets found</p>
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Try adjusting your filters or search query</p>
    </div>
  )
}

// ── Card component ────────────────────────────────────────────
function AssetCard({
  asset, isFav, isDownloading, onFav, onDownload, viewMode,
}: {
  asset: Asset
  isFav: boolean
  isDownloading: boolean
  onFav: () => void
  onDownload: () => void
  viewMode: 'grid' | 'list'
}) {
  const typeStyle = TYPE_STYLE[asset.type] ?? TYPE_STYLE['photo']

  if (viewMode === 'list') {
    return (
      <div
        className="flex items-center gap-4 rounded-xl px-4 py-3 transition-all"
        style={{
          backgroundColor: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        {/* Thumbnail small */}
        <div
          style={{ width: 100, flexShrink: 0, aspectRatio: '16/9', borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--bg-subtle)', position: 'relative' }}
        >
          {asset.thumbnail ? (
            <img src={asset.thumbnail} alt={asset.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
              {typeStyle.icon}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.title}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="badge" style={{ fontSize: 11, backgroundColor: typeStyle.bg, color: typeStyle.color }}>{typeStyle.icon} {asset.type}</span>
            {asset.category && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{asset.category}</span>}
            {asset.tags.slice(0, 3).map(t => (
              <span key={t} style={{ fontSize: 11, color: 'var(--fg-subtle)', backgroundColor: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: 4 }}>#{t}</span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={onFav}
            title={isFav ? 'Remove favorite' : 'Add to favorites'}
            style={{ padding: 6, borderRadius: 6, backgroundColor: isFav ? 'rgba(206,149,251,0.12)' : 'transparent', border: '1px solid var(--border)', color: isFav ? '#CE95FB' : 'var(--fg-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <HeartIcon filled={isFav} />
          </button>
          {asset.fileUrl && (
            <button
              onClick={onDownload}
              disabled={isDownloading}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                background: isDownloading ? 'rgba(151,101,224,0.4)' : 'linear-gradient(135deg,#9765E0,#534FA5)',
                color: 'white', cursor: isDownloading ? 'default' : 'pointer',
              }}
            >
              {isDownloading ? <SpinnerIcon /> : <DownloadIcon />}
              {isDownloading ? '…' : 'Download'}
            </button>
          )}
        </div>
      </div>
    )
  }

  // Grid card
  return (
    <div className="card group cursor-pointer flex flex-col" style={{ position: 'relative' }}>
      {/* Thumbnail — 16:9 */}
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9', backgroundColor: 'var(--bg-subtle)' }}>
        {asset.thumbnail ? (
          <img
            src={asset.thumbnail}
            alt={asset.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-3xl">
            {typeStyle.icon}
          </div>
        )}

        {/* Watermark */}
        {asset.thumbnail && (
          <div className="absolute inset-0 pointer-events-none flex items-end justify-center pb-2" style={{ zIndex: 2 }}>
            <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.45)', userSelect: 'none', textTransform: 'uppercase' }}>
              cineman.ai
            </span>
          </div>
        )}

        {/* Type badge (top-left) */}
        <span
          className="absolute top-2 left-2 badge text-xs font-semibold"
          style={{ backgroundColor: typeStyle.bg, color: typeStyle.color, backdropFilter: 'blur(6px)', zIndex: 3 }}
        >
          {typeStyle.icon} {asset.type}
        </span>

        {/* Heart button (top-right) */}
        <button
          onClick={e => { e.stopPropagation(); onFav() }}
          title={isFav ? 'Remove favorite' : 'Add to favorites'}
          className="absolute top-2 right-2 transition-all duration-200"
          style={{
            zIndex: 3,
            padding: 6,
            borderRadius: 7,
            border: 'none',
            cursor: 'pointer',
            backgroundColor: isFav ? 'rgba(206,149,251,0.25)' : 'rgba(0,0,0,0.4)',
            color: isFav ? '#CE95FB' : 'rgba(255,255,255,0.7)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isFav ? 1 : 0,
          }}
          // Show on hover via JS class
          onMouseEnter={e => { if (!isFav) (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
          onMouseLeave={e => { if (!isFav) (e.currentTarget as HTMLButtonElement).style.opacity = '0' }}
        >
          <HeartIcon filled={isFav} />
        </button>

        {/* Hover download overlay */}
        <div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3"
          style={{ background: 'linear-gradient(to top, rgba(8,5,15,0.85) 0%, transparent 60%)', zIndex: 2 }}
        >
          {asset.fileUrl && (
            <button
              onClick={e => { e.stopPropagation(); onDownload() }}
              disabled={isDownloading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                background: isDownloading ? 'rgba(151,101,224,0.5)' : 'linear-gradient(135deg,#9765E0,#534FA5)',
                color: 'white',
                boxShadow: '0 0 16px rgba(151,101,224,0.4)',
              }}
            >
              {isDownloading ? <SpinnerIcon /> : <DownloadIcon />}
              {isDownloading ? 'Generating link…' : 'Download'}
            </button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold mb-1 truncate text-sm" style={{ color: 'var(--fg)' }}>{asset.title}</h3>
        <p className="text-xs mb-3" style={{ color: 'var(--fg-muted)' }}>{asset.category}</p>
        {asset.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {asset.tags.slice(0, 3).map(tag => (
              <span key={tag} className="text-xs rounded px-2 py-0.5" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-subtle)' }}>
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────
export default function AssetGrid({
  assets,
  viewMode = 'grid',
}: {
  assets: Asset[]
  viewMode?: 'grid' | 'list'
}) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [freeUsed, setFreeUsed]       = useState<number>(() => getFreeDownloadsUsed())
  const [favs, setFavs]               = useState<Set<string>>(() => getFavs())

  // Re-sync from localStorage on mount (SSR-safe)
  useEffect(() => {
    setFavs(getFavs())
    setFreeUsed(getFreeDownloadsUsed())
  }, [])

  async function handleDownload(asset: Asset) {
    if (!asset.fileUrl) return
    const used = getFreeDownloadsUsed()
    if (used >= FREE_LIMIT) { setShowUpgrade(true); return }

    setDownloading(asset.id)
    try {
      const res  = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, filePath: asset.fileUrl }),
      })
      const json = await res.json()
      if (json.url) {
        setFreeUsed(incrementFreeDownloads())
        window.location.href = json.url
      } else {
        alert(json.error || 'Download failed')
      }
    } catch {
      alert('Download failed — please try again')
    } finally {
      setDownloading(null)
    }
  }

  function handleFav(id: string) { setFavs(toggleFav(id)) }

  if (assets.length === 0) return <EmptyState />

  return (
    <>
      {/* Free counter banner */}
      {freeUsed > 0 && freeUsed < FREE_LIMIT && (
        <div
          className="flex items-center justify-between px-4 py-2.5 rounded-xl mb-4 text-sm"
          style={{ backgroundColor: 'rgba(151,101,224,0.08)', border: '1px solid rgba(151,101,224,0.2)' }}
        >
          <span style={{ color: 'var(--fg-muted)' }}>
            Free downloads today:{' '}
            <strong style={{ color: '#9765E0' }}>{freeUsed} / {FREE_LIMIT}</strong>
          </span>
          <a href="/pricing" className="text-xs font-semibold" style={{ color: '#CE95FB' }}>Upgrade →</a>
        </div>
      )}

      {/* Grid or List */}
      {viewMode === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isFav={favs.has(asset.id)}
              isDownloading={downloading === asset.id}
              onFav={() => handleFav(asset.id)}
              onDownload={() => handleDownload(asset)}
              viewMode="list"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {assets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isFav={favs.has(asset.id)}
              isDownloading={downloading === asset.id}
              onFav={() => handleFav(asset.id)}
              onDownload={() => handleDownload(asset)}
              viewMode="grid"
            />
          ))}
        </div>
      )}

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </>
  )
}
