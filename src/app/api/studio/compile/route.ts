import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 30

// ─────────────────────────────────────────────────────────────
// PROMPT COMPILER — deterministic template first (same scene in
// → same prompt out, always testable), Gemini polish second.
// The user never sees or edits this: the dialog IS the interface.
// ─────────────────────────────────────────────────────────────

type SceneState = {
  videoType?: string
  hero?: { title?: string; description?: string } | null
  location?: { title?: string; description?: string } | null
  action?: string
  camera?: { move?: string; framing?: string; cuts?: string }
  details?: { weather?: string; timeOfDay?: string; mood?: string }
}

const CAMERA_MOVES: Record<string, string> = {
  static: 'locked-off static camera on a tripod',
  follow: 'smooth tracking camera following the subject',
  orbit: 'slow cinematic orbit around the subject',
  drone: 'sweeping aerial drone shot',
  handheld: 'energetic handheld camera with subtle shake',
}

const FRAMINGS: Record<string, string> = {
  closeup: 'close-up framing',
  medium: 'medium shot framing',
  wide: 'wide establishing shot framing',
}

const CUTS: Record<string, string> = {
  smooth: 'smooth continuous takes with seamless transitions',
  dynamic: 'dynamic fast cuts, punchy editing rhythm',
  mixed: 'a mix of long takes and quick cuts',
}

function buildDeterministicPrompt(s: SceneState): string {
  const parts: string[] = []

  // Reference bindings — Seedance 2.0 reads reference images in order
  if (s.hero) parts.push(`The main character is the person from reference image 1 (@image1): ${s.hero.title || ''}. Keep their face, hair and outfit perfectly consistent.`)
  if (s.location) parts.push(`The scene takes place in the environment from reference image ${s.hero ? 2 : 1}: ${s.location.title || ''}.`)

  if (s.action) parts.push(`Action: ${s.action}.`)

  const cam: string[] = []
  if (s.camera?.move && CAMERA_MOVES[s.camera.move]) cam.push(CAMERA_MOVES[s.camera.move])
  if (s.camera?.framing && FRAMINGS[s.camera.framing]) cam.push(FRAMINGS[s.camera.framing])
  if (s.camera?.cuts && CUTS[s.camera.cuts]) cam.push(CUTS[s.camera.cuts])
  if (cam.length) parts.push(`Camera: ${cam.join(', ')}.`)

  const det: string[] = []
  if (s.details?.weather) det.push(`${s.details.weather} weather`)
  if (s.details?.timeOfDay) det.push(s.details.timeOfDay)
  if (s.details?.mood) det.push(`${s.details.mood} mood`)
  if (det.length) parts.push(`Atmosphere: ${det.join(', ')}.`)

  const styleByType: Record<string, string> = {
    ad: 'High-end commercial advertising style, crisp product-grade lighting, cinematic color grade.',
    film: 'Cinematic film look, shallow depth of field, filmic color grade, anamorphic feel.',
    product: 'Clean product video style, studio-grade lighting, premium minimal aesthetic.',
    music: 'Music video style, bold visuals, expressive lighting, rhythmic energy.',
    other: 'Cinematic, professional color grade.',
  }
  parts.push(styleByType[s.videoType || 'other'] || styleByType.other)

  return parts.join(' ')
}

const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

async function polish(prompt: string, action: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return prompt
  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `You are a film director writing a prompt for the Seedance 2.0 video model. Rewrite the draft below into ONE fluent English paragraph (max 120 words). RULES: keep every @imageN reference binding exactly as written; keep all camera, framing, atmosphere and style facts; translate any non-English action description to English; do not invent new major elements. Return ONLY the prompt text.\n\nDRAFT:\n${prompt}\n\nORIGINAL USER ACTION (may be non-English): ${action}`,
          }],
        }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
      }),
    })
    const json = await res.json()
    const out = json?.candidates?.[0]?.content?.parts?.[0]?.text?.trim()
    return out || prompt
  } catch {
    return prompt
  }
}

export async function POST(req: NextRequest) {
  try {
    const scene = (await req.json()) as SceneState
    const draft = buildDeterministicPrompt(scene)
    const finalPrompt = await polish(draft, scene.action || '')
    return NextResponse.json({ prompt: finalPrompt, draft })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Compile failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

