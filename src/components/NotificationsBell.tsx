'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────
// NOTIFICATIONS BELL (owner's spec): admin announcements (news,
// promos, new collections) + the user's system events (render
// ready, purchase done, low credits). Unread badge = items newer
// than the locally stored last-read timestamp; «Mark all read»
// bumps it. Sits left of the avatar in the navbar.
// ─────────────────────────────────────────────────────────────

type Item = { id: string; title: string; body: string | null; href: string | null; created_at: string; kind: 'news' | 'event' }

const READ_KEY = 'cineman_notif_read_at'

function timeAgo(iso: string): string {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function NotificationsBell() {
  const { user } = useAuth()
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [readAt, setReadAt] = useState<number>(0)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try { setReadAt(Number(localStorage.getItem(READ_KEY)) || 0) } catch { /* noop */ }
  }, [])

  useEffect(() => {
    if (!user) { setItems([]); return }
    const load = async () => {
      const [ann, ev] = await Promise.all([
        supabase.from('announcements').select('id,title,body,href,created_at').order('created_at', { ascending: false }).limit(20),
        supabase.from('user_events').select('id,title,body,href,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      ])
      const merged: Item[] = [
        ...(ann.data || []).map(a => ({ ...a, id: String(a.id), kind: 'news' as const })),
        ...(ev.data || []).map(a => ({ ...a, id: String(a.id), kind: 'event' as const })),
      ].sort((x, y) => new Date(y.created_at).getTime() - new Date(x.created_at).getTime()).slice(0, 30)
      setItems(merged)
    }
    load()
    const t = setInterval(load, 60000) // refresh every minute
    return () => clearInterval(t)
  }, [user])

  // click-outside closes the panel
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!user) return null

  const unread = items.filter(i => new Date(i.created_at).getTime() > readAt).length
  const markAllRead = () => {
    const now = Date.now()
    setReadAt(now)
    try { localStorage.setItem(READ_KEY, String(now)) } catch { /* noop */ }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(v => !v); if (!open && unread) { /* opening marks nothing yet — explicit Mark all read */ } }}
        title="Notifications"
        className="flex items-center justify-center"
        style={{ width: 34, height: 34, borderRadius: 999, background: 'none', border: '1px solid var(--border)', color: 'var(--fg-muted)', cursor: 'pointer', position: 'relative' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute text-[9px] font-bold flex items-center justify-center"
            style={{ top: -3, right: -3, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 999, backgroundColor: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 340, zIndex: 60,
            backgroundColor: '#120D1D', border: '1px solid var(--border)', borderRadius: 14,
            boxShadow: '0 18px 50px rgba(0,0,0,0.65)', overflow: 'hidden',
          }}
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <span className="text-sm font-bold" style={{ color: 'var(--fg)' }}>Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-[11px] font-semibold" style={{ color: 'var(--accent-soft)', background: 'none', border: 'none', cursor: 'pointer' }}>
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {items.length === 0 && (
              <p className="text-xs px-4 py-6 text-center" style={{ color: 'var(--fg-subtle)' }}>No notifications yet.</p>
            )}
            {items.map(i => {
              const isUnread = new Date(i.created_at).getTime() > readAt
              const inner = (
                <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: isUnread ? 'color-mix(in srgb, var(--accent) 7%, transparent)' : 'transparent' }}>
                  <div className="flex items-center gap-2">
                    {isUnread && <span style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: 'var(--accent)', flexShrink: 0 }} />}
                    <span className="text-xs font-bold truncate" style={{ color: 'var(--fg)' }}>{i.title}</span>
                    <span className="text-[10px] ml-auto flex-shrink-0" style={{ color: 'var(--fg-subtle)' }}>{timeAgo(i.created_at)}</span>
                  </div>
                  {i.body && <p className="text-[11px] mt-1" style={{ color: 'var(--fg-muted)', margin: '4px 0 0' }}>{i.body}</p>}
                  <span className="text-[9.5px] font-bold uppercase tracking-wide" style={{ color: i.kind === 'news' ? 'var(--accent-soft)' : '#2DD4C4' }}>
                    {i.kind === 'news' ? 'News' : 'Activity'}
                  </span>
                </div>
              )
              return i.href ? (
                <a key={i.id} href={i.href} style={{ display: 'block', textDecoration: 'none' }}>{inner}</a>
              ) : (
                <div key={i.id}>{inner}</div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
