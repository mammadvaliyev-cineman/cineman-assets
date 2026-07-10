import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'
import { normalizeAttr } from '@/lib/attrs'

export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// RE-TAG — repairs assets that were bulk-loaded while Gemini was
// rate-capped and got empty/weak tags. Re-runs Gemini vision on
// each such asset's stored image and rewrites title, description,
// tags and structured attributes (g:/age:/eth: | place:/time:).
// Admin-gated. GET ?dry=1 → count remaining. POST → process a
// small batch (call repeatedly until remaining = 0).
// ─────────────────────────────────────────────────────────────

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'
const PROMPT = `You are a cinematographer analysing an image for a cinematic asset library. Return ONLY valid JSON (no markdown):
{
 "title":"Precise cinematic title, 4-6 words, Title Case, based on what you see",
 "description":"2-3 sentence cinematic description of exactly what is in frame",
 "tags":["exactly 12 lowercase descriptive tags: hair, wardrobe, build, vibe, style, lighting, mood, color, genre, environment, texture — NO gender/age/ethnicity"],
 "gender":"for a PERSON: man | woman. Else empty string.",
 "age":"for a PERSON: child | teen | young | adult | senior. Else empty string.",
 "ethnicity":"for a PERSON: white | black | asian | south-asian | latino | mena | mixed. Else empty string.",
 "place":"for a LOCATION: interior | exterior. Else empty string.",
 "time":"for a LOCATION: dawn | day | golden | night. Else empty string."
}`

type Row = { id: string; type: string; title: string; file_url: string; tags: string[] | null }

// An asset "needs retag" if it has fewer than 5 tags (a good one has ~13-15)
function needsRetag(r: Row): boolean {
  return (r.tags || []).length < 5
}

async function candidates(): Promise<Row[]> {
  const admin = supabaseAdmin()
  const { data, error } = await admin
    .from('assets')
    .select('id,type,title,file_url,tags')
    .in('type', ['Character', 'Location', 'Vehicle', 'Prop'])
    .limit(5000)
  if (error) throw error
  return (data as Row[]).filter(needsRetag)
}

async function gemini(fileUrl: string, key: string) {
  const img = await fetch(fileUrl)
  if (!img.ok) throw new Error('img ' + img.status)
  const buf = Buffer.from(await img.arrayBuffer())
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: buf.toString('base64') } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 700, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  if (!res.ok) throw new Error('gemini ' + res.status)
  const json = await res.json()
  const raw = (json?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('')
  const m = raw.match(/\{[\s\S]*\}/)
  return JSON.parse(m ? m[0] : raw.replace(/```json|```/g, '').trim())
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const list = await candidates()
    return NextResponse.json({ remaining: list.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'no gemini key' }, { status: 500 })
  try {
    const limit = Math.min(Number(req.nextUrl.searchParams.get('limit')) || 6, 12)
    const admin = supabaseAdmin()
    const list = (await candidates()).slice(0, limit)
    let ok = 0
    const errors: string[] = []
    for (const r of list) {
      try {
        const ai = await gemini(r.file_url, key)
        const attrs: string[] = []
        if (r.type === 'Character') {
          for (const [k, v] of [['g', ai.gender], ['age', ai.age], ['eth', ai.ethnicity]] as const) {
            const c = normalizeAttr(k as 'g' | 'age' | 'eth', String(v ?? '')); if (c) attrs.push(`${k}:${c}`)
          }
        } else if (r.type === 'Location') {
          for (const [k, v] of [['place', ai.place], ['time', ai.time]] as const) {
            const c = normalizeAttr(k as 'place' | 'time', String(v ?? '')); if (c) attrs.push(`${k}:${c}`)
          }
        }
        const free = Array.isArray(ai.tags) ? ai.tags.slice(0, 12).map(String) : []
        const tags = [...attrs, ...free]
        const patch: Record<string, unknown> = { tags, description: ai.description || '' }
        if (ai.title) patch.title = String(ai.title)
        await admin.from('assets').update(patch).eq('id', r.id)
        ok++
      } catch (e) {
        errors.push(r.id.slice(0, 6) + ':' + (e instanceof Error ? e.message : 'err'))
      }
    }
    const remaining = (await candidates()).length
    return NextResponse.json({ processed: ok, remaining, errors: errors.slice(0, 5) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
