import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// ADMIN: upload a promo poster / custom cover (DEV_batch_60 §6).
// FormData {file} → Supabase storage assets/promo/<ts>.<ext> via
// the service role (bucket RLS only allows avatar self-uploads).
// Returns the public URL to use as a Featured tile cover.
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: 'Max 8 MB' }, { status: 400 })
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return NextResponse.json({ error: 'JPG, PNG or WebP only' }, { status: 400 })
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `promo/${Date.now()}.${ext}`
    const admin = supabaseAdmin()
    const buf = Buffer.from(await file.arrayBuffer())
    const { error } = await admin.storage.from('assets').upload(path, buf, { contentType: file.type, upsert: true })
    if (error) throw error
    const url = admin.storage.from('assets').getPublicUrl(path).data.publicUrl
    return NextResponse.json({ ok: true, url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
