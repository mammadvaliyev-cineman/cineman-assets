'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

// ─────────────────────────────────────────────────────────────
// LIBRARY — the ONE entry point (spec C):
// • Purchased — everything the user owns (downloads, exclusives,
//   generations): one card per asset, free re-downloads, «Downloaded ×N»
//   stat, «Remove from my library» (hide, NO refund — refunds are admin).
// • Saved — everything saved from the catalog (union) + Collections
//   boards with covers: open, add, remove, rename, delete.
// ─────────────────────────────────────────────────────────────

type Row = { id: string; title: string; file_url: string; type: string; category: string; resolution?: string | null; bought_at?: string; dl_count?: number }
type Collection = { id: string; name: string; count?: number; cover?: string | null }

function thumb(url: string): string {
  if (!url || !url.includes('/storage/v1/object/public/')) return url
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=440&quality=62&resize=contain'
}

function sentenceCase(s: string): string {
  if (!s) return s
  const words = s.split(' ').map(w => (w.length <= 4 && w === w.toUpperCase() && /[A-Z]{2,}/.test(w)) ? w : w.toLowerCase())
  const out = words.join(' ')
  return out.charAt(0).toUpperCase() + out.slice(1)
}

async function fetchAssets(ids: string[]): Promise<Row[]> {
  const out: Row[] = []
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await supabase.from('assets')
      .select('id,title,file_url,type,category,resolution').in('id', ids.slice(i, i + 100))
    out.push(...((data || []) as Row[]))
  }
  const pos = new Map(ids.map((id, i) => [id, i]))
  out.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
  return out
}

export default function LibraryPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'purchased' | 'saved'>('purchased')
  const [purchased, setPurchased] = useState<Row[]>([])
  const [saved, setSaved] = useState<Row[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCol, setActiveCol] = useState<Collection | null>(null)
  const [colAssets, setColAssets] = useState<Row[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  // ── Purchased: one card per asset + download counts ─────────
  const loadPurchased = useCallback(async () => {
    if (!user) return
    const { data: pRows } = await supabase.from('purchases')
      .select('asset_id, created_at, hidden')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    const visible = (pRows || []).filter(p => !p.hidden)
    const ids = visible.map(p => String(p.asset_id))
    const meta = new Map(visible.map(p => [String(p.asset_id), p.created_at]))
    // download stat: count rows per asset (cheap — own rows only)
    const counts = new Map<string, number>()
    const { data: dRows } = await supabase.from('downloads').select('asset_id').eq('user_id', user.id).limit(2000)
    for (const d of dRows || []) counts.set(String(d.asset_id), (counts.get(String(d.asset_id)) ?? 0) + 1)
    if (ids.length === 0) { setPurchased([]); return }
    const rows = await fetchAssets(ids)
    setPurchased(rows.map(a => ({ ...a, bought_at: meta.get(a.id), dl_count: counts.get(a.id) ?? 1 })))
  }, [user])

  // ── Saved: favorites union + collections with covers ────────
  const loadSaved = useCallback(async () => {
    if (!user) return
    const { data: favRows } = await supabase.from('favorites').select('asset_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
    let local: string[] = []
    try { local = JSON.parse(localStorage.getItem('cineman_favs') ?? '[]') } catch { /* noop */ }
    const ids = Array.from(new Set([...(favRows || []).map(r => String(r.asset_id)), ...local]))
    setSaved(ids.length ? await fetchAssets(ids) : [])

    const { data: cols } = await supabase.from('collections').select('id,name').eq('user_id', user.id).order('created_at', { ascending: false })
    const out: Collection[] = []
    for (const c of cols || []) {
      const { data: items, count } = await supabase.from('collection_items')
        .select('asset_id', { count: 'exact' }).eq('collection_id', c.id).limit(1)
      let cover: string | null = null
      if (items && items[0]) {
        const { data: a } = await supabase.from('assets').select('file_url').eq('id', items[0].asset_id).single()
        cover = a?.file_url ?? null
      }
      out.push({ id: String(c.id), name: String(c.name), count: count ?? 0, cover })
    }
    setCollections(out)
  }, [user])

  useEffect(() => {
    if (!user) return
    setLoading(true)
    Promise.all([loadPurchased(), loadSaved()]).finally(() => setLoading(false))
  }, [user, loadPurchased, loadSaved])

  // ── actions ─────────────────────────────────────────────────
  async function download(asset: Row) {
    if (busy) return
    setBusy(asset.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ assetId: asset.id }),
      })
      const json = await res.json()
      if (json.url) {
        const dlUrl = json.url.includes('/storage/v1/') ? json.url + (json.url.includes('?') ? '&' : '?') + 'download' : json.url
        window.location.href = dlUrl
      } else say(json.error || 'Download failed')
    } catch { say('Download failed — try again') } finally { setBusy(null) }
  }

  // spec B2: users can only HIDE from their library — refunds are admin-only
  async function hideFromLibrary(asset: Row) {
    if (!user) return
    await supabase.from('purchases').update({ hidden: true }).eq('user_id', user.id).eq('asset_id', asset.id)
    setPurchased(prev => prev.filter(a => a.id !== asset.id))
    say('Removed from your library (no refund)')
  }

  async function removeSaved(assetId: string) {
    if (!user) return
    await supabase.from('favorites').delete().eq('user_id', user.id).eq('asset_id', assetId)
    try {
      const local: string[] = JSON.parse(localStorage.getItem('cineman_favs') ?? '[]')
      localStorage.setItem('cineman_favs', JSON.stringify(local.filter(x => x !== assetId)))
    } catch { /* noop */ }
    setSaved(prev => prev.filter(a => a.id !== assetId))
  }

  async function createCollection() {
    const name = newName.trim()
    if (!user || !name) return
    const { error } = await supabase.from('collections').insert({ user_id: user.id, name })
    if (error) { say('Could not create the collection'); return }
    setNewName('')
    loadSaved()
  }

  async function renameCollection(c: Collection) {
    const name = window.prompt('Collection name:', c.name)?.trim()
    if (!name || name === c.name) return
    await supabase.from('collections').update({ name }).eq('id', c.id)
    setCollections(prev => prev.map(x => x.id === c.id ? { ...x, name } : x))
    if (activeCol?.id === c.id) setActiveCol({ ...c, name })
  }

  async function deleteCollection(c: Collection) {
    await supabase.from('collection_items').delete().eq('collection_id', c.id)
    await supabase.from('collections').delete().eq('id', c.id)
    setCollections(prev => prev.filter(x => x.id !== c.id))
    if (activeCol?.id === c.id) { setActiveCol(null); setColAssets([]) }
  }

  async function openCollection(c: Collection) {
    setActiveCol(c)
    const { data: items } = await supabase.from('collection_items').select('asset_id').eq('collection_id', c.id)
    const ids = (items || []).map(i => String(i.asset_id))
    setColAssets(ids.length ? await fetchAssets(ids) : [])
  }

  async function removeFromCollection(assetId: string) {
    if (!activeCol) return
    await supabase.from('collection_items').delete().eq('collection_id', activeCol.id).eq('asset_id', assetId)
    setColAssets(prev => prev.filter(a => a.id !== assetId))
    setCollections(prev => prev.map(c => c.id === activeCol.id ? { ...c, count: Math.max(0, (c.count ?? 1) - 1) } : c))
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--fg)' }}>Library</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>Sign in to see everything you own and saved — purchases are re-downloadable free, forever.</p>
        <Link href="/catalog" className="btn-primary px-6 py-2.5 text-sm font-bold inline-block">Browse the catalog</Link>
      </div>
    )
  }

  const assetCard = (a: Row, actions: React.ReactNode) => (
    <div key={a.id} className="card flex flex-col" style={{ width: 240 }}>
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/10', backgroundColor: 'var(--bg-subtle)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(a.file_url)} alt={a.title} className="w-full h-full block" style={{ objectFit: 'cover' }} loading="lazy" />
        <span className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.9)' }}>
          {a.resolution ?? '2K'}
        </span>
      </div>
      <div className="p-3 flex flex-col gap-2">
        <p className="text-xs font-semibold truncate" style={{ color: 'var(--fg)' }}>{sentenceCase(a.title)}</p>
        <p className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
          {a.type} · {a.category}
          {a.bought_at ? ` · ${new Date(a.bought_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
          {a.dl_count ? ` · downloaded ×${a.dl_count}` : ''}
        </p>
        {actions}
      </div>
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Library</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>Everything you own and saved, in one place.</p>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 mb-8 w-fit" style={{ backgroundColor: 'var(--bg-subtle)' }}>
        {(['purchased', 'saved'] as const).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setActiveCol(null) }}
            className="px-5 py-1.5 rounded-lg text-sm font-semibold"
            style={tab === t ? { background: 'linear-gradient(135deg,#9765E0,#534FA5)', color: 'white' } : { color: 'var(--fg-muted)' }}
          >
            {t === 'purchased' ? `Purchased${purchased.length ? ` · ${purchased.length}` : ''}` : `Saved${saved.length ? ` · ${saved.length}` : ''}`}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Loading…</p>
      ) : tab === 'purchased' ? (
        purchased.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>Nothing here yet — your first download will appear here, owned forever.</p>
            <Link href="/catalog" className="btn-primary px-6 py-2.5 text-sm font-bold inline-block">Browse the catalog</Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {purchased.map(a => assetCard(a, (
              <>
                <button
                  onClick={() => download(a)}
                  disabled={busy === a.id}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: busy === a.id ? 'rgba(151,101,224,0.4)' : 'linear-gradient(135deg,#9765E0,#534FA5)', color: 'white', cursor: busy === a.id ? 'default' : 'pointer' }}
                >
                  {busy === a.id ? 'Preparing…' : 'Download · Owned'}
                </button>
                <button onClick={() => hideFromLibrary(a)} className="text-[11px] text-left" style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Remove from my library
                </button>
              </>
            )))}
          </div>
        )
      ) : activeCol ? (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setActiveCol(null)} className="text-sm" style={{ color: 'var(--fg-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>← Collections</button>
            <h2 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>{activeCol.name}</h2>
            <button onClick={() => renameCollection(activeCol)} className="text-[11px]" style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>Rename</button>
            <button onClick={() => deleteCollection(activeCol)} className="text-[11px]" style={{ color: '#e06060', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
          </div>
          {colAssets.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              Empty board — in the <Link href="/catalog" style={{ color: '#CE95FB' }}>catalog</Link>, tap the ⌄ next to Save on any card and pick «{activeCol.name}».
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {colAssets.map(a => assetCard(a, (
                <button onClick={() => removeFromCollection(a.id)} className="text-[11px] text-left" style={{ color: '#e06060', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Remove from collection
                </button>
              )))}
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Collections boards */}
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Collections</h2>
            <input
              value={newName} onChange={e => setNewName(e.target.value)} placeholder="New collection…"
              className="input-field text-xs" style={{ width: 180, padding: '6px 10px' }}
              onKeyDown={e => { if (e.key === 'Enter') createCollection() }}
            />
            <button onClick={createCollection} className="btn-primary text-xs px-3 py-1.5 font-bold">Create</button>
          </div>
          {collections.length > 0 && (
            <div className="mb-8" style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {collections.map(c => (
                <button key={c.id} onClick={() => openCollection(c)} className="card text-left" style={{ width: 200, cursor: 'pointer', overflow: 'hidden', padding: 0, border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                  <div style={{ aspectRatio: '16/10', backgroundColor: 'var(--bg-subtle)', overflow: 'hidden' }}>
                    {c.cover
                      /* eslint-disable-next-line @next/next/no-img-element */
                      ? <img src={thumb(c.cover)} alt={c.name} className="w-full h-full block" style={{ objectFit: 'cover' }} loading="lazy" />
                      : <div className="w-full h-full flex items-center justify-center text-2xl">🎬</div>}
                  </div>
                  <div className="p-3">
                    <p className="text-xs font-bold truncate" style={{ color: 'var(--fg)' }}>{c.name}</p>
                    <p className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{c.count ?? 0} assets</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Saved grid (union of everything saved) */}
          <h2 className="text-lg font-bold mb-4" style={{ color: 'var(--fg)' }}>All saved</h2>
          {saved.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              Nothing saved yet — tap <b>Save</b> on any card in the <Link href="/catalog" style={{ color: '#CE95FB' }}>catalog</Link>.
            </p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {saved.map(a => assetCard(a, (
                <button onClick={() => removeSaved(a.id)} className="text-[11px] text-left" style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Remove from saved
                </button>
              )))}
            </div>
          )}
        </div>
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
