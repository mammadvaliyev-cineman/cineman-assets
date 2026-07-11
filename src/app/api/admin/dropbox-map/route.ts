import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'
import { dropboxListImages } from '@/lib/dropbox'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// MAP ASSETS → DROPBOX FILE IDS. Phase 1: exact match by the
// src:<slug> tag (present on newer ingests) against Dropbox
// filenames. GET = dry-run counts, POST = write dropbox_id.
// Assets without a src: tag are reported — phase 2 (perceptual
// hash) covers them separately.
// ─────────────────────────────────────────────────────────────

async function run(apply: boolean) {
  const admin = supabaseAdmin()
  const dropbox = await dropboxListImages()
  let scanned = 0, withSrc = 0, matched = 0, applied = 0, alreadyMapped = 0
  const unmatchedSlugs: string[] = []
  const PAGE = 1000
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await admin.from('assets')
      .select('id, tags, dropbox_id')
      .not('type', 'in', '("Config","Generation","Usage")')
      .range(from, from + PAGE - 1)
    if (error || !data) break
    for (const row of data) {
      scanned++
      if (row.dropbox_id) { alreadyMapped++; continue }
      const src = (Array.isArray(row.tags) ? row.tags : []).map(String).find(t => t.startsWith('src:'))
      if (!src) continue
      withSrc++
      const slug = src.slice(4)
      const hit = dropbox.get(slug)
      if (!hit) { if (unmatchedSlugs.length < 10) unmatchedSlugs.push(slug); continue }
      matched++
      if (apply) {
        const { error: upErr } = await admin.from('assets').update({ dropbox_id: hit.id }).eq('id', row.id)
        if (!upErr) applied++
      }
    }
    if (data.length < PAGE) break
  }
  return { dropboxFiles: dropbox.size, scanned, alreadyMapped, withSrc, matched, applied: apply ? applied : undefined, unmatchedSlugs }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try { return NextResponse.json({ dryRun: true, ...(await run(false)) }) }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 }) }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try { return NextResponse.json({ ok: true, ...(await run(true)) }) }
  catch (err) { return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 }) }
}
