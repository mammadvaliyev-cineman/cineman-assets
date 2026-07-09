import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, STYLES, MOODS, LIGHTING, Category } from '@/config/categories'

// ─────────────────────────────────────────────────────────────
// CATEGORIES CONFIG — live-editable taxonomy + styles/moods/
// lighting. Stored as a Config row in the assets table (no DB
// migration needed). GET returns saved config merged with code
// defaults; POST saves the whole thing.
// ─────────────────────────────────────────────────────────────

const ROW = { type: 'Config', title: 'categories-config' }

type TaxonomyConfig = {
  categories: Category[]
  styles: string[]
  moods: string[]
  lighting: string[]
}

const DEFAULTS: TaxonomyConfig = {
  categories: CATEGORIES,
  styles: STYLES,
  moods: MOODS,
  lighting: LIGHTING,
}

export async function GET() {
  try {
    const { data } = await supabase
      .from('assets')
      .select('id,description')
      .eq('type', ROW.type)
      .eq('title', ROW.title)
      .limit(1)
    const saved = data?.[0]?.description ? JSON.parse(data[0].description) : null
    if (Array.isArray(saved) && saved.length) {
      // legacy shape: plain categories array
      return NextResponse.json({ ...DEFAULTS, categories: saved })
    }
    if (saved && typeof saved === 'object') {
      return NextResponse.json({
        categories: Array.isArray(saved.categories) && saved.categories.length ? saved.categories : CATEGORIES,
        styles: Array.isArray(saved.styles) && saved.styles.length ? saved.styles : STYLES,
        moods: Array.isArray(saved.moods) && saved.moods.length ? saved.moods : MOODS,
        lighting: Array.isArray(saved.lighting) && saved.lighting.length ? saved.lighting : LIGHTING,
      })
    }
    return NextResponse.json(DEFAULTS)
  } catch {
    return NextResponse.json(DEFAULTS)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const config: TaxonomyConfig = {
      categories: Array.isArray(body.categories) && body.categories.length ? body.categories : CATEGORIES,
      styles: Array.isArray(body.styles) ? body.styles : STYLES,
      moods: Array.isArray(body.moods) ? body.moods : MOODS,
      lighting: Array.isArray(body.lighting) ? body.lighting : LIGHTING,
    }
    const payload = JSON.stringify(config)
    const { data } = await supabase
      .from('assets')
      .select('id')
      .eq('type', ROW.type)
      .eq('title', ROW.title)
      .limit(1)
    if (data?.length) {
      const { error } = await supabase.from('assets').update({ description: payload }).eq('id', data[0].id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('assets').insert({
        ...ROW,
        category: 'System',
        plan: 'free',
        tags: ['config'],
        description: payload,
        file_url: 'config://categories',
        thumbnail_url: 'config://categories',
      })
      if (error) throw error
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
