import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// ADMIN: provider balances at a glance (owner's spec) — how much
// is left on Kie.ai and where to check Gemini spend, so a long
// pass never dies mid-run from an empty account.
// • Kie.ai exposes a credits API → real number.
// • Gemini / Google AI is pay-as-you-go with a spend cap, not a
//   prepaid balance → deep link to the billing console instead.
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })

  const out: {
    kie: { ok: boolean; credits?: number; error?: string }
    gemini: { billingUrl: string; note: string }
  } = {
    kie: { ok: false },
    gemini: {
      billingUrl: 'https://console.cloud.google.com/billing',
      note: 'Pay-as-you-go — no prepaid balance. Month spend and the budget cap live in Google Cloud Billing.',
    },
  }

  const key = process.env.KIE_API_KEY
  if (!key) {
    out.kie = { ok: false, error: 'KIE_API_KEY is not set' }
    return NextResponse.json(out)
  }
  try {
    const r = await fetch('https://api.kie.ai/api/v1/chat/credit', {
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    const j = await r.json().catch(() => null)
    if (r.ok && j?.code === 200) out.kie = { ok: true, credits: Number(j.data) }
    else out.kie = { ok: false, error: j?.msg || `HTTP ${r.status}` }
  } catch {
    out.kie = { ok: false, error: 'Kie.ai is unreachable' }
  }
  return NextResponse.json(out)
}
