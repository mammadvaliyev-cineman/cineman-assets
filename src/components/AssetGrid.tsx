'use client'

import { useState } from 'react'
import { Asset } from '@/lib/mock-data'

// ── Type config ──────────────────────────────────────────────
const TYPE_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  Location:          { bg: 'rgba(151,101,224,0.75)', color: '#EEE8FF', icon: '📍' },
  Character:         { bg: 'rgba(206,149,251,0.75)', color: '#1a0a2e', icon: '🎭' },
  photo:             { bg: 'rgba(83,79,165,0.7)',    color: '#EEE8FF', icon: '📷' },
  video:             { bg: 'rgba(54,0,156,0.75)',    color: '#CE95FB', icon: '▶'  },
  'Video Clip':      { bg: 'rgba(54,0,156,0.75)',    color: '#CE95FB', icon: '▶'  },
  LUT:               { bg: 'rgba(0,194,186,0.7)',    color: '#EEE8FF', icon: '🎨' },
  'Sound Design':    { bg: 'rgba(151,101,224,0.7)',  color: '#EEE8FF', icon: '🔊' },
  'Motion Graphics': { bg: 'rgba(83,79,165,0.7)',    color: '#EEE8FF', icon: '✨' },
}

// ── Download tracking (localStorage, resets daily) ───────────
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

        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>
          Limit reached
        </h2>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
          You&apos;ve used your <strong style={{ color: '#CE95FB' }}>{FREE_LIMIT} free downloads</strong> for today.
          Subscribe to download more assets.
        </p>

        {/* Plans */}
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
          style={{
            background: 'linear-gradient(135deg, #9765E0, #534FA5)',
            boxShadow: '0 0 20px rgba(151,101,224,0.4)',
          }}
        >
          View Plans →
        </a>
        <p className="text-xs mt-3" style={{ color: 'var(--fg-subtle)' }}>Cancel anytime</p>
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

// ── Main ──────────────────────────────────────────────────────
export default function AssetGrid({ assets }: { assets: Asset[] }) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [freeUsed, setFreeUsed]       = useState<number>(() => getFreeDownloadsUsed())

  async function handleDownload(asset: Asset) {
    if (!asset.fileUrl) return

    const used = getFreeDownloadsUsed()
    if (used >= FREE_LIMIT) {
      setShowUpgrade(true)
      return
    }

    setDownloading(asset.id)
    try {
      const res  = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, filePath: asset.fileUrl }),
      })
      const json = await res.json()
      if (json.url) {
        const newCount = incrementFreeDownloads()
        setFreeUsed(newCount)
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

  if (assets.length === 0) return <EmptyState />

  return (
    <>
      {/* Free counter */}
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {assets.map(asset => {
          const typeStyle    = TYPE_STYLE[asset.type] ?? TYPE_STYLE['photo']
          const isDownloading = downloading === asset.id

          return (
            <div key={asset.id} className="card group cursor-pointer flex flex-col">
              {/* Thumbnail — always 16:9 horizontal */}
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
                    <span style={{
                      fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em',
                      color: 'rgba(255,255,255,0.55)', userSelect: 'none', textTransform: 'uppercase',
                    }}>
                      cineman.ai
                    </span>
                  </div>
                )}

                {/* Type badge only — no plan badge */}
                <span
                  className="absolute top-2 left-2 badge text-xs font-semibold"
                  style={{ backgroundColor: typeStyle.bg, color: typeStyle.color, backdropFilter: 'blur(6px)' }}
                >
                  {typeStyle.icon} {asset.type}
                </span>

                {/* Hover download */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-3"
                  style={{ background: 'linear-gradient(to top, rgba(8,5,15,0.85) 0%, transparent 60%)' }}
                >
                  {asset.fileUrl && (
                    <button
                      onClick={e => { e.stopPropagation(); handleDownload(asset) }}
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
                <h3 className="font-semibold mb-1 truncate text-sm" style={{ color: 'var(--fg)' }}>
                  {asset.title}
                </h3>
                <p className="text-xs mb-3" style={{ color: 'var(--fg-muted)' }}>
                  {asset.category}
                </p>
                {asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-auto">
                    {asset.tags.slice(0, 3).map(tag => (
                      <span
                        key={tag}
                        className="text-xs rounded px-2 py-0.5"
                        style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-subtle)' }}
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </>
  )
}
