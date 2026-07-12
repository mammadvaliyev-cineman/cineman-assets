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

  async function onPickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!/^image\/(jpeg|png)$/.test(file.type)) { say('JPG or PNG only'); return }
    if (file.size > AVATAR_LIMIT) { say('Max size is 5 MB'); return }
    setUploading(true)
    try {
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const path = `avatars/${user.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('assets').upload(path, file, { contentType: file.type })
      if (error) { say('Upload failed — try again'); return }
      const url = supabase.storage.from('assets').getPublicUrl(path).data.publicUrl
      setAvatarUrl(url) // shown immediately; persisted on Save
      say('Photo uploaded — press Save')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
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
