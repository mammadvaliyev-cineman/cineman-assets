import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'
import { CatalogConfig, DEFAULT_CATALOG_CONFIG } from '@/lib/catalogConfig'

// ─────────────────────────────────────────────────────────────
// CATALOG DISPLAY CONFIG — how asset cards render in the catalog.
// Stored as a Config row in the assets table (same pattern as
// engine-config), so no DB migration. GET is public (the catalog
// itself needs it), POST is admin-only.
// ─────────────────────────────────────────────────────────────

const ROW = { type: 'Config', title: 'catalog-config' }

// Never cache — admins expect the catalog to react right after Save
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
    return NextResponse.json({ config: { ...DEFAULT_CATALOG_CONFIG, ...saved } })
  } catch {
    return NextResponse.json({ config: DEFAULT_CATALOG_CONFIG })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { config } = await req.json()
    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'config is required' }, { status: 400 })
    }
    const clean: CatalogConfig = {
      fit: ['contain', 'cover', 'cover-top'].includes(config.fit) ? config.fit : DEFAULT_CATALOG_CONFIG.fit,
      ratio: ['1/1', '4/5', '3/4', '16/9', 'auto'].includes(config.ratio) ? config.ratio : DEFAULT_CATALOG_CONFIG.ratio,
    }
    const body = JSON.stringify(clean)
    const { data } = await supabaseAdmin()
      .from('assets')
      .select('id')
      .eq('type', ROW.type)
      .eq('title', ROW.title)
      .limit(1)
    if (data?.length) {
      const { error } = await supabaseAdmin()
        .from('assets')
        .update({ description: body })
        .eq('id', data[0].id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin().from('assets').insert({
        ...ROW,
        category: 'System',
        plan: 'free',
        tags: ['config'],
        description: body,
        file_url: 'config://catalog',
        thumbnail_url: 'config://catalog',
      })
      if (error) throw error
    }
    return NextResponse.json({ ok: true, config: clean })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
