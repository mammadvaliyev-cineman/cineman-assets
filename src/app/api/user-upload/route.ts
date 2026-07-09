import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────
// USER UPLOAD — studio users add their own hero/location/prop.
// Server-mediated: the browser never writes to storage or the
// database directly. Basic size/type checks; auth gate can be
// tightened to subscribers in Stage 3.
// ─────────────────────────────────────────────────────────────

export const maxDuration = 30

const MAX_BYTES = 4 * 1024 * 1024 // 4MB (client compresses to ~0.4MB)
const TYPES = ['Character', 'Location', 'Prop', 'Vehicle']

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const assetType = String(form.get('type') || 'Prop')
    const title = String(form.get('title') || 'User Upload').slice(0, 80)
    const category = String(form.get('category') || 'User Upload').slice(0, 60)
    const description = String(form.get('description') || '').slice(0, 600)
    const tagsRaw = String(form.get('tags') || '')

    if (!file) return NextResponse.json({ error: 'file is required' }, { status: 400 })
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'only images allowed' }, { status: 400 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: 'file too large (max 4MB)' }, { status: 413 })
    if (!TYPES.includes(assetType)) return NextResponse.json({ error: 'invalid type' }, { status: 400 })

    const admin = supabaseAdmin()
    const path = `user/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
    const buf = Buffer.from(await file.arrayBuffer())
    const { error: upErr } = await admin.storage.from('assets').upload(path, buf, { contentType: 'image/jpeg' })
    if (upErr) throw upErr
    const url = admin.storage.from('assets').getPublicUrl(path).data.publicUrl

    const tags = tagsRaw
      ? [...tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).slice(0, 14), 'user-upload']
      : ['user-upload']

    const { data, error: dbErr } = await admin.from('assets').insert({
      title,
      type: assetType,
      category,
      plan: 'free',
      tags,
      description,
      file_url: url,
      thumbnail_url: url,
    }).select().single()
    if (dbErr) throw dbErr

    return NextResponse.json({ asset: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
