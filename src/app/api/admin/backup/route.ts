import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// FULL DATABASE BACKUP — admin-only. Returns every row of the
// assets table (including Config rows) as a downloadable JSON
// file. Images live in Dropbox/Storage; the rows with titles,
// tags and categories are the irreplaceable part — this saves
// them in one click from Admin → Settings.
// ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const admin = supabaseAdmin()
    const rows: Record<string, unknown>[] = []
    const PAGE = 1000
    for (let from = 0; from < 50000; from += PAGE) {
      const { data, error } = await admin
        .from('assets')
        .select('*')
        .order('created_at', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) throw error
      rows.push(...((data || []) as Record<string, unknown>[]))
      if (!data || data.length < PAGE) break
    }
    const stamp = new Date().toISOString().slice(0, 10)
    const body = JSON.stringify({ exportedAt: new Date().toISOString(), table: 'assets', count: rows.length, rows }, null, 1)
    return new NextResponse(body, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="cineman-backup-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'backup failed' }, { status: 500 })
  }
}
