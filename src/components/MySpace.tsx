'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

// ─────────────────────────────────────────────────────────────
// MY SPACE — «My downloads» and «Saved» rendered INSIDE the
// catalog shell (owner's spec A1): the sidebar stays, only the
// main area swaps, exactly like switching a category. The old
// full-screen /library redirects here.
// • Downloads: one card per owned asset, downloaded ×N, free
//   re-download, «Remove from my library» (hide, no refund).
// • Saved: bookmark TOGGLES off right on the card (spec A3) +
//   collections boards live here too.
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

function BookmarkIcon({ filled, size = 13 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function TrashIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  )
}

export default function MySpace({ view, onSavedChanged }: { view: 'downloads' | 'saved'; onSavedChanged?: () => void }) {
  const { user } = useAuth()
  const [purchased, setPurchased] = useState<Row[]>([])
  const [saved, setSaved] = useState<Row[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCol, setActiveCol] = useState<Collection | null>(null)
  const [delCol, setDelCol] = useState<Collection | null>(null) // delete-board confirm
  const [colAssets, setColAssets] = useState<Row[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500) }

  const loadPurchased = useCallback(async () => {
    if (!user) return
    const { data: pRows } = await supabase.from('purchases')
      .select('asset_id, created_at, hidden')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    const visible = (pRows || []).filter(p => !p.hidden)
    const ids = visible.map(p => String(p.asset_id))
    const meta = new Map(visible.map(p => [String(p.asset_id), p.created_at]))
    const counts = new Map<string, number>()
    const { data: dRows } = await supabase.from('downloads').select('asset_id').eq('user_id', user.id).limit(2000)
    for (const d of dRows || []) counts.set(String(d.asset_id), (counts.get(String(d.asset_id)) ?? 0) + 1)
    if (ids.length === 0) { setPurchased([]); return }
    const rows = await fetchAssets(ids)
    setPurchased(rows.map(a => ({ ...a, bought_at: meta.get(a.id), dl_count: counts.get(a.id) ?? 1 })))
  }, [user])

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
    if (!user) { setLoading(false); return }
    setLoading(true)
    ;(view === 'downloads' ? loadPurchased() : loadSaved()).finally(() => setLoading(false))
  }, [user, view, loadPurchased, loadSaved])

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

  async function hideFromLibrary(asset: Row) {
    if (!user) return
    await supabase.from('purchases').update({ hidden: true }).eq('user_id', user.id).eq('asset_id', asset.id)
    setPurchased(prev => prev.filter(a => a.id !== asset.id))
    say('Removed from your library (no refund)')
  }

  // spec A3: the bookmark itself toggles saved off
  async function unsave(assetId: string) {
    if (!user) return
    await supabase.from('favorites').delete().eq('user_id', user.id).eq('asset_id', assetId)
    try {
      const local: string[] = JSON.parse(localStorage.getItem('cineman_favs') ?? '[]')
      localStorage.setItem('cineman_favs', JSON.stringify(local.filter(x => x !== assetId)))
    } catch { /* noop */ }
    setSaved(prev => prev.filter(a => a.id !== assetId))
    onSavedChanged?.()
    say('Removed from saved')
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

  // Deleting a BOARD never touches the assets — they stay in «All saved»
  // and in every other collection (owner's spec). Empty boards delete
  // silently; boards with assets ask first.
  function askDeleteCollection(c: Collection) {
    if ((c.count ?? 0) > 0) setDelCol(c)
    else doDeleteCollection(c)
  }

  async function doDeleteCollection(c: Collection) {
    setDelCol(null)
    await supabase.from('collection_items').delete().eq('collection_id', c.id)
    const { error } = await supabase.from('collections').delete().eq('id', c.id)
    if (error) { say('Could not delete the collection — try again'); return }
    setCollections(prev => prev.filter(x => x.id !== c.id))
    if (activeCol?.id === c.id) { setActiveCol(null); setColAssets([]) }
    say('Collection deleted — assets stay in your saved')
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
      <div className="text-center py-20">
        <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>Sign in to see {view === 'downloads' ? 'your downloads' : 'saved assets'}.</p>
        <Link href="/account" className="btn-primary px-6 py-2.5 text-sm font-bold inline-block">Sign in</Link>
      </div>
    )
  }

  const assetCard = (a: Row, actions: React.ReactNode, bookmark?: boolean) => (
    <div key={a.id} className="card flex flex-col" style={{ width: 240 }}>
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/10', backgroundColor: 'var(--bg-subtle)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumb(a.file_url)} alt={a.title} className="w-full h-full block" style={{ objectFit: 'cover' }} loading="lazy" />
        <span className="absolute top-2 left-2 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.9)' }}>
          {a.resolution ?? '2K'}
        </span>
        {bookmark && (
          <button
            onClick={() => unsave(a.id)}
            title="Saved — click to remove"
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
            style={{ backgroundColor: '#9765E0', color: 'white', border: 'none', cursor: 'pointer' }}
          >
            <BookmarkIcon filled /> Saved
          </button>
        )}
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
    <div>
      {loading ? (
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Loading…</p>
      ) : view === 'downloads' ? (
        purchased.length === 0 ? (
          <p className="text-sm py-10" style={{ color: 'var(--fg-muted)' }}>Nothing here yet — your first download will appear here, owned forever.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {purchased.map(a => assetCard(a, (
              <>
                <button
                  onClick={() => download(a)}
                  disabled={busy === a.id}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold"
                  style={{ background: busy === a.id ? 'rgba(151,101,224,0.4)' : 'linear-gradient(135deg,#9765E0,#534FA5)', color: 'white', cursor: busy === a.id ? 'default' : 'pointer', border: 'none' }}
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
            <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>{activeCol.name}</h2>
            <button onClick={() => renameCollection(activeCol)} className="text-[11px]" style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>Rename</button>
            <button onClick={() => askDeleteCollection({ ...activeCol, count: colAssets.length })} className="text-[11px]" style={{ color: '#e06060', background: 'none', border: 'none', cursor: 'pointer' }}>Delete</button>
          </div>
          {colAssets.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
              Empty board — on any catalog card tap the ⌄ next to Save and pick «{activeCol.name}».
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
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--fg-muted)' }}>Collections</h2>
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
                <div key={c.id} onClick={() => openCollection(c)} className="card text-left group" style={{ width: 200, cursor: 'pointer', overflow: 'hidden', padding: 0, border: '1px solid var(--border)', background: 'var(--bg-card)', position: 'relative' }}>
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
                  {/* delete the BOARD only — assets stay saved */}
                  <button
                    onClick={e => { e.stopPropagation(); askDeleteCollection(c) }}
                    title="Delete collection"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ padding: 6, borderRadius: 7, border: 'none', cursor: 'pointer', backgroundColor: 'rgba(220,60,60,0.6)', color: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          <h2 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--fg-muted)' }}>All saved</h2>
          {saved.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Nothing saved yet — tap <b>Save</b> on any card in the catalog.</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {saved.map(a => assetCard(a, (
                <button onClick={() => unsave(a.id)} className="text-[11px] text-left" style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Remove from saved
                </button>
              ), true))}
            </div>
          )}
        </div>
      )}

      {/* Delete-collection confirm (only for boards WITH assets) */}
      {delCol && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(8,5,15,0.8)', backdropFilter: 'blur(6px)' }} onClick={() => setDelCol(null)}>
          <div className="rounded-2xl p-6 max-w-xs w-full" style={{ backgroundColor: '#120D1D', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--fg)' }}>Delete collection?</p>
            <p className="text-xs mb-5" style={{ color: 'var(--fg-muted)' }}>
              «{delCol.name}» — {delCol.count} asset{(delCol.count ?? 0) === 1 ? '' : 's'}. Assets stay in your saved.
            </p>
            <div className="flex gap-2">
              <button onClick={() => doDeleteCollection(delCol)} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ backgroundColor: '#DC3C3C', border: 'none', cursor: 'pointer' }}>Delete</button>
              <button onClick={() => setDelCol(null)} className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
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
