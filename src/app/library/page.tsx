'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

// ─────────────────────────────────────────────────────────────
// MY LIBRARY — everything the user OWNS: downloaded assets,
// exclusive buyouts and generated assets (purchases table, RLS
// own rows). Ownership rule: paid once → re-download free forever.
// ─────────────────────────────────────────────────────────────

type Row = { id: string; title: string; file_url: string; type: string; category: string; resolution?: string | null; bought_at?: string; cost?: number }

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

export default function LibraryPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: purchases } = await supabase
      .from('purchases').select('asset_id, cost, created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false })
    const ids = (purchases || []).map(p => String(p.asset_id))
    if (ids.length === 0) { setRows([]); setLoading(false); return }
    const meta = new Map((purchases || []).map(p => [String(p.asset_id), p]))
    const out: Row[] = []
    for (let i = 0; i < ids.length; i += 100) {
      const { data } = await supabase.from('assets')
        .select('id,title,file_url,type,category,resolution').in('id', ids.slice(i, i + 100))
      out.push(...((data || []) as Row[]))
    }
    const pos = new Map(ids.map((id, i) => [id, i]))
    out.sort((a, b) => (pos.get(a.id) ?? 0) - (pos.get(b.id) ?? 0))
    setRows(out.map(a => ({ ...a, bought_at: (meta.get(a.id) as { created_at?: string })?.created_at, cost: (meta.get(a.id) as { cost?: number })?.cost })))
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  // Free re-download of an owned asset (server verifies ownership)
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
      } else {
        setToast(json.error || 'Download failed')
        setTimeout(() => setToast(''), 2500)
      }
    } catch {
      setToast('Download failed — try again')
      setTimeout(() => setToast(''), 2500)
    } finally { setBusy(null) }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--fg)' }}>My library</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>Sign in to see everything you own — bought and generated assets are re-downloadable for free, forever.</p>
        <Link href="/catalog" className="btn-primary px-6 py-2.5 text-sm font-bold inline-block">Browse the catalog</Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--fg)' }}>My library</h1>
      <p className="text-sm mb-8" style={{ color: 'var(--fg-muted)' }}>
        Everything you own — downloads, exclusives and generations. Re-download anytime, free.
      </p>

      {loading ? (
        <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Loading…</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>Nothing here yet — your first download will appear here, owned forever.</p>
          <Link href="/catalog" className="btn-primary px-6 py-2.5 text-sm font-bold inline-block">Browse the catalog</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
          {rows.map(a => (
            <div key={a.id} className="card flex flex-col" style={{ width: 240 }}>
              <div className="relative overflow-hidden" style={{ aspectRatio: '16/10', backgroundColor: 'var(--bg-subtle)' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={thumb(a.file_url)} alt={a.title} className="w-full h-full block" style={{ objectFit: 'cover' }} loading="lazy" />
                <span
                  className="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.3)', color: 'rgba(255,255,255,0.9)' }}
                >
                  {a.resolution ?? '2K'}
                </span>
              </div>
              <div className="p-3 flex flex-col gap-2">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--fg)' }}>{sentenceCase(a.title)}</p>
                <p className="text-[11px]" style={{ color: 'var(--fg-muted)' }}>
                  {a.type} · {a.category}
                  {a.bought_at ? ` · ${new Date(a.bought_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                </p>
                <button
                  onClick={() => download(a)}
                  disabled={busy === a.id}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold"
                  style={{
                    background: busy === a.id ? 'rgba(151,101,224,0.4)' : 'linear-gradient(135deg,#9765E0,#534FA5)',
                    color: 'white', cursor: busy === a.id ? 'default' : 'pointer',
                  }}
                >
                  {busy === a.id ? 'Preparing…' : 'Download · Owned'}
                </button>
              </div>
            </div>
          ))}
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
