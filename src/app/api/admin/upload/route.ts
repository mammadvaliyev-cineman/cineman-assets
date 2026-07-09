import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

// ─────────────────────────────────────────────────────────────
// ADMIN UPLOAD — server-mediated storage writes (admin only).
// Body: multipart/form-data { file, path }. Returns public URL.
// ─────────────────────────────────────────────────────────────

export const maxDuration = 30

const SAFE_PATH = /^[a-z0-9/_.-]+$/i

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const path = String(form.get('path') || '')
    if (!file || !path) return NextResponse.json({ error: 'file and path are required' }, { status: 400 })
    if (!SAFE_PATH.test(path) || path.includes('..')) {
      return NextResponse.json({ error: 'invalid path' }, { status: 400 })
    }
    const admin = supabaseAdmin()
    const buf = Buffer.from(await file.arrayBuffer())
    const { error } = await admin.storage.from('assets').upload(path, buf, {
      contentType: file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert: false,
    })
    if (error) throw error
    const url = admin.storage.from('assets').getPublicUrl(path).data.publicUrl
    return NextResponse.json({ url, path })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
