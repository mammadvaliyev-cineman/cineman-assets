import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// TOP-UP PACKS (DEV_topup_credits §2) — public read.
// Packs are owner-editable in Admin → Pricing and stored as a
// Config row (same pattern as homepage-config, no migration).
// ls_url = LemonSqueezy buy link for the pack; empty until the
// owner pastes links from the LS dashboard.
// ─────────────────────────────────────────────────────────────

type TopupPack = { credits: number; usd: number; popular?: boolean; ls_url?: string }

const DEFAULT_PACKS: TopupPack[] = [
  { credits: 50,  usd: 5,  ls_url: '' },
  { credits: 150, usd: 14, ls_url: '' },
  { credits: 300, usd: 27, popular: true, ls_url: '' },
  { credits: 600, usd: 50, ls_url: '' },
]

export async function GET() {
  try {
    const { data } = await supabase
      .from('assets').select('description')
      .eq('type', 'Config').eq('title', 'topup-packs').limit(1)
    const saved = data?.[0]?.description ? JSON.parse(data[0].description) : null
    const packs: TopupPack[] = Array.isArray(saved?.packs) && saved.packs.length > 0
      ? saved.packs.filter((p: TopupPack) => Number(p.credits) > 0 && Number(p.usd) > 0)
      : DEFAULT_PACKS
    return NextResponse.json({ packs })
  } catch {
    return NextResponse.json({ packs: DEFAULT_PACKS })
  }
}
