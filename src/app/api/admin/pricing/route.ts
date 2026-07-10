import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// PRICING CONFIG (master handoff §4). One table drives it all:
//   standard / premium / exclusive  → per-download tier prices
//   plan_free / plan_personal / plan_pro → monthly credit grants
//     (plan_monthly_credits() SQL reads this table too, so the
//     monthly reset inside spend_credits follows the same numbers)
// Dollar prices live in LemonSqueezy (billing) — not stored here.
// ─────────────────────────────────────────────────────────────

const KNOWN = ['standard', 'premium', 'exclusive', 'plan_free', 'plan_personal', 'plan_pro']

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const { data, error } = await supabaseAdmin().from('pricing_defaults').select('tier, credits')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { rows } = await req.json()
    if (!Array.isArray(rows)) return NextResponse.json({ error: 'rows[] required' }, { status: 400 })
    const admin = supabaseAdmin()
    let saved = 0
    for (const r of rows) {
      const tier = String(r.tier)
      const credits = Math.max(0, Math.round(Number(r.credits)))
      if (!KNOWN.includes(tier) || !Number.isFinite(credits)) continue
      const { error } = await admin.from('pricing_defaults').upsert({ tier, credits })
      if (!error) saved++
    }
    return NextResponse.json({ ok: true, saved })
  } catch {
    return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  }
}
