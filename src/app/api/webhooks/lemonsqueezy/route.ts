import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// LEMONSQUEEZY WEBHOOK → credits.
// subscription_created / subscription_updated:
//   email → find auth user → set profiles.plan + grant monthly
//   credits for that plan. subscription_cancelled/expired → plan
//   'free' (credits keep until monthly reset).
// Plan mapping: env LEMON_VARIANT_PERSONAL / LEMON_VARIANT_PRO
// (variant IDs from the LS dashboard) with a name-based fallback.
// ─────────────────────────────────────────────────────────────

const PLAN_CREDITS: Record<string, number> = { free: 15, personal: 150, pro: 500 }

function planFromEvent(attrs: Record<string, unknown>): string {
  const variantId = String(attrs.variant_id ?? '')
  if (variantId && variantId === process.env.LEMON_VARIANT_PRO) return 'pro'
  if (variantId && variantId === process.env.LEMON_VARIANT_PERSONAL) return 'personal'
  const name = `${attrs.variant_name ?? ''} ${attrs.product_name ?? ''}`.toLowerCase()
  if (name.includes('pro')) return 'pro'
  if (name.includes('personal')) return 'personal'
  return 'personal' // paid but unknown → safest paid default
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('X-Signature') || req.headers.get('X-Signature-256') || ''
  const secret = process.env.LEMON_SQUEEZY_WEBHOOK_SECRET || ''
  if (!secret) return NextResponse.json({ error: 'webhook secret not configured' }, { status: 500 })

  const hmac = crypto.createHmac('sha256', secret)
  const digest = Buffer.from(hmac.update(body).digest('hex'), 'utf8')
  const receivedSig = Buffer.from(signature.startsWith('sha256=') ? signature.slice(7) : signature, 'utf8')
  if (digest.length !== receivedSig.length || !crypto.timingSafeEqual(digest, receivedSig)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)
  const eventName: string = event.meta?.event_name || ''
  const attrs: Record<string, unknown> = event.data?.attributes || {}
  const email = String(attrs.user_email ?? attrs.customer_email ?? '').toLowerCase()

  try {
    const admin = supabaseAdmin()

    if (['subscription_created', 'subscription_updated', 'subscription_resumed', 'subscription_unpaused'].includes(eventName)) {
      const status = String(attrs.status ?? 'active')
      const plan = ['active', 'on_trial', 'past_due'].includes(status) ? planFromEvent(attrs) : 'free'
      if (email) {
        const { data: prof } = await admin.from('profiles').select('id, plan').eq('email', email).limit(1)
        if (prof && prof.length > 0) {
          const grant = PLAN_CREDITS[plan] ?? 15
          await admin.from('profiles').update({
            plan,
            credits: grant,
            credits_period: new Date().toISOString().slice(0, 7),
          }).eq('id', prof[0].id)
        }
      }
    }

    if (['subscription_cancelled', 'subscription_expired'].includes(eventName) && email) {
      await admin.from('profiles').update({ plan: 'free' }).eq('email', email)
    }
  } catch (err) {
    console.error('LS webhook error:', err)
    // 200 anyway — LS retries otherwise; state is recoverable via next event
  }

  return NextResponse.json({ received: true })
}
