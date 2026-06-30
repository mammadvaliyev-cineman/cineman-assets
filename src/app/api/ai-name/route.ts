import { NextRequest, NextResponse } from 'next/server'

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

const PROMPT = `You are an AI assistant for a cinematic asset library called Cineman.
Analyze this image and return ONLY valid JSON (no markdown, no code block) with these fields:
{
  "title": "Short cinematic title (3-5 words, Title Case)",
  "type": "Location or Character",
  "category": "One word: Urban, Nature, Portrait, Aerial, Interior, Desert, Forest, Industrial",
  "tags": ["tag1", "tag2"] (max 8 cinematic tags)
}
Think like a film director.`

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: PROMPT },
        ]}],
        generationConfig: { temperature: 0.4, maxOutputTokens: 256 },
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
    if (!jsonMatch) return NextResponse.json({ error: 'Could not parse AI response' }, { status: 500 })

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json({
      title: String(parsed.title ?? ''),
      type: parsed.type === 'Character' ? 'Character' : 'Location',
      category: String(parsed.category ?? ''),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8).join(', ') : '',
    })
  } catch (err) {
    console.error('ai-name error:', err)
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}
