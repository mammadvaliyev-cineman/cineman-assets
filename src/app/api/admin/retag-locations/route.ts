import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// LOCATION AUTO-TAGGING (master handoff §2).
// Locations uploaded before the structural pass have free-text
// titles and no prefix tags → invisible to the Setting/Time/Era
// filters. buildTags() derives them from title keywords.
// Canon note: the catalog's structural prefix for setting is
// place:interior/exterior (NOT type:) — one concept, one prefix.
// GET  = dry-run (counts + samples), POST = apply.
// Idempotent, only ADDS missing tags, never overwrites. Batched
// under the Vercel 60s cap — POST repeatedly until updated=0.
// ─────────────────────────────────────────────────────────────

const STOP = new Set(['the', 'a', 'of', 'and', 'with', 'in', 'on', 'at', 'an'])
const INTERIOR = ['interior', 'cabin', 'room', 'hall', 'lobby', 'corridor', 'cockpit', 'studio', 'office', 'classroom', 'gym', 'store', 'salon', 'den', 'loft', 'workshop', 'seats', 'escalator', 'indoor']
const EXTERIOR = ['street', 'city', 'plaza', 'park', 'yard', 'skyline', 'promenade', 'square', 'boardwalk', 'alley', 'courtyard', 'wasteland', 'ruins', 'tunnel', 'overpass', 'avenue', 'platform', 'rooftop', 'garden', 'pool', 'exterior', 'outdoor', 'aerial']
const TIMES: [string, string[]][] = [
  ['time:night', ['night', 'midnight', 'neon']],
  ['time:golden', ['sunset', 'dusk', 'golden']],
  ['time:dawn', ['dawn', 'sunrise']],
  ['time:day', ['day', 'daylight', 'midday', 'noon']],
]
const ERAS: [string, string[]][] = [
  ['era:post-apoc', ['ruined', 'ruins', 'warzone', 'wasteland', 'storm', 'abandoned']],
  ['era:scifi', ['scifi', 'sci-fi', 'spaceship', 'mars', 'cyberpunk', 'monorail', 'retro-future', 'futuristic']],
  ['era:medieval', ['medieval', 'castle', 'village']],
  ['era:vintage', ['vintage', 'retro', 'classic']],
  ['era:modern', ['modern', 'tech', 'glass', 'brutalist']],
]

function buildTags(title: string, category: string, existing: string[]): string[] {
  const have = new Set(existing.map(t => String(t).toLowerCase()))
  const text = `${title} ${category}`.toLowerCase().replace(/\s*\d+$/, '')
  const words = text.split(/[^a-zа-яё-]+/i).filter(w => w.length > 2 && !STOP.has(w))
  const add: string[] = []
  const hasPrefix = (p: string) => existing.some(t => String(t).toLowerCase().startsWith(p))
  // structural: setting (canon place:), time, era — only if that dimension is empty
  if (!have.has('place:interior') && !have.has('place:exterior')) {
    if (words.some(w => INTERIOR.includes(w))) add.push('place:interior')
    else if (words.some(w => EXTERIOR.includes(w))) add.push('place:exterior')
  }
  if (!hasPrefix('time:')) {
    for (const [tag, keys] of TIMES) if (words.some(w => keys.includes(w))) { add.push(tag); break }
  }
  if (!hasPrefix('era:')) {
    for (const [tag, keys] of ERAS) if (words.some(w => keys.includes(w))) { add.push(tag); break }
  }
  // keyword tags from significant title words (searchability), capped
  const total = existing.length + add.length
  if (total < 16) {
    for (const w of words) {
      if (have.has(w) || add.includes(w)) continue
      add.push(w)
      if (existing.length + add.length >= 16) break
    }
  }
  return add
}

async function scan(apply: boolean) {
  const admin = supabaseAdmin()
  const PAGE = 1000
  let scanned = 0, needs = 0, updated = 0
  const samples: Record<string, unknown>[] = []
  const started = Date.now()
  for (let from = 0; from < 50000; from += PAGE) {
    const { data, error } = await admin.from('assets')
      .select('id, title, category, tags')
      .eq('type', 'Location')
      .range(from, from + PAGE - 1)
    if (error || !data) break
    for (const row of data) {
      scanned++
      const existing: string[] = Array.isArray(row.tags) ? row.tags.map(String) : []
      const add = buildTags(String(row.title ?? ''), String(row.category ?? ''), existing)
      if (add.length === 0) continue
      needs++
      if (samples.length < 8) samples.push({ title: row.title, add })
      if (apply) {
        if (Date.now() - started > 45000) return { scanned, needs, updated, samples, partial: true }
        const { error: upErr } = await admin.from('assets').update({ tags: [...existing, ...add] }).eq('id', row.id)
        if (!upErr) updated++
      }
    }
    if (data.length < PAGE) break
  }
  return { scanned, needs, updated, samples, partial: false }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  return NextResponse.json({ dryRun: true, ...(await scan(false)) })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  return NextResponse.json({ applied: true, ...(await scan(true)) })
}
