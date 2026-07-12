import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// ADMIN REFUND (owner's spec B2): give credits back + remove the
// asset from the user's ownership. Users can NOT refund themselves —
// they only get «remove from my library» (hide, no refund).
// GET  ?email=  → list that user's purchases (for the admin panel)
// POST { email, assetId } → refund cost + delete the purchase;
//   if the purchase was an exclusive buyout, the asset returns
//   to the open catalog (exclusive_owner cleared).
// ─────────────────────────────────────────────────────────────

async function findProfile(email: string) {
  const admin = supabaseAdmin()
  const { data } = await admin.from('profiles')
    .select('id, credits, email').eq('email', email.toLowerCase()).limit(1).maybeSingle()
  return data
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const email = req.nextUrl.searchParams.get('email') || ''
  if (!email) return NextResponse.json({ error: 'email is required' }, { status: 400 })
  const prof = await findProfile(email)
  if (!prof) return NextResponse.json({ error: 'No profile with that email' }, { status: 404 })
  const admin = supabaseAdmin()
  const { data: purchases } = await admin.from('purchases')
    .select('asset_id, cost, created_at, has_4k').eq('user_id', prof.id).order('created_at', { ascending: false }).limit(200)
  const ids = (purchases || []).map(p => p.asset_id)
  const titles = new Map<string, { title: string; exclusive_owner: string | null }>()
  for (let i = 0; i < ids.length; i += 100) {
    const { data } = await admin.from('assets').select('id, title, exclusive_owner').in('id', ids.slice(i, i + 100))
    for (const a of data || []) titles.set(String(a.id), { title: a.title, exclusive_owner: a.exclusive_owner })
  }
  return NextResponse.json({
    credits: prof.credits,
    purchases: (purchases || []).map(p => ({
      assetId: p.asset_id,
      title: titles.get(String(p.asset_id))?.title ?? '(deleted asset)',
      cost: p.cost,
      exclusive: titles.get(String(p.asset_id))?.exclusive_owner === prof.id,
      boughtAt: p.created_at,
    })),
  })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { email, assetId } = await req.json()
    if (!email || !assetId) return NextResponse.json({ error: 'email and assetId are required' }, { status: 400 })
    const prof = await findProfile(email)
    if (!prof) return NextResponse.json({ error: 'No profile with that email' }, { status: 404 })
    const admin = supabaseAdmin()
    const { data: purchase } = await admin.from('purchases')
      .select('id, cost').eq('user_id', prof.id).eq('asset_id', assetId).maybeSingle()
    if (!purchase) return NextResponse.json({ error: 'No such purchase' }, { status: 404 })

    // 1) money back (spend a negative amount = refund, atomic)
    const cost = Number(purchase.cost ?? 0)
    if (cost > 0) {
      const { error: rpcErr } = await admin.rpc('spend_credits', { p_user: prof.id, p_cost: -cost })
      if (rpcErr) return NextResponse.json({ error: 'Refund failed (billing)' }, { status: 500 })
    }
    // 2) ownership removed
    await admin.from('purchases').delete().eq('id', purchase.id)
    // 3) if it was an exclusive buyout — asset returns to the catalog
    await admin.from('assets')
      .update({ exclusive_owner: null, exclusive_sold_at: null })
      .eq('id', assetId).eq('exclusive_owner', prof.id).then(() => {}, () => {})

    return NextResponse.json({ ok: true, refunded: cost })
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
