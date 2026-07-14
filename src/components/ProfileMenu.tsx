'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/components/AuthProvider'
import { CreditGem } from '@/components/AssetGrid'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────
// PROFILE MENU (owner's spec — exactly these items, no upsells):
// header: avatar + name + plan. Then Credits (clickable),
// Top-up credits + Get, My Library, View profile, Manage Account,
// Admin (admins only), divider, Sign Out.
// ─────────────────────────────────────────────────────────────

export default function ProfileMenu({
  avatarUrl, credits, plan, displayName, isAdmin, onTopup,
}: {
  avatarUrl: string | null
  credits: number | null
  plan: string
  displayName: string
  isAdmin: boolean
  onTopup: () => void
}) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!user) return null

  const planLabel = plan === 'pro' ? 'Pro' : plan === 'personal' ? 'Personal' : 'Free'
  const planColor = plan === 'pro' ? '#2DD4C4' : plan === 'personal' ? 'var(--accent-soft)' : 'var(--fg-subtle)'

  const avatar = avatarUrl || (user.user_metadata?.avatar_url as string) || (user.user_metadata?.picture as string) || null

  const rowStyle: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
    padding: '9px 14px', fontSize: 13, color: 'var(--fg)', textDecoration: 'none',
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  }
  const hover = {
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'color-mix(in srgb, var(--accent) 10%, transparent)'),
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => ((e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'),
  }

  const Ic = ({ d }: { d: string }) => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--fg-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(v => !v)} title="Profile menu" className="flex items-center" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        {avatar ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={avatar} alt="" className="rounded-full transition-transform hover:scale-105" style={{ width: 34, height: 34, border: '2px solid color-mix(in srgb, var(--accent) 60%, transparent)', objectFit: 'cover' }} />
        ) : (
          <span className="rounded-full flex items-center justify-center text-sm font-bold" style={{ width: 34, height: 34, background: 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: 'var(--on-accent)' }}>
            {String(user.email || '?').charAt(0).toUpperCase()}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 264, zIndex: 60,
            backgroundColor: '#120D1D', border: '1px solid var(--border)', borderRadius: 14,
            boxShadow: '0 18px 50px rgba(0,0,0,0.65)', overflow: 'hidden', paddingBottom: 6,
          }}
        >
          {/* header: avatar + name + plan */}
          <div className="flex items-center gap-3 px-4 py-3.5" style={{ borderBottom: '1px solid var(--border)' }}>
            {avatar ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={avatar} alt="" className="rounded-full" style={{ width: 38, height: 38, objectFit: 'cover' }} />
            ) : (
              <span className="rounded-full flex items-center justify-center text-sm font-bold" style={{ width: 38, height: 38, background: 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: 'var(--on-accent)' }}>
                {String(user.email || '?').charAt(0).toUpperCase()}
              </span>
            )}
            <div style={{ minWidth: 0 }}>
              <p className="text-[13px] font-bold truncate" style={{ color: 'var(--fg)', margin: 0 }}>{displayName || user.email}</p>
              <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: planColor }}>{planLabel} plan</span>
            </div>
          </div>

          {/* Credits — clickable, leads to the profile (balance details) */}
          <Link href="/profile" style={rowStyle} {...hover} onClick={() => setOpen(false)}>
            <CreditGem size={15} />
            <span style={{ flex: 1 }}>Credits</span>
            <span className="font-bold" style={{ color: 'var(--accent-soft)' }}>{credits ?? '…'}</span>
          </Link>

          {/* Top-up with a Get button */}
          <div style={{ ...rowStyle, cursor: 'default' }}>
            <Ic d="M12 5v14M5 12h14" />
            <span style={{ flex: 1 }}>Top-up credits</span>
            <button
              onClick={() => { setOpen(false); onTopup() }}
              className="text-[11px] font-bold px-3 py-1 rounded-full"
              style={{ background: 'linear-gradient(135deg,var(--accent),var(--accent-strong))', color: 'var(--on-accent)', border: 'none', cursor: 'pointer' }}
            >
              Get
            </button>
          </div>

          <Link href="/catalog?view=downloads" style={rowStyle} {...hover} onClick={() => setOpen(false)}>
            <Ic d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
            My Library
          </Link>
          <Link href="/profile" style={rowStyle} {...hover} onClick={() => setOpen(false)}>
            <Ic d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
            View profile
          </Link>
          <Link href="/account" style={rowStyle} {...hover} onClick={() => setOpen(false)}>
            <Ic d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            Manage Account
          </Link>
          {isAdmin && (
            <Link href="/admin" style={rowStyle} {...hover} onClick={() => setOpen(false)}>
              <Ic d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" />
              Admin
            </Link>
          )}

          <div style={{ height: 1, backgroundColor: 'var(--border)', margin: '6px 0' }} />
          <button
            style={{ ...rowStyle, color: '#e08a8a' }}
            {...hover}
            onClick={async () => { setOpen(false); await supabase.auth.signOut(); window.location.href = '/' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#e08a8a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  )
}
