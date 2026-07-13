import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

// ─────────────────────────────────────────────────────────────
// HOMEPAGE CONFIG — the «Featured collections» showcase tiles.
// The owner curates them by hand (season/trend); empty config =
// the homepage falls back to top categories automatically.
// Stored as a Config row in the assets table (same pattern as
// catalog-config) — no DB migration. GET public, POST admin-only.
// ─────────────────────────────────────────────────────────────

const ROW = { type: 'Config', title: 'homepage-config' }

export type FeaturedTile = { title: string; cat: string; cover: string }

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { data } = await supabase
      .from('assets')
      .select('id,description')
      .eq('type', ROW.type)
      .eq('title', ROW.title)
      .limit(1)
    const saved = data?.[0]?.description ? JSON.parse(data[0].description) : {}
    return NextResponse.json({ config: { featured: Array.isArray(saved.featured) ? saved.featured : [] } })
  } catch {
    return NextResponse.json({ config: { featured: [] } })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { config } = await req.json()
    const featured: FeaturedTile[] = (Array.isArray(config?.featured) ? config.featured : [])
      .slice(0, 4)
      .map((t: Record<string, unknown>) => ({
        title: String(t.title || '').slice(0, 60),
        cat: String(t.cat || '').slice(0, 40),
        cover: String(t.cover || '').slice(0, 500),
      }))
      .filter((t: FeaturedTile) => t.title && t.cat)
    const body = JSON.stringify({ featured })
    const admin = supabaseAdmin()
    const { data } = await admin.from('assets').select('id').eq('type', ROW.type).eq('title', ROW.title).limit(1)
    if (data?.length) {
      const { error } = await admin.from('assets').update({ description: body }).eq('id', data[0].id)
      if (error) throw error
    } else {
      const { error } = await admin.from('assets').insert({
        ...ROW,
        category: 'System',
        plan: 'free',
        tags: ['config'],
        description: body,
        file_url: 'config://homepage',
        thumbnail_url: 'config://homepage',
      })
      if (error) throw error
    }
    return NextResponse.json({ ok: true, config: { featured } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
