import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, Category } from '@/config/categories'

// ─────────────────────────────────────────────────────────────
// CATEGORIES CONFIG — live-editable taxonomy. Stored as a Config
// row in the assets table (no DB migration needed). GET returns
// the saved taxonomy or the code defaults; POST saves.
// ─────────────────────────────────────────────────────────────

const ROW = { type: 'Config', title: 'categories-config' }

export async function GET() {
  try {
    const { data } = await supabase
      .from('assets')
      .select('id,description')
      .eq('type', ROW.type)
      .eq('title', ROW.title)
      .limit(1)
    const saved: Category[] | null = data?.[0]?.description ? JSON.parse(data[0].description) : null
    return NextResponse.json({ categories: Array.isArray(saved) && saved.length ? saved : CATEGORIES })
  } catch {
    return NextResponse.json({ categories: CATEGORIES })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { categories } = await req.json()
    if (!Array.isArray(categories) || !categories.length) {
      return NextResponse.json({ error: 'categories array is required' }, { status: 400 })
    }
    const body = JSON.stringify(categories)
    const { data } = await supabase
      .from('assets')
      .select('id')
      .eq('type', ROW.type)
      .eq('title', ROW.title)
      .limit(1)
    if (data?.length) {
      const { error } = await supabase.from('assets').update({ description: body }).eq('id', data[0].id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('assets').insert({
        ...ROW,
        category: 'System',
        plan: 'free',
        tags: ['config'],
        description: body,
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
