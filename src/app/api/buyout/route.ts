import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// EXCLUSIVE BUYOUT (owner's spec, 11.07.2026):
// • Pro plan only — everyone else gets 403 {code:'pro'} → the
//   client shows the upgrade modal (drives Pro conversions).
// • Costs assets.exclusive_price (default 50 credits), spent via
//   the same atomic spend_credits RPC as downloads.
// • On success the asset STAYS in the catalog marked SOLD
//   (exclusive_owner + exclusive_sold_at): others see the lock and
//   can't download or buy; the owner downloads free.
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { assetId } = await req.json()
    if (!assetId) return NextResponse.json({ error: 'No asset ID provided' }, { status: 400 })

    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'Sign in required', code: 'auth' }, { status: 401 })

    const admin = supabaseAdmin()
    const { data: userData, error: userErr } = await admin.auth.getUser(token)
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid session', code: 'auth' }, { status: 401 })
    }
    const userId = userData.user.id

    // Pro gate
    const { data: prof } = await admin.from('profiles').select('plan').eq('id', userId).single()
    if ((prof?.plan ?? 'free') !== 'pro') {
      return NextResponse.json({ error: 'Exclusive buyouts are a Pro feature', code: 'pro' }, { status: 403 })
    }

    // Asset must be public and not already sold to someone
    const { data: asset, error: assetErr } = await supabase
      .from('assets')
      .select('file_url, title, exclusive_price, is_public, exclusive_owner')
      .eq('id', assetId).eq('is_public', true).single()
    if (assetErr || !asset?.file_url) {
      return NextResponse.json({ error: 'Asset not available' }, { status: 404 })
    }
    if (asset.exclusive_owner) {
      return NextResponse.json({ error: 'Already exclusively sold', code: 'sold' }, { status: 409 })
    }

    // NULL exclusive_price = follows pricing_defaults.exclusive
    let cost = asset.exclusive_price == null ? NaN : Number(asset.exclusive_price)
    if (!Number.isFinite(cost)) {
      const { data: pd } = await admin.from('pricing_defaults').select('credits').eq('tier', 'exclusive').single()
      cost = Number(pd?.credits ?? 50)
    }
    const { data: remaining, error: rpcErr } = await admin.rpc('spend_credits', { p_user: userId, p_cost: cost })
    if (rpcErr) return NextResponse.json({ error: 'Billing error, try again' }, { status: 500 })
    if (typeof remaining === 'number' && remaining < 0) {
      return NextResponse.json({ error: 'Not enough credits', code: 'credits', cost }, { status: 402 })
    }

    // SOLD state (owner's spec v2): the asset STAYS in the catalog with a
    // lock — is_public untouched. .is(exclusive_owner, null) guards against
    // two buyers racing. If the update fails we refund.
    const { error: updErr } = await admin.from('assets')
      .update({ exclusive_owner: userId, exclusive_sold_at: new Date().toISOString() })
      .eq('id', assetId).is('exclusive_owner', null)
    if (updErr) {
      await admin.rpc('spend_credits', { p_user: userId, p_cost: -cost }).then(() => {}, () => {})
      return NextResponse.json({ error: 'Buyout failed, credits refunded' }, { status: 500 })
    }

    await admin.from('downloads').insert({ user_id: userId, asset_id: assetId, cost }).then(() => {}, () => {})
    return NextResponse.json({ url: asset.file_url, credits: remaining, cost, exclusive: true })
  } catch (err) {
    console.error('Buyout error:', err)
    return NextResponse.json({ error: 'Buyout failed' }, { status: 500 })
  }
}
