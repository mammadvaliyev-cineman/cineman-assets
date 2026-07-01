import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

const PROMPT = `You are a professional cinematographer and art director analyzing images for a high-end cinematic asset library called Cineman.

TASK: Carefully study everything visible in this image — lighting, mood, environment, subjects, colors, textures, time of day, atmosphere — then return ONLY valid JSON (no markdown, no code block, no explanation) with exactly these fields:

{
  "title": "Precise cinematic title based on WHAT YOU SEE (4-6 words, Title Case). Must describe the actual content, NOT generic. Examples: Rain-Soaked Tokyo Alley at Dawn, Weathered Fisherman Portrait Golden Hour, Brutalist Rooftop Sunset Moscow",
  "type": "Location or Character — Location means places/environments/landscapes/architecture/interiors. Character means people/portraits/figures/faces",
  "category": "Single category word: Urban | Nature | Portrait | Aerial | Interior | Desert | Forest | Industrial | Coastal | Mountain | Sci-Fi | Fantasy | Street | Architecture | Underwater | Studio",
  "description": "2-3 sentence cinematic description of EXACTLY what is in the frame. Describe: main subject, environment/setting, lighting quality and direction, mood/atmosphere, notable visual details. Write like a film director shot notes.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5", "tag6", "tag7", "tag8"] — exactly 8 lowercase tags specific to THIS image: subject, visual style, lighting, mood, color, genre, texture, environment
}

RULES:
- Base title and description ONLY on what you actually see in the image
- Title must be specific, never generic
- Description must name concrete visual details: actual colors, light direction, textures you see
- Tags must be specific to THIS image — never use generic tags like beautiful or nice
- Return ONLY the JSON object, nothing else`

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

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: base64 } },
            { text: PROMPT },
          ],
        }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 512 },
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Gemini error:', err)
      return NextResponse.json({ error: 'Gemini API error' }, { status: 502 })
    }

    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      title: String(parsed.title ?? ''),
      type: parsed.type === 'Character' ? 'Character' : 'Location',
      category: String(parsed.category ?? ''),
      description: String(parsed.description ?? ''),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8).join(', ') : '',
    })
  } catch (err) {
    console.error('ai-name error:', err)
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}
