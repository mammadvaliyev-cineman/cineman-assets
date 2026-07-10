import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// CHARACTER SUB-CLASSIFICATION — admin-gated, idempotent.
//   • Animals → class:pets|predators|wild-mammals|birds|fish-sea|insects|reptiles
//     (Gemini text batches over titles — no images needed, pennies)
//   • Robots  → rtype:humanoid|android|mech|endoskeleton (keywords, no AI)
// GET = dry-run counts. POST ?what=animals (batch, call until done=0)
// or ?what=robots (single pass).
// ─────────────────────────────────────────────────────────────

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'
const ANIMAL_CLASSES = ['pets', 'predators', 'wild-mammals', 'birds', 'fish-sea', 'insects', 'reptiles'] as const

type Row = { id: string; title: string | null; tags: string[] | null }

async function fetchCategory(category: string): Promise<Row[]> {
  const admin = supabaseAdmin()
  const rows: Row[] = []
  const PAGE = 1000
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await admin
      .from('assets')
      .select('id,title,tags')
      .eq('category', category)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    rows.push(...((data || []) as Row[]))
    if (!data || data.length < PAGE) break
  }
  return rows
}

const hasPrefix = (r: Row, p: string) => (r.tags || []).some(t => String(t).startsWith(p))

// ── Animals: Gemini text classification ──────────────────────
async function classifyAnimals(items: Array<{ id: string; title: string }>, key: string) {
  const prompt = `Classify each animal into EXACTLY ONE class:
- "pets" — domestic cats and dogs (any breed)
- "predators" — wild predatory mammals (hyena, wolf, lion, bear, badger...)
- "wild-mammals" — other wild mammals (antelope, buffalo, beaver, possum...)
- "birds" — all birds including birds of prey
- "fish-sea" — fish and sea creatures (tuna, cuttlefish, barracuda...)
- "insects" — insects, spiders, bugs
- "reptiles" — reptiles and amphibians (frogs, lizards, snakes...)
Return ONLY a valid JSON array, no markdown: [{"id":"...","class":"..."}]
Animals:
${JSON.stringify(items)}`
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 4000, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  if (!res.ok) throw new Error('gemini ' + res.status)
  const json = await res.json()
  const raw = (json?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('')
  const m = raw.match(/\[[\s\S]*\]/)
  const arr = JSON.parse(m ? m[0] : raw.replace(/```json|```/g, '').trim()) as Array<{ id: string; class: string }>
  const map: Record<string, string> = {}
  for (const it of arr) {
    if (ANIMAL_CLASSES.includes(it.class as typeof ANIMAL_CLASSES[number])) map[it.id] = it.class
  }
  return map
}

// ── Robots: keyword classification ───────────────────────────
function robotType(r: Row): string {
  const blob = `${r.title || ''} ${(r.tags || []).join(' ')}`.toLowerCase()
  if (blob.includes('endoskeleton')) return 'endoskeleton'
  if (blob.includes('mech') && !blob.includes('mechanic')) return 'mech'
  if (blob.includes('android')) return 'android'
  return 'humanoid'
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const animals = await fetchCategory('Animals')
    const robots = await fetchCategory('Robots')
    return NextResponse.json({
      dryRun: true,
      animals: { total: animals.length, unclassified: animals.filter(r => !hasPrefix(r, 'class:')).length },
      robots: { total: robots.length, unclassified: robots.filter(r => !hasPrefix(r, 'rtype:')).length },
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const what = req.nextUrl.searchParams.get('what') || 'animals'
  try {
    const admin = supabaseAdmin()

    if (what === 'robots') {
      const robots = (await fetchCategory('Robots')).filter(r => !hasPrefix(r, 'rtype:'))
      let updated = 0
      const counts: Record<string, number> = {}
      for (const r of robots) {
        const t = robotType(r)
        counts[t] = (counts[t] || 0) + 1
        const tags = [`rtype:${t}`, ...(r.tags || []).filter(x => !String(x).startsWith('rtype:'))]
        const { error } = await admin.from('assets').update({ tags }).eq('id', r.id)
        if (!error) updated++
      }
      return NextResponse.json({ applied: true, what, updated, counts })
    }

    // animals — one Gemini batch per call, call repeatedly until done=0
    const key = process.env.GEMINI_API_KEY
    if (!key) return NextResponse.json({ error: 'no gemini key' }, { status: 500 })
    const pending = (await fetchCategory('Animals')).filter(r => !hasPrefix(r, 'class:'))
    const batch = pending.slice(0, 60)
    if (batch.length === 0) return NextResponse.json({ applied: true, what, updated: 0, remaining: 0 })

    const map = await classifyAnimals(batch.map(r => ({ id: r.id, title: r.title || '' })), key)
    let updated = 0
    const counts: Record<string, number> = {}
    for (const r of batch) {
      const cls = map[r.id]
      if (!cls) continue
      counts[cls] = (counts[cls] || 0) + 1
      const tags = [`class:${cls}`, ...(r.tags || []).filter(x => !String(x).startsWith('class:'))]
      const { error } = await admin.from('assets').update({ tags }).eq('id', r.id)
      if (!error) updated++
    }
    return NextResponse.json({ applied: true, what, updated, counts, remaining: pending.length - batch.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
