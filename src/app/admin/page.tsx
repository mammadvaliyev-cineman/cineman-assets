'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import {
  ASSET_TYPES,
  TYPE_COLOR_MAP,
  detectAssetTypeFromFilename,
} from '@/config/asset-types'

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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ── Plan badges ─────────────────────────────────────────────
const PLAN_COLOR: Record<string, { bg: string; color: string }> = {
  starter:    { bg: 'rgba(83,79,165,0.25)',  color: '#CE95FB' },
  pro:        { bg: 'rgba(0,194,186,0.20)',  color: '#00C2BA' },
  enterprise: { bg: 'rgba(151,101,224,0.25)', color: '#9765E0' },
}

// ── AI auto-naming from filename ─────────────────────────────
function autoNameFromFile(file: File): { title: string; tags: string; type: string } {
  const base = file.name.replace(/\.[^.]+$/, '')
  const cleaned = base
    .replace(/[-_.]+/g, ' ')
    .replace(/\b\d{5,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const title = cleaned
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  const detectedType = detectAssetTypeFromFilename(file.name)

  const stopWords = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'are', 'was', 'has'])
  const words = cleaned.toLowerCase()
    .split(' ')
    .filter(w => w.length > 2 && !/^\d+$/.test(w) && !stopWords.has(w))

  // Use Array.from instead of spread to avoid TS downlevelIteration issue
  const allTags = Array.from(new Set(words.concat(detectedType.autoTags))).slice(0, 8)

  return { title, tags: allTags.join(', '), type: detectedType.label }
}

// ── Main Component ──────────────────────────────────────────
export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'upload'>('overview')
  const [stats, setStats] = useState<Stats>({ total: 0, byType: {}, byPlan: {} })
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const thumbRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    title: '',
    type: ASSET_TYPES[0].label,
    category: '',
    plan: 'starter',
    tags: '',
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [selectedThumb, setSelectedThumb] = useState<File | null>(null)
  const [aiNaming, setAiNaming] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadResult, setUploadResult] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => { loadStats() }, [])

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
    const { data } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
    if (data) setAssets(data as AssetRow[])
    setLoadingAssets(false)
  }

  useEffect(() => { if (activeTab === 'assets') loadAssets() }, [activeTab])

  async function deleteAsset(asset: AssetRow) {
    if (!confirm(`Delete "${asset.title}"? This cannot be undone.`)) return
    setDeletingId(asset.id)
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

  function handleFileSelect(file: File | null) {
    setSelectedFile(file)
    if (!file) return
    setAiNaming(true)
    setTimeout(() => {
      const { title, tags, type } = autoNameFromFile(file)
      setForm(f => ({
        ...f,
        title: f.title || title,
        tags: f.tags || tags,
        type,
      }))
      setAiNaming(false)
    }, 600)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFile) { setUploadResult({ ok: false, msg: 'Please select a file.' }); return }
    if (!form.title.trim()) { setUploadResult({ ok: false, msg: 'Please enter a title.' }); return }

    setUploading(true)
    setUploadProgress(10)
    setUploadResult(null)

    try {
      const ts = Date.now()
      const safeTitle = form.title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const ext = selectedFile.name.split('.').pop()
      const filePath = `${form.type.toLowerCase()}/${ts}-${safeTitle}.${ext}`

      const { error: fileErr } = await supabase.storage.from('assets').upload(filePath, selectedFile, { cacheControl: '3600', upsert: false })
      if (fileErr) throw fileErr
      setUploadProgress(60)

      let thumbPath = ''
      const isImage = selectedFile.type.startsWith('image/')
      if (selectedThumb) {
        const tExt = selectedThumb.name.split('.').pop()
        thumbPath = `thumbnails/${ts}-${safeTitle}-thumb.${tExt}`
        const { error: tErr } = await supabase.storage.from('assets').upload(thumbPath, selectedThumb, { cacheControl: '3600', upsert: false })
        if (tErr) throw tErr
      } else if (isImage) {
        thumbPath = filePath
      }
      setUploadProgress(80)

      const { data: fileUrlData } = supabase.storage.from('assets').getPublicUrl(filePath)
      const { data: thumbUrlData } = thumbPath
        ? supabase.storage.from('assets').getPublicUrl(thumbPath)
        : { data: { publicUrl: '' } }

      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      const { error: dbErr } = await supabase.from('assets').insert({
        title: form.title.trim(),
        type: form.type,
        category: form.category.trim() || form.type,
        plan: form.plan,
        tags,
        file_url: fileUrlData.publicUrl,
        thumbnail_url: thumbUrlData.publicUrl,
      })
      if (dbErr) throw dbErr

      setUploadProgress(100)
      setUploadResult({ ok: true, msg: `"${form.title}" uploaded successfully!` })
      setForm({ title: '', type: ASSET_TYPES[0].label, category: '', plan: 'starter', tags: '' })
      setSelectedFile(null)
      setSelectedThumb(null)
      if (fileRef.current) fileRef.current.value = ''
      if (thumbRef.current) thumbRef.current.value = ''
      loadStats()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed'
      setUploadResult({ ok: false, msg })
    } finally {
      setUploading(false)
      setTimeout(() => setUploadProgress(0), 1000)
    }
  }

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
        <span className="badge text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,194,186,0.15)', color: '#00C2BA', border: '1px solid rgba(0,194,186,0.3)' }}>
          ● Live
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 mb-8 w-fit" style={{ backgroundColor: 'var(--bg-subtle)' }}>
        {(['overview', 'assets', 'upload'] as const).map(tab => (
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

      {/* Overview */}
      {activeTab === 'overview' && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Assets', value: loadingStats ? '…' : stats.total, accent: '#9765E0' },
              { label: 'Total Revenue', value: '$0', accent: '#00C2BA' },
              { label: 'Active Subscribers', value: '0', accent: '#CE95FB' },
              { label: 'Downloads', value: '0', accent: '#534FA5' },
            ].map(s => (
              <div key={s.label} className="card p-6" style={{ borderTop: `2px solid ${s.accent}` }}>
                <div className="text-2xl font-bold mb-1" style={{ color: s.accent }}>{s.value}</div>
                <div className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {!loadingStats && Object.keys(stats.byType).length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-6">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Assets by Type</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byType).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: TYPE_COLOR_MAP[type] ?? '#CE95FB' }}>{type}</span>
                      <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{count}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-6">
                <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Assets by Plan</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byPlan).map(([plan, count]) => {
                    const s = PLAN_COLOR[plan] ?? PLAN_COLOR.starter
                    return (
                      <div key={plan} className="flex items-center justify-between">
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: s.bg, color: s.color }}>{plan}</span>
                        <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="card p-6 mt-4">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Asset Types</h3>
            <div className="flex gap-3 flex-wrap">
              {ASSET_TYPES.map(t => (
                <span key={t.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: `${t.color}18`, color: t.color, border: `1px solid ${t.color}40` }}>
                  {t.emoji} {t.label}
                </span>
              ))}
            </div>
          </div>

          <div className="card p-6 mt-4">
            <h3 className="font-semibold mb-4 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Pricing Reference</h3>
            <div className="grid grid-cols-3 gap-6 text-center">
              {[
                { plan: 'Starter', price: '$9.99', color: '#CE95FB' },
                { plan: 'Pro', price: '$24.99', color: '#00C2BA' },
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

      {/* Assets */}
      {activeTab === 'assets' && (
        <div>
          {loadingAssets ? (
            <div className="flex items-center gap-3 py-12 justify-center" style={{ color: 'var(--fg-muted)' }}><SpinnerIcon /> Loading assets…</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">📭</div>
              <p style={{ color: 'var(--fg-muted)' }}>No assets yet. Upload your first one!</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Title', 'Type', 'Category', 'Plan', 'Tags', 'Date', ''].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map(asset => {
                    const planStyle = PLAN_COLOR[asset.plan] ?? PLAN_COLOR.starter
                    const typeColor = TYPE_COLOR_MAP[asset.type] ?? '#CE95FB'
                    const isDeleting = deletingId === asset.id
                    return (
                      <tr key={asset.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-3 font-medium max-w-[180px] truncate" style={{ color: 'var(--fg)' }}>{asset.title}</td>
                        <td className="px-4 py-3"><span className="text-xs font-medium" style={{ color: typeColor }}>{asset.type}</span></td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>{asset.category}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full capitalize" style={{ backgroundColor: planStyle.bg, color: planStyle.color }}>{asset.plan}</span>
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: 'var(--fg-subtle)' }}>
                          {Array.isArray(asset.tags) ? asset.tags.join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-subtle)' }}>{new Date(asset.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteAsset(asset)}
                            disabled={isDeleting}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all"
                            style={{ color: isDeleting ? 'var(--fg-subtle)' : '#ff5f5f', backgroundColor: 'rgba(255,95,95,0.08)' }}
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

      {/* Upload */}
      {activeTab === 'upload' && (
        <div className="max-w-xl">
          <form onSubmit={handleUpload} className="space-y-5">
            <div
              className="card p-8 text-center cursor-pointer transition-all"
              style={{ border: `2px dashed ${selectedFile ? '#9765E0' : 'var(--border)'}`, backgroundColor: selectedFile ? 'rgba(151,101,224,0.06)' : 'var(--bg-card)' }}
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-4xl mb-3">{aiNaming ? '🤖' : selectedFile ? '✅' : '📁'}</div>
              {aiNaming ? (
                <p className="font-semibold text-sm animate-pulse" style={{ color: '#9765E0' }}>AI is naming your file…</p>
              ) : selectedFile ? (
                <>
                  <p className="font-semibold text-sm" style={{ color: '#9765E0' }}>{selectedFile.name}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--fg-muted)' }}>{(selectedFile.size / 1024 / 1024).toFixed(1)} MB</p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-sm mb-1" style={{ color: 'var(--fg)' }}>Drop your asset file here</p>
                  <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>JPG, PNG, MP4, MOV — up to 500 MB</p>
                </>
              )}
              <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*" onChange={e => handleFileSelect(e.target.files?.[0] ?? null)} />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>
                Thumbnail <span style={{ color: 'var(--fg-subtle)' }}>(optional — for videos)</span>
              </label>
              <div className="card p-4 flex items-center gap-3 cursor-pointer" style={{ border: `1px dashed ${selectedThumb ? '#00C2BA' : 'var(--border)'}` }} onClick={() => thumbRef.current?.click()}>
                <span className="text-xl">{selectedThumb ? '🖼️' : '➕'}</span>
                <span className="text-sm" style={{ color: selectedThumb ? '#00C2BA' : 'var(--fg-muted)' }}>{selectedThumb ? selectedThumb.name : 'Add thumbnail…'}</span>
                <input ref={thumbRef} type="file" className="hidden" accept="image/*" onChange={e => setSelectedThumb(e.target.files?.[0] ?? null)} />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider flex items-center gap-2 mb-2" style={{ color: 'var(--fg-muted)' }}>
                Title *
                {form.title && !aiNaming && (
                  <span className="text-xs normal-case font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(151,101,224,0.12)', color: '#9765E0' }}>✨ AI named</span>
                )}
              </label>
              <input className="input-field" placeholder="e.g. Desert Canyon at Sunset" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Type</label>
                <select className="input-field" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {ASSET_TYPES.map(t => (
                    <option key={t.id} value={t.label}>{t.emoji} {t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Plan</label>
                <select className="input-field" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))}>
                  <option value="starter">Starter</option>
                  <option value="pro">Pro</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Category</label>
              <input className="input-field" placeholder="e.g. Aerial, Urban, Nature…" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>
                Tags <span style={{ color: 'var(--fg-subtle)' }}>(comma separated)</span>
              </label>
              <input className="input-field" placeholder="cinematic, desert, aerial" value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
            </div>

            {uploading && (
              <div className="rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-subtle)', height: 4 }}>
                <div className="h-full transition-all duration-500 rounded-full" style={{ width: `${uploadProgress}%`, background: 'linear-gradient(90deg, #9765E0, #00C2BA)' }} />
              </div>
            )}

            {uploadResult && (
              <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm" style={{
                backgroundColor: uploadResult.ok ? 'rgba(0,194,186,0.12)' : 'rgba(255,95,95,0.12)',
                color: uploadResult.ok ? '#00C2BA' : '#ff5f5f',
                border: `1px solid ${uploadResult.ok ? 'rgba(0,194,186,0.3)' : 'rgba(255,95,95,0.3)'}`,
              }}>
                {uploadResult.ok ? <CheckIcon /> : '⚠️'}
                {uploadResult.msg}
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all"
              style={{
                background: uploading ? 'rgba(151,101,224,0.4)' : 'linear-gradient(135deg, #9765E0, #534FA5)',
                color: 'white',
                boxShadow: uploading ? 'none' : '0 0 20px rgba(151,101,224,0.35)',
                cursor: uploading ? 'not-allowed' : 'pointer',
              }}
            >
              {uploading ? <SpinnerIcon /> : <UploadIcon />}
              {uploading ? `Uploading… ${uploadProgress}%` : 'Upload Asset'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
