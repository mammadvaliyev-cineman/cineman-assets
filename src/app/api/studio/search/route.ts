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

async function extractKeywords(text: string): Promise<string[]> {
  const apiKey = process.env.GEMINI_API_KEY
  // Fallback without LLM: use latin words as-is
  const naive = text.toLowerCase().match(/[a-z]{3,}/g) || []
  if (!apiKey) return naive

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
    const parts: Array<{ text?: string }> = json?.candidates?.[0]?.content?.parts || []
    const raw: string = parts.map(p => p.text || '').join('')
    const match = raw.match(/\[[\s\S]*\]/)
    const arr = JSON.parse((match ? match[0] : raw.replace(/```json|```/g, '')).trim())
    if (Array.isArray(arr) && arr.length) return arr.map(String)
  } catch {
    /* fall through to naive */
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

function scoreAsset(a: AssetRow, keywords: string[]): number {
  let score = 0
  const tags = (a.tags || []).map(t => String(t).toLowerCase())
  const title = (a.title || '').toLowerCase()
  const desc = (a.description || '').toLowerCase()
  for (const kw of keywords) {
    const k = kw.toLowerCase()
    if (tags.some(t => t === k)) score += 5
    else if (tags.some(t => t.includes(k) || k.includes(t))) score += 3
    if (title.includes(k)) score += 2
    if (desc.includes(k)) score += 1
  }
  return score
}

export async function POST(req: NextRequest) {
  try {
    const { text, assetType, offset = 0 } = await req.json()
    if (!text || !assetType) {
      return NextResponse.json({ error: 'text and assetType are required' }, { status: 400 })
    }

    const keywords = await extractKeywords(String(text))

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
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Search failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

