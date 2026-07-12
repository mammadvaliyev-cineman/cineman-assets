'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'

// ─────────────────────────────────────────────────────────────
// PROFILE (owner's spec): avatar upload (JPG/PNG ≤5 MB → Supabase
// Storage avatars/, URL in profiles.avatar_url — replaces the «M»
// in the navbar), display name, short bio (~200 chars), read-only
// email/plan/credits, one Save button. Simple, nothing extra.
// ─────────────────────────────────────────────────────────────

const BIO_LIMIT = 200
const AVATAR_LIMIT = 5 * 1024 * 1024 // 5 MB

export default function ProfilePage() {
  const { user } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [plan, setPlan] = useState('free')
  const [credits, setCredits] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  // crop positioner (spec A2): drag + zoom inside the circle, save the cropped result
  const [cropSrc, setCropSrc] = useState<string | null>(null)
  const [cropPos, setCropPos] = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const cropImg = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000) }

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('display_name, bio, avatar_url, plan, credits').eq('id', user.id).single()
      .then(({ data }) => {
        if (!data) return
        setDisplayName(data.display_name ?? '')
        setBio(data.bio ?? '')
        setAvatarUrl(data.avatar_url ?? null)
        setPlan(data.plan ?? 'free')
        setCredits(data.credits ?? null)
      })
  }, [user])

  function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!/^image\/(jpeg|png)$/.test(file.type)) { say('JPG or PNG only'); return }
    if (file.size > AVATAR_LIMIT) { say('Max size is 5 MB'); return }
    const fr = new FileReader()
    fr.onload = () => { setCropSrc(String(fr.result)); setCropPos({ x: 0, y: 0 }); setCropZoom(1) }
    fr.readAsDataURL(file)
    if (fileRef.current) fileRef.current.value = ''
  }

  // draw the visible circle into a 512px square and upload THAT (spec A2)
  async function saveCrop() {
    const img = cropImg.current
    if (!img || !user) return
    setUploading(true)
    try {
      const view = 280 // on-screen circle size
      const base = Math.max(view / img.naturalWidth, view / img.naturalHeight) // cover
      const scale = base * cropZoom
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 512
      const ctx = canvas.getContext('2d')!
      const k = 512 / view
      const drawW = img.naturalWidth * scale * k
      const drawH = img.naturalHeight * scale * k
      const cx = (view / 2 + cropPos.x - (img.naturalWidth * scale) / 2) * k
      const cy = (view / 2 + cropPos.y - (img.naturalHeight * scale) / 2) * k
      ctx.drawImage(img, cx, cy, drawW, drawH)
      const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92))
      if (!blob) { say('Crop failed'); return }
      const path = `avatars/${user.id}-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('assets').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) { say('Upload failed — try again'); return }
      const url = supabase.storage.from('assets').getPublicUrl(path).data.publicUrl
      setAvatarUrl(url)
      setCropSrc(null)
      say('Photo cropped — press Save')
    } finally { setUploading(false) }
  }

  async function save() {
    if (!user || saving) return
    setSaving(true)
    try {
      const { error } = await supabase.from('profiles')
        .update({ display_name: displayName.trim() || null, bio: bio.trim() || null, avatar_url: avatarUrl })
        .eq('id', user.id)
      if (error) { say('Save failed — try again'); return }
      // navbar listens and swaps the «M» for the new photo without a reload
      window.dispatchEvent(new CustomEvent('cineman-profile-changed', { detail: { avatarUrl, displayName } }))
      say('Saved')
    } finally { setSaving(false) }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-24 text-center">
        <h1 className="text-3xl font-bold mb-3" style={{ color: 'var(--fg)' }}>Profile</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>Sign in to edit your profile.</p>
        <Link href="/catalog" className="btn-primary px-6 py-2.5 text-sm font-bold inline-block">Browse the catalog</Link>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-bold mb-8" style={{ color: 'var(--fg)' }}>Profile</h1>

      {/* Avatar */}
      <div className="flex items-center gap-5 mb-8">
        <div style={{ width: 84, height: 84, borderRadius: '50%', overflow: 'hidden', backgroundColor: 'var(--bg-subtle)', border: '2px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {avatarUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={avatarUrl} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 30, fontWeight: 800, color: '#CE95FB' }}>{String(user.email || '?').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png" onChange={onPickAvatar} style={{ display: 'none' }} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary text-sm px-4 py-2 font-bold">
            {uploading ? 'Uploading…' : 'Upload photo'}
          </button>
          <p className="text-[11px] mt-2" style={{ color: 'var(--fg-subtle)' }}>JPG or PNG, up to 5 MB. Shown in the header.</p>
        </div>
      </div>

      {/* Display name */}
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--fg-muted)' }}>Display name</label>
      <input
        value={displayName}
        onChange={e => setDisplayName(e.target.value.slice(0, 60))}
        placeholder="How should we call you?"
        className="input-field w-full text-sm mb-5"
        style={{ padding: '10px 12px' }}
      />

      {/* Bio */}
      <label className="block text-xs font-semibold mb-1.5" style={{ color: 'var(--fg-muted)' }}>
        About you <span style={{ color: 'var(--fg-subtle)' }}>({bio.length}/{BIO_LIMIT})</span>
      </label>
      <textarea
        value={bio}
        onChange={e => setBio(e.target.value.slice(0, BIO_LIMIT))}
        placeholder="Director, producer, AI creator…"
        rows={3}
        className="input-field w-full text-sm mb-6"
        style={{ padding: '10px 12px', resize: 'vertical' }}
      />

      {/* Read-only account info */}
      <div className="rounded-xl p-4 mb-8" style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
        {[
          ['Email', user.email ?? '—'],
          ['Plan', plan.charAt(0).toUpperCase() + plan.slice(1)],
          ['Credits', credits === null ? '—' : String(credits)],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between py-1.5 text-sm">
            <span style={{ color: 'var(--fg-muted)' }}>{k}</span>
            <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{v}</span>
          </div>
        ))}
      </div>

      <button onClick={save} disabled={saving} className="btn-primary w-full py-2.5 text-sm font-bold">
        {saving ? 'Saving…' : 'Save'}
      </button>

      {/* Crop positioner: drag to frame, zoom to fit — saves the cropped circle */}
      {cropSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(8,5,15,0.85)', backdropFilter: 'blur(6px)' }}>
          <div className="rounded-2xl p-6" style={{ backgroundColor: '#120D1D', border: '1px solid var(--border)', width: 340 }}>
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--fg)' }}>Position your photo</p>
            <p className="text-[11px] mb-4" style={{ color: 'var(--fg-muted)' }}>Drag to frame, zoom to fit the circle.</p>
            <div
              style={{ width: 280, height: 280, borderRadius: '50%', overflow: 'hidden', margin: '0 auto', position: 'relative', backgroundColor: 'black', border: '2px solid rgba(151,101,224,0.5)', cursor: 'grab', touchAction: 'none' }}
              onPointerDown={e => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
                dragRef.current = { startX: e.clientX, startY: e.clientY, baseX: cropPos.x, baseY: cropPos.y }
              }}
              onPointerMove={e => {
                if (!dragRef.current) return
                setCropPos({ x: dragRef.current.baseX + (e.clientX - dragRef.current.startX), y: dragRef.current.baseY + (e.clientY - dragRef.current.startY) })
              }}
              onPointerUp={() => { dragRef.current = null }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={cropImg}
                src={cropSrc}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute', left: '50%', top: '50%',
                  transform: `translate(calc(-50% + ${cropPos.x}px), calc(-50% + ${cropPos.y}px)) scale(${cropZoom})`,
                  minWidth: '100%', minHeight: '100%', objectFit: 'cover', userSelect: 'none', pointerEvents: 'none',
                }}
              />
            </div>
            <div className="flex items-center gap-2 mt-4">
              <span className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>Zoom</span>
              <input type="range" min={1} max={3} step={0.01} value={cropZoom} onChange={e => setCropZoom(Number(e.target.value))} style={{ flex: 1, accentColor: '#9765E0' }} />
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={saveCrop} disabled={uploading} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: 'linear-gradient(135deg,#9765E0,#534FA5)', border: 'none', cursor: 'pointer' }}>
                {uploading ? 'Saving…' : 'Save'}
              </button>
              <button onClick={() => setCropSrc(null)} className="px-4 py-2.5 rounded-xl text-sm font-bold" style={{ border: '1px solid var(--border)', color: 'var(--fg-muted)', background: 'none', cursor: 'pointer' }}>Cancel</button>
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
