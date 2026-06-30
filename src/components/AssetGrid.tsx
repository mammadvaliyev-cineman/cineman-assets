'use client'

import { useState } from 'react'
import { Asset } from '@/lib/mock-data'

// ── Plan config ─────────────────────────────────────────────
const PLAN_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  starter:    { bg: 'rgba(83,79,165,0.25)',  color: '#CE95FB', label: 'Starter'    },
  pro:        { bg: 'rgba(0,194,186,0.20)',  color: '#00C2BA', label: 'Pro'        },
  enterprise: { bg: 'rgba(151,101,224,0.25)', color: '#9765E0', label: 'Enterprise' },
}

// ── Type config ─────────────────────────────────────────────
const TYPE_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  Location:         { bg: 'rgba(151,101,224,0.75)', color: '#EEE8FF', icon: '📍' },
  Character:        { bg: 'rgba(206,149,251,0.75)', color: '#1a0a2e', icon: '🎭' },
  photo:            { bg: 'rgba(83,79,165,0.7)',    color: '#EEE8FF', icon: '📷' },
  video:            { bg: 'rgba(54,0,156,0.75)',    color: '#CE95FB', icon: '▶'  },
  'Video Clip':     { bg: 'rgba(54,0,156,0.75)',    color: '#CE95FB', icon: '▶'  },
  LUT:              { bg: 'rgba(0,194,186,0.7)',    color: '#EEE8FF', icon: '🎨' },
  'Sound Design':   { bg: 'rgba(151,101,224,0.7)',  color: '#EEE8FF', icon: '🔊' },
  'Motion Graphics':{ bg: 'rgba(83,79,165,0.7)',    color: '#EEE8FF', icon: '✨' },
}

// ── Icons ──────────────────────────────────────────────────
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

// ── Empty state ────────────────────────────────────────────
function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="text-6xl mb-4">🎬</div>
      <p className="text-lg font-medium mb-2" style={{ color: 'var(--fg)' }}>No assets found</p>
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Try adjusting your filters or search query</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────
export default function AssetGrid({ assets }: { assets: Asset[] }) {
  const [downloading, setDownloading] = useState<string | null>(null)

  async function handleDownload(asset: Asset) {
    if (!asset.fileUrl) return
    setDownloading(asset.id)
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId: asset.id, filePath: asset.fileUrl }),
      })
      const json = await res.json()
      if (json.url) {
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {assets.map(asset => {
        const typeStyle = TYPE_STYLE[asset.type] ?? TYPE_STYLE['photo']
        const planStyle = PLAN_STYLE[asset.plan] ?? PLAN_STYLE['starter']
        const isDownloading = downloading === asset.id

        return (
          <div key={asset.id} className="card group cursor-pointer flex flex-col">
            {/* Thumbnail */}
            <div className="relative aspect-video overflow-hidden" style={{ backgroundColor: 'var(--bg-subtle)' }}>
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

              {/* Type badge */}
              <span
                className="absolute top-2 left-2 badge text-xs font-semibold"
                style={{ backgroundColor: typeStyle.bg, color: typeStyle.color, backdropFilter: 'blur(6px)' }}
              >
                {typeStyle.icon} {asset.type}
              </span>

              {/* Plan badge */}
              <span
                className="absolute top-2 right-2 badge text-xs font-medium"
                style={{ backgroundColor: planStyle.bg, color: planStyle.color, backdropFilter: 'blur(6px)' }}
              >
                {planStyle.label}
              </span>

              {/* Hover overlay */}
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
                      background: isDownloading
                        ? 'rgba(151,101,224,0.5)'
                        : 'linear-gradient(135deg,#9765E0,#534FA5)',
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

              {/* Tags */}
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
  )
}
