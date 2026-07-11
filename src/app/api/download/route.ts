import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { presignR2Get, r2Configured } from '@/lib/r2'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// DOWNLOAD with CREDITS.
// • Signed-in user (Bearer token): resolve user → asset credit_cost
//   → rpc spend_credits (atomic, monthly reset inside) → -1 means
//   not enough credits → HTTP 402 {code:'credits'} → client shows
//   the upgrade modal. Success → log to downloads, return url +
//   remaining balance.
// • Anonymous: unchanged — client-side free limit keeps working.
// Hidden assets are never downloadable.
// ─────────────────────────────────────────────────────────────

// The served file: the ORIGINAL from the private R2 bucket when mapped
// (short-lived signed URL, handed out only after credits are spent),
// otherwise the Supabase copy. Falls back to Supabase if R2 errors.
function servedUrl(data: { file_url: string; title?: string | null; r2_key?: string | null }): string {
  if (data.r2_key && r2Configured()) {
    try {
      const ext = String(data.r2_key).match(/\.[a-z0-9]+$/i)?.[0] ?? '.png'
      const pretty = (data.title || 'asset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + ext
      return presignR2Get(String(data.r2_key), pretty)
    } catch (e) { console.error('r2 presign failed, falling back:', e) }
  }
  return data.file_url
}

export async function POST(req: NextRequest) {
  try {
    const { assetId } = await req.json()
    if (!assetId) return NextResponse.json({ error: 'No asset ID provided' }, { status: 400 })

    // Look up the asset server-side — never trust client-provided URLs
    const { data, error } = await supabase
      .from('assets').select('file_url, title, credit_cost, price_tier, resolution, exclusive_owner, r2_key').eq('id', assetId).eq('is_public', true).single()
    if (error || !data?.file_url) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Signed-in flow: spend credits
    const auth = req.headers.get('authorization') || ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    if (token) {
      const admin = supabaseAdmin()
      const { data: userData, error: userErr } = await admin.auth.getUser(token)
      if (!userErr && userData?.user) {
        const userId = userData.user.id
        // EXCLUSIVELY SOLD: stays in the catalog but only the owner can
        // download it — and the owner already paid, so it's free for them
        if (data.exclusive_owner) {
          if (data.exclusive_owner === userId) return NextResponse.json({ url: servedUrl(data), owned: true })
          return NextResponse.json({ error: 'Exclusively sold', code: 'sold' }, { status: 403 })
        }
        // NULL credit_cost = follows the tier default (pricing_defaults)
        let cost = data.credit_cost == null ? NaN : Number(data.credit_cost)
        if (!Number.isFinite(cost)) {
          const { data: pd } = await admin.from('pricing_defaults')
            .select('credits').eq('tier', String(data.price_tier ?? 'standard')).single()
          cost = Number(pd?.credits ?? 5)
        }
        // Native 4K is INCLUDED at the same price (owner's decision):
        // the resolution badge tells the truth, the price doesn't change.
        // 10-credit price is reserved for on-demand 2K→4K upscaling.
        const { data: remaining, error: rpcErr } = await admin.rpc('spend_credits', { p_user: userId, p_cost: cost })
        if (rpcErr) {
          return NextResponse.json({ error: 'Billing error, try again' }, { status: 500 })
        }
        if (typeof remaining === 'number' && remaining < 0) {
          return NextResponse.json(
            { error: 'Not enough credits', code: 'credits', cost },
            { status: 402 },
          )
        }
        await admin.from('downloads').insert({ user_id: userId, asset_id: assetId, cost }).then(() => {}, () => {})
        return NextResponse.json({ url: servedUrl(data), credits: remaining, cost })
      }
      // invalid/expired token → fall through as anonymous
    }

    // Anonymous flow — unchanged (client enforces the free limit),
    // but sold assets are locked for everyone except the owner
    if (data.exclusive_owner) {
      return NextResponse.json({ error: 'Exclusively sold', code: 'sold' }, { status: 403 })
    }
    return NextResponse.json({ url: servedUrl(data) })
  } catch (err) {
    console.error('Download error:', err)
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }
}
