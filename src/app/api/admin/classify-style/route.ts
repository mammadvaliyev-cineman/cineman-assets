import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// STYLE BACKFILL (all-in-one §2.2, the missing piece) — tag the
// already-uploaded cartoon assets with style:cartoon so the
// catalog Style filter has data. Realistic = NO tag (catalog
// convention), so we only WRITE cartoon tags but mark checked
// assets with style:realistic? No — to stay idempotent without
// bloating tags, checked realistic assets get 'style:realistic'
// suppressed and we track progress via a checked: marker tag?
// Simpler & clean: every checked asset gets exactly one tag —
// style:cartoon or style:realistic — matching the owner's spec
// («остальным style:realistic»). Filter treats both correctly.
// Gemini LOOKS at thumbnails (batch of 10 images per request).
// GET = progress. POST = one ~45s batch, repeat until left=0.
// ─────────────────────────────────────────────────────────────

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'

type Row = { id: string; title: string | null; tags: string[] | null; file_url: string | null; type: string }

async function fetchUnstyled(limit: number): Promise<{ rows: Row[]; left: number }> {
  const admin = supabaseAdmin()
  const rows: Row[] = []
  let left = 0
  const PAGE = 1000
  for (let from = 0; from < 20000; from += PAGE) {
    const { data, error } = await admin
      .from('assets')
      .select('id,title,tags,file_url,type')
      .not('type', 'in', '("Config","Generation","Usage")')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) throw error
    for (const r of (data || []) as Row[]) {
      if ((r.tags || []).some(t => String(t).toLowerCase().startsWith('style:'))) continue
      if (!r.file_url || !r.file_url.includes('/storage/v1/object/public/')) continue
      left++
      if (rows.length < limit) rows.push(r)
    }
    if (!data || data.length < PAGE) break
  }
  return { rows, left }
}

function thumb(url: string): string {
  return url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/') + '?width=128&quality=50&resize=contain'
}

async function classifyBatch(rows: Row[], key: string): Promise<string[]> {
  const parts: Array<Record<string, unknown>> = [{
    text: `You will see ${rows.length} images. For EACH image decide if its visual style is "cartoon" (стилизованная 2D/3D мультипликация, аниме, иллюстрация, cel-shading) or "realistic" (фотореалистичное изображение). Answer ONLY a JSON array of ${rows.length} strings, each "cartoon" or "realistic", in the same order. No other text.`,
  }]
  for (const r of rows) {
    const res = await fetch(thumb(r.file_url as string))
    if (!res.ok) throw new Error(`thumb fetch ${res.status}`)
    const b64 = Buffer.from(await res.arrayBuffer()).toString('base64')
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: b64 } })
  }
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: { temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) throw new Error('no JSON in Gemini reply')
  const arr = JSON.parse(m[0]) as string[]
  if (!Array.isArray(arr) || arr.length !== rows.length) throw new Error(`length mismatch ${arr.length}/${rows.length}`)
  return arr.map(v => (String(v).toLowerCase().includes('cartoon') ? 'cartoon' : 'realistic'))
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const { left } = await fetchUnstyled(0)
  // counts of already-tagged
  const admin = supabaseAdmin()
  const { count: cartoons } = await admin.from('assets').select('id', { count: 'exact', head: true }).contains('tags', ['style:cartoon'])
  return NextResponse.json({ left, cartoons })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'GEMINI_API_KEY missing' }, { status: 500 })
  const admin = supabaseAdmin()
  const started = Date.now()
  let updated = 0, cartoonsFound = 0
  const BATCH = 10
  const { rows, left } = await fetchUnstyled(120)
  for (let i = 0; i < rows.length; i += BATCH) {
    if (Date.now() - started > 42000) break
    const batch = rows.slice(i, i + BATCH)
    try {
      const verdicts = await classifyBatch(batch, key)
      for (let k = 0; k < batch.length; k++) {
        const style = verdicts[k]
        if (style === 'cartoon') cartoonsFound++
        const tags = [...(batch[k].tags || []).map(String), `style:${style}`]
        const { error } = await admin.from('assets').update({ tags }).eq('id', batch[k].id)
        if (!error) updated++
      }
    } catch (err) {
      console.error('classify-style batch failed:', err)
      // skip this batch, keep going — repeated POSTs will retry it
    }
  }
  return NextResponse.json({ updated, cartoonsFound, leftBefore: left })
}
