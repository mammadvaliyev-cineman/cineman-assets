import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { DEFAULT_ENGINE_CONFIG, EngineConfig } from '@/lib/engine'

// ─────────────────────────────────────────────────────────────
// ENGINE CONFIG — stored as a special row in the assets table
// (type='Config', title='engine-config', description=JSON) so no
// DB migration is needed. GET returns merged config, POST saves.
// ─────────────────────────────────────────────────────────────

const ROW = { type: 'Config', title: 'engine-config' }

export async function GET() {
  try {
    const { data } = await supabase
      .from('assets')
      .select('id,description')
      .eq('type', ROW.type)
      .eq('title', ROW.title)
      .limit(1)
    const saved = data?.[0]?.description ? JSON.parse(data[0].description) : {}
    const config: EngineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      ...saved,
      visible: { ...DEFAULT_ENGINE_CONFIG.visible, ...(saved.visible || {}) },
    }
    return NextResponse.json({ config })
  } catch {
    return NextResponse.json({ config: DEFAULT_ENGINE_CONFIG })
  }
}

export async function POST(req: NextRequest) {
  try {
    const { config } = await req.json()
    if (!config || typeof config !== 'object') {
      return NextResponse.json({ error: 'config is required' }, { status: 400 })
    }
    const body = JSON.stringify(config)
    const { data } = await supabase
      .from('assets')
      .select('id')
      .eq('type', ROW.type)
      .eq('title', ROW.title)
      .limit(1)
    if (data?.length) {
      const { error } = await supabase
        .from('assets')
        .update({ description: body })
        .eq('id', data[0].id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('assets').insert({
        ...ROW,
        category: 'System',
        plan: 'free',
        tags: ['config'],
        description: body,
        file_url: 'config://engine',
        thumbnail_url: 'config://engine',
      })
      if (error) throw error
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
