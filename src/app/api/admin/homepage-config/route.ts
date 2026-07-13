import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

// ─────────────────────────────────────────────────────────────
// HOMEPAGE CONFIG (DEV_batch_60 §5/§6) — everything the owner
// curates on the homepage:
// • featured  — showcase tiles (catalog cover OR uploaded promo
//   poster with its own link and optional hidden caption)
// • catCovers — cover per «Shop by category» tile
// • heroFrames — the location frames in the ken-burns showreel
// • newWeekIds — hand-picked set for the «New this week» shelf
// Empty fields = the automatic defaults keep working.
// Stored as a Config row in the assets table. GET public, POST admin.
// ─────────────────────────────────────────────────────────────

const ROW = { type: 'Config', title: 'homepage-config' }

export type FeaturedTile = {
  title: string; cat: string; cover: string
  promo?: boolean; href?: string; hideTitle?: boolean
}

export const dynamic = 'force-dynamic'

const str = (v: unknown, max: number) => String(v ?? '').slice(0, max)

export async function GET() {
  try {
    const { data } = await supabase
      .from('assets').select('id,description')
      .eq('type', ROW.type).eq('title', ROW.title).limit(1)
    const saved = data?.[0]?.description ? JSON.parse(data[0].description) : {}
    return NextResponse.json({
      config: {
        featured: Array.isArray(saved.featured) ? saved.featured : [],
        catCovers: saved.catCovers && typeof saved.catCovers === 'object' ? saved.catCovers : {},
        heroFrames: Array.isArray(saved.heroFrames) ? saved.heroFrames : [],
        newWeekIds: Array.isArray(saved.newWeekIds) ? saved.newWeekIds : [],
      },
    })
  } catch {
    return NextResponse.json({ config: { featured: [], catCovers: {}, heroFrames: [], newWeekIds: [] } })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { config } = await req.json()
    // A tile needs only a COVER — title falls back to the category name
    const featured: FeaturedTile[] = (Array.isArray(config?.featured) ? config.featured : [])
      .slice(0, 4)
      .map((t: Record<string, unknown>) => ({
        title: str(t.title, 60).trim() || str(t.cat, 40),
        cat: str(t.cat, 40),
        cover: str(t.cover, 500),
        promo: Boolean(t.promo),
        href: str(t.href, 300),
        hideTitle: Boolean(t.hideTitle),
      }))
      .filter((t: FeaturedTile) => t.cover && (t.cat || t.href))
    const catCovers: Record<string, string> = {}
    if (config?.catCovers && typeof config.catCovers === 'object') {
      for (const [k, v] of Object.entries(config.catCovers).slice(0, 12)) {
        if (v) catCovers[str(k, 40)] = str(v, 500)
      }
    }
    const heroFrames: string[] = (Array.isArray(config?.heroFrames) ? config.heroFrames : [])
      .slice(0, 6).map((u: unknown) => str(u, 500)).filter(Boolean)
    const newWeekIds: string[] = (Array.isArray(config?.newWeekIds) ? config.newWeekIds : [])
      .slice(0, 12).map((u: unknown) => str(u, 60)).filter(Boolean)

    const body = JSON.stringify({ featured, catCovers, heroFrames, newWeekIds })
    const admin = supabaseAdmin()
    const { data } = await admin.from('assets').select('id').eq('type', ROW.type).eq('title', ROW.title).limit(1)
    if (data?.length) {
      const { error } = await admin.from('assets').update({ description: body }).eq('id', data[0].id)
      if (error) throw error
    } else {
      const { error } = await admin.from('assets').insert({
        ...ROW, category: 'System', plan: 'free', tags: ['config'],
        description: body, file_url: 'config://homepage', thumbnail_url: 'config://homepage',
      })
      if (error) throw error
    }
    revalidatePath('/')
    return NextResponse.json({ ok: true, config: { featured, catCovers, heroFrames, newWeekIds } })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
