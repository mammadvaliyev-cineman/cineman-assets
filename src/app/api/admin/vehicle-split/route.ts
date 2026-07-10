import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// ONE-OFF VEHICLE SPLIT — admin-gated, idempotent.
// Vehicles sit flat in category 'Vehicle' with empty tags, but the
// titles carry everything ("bmw m4 dark green 01"). This pass:
//   • category → 'Cars' | 'Motorcycles' (brand-based)
//   • tags     → ['brand:bmw', 'color:dark-green', ...existing]
// GET = dry-run preview, POST = apply.
// ─────────────────────────────────────────────────────────────

const MOTO_BRANDS = ['aprilia', 'ducati', 'kawasaki', 'suzuki', 'triumph', 'yamaha', 'harley', 'harley-davidson', 'ktm', 'royal enfield']

// Multiword brands first so "aston martin" wins over "aston"
const BRANDS = [
  'aston martin', 'land rover', 'range rover', 'royal enfield', 'harley-davidson', 'alfa romeo',
  'aprilia', 'audi', 'bentley', 'bmw', 'bugatti', 'cadillac', 'changan', 'chevrolet', 'chrysler',
  'dodge', 'ducati', 'ferrari', 'fiat', 'ford', 'gmc', 'honda', 'hyundai', 'jaguar', 'jeep',
  'kawasaki', 'kia', 'ktm', 'lamborghini', 'lexus', 'lincoln', 'maserati', 'mazda', 'mclaren',
  'mercedes', 'mini', 'mitsubishi', 'nissan', 'opel', 'peugeot', 'porsche', 'ram', 'renault',
  'rolls-royce', 'rolls royce', 'saab', 'seat', 'skoda', 'subaru', 'suzuki', 'tesla', 'toyota',
  'triumph', 'volkswagen', 'volvo', 'yamaha',
]

// Multiword colors first
const COLORS = [
  'dark blue', 'dark green', 'dark grey', 'dark red', 'light blue',
  'black', 'white', 'grey', 'gray', 'silver', 'blue', 'green', 'red',
  'yellow', 'orange', 'purple', 'brown', 'gold', 'beige', 'pink',
]

function parseVehicle(title: string) {
  const t = ` ${title.toLowerCase()} `
  const brand = BRANDS.find(b => t.includes(` ${b} `) || t.startsWith(` ${b} `))
  const color = COLORS.find(c => t.includes(` ${c} `))
  const isMoto = !!brand && MOTO_BRANDS.includes(brand)
  return {
    category: isMoto ? 'Motorcycles' : 'Cars',
    brand: brand ? brand.replace(/\s+/g, '-') : null,
    color: color ? color.replace(/\s+/g, '-') : null,
  }
}

type Row = { id: string; title: string | null; category: string | null; tags: string[] | null }

async function plan() {
  const admin = supabaseAdmin()
  const rows: Row[] = []
  const PAGE = 1000
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await admin
      .from('assets')
      .select('id,title,category,tags')
      .eq('type', 'Vehicle')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data || []) as Row[]))
    if (!data || data.length < PAGE) break
  }

  const changes = rows.map(r => {
    const p = parseVehicle(r.title || '')
    const keep = (r.tags || []).filter(t => !t.startsWith('brand:') && !t.startsWith('color:'))
    const tags = [
      ...(p.brand ? [`brand:${p.brand}`] : []),
      ...(p.color ? [`color:${p.color}`] : []),
      ...keep,
    ]
    const changed = r.category !== p.category || JSON.stringify(tags) !== JSON.stringify(r.tags || [])
    return { id: r.id, title: r.title, from: r.category, to: p.category, brand: p.brand, color: p.color, tags, changed }
  })
  return { total: rows.length, changes }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const p = await plan()
    const cars = p.changes.filter(c => c.to === 'Cars').length
    const moto = p.changes.filter(c => c.to === 'Motorcycles').length
    const noBrand = p.changes.filter(c => !c.brand).map(c => c.title)
    return NextResponse.json({
      dryRun: true,
      total: p.total,
      cars,
      motorcycles: moto,
      toUpdate: p.changes.filter(c => c.changed).length,
      noBrand,
      preview: p.changes.slice(0, 100).map(({ title, to, brand, color }) => ({ title, to, brand, color })),
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
    let updated = 0
    for (const c of p.changes) {
      if (!c.changed) continue
      const { error } = await admin.from('assets').update({ category: c.to, tags: c.tags }).eq('id', c.id)
      if (!error) updated++
    }
    return NextResponse.json({ applied: true, total: p.total, updated })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
