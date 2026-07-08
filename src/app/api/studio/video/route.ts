import { NextRequest, NextResponse } from 'next/server'
import { kieCreateTask, kieGetTask, KIE_MODELS } from '@/lib/kie'

export const maxDuration = 30

// ─────────────────────────────────────────────────────────────
// VIDEO — the ONLY mandatory paid step of the whole flow.
// POST → create Seedance task (draft = seedance-2-fast, cheaper;
// final = seedance-2). GET ?taskId= → poll status.
// ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { prompt, referenceImageUrls = [], quality = 'draft', duration } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const model = quality === 'final' ? KIE_MODELS.videoFinal : KIE_MODELS.videoDraft
    const input: Record<string, unknown> = {
      prompt,
      aspect_ratio: '16:9',
      resolution: quality === 'final' ? '1080p' : '720p',
      generate_audio: quality === 'final',
    }
    if (Array.isArray(referenceImageUrls) && referenceImageUrls.length) {
      input.reference_image_urls = referenceImageUrls.slice(0, 9)
    }
    if (duration) input.duration = Number(duration)

    const taskId = await kieCreateTask(model, input)
    return NextResponse.json({ taskId, model })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Video task failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }
    const info = await kieGetTask(taskId)
    return NextResponse.json(info)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Status check failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
