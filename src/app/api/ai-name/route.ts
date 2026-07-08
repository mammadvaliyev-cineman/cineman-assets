import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { CATEGORIES, Category } from '@/config/categories'

export const maxDuration = 30

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

// Live taxonomy (admin-editable) with code defaults as fallback
async function loadTaxonomy(): Promise<Category[]> {
  try {
    const { data } = await supabase
      .from('assets')
      .select('description')
      .eq('type', 'Config')
      .eq('title', 'categories-config')
      .limit(1)
    const saved = data?.[0]?.description ? JSON.parse(data[0].description) : null
    return Array.isArray(saved) && saved.length ? saved : CATEGORIES
  } catch {
    return CATEGORIES
  }
}

function buildPrompt(taxonomy: Category[]): string {
  const typeIds = taxonomy.map(c => c.id).join(' | ')
  const catLines = taxonomy
    .map(c => `  ${c.id}: ${c.subcategories.map(s => s.label).join(' | ')}`)
    .join('\n')
  return `You are a professional cinematographer and art director analyzing images for a high-end cinematic asset library called Cineman.

TASK: Carefully study everything visible in this image — lighting, mood, environment, subjects, colors, textures, time of day, atmosphere — then return ONLY valid JSON (no markdown, no code block, no explanation) with exactly these fields:

{
  "title": "Precise cinematic title based on WHAT YOU SEE (4-6 words, Title Case). Must describe the actual content, NOT generic. Examples: Rain-Soaked Tokyo Alley at Dawn, Weathered Fisherman Portrait Golden Hour, Brutalist Rooftop Sunset Moscow",
  "type": "EXACTLY one of: ${typeIds}. Location = places/environments/interiors. Character = people/creatures/figures. Vehicle = cars/aircraft/ships. Prop = objects/items",
  "category": "EXACTLY one subcategory label from the list matching the chosen type:\n${catLines}",
  "description": "2-3 sentence cinematic description of EXACTLY what is in the frame. Describe: main subject, environment/setting, lighting quality and direction, mood/atmosphere, notable visual details. Write like a film director shot notes.",
  "tags": ["tag1", "..."] — exactly 12 lowercase tags specific to THIS image. For people ALWAYS include: gender (man/woman), age group (young/middle-aged/elderly), hair color, key wardrobe items, build, vibe. Also add: visual style, lighting, mood, color, genre, environment,
  "face_box": [x, y, width, height] — normalized 0-1 box around the clearest FRONTAL FACE (head only) in the image. If the sheet shows several views of one person, pick the view facing the camera. Use null if no clear frontal face
}

RULES:
- Base title and description ONLY on what you actually see in the image
- type and category MUST be picked from the allowed lists above, exactly as written
- Title must be specific, never generic
- Description must name concrete visual details: actual colors, light direction, textures you see
- Tags must be specific to THIS image — never use generic tags like beautiful or nice
- Return ONLY the JSON object, nothing else`
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'
    const taxonomy = await loadTaxonomy()
    const PROMPT = buildPrompt(taxonomy)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 20000)

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: PROMPT },
          ],
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 512,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    }).catch((fetchErr: unknown) => {
      clearTimeout(timeoutId)
      throw new Error('FETCH_FAILED:' + (fetchErr instanceof Error ? fetchErr.message : String(fetchErr)))
    })

    clearTimeout(timeoutId)

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Gemini API error', detail: err }, { status: 502 })
    }

    const data = await res.json()

    // gemini-2.5-flash may return thinking parts — find the actual text part
    const parts: Array<{ thought?: boolean; text?: string }> =
      data?.candidates?.[0]?.content?.parts ?? []
    const text = parts.find(p => !p.thought)?.text ?? ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error('No JSON in response:', text.slice(0, 300))
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    const validTypes = taxonomy.map(c => c.id)
    return NextResponse.json({
      title: String(parsed.title ?? ''),
      type: validTypes.includes(parsed.type) ? parsed.type : 'Location',
      category: String(parsed.category ?? ''),
      description: String(parsed.description ?? ''),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 12).join(', ') : '',
      face_box: Array.isArray(parsed.face_box) && parsed.face_box.length === 4 ? parsed.face_box.map(Number) : null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('ai-name error:', msg)
    if (msg.startsWith('FETCH_FAILED:')) {
      return NextResponse.json({ error: 'Gemini timed out', detail: msg }, { status: 504 })
    }
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}
