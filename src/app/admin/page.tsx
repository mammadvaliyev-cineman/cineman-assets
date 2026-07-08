'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, STYLES, MOODS, LIGHTING, getSubcategoriesFor } from '@/config/categories'

// ── Types ───────────────────────────────────────────────────
type AssetRow = {
  id: string
  title: string
  type: string
  category: string
  plan: string
  tags: string[]
  file_url: string
  thumbnail_url: string
  created_at: string
}

type Stats = {
  total: number
  byType: Record<string, number>
  byPlan: Record<string, number>
}

// ── Icons ───────────────────────────────────────────────────
function UploadIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}


// ── Plan / Type badges ──────────────────────────────────────
const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
  starter:    { bg: 'rgba(83,79,165,0.25)',  color: '#CE95FB' },
  pro:        { bg: 'rgba(0,194,186,0.20)',  color: '#00C2BA' },
  enterprise: { bg: 'rgba(151,101,224,0.25)', color: '#9765E0' },
}

const TYPE_COLOR: Record<string, string> = {
  Location:  '#9765E0',
  Character: '#CE95FB',
}

// ── AI auto-naming from filename ─────────────────────────────
function autoNameFromFile(file: File): { title: string; tags: string; type: string } {
  const base = file.name.replace(/\.[^.]+$/, '')

  // If filename looks like UUID / hash / device-generated ID — return empty
  // so Gemini result is the only source of truth (no garbage fallback)
  const uuidLike = /^[0-9a-f]{6,}[-_][0-9a-f]/i.test(base)   // e.g. 5ef40f48-8629-...
  const hashLike = /^[0-9a-f]{20,}$/i.test(base)               // pure hex hash
  const deviceId = /^(img|dsc|dji|vid|vlc|hf|mov|photo|screenshot|snap)[-_\s]?\d/i.test(base) // IMG_1234, DSC09, HF_...
  const chatgptFile = /^chatgpt[\s_-]/i.test(base)              // ChatGPT Image filenames
  const hasTimestamp = /\b\d{1,2}[\s._-]\d{1,2}[\s._-]\d{2,4}\b/.test(base) // 10_05_2026, 2026-05-10...
    const hasCyrillic = /[\u0430-\u044f\u0451\u0410-\u042f\u0401]/.test(base) // Russian/Cyrillic date text
  if (uuidLike || hashLike || deviceId || chatgptFile || (hasTimestamp && hasCyrillic)) {
    // Detect type hint from any readable prefix only
    const lower = base.toLowerCase()
    const isCharacter = ['char','person','portrait','face','model','actor','human'].some(k => lower.startsWith(k))
    return { title: '', tags: '', type: isCharacter ? 'Character' : 'Location' }
  }

  // strip remaining timestamps / pure number tokens
  const cleaned = base
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\d{5,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Title case
  const title = cleaned
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  // Detect type
  const lower = cleaned.toLowerCase()
  const characterKeywords = ['character', 'char', 'person', 'portrait', 'face', 'model', 'actor', 'human', 'woman', 'man', 'girl', 'boy', 'hero', 'villain']
  const isCharacter = characterKeywords.some(k => lower.includes(k))
  const detectedType = isCharacter ? 'Character' : 'Location'

  // Generate tags from meaningful words only
  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'has'])
  const words = lower
    .split(' ')
    .filter(w => w.length > 2 && !/^\d+$/.test(w) && !stopWords.has(w))

  const extraTags = detectedType === 'Character'
    ? ['ai character', 'cinematic']
    : ['ai location', 'cinematic', 'environment']

  const allTags = Array.from(new Set(words.concat(extraTags))).slice(0, 8)

  return { title, tags: allTags.join(', '), type: detectedType }
}

// ── Convert any image to clean JPEG via canvas (strips EXIF/metadata) ──
async function toCleanJpeg(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      // Downscale to max 1024px so /api/ai-name payload stays under Vercel's 4.5MB limit
      const scale = Math.min(1, 1024 / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        resolve(new File([blob!], 'image.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Web-size compress for upload: 1600px JPEG (~0.4MB vs 7MB PNG) ──
// Originals stay in Dropbox as master archive; web + Seedance only
// need reference-grade resolution. 20x faster uploads, 20x less storage.
async function toWebJpeg(file: File): Promise<File> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url)
        resolve(blob ? new File([blob], 'image.jpg', { type: 'image/jpeg' }) : file)
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file) }
    img.src = url
  })
}

// ── Face-crop thumbnail: AI gives face_box at naming time, we cut
// a 3:4 head-and-shoulders portrait for catalog/studio cards ──────
async function cropFace(file: File, box: [number, number, number, number]): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight
      const [x, y, w, h] = box
      const fw = Math.max(w * W, 1)
      let cw = Math.min(W, fw * 1.45)
      let ch = Math.min(H, cw * 4 / 3)
      cw = Math.min(cw, ch * 3 / 4)
      const cx = Math.max(0, Math.min(W - cw, (x + w / 2) * W - cw / 2))
      const cy = Math.max(0, Math.min(H - ch, (y + h / 2) * H - ch * 0.45))
      const canvas = document.createElement('canvas')
      canvas.width = 480
      canvas.height = 640
      canvas.getContext('2d')!.drawImage(img, cx, cy, cw, ch, 0, 0, 480, 640)
      canvas.toBlob(b => {
        URL.revokeObjectURL(url)
        b ? resolve(new File([b], 'face.jpg', { type: 'image/jpeg' })) : reject(new Error('crop failed'))
      }, 'image/jpeg', 0.85)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('img load')) }
    img.src = url
  })
}

// ── Batch queue item ─────────────────────────────────────────
type BatchItem = {
  id: string
  file: File
  title: string
  tags: string
  type: string
  description: string
  status: 'pending' | 'uploading' | 'done' | 'error'
  errorMsg?: string
  aiLoading?: boolean
  faceBox?: [number, number, number, number] | null
}

// ── Main Component ──────────────────────────────────────────
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'batch' | 'categories'>('overview')
  const [stats, setStats] = useState<Stats>({ total: 0, byType: {}, byPlan: {} })
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Batch upload state ──────────────────────────────────
  const batchRef = useRef<HTMLInputElement>(null)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchPlan, setBatchPlan] = useState('starter')
  const [batchCategory, setBatchCategory] = useState('Location')
  const [batchSubcategory, setBatchSubcategory] = useState('')
  const [batchStyle, setBatchStyle] = useState('')
  const [batchMood, setBatchMood] = useState('')

  // ── Load stats ──────────────────────────────────────────
  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoadingStats(true)
    const { data } = await supabase.from('assets').select('type, plan')
    if (data) {
      const byType: Record<string, number> = {}
      const byPlan: Record<string, number> = {}
      data.forEach(r => {
        byType[r.type] = (byType[r.type] ?? 0) + 1
        byPlan[r.plan] = (byPlan[r.plan] ?? 0) + 1
      })
      setStats({ total: data.length, byType, byPlan })
    }
    setLoadingStats(false)
  }

  async function loadAssets() {
    setLoadingAssets(true)
    const { data } = await supabase
      .from('assets')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setAssets(data as AssetRow[])
    setLoadingAssets(false)
  }

  useEffect(() => {
    if (activeTab === 'assets') loadAssets()
  }, [activeTab])

  // ── Delete asset ────────────────────────────────────────
  async function deleteAsset(asset: AssetRow) {
    if (!confirm(`Delete "${asset.title}"? This cannot be undone.`)) return
    setDeletingId(asset.id)
    // Remove from Storage
    if (asset.file_url) {
      const path = asset.file_url.split('/assets/')[1]
      if (path) await supabase.storage.from('assets').remove([path])
    }
    if (asset.thumbnail_url && asset.thumbnail_url.includes('/assets/')) {
      const tPath = asset.thumbnail_url.split('/assets/')[1]
      if (tPath) await supabase.storage.from('assets').remove([tPath])
    }
    await supabase.from('assets').delete().eq('id', asset.id)
    setAssets(prev => prev.filter(a => a.id !== asset.id))
    setStats(prev => ({ ...prev, total: prev.total - 1 }))
    setDeletingId(null)
  }

  // ── Batch: add files + AI naming ─────────────────────────
  async function handleBatchSelect(files: FileList | null) {
    if (!files) return
    // Add items immediately with filename-based naming
    const newItems: BatchItem[] = Array.from(files).map(file => {
      const { title, tags, type } = autoNameFromFile(file)
      return {
        id: `${Date.now()}-${Math.random()}-${file.name}`,
        file,
        title,
        tags,
        type,
        description: '',
        status: 'pending' as const,
        aiLoading: true,
      }
    })
    setBatchItems(prev => [...prev, ...newItems])

    // Fire Gemini AI naming for each image in parallel
    const isGeminiReady = true // will fail gracefully if key not set
    if (isGeminiReady) {
      // Limited concurrency (4 at a time) — safe for 1000+ file drops
      const queue = [...newItems]
      const nameOne = async (item: BatchItem) => {
          if (!item.file.type.startsWith('image/')) {
            // Non-image: skip AI, keep filename-based name
            setBatchItems(prev =>
              prev.map(it => it.id === item.id ? { ...it, aiLoading: false } : it)
            )
            return
          }
          try {
            // Convert to clean JPEG — strips EXIF/metadata so Gemini
            // analyses pixels only, not UUID filenames or device metadata
            const cleanFile = await toCleanJpeg(item.file)
            const fd = new FormData()
            fd.append('file', cleanFile)
            const res = await fetch('/api/ai-name', { method: 'POST', body: fd })
            if (res.ok) {
              const ai = await res.json()
              setBatchItems(prev =>
                prev.map(it =>
                  it.id === item.id
                    ? {
                        ...it,
                        // Never fall back to UUID garbage — prefer empty string
                        title: ai.title || '',
                        tags:  ai.tags  || '',
                        type:  ai.type  || it.type,
                        description: ai.description || '',
                        faceBox: ai.face_box || null,
                        aiLoading: false,
                      }
                    : it
                )
              )
            } else {
              setBatchItems(prev =>
                prev.map(it => it.id === item.id ? { ...it, aiLoading: false } : it)
              )
            }
          } catch {
            setBatchItems(prev =>
              prev.map(it => it.id === item.id ? { ...it, aiLoading: false } : it)
            )
          }
      }
      const worker = async () => {
        for (;;) {
          const item = queue.shift()
          if (!item) return
          await nameOne(item)
        }
      }
      await Promise.all(Array.from({ length: 4 }, () => worker()))
    }
  }

  // ── Batch: update single item ─────────────────────────────
  function updateBatchItem(id: string, changes: Partial<BatchItem>) {
    setBatchItems(prev => prev.map(it => (it.id === id ? { ...it, ...changes } : it)))
  }

  // ── Batch: upload all pending ─────────────────────────────
  const runBatchUpload = useCallback(async () => {
    setBatchRunning(true)
    const pending = batchItems.filter(it => it.status === 'pending')
    for (const item of pending) {
      updateBatchItem(item.id, { status: 'uploading' })
      try {
        const ts = Date.now()
        const safeTitle = item.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
        const ext = item.file.type.startsWith('image/') ? 'jpg' : item.file.name.split('.').pop()
        const filePath = `${item.type.toLowerCase().replace(/\s+/g, '-')}/${ts}-${safeTitle}.${ext}`

        const uploadFile = item.file.type.startsWith('image/') ? await toWebJpeg(item.file) : item.file
        const { error: fileErr } = await supabase.storage
          .from('assets')
          .upload(filePath, uploadFile, { cacheControl: '3600', upsert: false })
        if (fileErr) throw fileErr

        const isImage = item.file.type.startsWith('image/')
        let thumbPath = isImage ? filePath : ''
        // Character sheets: upload a face-crop as the thumbnail
        if (isImage && item.faceBox) {
          try {
            const faceFile = await cropFace(item.file, item.faceBox)
            const fPath = filePath.replace(/\.[a-z0-9]+$/i, '') + '-face.jpg'
            const { error: fErr } = await supabase.storage.from('assets').upload(fPath, faceFile, { cacheControl: '3600', upsert: false })
            if (!fErr) thumbPath = fPath
          } catch { /* fall back to full image */ }
        }

        const { data: fileUrlData } = supabase.storage.from('assets').getPublicUrl(filePath)
        const thumbUrl = thumbPath
          ? supabase.storage.from('assets').getPublicUrl(thumbPath).data.publicUrl
          : ''

        const baseTags = item.tags.split(',').map(t => t.trim()).filter(Boolean)
        // Append style/mood/subcategory as structured tags
        const extraTags = [batchSubcategory, batchStyle, batchMood].filter(Boolean)
        const tags = Array.from(new Set([...baseTags, ...extraTags]))

        const { error: dbErr } = await supabase.from('assets').insert({
          title: item.title.trim(),
          type: item.type,
          category: batchCategory || item.type,
          plan: batchPlan,
          tags,
          description: item.description || '',
          file_url: fileUrlData.publicUrl,
          thumbnail_url: thumbUrl,
        })
        if (dbErr) throw dbErr

        updateBatchItem(item.id, { status: 'done' })
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed'
        updateBatchItem(item.id, { status: 'error', errorMsg: msg })
      }
    }
    setBatchRunning(false)
    loadStats()
  }, [batchItems, batchPlan, batchCategory])

  // ── Render ──────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold" style={{ color: 'var(--fg)' }}>
            Admin{' '}
            <span style={{ background: 'linear-gradient(135deg, #9765E0, #00C2BA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Dashboard
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Cineman Assets Management</p>
        </div>
        <span
          className="badge text-xs font-semibold px-3 py-1 rounded-full"
          style={{ backgroundColor: 'rgba(0,194,186,0.15)', color: '#00C2BA', border: '1px solid rgba(0,194,186,0.3)' }}
        >
          ● Live
        </span>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 rounded-xl p-1 mb-8 w-fit"
        style={{ backgroundColor: 'var(--bg-subtle)' }}
      >
        {(['overview', 'assets', 'batch', 'categories'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all"
            style={
              activeTab === tab
                ? { background: 'linear-gradient(135deg, #9765E0, #534FA5)', color: 'white', boxShadow: '0 0 12px rgba(151,101,224,0.4)' }
                : { color: 'var(--fg-muted)' }
            }
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview Tab ────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Assets', value: loadingStats ? '…' : stats.total, accent: '#9765E0' },
              { label: 'Total Revenue', value: '$0', accent: '#00C2BA' },
              { label: 'Active Subscribers', value: '0', accent: '#CE95FB' },
              { label: 'Downloads', value: '0', accent: '#534FA5' },
            ].map(s => (
              <div
                key={s.label}
                className="card p-6"
                style={{ borderTop: `2px solid ${s.accent}` }}
              >
                <div className="text-2xl font-bold mb-1" style={{ color: s.accent }}>{s.value}</div>
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* By type breakdown */}
          {!loadingStats && Object.keys(stats.byType).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-6">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Assets by Type</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: TYPE_COLOR[type] ?? '#CE95FB' }}>{type}</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Assets by Plan</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byPlan).map(([plan, count]) => {
                    const style = PLAN_COLOR[plan] ?? PLAN_COLOR.starter
                    return (
                      <div key={plan} className="flex items-center justify-between">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                          style={{ backgroundColor: style.bg, color: style.color }}
                        >
                          {plan}
                        </span>
                        <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Pricing reference */}
          <div className="card p-6 mt-4">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Pricing Reference</h3>
            <div className="grid grid-cols-3 gap-6 text-center">
              {[
                { plan: 'Starter', price: '$9.99', color: '#CE95FB' },
                { plan: 'Pro',     price: '$24.99', color: '#00C2BA' },
                { plan: 'Enterprise', price: '$79.99', color: '#9765E0' },
              ].map(p => (
                <div key={p.plan}>
                  <div className="text-2xl font-bold" style={{ color: p.color }}>{p.price}</div>
                  <div className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>{p.plan} /mo</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Assets Tab ────────────────────────────────────────── */}
      {activeTab === 'assets' && (
        <div>
          {loadingAssets ? (
            <div className="flex items-center gap-3 py-12 justify-center" style={{ color: 'var(--fg-muted)' }}>
              <SpinnerIcon /> Loading assets…
            </div>
          ) : assets.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🚫</div>
              <p style={{ color: 'var(--fg-muted)' }}>No assets yet. Upload your first one!</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['', 'Title', 'Type', 'Category', 'Plan', 'Tags', 'Date', ''].map(h => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--fg-subtle)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map(asset => {
                    const planStyle = PLAN_COLOR[asset.plan] ?? PLAN_COLOR.starter
                    const typeColor = TYPE_COLOR[asset.type] ?? '#CE95FB'
                    const isDeleting = deletingId === asset.id
                    return (
                      <tr
                        key={asset.id}
                        style={{ borderBottom: '1px solid var(--border)' }}
                      >
                        {/* Thumbnail */}
                        <td className="px-3 py-2">
                          {asset.thumbnail_url ? (
                            <img
                              src={asset.thumbnail_url}
                              alt=""
                              className="rounded-lg object-cover"
                              style={{ width: 52, height: 52 }}
                            />
                          ) : (
                            <div
                              className="rounded-lg flex items-center justify-center text-xl"
                              style={{ width: 52, height: 52, backgroundColor: 'var(--bg-subtle)' }}
                            >
                              {asset.type === 'Character' ? '🎭' : '📍'}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium max-w-[180px] truncate" style={{ color: 'var(--fg)' }}>
                          {asset.title}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium" style={{ color: typeColor }}>{asset.type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>{asset.category}</td>
                        <td className="px-4 py-3">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize"
                            style={{ backgroundColor: planStyle.bg, color: planStyle.color }}
                          >
                            {asset.plan}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: 'var(--fg-subtle)' }}>
                          {Array.isArray(asset.tags) ? asset.tags.join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-subtle)' }}>
                          {new Date(asset.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteAsset(asset)}
                            disabled={isDeleting}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                            style={{
                              color: isDeleting ? 'var(--fg-subtle)' : '#ff5f5f',
                              backgroundColor: 'rgba(255,95,95,0.08)',
                            }}
                          >
                            {isDeleting ? <SpinnerIcon /> : <TrashIcon />}
                            {isDeleting ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Batch Upload Tab ─────────────────────────────────────── */}
      {activeTab === 'batch' && (
        <div>
          {/* Drop zone */}
          <div
            className="card p-10 text-center cursor-pointer mb-6 transition-all"
            style={{
              border: `2px dashed ${batchItems.length ? '#9765E0' : 'var(--border)'}`,
              backgroundColor: batchItems.length ? 'rgba(151,101,224,0.04)' : 'var(--bg-card)',
            }}
            onClick={() => batchRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); handleBatchSelect(e.dataTransfer.files) }}
          >
            <div className="text-4xl mb-3">📂</div>
            <p className="font-semibold text-sm mb-1" style={{ color: 'var(--fg)' }}>
              Drop multiple files here, or click to select
            </p>
            <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>
              JPG, PNG, MP4 — AI will auto-name each file
            </p>
            <input
              ref={batchRef}
              type="file"
              className="hidden"
              accept="image/*,video/*"
              multiple
              onChange={e => handleBatchSelect(e.target.files)}
            />
          </div>

          {/* Global settings for batch */}
          {batchItems.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {/* Plan */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Plan</label>
                <select className="input-field" value={batchPlan} onChange={e => setBatchPlan(e.target.value)}>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
              {/* Category */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Category</label>
                <select
                  className="input-field"
                  value={batchCategory}
                  onChange={e => { setBatchCategory(e.target.value); setBatchSubcategory('') }}
                >
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              {/* Subcategory */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Subcategory</label>
                <select
                  className="input-field"
                  value={batchSubcategory}
                  onChange={e => setBatchSubcategory(e.target.value)}
                >
                  <option value="">— All —</option>
                  {getSubcategoriesFor(batchCategory).map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              {/* Style */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Style</label>
                <select className="input-field" value={batchStyle} onChange={e => setBatchStyle(e.target.value)}>
                  <option value="">— None —</option>
                  {STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Mood */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Mood</label>
                <select className="input-field" value={batchMood} onChange={e => setBatchMood(e.target.value)}>
                  <option value="">— None —</option>
                  {MOODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Queue */}
          {batchItems.length > 0 && (
            <div className="card overflow-hidden mb-6">
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
                <span className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>
                  {batchItems.length} file{batchItems.length !== 1 ? 's' : ''} queued
                </span>
                <div className="flex gap-2 text-xs" style={{ color: 'var(--fg-muted)' }}>
                  <span>✅ {batchItems.filter(i => i.status === 'done').length} done</span>
                  <span>❌ {batchItems.filter(i => i.status === 'error').length} errors</span>
                </div>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {batchItems.map(item => (
                  <div key={item.id} className="px-4 py-3 flex flex-col gap-2">
                    {item.description && !item.aiLoading && (
                      <p className="text-xs leading-relaxed" style={{ color: 'var(--fg-muted)', borderLeft: '2px solid #9765E0', paddingLeft: '8px' }}>
                        {item.description}
                      </p>
                    )}
                    <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 items-center">
                    {/* Title (editable) */}
                    <div className="relative">
                      <input
                        className="input-field text-sm py-1 w-full"
                        value={item.title}
                        onChange={e => updateBatchItem(item.id, { title: e.target.value })}
                        disabled={item.status !== 'pending' || item.aiLoading}
                        placeholder={item.aiLoading ? '🤖 AI analyzing…' : 'Title'}
                      />
                      {item.aiLoading && (
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs animate-pulse" style={{ color: '#9765E0' }}>🤖</span>
                      )}
                    </div>
                    {/* Tags (editable) */}
                    <input
                      className="input-field text-xs py-1"
                      value={item.tags}
                      placeholder={item.aiLoading ? 'AI generating tags…' : 'tags, comma, separated'}
                      onChange={e => updateBatchItem(item.id, { tags: e.target.value })}
                      disabled={item.status !== 'pending' || item.aiLoading}
                    />
                    {/* Type selector */}
                    <select
                      className="input-field text-xs py-1"
                      value={item.type}
                      onChange={e => updateBatchItem(item.id, { type: e.target.value })}
                      disabled={item.status !== 'pending' || item.aiLoading}
                    >
                      <option value="Location">📍 Location</option>
                      <option value="Character">🎭 Character</option>
                    </select>
                    {/* Status */}
                    <span className="text-sm w-6 text-center">
                      {item.aiLoading              && <SpinnerIcon />}
                      {!item.aiLoading && item.status === 'pending'   && '⏳'}
                      {item.status === 'uploading' && <SpinnerIcon />}
                      {item.status === 'done'      && '✅'}
                      {item.status === 'error'     && (
                        <span title={item.errorMsg}>❌</span>
                      )}
                    </span>
                    </div>{/* end inner grid */}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          {batchItems.length > 0 && (
            <div className="flex gap-3">
              <button
                onClick={runBatchUpload}
                disabled={batchRunning || batchItems.every(i => i.status !== 'pending')}
                className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm text-white transition-all"
                style={{
                  background: batchRunning ? 'rgba(151,101,224,0.4)' : 'linear-gradient(135deg,#9765E0,#534FA5)',
                  boxShadow: batchRunning ? 'none' : '0 0 20px rgba(151,101,224,0.35)',
                  cursor: batchRunning ? 'not-allowed' : 'pointer',
                }}
              >
                {batchRunning ? <SpinnerIcon /> : <UploadIcon />}
                {batchRunning
                  ? `Uploading… (${batchItems.filter(i => i.status === 'done').length}/${batchItems.length})`
                  : `Upload All (${batchItems.filter(i => i.status === 'pending').length} pending)`}
              </button>
              <button
                onClick={() => setBatchItems([])}
                disabled={batchRunning}
                className="px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-muted)' }}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Categories Tab ──────────────────────────────────────── */}
      {activeTab === 'categories' && (
        <div>
          <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
            Full taxonomy used in batch uploads and catalog filters. To add categories, edit <code style={{ color: '#9765E0' }}>src/config/categories.ts</code>.
          </p>

          {/* Category grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="card p-5" style={{ borderLeft: `3px solid ${cat.color}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{cat.label}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${cat.color}22`, color: cat.color }}>
                    {cat.subcategories.length} sub
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {cat.subcategories.map(sub => (
                    <span key={sub.id} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-muted)' }}>
                      {sub.label}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Style / Mood / Lighting */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Styles', emoji: '🎨', items: STYLES, color: '#9765E0' },
              { label: 'Moods', emoji: '🎭', items: MOODS, color: '#CE95FB' },
              { label: 'Lighting', emoji: '💡', items: LIGHTING, color: '#00C2BA' },
            ].map(group => (
              <div key={group.label} className="card p-5" style={{ borderLeft: `3px solid ${group.color}` }}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{group.emoji}</span>
                  <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{group.label}</span>
                </div>
                <div className="flex flex-col gap-1">
                  {group.items.map(item => (
                    <span key={item} className="text-xs" style={{ color: 'var(--fg-muted)' }}>· {item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
