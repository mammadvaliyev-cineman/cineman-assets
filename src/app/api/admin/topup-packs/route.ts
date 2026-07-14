import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// ADMIN: save top-up packs (DEV_topup_credits §2) → Config row.

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { packs } = await req.json()
    if (!Array.isArray(packs)) return NextResponse.json({ error: 'packs[] required' }, { status: 400 })
    const clean = packs.slice(0, 8).map(p => ({
      credits: Math.max(1, Math.round(Number(p.credits) || 0)),
      usd: Math.max(0.5, Math.round(Number(p.usd) * 100) / 100 || 0),
      popular: Boolean(p.popular),
      ls_url: String(p.ls_url ?? '').slice(0, 500),
    })).filter(p => p.credits > 0 && p.usd > 0)
    if (clean.length === 0) return NextResponse.json({ error: 'At least one pack is required' }, { status: 400 })

    const admin = supabaseAdmin()
    const payload = JSON.stringify({ packs: clean })
    const { data: existing } = await admin
      .from('assets').select('id').eq('type', 'Config').eq('title', 'topup-packs').limit(1)
    if (existing?.length) {
      const { error } = await admin.from('assets').update({ description: payload }).eq('id', existing[0].id)
      if (error) throw error
    } else {
      const { error } = await admin.from('assets').insert({
        title: 'topup-packs', type: 'Config', category: 'System', plan: 'free',
        tags: ['config'], description: payload,
        file_url: 'config://topup-packs', thumbnail_url: 'config://topup-packs',
      })
      if (error) throw error
    }
    return NextResponse.json({ ok: true, saved: clean.length })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
