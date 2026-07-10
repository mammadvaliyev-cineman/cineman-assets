import { NextRequest, NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'

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

export async function POST(req: NextRequest) {
  try {
    const { assetId } = await req.json()
    if (!assetId) return NextResponse.json({ error: 'No asset ID provided' }, { status: 400 })

    // Look up the asset server-side — never trust client-provided URLs
    const { data, error } = await supabase
      .from('assets').select('file_url, title, credit_cost').eq('id', assetId).eq('is_public', true).single()
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
        const cost = Number(data.credit_cost ?? 5)
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
        return NextResponse.json({ url: data.file_url, credits: remaining, cost })
      }
      // invalid/expired token → fall through as anonymous
    }

    // Anonymous flow — unchanged (client enforces the free limit)
    return NextResponse.json({ url: data.file_url })
  } catch (err) {
    console.error('Download error:', err)
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }
}
