'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGate, { adminHeaders } from '@/components/AdminGate'
import { CatalogConfig, DEFAULT_CATALOG_CONFIG, FIT_OPTIONS, RATIO_OPTIONS } from '@/lib/catalogConfig'
import { CATEGORIES, STYLES, MOODS, LIGHTING, Category, makeSubcategory } from '@/config/categories'

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
  is_public?: boolean
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

// ── Thin line icons — same style as the catalog ─────────────
function LineIcon({ d, size = 18, color = 'currentColor' }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}
const TYPE_ICON: Record<string, string> = {
  Character: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  Location: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z|M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  Vehicle: 'M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2|M6.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z|M16.5 18.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  Prop: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z|M3.3 7l8.7 5 8.7-5|M12 22V12',
  grid: 'M3 3h7v7H3z|M14 3h7v7h-7z|M14 14h7v7h-7z|M3 14h7v7H3z',
  palette: 'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-2 2c0 1 .5 1.5.5 2.5S13.5 21 12 21z|M7.5 11a1 1 0 1 0 0-2|M12 8a1 1 0 1 0 0-2|M16.5 11a1 1 0 1 0 0-2',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M8 14s1.5 2 4 2 4-2 4-2|M9 9h.01|M15 9h.01',
  bulb: 'M9 18h6|M10 22h4|M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.4 1 2.3h6c0-.9.4-1.8 1-2.3A7 7 0 0 0 12 2z',
  engine: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6',
  x: 'M18 6L6 18|M6 6l12 12',
  plus: 'M12 5v14|M5 12h14',
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
      const faceH = Math.max(h * H, 1)
      const faceCx = (x + w / 2) * W
      const faceCy = (y + h / 2) * H
      // Character sheets are 3 turnaround panels side by side.
      // Clamp the crop inside the panel that holds the face —
      // otherwise a sliver of the neighbouring angle leaks in.
      const isSheet = W / H > 1.5
      const panelW = W / 3
      const panelIdx = Math.max(0, Math.min(2, Math.floor(faceCx / panelW)))
      const pL = isSheet ? panelIdx * panelW : 0
      const pR = isSheet ? pL + panelW : W
      // Uniform scale: the face always fills ~42% of crop height,
      // so every portrait in the grid looks identical in zoom.
      let ch = Math.min(H, faceH / 0.42)
      let cw = Math.min(pR - pL, ch * 3 / 4)
      ch = Math.min(ch, cw * 4 / 3)
      const cx = Math.max(pL, Math.min(pR - cw, faceCx - cw / 2))
      const cy = Math.max(0, Math.min(H - ch, faceCy - ch * 0.42))
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
function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'batch' | 'categories' | 'settings'>('overview')
  const [stats, setStats] = useState<Stats>({ total: 0, byType: {}, byPlan: {} })
  const [assets, setAssets] = useState<AssetRow[]>([])
  const [loadingStats, setLoadingStats] = useState(true)
  const [loadingAssets, setLoadingAssets] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── Settings tab state ──────────────────────────────────
  const [dispCfg, setDispCfg] = useState<CatalogConfig>(DEFAULT_CATALOG_CONFIG)
  const [dispSaving, setDispSaving] = useState(false)
  const [dispSaved, setDispSaved] = useState(false)
  const [catList, setCatList] = useState<Array<{ category: string; count: number }>>([])
  const [delCat, setDelCat] = useState('')
  const [delBusy, setDelBusy] = useState(false)
  const [delMsg, setDelMsg] = useState('')
  const [previewSamples, setPreviewSamples] = useState<Array<{ label: string; url: string }>>([])
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupMsg, setBackupMsg] = useState('')

  // ── Settings: download full DB backup ─────────────────────
  async function downloadBackup() {
    setBackupBusy(true)
    setBackupMsg('')
    try {
      const res = await fetch('/api/admin/backup', { headers: await adminHeaders() })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setBackupMsg(`Ошибка: ${j.error || res.status}`)
      } else {
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `cineman-backup-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(a.href)
        setBackupMsg('✓ Бэкап скачан — сохрани файл в надёжное место (Dropbox).')
      }
    } catch {
      setBackupMsg('Ошибка: не удалось скачать бэкап')
    }
    setBackupBusy(false)
  }

  // ── Batch upload state ──────────────────────────────────
  const batchRef = useRef<HTMLInputElement>(null)
  const [batchItems, setBatchItems] = useState<BatchItem[]>([])
  const [batchRunning, setBatchRunning] = useState(false)
  const [batchPlan, setBatchPlan] = useState('starter')
  const [batchCategory, setBatchCategory] = useState('Location')
  const [batchSubcategory, setBatchSubcategory] = useState('')
  const [batchStyle, setBatchStyle] = useState('')
  const [batchMood, setBatchMood] = useState('')

  // ── Live-editable taxonomy (Supabase-backed) ────────────
  const [taxonomy, setTaxonomy] = useState<Category[]>(CATEGORIES)
  const [stylesList, setStylesList] = useState<string[]>(STYLES)
  const [moodsList, setMoodsList] = useState<string[]>(MOODS)
  const [lightingList, setLightingList] = useState<string[]>(LIGHTING)
  const [catSaving, setCatSaving] = useState(false)
  const [catSaved, setCatSaved] = useState(false)
  const [newSub, setNewSub] = useState<Record<string, string>>({})
  const [newItem, setNewItem] = useState<Record<string, string>>({})

  const LIST_SETTERS: Record<string, [string[], (v: string[]) => void]> = {
    Styles: [stylesList, setStylesList],
    Moods: [moodsList, setMoodsList],
    Lighting: [lightingList, setLightingList],
  }

  const addListItem = (group: string) => {
    const label = (newItem[group] || '').trim()
    if (!label) return
    const [list, set] = LIST_SETTERS[group]
    if (!list.some(x => x.toLowerCase() === label.toLowerCase())) set([...list, label])
    setNewItem(v => ({ ...v, [group]: '' }))
    setCatSaved(false)
  }

  const removeListItem = (group: string, label: string) => {
    const [list, set] = LIST_SETTERS[group]
    set(list.filter(x => x !== label))
    setCatSaved(false)
  }

  const subsFor = (catId: string) => taxonomy.find(c => c.id === catId)?.subcategories ?? []

  const addSub = (catId: string) => {
    const label = (newSub[catId] || '').trim()
    if (!label) return
    setTaxonomy(t => t.map(c => c.id === catId && !c.subcategories.some(s => s.label.toLowerCase() === label.toLowerCase())
      ? { ...c, subcategories: [...c.subcategories, makeSubcategory(label)] }
      : c))
    setNewSub(s => ({ ...s, [catId]: '' }))
    setCatSaved(false)
  }

  const removeSub = (catId: string, subId: string) => {
    setTaxonomy(t => t.map(c => c.id === catId ? { ...c, subcategories: c.subcategories.filter(s => s.id !== subId) } : c))
    setCatSaved(false)
  }

  const saveTaxonomy = async () => {
    setCatSaving(true)
    await fetch('/api/categories', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
      body: JSON.stringify({ categories: taxonomy, styles: stylesList, moods: moodsList, lighting: lightingList }),
    }).catch(() => {})
    setCatSaving(false)
    setCatSaved(true)
  }

  // ── Load stats ──────────────────────────────────────────
  useEffect(() => {
    loadStats()
    fetch('/api/categories')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.categories) && d.categories.length) setTaxonomy(d.categories)
        if (Array.isArray(d.styles) && d.styles.length) setStylesList(d.styles)
        if (Array.isArray(d.moods) && d.moods.length) setMoodsList(d.moods)
        if (Array.isArray(d.lighting) && d.lighting.length) setLightingList(d.lighting)
      })
      .catch(() => {})
  }, [])

  async function loadStats() {
    setLoadingStats(true)
    // Paginate past the 1000-row Supabase cap — otherwise the counter
    // silently stops at 1000 no matter how big the base is
    const PAGE = 1000
    const all: Array<{ type: string; plan: string }> = []
    for (let from = 0; from < 50000; from += PAGE) {
      const { data } = await supabase.from('assets').select('type, plan')
        .neq('type', 'Config').neq('type', 'Usage').neq('type', 'Generation')
        .range(from, from + PAGE - 1)
      if (!data) break
      all.push(...(data as Array<{ type: string; plan: string }>))
      if (data.length < PAGE) break
    }
    if (all.length) {
      const byType: Record<string, number> = {}
      const byPlan: Record<string, number> = {}
      all.forEach(r => {
        byType[r.type] = (byType[r.type] ?? 0) + 1
        byPlan[r.plan] = (byPlan[r.plan] ?? 0) + 1
      })
      setStats({ total: all.length, byType, byPlan })
    }
    setLoadingStats(false)
  }

  async function loadAssets() {
    setLoadingAssets(true)
    const PAGE = 1000
    const all: AssetRow[] = []
    for (let from = 0; from < 50000; from += PAGE) {
      const { data } = await supabase
        .from('assets')
        .select('*')
        .neq('type', 'Config').neq('type', 'Usage') // system rows are not assets
        .order('created_at', { ascending: false })
        .range(from, from + PAGE - 1)
      if (!data) break
      all.push(...(data as AssetRow[]))
      if (data.length < PAGE) break
    }
    setAssets(all)
    setLoadingAssets(false)
  }

  useEffect(() => {
    if (activeTab === 'assets') {
      loadAssets()
      // file sizes for the Size column / sort
      ;(async () => {
        try {
          const res = await fetch('/api/admin/storage-cleanup?sizes=1', { headers: await adminHeaders() })
          const j = await res.json()
          if (j?.sizes) setFileSizes(j.sizes)
        } catch { /* sizes optional */ }
      })()
    }
    if (activeTab === 'settings') {
      fetch('/api/admin/catalog-config', { cache: 'no-store' })
        .then(r => r.json())
        .then(j => { if (j?.config) setDispCfg(j.config) })
        .catch(() => {})
      ;(async () => {
        const res = await fetch('/api/admin/delete-category', { headers: await adminHeaders() })
        const j = await res.json().catch(() => ({}))
        if (Array.isArray(j.categories)) setCatList(j.categories)
      })()
      // Live-preview samples: one real asset per type from the base
      ;(async () => {
        const samples: Array<{ label: string; url: string }> = []
        for (const t of ['Character', 'Location', 'Vehicle']) {
          const { data } = await supabase
            .from('assets').select('file_url').eq('type', t)
            .order('created_at', { ascending: false }).limit(1)
          const u = data?.[0]?.file_url
          if (typeof u === 'string' && u.includes('/storage/v1/object/public/')) {
            samples.push({ label: t, url: u.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=440&quality=62&resize=contain' })
          }
        }
        setPreviewSamples(samples)
      })()
    }
  }, [activeTab])

  // ── Settings: save display config ─────────────────────────
  async function saveDisplayCfg() {
    setDispSaving(true)
    setDispSaved(false)
    const res = await fetch('/api/admin/catalog-config', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
      body: JSON.stringify({ config: dispCfg }),
    })
    setDispSaving(false)
    if (res.ok) {
      setDispSaved(true)
      setTimeout(() => setDispSaved(false), 2500)
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Save failed')
    }
  }

  // ── Settings: delete whole category ────────────────────────
  async function deleteCategory() {
    if (!delCat) return
    const found = catList.find(c => c.category === delCat)
    const n = found?.count ?? '?'
    if (!confirm(`Удалить раздел «${delCat.trim()}» ЦЕЛИКОМ?\n${n} ассетов + их файлы в Storage будут удалены НАВСЕГДА.`)) return
    setDelBusy(true)
    setDelMsg('')
    const res = await fetch('/api/admin/delete-category', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
      body: JSON.stringify({ category: delCat }),
    })
    const j = await res.json().catch(() => ({}))
    setDelBusy(false)
    if (res.ok) {
      setDelMsg(`Удалено: ${j.deleted} ассетов, ${j.storageRemoved} файлов из Storage.`)
      setCatList(prev => prev.filter(c => c.category !== delCat))
      setDelCat('')
      loadStats()
    } else {
      setDelMsg(`Ошибка: ${j.error || 'delete failed'}`)
    }
  }

  // ── Assets table: filters / sorting / bulk selection ──────
  const [assetSearch, setAssetSearch] = useState('')
  const [assetType, setAssetType] = useState('All')
  const [assetSort, setAssetSort] = useState<'date' | 'name' | 'size'>('date')
  const [fileSizes, setFileSizes] = useState<Record<string, number>>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  function storagePathOf(url: string | null | undefined): string {
    if (!url || !url.includes('/assets/')) return ''
    return decodeURIComponent(url.split('/assets/')[1]?.split('?')[0] || '')
  }
  const sizeOf = (a: AssetRow) => fileSizes[storagePathOf(a.file_url)] ?? 0

  const assetTypes = useMemo(() => ['All', ...Array.from(new Set(assets.map(a => a.type))).filter(Boolean).sort()], [assets])

  const visibleRows = useMemo(() => {
    const q = assetSearch.trim().toLowerCase()
    let rows = assets.filter(a =>
      (assetType === 'All' || a.type === assetType) &&
      (!q || (a.title || '').toLowerCase().includes(q) || storagePathOf(a.file_url).toLowerCase().includes(q))
    )
    if (assetSort === 'name') rows = [...rows].sort((x, y) => (x.title || '').localeCompare(y.title || ''))
    if (assetSort === 'size') rows = [...rows].sort((x, y) => sizeOf(y) - sizeOf(x))
    return rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assets, assetSearch, assetType, assetSort, fileSizes])

  function toggleSelect(id: string) {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleSelectAll() {
    setSelectedIds(prev => prev.size === visibleRows.length ? new Set() : new Set(visibleRows.map(r => r.id)))
  }

  async function bulkAction(kind: 'hide' | 'delete') {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const verb = kind === 'delete' ? 'УДАЛИТЬ НАВСЕГДА (вместе с файлами)' : 'скрыть из каталога (обратимо)'
    if (!confirm(`${ids.length} ассетов — ${verb}. Продолжить?`)) return
    setBulkBusy(true)
    const headers = await adminHeaders()
    let done = 0
    for (const id of ids) {
      try {
        if (kind === 'delete') {
          const r = await fetch(`/api/admin/assets?id=${encodeURIComponent(id)}`, { method: 'DELETE', headers })
          if (r.ok) { done++; setAssets(prev => prev.filter(a => a.id !== id)) }
        } else {
          const r = await fetch('/api/admin/assets', { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ id, is_public: false }) })
          if (r.ok) { done++; setAssets(prev => prev.map(a => a.id === id ? { ...a, is_public: false } : a)) }
        }
      } catch { /* keep going */ }
    }
    setSelectedIds(new Set())
    setBulkBusy(false)
    alert(`Готово: ${done}/${ids.length}`)
    if (kind === 'delete') loadStats()
  }

  // Style is a tag, not a category (owner's rule): style:cartoon etc.
  // "realistic" = default = NO style tag, so setting it just strips style:*
  const [bulkStyle, setBulkStyle] = useState('cartoon')
  async function bulkSetStyle() {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const label = bulkStyle === 'realistic' ? 'Realistic (убрать style-тег)' : `style:${bulkStyle}`
    if (!confirm(`${ids.length} ассетов — задать стиль ${label}?`)) return
    setBulkBusy(true)
    const headers = await adminHeaders()
    let done = 0
    for (const id of ids) {
      const row = assets.find(a => a.id === id)
      if (!row) continue
      const tags = (row.tags || []).filter(t => !String(t).toLowerCase().startsWith('style:'))
      if (bulkStyle !== 'realistic') tags.push(`style:${bulkStyle}`)
      try {
        const r = await fetch('/api/admin/assets', { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ id, tags }) })
        if (r.ok) { done++; setAssets(prev => prev.map(a => a.id === id ? { ...a, tags } : a)) }
      } catch { /* keep going */ }
    }
    setSelectedIds(new Set())
    setBulkBusy(false)
    alert(`Стиль обновлён: ${done}/${ids.length}`)
  }

  function fmtSize(b: number): string {
    if (!b) return '—'
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB'
    return (b / 1048576).toFixed(1) + ' MB'
  }

  // ── Hide / show asset (main action — fully reversible) ────
  const [togglingId, setTogglingId] = useState<string | null>(null)
  async function toggleVisibility(asset: AssetRow) {
    const next = asset.is_public === false // hidden → show, visible → hide
    setTogglingId(asset.id)
    const res = await fetch('/api/admin/assets', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
      body: JSON.stringify({ id: asset.id, is_public: next }),
    })
    if (res.ok) {
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_public: next } : a))
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Toggle failed')
    }
    setTogglingId(null)
  }

  // ── Delete asset ────────────────────────────────────────
  async function deleteAsset(asset: AssetRow) {
    if (!confirm(`Delete "${asset.title}"? This cannot be undone.`)) return
    setDeletingId(asset.id)
    // All writes go through the authenticated server route
    const res = await fetch(`/api/admin/assets?id=${encodeURIComponent(asset.id)}`, {
      method: 'DELETE',
      headers: await adminHeaders(),
    })
    if (res.ok) {
      setAssets(prev => prev.filter(a => a.id !== asset.id))
      setStats(prev => ({ ...prev, total: prev.total - 1 }))
    } else {
      const j = await res.json().catch(() => ({}))
      alert(j.error || 'Delete failed')
    }
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
            const res = await fetch('/api/ai-name', { method: 'POST', headers: await adminHeaders(), body: fd })
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
        const headers = await adminHeaders()
        const uploadOne = async (f: File | Blob, path: string): Promise<string> => {
          const fd = new FormData()
          fd.append('file', f)
          fd.append('path', path)
          const r = await fetch('/api/admin/upload', { method: 'POST', headers, body: fd })
          const j = await r.json()
          if (!r.ok || !j.url) throw new Error(j.error || 'Storage upload failed')
          return j.url
        }

        const fileUrl = await uploadOne(uploadFile, filePath)

        const isImage = item.file.type.startsWith('image/')
        let thumbUrl = isImage ? fileUrl : ''
        // Character sheets: upload a face-crop as the thumbnail
        if (isImage && item.faceBox) {
          try {
            const faceFile = await cropFace(item.file, item.faceBox)
            const fPath = filePath.replace(/\.[a-z0-9]+$/i, '') + '-face.jpg'
            thumbUrl = await uploadOne(faceFile, fPath)
          } catch { /* fall back to full image */ }
        }

        const baseTags = item.tags.split(',').map(t => t.trim()).filter(Boolean)
        // Append style/mood/subcategory as structured tags
        const extraTags = [batchSubcategory, batchStyle, batchMood].filter(Boolean)
        const tags = Array.from(new Set([...baseTags, ...extraTags]))

        const insRes = await fetch('/api/admin/assets', {
          method: 'POST',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({
            title: item.title.trim(),
            type: item.type,
            category: batchCategory || item.type,
            plan: batchPlan,
            tags,
            description: item.description || '',
            file_url: fileUrl,
            thumbnail_url: thumbUrl,
          }),
        })
        if (!insRes.ok) {
          const j = await insRes.json().catch(() => ({}))
          throw new Error(j.error || 'DB insert failed')
        }

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
        {(['overview', 'assets', 'batch', 'categories', 'settings'] as const).map(tab => (
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
        <a
          href="/engine"
          className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-medium transition-all"
          style={{ color: '#9765E0' }}
        >
          <LineIcon d={TYPE_ICON.engine} size={15} /> Engine
        </a>
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
            <div>
              {/* Filter / bulk panel */}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <input
                  value={assetSearch}
                  onChange={e => setAssetSearch(e.target.value)}
                  placeholder="Поиск: название или имя файла…"
                  className="input-field text-sm"
                  style={{ minWidth: 260, padding: '8px 12px' }}
                />
                <select value={assetType} onChange={e => setAssetType(e.target.value)} className="input-field text-sm" style={{ padding: '8px 12px' }}>
                  {assetTypes.map(t => <option key={t} value={t}>{t === 'All' ? 'Все типы' : t}</option>)}
                </select>
                <select value={assetSort} onChange={e => setAssetSort(e.target.value as 'date' | 'name' | 'size')} className="input-field text-sm" style={{ padding: '8px 12px' }}>
                  <option value="date">По дате</option>
                  <option value="name">По имени</option>
                  <option value="size">По размеру (крупные сверху)</option>
                </select>
                <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>{visibleRows.length} шт.</span>
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-xs font-semibold" style={{ color: '#9765E0' }}>выбрано: {selectedIds.size}</span>
                    <select
                      value={bulkStyle}
                      onChange={e => setBulkStyle(e.target.value)}
                      disabled={bulkBusy}
                      style={{ fontSize: 12, backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 8px', color: 'var(--fg)' }}
                    >
                      <option value="cartoon">🎨 Cartoon</option>
                      <option value="anime">Anime</option>
                      <option value="3d">3D</option>
                      <option value="realistic">Realistic (сброс)</option>
                    </select>
                    <button
                      onClick={bulkSetStyle}
                      disabled={bulkBusy}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                      style={{ color: '#CE95FB', border: '1px solid rgba(206,149,251,0.4)', backgroundColor: 'rgba(206,149,251,0.08)' }}
                    >
                      {bulkBusy ? '…' : 'Задать стиль'}
                    </button>
                    <button
                      onClick={() => bulkAction('hide')}
                      disabled={bulkBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(255,170,60,0.12)', color: '#ffaa3c', border: '1px solid rgba(255,170,60,0.4)' }}
                    >
                      {bulkBusy ? '…' : 'Скрыть выбранные'}
                    </button>
                    <button
                      onClick={() => bulkAction('delete')}
                      disabled={bulkBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(220,60,60,0.12)', color: '#e06060', border: '1px solid rgba(220,60,60,0.4)' }}
                    >
                      {bulkBusy ? '…' : 'Удалить выбранные'}
                    </button>
                  </>
                )}
              </div>

              <div className="card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th className="px-3 py-3">
                      <input type="checkbox" checked={visibleRows.length > 0 && selectedIds.size === visibleRows.length} onChange={toggleSelectAll} style={{ cursor: 'pointer' }} />
                    </th>
                    {['', 'Title', 'Type', 'Category', 'Size', 'Tags', 'Date', ''].map(h => (
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
                  {visibleRows.map(asset => {
                    const typeColor = TYPE_COLOR[asset.type] ?? '#CE95FB'
                    const isDeleting = deletingId === asset.id
                    return (
                      <tr
                        key={asset.id}
                        style={{ borderBottom: '1px solid var(--border)', backgroundColor: selectedIds.has(asset.id) ? 'rgba(151,101,224,0.06)' : undefined }}
                      >
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selectedIds.has(asset.id)} onChange={() => toggleSelect(asset.id)} style={{ cursor: 'pointer' }} />
                        </td>
                        {/* Thumbnail — horizontal 16:9 preview of the full sheet */}
                        <td className="px-3 py-2">
                          {asset.file_url || asset.thumbnail_url ? (
                            <img
                              src={asset.file_url || asset.thumbnail_url}
                              alt=""
                              className="rounded-lg object-cover"
                              style={{ width: 96, height: 54 }}
                              loading="lazy"
                            />
                          ) : (
                            <div
                              className="rounded-lg flex items-center justify-center"
                              style={{ width: 96, height: 54, backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-subtle)' }}
                            >
                              <LineIcon d={TYPE_ICON[asset.type] || TYPE_ICON.grid} size={20} />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium max-w-[180px]" style={{ color: 'var(--fg)' }}>
                          <span className="block truncate">{asset.title}</span>
                          {asset.is_public === false && (
                            <span
                              className="inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: 'rgba(255,170,60,0.14)', color: '#ffaa3c', border: '1px solid rgba(255,170,60,0.35)' }}
                            >
                              Скрыт
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium" style={{ color: typeColor }}>{asset.type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>{asset.category}</td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                          {fmtSize(sizeOf(asset))}
                        </td>
                        <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: 'var(--fg-subtle)' }}>
                          {Array.isArray(asset.tags) ? asset.tags.join(', ') : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-subtle)' }}>
                          {new Date(asset.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => toggleVisibility(asset)}
                            disabled={togglingId === asset.id}
                            title={asset.is_public === false ? 'Показать в каталоге' : 'Скрыть из каталога (обратимо)'}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all mb-1"
                            style={{
                              color: asset.is_public === false ? '#00C264' : '#ffaa3c',
                              backgroundColor: asset.is_public === false ? 'rgba(0,194,100,0.08)' : 'rgba(255,170,60,0.08)',
                            }}
                          >
                            {togglingId === asset.id ? <SpinnerIcon /> : (asset.is_public === false ? 'Показать' : 'Скрыть')}
                          </button>
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
                  {taxonomy.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
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
                  {subsFor(batchCategory).map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
              {/* Style */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Style</label>
                <select className="input-field" value={batchStyle} onChange={e => setBatchStyle(e.target.value)}>
                  <option value="">— None —</option>
                  {stylesList.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Mood */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--fg-muted)' }}>Mood</label>
                <select className="input-field" value={batchMood} onChange={e => setBatchMood(e.target.value)}>
                  <option value="">— None —</option>
                  {moodsList.map(m => <option key={m} value={m}>{m}</option>)}
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

      {/* ── Categories Tab — live-editable taxonomy ─────────────── */}
      {activeTab === 'categories' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              Taxonomy mirrors your Dropbox folders: type → subcategories. Add or remove right here, then hit Save.
            </p>
            <button
              onClick={saveTaxonomy}
              disabled={catSaving}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #9765E0, #534FA5)', boxShadow: '0 0 12px rgba(151,101,224,0.4)' }}
            >
              {catSaving ? 'Saving…' : catSaved ? 'Saved ✓' : 'Save'}
            </button>
          </div>

          {/* Editable category grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {taxonomy.map(cat => (
              <div key={cat.id} className="card p-5" style={{ borderLeft: `3px solid ${cat.color}` }}>
                <div className="flex items-center gap-2.5 mb-3">
                  <span
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 32, height: 32, backgroundColor: `${cat.color}1a`, border: `1px solid ${cat.color}40`, color: cat.color }}
                  >
                    <LineIcon d={TYPE_ICON[cat.id] || TYPE_ICON.grid} size={16} />
                  </span>
                  <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{cat.label}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${cat.color}22`, color: cat.color }}>
                    {cat.subcategories.length} sub
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {cat.subcategories.map(s => (
                    <span
                      key={s.id}
                      className="group flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}
                    >
                      {s.label}
                      <button
                        onClick={() => removeSub(cat.id, s.id)}
                        title="Remove"
                        className="opacity-40 hover:opacity-100 transition-opacity"
                        style={{ color: '#ff5f5f' }}
                      >
                        <LineIcon d={TYPE_ICON.x} size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newSub[cat.id] || ''}
                    onChange={e => setNewSub(s => ({ ...s, [cat.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addSub(cat.id)}
                    placeholder="New subcategory…"
                    className="input-field flex-1 text-xs"
                    style={{ padding: '6px 10px' }}
                  />
                  <button
                    onClick={() => addSub(cat.id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ backgroundColor: `${cat.color}1a`, color: cat.color, border: `1px solid ${cat.color}40` }}
                  >
                    <LineIcon d={TYPE_ICON.plus} size={12} /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Style / Mood / Lighting — editable */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Styles', icon: TYPE_ICON.palette, items: stylesList, color: '#9765E0' },
              { label: 'Moods', icon: TYPE_ICON.smile, items: moodsList, color: '#CE95FB' },
              { label: 'Lighting', icon: TYPE_ICON.bulb, items: lightingList, color: '#00C2BA' },
            ].map(group => (
              <div key={group.label} className="card p-5" style={{ borderLeft: `3px solid ${group.color}` }}>
                <div className="flex items-center gap-2 mb-3" style={{ color: group.color }}>
                  <LineIcon d={group.icon} size={16} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--fg)' }}>{group.label}</span>
                  <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: `${group.color}22`, color: group.color }}>
                    {group.items.length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {group.items.map(item => (
                    <span
                      key={item}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-subtle)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}
                    >
                      {item}
                      <button
                        onClick={() => removeListItem(group.label, item)}
                        title="Remove"
                        className="opacity-40 hover:opacity-100 transition-opacity"
                        style={{ color: '#ff5f5f' }}
                      >
                        <LineIcon d={TYPE_ICON.x} size={11} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={newItem[group.label] || ''}
                    onChange={e => setNewItem(v => ({ ...v, [group.label]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addListItem(group.label)}
                    placeholder={`New ${group.label.toLowerCase().slice(0, -1)}…`}
                    className="input-field flex-1 text-xs"
                    style={{ padding: '6px 10px' }}
                  />
                  <button
                    onClick={() => addListItem(group.label)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{ backgroundColor: `${group.color}1a`, color: group.color, border: `1px solid ${group.color}40` }}
                  >
                    <LineIcon d={TYPE_ICON.plus} size={12} /> Add
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Settings Tab ────────────────────────────────────── */}
      {activeTab === 'settings' && (
        <div className="grid gap-6 max-w-3xl">

          {/* Catalog display */}
          <div className="card p-6">
            <h3 className="font-semibold mb-1 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
              Отображение карточек в каталоге
            </h3>
            <p className="text-xs mb-5" style={{ color: 'var(--fg-subtle)' }}>
              Действует для всех посетителей сразу после сохранения.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mb-5">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--fg-muted)' }}>Картинка</label>
                <select
                  value={dispCfg.fit}
                  onChange={e => setDispCfg(c => ({ ...c, fit: e.target.value as CatalogConfig['fit'] }))}
                  className="input-field w-full text-sm"
                >
                  {FIT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--fg-muted)' }}>Форма карточки</label>
                <select
                  value={dispCfg.ratio}
                  onChange={e => setDispCfg(c => ({ ...c, ratio: e.target.value as CatalogConfig['ratio'] }))}
                  className="input-field w-full text-sm"
                >
                  {RATIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {/* Live preview — reacts instantly, BEFORE save */}
            <div className="mb-5">
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--fg-muted)' }}>
                Предпросмотр (реальные ассеты из базы, меняется сразу)
              </label>
              <div className="flex flex-wrap gap-4">
                {previewSamples.length === 0 && (
                  <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Загружаю примеры…</span>
                )}
                {previewSamples.map(s => (
                  <div key={s.label} style={{ width: 220 }}>
                    <div
                      className="rounded-xl overflow-hidden"
                      style={{
                        aspectRatio: dispCfg.ratio === 'auto' ? undefined : dispCfg.ratio,
                        backgroundColor: 'var(--bg-subtle)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.url}
                        alt={s.label}
                        className={`w-full block ${dispCfg.ratio === 'auto' ? 'h-auto' : 'h-full'}`}
                        style={dispCfg.ratio === 'auto' ? undefined : {
                          objectFit: dispCfg.fit === 'contain' ? 'contain' : 'cover',
                          objectPosition: dispCfg.fit === 'cover-top' ? 'top' : 'center',
                        }}
                      />
                    </div>
                    <p className="text-xs mt-1.5 text-center" style={{ color: 'var(--fg-subtle)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={saveDisplayCfg}
                disabled={dispSaving}
                className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg,#9765E0,#534FA5)', opacity: dispSaving ? 0.6 : 1 }}
              >
                {dispSaving ? 'Saving…' : 'Save'}
              </button>
              {dispSaved && <span className="text-sm" style={{ color: '#00C264' }}>✓ Сохранено</span>}
              <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>После Save обнови страницу каталога, чтобы увидеть результат.</span>
            </div>
          </div>

          {/* Backup */}
          <div className="card p-6" style={{ borderTop: '2px solid #00C2BA' }}>
            <h3 className="font-semibold mb-1 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
              Резервная копия базы
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--fg-subtle)' }}>
              Скачивает все ассеты (названия, теги, категории, ссылки) одним JSON-файлом.
              Жми раз в неделю и после больших изменений — файл храни в Dropbox.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={downloadBackup}
                disabled={backupBusy}
                className="px-5 py-2 rounded-lg text-sm font-semibold"
                style={{ backgroundColor: 'rgba(0,194,186,0.12)', color: '#00C2BA', border: '1px solid rgba(0,194,186,0.4)', opacity: backupBusy ? 0.6 : 1 }}
              >
                {backupBusy ? 'Готовлю…' : '⬇ Скачать бэкап'}
              </button>
              {backupMsg && <span className="text-xs" style={{ color: backupMsg.startsWith('Ошибка') ? '#e06060' : '#00C264' }}>{backupMsg}</span>}
            </div>
          </div>

          {/* Danger zone */}
          <div className="card p-6" style={{ border: '1px solid rgba(220,60,60,0.35)' }}>
            <h3 className="font-semibold mb-1 text-sm uppercase tracking-wider" style={{ color: '#e06060' }}>
              Danger zone — удалить раздел целиком
            </h3>
            <p className="text-xs mb-5" style={{ color: 'var(--fg-subtle)' }}>
              Удаляет ВСЕ ассеты раздела вместе с файлами в Storage. Отменить нельзя.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={delCat}
                onChange={e => setDelCat(e.target.value)}
                className="input-field text-sm"
                style={{ minWidth: 260 }}
              >
                <option value="">— выбери раздел —</option>
                {catList.map(c => (
                  <option key={c.category} value={c.category}>{c.category} ({c.count})</option>
                ))}
              </select>
              <button
                onClick={deleteCategory}
                disabled={!delCat || delBusy}
                className="px-5 py-2 rounded-lg text-sm font-semibold"
                style={{
                  backgroundColor: 'rgba(220,60,60,0.12)',
                  color: '#e06060',
                  border: '1px solid rgba(220,60,60,0.4)',
                  opacity: !delCat || delBusy ? 0.5 : 1,
                }}
              >
                {delBusy ? 'Deleting…' : 'Delete section'}
              </button>
            </div>
            {delMsg && <p className="text-sm mt-4" style={{ color: delMsg.startsWith('Ошибка') ? '#e06060' : '#00C264' }}>{delMsg}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminPage() {
  return (
    <AdminGate>
      <AdminDashboard />
    </AdminGate>
  )
}
