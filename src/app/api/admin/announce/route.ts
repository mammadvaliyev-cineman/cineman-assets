import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// ADMIN: publish an announcement (title + text + optional link) —
// it lands in every user's notification bell (announcements table,
// public read via RLS; writes only through the service role here).

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { title, body, href } = await req.json()
    const t = String(title ?? '').trim().slice(0, 120)
    if (!t) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    const { error } = await supabaseAdmin().from('announcements').insert({
      title: t,
      body: String(body ?? '').trim().slice(0, 600) || null,
      href: String(href ?? '').trim().slice(0, 300) || null,
    })
    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : JSON.stringify(err) }, { status: 500 })
  }
}
