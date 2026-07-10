import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// ONE-OFF (idempotent) DATA CLEANUP — admin-gated, service-role.
// GET = dry-run preview, POST = apply. Fixes:
//   1. Santa assets wrongly typed as Location → Character / People - Men
//   2. Em/en dashes in category names → plain hyphen (collapses dupes)
//   3. Celebrities — REPORT ONLY (never touched by apply)
//   4. Irshad assets — full delete (DB rows + Storage files)
// Safe to run repeatedly: each pass only changes what still differs.
// ─────────────────────────────────────────────────────────────

type Row = {
  id: string
  title: string | null
  type: string | null
  category: string | null
  file_url: string | null
  thumbnail_url: string | null
}

const hasBadDash = (s: string) => /[—–]/.test(s)
const fixDash = (s: string) => s.replace(/\s*[—–]\s*/g, ' - ').replace(/\s{2,}/g, ' ').trim()

async function plan() {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('assets')
    .select('id,title,type,category,file_url,thumbnail_url')
    .limit(5000)
  if (error) throw error
  const rows = (data || []) as Row[]

  const santa: Array<{ id: string; title: string; type: string; category: string }> = []
  const dashes: Array<{ id: string; from: string; to: string }> = []
  const celebs: Array<{ id: string; title: string; category: string }> = []
  const irshad: Row[] = []

  for (const r of rows) {
    const title = (r.title || '').toLowerCase()
    const cat = r.category || ''
    if (title.includes('irshad') || cat.toLowerCase().includes('irshad')) {
      irshad.push(r)
      continue
    }
    if (title.includes('santa')) {
      if (r.type !== 'Character' || cat !== 'People - Men') {
        santa.push({ id: r.id, title: r.title || '', type: r.type || '', category: cat })
      }
      continue
    }
    if (hasBadDash(cat)) {
      dashes.push({ id: r.id, from: cat, to: fixDash(cat) })
    }
    if (cat.toLowerCase().includes('celebrit')) {
      celebs.push({ id: r.id, title: r.title || '', category: cat })
    }
  }
  return { total: rows.length, santa, dashes, celebs, irshad }
}

async function removeStorageFiles(row: Row) {
  const admin = supabaseAdmin()
  for (const url of [row.file_url, row.thumbnail_url]) {
    if (typeof url === 'string' && url.includes('/assets/')) {
      const path = url.split('/assets/')[1]
      if (path && !path.startsWith('config')) {
        await admin.storage.from('assets').remove([path]).catch(() => {})
      }
    }
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const p = await plan()
    return NextResponse.json({
      dryRun: true,
      total: p.total,
      counts: { santa: p.santa.length, dashes: p.dashes.length, celebrities: p.celebs.length, irshad: p.irshad.length },
      santa: p.santa.slice(0, 50),
      dashes: p.dashes.slice(0, 50),
      celebrities: p.celebs.slice(0, 100),
      irshad: p.irshad.map(r => ({ id: r.id, title: r.title, category: r.category })).slice(0, 100),
      note: 'POST to apply. Celebrities are report-only and will NOT be modified.',
    })
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

    let santaFixed = 0
    for (const s of p.santa) {
      const { error } = await admin
        .from('assets')
        .update({ type: 'Character', category: 'People - Men' })
        .eq('id', s.id)
      if (!error) santaFixed++
    }

    let dashFixed = 0
    for (const d of p.dashes) {
      const { error } = await admin.from('assets').update({ category: d.to }).eq('id', d.id)
      if (!error) dashFixed++
    }

    let irshadDeleted = 0
    for (const r of p.irshad) {
      await removeStorageFiles(r)
      const { error } = await admin.from('assets').delete().eq('id', r.id)
      if (!error) irshadDeleted++
    }

    return NextResponse.json({
      applied: true,
      total: p.total,
      santaFixed,
      dashFixed,
      irshadDeleted,
      celebritiesFound: p.celebs.length,
      note: 'Celebrities untouched — report only. Re-run GET to verify zero remaining.',
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
