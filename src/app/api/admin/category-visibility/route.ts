import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// CATEGORY VISIBILITY — hide/show a whole section without SQL.
// GET  → real type/category combos with total + public counts.
// POST {type, category, is_public} → bulk flip every asset in
// that combo. Reversible; buyout locks (exclusive_owner) untouched.
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const admin = supabaseAdmin()
  const combos = new Map<string, { type: string; category: string; total: number; visible: number }>()
  const PAGE = 1000
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await admin.from('assets')
      .select('type, category, is_public')
      .not('type', 'in', '("Config","Generation","Usage")')
      .range(from, from + PAGE - 1)
    if (error || !data) break
    for (const r of data) {
      const key = `${r.type}|||${String(r.category ?? '').trim()}`
      const c = combos.get(key) ?? { type: String(r.type), category: String(r.category ?? '').trim(), total: 0, visible: 0 }
      c.total++
      if (r.is_public !== false) c.visible++
      combos.set(key, c)
    }
    if (data.length < PAGE) break
  }
  const list = Array.from(combos.values()).sort((a, b) => (a.type + a.category).localeCompare(b.type + b.category))
  return NextResponse.json({ combos: list })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { type, category, is_public } = await req.json()
    if (!type || typeof is_public !== 'boolean') {
      return NextResponse.json({ error: 'type and is_public are required' }, { status: 400 })
    }
    const admin = supabaseAdmin()
    let q = admin.from('assets').update({ is_public }).eq('type', type)
    if (category) q = q.eq('category', category)
    const { error } = await q
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Update failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
