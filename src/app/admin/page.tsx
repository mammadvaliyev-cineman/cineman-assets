'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import AdminGate, { adminHeaders, toggleViewAsClient } from '@/components/AdminGate'
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
  credit_cost?: number | null
  exclusive_price?: number | null
  price_tier?: string
  exclusive_owner?: string | null
  is_free?: boolean
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
// ── Homepage: Featured collections editor (owner's brief §3).
// Up to 4 tiles: title + which catalog section it opens + cover URL.
// Empty = the homepage falls back to top categories automatically.
function HomepageFeaturedEditor() {
  // ── ALL homepage sections in one editor (DEV_batch_60 §5/§6):
  // Featured tiles (catalog cover OR uploaded promo poster with link),
  // Shop-by-category covers, hero showreel frames, New-this-week set.
  // Two modes everywhere: «Рандом всё разом» (fast) + click-to-pick (exact).
  type Tile = { title: string; cat: string; cover: string; promo?: boolean; href?: string; hideTitle?: boolean }
  type PickAsset = { id: string; title: string; file_url: string; created_at?: string }
  const CAT_OPTIONS = [...CATEGORIES.map(c => c.id), 'Free']
  const SECTION_CATS = CATEGORIES.filter(c => c.id !== 'Prop').map(c => c.id)
  const [tiles, setTiles] = useState<Tile[]>([])
  const [catCovers, setCatCovers] = useState<Record<string, string>>({})
  const [heroFrames, setHeroFrames] = useState<string[]>([])
  const [weekIds, setWeekIds] = useState<string[]>([])
  const [weekPrev, setWeekPrev] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [randBusy, setRandBusy] = useState('')
  // universal picker: which slot is being filled
  const [picker, setPicker] = useState<{ kind: 'featured' | 'cat' | 'hero' | 'week'; key: string | number } | null>(null)
  const [pickerAssets, setPickerAssets] = useState<PickAsset[]>([])
  const [pickerBusy, setPickerBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploadFor, setUploadFor] = useState<number | null>(null)

  const render = (url: string, w: number) =>
    url.includes('/storage/v1/object/public/')
      ? url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + `?width=${w}&quality=68&resize=contain`
      : url

  const baseQ = () => supabase.from('assets').select('id,title,file_url,created_at')
    .eq('is_public', true).neq('type', 'Config').neq('type', 'Usage').neq('type', 'Generation')
  const countQ = () => supabase.from('assets').select('id', { count: 'exact', head: true })
    .eq('is_public', true).neq('type', 'Config').neq('type', 'Usage').neq('type', 'Generation')

  useEffect(() => {
    fetch('/api/admin/homepage-config', { cache: 'no-store' })
      .then(r => r.json())
      .then(async j => {
        const f = (j?.config?.featured ?? []) as Tile[]
        setTiles([0, 1, 2, 3].map(i => f[i] ?? { title: '', cat: 'People', cover: '' }))
        setCatCovers(j?.config?.catCovers ?? {})
        setHeroFrames(j?.config?.heroFrames ?? [])
        const ids = (j?.config?.newWeekIds ?? []) as string[]
        setWeekIds(ids)
        if (ids.length) {
          const { data } = await supabase.from('assets').select('id,file_url').in('id', ids)
          const m: Record<string, string> = {}
          for (const a of data ?? []) m[String(a.id)] = render(String(a.file_url), 240)
          setWeekPrev(m)
        }
      })
      .catch(() => setTiles([0, 1, 2, 3].map(() => ({ title: '', cat: 'People', cover: '' }))))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const upd = (i: number, patch: Partial<Tile>) => setTiles(prev => prev.map((t, k) => k === i ? { ...t, ...patch } : t))

  async function randomOf(cat: string | null, n: number): Promise<PickAsset[]> {
    let cq = countQ(); if (cat === 'Free') cq = cq.eq('is_free', true); else if (cat) cq = cq.eq('type', cat)
    const { count } = await cq
    const span = Math.max(24, n * 3)
    const off = Math.max(0, Math.floor(Math.random() * Math.max(1, (count ?? span) - span)))
    let q = baseQ(); if (cat === 'Free') q = q.eq('is_free', true); else if (cat) q = q.eq('type', cat)
    const { data } = await q.range(off, off + span - 1)
    return (((data ?? []) as PickAsset[])).sort(() => Math.random() - 0.5).slice(0, n)
  }

  async function openPicker(kind: 'featured' | 'cat' | 'hero' | 'week', key: string | number) {
    setPicker({ kind, key }); setPickerBusy(true); setPickerAssets([])
    try {
      if (kind === 'week') {
        // «New this week» pool = the freshest 48 (order stays by date on save)
        const { data } = await baseQ().order('created_at', { ascending: false }).limit(48)
        setPickerAssets((((data ?? []) as PickAsset[])).sort(() => Math.random() - 0.5).slice(0, 24))
      } else {
        const cat = kind === 'hero' ? 'Location' : kind === 'cat' ? String(key) : (tiles[Number(key)]?.cat ?? null)
        setPickerAssets(await randomOf(cat, 24))
      }
    } finally { setPickerBusy(false) }
  }

  function pick(a: PickAsset) {
    if (!picker) return
    if (picker.kind === 'featured') upd(Number(picker.key), { cover: render(a.file_url, 1024), promo: false, href: '', hideTitle: false })
    if (picker.kind === 'cat') setCatCovers(prev => ({ ...prev, [String(picker.key)]: render(a.file_url, 480) }))
    if (picker.kind === 'hero') setHeroFrames(prev => { const n = [...prev]; n[Number(picker.key)] = render(a.file_url, 1024); return n.slice(0, 6) })
    if (picker.kind === 'week') {
      setWeekIds(prev => { const n = [...prev]; n[Number(picker.key)] = a.id; return n.slice(0, 12) })
      setWeekPrev(prev => ({ ...prev, [a.id]: render(a.file_url, 240) }))
    }
    setPicker(null)
  }

  async function randomAllCats() {
    setRandBusy('cat')
    try {
      const out: Record<string, string> = {}
      for (const id of SECTION_CATS) {
        const [a] = await randomOf(id, 1)
        if (a) out[id] = render(a.file_url, 480)
      }
      setCatCovers(out)
    } finally { setRandBusy('') }
  }
  async function randomAllHero() {
    setRandBusy('hero')
    try { setHeroFrames((await randomOf('Location', 6)).map(a => render(a.file_url, 1024))) } finally { setRandBusy('') }
  }
  async function randomAllWeek() {
    setRandBusy('week')
    try {
      // pick 12 random from the freshest 48, KEEP date order (owner's rule)
      const { data } = await baseQ().order('created_at', { ascending: false }).limit(48)
      const pool = (data ?? []) as PickAsset[]
      const chosen = [...pool].sort(() => Math.random() - 0.5).slice(0, 12)
      chosen.sort((a, b) => pool.indexOf(a) - pool.indexOf(b))
      setWeekIds(chosen.map(a => a.id))
      const m: Record<string, string> = {}
      for (const a of chosen) m[a.id] = render(a.file_url, 240)
      setWeekPrev(m)
    } finally { setRandBusy('') }
  }

  async function onUploadPromo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file === undefined || uploadFor === null) return
    setMsg('Загружаю постер…')
    try {
      const fd = new FormData(); fd.append('file', file)
      const r = await fetch('/api/admin/upload-cover', { method: 'POST', headers: await adminHeaders(), body: fd })
      const j = await r.json()
      if (j.ok) { upd(uploadFor, { cover: j.url, promo: true }); setMsg('Постер загружен — задай ссылку и сохрани') }
      else setMsg(j.error || 'Ошибка загрузки')
    } catch { setMsg('Ошибка загрузки') }
    if (fileRef.current) fileRef.current.value = ''
  }

  async function save() {
    setBusy(true); setMsg('')
    try {
      const labelFor = (cat: string) => CATEGORIES.find(c => c.id === cat)?.label ?? cat
      const featured = tiles.filter(t => t.cover.trim()).map(t => ({ ...t, title: t.title.trim() || labelFor(t.cat) }))
      const r = await fetch('/api/admin/homepage-config', {
        method: 'POST', headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ config: { featured, catCovers, heroFrames: heroFrames.filter(Boolean), newWeekIds: weekIds.filter(Boolean) } }),
      })
      const j = await r.json()
      setMsg(j.ok ? `Сохранено: витрина ${featured.length}, категории ${Object.keys(catCovers).length}, hero ${heroFrames.filter(Boolean).length}, new-this-week ${weekIds.filter(Boolean).length}. Главная обновлена.` : (j.error || 'Ошибка'))
    } catch { setMsg('Ошибка — попробуй ещё раз') }
    setBusy(false)
  }

  const slotBtn = (filled: string | undefined, onClick: () => void, w = 76, h = 46) => (
    <button onClick={onClick} title={filled ? 'Заменить' : 'Выбрать'} style={{ width: w, height: h, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', backgroundColor: '#17151E', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {filled ? <img src={filled} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 16, color: 'var(--fg-subtle)' }}>+</span>}
    </button>
  )
  const randBtn = (label: string, onClick: () => void, key: string) => (
    <button onClick={onClick} disabled={randBusy === key} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(151,101,224,0.12)', border: '1px solid rgba(151,101,224,0.4)', color: '#CE95FB', cursor: 'pointer' }}>
      {randBusy === key ? '…' : label}
    </button>
  )

  return (
    <div className="card p-6">
      <h3 className="font-semibold mb-1 text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>
        Главная — витрина, категории, hero, new this week
      </h3>
      <p className="text-xs mb-4" style={{ color: 'var(--fg-subtle)' }}>
        Везде два режима: «Рандом всё разом» или клик по слоту → выбрать точно. Пусто = автоматика. Один «Сохранить» на всё.
      </p>

      {/* ── Featured tiles (+ promo poster upload) ── */}
      <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--fg-subtle)' }}>Featured collections</p>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={onUploadPromo} style={{ display: 'none' }} />
      <div className="grid gap-3 mb-5">
        {tiles.map((t, i) => (
          <div key={i}>
            <div className="flex items-center gap-2">
              {slotBtn(t.cover || undefined, () => openPicker('featured', i))}
              <input value={t.title} onChange={e => upd(i, { title: e.target.value })} placeholder={`Плитка ${i + 1} — название`} className="input-field text-xs" style={{ padding: '8px 10px', flex: 1 }} />
              <select value={t.cat} onChange={e => upd(i, { cat: e.target.value })} className="input-field text-xs" style={{ padding: '8px 10px', width: 104 }}>
                {CAT_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <button onClick={() => { setUploadFor(i); fileRef.current?.click() }} className="text-[11px] font-semibold px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(229,169,75,0.1)', border: '1px solid rgba(229,169,75,0.4)', color: '#E5A94B', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Upload image
              </button>
              {t.cover && <button onClick={() => upd(i, { cover: '', promo: false, href: '', hideTitle: false })} className="text-[11px]" style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>}
            </div>
            {t.promo && (
              <div className="flex items-center gap-3 mt-1.5" style={{ paddingLeft: 84 }}>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(229,169,75,0.15)', color: '#E5A94B' }}>PROMO</span>
                <input value={t.href ?? ''} onChange={e => upd(i, { href: e.target.value })} placeholder="Ссылка: /catalog?free=1, ?category=… или любой URL" className="input-field text-xs" style={{ padding: '6px 10px', flex: 1 }} />
                <label className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--fg-muted)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  <input type="checkbox" checked={Boolean(t.hideTitle)} onChange={e => upd(i, { hideTitle: e.target.checked })} />
                  скрыть подпись
                </label>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Shop by category covers ── */}
      <div className="flex items-center gap-3 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)', margin: 0 }}>Shop by category</p>
        {randBtn('Рандом всё разом', randomAllCats, 'cat')}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {SECTION_CATS.map(id => (
          <div key={id} className="text-center">
            {slotBtn(catCovers[id], () => openPicker('cat', id), 88, 50)}
            <p className="text-[10px] mt-0.5" style={{ color: 'var(--fg-subtle)', margin: 0 }}>{id}</p>
          </div>
        ))}
      </div>

      {/* ── Hero showreel (locations) ── */}
      <div className="flex items-center gap-3 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)', margin: 0 }}>Hero-карусель (локации)</p>
        {randBtn('Рандом всё разом', randomAllHero, 'hero')}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {[0, 1, 2, 3, 4, 5].map(i => slotBtn(heroFrames[i], () => openPicker('hero', i), 88, 50))}
      </div>

      {/* ── New this week ── */}
      <div className="flex items-center gap-3 mb-2">
        <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)', margin: 0 }}>New this week (из пула свежих, порядок по дате)</p>
        {randBtn('Рандом всё разом', randomAllWeek, 'week')}
      </div>
      <div className="flex flex-wrap gap-2 mb-5">
        {Array.from({ length: 12 }, (_, i) => slotBtn(weekIds[i] ? weekPrev[weekIds[i]] : undefined, () => openPicker('week', i), 66, 42))}
      </div>

      {/* ── Universal picker ── */}
      {picker && (
        <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-bold" style={{ color: 'var(--fg)' }}>Кликни фото для слота</span>
            <button onClick={() => openPicker(picker.kind, picker.key)} disabled={pickerBusy} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: 'rgba(151,101,224,0.12)', border: '1px solid rgba(151,101,224,0.4)', color: '#CE95FB', cursor: 'pointer' }}>
              {pickerBusy ? '…' : 'Ещё варианты'}
            </button>
            <button onClick={() => setPicker(null)} className="text-[11px] ml-auto" style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>Закрыть</button>
          </div>
          {pickerBusy && pickerAssets.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Загружаю варианты…</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 8 }}>
              {pickerAssets.map(a => (
                <button key={a.id} onClick={() => pick(a)} title={a.title} style={{ padding: 0, border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', cursor: 'pointer', backgroundColor: '#17151E', aspectRatio: '16/10' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={render(a.file_url, 240)} alt={a.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={busy} className="btn-primary text-xs px-4 py-2 font-bold">
          {busy ? 'Сохраняю…' : 'Сохранить всё'}
        </button>
        {msg && <span className="text-xs" style={{ color: '#5EEAD4' }}>{msg}</span>}
      </div>
    </div>
  )
}

// ── Provider balances (owner's spec): Kie.ai credits via their API,
// Gemini → deep link to Google Cloud Billing (pay-as-you-go, no
// prepaid balance). Goal: see at a glance when to top up.
function ProviderBalances() {
  const [data, setData] = useState<{
    kie: { ok: boolean; credits?: number; error?: string }
    gemini: { billingUrl: string; note: string }
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/provider-balance', { headers: await adminHeaders(), cache: 'no-store' })
      setData(await r.json())
    } catch { setData(null) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])
  const kie = data?.kie
  const low = (kie?.credits ?? Infinity) < 200
  const empty = (kie?.credits ?? Infinity) < 50
  return (
    <div className="card p-6 mb-8" style={{ borderTop: '2px solid #F4B41A' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Provider balances</h3>
        <button
          onClick={load}
          className="text-xs font-semibold px-3 py-1 rounded-lg"
          style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}
        >
          {loading ? 'Checking…' : 'Refresh'}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Kie.ai — real credits number */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Kie.ai</span>
            <a href="https://kie.ai/billing" target="_blank" rel="noreferrer" className="text-[11px] font-semibold" style={{ color: '#CE95FB' }}>Top up →</a>
          </div>
          {loading ? (
            <div className="text-2xl font-bold" style={{ color: 'var(--fg-subtle)' }}>…</div>
          ) : kie?.ok ? (
            <>
              <div className="text-2xl font-bold" style={{ color: empty ? '#DC3C3C' : low ? '#F4B41A' : '#00C2BA' }}>
                {kie.credits?.toLocaleString('en-US')} <span className="text-sm font-semibold" style={{ color: 'var(--fg-muted)' }}>credits</span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: empty ? '#DC3C3C' : low ? '#F4B41A' : 'var(--fg-subtle)' }}>
                {empty ? 'Almost empty — 4K upscale and Studio will fail. Top up now.' : low ? 'Running low — top up before a long run.' : 'Powers 4K upscale (Topaz) and Studio video (Seedance).'}
              </p>
            </>
          ) : (
            <p className="text-sm font-semibold" style={{ color: '#DC3C3C' }}>{kie?.error || 'Unavailable'}</p>
          )}
        </div>
        {/* Gemini — no prepaid balance, link to billing */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Gemini / Google AI</span>
          </div>
          <p className="text-[11px] mb-3" style={{ color: 'var(--fg-subtle)' }}>{data?.gemini?.note || 'Pay-as-you-go — check month spend and the cap in Google Cloud Billing.'}</p>
          <a
            href={data?.gemini?.billingUrl || 'https://console.cloud.google.com/billing'}
            target="_blank" rel="noreferrer"
            className="inline-block text-xs font-bold px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: 'rgba(151,101,224,0.15)', border: '1px solid #9765E0', color: '#CE95FB' }}
          >
            Open Google Billing →
          </a>
        </div>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<'overview' | 'assets' | 'batch' | 'categories' | 'pricing' | 'settings'>('overview')
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
      loadPricing() // price column shows «(default)» from pricing_defaults
      // file sizes for the Size column / sort
      ;(async () => {
        try {
          const res = await fetch('/api/admin/storage-cleanup?sizes=1', { headers: await adminHeaders() })
          const j = await res.json()
          if (j?.sizes) setFileSizes(j.sizes)
        } catch { /* sizes optional */ }
      })()
    }
    if (activeTab === 'pricing') loadPricing()
    if (activeTab === 'categories') loadCombos()
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

  async function bulkAction(kind: 'show' | 'hide' | 'delete') {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return
    const verb = kind === 'delete' ? 'УДАЛИТЬ НАВСЕГДА (вместе с файлами)' : kind === 'hide' ? 'скрыть из каталога (обратимо)' : 'ОТКРЫТЬ в публичный каталог'
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
          const pub = kind === 'show'
          const r = await fetch('/api/admin/assets', { method: 'PATCH', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ id, is_public: pub }) })
          if (r.ok) { done++; setAssets(prev => prev.map(a => a.id === id ? { ...a, is_public: pub } : a)) }
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

  // Bulk FREE (owner's funnel): opt-in only, never a default — the admin
  // selects a batch and flips it free (price 0) or back to paid (5)
  async function bulkFree(free: boolean) {
    const ids = Array.from(selectedIds)
    if (ids.length === 0 || bulkBusy) return
    if (!confirm(`${ids.length} ассетов — сделать ${free ? 'FREE (цена 0)' : 'платными (цена 5)'}?`)) return
    setBulkBusy(true)
    const headers = await adminHeaders()
    let done = 0
    for (const id of ids) {
      try {
        const r = await fetch('/api/admin/assets', {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ id, is_free: free, credit_cost: free ? 0 : 5 }),
        })
        if (r.ok) { done++; setAssets(prev => prev.map(a => a.id === id ? { ...a, is_free: free, credit_cost: free ? 0 : 5 } : a)) }
      } catch { /* keep going */ }
    }
    setSelectedIds(new Set())
    setBulkBusy(false)
    alert(`${free ? 'Free' : 'Платные'}: ${done}/${ids.length}`)
  }

  // ── Pricing tab: tier defaults + plan grants (pricing_defaults) ──
  const PRICE_LABELS: Record<string, string> = {
    standard: 'Standard — цена скачивания', premium: 'Premium — топовые ассеты', exclusive: 'Exclusive — выкуп эксклюзива',
    plan_free: 'Free — кредитов в месяц', plan_personal: 'Personal — кредитов в месяц', plan_pro: 'Pro — кредитов в месяц',
    gen_base: 'Генерация — база (Nano Banana)', gen_4k: 'Апскейл 2K→4K (по запросу)',
    gen_video: 'Видео-генерация (Seedance)',
  }
  const [priceRows, setPriceRows] = useState<Record<string, number>>({})
  const [priceBusy, setPriceBusy] = useState(false)
  const loadPricing = async () => {
    try {
      const r = await fetch('/api/admin/pricing', { headers: await adminHeaders() })
      const j = await r.json()
      if (Array.isArray(j.rows)) {
        const m: Record<string, number> = {}
        for (const row of j.rows) m[row.tier] = Number(row.credits)
        setPriceRows(m)
      }
    } catch { /* noop */ }
  }
  // ── A/B-batch: Credits & refunds (админ) ────────────────────
  const [ccToast, setCcToast] = useState('')
  const setToast = (m: string) => { setCcToast(m); setTimeout(() => setCcToast(''), 3000) }
  const [ccEmail, setCcEmail] = useState('mammadvaliyev@gmail.com')
  const [ccAmount, setCcAmount] = useState('100')
  const [ccBusy, setCcBusy] = useState(false)
  const [refEmail, setRefEmail] = useState('')
  const [refRows, setRefRows] = useState<{ assetId: string; title: string; cost: number; exclusive: boolean }[] | null>(null)
  const [refCredits, setRefCredits] = useState<number | null>(null)
  const [refBusy, setRefBusy] = useState<string | null>(null)

  const addCredits = async () => {
    if (ccBusy) return
    setCcBusy(true)
    try {
      const res = await fetch('/api/admin/add-credits', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ email: ccEmail.trim(), amount: Number(ccAmount) }),
      })
      const json = await res.json()
      if (json.ok) setToast(`Баланс ${ccEmail.trim()}: ${json.credits} кредитов`)
      else setToast(json.error || 'Не получилось')
    } catch { setToast('Не получилось — попробуй ещё раз') }
    finally { setCcBusy(false) }
  }

  const loadRefunds = async () => {
    if (!refEmail.trim()) return
    try {
      const res = await fetch(`/api/admin/refund?email=${encodeURIComponent(refEmail.trim())}`, { headers: await adminHeaders() })
      const json = await res.json()
      if (json.purchases) { setRefRows(json.purchases); setRefCredits(json.credits ?? null) }
      else { setRefRows([]); setToast(json.error || 'Не найдено') }
    } catch { setToast('Не получилось загрузить покупки') }
  }

  const doRefund = async (assetId: string) => {
    if (refBusy) return
    setRefBusy(assetId)
    try {
      const res = await fetch('/api/admin/refund', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ email: refEmail.trim(), assetId }),
      })
      const json = await res.json()
      if (json.ok) { setToast(`Возврат ${json.refunded} кредитов сделан`); loadRefunds() }
      else setToast(json.error || 'Возврат не прошёл')
    } catch { setToast('Возврат не прошёл') }
    finally { setRefBusy(null) }
  }

  const savePricing = async () => {
    setPriceBusy(true)
    try {
      const rows = Object.entries(priceRows).map(([tier, credits]) => ({ tier, credits }))
      const r = await fetch('/api/admin/pricing', { method: 'POST', headers: { 'content-type': 'application/json', ...(await adminHeaders()) }, body: JSON.stringify({ rows }) })
      const j = await r.json()
      alert(j.ok ? `Сохранено: ${j.saved}` : (j.error || 'Ошибка'))
    } catch { alert('Ошибка сохранения') } finally { setPriceBusy(false) }
  }

  // ── Category visibility: hide/show whole sections without SQL ──
  type Combo = { type: string; category: string; total: number; visible: number }
  const [combos, setCombos] = useState<Combo[]>([])
  const [comboBusy, setComboBusy] = useState<string | null>(null)
  const loadCombos = async () => {
    try {
      const r = await fetch('/api/admin/category-visibility', { headers: await adminHeaders() })
      const j = await r.json()
      if (Array.isArray(j.combos)) setCombos(j.combos)
    } catch { /* noop */ }
  }
  async function setComboVisibility(c: Combo, isPublic: boolean) {
    const verb = isPublic ? 'ОТКРЫТЬ в каталог' : 'скрыть из каталога (обратимо)'
    if (!confirm(`${c.type} / ${c.category} — ${verb} все ${c.total} ассетов?`)) return
    setComboBusy(`${c.type}|||${c.category}`)
    try {
      const r = await fetch('/api/admin/category-visibility', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ type: c.type, category: c.category, is_public: isPublic }),
      })
      const j = await r.json()
      if (j.ok) loadCombos()
      else alert(j.error || 'Не сохранилось')
    } catch { alert('Не сохранилось — попробуй ещё раз') } finally { setComboBusy(null) }
  }

  // ── Asset price editor modal: tier + override (NULL = follows tier) ──
  const [priceTarget, setPriceTarget] = useState<AssetRow | null>(null)
  const [pTier, setPTier] = useState('standard')
  const [pOverride, setPOverride] = useState('')
  const [pExclusive, setPExclusive] = useState('')
  const [pBusy, setPBusy] = useState(false)
  function openPriceEditor(asset: AssetRow) {
    setPriceTarget(asset)
    setPTier(asset.price_tier || 'standard')
    setPOverride(asset.credit_cost == null ? '' : String(asset.credit_cost))
    setPExclusive(asset.exclusive_price == null ? '' : String(asset.exclusive_price))
  }
  async function savePriceEditor() {
    if (!priceTarget || pBusy) return
    const credit_cost = pOverride.trim() === '' ? null : Math.max(0, Math.round(Number(pOverride)))
    const exclusive_price = pExclusive.trim() === '' ? null : Math.max(0, Math.round(Number(pExclusive)))
    if ((credit_cost !== null && !Number.isFinite(credit_cost)) || (exclusive_price !== null && !Number.isFinite(exclusive_price))) { alert('Числа или пусто'); return }
    setPBusy(true)
    try {
      const r = await fetch('/api/admin/assets', { method: 'PATCH', headers: { 'content-type': 'application/json', ...(await adminHeaders()) }, body: JSON.stringify({ id: priceTarget.id, price_tier: pTier, credit_cost, exclusive_price }) })
      const j = await r.json()
      if (j.ok) {
        setAssets(prev => prev.map(a => a.id === priceTarget.id ? { ...a, price_tier: pTier, credit_cost, exclusive_price } : a))
        setPriceTarget(null)
      } else alert(j.error || 'Не сохранилось')
    } catch { alert('Не сохранилось') } finally { setPBusy(false) }
  }

  function fmtSize(b: number): string {
    if (!b) return '—'
    if (b < 1024 * 1024) return (b / 1024).toFixed(0) + ' KB'
    return (b / 1048576).toFixed(1) + ' MB'
  }

  // ── Revoke exclusive: return a bought-out asset to the catalog ──
  const [revokingId, setRevokingId] = useState<string | null>(null)
  async function revokeExclusive(asset: AssetRow) {
    if (!confirm(`Return "${asset.title}" to the catalog?\nThe exclusive purchase will be revoked — everyone can buy and download it again.`)) return
    setRevokingId(asset.id)
    try {
      const r = await fetch('/api/admin/assets', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', ...(await adminHeaders()) },
        body: JSON.stringify({ id: asset.id, exclusive_owner: null, exclusive_sold_at: null }),
      })
      const j = await r.json()
      if (j.ok) setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, exclusive_owner: null } : a))
      else alert(j.error || 'Revoke failed')
    } catch { alert('Revoke failed — try again') } finally { setRevokingId(null) }
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
        <div className="flex items-center gap-3">
          {/* «View as client» lives IN THE ADMIN (owner's spec §8): flips the
              whole site into the customer view; the golden «Back to admin»
              button in the navbar brings you back (admin itself is locked
              while the client view is on) */}
          <button
            onClick={toggleViewAsClient}
            className="text-xs font-bold px-3.5 py-1.5 rounded-full"
            style={{
              backgroundColor: 'rgba(229,169,75,0.1)',
              border: '1px solid rgba(229,169,75,0.45)',
              color: '#E5A94B', cursor: 'pointer',
            }}
          >
            View as client
          </button>
          <span
            className="badge text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: 'rgba(0,194,186,0.15)', color: '#00C2BA', border: '1px solid rgba(0,194,186,0.3)' }}
          >
            ● Live
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 rounded-xl p-1 mb-8 w-fit"
        style={{ backgroundColor: 'var(--bg-subtle)' }}
      >
        {(['overview', 'assets', 'batch', 'categories', 'pricing', 'settings'] as const).map(tab => (
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
          {/* Provider balances — Kie.ai credits + Gemini billing link */}
          <ProviderBalances />

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
                      onClick={() => bulkFree(true)}
                      disabled={bulkBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(45,212,196,0.12)', color: '#2DD4C4', border: '1px solid rgba(45,212,196,0.4)' }}
                    >
                      {bulkBusy ? '…' : 'Сделать Free'}
                    </button>
                    <button
                      onClick={() => bulkFree(false)}
                      disabled={bulkBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(151,101,224,0.12)', color: '#CE95FB', border: '1px solid rgba(151,101,224,0.4)' }}
                    >
                      {bulkBusy ? '…' : 'Сделать платными'}
                    </button>
                    <button
                      onClick={() => bulkAction('show')}
                      disabled={bulkBusy}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                      style={{ backgroundColor: 'rgba(0,194,100,0.12)', color: '#00C264', border: '1px solid rgba(0,194,100,0.4)' }}
                    >
                      {bulkBusy ? '…' : 'Показать выбранные'}
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
                    {['', 'Title', 'Type', 'Category', 'Цена', 'Size', 'Tags', 'Date', ''].map(h => (
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
                          {asset.exclusive_owner && (
                            <span
                              className="inline-block mt-1 ml-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ backgroundColor: 'rgba(94,234,212,0.12)', color: '#5EEAD4', border: '1px solid rgba(94,234,212,0.35)' }}
                            >
                              Sold
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs font-medium" style={{ color: typeColor }}>{asset.type}</span>
                        </td>
                        <td className="px-4 py-3 text-xs" style={{ color: 'var(--fg-muted)' }}>{asset.category}</td>
                        <td className="px-4 py-3 text-xs" style={{ whiteSpace: 'nowrap' }}>
                          <button
                            onClick={() => openPriceEditor(asset)}
                            title="Тир и override цены (пусто = следует тиру)"
                            className="font-semibold"
                            style={{ color: '#CE95FB', textDecoration: 'underline dotted', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          >
                            {asset.credit_cost ?? `(${priceRows[asset.price_tier || 'standard'] ?? '·'})`} / excl {asset.exclusive_price ?? `(${priceRows['exclusive'] ?? '·'})`}
                            <span className="block text-[10px] font-normal" style={{ color: 'var(--fg-subtle)' }}>{asset.price_tier || 'standard'}</span>
                          </button>
                        </td>
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
                          {asset.exclusive_owner && (
                            <button
                              onClick={() => revokeExclusive(asset)}
                              disabled={revokingId === asset.id}
                              title="Revoke the exclusive purchase — the asset returns to open sale"
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all mb-1"
                              style={{ color: '#5EEAD4', backgroundColor: 'rgba(94,234,212,0.08)' }}
                            >
                              {revokingId === asset.id ? <SpinnerIcon /> : 'Return to catalog'}
                            </button>
                          )}
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

          {/* Раздел целиком: скрыть/показать без SQL */}
          <div className="card p-5 mb-8">
            <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--fg)' }}>Видимость разделов</h3>
            <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
              Скрыть или открыть ВСЕ ассеты раздела одной кнопкой. Обратимо — файлы остаются в базе.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {combos.map(c => {
                const key = `${c.type}|||${c.category}`
                const fullyHidden = c.visible === 0
                return (
                  <div key={key} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                    <span className="text-xs font-medium truncate" style={{ color: fullyHidden ? 'var(--fg-subtle)' : 'var(--fg)' }}>
                      {c.type} / {c.category || '—'}
                    </span>
                    <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--fg-subtle)' }}>
                      {c.visible}/{c.total}
                    </span>
                    <span className="ml-auto flex gap-1.5">
                      <button
                        onClick={() => setComboVisibility(c, true)}
                        disabled={comboBusy === key || c.visible === c.total}
                        className="px-2 py-1 rounded text-[11px] font-semibold disabled:opacity-30"
                        style={{ color: '#00C264', backgroundColor: 'rgba(0,194,100,0.1)' }}
                      >
                        {comboBusy === key ? '…' : 'Показать все'}
                      </button>
                      <button
                        onClick={() => setComboVisibility(c, false)}
                        disabled={comboBusy === key || fullyHidden}
                        className="px-2 py-1 rounded text-[11px] font-semibold disabled:opacity-30"
                        style={{ color: '#ffaa3c', backgroundColor: 'rgba(255,170,60,0.1)' }}
                      >
                        {comboBusy === key ? '…' : 'Скрыть все'}
                      </button>
                    </span>
                  </div>
                )
              })}
              {combos.length === 0 && <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Загружаю разделы…</p>}
            </div>
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
      {/* ── Pricing Tab ─────────────────────────────────────── */}
      {activeTab === 'pricing' && (
        <div className="max-w-2xl space-y-6">
          <div className="card p-7">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Цены за скачивание (тиры)</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--fg-muted)' }}>
              Ассет без override следует своему тиру. Меняешь тир — все «follows default» подтягиваются автоматически.
            </p>
            <div className="space-y-3">
              {['standard', 'premium', 'exclusive'].map(t => (
                <label key={t} className="flex items-center justify-between gap-4">
                  <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>{PRICE_LABELS[t]}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="number" min={0}
                      value={priceRows[t] ?? ''}
                      onChange={e => setPriceRows(prev => ({ ...prev, [t]: Number(e.target.value) }))}
                      className="input-field text-sm text-right"
                      style={{ width: 90, padding: '7px 10px' }}
                    />
                    <span className="text-sm font-bold"><svg width="15" height="15" viewBox="0 0 24 24" style={{ display: 'inline', verticalAlign: '-0.15em' }}><polygon points="8,5 12,5 12,10 4,10" fill="#5EEAD4" /><polygon points="12,5 16,5 20,10 12,10" fill="#2DD4C4" /><polygon points="4,10 12,10 12,21" fill="#2DD4C4" /><polygon points="12,10 20,10 12,21" fill="#0F9E8E" /><polygon points="8,5 9.6,5 6,10 4,10" fill="#ffffff" fillOpacity="0.5" /></svg></span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="card p-7">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Кредиты по тарифам (в месяц)</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--fg-muted)' }}>
              Начисления при подписке и месячном сбросе. Долларовые цены живут в LemonSqueezy — здесь только кредиты.
            </p>
            <div className="space-y-3">
              {['plan_free', 'plan_personal', 'plan_pro'].map(t => (
                <label key={t} className="flex items-center justify-between gap-4">
                  <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>{PRICE_LABELS[t]}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="number" min={0}
                      value={priceRows[t] ?? ''}
                      onChange={e => setPriceRows(prev => ({ ...prev, [t]: Number(e.target.value) }))}
                      className="input-field text-sm text-right"
                      style={{ width: 90, padding: '7px 10px' }}
                    />
                    <span className="text-sm font-bold"><svg width="15" height="15" viewBox="0 0 24 24" style={{ display: 'inline', verticalAlign: '-0.15em' }}><polygon points="8,5 12,5 12,10 4,10" fill="#5EEAD4" /><polygon points="12,5 16,5 20,10 12,10" fill="#2DD4C4" /><polygon points="4,10 12,10 12,21" fill="#2DD4C4" /><polygon points="12,10 20,10 12,21" fill="#0F9E8E" /><polygon points="8,5 9.6,5 6,10 4,10" fill="#ffffff" fillOpacity="0.5" /></svg></span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="card p-7">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Генерация (Studio)</h2>
            <p className="text-xs mb-5" style={{ color: 'var(--fg-muted)' }}>
              Одна валюта со скачиваниями. Себестоимость $0.02–0.12 за картинку — маржа заложена в цену.
            </p>
            <div className="space-y-3">
              {['gen_base', 'gen_4k', 'gen_video'].map(t => (
                <label key={t} className="flex items-center justify-between gap-4">
                  <span className="text-sm" style={{ color: 'var(--fg-muted)' }}>{PRICE_LABELS[t]}</span>
                  <span className="flex items-center gap-2">
                    <input
                      type="number" min={0}
                      value={priceRows[t] ?? ''}
                      onChange={e => setPriceRows(prev => ({ ...prev, [t]: Number(e.target.value) }))}
                      className="input-field text-sm text-right"
                      style={{ width: 90, padding: '7px 10px' }}
                    />
                    <span className="text-sm font-bold"><svg width="15" height="15" viewBox="0 0 24 24" style={{ display: 'inline', verticalAlign: '-0.15em' }}><polygon points="8,5 12,5 12,10 4,10" fill="#5EEAD4" /><polygon points="12,5 16,5 20,10 12,10" fill="#2DD4C4" /><polygon points="4,10 12,10 12,21" fill="#2DD4C4" /><polygon points="12,10 20,10 12,21" fill="#0F9E8E" /><polygon points="8,5 9.6,5 6,10 4,10" fill="#ffffff" fillOpacity="0.5" /></svg></span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="card p-7">
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Кредиты и возвраты</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--fg-muted)' }}>
              Пополнение любого аккаунта по email (себя и тестовых). Возврат = кредиты назад + ассет уходит из владения; эксклюзив возвращается в каталог. Юзеры сами возвращать не могут.
            </p>
            {ccToast && <p className="text-xs mb-3" style={{ color: '#7EE7C7' }}>{ccToast}</p>}
            <div className="flex items-center gap-2 mb-6">
              <input value={ccEmail} onChange={e => setCcEmail(e.target.value)} placeholder="email" className="input-field text-sm" style={{ flex: 1, padding: '8px 10px' }} />
              <input value={ccAmount} onChange={e => setCcAmount(e.target.value)} type="number" className="input-field text-sm text-right" style={{ width: 90, padding: '8px 10px' }} />
              <button onClick={addCredits} disabled={ccBusy} className="btn-primary text-xs px-4 py-2 font-bold">{ccBusy ? '…' : 'Add credits'}</button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <input value={refEmail} onChange={e => setRefEmail(e.target.value)} placeholder="email юзера для возврата" className="input-field text-sm" style={{ flex: 1, padding: '8px 10px' }} onKeyDown={e => { if (e.key === 'Enter') loadRefunds() }} />
              <button onClick={loadRefunds} className="btn-secondary text-xs px-4 py-2 font-bold">Показать покупки</button>
            </div>
            {refRows && (
              refRows.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Покупок нет.</p>
              ) : (
                <div className="space-y-2">
                  {refCredits !== null && <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Баланс: {refCredits} кредитов</p>}
                  {refRows.map(r => (
                    <div key={r.assetId} className="flex items-center justify-between gap-3 text-xs rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-subtle)' }}>
                      <span className="truncate" style={{ color: 'var(--fg)' }}>{r.title}{r.exclusive ? ' · EXCLUSIVE' : ''}</span>
                      <span style={{ color: 'var(--fg-muted)', flexShrink: 0 }}>{r.cost}⚡</span>
                      <button onClick={() => doRefund(r.assetId)} disabled={refBusy === r.assetId} className="text-xs font-bold" style={{ color: '#e06060', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                        {refBusy === r.assetId ? '…' : 'Refund'}
                      </button>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
          <button
            onClick={savePricing}
            disabled={priceBusy}
            className="btn-primary px-8 py-2.5 text-sm font-bold"
          >
            {priceBusy ? 'Сохраняю…' : 'Сохранить цены'}
          </button>
        </div>
      )}

      {/* ── Asset price editor modal (tier + override) ──────── */}
      {priceTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(8,5,15,0.80)', backdropFilter: 'blur(8px)' }}
          onClick={() => !pBusy && setPriceTarget(null)}
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
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--fg)' }}>Цена ассета</h2>
            <p className="text-xs mb-5 truncate" style={{ color: 'var(--fg-muted)' }}>{priceTarget.title}</p>

            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--fg-muted)' }}>Тир</label>
            <select value={pTier} onChange={e => setPTier(e.target.value)} className="input-field w-full text-sm mb-4" style={{ padding: '9px 12px' }}>
              <option value="standard">Standard ({priceRows['standard'] ?? 5}⚡)</option>
              <option value="premium">Premium ({priceRows['premium'] ?? 20}⚡)</option>
              <option value="exclusive">Exclusive ({priceRows['exclusive'] ?? 50}⚡)</option>
            </select>

            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
              Credit cost — override <span style={{ color: 'var(--fg-subtle)' }}>(пусто = follows default)</span>
            </label>
            <input type="number" min={0} value={pOverride} onChange={e => setPOverride(e.target.value)} placeholder={`по тиру: ${priceRows[pTier] ?? '—'}⚡`} className="input-field w-full text-sm mb-4" style={{ padding: '9px 12px' }} />

            <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
              Exclusive buyout — override <span style={{ color: 'var(--fg-subtle)' }}>(пусто = {priceRows['exclusive'] ?? 50}⚡)</span>
            </label>
            <input type="number" min={0} value={pExclusive} onChange={e => setPExclusive(e.target.value)} placeholder={`по умолчанию: ${priceRows['exclusive'] ?? 50}⚡`} className="input-field w-full text-sm mb-5" style={{ padding: '9px 12px' }} />

            <div className="flex gap-3">
              <button onClick={savePriceEditor} disabled={pBusy} className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: 'linear-gradient(135deg, #9765E0, #534FA5)', opacity: pBusy ? 0.5 : 1 }}>
                {pBusy ? 'Сохраняю…' : 'Сохранить'}
              </button>
              <button onClick={() => { setPOverride(''); setPExclusive('') }} disabled={pBusy} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ color: 'var(--fg-muted)', border: '1px solid var(--border)' }} title="Очистить override — цена следует тиру">
                Use default
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="grid gap-6 max-w-3xl">

          {/* Homepage — Featured collections (owner curates the showcase) */}
          <HomepageFeaturedEditor />

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
