import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// ONE-OFF RESTRUCTURE — new top-level taxonomy. Idempotent.
//   People   ← People - Men/Women/Kids (categories → Men/Women/Kids)
//   Animal   ← Animals (category → class label from class: tag)
//   Creature ← Monsters / Aliens / Prehistoric→Dinosaurs / Creatures→Beasts
//   Robot    ← Robots (category → type label from rtype: tag)
// GET = dry-run, POST = apply.
// ─────────────────────────────────────────────────────────────

type Row = { id: string; type: string | null; category: string | null; tags: string[] | null }

const CLASS_LABEL: Record<string, string> = {
  'pets': 'Pets', 'predators': 'Predators', 'wild-mammals': 'Wild Mammals',
  'birds': 'Birds', 'fish-sea': 'Fish & Sea', 'insects': 'Insects', 'reptiles': 'Reptiles',
}
const RTYPE_LABEL: Record<string, string> = {
  'humanoid': 'Humanoid', 'android': 'Android', 'mech': 'Mech', 'endoskeleton': 'Endoskeleton',
}

function tagValue(tags: string[] | null, prefix: string): string | null {
  const t = (tags || []).find(x => String(x).startsWith(prefix))
  return t ? String(t).slice(prefix.length) : null
}

function plan(rows: Row[]) {
  const changes: Array<{ id: string; fromType: string; fromCat: string; type: string; category: string }> = []
  for (const r of rows) {
    const cat = r.category || ''
    let type: string | null = null
    let category: string | null = null
    if (cat === 'People - Men') { type = 'People'; category = 'Men' }
    else if (cat === 'People - Women') { type = 'People'; category = 'Women' }
    else if (cat === 'People - Kids') { type = 'People'; category = 'Kids' }
    else if (cat === 'Animals') {
      type = 'Animal'
      category = CLASS_LABEL[tagValue(r.tags, 'class:') || ''] || 'Animals'
    }
    else if (cat === 'Robots') {
      type = 'Robot'
      category = RTYPE_LABEL[tagValue(r.tags, 'rtype:') || ''] || 'Robots'
    }
    else if (cat === 'Monsters') { type = 'Creature'; category = 'Monsters' }
    else if (cat === 'Aliens') { type = 'Creature'; category = 'Aliens' }
    else if (cat === 'Prehistoric') { type = 'Creature'; category = 'Dinosaurs' }
    else if (cat === 'Creatures') { type = 'Creature'; category = 'Beasts' }
    if (type && category && (r.type !== type || r.category !== category)) {
      changes.push({ id: r.id, fromType: r.type || '', fromCat: cat, type, category })
    }
  }
  return changes
}

async function fetchAll(): Promise<Row[]> {
  const admin = supabaseAdmin()
  const rows: Row[] = []
  const PAGE = 1000
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await admin
      .from('assets')
      .select('id,type,category,tags')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data || []) as Row[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const changes = plan(await fetchAll())
    const summary: Record<string, number> = {}
    for (const c of changes) summary[`${c.type}/${c.category}`] = (summary[`${c.type}/${c.category}`] || 0) + 1
    return NextResponse.json({ dryRun: true, toUpdate: changes.length, summary })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const admin = supabaseAdmin()
    const changes = plan(await fetchAll())
    let updated = 0
    for (const c of changes) {
      const { error } = await admin.from('assets').update({ type: c.type, category: c.category }).eq('id', c.id)
      if (!error) updated++
    }
    return NextResponse.json({ applied: true, updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
