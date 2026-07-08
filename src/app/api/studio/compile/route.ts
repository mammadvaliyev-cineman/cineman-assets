import { NextRequest, NextResponse } from 'next/server'
import { ENGINE_CATS, MASTER_PRESET, PHYS } from '@/lib/engine'

export const maxDuration = 30

// ─────────────────────────────────────────────────────────────
// PROMPT COMPILER — deterministic template first (same scene in
// → same prompt out, always testable), Gemini polish second.
// Powered by the Cineman Engine (ported from Prompt Maker v2.0):
// every selected chip maps to a curated prompt block. Order per
// Seedance rules: references → action → camera → light/atmosphere
// → style → master preset → consistency block LAST.
// ─────────────────────────────────────────────────────────────

type SceneState = {
  videoType?: string
  hero?: { title?: string; description?: string } | null
  location?: { title?: string; description?: string } | null
  action?: string
  camera?: { move?: string; framing?: string; cuts?: string }
  details?: { weather?: string; timeOfDay?: string; mood?: string }
  // Engine selections from the studio: category id → selected label(s)
  engine?: Record<string, string | string[]>
  masterPreset?: boolean
}

// Look up the curated prompt text for a selected engine chip label
function enginePrompt(catId: string, label: string): string | null {
  const cat = ENGINE_CATS[catId]
  if (!cat) return null
  const hit = cat.items.find(([l]) => l.toLowerCase() === label.toLowerCase())
  return hit ? hit[1] : null
}

const ENGINE_ORDER = [
  'shottype', 'angle', 'lens', 'focus', 'camtype', 'camera',
  'light', 'time', 'weather', 'genre', 'styles', 'colorgrade',
  'delivery', 'music',
]

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

  // Engine chips → curated prompt blocks, in Seedance-friendly order
  const engineSel = s.engine || {}
  const engineParts: string[] = []
  for (const catId of ENGINE_ORDER) {
    const sel = engineSel[catId]
    if (!sel) continue
    const labels = Array.isArray(sel) ? sel : [sel]
    for (const label of labels) {
      const p = enginePrompt(catId, label)
      if (p) engineParts.push(p)
      else if (label.trim()) engineParts.push(label.trim())
    }
  }
  if (engineParts.length) parts.push(engineParts.join('. ') + '.')

  const styleByType: Record<string, string> = {
    ad: 'High-end commercial advertising style, crisp product-grade lighting, cinematic color grade.',
    film: 'Cinematic film look, shallow depth of field, filmic color grade, anamorphic feel.',
    product: 'Clean product video style, studio-grade lighting, premium minimal aesthetic.',
    music: 'Music video style, bold visuals, expressive lighting, rhythmic energy.',
    other: 'Cinematic, professional color grade.',
  }
  // Style-by-type only when no explicit genre/style chips picked
  if (!engineSel.genre && !engineSel.styles) {
    parts.push(styleByType[s.videoType || 'other'] || styleByType.other)
  }

  // Master style preset (toggled in /engine)
  if (s.masterPreset !== false) parts.push(MASTER_PRESET)

  // Consistency block — ALWAYS LAST per Seedance prompt rules
  const weatherSel = engineSel.weather
  const weatherLabel = Array.isArray(weatherSel) ? weatherSel[0] : weatherSel
  const ph = weatherLabel ? PHYS[weatherLabel] : (s.details?.weather ? PHYS[s.details.weather] : undefined)
  parts.push(
    'Consistency: keep the same character, same clothing, same hairstyle, no face changes, no flicker, high consistency' +
    (ph ? `. Realistic ${ph} physics` : '') + '.',
  )

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
            text: `You are a film director writing a prompt for the Seedance 2.0 video model. Rewrite the draft below into fluent English prose. HARD LIMIT: 100-240 words total — compress style/lighting details rather than exceeding it. RULES: keep every @imageN / reference image binding exactly as written; keep camera, lens, framing, lighting, atmosphere, style and color facts (condense wordy style blocks to their essence); translate any non-English action description to English; the Consistency block must stay as the FINAL sentence; positive statements only (never "no X" except inside the Consistency block); do not invent new major elements. Return ONLY the prompt text.\n\nDRAFT:\n${prompt}\n\nORIGINAL USER ACTION (may be non-English): ${action}`,
          }],
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 800,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    })
    const json = await res.json()
    const polishParts: Array<{ text?: string }> = json?.candidates?.[0]?.content?.parts || []
    const out = polishParts.map(p => p.text || '').join('').trim()
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

