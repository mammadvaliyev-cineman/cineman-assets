import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'
import { deriveAttrs } from '@/lib/attrs'

export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// ONE-OFF (idempotent) MIGRATION — back-fill prefixed attribute
// tokens (g:/age:/eth: | place:/time:) onto existing Character and
// Location assets by reading their existing plain-word tags +
// description. Safe to run repeatedly: only adds missing tokens.
// Admin-gated. GET = dry-run preview, POST = apply.
// ─────────────────────────────────────────────────────────────

type Row = { id: string; type: string; tags: string[] | null; description: string | null; title: string | null }

async function plan() {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('assets')
    .select('id,type,tags,description,title')
    .in('type', ['Character', 'Location'])
    .limit(5000)
  if (error) throw error
  const rows = (data || []) as Row[]
  const changes: Array<{ id: string; title: string; add: string[]; tags: string[] }> = []
  for (const r of rows) {
    const tags = (r.tags || []).map(String)
    const derived = deriveAttrs(r.type, tags, `${r.title || ''} ${r.description || ''}`)
    const add = derived.filter(d => !tags.some(t => t.toLowerCase() === d))
    if (add.length) changes.push({ id: r.id, title: r.title || '', add, tags: [...add, ...tags] })
  }
  return { total: rows.length, toUpdate: changes.length, changes }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const p = await plan()
    return NextResponse.json({ dryRun: true, ...p, changes: p.changes.slice(0, 60) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const admin = supabaseAdmin()
    const p = await plan()
    let updated = 0
    for (const c of p.changes) {
      const { error } = await admin.from('assets').update({ tags: c.tags }).eq('id', c.id)
      if (!error) updated++
    }
    return NextResponse.json({ applied: true, total: p.total, updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
