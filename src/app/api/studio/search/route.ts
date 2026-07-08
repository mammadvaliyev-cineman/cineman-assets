import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 30

// ─────────────────────────────────────────────────────────────
// STUDIO SEARCH — retrieval-first, generation never.
// 1. Gemini Flash translates the user's free text (any language)
//    into english search keywords (~$0.0001 per call).
// 2. Supabase rows of the requested type are scored in JS against
//    tags / title / description. Zero generation cost.
// ─────────────────────────────────────────────────────────────

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

async function extractKeywords(text: string, debug?: Record<string, unknown>): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  // Fallback without LLM: use latin words as-is
  const naive = text.toLowerCase().match(/[a-z]{3,}/g) || []
  if (!apiKey) { if (debug) debug.noKey = true; return naive }

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `User describes a character or location for a film in any language. Return ONLY a JSON array of 6-10 lowercase ENGLISH search keywords (single words or short 2-word phrases) capturing: subject, age/type, style, mood, setting, lighting. No markdown.\n\nUser text: "${text}"`,
          }],
        }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
    const json = await res.json()
    if (debug) {
      debug.status = res.status
      debug.finishReason = json?.candidates?.[0]?.finishReason
      debug.error = json?.error?.message
      debug.rawSnippet = JSON.stringify(json?.candidates?.[0]?.content ?? json).slice(0, 400)
    }
    const parts: Array<{ text?: string }> = json?.candidates?.[0]?.content?.parts || []
    const raw: string = parts.map(p => p.text || '').join('')
    let arr: unknown = null
    const match = raw.match(/\[[\s\S]*\]/)
    try {
      arr = JSON.parse((match ? match[0] : raw.replace(/```json|```/g, '')).trim())
    } catch {
      // Model returned plain text — split on commas / newlines
      arr = raw
        .replace(/```json|```/g, '')
        .split(/[,\n;]/)
        .map(s => s.trim().replace(/^[\s"'\-\d.)*]+|[\s"'.]+$/g, '').toLowerCase())
        .filter(s => s.length > 1)
    }
    if (Array.isArray(arr) && arr.length) return arr.map(String)
  } catch (e) {
    if (debug) debug.caught = e instanceof Error ? e.message : String(e)
  }
  return naive
}

type AssetRow = {
  id: string
  title: string
  type: string
  category: string
  tags: string[] | null
  description: string | null
  file_url: string
  thumbnail_url: string | null
}

// Word-level matching. Never substring: "woman" must NOT match "man".
function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
}

function scoreAsset(a: AssetRow, keywords: string[]): number {
  let score = 0
  const tags = (a.tags || []).map(t => String(t).toLowerCase())
  const tagWords = new Set(tags.flatMap(words))
  const titleWords = new Set(words(a.title || ''))
  const descWords = new Set(words(a.description || ''))
  for (const kw of keywords) {
    const k = kw.toLowerCase().trim()
    const kws = words(k)
    if (!kws.length) continue
    if (tags.includes(k)) score += 5
    else if (kws.every(w => tagWords.has(w))) score += 3
    if (kws.every(w => titleWords.has(w))) score += 2
    if (kws.every(w => descWords.has(w))) score += 1
  }
  return score
}

export async function POST(req: NextRequest) {
  try {
    const { text, assetType, offset = 0, debug: wantDebug } = await req.json()
    if (!text || !assetType) {
      return NextResponse.json({ error: 'text and assetType are required' }, { status: 400 })
    }

    const debug: Record<string, unknown> | undefined = wantDebug ? {} : undefined
    const keywords = await extractKeywords(String(text), debug)

    const { data, error } = await supabase
      .from('assets')
      .select('id,title,type,category,tags,description,file_url,thumbnail_url')
      .eq('type', assetType)
      .limit(2000)
    if (error) throw error

    const rows = (data || []) as AssetRow[]
    const scored = rows
      .map(a => ({ asset: a, score: scoreAsset(a, keywords) }))
      .filter(s => s.score > 0)
      .sort((x, y) => y.score - x.score)

    // If nothing matched, return most recent as browsable fallback
    const pool = scored.length ? scored.map(s => s.asset) : rows
    const page = pool.slice(offset, offset + 4)

    return NextResponse.json({
      results: page,
      total: pool.length,
      matched: scored.length,
      keywords,
      ...(debug ? { _debug: debug } : {}),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

