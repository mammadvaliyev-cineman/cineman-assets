'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { CreditGem } from '@/components/AssetGrid'

// ─────────────────────────────────────────────────────────────
// CINEMAN STUDIO — clean one-screen generator (Higgsfield/Seedance
// style, owner's spec). No wizard. Three columns:
//   1) controls: preset · upload · prompt with @-asset mentions ·
//      audio · model/duration/aspect/resolution · Generate · N💎
//   2) big preview of the selected video
//   3) generation details: model, structured prompt, settings, rerun
// History below: List/Grid, expand, size slider, date groups,
// multi-select bulk download/delete. Generations are owned by the
// creator (free re-downloads, also land in the Library).
// Director's Engine (shot-list mode) stays a separate Pro mode later.
// ─────────────────────────────────────────────────────────────

type RefAsset = { id: string; title: string; image: string; kind: string; handle?: string }

// SHORT @-HANDLES (owner's §9 fix): the prompt uses a 2-word slug
// (@YoungMan), never the full descriptive title. Renameable per ref.
function autoHandle(title: string): string {
  const words = String(title).replace(/[^\w\s-]/g, '').split(/\s+/).filter(Boolean)
  const base = words.slice(0, 2).map(w => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('')
  return (base || 'Ref').slice(0, 20)
}
function uniqueHandle(base: string, taken: RefAsset[], skipId?: string): string {
  let h = base, i = 2
  while (taken.some(r => r.id !== skipId && (r.handle ?? autoHandle(r.title)) === h)) { h = base + i; i++ }
  return h
}
function handleOf(r: RefAsset): string { return r.handle ?? autoHandle(r.title) }
type Gen = {
  id: string; model: string | null; prompt: string | null
  structured: Record<string, string> | null
  settings: { model?: string; duration?: number; aspect?: string; resolution?: string; audio?: boolean; preset?: string } | null
  refs: RefAsset[] | null
  r2_key: string | null; state: string; favorite: boolean; cost: number; created_at: string; url: string | null
}

const PRESETS: Record<string, { label: string; hint: string; lighting: string; mood: string; color: string }> = {
  commercial: { label: 'Commercial', hint: 'Clean, high-key, aspirational', lighting: 'clean high-key commercial lighting', mood: 'energetic, aspirational', color: '#9765E0' },
  film: { label: 'Film', hint: 'Cinematic, moody, film grain', lighting: 'cinematic low-key lighting, soft film grain', mood: 'dramatic, atmospheric', color: '#534FA5' },
  product: { label: 'Product', hint: 'Studio softbox, precise', lighting: 'studio softbox lighting, seamless background', mood: 'premium, precise', color: '#00C2BA' },
  music: { label: 'Music', hint: 'Neon, rhythm, stylized', lighting: 'neon practicals and strobe accents', mood: 'stylized, rhythmic', color: '#CE95FB' },
}

// ── DIRECTOR'S CONSOLE (DEV_studio_panel §1): expandable model MENU,
// one compact button — not tiles. Meta drives which options show and
// the LIVE price multiplier (mirrored by the API route — same math).
const MODELS_UI: Record<string, { label: string; tag: string; meta: string; durations: number[]; resolutions: string[]; audio: boolean; mult: number; beta?: boolean }> = {
  'seedance-2':      { label: 'Seedance 2.0',      tag: 'Native 4K · fast',  meta: 'up to 1080p · 15s · audio', durations: [5, 10, 15], resolutions: ['480p', '720p', '1080p'], audio: true, mult: 1 },
  'kling-3':         { label: 'Kling 3.0',         tag: 'Cinematic · audio', meta: 'up to 1080p · 10s', durations: [5, 10],     resolutions: ['720p', '1080p'], audio: true, mult: 1.2, beta: true },
  'seedance-2-fast': { label: 'Seedance 2.0 Fast', tag: 'Draft · cheap',     meta: 'up to 720p · 15s · audio',  durations: [5, 10, 15], resolutions: ['480p', '720p'], audio: true, mult: 0.6 },
}
const CAMERA_MOVES = ['none', 'static shot', 'slow pan', 'dolly in', 'handheld', 'orbit'] as const

const MENTION_TABS = [
  { id: 'Characters', types: ['People', 'Character'] },
  { id: 'Locations', types: ['Location'] },
  { id: 'Props', types: ['Prop', 'Vehicle'] },
] as const

function thumb(url: string, w = 200): string {
  if (!url || !url.includes('/storage/v1/object/public/')) return url
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + `?width=${w}&quality=62&resize=contain`
}

function refSheet(url: string): string {
  // full reference sheet at a resolution Seedance can actually use
  if (!url || !url.includes('/storage/v1/object/public/')) return url
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=1400&quality=80&resize=contain'
}

const dateLabel = (iso: string) => {
  const d = new Date(iso), now = new Date()
  const today = d.toDateString() === now.toDateString()
  const yest = new Date(now.getTime() - 864e5).toDateString() === d.toDateString()
  return today ? 'Today' : yest ? 'Yesterday' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function StudioPage() {
  const { user } = useAuth()

  // ── controls state ──────────────────────────────────────────
  const [preset, setPreset] = useState<keyof typeof PRESETS>('commercial')
  const [presetOpen, setPresetOpen] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [refs, setRefs] = useState<RefAsset[]>([])
  const [uploads, setUploads] = useState<{ image?: string; video?: string; audio?: string }>({})
  const [uploading, setUploading] = useState(false)
  const [audio, setAudio] = useState(false)
  const [model, setModel] = useState<string>('seedance-2')
  const [modelOpen, setModelOpen] = useState(false)
  const [advOpen, setAdvOpen] = useState(false)
  const [camera, setCamera] = useState<string>('none')
  const [negative, setNegative] = useState('')
  const [consistency, setConsistency] = useState(70)
  const [seed, setSeed] = useState('')
  const [castTab, setCastTab] = useState<'Cast' | 'Locations'>('Cast')
  const [balance, setBalance] = useState<number | null>(null)
  const [duration, setDuration] = useState(5)
  const [aspect, setAspect] = useState('16:9')
  const [resolution, setResolution] = useState('720p')
  const [price, setPrice] = useState(25)
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  // ── mention picker ──────────────────────────────────────────
  const [pickOpen, setPickOpen] = useState(false)
  const [pickTab, setPickTab] = useState<(typeof MENTION_TABS)[number]['id']>('Characters')
  const [pickQuery, setPickQuery] = useState('')
  type PickRow = { id: string; title: string; type: string; file_url: string; mine: boolean; owned: boolean; isFree: boolean; cost: number }
  const [pickRows, setPickRows] = useState<PickRow[]>([])
  const [mineIds, setMineIds] = useState<Set<string>>(new Set())
  const [purchasedIds, setPurchasedIds] = useState<Set<string>>(new Set())
  const [pickSource, setPickSource] = useState<'library' | 'catalog'>('library')
  const [hoverRow, setHoverRow] = useState<PickRow | null>(null)
  const [buyBusy, setBuyBusy] = useState<string | null>(null)

  // ── history ─────────────────────────────────────────────────
  const [history, setHistory] = useState<Gen[]>([])
  const [selected, setSelected] = useState<Gen | null>(null)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [size, setSize] = useState(100)
  const [expanded, setExpanded] = useState(false)
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
  }, [])

  // price + user's owned/saved ids (they rank first in the @-picker)
  useEffect(() => {
    supabase.from('pricing_defaults').select('credits').eq('tier', 'gen_video').single()
      .then(({ data }) => { if (data) setPrice(Number(data.credits)) })
  }, [])
  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('purchases').select('asset_id').eq('user_id', user.id),
      supabase.from('favorites').select('asset_id').eq('user_id', user.id),
    ]).then(([p, f]) => {
      const s = new Set<string>()
      const bought = new Set<string>()
      for (const r of p.data || []) { s.add(String(r.asset_id)); bought.add(String(r.asset_id)) }
      for (const r of f.data || []) s.add(String(r.asset_id))
      setMineIds(s)
      setPurchasedIds(bought)
    })
  }, [user])

  // Balance near Generate (§6) — total pool, live via the credits event
  useEffect(() => {
    if (!user) { setBalance(null); return }
    const load = () => {
      supabase.from('profiles').select('credits, topup_credits').eq('id', user.id).single()
        .then(({ data }) => { if (data) setBalance(Number(data.credits ?? 0) + Number(data.topup_credits ?? 0)) })
    }
    load()
    const on = (e: Event) => { const d = (e as CustomEvent).detail; if (typeof d === 'number') setBalance(d); else load() }
    window.addEventListener('cineman-credits-changed', on)
    return () => window.removeEventListener('cineman-credits-changed', on)
  }, [user])

  // DRAFT AUTOSAVE (§extra): the scene survives reloads — prompt, refs,
  // uploads and every setting go to localStorage (debounced)
  const draftLoaded = useRef(false)
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem('cineman_studio_draft') || 'null')
      if (d) {
        if (typeof d.prompt === 'string') setPrompt(d.prompt)
        if (Array.isArray(d.refs)) setRefs(d.refs)
        if (d.uploads && typeof d.uploads === 'object') setUploads(d.uploads)
        if (d.model && MODELS_UI[d.model]) setModel(d.model)
        if ([5, 10, 15].includes(Number(d.duration))) setDuration(Number(d.duration))
        if (['16:9', '9:16', '1:1'].includes(d.aspect)) setAspect(d.aspect)
        if (['480p', '720p', '1080p'].includes(d.resolution)) setResolution(d.resolution)
        if (d.preset && PRESETS[d.preset as keyof typeof PRESETS]) setPreset(d.preset)
        if (typeof d.audio === 'boolean') setAudio(d.audio)
        if (typeof d.camera === 'string') setCamera(d.camera)
        if (typeof d.negative === 'string') setNegative(d.negative)
        if (Number.isFinite(Number(d.consistency))) setConsistency(Number(d.consistency))
        if (typeof d.seed === 'string') setSeed(d.seed)
      }
    } catch { /* noop */ }
    // MODEL MATCH deep-link (?model=…) — overrides the saved draft
    try {
      const m = new URLSearchParams(window.location.search).get('model')
      if (m && MODELS_UI[m]) setModel(m)
    } catch { /* noop */ }
    draftLoaded.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (!draftLoaded.current) return
    const t = setTimeout(() => {
      try { localStorage.setItem('cineman_studio_draft', JSON.stringify({ prompt, refs, uploads, model, duration, aspect, resolution, preset, audio, camera, negative, consistency, seed })) } catch { /* noop */ }
    }, 400)
    return () => clearTimeout(t)
  }, [prompt, refs, uploads, model, duration, aspect, resolution, preset, audio, camera, negative, consistency, seed])

  const loadHistory = useCallback(async () => {
    if (!user) return
    try {
      const res = await fetch('/api/studio/video?list=1', { headers: await authHeaders() })
      const json = await res.json()
      if (json.items) {
        setHistory(json.items)
        setSelected(prev => prev ? json.items.find((i: Gen) => i.id === prev.id) ?? json.items[0] ?? null : json.items[0] ?? null)
      }
    } catch { /* noop */ }
  }, [user, authHeaders])
  useEffect(() => { loadHistory() }, [loadHistory])

  // ── @ mention search ────────────────────────────────────────
  useEffect(() => {
    if (!pickOpen) return
    const types = MENTION_TABS.find(t => t.id === pickTab)!.types
    const q = supabase.from('assets')
      .select('id,title,type,file_url,credit_cost,is_free')
      .in('type', types as unknown as string[]).eq('is_public', true).limit(60)
    ;(pickQuery.trim() ? q.ilike('title', `%${pickQuery.trim()}%`) : q).then(({ data }) => {
      let rows: PickRow[] = (data || []).map(a => ({
        id: String(a.id), title: String(a.title), type: String(a.type), file_url: String(a.file_url),
        mine: mineIds.has(String(a.id)),
        owned: purchasedIds.has(String(a.id)),
        isFree: Boolean(a.is_free),
        cost: a.credit_cost == null ? 5 : Number(a.credit_cost),
      }))
      // «My library» (§3a) = what the user already owns or saved
      if (pickSource === 'library') rows = rows.filter(r => r.mine)
      rows.sort((a, b) => Number(b.owned) - Number(a.owned) || Number(b.mine) - Number(a.mine))
      setPickRows(rows)
    })
  }, [pickOpen, pickTab, pickQuery, mineIds, purchasedIds, pickSource])

  // BUY & USE (§3a — the main upsell): purchase happens the moment the
  // asset is needed. /api/download records ownership + spends credits;
  // the asset drops straight into the references.
  // 2-tap purchase (owner's §9 fix): first tap arms «Confirm · N◆»,
  // second tap actually spends — no accidental charges
  const [confirmBuyId, setConfirmBuyId] = useState<string | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function armBuy(a: PickRow) {
    setConfirmBuyId(a.id)
    if (confirmTimer.current) clearTimeout(confirmTimer.current)
    confirmTimer.current = setTimeout(() => setConfirmBuyId(null), 5000)
  }

  async function buyAndUse(a: PickRow) {
    if (buyBusy) return
    setConfirmBuyId(null)
    setBuyBusy(a.id)
    try {
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ assetId: a.id }),
      })
      const json = await res.json()
      if (res.status === 402 && json.code === 'credits') { window.dispatchEvent(new Event('cineman-open-topup')); return }
      if (!res.ok) { say(json.error || 'Purchase failed'); return }
      if (typeof json.remaining === 'number') window.dispatchEvent(new CustomEvent('cineman-credits-changed', { detail: json.remaining }))
      else window.dispatchEvent(new Event('cineman-credits-changed'))
      setPurchasedIds(prev => new Set(prev).add(a.id))
      setMineIds(prev => new Set(prev).add(a.id))
      pickAsset(a)
      // the spend is VISIBLE: toast with the exact charge + new balance,
      // and the navbar chip animates via the credits event above
      say(`−${a.cost} ◆ · Added to library · Balance ${typeof json.remaining === 'number' ? json.remaining : '…'}`)
    } catch { say('Purchase failed') }
    finally { setBuyBusy(null) }
  }

  function onPromptChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value
    setPrompt(v)
    const caret = e.target.selectionStart ?? v.length
    const before = v.slice(0, caret)
    const m = before.match(/@([\w-]*)$/)
    if (m) { setPickOpen(true); setPickQuery(m[1]) } else setPickOpen(false)
  }

  function pickAsset(a: { id: string; title: string; file_url: string; type: string }) {
    setRefs(prev => {
      if (prev.some(r => r.id === a.id)) return prev
      const handle = uniqueHandle(autoHandle(a.title), prev)
      // the trailing "@query" becomes the SHORT handle, not the long title
      setPrompt(pp => pp.match(/@([\w-]*)$/) ? pp.replace(/@([\w-]*)$/, `@${handle} `) : pp + (pp && !pp.endsWith(' ') ? ' ' : '') + `@${handle} `)
      return [...prev, { id: a.id, title: a.title, image: refSheet(a.file_url), kind: a.type, handle }]
    })
    setPickOpen(false)
    promptRef.current?.focus()
  }

  // rename a handle in place — updates the chip AND every @mention in the prompt
  const [editingHandle, setEditingHandle] = useState<string | null>(null)
  const [handleDraft, setHandleDraft] = useState('')
  function commitHandle(r: RefAsset) {
    const clean = handleDraft.replace(/[^\w-]/g, '').slice(0, 20)
    setEditingHandle(null)
    if (!clean) return
    setRefs(prev => {
      const next = uniqueHandle(clean, prev, r.id)
      const old = handleOf(r)
      if (next !== old) setPrompt(pp => pp.replace(new RegExp('@' + old + '(?![\\w-])', 'g'), '@' + next))
      return prev.map(x => x.id === r.id ? { ...x, handle: next } : x)
    })
  }

  // ── upload media (optional) ─────────────────────────────────
  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 25 * 1024 * 1024) { say('Max 25 MB'); return }
    setUploading(true)
    try {
      const kind = file.type.startsWith('video') ? 'video' : file.type.startsWith('audio') ? 'audio' : 'image'
      const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '')
      const path = `genrefs/${user.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('assets').upload(path, file, { contentType: file.type })
      if (error) { say('Upload failed'); return }
      const url = supabase.storage.from('assets').getPublicUrl(path).data.publicUrl
      setUploads(prev => ({ ...prev, [kind]: url }))
      say(`${kind[0].toUpperCase() + kind.slice(1)} attached`)
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // ── generate ────────────────────────────────────────────────
  async function generate(overrides?: { prompt?: string; settings?: Gen['settings']; refs?: RefAsset[] }) {
    if (!user) { say('Sign in to generate'); return }
    const p = (overrides?.prompt ?? prompt).trim()
    if (!p) { say('Describe your shot first'); return }
    if (generating) return
    setGenerating(true)
    setProgress(2)
    try {
      const pr = PRESETS[(overrides?.settings?.preset as keyof typeof PRESETS) ?? preset]
      const useRefs = overrides?.refs ?? refs
      const structured = {
        Character: useRefs.filter(r => ['People', 'Character'].includes(r.kind)).map(r => r.title).join(', ') || '—',
        Action: p,
        Scene: useRefs.filter(r => r.kind === 'Location').map(r => r.title).join(', ') || '—',
        Lighting: pr.lighting,
        Mood: pr.mood,
      }
      const settings = overrides?.settings ?? { model, duration, aspect, resolution, audio, preset, camera, negative, consistency, seed }
      let fullPrompt = p
      if (!overrides?.prompt) {
        const parts = [p]
        if (camera && camera !== 'none') parts.push(`camera: ${camera}`)
        parts.push(`${pr.lighting}, ${pr.mood}`)
        if (consistency >= 60 && useRefs.length) parts.push('strictly preserve the exact appearance of the referenced characters and locations')
        fullPrompt = parts.join('. ') + '.'
        if (negative.trim()) fullPrompt += ` Avoid: ${negative.trim()}.`
      }
      const res = await fetch('/api/studio/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ prompt: fullPrompt, structured, settings, refs: useRefs, uploads }),
      })
      const json = await res.json()
      if (res.status === 402 && json.code === 'credits') { say(`Not enough credits (${json.cost} needed)`); window.dispatchEvent(new Event('cineman-open-topup')); return }
      if (res.status === 503 && json.code === 'soon') { say('Video generation — coming soon'); return }
      if (!json.genId) { say(json.error || 'Could not start the render'); return }
      if (typeof json.credits === 'number') window.dispatchEvent(new CustomEvent('cineman-credits-changed', { detail: json.credits }))
      await loadHistory()

      // poll until done (Seedance renders take a few minutes)
      for (let i = 0; i < 120; i++) {
        await new Promise(r => setTimeout(r, 5000))
        const pres = await fetch(`/api/studio/video?genId=${json.genId}`, { headers: await authHeaders() })
        const pj = await pres.json()
        if (pj.state === 'done') { say('Ready — saved to History and your Library'); break }
        if (pj.state === 'fail') { say(pj.error || 'Render failed — credits refunded'); break }
        setProgress(Math.max(4, Math.min(96, Number(pj.progress) || (4 + i * 2))))
      }
      await loadHistory()
    } catch { say('Generation failed — try again') }
    finally { setGenerating(false); setProgress(0) }
  }

  // ── history actions ─────────────────────────────────────────
  async function toggleFavorite(g: Gen) {
    await supabase.from('generations').update({ favorite: !g.favorite }).eq('id', g.id)
    setHistory(prev => prev.map(x => x.id === g.id ? { ...x, favorite: !g.favorite } : x))
    setSelected(prev => prev?.id === g.id ? { ...prev, favorite: !g.favorite } : prev)
  }
  async function removeGens(ids: string[]) {
    await fetch('/api/studio/video', { method: 'DELETE', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify({ ids }) })
    setChecked(new Set())
    setSelected(prev => prev && ids.includes(prev.id) ? null : prev)
    await loadHistory()
    say('Deleted')
  }
  function bulkDownload() {
    const items = history.filter(g => checked.has(g.id) && g.url)
    items.forEach((g, i) => setTimeout(() => { const a = document.createElement('a'); a.href = g.url!; a.download = ''; a.click() }, i * 600))
  }
  const copyPrompt = (g: Gen) => { navigator.clipboard.writeText(g.prompt || '').then(() => say('Prompt copied')) }

  const groups: [string, Gen[]][] = []
  for (const g of history) {
    const label = dateLabel(g.created_at)
    const last = groups[groups.length - 1]
    if (last && last[0] === label) last[1].push(g)
    else groups.push([label, [g]])
  }
  const cardW = Math.round(120 + (size / 100) * 340)

  // LIVE COST (§6) — mirrors the API's computeCost exactly
  const modelUi = MODELS_UI[model] ?? MODELS_UI['seedance-2']
  const genCost = Math.max(1, Math.round(price * modelUi.mult * (duration / 5) * (resolution === '1080p' ? 1.5 : resolution === '480p' ? 0.7 : 1)))

  const inputStyle: React.CSSProperties = { padding: '7px 9px', fontSize: 12 }

  // ── UI ──────────────────────────────────────────────────────
  return (
    <div className="max-w-[1500px] mx-auto px-5 py-6">
      {/* Top bar: title + history controls */}
      <div className="flex items-center gap-3 mb-5">
        <h1 className="text-xl font-bold mr-2" style={{ color: 'var(--fg)' }}>Cineman Studio</h1>
        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(0,194,186,0.12)', color: '#00C2BA', border: '1px solid rgba(0,194,186,0.3)' }}>{modelUi.label}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} className="px-3 py-1 rounded-md text-xs font-bold"
              style={view === v ? { background: 'linear-gradient(135deg,#9765E0,#534FA5)', color: 'white' } : { color: 'var(--fg-muted)' }}>
              {v === 'grid' ? 'Grid' : 'List'}
            </button>
          ))}
        </div>
        <button onClick={() => setExpanded(v => !v)} title={expanded ? 'Back to the generator' : 'Expand history'}
          className="p-1.5 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d={expanded ? 'M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5' : 'M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7'} /></svg>
        </button>
        <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>Preview size</span>
        <input type="range" min={0} max={100} value={size} onChange={e => setSize(Number(e.target.value))} style={{ width: 110, accentColor: '#9765E0' }} />
      </div>

      {/* 3 columns (hidden when history is expanded) */}
      {!expanded && (
        <div className="grid gap-5 mb-8" style={{ gridTemplateColumns: '320px 1fr 280px' }}>
          {/* ── LEFT: controls ─────────────────────────────── */}
          <div className="card p-4 flex flex-col gap-4" style={{ alignSelf: 'start' }}>
            {/* MODEL SELECTOR (§1): one compact button, expandable menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setModelOpen(v => !v)}
                className="w-full rounded-xl p-3 text-left"
                style={{ border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', backgroundColor: 'color-mix(in srgb, var(--accent) 9%, transparent)', cursor: 'pointer' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div style={{ minWidth: 0 }}>
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)', margin: 0 }}>Model</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--accent-soft)', margin: '1px 0 0' }}>
                      {modelUi.label}
                      {modelUi.beta && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'var(--fg-subtle)' }}>beta</span>}
                    </p>
                    <p className="text-[11px]" style={{ color: 'var(--fg-muted)', margin: '1px 0 0' }}>{modelUi.tag} · {modelUi.meta}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, transform: modelOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
                </div>
              </button>
              {modelOpen && (
                <div style={{
                  position: 'absolute', top: '104%', left: 0, right: 0, zIndex: 40,
                  backgroundColor: '#120D1D', border: '1px solid var(--border)', borderRadius: 12,
                  boxShadow: '0 14px 40px rgba(0,0,0,0.65)', padding: 6,
                }}>
                  {Object.entries(MODELS_UI).map(([k, mu]) => (
                    <button
                      key={k}
                      onClick={() => {
                        setModel(k)
                        setModelOpen(false)
                        // model-awareness: clamp options the new model can't do
                        if (!mu.durations.includes(duration)) setDuration(mu.durations[mu.durations.length - 1])
                        if (!mu.resolutions.includes(resolution)) setResolution(mu.resolutions[mu.resolutions.length - 1])
                        if (!mu.audio) setAudio(false)
                      }}
                      className="w-full text-left rounded-lg p-2.5"
                      style={{ background: k === model ? 'color-mix(in srgb, var(--accent) 16%, transparent)' : 'none', border: 'none', cursor: 'pointer', display: 'block', width: '100%' }}
                      onMouseEnter={e => { if (k !== model) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { if (k !== model) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent' }}
                    >
                      <span className="flex items-center justify-between">
                        <span className="text-xs font-bold" style={{ color: k === model ? 'var(--accent-soft)' : 'var(--fg)' }}>
                          {mu.label}{mu.beta ? ' · beta' : ''}
                        </span>
                        {k === model && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-soft)" strokeWidth="3" strokeLinecap="round"><path d="M20 6L9 17l-5-5" /></svg>}
                      </span>
                      <span className="block text-[10.5px]" style={{ color: 'var(--fg-muted)' }}>{mu.tag} · {mu.meta}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Upload */}
            <div>
              <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" onChange={onUpload} style={{ display: 'none' }} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="w-full text-xs font-bold py-2.5 rounded-lg"
                style={{ border: '1px dashed var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>
                {uploading ? 'Uploading…' : '+ Upload media (image / video / audio)'}
              </button>
              {(uploads.image || uploads.video || uploads.audio) && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(['image', 'video', 'audio'] as const).filter(k => uploads[k]).map(k => (
                    <span key={k} className="text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1" style={{ backgroundColor: 'rgba(0,194,186,0.12)', color: '#00C2BA' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {k === 'image' ? (<><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></>) : k === 'video' ? (<><rect x="2" y="4" width="14" height="16" rx="2" /><path d="M22 8l-6 4 6 4V8z" /></>) : (<><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>)}
                      </svg>
                      {k}
                      <button onClick={() => setUploads(prev => { const n = { ...prev }; delete n[k]; return n })} style={{ color: '#00C2BA', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Prompt + @mentions */}
            <div style={{ position: 'relative' }}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Prompt · type @ to insert an asset</p>
              {refs.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {refs.map(r => (
                    <span key={r.id} className="text-[11px] font-bold px-2 py-1 rounded-md flex items-center gap-1.5"
                      style={{ backgroundColor: 'rgba(151,101,224,0.16)', color: '#CE95FB', border: '1px solid rgba(151,101,224,0.35)' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.image} alt="" style={{ width: 18, height: 14, borderRadius: 3, objectFit: 'cover' }} />
                      @{handleOf(r)}
                      <button onClick={() => setRefs(prev => prev.filter(x => x.id !== r.id))} style={{ color: '#CE95FB', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <textarea
                ref={promptRef}
                value={prompt}
                onChange={onPromptChange}
                rows={4}
                placeholder="A hero walks through the city at dusk… (@ = pick your character or location)"
                className="input-field w-full text-sm"
                style={{ padding: '10px 12px', resize: 'vertical' }}
              />
              {pickOpen && (
                <div
                  onMouseLeave={() => setHoverRow(null)}
                  style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                    backgroundColor: '#120D1D', border: '1px solid var(--border)', borderRadius: 12,
                    boxShadow: '0 14px 40px rgba(0,0,0,0.65)', padding: 8,
                  }}
                >
                  {/* source: My library (default) | Browse catalog */}
                  <div className="flex gap-1 mb-1.5">
                    {([['library', 'My library'], ['catalog', 'Browse catalog']] as const).map(([k, lbl]) => (
                      <button key={k} onClick={() => setPickSource(k)} className="text-[11px] font-bold px-2.5 py-1 rounded-md"
                        style={pickSource === k ? { background: 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: 'var(--on-accent)', border: 'none', cursor: 'pointer' } : { color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {lbl}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button onClick={() => { setPickOpen(false); setHoverRow(null) }} style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>×</button>
                  </div>
                  <div className="flex gap-1 mb-2">
                    {MENTION_TABS.map(t => (
                      <button key={t.id} onClick={() => setPickTab(t.id)} className="text-[10.5px] font-bold px-2 py-0.5 rounded-md"
                        style={pickTab === t.id ? { backgroundColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent-soft)', border: 'none', cursor: 'pointer' } : { color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        {t.id}
                      </button>
                    ))}
                  </div>
                  <input
                    value={pickQuery}
                    onChange={e => setPickQuery(e.target.value)}
                    placeholder="Search by name or description…"
                    className="input-field w-full text-xs mb-2"
                    style={{ padding: '6px 9px' }}
                  />
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {pickRows.length === 0 && (
                      <p className="text-[11px] px-2 py-3" style={{ color: 'var(--fg-subtle)' }}>
                        {pickSource === 'library' ? 'Your library is empty here — switch to Browse catalog.' : 'Nothing found'}
                      </p>
                    )}
                    {/* HORIZONTAL 16:9 tiles, full sheet, 2 per row (§3a) */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {pickRows.map(a => (
                        <div
                          key={a.id}
                          onMouseEnter={() => setHoverRow(a)}
                          className="rounded-lg overflow-hidden"
                          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-subtle)' }}
                        >
                          <button
                            onClick={() => { if (a.owned || a.mine || a.isFree) pickAsset(a); else if (confirmBuyId === a.id) buyAndUse(a); else armBuy(a) }}
                            disabled={buyBusy === a.id}
                            style={{ display: 'block', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
                          >
                            <span style={{ display: 'block', aspectRatio: '16/9', backgroundColor: '#17151E', position: 'relative' }}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={thumb(a.file_url, 300)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} loading="lazy" />
                              <span className="absolute top-1 right-1 text-[9px] font-bold px-1 py-0.5 rounded" style={{
                                backgroundColor: 'rgba(8,5,15,0.72)',
                                color: a.owned ? '#7EE7C7' : a.isFree ? '#2DD4C4' : 'rgba(255,255,255,0.9)',
                              }}>
                                {a.owned ? '✓ Owned' : a.isFree ? 'Free' : `◆ ${a.cost}`}
                              </span>
                            </span>
                            <span className="block text-[10.5px] truncate px-1.5 py-1" style={{ color: confirmBuyId === a.id ? 'var(--accent-soft)' : 'var(--fg)', fontWeight: confirmBuyId === a.id ? 700 : undefined }}>
                              {buyBusy === a.id ? 'Buying…' : confirmBuyId === a.id ? `Confirm · ${a.cost} ◆` : a.title}
                            </span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* HOVER PREVIEW (§3a): the full turnaround, big, beside
                      the picker — inspect the face before committing */}
                  {hoverRow && (
                    <div style={{
                      position: 'absolute', left: '103%', top: 0, width: 400, zIndex: 41,
                      backgroundColor: '#120D1D', border: '1px solid var(--border)', borderRadius: 12,
                      boxShadow: '0 14px 40px rgba(0,0,0,0.7)', padding: 10,
                    }}>
                      <div style={{ aspectRatio: '16/9', backgroundColor: '#17151E', borderRadius: 8, overflow: 'hidden' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={thumb(hoverRow.file_url, 900)} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                      </div>
                      <p className="text-xs font-semibold mt-2 mb-0.5" style={{ color: 'var(--fg)' }}>{hoverRow.title}</p>
                      <p className="text-[10.5px] mb-2" style={{ color: 'var(--fg-muted)' }}>{hoverRow.type} · full turnaround, all angles</p>
                      {(hoverRow.owned || hoverRow.mine || hoverRow.isFree) ? (
                        <button onClick={() => pickAsset(hoverRow)} className="w-full text-xs font-bold py-2 rounded-lg"
                          style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: 'var(--on-accent)', border: 'none', cursor: 'pointer' }}>
                          Add to references
                        </button>
                      ) : (
                        <button onClick={() => { if (confirmBuyId === hoverRow.id) buyAndUse(hoverRow); else armBuy(hoverRow) }} disabled={buyBusy === hoverRow.id} className="w-full text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5"
                          style={{ background: confirmBuyId === hoverRow.id ? 'linear-gradient(135deg,#0EA97A,#0B8763)' : 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: 'var(--on-accent)', border: 'none', cursor: 'pointer' }}>
                          {buyBusy === hoverRow.id ? 'Buying…' : confirmBuyId === hoverRow.id ? (<>Confirm · {hoverRow.cost} <CreditGem size={12} /></>) : (<>Buy & use · {hoverRow.cost} <CreditGem size={12} /></>)}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* CAST / LOCATIONS (§3): horizontal 16:9 tiles — our assets
                are turnaround sheets, squares would crop them */}
            <div>
              <div className="flex gap-1 mb-2">
                {(['Cast', 'Locations'] as const).map(t => (
                  <button key={t} onClick={() => setCastTab(t)} className="text-[11px] font-bold px-2.5 py-1 rounded-md"
                    style={castTab === t ? { backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)', color: 'var(--accent-soft)', border: 'none', cursor: 'pointer' } : { color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {refs.filter(r => castTab === 'Cast' ? ['People', 'Character'].includes(r.kind) : r.kind === 'Location').map(r => (
                  <div key={r.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-subtle)', position: 'relative' }}>
                    <div style={{ aspectRatio: '16/9', backgroundColor: '#17151E' }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={r.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 3 }} />
                    </div>
                    {editingHandle === r.id ? (
                      <input
                        autoFocus
                        value={handleDraft}
                        onChange={e => setHandleDraft(e.target.value)}
                        onBlur={() => commitHandle(r)}
                        onKeyDown={e => { if (e.key === 'Enter') commitHandle(r); if (e.key === 'Escape') setEditingHandle(null) }}
                        className="input-field w-full text-[10px]"
                        style={{ padding: '2px 6px', borderRadius: 0 }}
                      />
                    ) : (
                      <button
                        onClick={() => { setEditingHandle(r.id); setHandleDraft(handleOf(r)) }}
                        title="Rename the handle (@Anna)"
                        className="block w-full text-left text-[10px] truncate px-1.5 py-1"
                        style={{ color: 'var(--fg)', background: 'none', border: 'none', cursor: 'text', margin: 0 }}
                      >
                        @{handleOf(r)} <span style={{ color: 'var(--fg-subtle)' }}>✎</span>
                      </button>
                    )}
                    <button
                      onClick={() => setRefs(prev => prev.filter(x => x.id !== r.id))}
                      className="absolute top-1 right-1 text-[10px] font-bold rounded"
                      style={{ backgroundColor: 'rgba(8,5,15,0.72)', color: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', padding: '1px 5px' }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => { setPickTab(castTab === 'Cast' ? 'Characters' : 'Locations'); setPickSource('library'); setPickQuery(''); setPickOpen(true) }}
                  className="rounded-lg flex items-center justify-center"
                  style={{ aspectRatio: '16/9', border: '1px dashed var(--border)', color: 'var(--fg-subtle)', background: 'none', cursor: 'pointer', fontSize: 20, fontWeight: 700 }}
                  title={castTab === 'Cast' ? 'Add a character' : 'Add a location'}
                >
                  +
                </button>
              </div>
            </div>

            {/* Audio toggle — hidden for models without audio (§extra) */}
            {modelUi.audio && (
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold" style={{ color: 'var(--fg-muted)' }}>Generate audio</span>
              <button onClick={() => setAudio(v => !v)} role="switch" aria-checked={audio}
                style={{
                  width: 38, height: 21, borderRadius: 999, position: 'relative', border: 'none', cursor: 'pointer',
                  backgroundColor: audio ? '#9765E0' : 'var(--bg-subtle)', transition: 'background .15s',
                }}>
                <span style={{ position: 'absolute', top: 2.5, left: audio ? 19 : 3, width: 16, height: 16, borderRadius: '50%', backgroundColor: 'white', transition: 'left .15s' }} />
              </button>
            </div>
            )}

            {/* SHOT SETTINGS (§5): quick aspect + collapsible Advanced */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Aspect</p>
              <div className="flex gap-1.5">
                {['16:9', '9:16', '1:1'].map(a => (
                  <button key={a} onClick={() => setAspect(a)} className="flex-1 text-xs font-bold py-1.5 rounded-lg"
                    style={aspect === a
                      ? { background: 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: 'var(--on-accent)', border: 'none', cursor: 'pointer' }
                      : { border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl" style={{ border: '1px solid var(--border)' }}>
              <button onClick={() => setAdvOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Advanced</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--fg-subtle)" strokeWidth="2.5" strokeLinecap="round" style={{ transform: advOpen ? 'rotate(180deg)' : undefined, transition: 'transform .15s' }}><path d="M6 9l6 6 6-6" /></svg>
              </button>
              {advOpen && (
                <div className="px-3 pb-3 flex flex-col gap-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Duration</p>
                      <div className="flex gap-1">
                        {modelUi.durations.map(d => (
                          <button key={d} onClick={() => setDuration(d)} className="flex-1 text-[11px] font-bold py-1 rounded-md"
                            style={duration === d ? { backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent-soft)', border: 'none', cursor: 'pointer' } : { border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>
                            {d}s
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Resolution</p>
                      <div className="flex gap-1">
                        {modelUi.resolutions.map(r => (
                          <button key={r} onClick={() => setResolution(r)} className="flex-1 text-[11px] font-bold py-1 rounded-md"
                            style={resolution === r ? { backgroundColor: 'color-mix(in srgb, var(--accent) 25%, transparent)', color: 'var(--accent-soft)', border: 'none', cursor: 'pointer' } : { border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Camera</p>
                      <select value={camera} onChange={e => setCamera(e.target.value)} className="input-field w-full" style={inputStyle}>
                        {CAMERA_MOVES.map(c => <option key={c} value={c}>{c === 'none' ? 'Auto' : c}</option>)}
                      </select>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Style</p>
                      <select value={preset} onChange={e => setPreset(e.target.value as keyof typeof PRESETS)} className="input-field w-full" style={inputStyle}>
                        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map(k => <option key={k} value={k}>{PRESETS[k].label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Negative prompt</p>
                    <input value={negative} onChange={e => setNegative(e.target.value)} placeholder="what to avoid…" className="input-field w-full" style={inputStyle} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>
                      Consistency · {consistency >= 60 ? 'strict' : consistency >= 30 ? 'balanced' : 'loose'}
                    </p>
                    <input type="range" min={0} max={100} value={consistency} onChange={e => setConsistency(Number(e.target.value))} className="cine-range w-full" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--fg-subtle)' }}>Seed (blank = random)</p>
                    <input value={seed} onChange={e => setSeed(e.target.value.replace(/[^0-9]/g, ''))} placeholder="random" className="input-field w-full" style={inputStyle} />
                  </div>
                </div>
              )}
            </div>

            {/* Generate */}
            <div>
              <button onClick={() => generate()} disabled={generating}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
                style={{ background: generating ? 'color-mix(in srgb, var(--accent) 45%, transparent)' : 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: generating ? 'white' : 'var(--on-accent)', cursor: generating ? 'default' : 'pointer', border: 'none' }}>
                {generating ? `Rendering… ${progress}%` : (<>Generate · {genCost} <CreditGem size={15} /></>)}
              </button>
              <div className="flex items-center justify-between mt-1.5 px-0.5">
                <span className="text-[10.5px]" style={{ color: 'var(--fg-subtle)' }}>{modelUi.label} · {duration}s · {resolution}</span>
                {balance !== null && (
                  <span className="text-[10.5px] font-bold flex items-center gap-1" style={{ color: balance < genCost ? '#e08a8a' : 'var(--fg-muted)' }}>
                    Balance: {balance} <CreditGem size={10} />
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* ── CENTER: preview ────────────────────────────── */}
          <div className="card p-4 flex flex-col" style={{ minHeight: 480 }}>
            {selected?.url ? (
              <>
                <video key={selected.id} src={selected.url} controls playsInline className="w-full rounded-xl" style={{ maxHeight: 520, backgroundColor: 'black' }} />
                <div className="flex items-center gap-2 mt-3">
                  <p className="text-xs truncate flex-1" style={{ color: 'var(--fg-muted)' }}>{selected.prompt}</p>
                  <button onClick={() => toggleFavorite(selected)} title="Favorite" className="p-2 rounded-lg" style={{ border: '1px solid var(--border)', color: selected.favorite ? '#CE95FB' : 'var(--fg-subtle)', background: 'none', cursor: 'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill={selected.favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                  </button>
                  <button onClick={() => copyPrompt(selected)} title="Copy prompt" className="p-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--fg-subtle)', background: 'none', cursor: 'pointer' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                  </button>
                  <a href={selected.url} download title="Download" className="p-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--fg-subtle)' }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
                  </a>
                  <button
                    onClick={() => {
                      if (!selected) return
                      // serial consistency (§extra): pull this shot's reference
                      // sheets + settings back into the console for the next take
                      if (selected.refs?.length) setRefs(selected.refs)
                      const st = selected.settings
                      if (st) {
                        if (st.model && MODELS_UI[st.model]) setModel(st.model)
                        if (st.aspect && ['16:9', '9:16', '1:1'].includes(st.aspect)) setAspect(st.aspect)
                        if (st.duration && [5, 10, 15].includes(Number(st.duration))) setDuration(Number(st.duration))
                        if (st.resolution && ['480p', '720p', '1080p'].includes(st.resolution)) setResolution(st.resolution)
                      }
                      say('References & settings loaded — direct the next shot')
                    }}
                    className="text-[11px] font-bold px-3 py-2 rounded-lg"
                    style={{ border: '1px solid color-mix(in srgb, var(--accent) 45%, transparent)', color: 'var(--accent-soft)', background: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}
                  >
                    Use as reference
                  </button>
                  <button onClick={() => say('Change voice — coming soon')} className="text-[11px] font-bold px-3 py-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>
                    Change voice
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-2">
                {generating ? (
                  <>
                    <div style={{ width: 220, height: 5, borderRadius: 999, backgroundColor: 'var(--bg-subtle)', overflow: 'hidden' }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#9765E0,#5EEAD4)', transition: 'width .5s' }} />
                    </div>
                    <p className="text-xs" style={{ color: 'var(--fg-muted)' }}>Seedance is rendering your shot — a few minutes…</p>
                  </>
                ) : (
                  <>
                    <span style={{ fontSize: 34 }}>🎬</span>
                    <p className="text-sm font-semibold" style={{ color: 'var(--fg)' }}>Your generations appear here</p>
                    <p className="text-xs max-w-xs" style={{ color: 'var(--fg-muted)' }}>Describe a shot, @-mention your characters and locations for consistency, hit Generate.</p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT: details ─────────────────────────────── */}
          <div className="card p-4" style={{ alignSelf: 'start' }}>
            {selected ? (
              <>
                <span className="text-[10px] font-bold px-2 py-1 rounded-md" style={{ backgroundColor: 'rgba(0,194,186,0.12)', color: '#00C2BA' }}>
                  {MODELS_UI[selected.model ?? '']?.label ?? 'Seedance 2.0'}
                </span>
                <div className="mt-3 space-y-2">
                  {Object.entries(selected.structured || { Prompt: selected.prompt || '' }).map(([k, v]) => (
                    <div key={k}>
                      <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--fg-subtle)' }}>{k}</p>
                      <p className="text-xs" style={{ color: 'var(--fg)' }}>{String(v)}</p>
                    </div>
                  ))}
                </div>
                <div className="flex gap-1.5 flex-wrap mt-3">
                  {[selected.settings?.resolution, selected.settings?.duration ? `${selected.settings.duration}s` : null, selected.settings?.aspect, selected.settings?.audio ? 'audio' : null].filter(Boolean).map(x => (
                    <span key={String(x)} className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>{String(x)}</span>
                  ))}
                </div>
                <p className="text-[11px] mt-3" style={{ color: 'var(--fg-subtle)' }}>
                  {new Date(selected.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · {selected.cost} credits
                </p>
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => generate({ prompt: selected.prompt || '', settings: selected.settings, refs: selected.refs || [] })}
                    disabled={generating}
                    className="flex-1 text-xs font-bold py-2 rounded-lg text-white"
                    style={{ background: 'linear-gradient(135deg,#9765E0,#534FA5)', border: 'none', cursor: 'pointer' }}>
                    Rerun
                  </button>
                  <button onClick={() => copyPrompt(selected)} className="text-xs font-bold px-3 py-2 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>Copy</button>
                  <button onClick={() => removeGens([selected.id])} className="text-xs font-bold px-3 py-2 rounded-lg" style={{ border: '1px solid rgba(220,60,60,0.4)', color: '#e06060', background: 'none', cursor: 'pointer' }}>Delete</button>
                </div>
              </>
            ) : (
              <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Generation details will show here.</p>
            )}
          </div>
        </div>
      )}

      {/* ── HISTORY ──────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>History</h2>
        {checked.size > 0 && (
          <>
            <button onClick={bulkDownload} className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: 'linear-gradient(135deg,#9765E0,#534FA5)', border: 'none', cursor: 'pointer' }}>Download {checked.size}</button>
            <button onClick={() => removeGens(Array.from(checked))} className="text-[11px] font-bold px-3 py-1.5 rounded-lg" style={{ border: '1px solid rgba(220,60,60,0.4)', color: '#e06060', background: 'none', cursor: 'pointer' }}>Delete {checked.size}</button>
          </>
        )}
      </div>

      {!user ? (
        <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>Sign in to see your generation history.</p>
      ) : history.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--fg-subtle)' }}>No generations yet — your renders will appear here, grouped by date.</p>
      ) : (
        groups.map(([label, items]) => (
          <div key={label} className="mb-5">
            <p className="text-[11px] font-bold mb-2" style={{ color: 'var(--fg-subtle)' }}>{label}</p>
            {view === 'grid' ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {items.map(g => (
                  <div key={g.id} className="rounded-xl overflow-hidden" style={{ width: cardW, border: `1px solid ${selected?.id === g.id ? '#9765E0' : 'var(--border)'}`, backgroundColor: 'var(--bg-card)', position: 'relative', cursor: 'pointer' }}
                    onClick={() => { setSelected(g); setExpanded(false) }}>
                    <input
                      type="checkbox"
                      checked={checked.has(g.id)}
                      onChange={e => { e.stopPropagation(); setChecked(prev => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n }) }}
                      onClick={e => e.stopPropagation()}
                      style={{ position: 'absolute', top: 7, left: 7, zIndex: 3, accentColor: '#9765E0' }}
                    />
                    {g.url ? (
                      <video src={`${g.url}#t=0.1`} muted playsInline preload="metadata" style={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', backgroundColor: 'black', display: 'block' }} />
                    ) : (
                      <div className="flex items-center justify-center text-[11px]" style={{ aspectRatio: '16/9', color: g.state === 'fail' ? '#e06060' : 'var(--fg-subtle)', backgroundColor: 'var(--bg-subtle)' }}>
                        {g.state === 'fail' ? 'Failed' : 'Rendering…'}
                      </div>
                    )}
                    {g.favorite && <span style={{ position: 'absolute', top: 6, right: 7, color: '#CE95FB', fontSize: 11 }}>★</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {items.map(g => (
                  <div key={g.id} className="flex items-center gap-3 rounded-xl p-2" style={{ border: `1px solid ${selected?.id === g.id ? '#9765E0' : 'var(--border)'}`, backgroundColor: 'var(--bg-card)', cursor: 'pointer' }}
                    onClick={() => { setSelected(g); setExpanded(false) }}>
                    <input type="checkbox" checked={checked.has(g.id)}
                      onChange={e => { e.stopPropagation(); setChecked(prev => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n }) }}
                      onClick={e => e.stopPropagation()} style={{ accentColor: '#9765E0' }} />
                    {g.url ? (
                      <video src={`${g.url}#t=0.1`} muted playsInline preload="metadata" style={{ width: Math.max(110, cardW * 0.6), aspectRatio: '16/9', objectFit: 'cover', borderRadius: 8, backgroundColor: 'black', flexShrink: 0 }} />
                    ) : (
                      <div className="flex items-center justify-center text-[11px]" style={{ width: Math.max(110, cardW * 0.6), aspectRatio: '16/9', borderRadius: 8, color: 'var(--fg-subtle)', backgroundColor: 'var(--bg-subtle)', flexShrink: 0 }}>
                        {g.state === 'fail' ? 'Failed' : 'Rendering…'}
                      </div>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <p className="text-xs" style={{ color: 'var(--fg)' }}>{g.prompt}</p>
                      <p className="text-[10px] mt-1" style={{ color: 'var(--fg-subtle)' }}>
                        {g.model === 'seedance-2-fast' ? 'Seedance 2.0 Fast' : 'Seedance 2.0'} · {g.settings?.resolution} · {g.settings?.duration}s · {new Date(g.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}

      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--fg)',
          padding: '10px 18px', borderRadius: 10, fontSize: 13, zIndex: 200,
        }}>{toast}</div>
      )}
    </div>
  )
}
