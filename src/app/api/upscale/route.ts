import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { presignR2Get, r2Configured, r2Put } from '@/lib/r2'
import { requireUser, isAdminEmail } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// 2K → 4K UPSCALE (owner's spec B3/B4). One place: the Download
// button's «Get in 4K · 10» option. Rules:
// • Native 4K assets never come here — the button hides the option.
// • FIRST 4K request renders via Topaz (fal.ai), result is CACHED
//   in R2 as `4k/<key>` + assets.r2_key_4k — later buyers get the
//   cache instantly, render cost amortizes to zero.
// • Ownership is per resolution: buying 2K does not include 4K;
//   purchases.has_4k marks who paid the upscale (their re-downloads
//   of the 4K file are free).
// • Price = pricing_defaults.gen_4k (default 10). Atomic spend,
//   refund on render failure. Admins pay nothing (testing).
// • Requires FAL_KEY in env — without it responds 503 {code:'soon'}.
// ─────────────────────────────────────────────────────────────

const FAL_MODEL = 'fal-ai/topaz/upscale/image'

async function falUpscale(sourceUrl: string): Promise<Buffer> {
  const res = await fetch(`https://fal.run/${FAL_MODEL}`, {
    method: 'POST',
    headers: { Authorization: `Key ${process.env.FAL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: sourceUrl, upscale_factor: 2, model: 'Standard V2' }),
  })
  if (!res.ok) throw new Error('fal ' + res.status + ' ' + (await res.text()).slice(0, 200))
  const json = await res.json()
  const outUrl = json?.image?.url || json?.images?.[0]?.url
  if (!outUrl) throw new Error('fal: no image in response')
  const img = await fetch(outUrl)
  if (!img.ok) throw new Error('fal result fetch ' + img.status)
  return Buffer.from(await img.arrayBuffer())
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireUser(req)
    if (!gate.ok) return NextResponse.json({ error: gate.error, code: 'auth' }, { status: gate.status })
    const { assetId } = await req.json()
    if (!assetId) return NextResponse.json({ error: 'No asset ID provided' }, { status: 400 })

    const admin = supabaseAdmin()
    const { data: asset, error } = await admin.from('assets')
      .select('title, resolution, r2_key, r2_key_4k, exclusive_owner, is_public')
      .eq('id', assetId).eq('is_public', true).single()
    if (error || !asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    if (asset.exclusive_owner && asset.exclusive_owner !== gate.userId) {
      return NextResponse.json({ error: 'Exclusively sold', code: 'sold' }, { status: 403 })
    }
    if (asset.resolution === '4K') {
      return NextResponse.json({ error: 'Already native 4K — regular download includes it' }, { status: 400 })
    }
    if (!r2Configured() || !asset.r2_key) {
      return NextResponse.json({ error: '4K upscale is not available for this asset yet', code: 'soon' }, { status: 503 })
    }

    const pretty = (asset.title || 'asset').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') + '-4k.png'

    // Already paid for 4K? Serve the cache free, forever.
    const { data: purchase } = await admin.from('purchases')
      .select('id, has_4k').eq('user_id', gate.userId).eq('asset_id', assetId).maybeSingle()
    if (purchase?.has_4k && asset.r2_key_4k) {
      return NextResponse.json({ url: presignR2Get(String(asset.r2_key_4k), pretty), owned: true, cost: 0 })
    }

    // Price from Admin → Pricing (gen_4k = «Upscale 2K→4K»)
    const { data: pd } = await admin.from('pricing_defaults').select('credits').eq('tier', 'gen_4k').single()
    const cost = Number(pd?.credits ?? 10)
    const adminFree = isAdminEmail(gate.email)

    // Need a render but no engine configured → don't charge anyone
    if (!asset.r2_key_4k && !process.env.FAL_KEY) {
      return NextResponse.json({ error: '4K upscale is coming soon', code: 'soon' }, { status: 503 })
    }

    if (!adminFree) {
      const { data: rem, error: rpcErr } = await admin.rpc('spend_credits', { p_user: gate.userId, p_cost: cost })
      if (rpcErr) return NextResponse.json({ error: 'Billing error, try again' }, { status: 500 })
      if (typeof rem === 'number' && rem < 0) {
        return NextResponse.json({ error: 'Not enough credits', code: 'credits', cost }, { status: 402 })
      }
    }

    try {
      // Cache miss → render via Topaz and store next to the original
      let key4k = asset.r2_key_4k as string | null
      if (!key4k) {
        const sourceUrl = presignR2Get(String(asset.r2_key), undefined, 600)
        const buf = await falUpscale(sourceUrl)
        key4k = String(asset.r2_key).replace(/^orig\//, '4k/').replace(/\.[a-z0-9]+$/i, '.png')
        await r2Put(key4k, buf, 'image/png')
        await admin.from('assets').update({ r2_key_4k: key4k }).eq('id', assetId)
      }
      // mark 4K ownership (upsert covers «upscale before first download»)
      await admin.from('purchases').upsert(
        { user_id: gate.userId, asset_id: assetId, cost, has_4k: true },
        { onConflict: 'user_id,asset_id', ignoreDuplicates: false },
      ).then(() => {}, () => {})
      await admin.from('downloads').insert({ user_id: gate.userId, asset_id: assetId, cost: adminFree ? 0 : cost }).then(() => {}, () => {})
      return NextResponse.json({ url: presignR2Get(key4k!, pretty), cost: adminFree ? 0 : cost })
    } catch (err) {
      // render failed → full refund, nobody pays for nothing
      if (!adminFree) await admin.rpc('spend_credits', { p_user: gate.userId, p_cost: -cost }).then(() => {}, () => {})
      console.error('Upscale error:', err)
      return NextResponse.json({ error: 'Upscale failed, credits refunded' }, { status: 500 })
    }
  } catch (err) {
    console.error('Upscale route error:', err)
    return NextResponse.json({ error: 'Upscale failed' }, { status: 500 })
  }
}
