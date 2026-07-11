'use client'

import { useState, useEffect, useMemo } from 'react'
import { Asset } from '@/lib/mock-data'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { isAdminEmail, adminHeaders } from '@/components/AdminGate'
import { CatalogConfig, DEFAULT_CATALOG_CONFIG } from '@/lib/catalogConfig'

// ── Type badge config ─────────────────────────────────────────
const TYPE_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  Location:          { bg: 'rgba(151,101,224,0.75)', color: '#EEE8FF', icon: '📍' },
  Character:         { bg: 'rgba(206,149,251,0.75)', color: '#1a0a2e', icon: '🎭' },
  People:            { bg: 'rgba(206,149,251,0.75)', color: '#1a0a2e', icon: '👤' },
  Animal:            { bg: 'rgba(0,194,100,0.7)',    color: '#EEE8FF', icon: '🐾' },
  Robot:             { bg: 'rgba(0,194,186,0.7)',    color: '#EEE8FF', icon: '🤖' },
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

function notifyStoreChanged() {
  try { window.dispatchEvent(new Event('cineman-store-changed')) } catch { /* SSR */ }
}

function toggleFav(id: string): Set<string> {
  const favs = getFavs()
  if (favs.has(id)) favs.delete(id); else favs.add(id)
  localStorage.setItem('cineman_favs', JSON.stringify(Array.from(favs)))
  notifyStoreChanged()
  return new Set(favs)
}

// ── Download history (localStorage, persisted) ───────────────
function recordDownload(id: string) {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem('cineman_dl_ids') ?? '[]')
    if (!ids.includes(id)) ids.push(id)
    localStorage.setItem('cineman_dl_ids', JSON.stringify(ids))
    notifyStoreChanged()
  } catch { /* ignore */ }
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

function EyeOffIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function MoveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      <polyline points="12 11 15 14 12 17" /><line x1="9" y1="14" x2="15" y2="14" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
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

        <div className="mb-4 flex justify-center"><CreditGem size={48} /></div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Not enough credits</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
          You&apos;ve run out of <strong style={{ color: '#CE95FB' }}>credits</strong>.
          Upgrade your plan or top up to keep downloading.
        </p>

        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { name: 'Free',     price: '$0',  color: '#CE95FB', downloads: '15 cr / mo'  },
            { name: 'Personal', price: '$12', color: '#9765E0', downloads: '150 cr / mo' },
            { name: 'Pro',      price: '$25', color: '#00C2BA', downloads: '500 cr / mo' },
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

// Crown icon (SVG, not emoji — master handoff §5)
function CrownIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 18h20M4 18l-1.5-9 5 3.5L12 5l4.5 7.5 5-3.5L20 18" />
    </svg>
  )
}

function LockIcon({ size = 11 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  )
}

// Credit currency = turquoise brilliant-cut gem (owner's spec — no bolts,
// no gold anywhere). One component, scaled by size.
export function CreditGem({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: '-0.15em' }}>
      <polygon points="8,5 12,5 12,10 4,10" fill="#5EEAD4" />
      <polygon points="12,5 16,5 20,10 12,10" fill="#2DD4C4" />
      <polygon points="4,10 12,10 12,21" fill="#2DD4C4" />
      <polygon points="12,10 20,10 12,21" fill="#0F9E8E" />
      <polygon points="8,5 9.6,5 6,10 4,10" fill="#ffffff" fillOpacity="0.5" />
    </svg>
  )
}

// 2K downloads cost the base price, 4K doubles it (same as generation)
function displayPrice(a: Asset): number {
  return (a.creditCost ?? 5) * (String(a.resolution ?? '2K') === '4K' ? 2 : 1)
}

// Confetti burst for exclusive buyouts (spec §5): ~40 sparks from a
// point, canvas-based, ~600ms, zero dependencies.
function confettiBurst(x: number, y: number) {
  const canvas = document.createElement('canvas')
  canvas.width = window.innerWidth
  canvas.height = window.innerHeight
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')!
  const colors = ['#3BE3D0', '#9765E0', '#ffffff', '#F4B41A']
  const parts = Array.from({ length: 42 }, () => {
    const a = Math.random() * Math.PI * 2
    const v = 2.5 + Math.random() * 4.5
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 2, r: 1.5 + Math.random() * 2.5, c: colors[Math.floor(Math.random() * colors.length)] }
  })
  const t0 = performance.now()
  const tick = (now: number) => {
    const k = (now - t0) / 650
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (k >= 1) { canvas.remove(); return }
    ctx.globalAlpha = 1 - k
    for (const p of parts) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.14
      ctx.fillStyle = p.c
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill()
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

// Sentence case for card titles («Casual studio portrait in olive»).
// Words that are ALL-CAPS and short stay as-is (BMW, SUV, NYC).
function sentenceCase(s: string): string {
  if (!s) return s
  const words = s.split(' ').map(w =>
    (w.length <= 4 && w === w.toUpperCase() && /[A-Z]{2,}/.test(w)) ? w : w.toLowerCase()
  )
  const out = words.join(' ')
  return out.charAt(0).toUpperCase() + out.slice(1)
}

// ── Card component ────────────────────────────────────────────
function AssetCard({
  asset, isFav, isDownloading, onFav, onDownload, viewMode, isAdmin = false, isDeleting = false, onDelete, onMove, onHide,
  onPrice, onBuyout, isBuying = false, downloadState = 'idle', currentUserId = null,
  displayCfg = DEFAULT_CATALOG_CONFIG,
}: {
  asset: Asset
  isFav: boolean
  isDownloading: boolean
  onFav: () => void
  onDownload: () => void
  viewMode: 'grid' | 'list'
  isAdmin?: boolean
  isDeleting?: boolean
  onDelete?: () => void
  onMove?: () => void
  onHide?: () => void
  onPrice?: () => void
  onBuyout?: () => void
  isBuying?: boolean
  downloadState?: 'idle' | 'done' | 'nocredits'
  currentUserId?: string | null
  displayCfg?: CatalogConfig
}) {
  const typeStyle = TYPE_STYLE[asset.type] ?? TYPE_STYLE['photo']
  // SOLD state: exclusively bought assets stay in the catalog but are
  // locked for everyone except their owner (spec 1.5)
  const soldTo = asset.exclusiveOwner || null
  const mine = !!soldTo && soldTo === currentUserId
  const locked = !!soldTo && !mine
  // Character sheets are tall turnaround boards — anchor the crop to the
  // top so heads stay in frame; everything else crops from the center.
  const objectPosition = String(asset.type) === 'Character' ? 'top' : 'center'
  // Admin-controlled display mode for grid cards (Admin → Settings)
  const gridFit: 'contain' | 'cover' = displayCfg.fit === 'contain' ? 'contain' : 'cover'
  const gridPosition = displayCfg.fit === 'cover-top' ? 'top' : (displayCfg.fit === 'cover' ? 'center' : 'center')
  const gridRatio = displayCfg.ratio === 'auto' ? undefined : displayCfg.ratio
  // In auto mode the image defines its own height. Until it loads we
  // reserve a 4:5 placeholder so cards never collapse or jump.
  const [imgLoaded, setImgLoaded] = useState(false)

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
            <img src={asset.thumbnail} alt={asset.title} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition }} loading="lazy" />
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
            <span className="badge" style={{ fontSize: 11, backgroundColor: typeStyle.bg, color: typeStyle.color }}>{asset.type}</span>
            {asset.category && <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{asset.category}</span>}
            {asset.tags.slice(0, 3).map(t => (
              <span key={t} style={{ fontSize: 11, color: 'var(--fg-subtle)', backgroundColor: 'var(--bg-subtle)', padding: '1px 6px', borderRadius: 4 }}>#{t}</span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isAdmin && onDelete && (
            <button
              onClick={onDelete}
              title="Delete asset (admin)"
              style={{ padding: 6, borderRadius: 6, backgroundColor: 'rgba(220,60,60,0.12)', border: '1px solid rgba(220,60,60,0.35)', color: '#e06060', cursor: isDeleting ? 'default' : 'pointer', display: 'flex', alignItems: 'center' }}
            >
              {isDeleting ? <SpinnerIcon /> : <TrashIcon />}
            </button>
          )}
          {isAdmin && onMove && (
            <button
              onClick={onMove}
              title="Move to another section (admin)"
              style={{ padding: 6, borderRadius: 6, backgroundColor: 'rgba(151,101,224,0.12)', border: '1px solid rgba(151,101,224,0.35)', color: '#9765E0', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            >
              <MoveIcon />
            </button>
          )}
          <button
            onClick={onFav}
            title={isFav ? 'Remove favorite' : 'Add to favorites'}
            style={{ padding: 6, borderRadius: 6, backgroundColor: isFav ? 'rgba(206,149,251,0.12)' : 'transparent', border: '1px solid var(--border)', color: isFav ? '#CE95FB' : 'var(--fg-subtle)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <HeartIcon filled={isFav} />
          </button>
          {asset.fileUrl && (locked ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: '1px solid var(--border)', color: 'var(--fg-subtle)' }}>
              <LockIcon size={12} /> Exclusively sold
            </span>
          ) : (
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
              {isDownloading ? '…' : (<>Download · {mine ? 0 : displayPrice(asset)} <CreditGem size={13} /></>)}
            </button>
          ))}
        </div>
      </div>
    )
  }

  // Grid card
  return (
    <div className="card group cursor-pointer flex flex-col fade-in-up" style={{ position: 'relative' }}>
      {/* Thumbnail — display mode is admin-controlled (Admin → Settings) */}
      <div className="relative overflow-hidden" style={{ aspectRatio: gridRatio, backgroundColor: 'var(--bg-subtle)' }}>
        {asset.thumbnail ? (
          <img
            src={asset.thumbnail}
            alt={asset.title}
            className={`w-full block group-hover:scale-105 transition-transform duration-500 ${gridRatio ? 'h-full' : 'h-auto'}`}
            style={{
              ...(gridRatio
                ? { objectFit: gridFit, objectPosition: gridPosition }
                : (imgLoaded ? {} : { aspectRatio: '4/5', objectFit: 'cover' as const })),
              ...(locked ? { filter: 'brightness(0.72)' } : {}),
            }}
            onLoad={() => setImgLoaded(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full flex items-center justify-center text-3xl" style={{ aspectRatio: gridRatio ?? '16/9' }}>
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

        {/* Admin buttons (top-left): delete + move to another section */}
        {isAdmin && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-all duration-200 flex gap-1.5" style={{ zIndex: 3 }}>
            {onDelete && (
              <button
                onClick={e => { e.stopPropagation(); onDelete() }}
                title="Delete asset (admin)"
                style={{
                  padding: 6, borderRadius: 7, border: 'none',
                  cursor: isDeleting ? 'default' : 'pointer',
                  backgroundColor: 'rgba(220,60,60,0.55)', color: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {isDeleting ? <SpinnerIcon /> : <TrashIcon />}
              </button>
            )}
            {onMove && (
              <button
                onClick={e => { e.stopPropagation(); onMove() }}
                title="Move to another section (admin)"
                style={{
                  padding: 6, borderRadius: 7, border: 'none', cursor: 'pointer',
                  backgroundColor: 'rgba(151,101,224,0.55)', color: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <MoveIcon />
              </button>
            )}
            {onHide && (
              <button
                onClick={e => { e.stopPropagation(); onHide() }}
                title="Hide from catalog — reversible in Admin (admin)"
                style={{
                  padding: 6, borderRadius: 7, border: 'none', cursor: 'pointer',
                  backgroundColor: 'rgba(255,170,60,0.55)', color: 'rgba(255,255,255,0.9)',
                  backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <EyeOffIcon />
              </button>
            )}
          </div>
        )}

        {/* SOLD corner badge (spec 1.5): no watermark over the photo —
            a quiet chip + slight dim is enough */}
        {soldTo && (
          <span
            className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-md"
            style={{
              zIndex: 4,
              color: mine ? '#7EE7C7' : '#5EEAD4',
              backgroundColor: 'rgba(8,5,15,0.78)',
              border: `1px solid ${mine ? 'rgba(126,231,199,0.45)' : 'rgba(94,234,212,0.4)'}`,
              backdropFilter: 'blur(6px)',
            }}
          >
            <LockIcon size={10} /> {mine ? 'Owned by you' : 'Exclusively sold'}
          </span>
        )}

        {/* Heart button (top-right; drops below the SOLD chip when present) */}
        <button
          onClick={e => { e.stopPropagation(); onFav() }}
          title={isFav ? 'Remove favorite' : 'Add to favorites'}
          className={`absolute ${soldTo ? 'top-10' : 'top-2'} right-2 transition-all duration-200`}
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

      </div>

      {/* Info + actions — buttons live UNDER the photo, never on it (spec 1.1).
          No tag pills in the grid (spec 1.6). */}
      <div className="p-3.5 flex flex-col flex-1">
        <h3 className="font-semibold mb-1 truncate text-sm" style={{ color: 'var(--fg)' }}>{sentenceCase(asset.title)}</h3>
        <div className="flex items-center gap-2 mb-3">
          <span className="badge text-[11px] font-semibold" style={{ backgroundColor: typeStyle.bg, color: typeStyle.color }}>{asset.type}</span>
          <p className="text-xs truncate" style={{ color: 'var(--fg-muted)' }}>{asset.category}</p>
        </div>

        {asset.fileUrl && (
          <div className="mt-auto" style={{ position: 'relative' }}>
            {downloadState === 'done' && (
              <span style={{
                position: 'absolute', top: -10, left: '50%', pointerEvents: 'none',
                fontSize: 13, fontWeight: 800, color: '#5EEAD4',
                animation: 'cine-fly-up .7s ease-out forwards',
                display: 'inline-flex', alignItems: 'center', gap: 2,
              }}>−{displayPrice(asset)} <CreditGem size={11} /></span>
            )}

            {locked ? (
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--fg-subtle)', cursor: 'not-allowed' }}
              >
                <LockIcon size={13} /> Exclusively sold
              </button>
            ) : downloadState === 'nocredits' ? (
              <a
                href="/pricing"
                onClick={e => e.stopPropagation()}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all"
                style={{ background: 'linear-gradient(135deg,#9765E0,#534FA5)', color: 'white', textAlign: 'center' }}
              >
                Get credits
              </a>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); onDownload() }}
                disabled={isDownloading || downloadState === 'done'}
                className="w-full flex items-stretch rounded-lg text-sm font-semibold transition-all overflow-hidden"
                style={{
                  background: downloadState === 'done'
                    ? 'linear-gradient(135deg,#0EA97A,#0B8763)'
                    : (isDownloading ? 'rgba(151,101,224,0.5)' : 'linear-gradient(135deg,#9765E0,#534FA5)'),
                  color: 'white',
                  padding: 0,
                }}
              >
                {downloadState === 'done' ? (
                  <span className="flex-1 flex items-center justify-center gap-2 py-2">✓ Downloaded</span>
                ) : isDownloading ? (
                  <span className="flex-1 flex items-center justify-center gap-2 py-2"><SpinnerIcon /> Generating link…</span>
                ) : (
                  <>
                    {/* variant D: main action left, price on a darker inset right */}
                    <span className="flex-1 flex items-center justify-center gap-1.5 py-2">
                      <DownloadIcon /> Download
                    </span>
                    <span
                      className="flex items-center gap-1.5 px-2.5"
                      onClick={isAdmin && onPrice ? (e => { e.stopPropagation(); onPrice() }) : undefined}
                      title={isAdmin && onPrice ? 'Edit price (admin)' : undefined}
                      style={{ backgroundColor: 'rgba(0,0,0,0.22)', cursor: isAdmin && onPrice ? 'pointer' : undefined }}
                    >
                      <CreditGem size={14} />
                      <span style={{ fontWeight: 800, color: 'white', fontSize: 13 }}>{mine ? 0 : displayPrice(asset)}</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                        style={{ border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.85)', lineHeight: '12px' }}
                      >
                        {asset.resolution ?? '2K'}
                      </span>
                    </span>
                  </>
                )}
              </button>
            )}

            {onBuyout && !soldTo && (
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 6, textAlign: 'center' }}>
                <button
                  onClick={e => { e.stopPropagation(); onBuyout() }}
                  disabled={isBuying}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    fontSize: 11.5, fontWeight: 600, color: 'var(--fg-muted)',
                  }}
                >
                  {isBuying ? <SpinnerIcon /> : <CrownIcon size={12} />}
                  Buy exclusive rights · {asset.exclusivePrice ?? 50} <CreditGem size={12} />
                </button>
                <p style={{ fontSize: 9.5, lineHeight: 1.35, color: 'var(--fg-subtle)', marginTop: 1 }}>
                  You own it — nobody else can buy or download it after.
                </p>
              </div>
            )}
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
  previewSize = 100,
}: {
  assets: Asset[]
  viewMode?: 'grid' | 'list'
  previewSize?: number
}) {
  const [downloading, setDownloading] = useState<string | null>(null)
  const [showUpgrade, setShowUpgrade] = useState(false)
  const [freeUsed, setFreeUsed]       = useState<number>(() => getFreeDownloadsUsed())
  const [favs, setFavs]               = useState<Set<string>>(() => getFavs())
  const [deletedIds, setDeletedIds]   = useState<Set<string>>(new Set())
  const [deleting, setDeleting]       = useState<string | null>(null)
  const [buying, setBuying]           = useState<string | null>(null)
  // no native browser dialogs (spec §4): styled modals + a small toast
  const [toast, setToast]             = useState<string | null>(null)
  const toastMsg = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3200) }
  const [buyTarget, setBuyTarget]     = useState<Asset | null>(null)
  const [priceTarget, setPriceTarget] = useState<Asset | null>(null)
  const [pOverride, setPOverride]     = useState('')
  const [pExclusive, setPExclusive]   = useState('')
  // per-card download feedback: 'done' shows ✓ Downloaded ~1.4s,
  // 'nocredits' flips the button to Get credits (→ /pricing)
  const [doneIds, setDoneIds]         = useState<Set<string>>(new Set())
  const [ownedIds, setOwnedIds]       = useState<Set<string>>(new Set()) // bought this session
  const [noCreditIds, setNoCreditIds] = useState<Set<string>>(new Set())
  // local overrides so the card badge updates right after an admin price edit
  const [priceEdits, setPriceEdits]   = useState<Record<string, { creditCost: number; exclusivePrice: number }>>({})

  // ── Admin: move asset to another section ──────────────────
  const [moveTarget, setMoveTarget]   = useState<Asset | null>(null)
  const [moveTo, setMoveTo]           = useState('')
  const [moveBusy, setMoveBusy]       = useState(false)
  const [moved, setMoved]             = useState<Record<string, { type: string; category: string }>>({})

  // Real Type/Category combos from the loaded base — always valid targets
  const moveOptions = useMemo(() => {
    const map = new Map<string, { type: string; category: string }>()
    for (const a of assets) {
      const t = String(a.type || ''), c = String(a.category || '')
      if (!t || !c) continue
      map.set(`${t}|||${c}`, { type: t, category: c })
    }
    return Array.from(map.entries())
      .map(([key, v]) => ({ key, ...v }))
      .sort((x, y) => (x.type + x.category).localeCompare(y.type + y.category))
  }, [assets])

  async function handleMove() {
    if (!moveTarget || !moveTo || moveBusy) return
    const opt = moveOptions.find(o => o.key === moveTo)
    if (!opt) return
    setMoveBusy(true)
    try {
      const res = await fetch('/api/admin/assets', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ id: moveTarget.id, type: opt.type, category: opt.category }),
      })
      const json = await res.json()
      if (json.ok) {
        setMoved(prev => ({ ...prev, [moveTarget.id]: { type: opt.type, category: opt.category } }))
        setMoveTarget(null)
        setMoveTo('')
      } else {
        toastMsg(json.error || 'Move failed')
      }
    } catch {
      toastMsg('Move failed — please try again')
    } finally {
      setMoveBusy(false)
    }
  }

  const { user } = useAuth()
  const isAdmin = isAdminEmail(user?.email)

  // Admin-controlled card display mode (Admin → Settings).
  // Re-fetched on window focus so the catalog picks up a fresh Save
  // without a manual page reload.
  const [displayCfg, setDisplayCfg] = useState<CatalogConfig>(DEFAULT_CATALOG_CONFIG)
  useEffect(() => {
    const load = () => {
      fetch('/api/admin/catalog-config', { cache: 'no-store' })
        .then(r => r.json())
        .then(j => { if (j?.config) setDisplayCfg(j.config) })
        .catch(() => {})
    }
    load()
    window.addEventListener('focus', load)
    return () => window.removeEventListener('focus', load)
  }, [])

  // Re-sync from localStorage on mount (SSR-safe) + pull DB favorites
  // for signed-in users so hearts follow the account across devices
  useEffect(() => {
    setFavs(getFavs())
    setFreeUsed(getFreeDownloadsUsed())
  }, [])
  useEffect(() => {
    if (!user) return
    supabase.from('favorites').select('asset_id').eq('user_id', user.id).then(({ data }) => {
      if (!data) return
      const merged = getFavs()
      for (const r of data) merged.add(String(r.asset_id))
      localStorage.setItem('cineman_favs', JSON.stringify(Array.from(merged)))
      setFavs(merged)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handleDownload(asset: Asset) {
    if (!asset.fileUrl) return
    const used = getFreeDownloadsUsed()
    if (used >= FREE_LIMIT) { setShowUpgrade(true); return }

    setDownloading(asset.id)
    try {
      // signed-in users spend credits server-side; anonymous keeps free limit
      const authHeaders = user ? await adminHeaders() : {}
      const res  = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ assetId: asset.id, filePath: asset.fileUrl }),
      })
      const json = await res.json()
      if (res.status === 403 && json.code === 'sold') {
        toastMsg('Exclusively sold — only its owner can download it')
        return
      }
      if (res.status === 402 && json.code === 'credits') {
        // button becomes Get credits (→ /pricing), modal sells the plans
        setNoCreditIds(prev => { const n = new Set(prev); n.add(asset.id); return n })
        setShowUpgrade(true)
        return
      }
      if (json.url) {
        if (typeof json.credits === 'number') {
          window.dispatchEvent(new CustomEvent('cineman-credits-changed', { detail: json.credits }))
        } else {
          setFreeUsed(incrementFreeDownloads())
        }
        recordDownload(asset.id)
        // ✓ Downloaded + flying −N⚡, then back to normal
        setDoneIds(prev => { const n = new Set(prev); n.add(asset.id); return n })
        setTimeout(() => setDoneIds(prev => { const n = new Set(prev); n.delete(asset.id); return n }), 1400)
        // ?download forces attachment — file saves, the page (and the
        // spend feedback) stays on screen
        const dlUrl = json.url.includes('/storage/v1/') ? json.url + (json.url.includes('?') ? '&' : '?') + 'download' : json.url
        window.location.href = dlUrl
      } else {
        toastMsg(json.error || 'Download failed')
      }
    } catch {
      toastMsg('Download failed — please try again')
    } finally {
      setDownloading(null)
    }
  }

  // Admin: price override — styled modal, no prompts (spec 4b)
  function handlePrice(asset: Asset) {
    setPriceTarget(asset)
    setPOverride('')
    setPExclusive('')
  }

  async function savePriceOverride() {
    const asset = priceTarget
    if (!asset) return
    const creditCost = pOverride.trim() === '' ? null : Math.max(0, Math.round(Number(pOverride)))
    const exclusivePrice = pExclusive.trim() === '' ? null : Math.max(0, Math.round(Number(pExclusive)))
    if ((creditCost !== null && !Number.isFinite(creditCost)) || (exclusivePrice !== null && !Number.isFinite(exclusivePrice))) { toastMsg('Enter a number or leave empty'); return }
    try {
      const res = await fetch('/api/admin/assets', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ id: asset.id, credit_cost: creditCost, exclusive_price: exclusivePrice }),
      })
      const json = await res.json()
      if (json.ok) {
        setPriceEdits(prev => ({ ...prev, [asset.id]: { creditCost: creditCost ?? asset.creditCost ?? 5, exclusivePrice: exclusivePrice ?? asset.exclusivePrice ?? 50 } }))
        setPriceTarget(null)
        toastMsg('Price saved')
      } else toastMsg(json.error || 'Save failed')
    } catch { toastMsg('Save failed — try again') }
  }

  // Exclusive buyout: styled modal (no window.confirm), Pro-only
  function handleBuyout(asset: Asset) {
    if (buying) return
    if (!user) { setShowUpgrade(true); return }
    setBuyTarget(asset)
  }

  async function confirmBuyout(e: React.MouseEvent) {
    const asset = buyTarget
    if (!asset || buying) return
    // celebration burst from the Confirm button itself
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const bx = rect.left + rect.width / 2, by = rect.top + rect.height / 2
    setBuying(asset.id)
    try {
      const res = await fetch('/api/buyout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ assetId: asset.id }),
      })
      const json = await res.json()
      if ((res.status === 403 && json.code === 'pro') || (res.status === 402 && json.code === 'credits') || (res.status === 401 && json.code === 'auth')) {
        setBuyTarget(null)
        setShowUpgrade(true)
        return
      }
      if (json.url) {
        if (typeof json.credits === 'number') {
          window.dispatchEvent(new CustomEvent('cineman-credits-changed', { detail: json.credits }))
        }
        recordDownload(asset.id)
        // SOLD: the card stays in the catalog, now marked «Owned by you»
        setOwnedIds(prev => { const next = new Set(prev); next.add(asset.id); return next })
        confettiBurst(bx, by)
        toastMsg('Yours now — exclusive')
        setTimeout(() => setBuyTarget(null), 650)
        const buyUrl = json.url.includes('/storage/v1/') ? json.url + (json.url.includes('?') ? '&' : '?') + 'download' : json.url
        setTimeout(() => { window.location.href = buyUrl }, 700)
      } else {
        toastMsg(json.error || 'Purchase failed — try again')
        setBuyTarget(null)
      }
    } catch {
      toastMsg('Purchase failed — try again')
      setBuyTarget(null)
    } finally {
      setBuying(null)
    }
  }

  function handleFav(id: string) {
    const before = favs.has(id)
    setFavs(toggleFav(id))
    // write-through to the favorites table for signed-in users
    // (cross-device; localStorage keeps working for anonymous)
    if (user) {
      if (before) supabase.from('favorites').delete().eq('user_id', user.id).eq('asset_id', id).then(() => {}, () => {})
      else supabase.from('favorites').insert({ user_id: user.id, asset_id: id }).then(() => {}, () => {})
    }
  }

  async function handleDelete(asset: Asset) {
    if (deleting) return
    if (!window.confirm(`Delete "${asset.title}" permanently?\nThis removes the database record AND the file from storage.`)) return
    setDeleting(asset.id)
    try {
      const headers = await adminHeaders()
      const res  = await fetch(`/api/admin/assets?id=${encodeURIComponent(asset.id)}`, { method: 'DELETE', headers })
      const json = await res.json()
      if (json.ok) {
        setDeletedIds(prev => { const next = new Set(prev); next.add(asset.id); return next })
      } else {
        toastMsg(json.error || 'Delete failed')
      }
    } catch {
      toastMsg('Delete failed — please try again')
    } finally {
      setDeleting(null)
    }
  }

  // Hide (reversible) — the main admin action; PATCH is_public=false
  async function handleHide(asset: Asset) {
    if (!window.confirm(`Hide "${asset.title}" from the catalog?\nIt stays in the base — restore anytime in Admin → Assets.`)) return
    try {
      const res = await fetch('/api/admin/assets', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ id: asset.id, is_public: false }),
      })
      const json = await res.json()
      if (json.ok) setDeletedIds(prev => { const next = new Set(prev); next.add(asset.id); return next })
      else toastMsg(json.error || 'Hide failed')
    } catch { toastMsg('Hide failed — please try again') }
  }

  const visibleAssets = (deletedIds.size === 0 ? assets : assets.filter(a => !deletedIds.has(a.id)))
    .map(a => moved[a.id] ? { ...a, type: moved[a.id].type as Asset['type'], category: moved[a.id].category } : a)
    .map(a => priceEdits[a.id] ? { ...a, creditCost: priceEdits[a.id].creditCost, exclusivePrice: priceEdits[a.id].exclusivePrice } : a)
    .map(a => ownedIds.has(a.id) ? { ...a, exclusiveOwner: user?.id ?? a.exclusiveOwner } : a)

  if (visibleAssets.length === 0) return <EmptyState />

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
          {visibleAssets.map(asset => (
            <AssetCard
              key={asset.id}
              asset={asset}
              isFav={favs.has(asset.id)}
              isDownloading={downloading === asset.id}
              onFav={() => handleFav(asset.id)}
              onDownload={() => handleDownload(asset)}
              viewMode="list"
              isAdmin={isAdmin}
              isDeleting={deleting === asset.id}
              onDelete={() => handleDelete(asset)}
              onMove={() => { setMoveTarget(asset); setMoveTo('') }}
              currentUserId={user?.id ?? null}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {visibleAssets.map(asset => (
            <div
              key={asset.id}
              style={{
                // fixed equal width for every card — smooth resize, no
                // uneven stretching on incomplete rows
                width: Math.round(300 * previewSize / 100),
                flexGrow: 0,
                flexShrink: 0,
                transition: 'width .45s cubic-bezier(.16,1,.3,1)',
              }}
            >
              <AssetCard
                asset={asset}
                isFav={favs.has(asset.id)}
                isDownloading={downloading === asset.id}
                onFav={() => handleFav(asset.id)}
                onDownload={() => handleDownload(asset)}
                viewMode="grid"
                isAdmin={isAdmin}
                isDeleting={deleting === asset.id}
                onDelete={() => handleDelete(asset)}
                onMove={() => { setMoveTarget(asset); setMoveTo('') }}
                onHide={() => handleHide(asset)}
                onPrice={() => handlePrice(asset)}
                onBuyout={() => handleBuyout(asset)}
                isBuying={buying === asset.id}
                downloadState={doneIds.has(asset.id) ? 'done' : (noCreditIds.has(asset.id) ? 'nocredits' : 'idle')}
                currentUserId={user?.id ?? null}
                displayCfg={displayCfg}
              />
            </div>
          ))}
        </div>
      )}

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}

      {/* Exclusive buyout confirm — styled, no browser dialogs (spec 4a) */}
      {buyTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(8,5,15,0.80)', backdropFilter: 'blur(8px)' }}
          onClick={() => !buying && setBuyTarget(null)}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl p-7 text-center"
            style={{
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(0,194,186,0.07) 100%)',
              border: '1px solid rgba(94,234,212,0.35)',
              boxShadow: '0 0 60px rgba(0,194,186,0.18)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-3 flex justify-center"><CrownIcon size={26} /></div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Own this exclusively?</h2>
            <p className="text-sm mb-1 flex items-center justify-center gap-1.5" style={{ color: 'var(--fg-muted)' }}>
              Spend {buyTarget.exclusivePrice ?? 50} <CreditGem size={14} /> to buy exclusive rights.
            </p>
            <p className="text-xs mb-6" style={{ color: 'var(--fg-subtle)' }}>
              Nobody else can buy or download it after.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setBuyTarget(null)}
                disabled={buying === buyTarget.id}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--fg-muted)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmBuyout}
                disabled={buying === buyTarget.id}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #00C2BA, #0B8763)', opacity: buying === buyTarget.id ? 0.6 : 1 }}
              >
                {buying === buyTarget.id ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin price override — styled input modal, English (spec 4b) */}
      {priceTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(8,5,15,0.80)', backdropFilter: 'blur(8px)' }}
          onClick={() => setPriceTarget(null)}
        >
          <div
            className="relative max-w-sm w-full rounded-2xl p-7"
            style={{
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(151,101,224,0.08) 100%)',
              border: '1px solid rgba(151,101,224,0.35)',
              boxShadow: '0 0 60px rgba(151,101,224,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Asset price</h2>
            <p className="text-xs mb-5 truncate" style={{ color: 'var(--fg-muted)' }}>{sentenceCase(priceTarget.title)}</p>

            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
              Override download price <span style={{ color: 'var(--fg-subtle)' }}>(leave empty = tier default)</span>
            </label>
            <input
              type="number" min={0}
              value={pOverride}
              onChange={e => setPOverride(e.target.value)}
              placeholder={`current: ${priceTarget.creditCost ?? 5}`}
              className="input-field w-full text-sm mb-4"
              style={{ padding: '9px 12px' }}
            />
            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
              Override exclusive price <span style={{ color: 'var(--fg-subtle)' }}>(leave empty = default)</span>
            </label>
            <input
              type="number" min={0}
              value={pExclusive}
              onChange={e => setPExclusive(e.target.value)}
              placeholder={`current: ${priceTarget.exclusivePrice ?? 50}`}
              className="input-field w-full text-sm mb-5"
              style={{ padding: '9px 12px' }}
            />
            <div className="flex gap-3">
              <button
                onClick={savePriceOverride}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #9765E0, #534FA5)' }}
              >
                Save
              </button>
              <button
                onClick={() => setPriceTarget(null)}
                className="px-5 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--fg-muted)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast — replaces every native alert() */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-semibold fade-in-up"
          style={{
            backgroundColor: 'rgba(8,5,15,0.92)',
            border: '1px solid rgba(94,234,212,0.4)',
            color: 'var(--fg)',
            backdropFilter: 'blur(8px)',
          }}
        >
          {toast}
        </div>
      )}

      {/* Admin: move-to-section modal */}
      {moveTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(8,5,15,0.80)', backdropFilter: 'blur(8px)' }}
          onClick={() => !moveBusy && setMoveTarget(null)}
        >
          <div
            className="relative max-w-md w-full rounded-2xl p-7"
            style={{
              background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(151,101,224,0.08) 100%)',
              border: '1px solid rgba(151,101,224,0.35)',
              boxShadow: '0 0 60px rgba(151,101,224,0.25)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <button onClick={() => !moveBusy && setMoveTarget(null)} className="absolute top-4 right-4" style={{ color: 'var(--fg-subtle)' }}>
              <CloseIcon />
            </button>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Перенести в раздел</h2>
            <p className="text-xs mb-4 truncate" style={{ color: 'var(--fg-muted)' }}>
              {moveTarget.title} <span style={{ color: 'var(--fg-subtle)' }}>· сейчас: {String(moveTarget.type)} / {moveTarget.category}</span>
            </p>
            <select
              value={moveTo}
              onChange={e => setMoveTo(e.target.value)}
              className="input-field w-full text-sm mb-4"
              style={{ padding: '10px 12px' }}
            >
              <option value="">— выбери раздел —</option>
              {moveOptions
                .filter(o => !(o.type === String(moveTarget.type) && o.category === moveTarget.category))
                .map(o => (
                  <option key={o.key} value={o.key}>{o.type} / {o.category}</option>
                ))}
            </select>
            <div className="flex gap-3">
              <button
                onClick={handleMove}
                disabled={!moveTo || moveBusy}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #9765E0, #534FA5)', opacity: !moveTo || moveBusy ? 0.5 : 1 }}
              >
                {moveBusy ? 'Переношу…' : 'Перенести'}
              </button>
              <button
                onClick={() => setMoveTarget(null)}
                disabled={moveBusy}
                className="px-5 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--fg-muted)', border: '1px solid var(--border)' }}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
