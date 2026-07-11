'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

// ─────────────────────────────────────────────────────────────
// MY FAVORITES & COLLECTIONS (all-in-one §3).
// Favorites: hearts from the catalog (favorites table, RLS own
// rows). Collections: named boards; assets are added to them
// from the favorites grid via a small select on each card.
// ─────────────────────────────────────────────────────────────

type Row = { id: string; title: string; file_url: string; type: string; category: string }
type Collection = { id: string; name: string; count?: number }

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

export default function FavoritesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<'favorites' | 'collections'>('favorites')
  const [favAssets, setFavAssets] = useState<Row[]>([])
  const [collections, setCollections] = useState<Collection[]>([])
  const [activeCol, setActiveCol] = useState<Collection | null>(null)
  const [colAssets, setColAssets] = useState<Row[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  const loadFavorites = useCallback(async () => {
    if (!user) return
    setLoading(true)
    // DB favorites + local hearts merged, newest first
    const { data: favRows } = await supabase.from('favorites').select('asset_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false })
    let local: string[] = []
    try { local = JSON.parse(localStorage.getItem('cineman_favs') ?? '[]') } catch { /* noop */ }
    const ids = Array.from(new Set([...(favRows || []).map(r => String(r.asset_id)), ...local]))
    if (ids.length === 0) { setFavAssets([]); setLoading(false); return }
    const out: Row[] = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase.from('assets').select('id,title,file_url,type,category').in('id', ids.slice(i, i + 100))
      out.push(...((data || []) as Row[]))
    }
    // keep the favorites order
    const pos = new Map(ids.map((id, i) => [id, i]))
    out.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
    setFavAssets(out)
    setLoading(false)
  }, [user])

  const loadCollections = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('collections').select('id,name').eq('user_id', user.id).order('created_at', { ascending: false })
    const cols: Collection[] = (data || []) as Collection[]
    for (const c of cols) {
      const { count } = await supabase.from('collection_items').select('asset_id', { count: 'exact', head: true }).eq('collection_id', c.id)
      c.count = count ?? 0
    }
    setCollections(cols)
  }, [user])

  useEffect(() => { loadFavorites(); loadCollections() }, [loadFavorites, loadCollections])

  async function createCollection() {
    const name = newName.trim()
    if (!user || !name) return
    const { error } = await supabase.from('collections').insert({ user_id: user.id, name })
    if (!error) { setNewName(''); loadCollections() }
  }

  async function deleteCollection(c: Collection) {
    if (!confirm(`Delete collection «${c.name}»? Assets stay in your favorites.`)) return
    await supabase.from('collections').delete().eq('id', c.id)
    if (activeCol?.id === c.id) { setActiveCol(null); setColAssets([]) }
    loadCollections()
  }

  async function openCollection(c: Collection) {
    setActiveCol(c)
    const { data: items } = await supabase.from('collection_items').select('asset_id').eq('collection_id', c.id)
    const ids = (items || []).map(r => String(r.asset_id))
    if (ids.length === 0) { setColAssets([]); return }
    const { data } = await supabase.from('assets').select('id,title,file_url,type,category').in('id', ids)
    setColAssets((data || []) as Row[])
  }

  async function addToCollection(assetId: string, collectionId: string) {
    if (!collectionId) return
    await supabase.from('collection_items').upsert({ collection_id: collectionId, asset_id: assetId })
    loadCollections()
    if (activeCol?.id === collectionId) openCollection(activeCol)
  }

  async function removeFromCollection(assetId: string) {
    if (!activeCol) return
    await supabase.from('collection_items').delete().eq('collection_id', activeCol.id).eq('asset_id', assetId)
    openCollection(activeCol)
    loadCollections()
  }

  async function removeFavorite(assetId: string) {
    if (!user) return
    await supabase.from('favorites').delete().eq('user_id', user.id).eq('asset_id', assetId)
    try {
      const local: string[] = JSON.parse(localStorage.getItem('cineman_favs') ?? '[]')
      localStorage.setItem('cineman_favs', JSON.stringify(local.filter(x => x !== assetId)))
    } catch { /* noop */ }
    setFavAssets(prev => prev.filter(a => a.id !== assetId))
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--fg)' }}>My favorites</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>Sign in to save favorites and build collections that follow your account.</p>
        <Link href="/catalog" className="btn-primary px-6 py-2.5 text-sm font-bold inline-block">Browse the catalog</Link>
      </div>
    )
  }

  const grid = (rows: Row[], inCollection: boolean) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {rows.map(a => (
        <div key={a.id} className="card flex flex-col" style={{ width: 240 }}>
          <div className="relative overflow-hidden" style={{ backgroundColor: 'var(--bg-subtle)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb(a.file_url)} alt={a.title} className="w-full block h-auto" loading="lazy" style={{ minHeight: 120 }} />
          </div>
          <div className="p-3 flex flex-col gap-2">
            <p className="text-xs font-semibold truncate" style={{ color: 'var(--fg)' }}>{sentenceCase(a.title)}</p>
            <p className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>{a.type} · {a.category}</p>
            {inCollection ? (
              <button onClick={() => removeFromCollection(a.id)} className="text-[11px] text-left" style={{ color: '#e06060' }}>
                Remove from collection
              </button>
            ) : (
              <>
                {collections.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={e => { addToCollection(a.id, e.target.value); e.target.value = '' }}
                    className="input-field text-[11px]"
                    style={{ padding: '5px 8px' }}
                  >
                    <option value="">+ Add to collection…</option>
                    {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
                <button onClick={() => removeFavorite(a.id)} className="text-[11px] text-left" style={{ color: 'var(--fg-subtle)' }}>
                  Remove from favorites
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-6" style={{ color: 'var(--fg)' }}>My favorites</h1>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl p-1 mb-8 w-fit" style={{ backgroundColor: 'var(--bg-subtle)' }}>
        {(['favorites', 'collections'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-5 py-2 rounded-lg text-sm font-medium capitalize transition-all"
            style={tab === t
              ? { background: 'linear-gradient(135deg, #9765E0, #534FA5)', color: 'white' }
              : { color: 'var(--fg-muted)' }}
          >
            {t} {t === 'favorites' ? `(${favAssets.length})` : `(${collections.length})`}
          </button>
        ))}
      </div>

      {tab === 'favorites' && (
        loading ? <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Loading…</p>
        : favAssets.length === 0
          ? <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No favorites yet — tap the heart on any asset in the <Link href="/catalog" style={{ color: '#CE95FB' }}>catalog</Link>.</p>
          : grid(favAssets, false)
      )}

      {tab === 'collections' && (
        <div>
          {/* Create */}
          <div className="flex gap-2 mb-6" style={{ maxWidth: 420 }}>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createCollection() }}
              placeholder="New collection name…"
              className="input-field text-sm flex-1"
              style={{ padding: '9px 12px' }}
            />
            <button onClick={createCollection} className="btn-primary px-4 text-sm font-bold">Create</button>
          </div>

          {/* Collection chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            {collections.map(c => (
              <span key={c.id} className="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
                style={{
                  cursor: 'pointer',
                  backgroundColor: activeCol?.id === c.id ? 'rgba(151,101,224,0.2)' : 'var(--bg-subtle)',
                  border: `1px solid ${activeCol?.id === c.id ? 'rgba(151,101,224,0.5)' : 'var(--border)'}`,
                  color: 'var(--fg)',
                }}
              >
                <span onClick={() => openCollection(c)}>{c.name} · {c.count ?? 0}</span>
                <span onClick={() => deleteCollection(c)} style={{ color: 'var(--fg-subtle)', fontWeight: 700 }}>×</span>
              </span>
            ))}
            {collections.length === 0 && <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>No collections yet — create one above, then add assets from the Favorites tab.</p>}
          </div>

          {activeCol && (
            colAssets.length === 0
              ? <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>«{activeCol.name}» is empty — add assets from the Favorites tab.</p>
              : grid(colAssets, true)
          )}
        </div>
      )}
    </div>
  )
}
