import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

// ─────────────────────────────────────────────────────────────
// ADMIN ASSETS API — the only way to write to the assets table.
// All requests must carry a valid admin session token. The anon
// key has read-only access (RLS), so the browser can never write
// directly to the database.
// ─────────────────────────────────────────────────────────────

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const row = await req.json()
    const allowed = ['title', 'type', 'category', 'plan', 'tags', 'description', 'file_url', 'thumbnail_url', 'is_public', 'credit_cost', 'exclusive_price', 'price_tier', 'exclusive_owner', 'exclusive_sold_at']
    const clean: Record<string, unknown> = {}
    for (const k of allowed) if (k in row) clean[k] = row[k]
    // Copyright-sensitive categories are hidden by default on ingest
    const COPYRIGHT_CATEGORIES = ['Celebrities', 'Characters']
    if (!('is_public' in clean) && COPYRIGHT_CATEGORIES.includes(String(clean.category))) {
      clean.is_public = false
    }
    const { data, error } = await supabaseAdmin().from('assets').insert(clean).select().single()
    if (error) throw error
    return NextResponse.json({ asset: data })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Insert failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { id, ...rest } = await req.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const allowed = ['title', 'type', 'category', 'plan', 'tags', 'description', 'file_url', 'thumbnail_url', 'is_public', 'credit_cost', 'exclusive_price', 'price_tier', 'exclusive_owner', 'exclusive_sold_at']
    const clean: Record<string, unknown> = {}
    for (const k of allowed) if (k in rest) clean[k] = rest[k]
    const { error } = await supabaseAdmin().from('assets').update(clean).eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const admin = supabaseAdmin()
    const { data: rows } = await admin.from('assets').select('file_url,thumbnail_url').eq('id', id).limit(1)
    const row = rows?.[0]
    // best-effort: remove the storage files behind this asset
    if (row) {
      for (const url of [row.file_url, row.thumbnail_url]) {
        if (typeof url === 'string' && url.includes('/assets/')) {
          const path = url.split('/assets/')[1]
          if (path && !path.startsWith('config')) {
            await admin.storage.from('assets').remove([path]).catch(() => {})
          }
        }
      }
    }
    const { error } = await admin.from('assets').delete().eq('id', id)
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Delete failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
