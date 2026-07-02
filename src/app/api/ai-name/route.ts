import { NextRequest, NextResponse } from 'next/server'


export const maxDuration = 30 // Vercel: allow up to 30s for Gemini


const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'


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
