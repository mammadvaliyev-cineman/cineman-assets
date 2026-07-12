import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// ADMIN: top up any account by email (self and test accounts).
// POST { email, amount } → profiles.credits += amount.
// Negative amounts are allowed (take credits away) but the
// balance never goes below zero.
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { email, amount } = await req.json()
    const amt = Math.round(Number(amount))
    if (!email || !Number.isFinite(amt) || amt === 0) {
      return NextResponse.json({ error: 'email and a non-zero amount are required' }, { status: 400 })
    }
    const admin = supabaseAdmin()
    const { data: prof, error } = await admin.from('profiles')
      .select('id, credits').eq('email', String(email).toLowerCase()).limit(1).maybeSingle()
    if (error || !prof) return NextResponse.json({ error: 'No profile with that email' }, { status: 404 })
    const next = Math.max(0, Number(prof.credits ?? 0) + amt)
    const { error: updErr } = await admin.from('profiles').update({ credits: next }).eq('id', prof.id)
    if (updErr) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
    return NextResponse.json({ ok: true, credits: next })
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
