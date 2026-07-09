import { NextRequest, NextResponse } from 'next/server'
import { kieCreateTask, kieGetTask, KIE_MODELS } from '@/lib/kie'
import { arkCreateVideoTask, arkGetVideoTask, arkEnabled } from '@/lib/ark'
import { supabaseAdmin } from '@/lib/supabase'
import { checkUsage, incrementUsage } from '@/lib/usage'

export const maxDuration = 30

// ─────────────────────────────────────────────────────────────
// VIDEO — the ONLY mandatory paid step of the whole flow.
// Auth-gated + daily quota to protect the ModelArk budget.
// Provider selection: BytePlus ModelArk (official Seedance home)
// when ARK_API_KEY is set, kie.ai otherwise. Task ids returned to
// the client are prefixed with the provider so GET routes back.
// ─────────────────────────────────────────────────────────────

// Resolve the signed-in user from the bearer token (studio sends it)
async function getUser(req: NextRequest): Promise<{ id: string; email: string | null } | null> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return null
  try {
    const { data } = await supabaseAdmin().auth.getUser(token)
    return data.user ? { id: data.user.id, email: data.user.email ?? null } : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    // 1) Must be signed in — rendering costs money
    const user = await getUser(req)
    if (!user) {
      return NextResponse.json({ error: 'Sign in to generate videos', code: 'auth' }, { status: 401 })
    }
    // 2) Daily quota — protects the render budget
    const usage = await checkUsage(user.id, user.email)
    if (usage.remaining <= 0) {
      return NextResponse.json(
        { error: `Daily limit reached (${usage.limit} renders). Upgrade for more.`, code: 'quota', usage },
        { status: 402 },
      )
    }

    const { prompt, referenceImageUrls = [], quality = 'draft', duration } = await req.json()
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    if (arkEnabled()) {
      const id = await arkCreateVideoTask({ prompt, referenceImageUrls, quality, duration })
      await incrementUsage(user.id)
      return NextResponse.json({ taskId: `ark:${id}`, provider: 'modelark' })
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
    await incrementUsage(user.id)
    return NextResponse.json({ taskId, provider: 'kie' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Video task failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── Permanent storage: provider URLs expire in ~24h, so on
// success we re-host the video into Supabase Storage once and
// keep a Generation record. Users never lose their renders.
async function rehostVideo(taskId: string, url: string, quality: string): Promise<string> {
  try {
    const admin = supabaseAdmin()
    const safe = taskId.replace(/[^a-zA-Z0-9_-]/g, '').slice(-48) || `gen-${Date.now()}`
    const { data: existing } = await admin
      .from('assets')
      .select('file_url')
      .eq('type', 'Generation')
      .eq('title', safe)
      .limit(1)
    if (existing?.length) return existing[0].file_url
    const res = await fetch(url)
    if (!res.ok) return url
    const buf = Buffer.from(await res.arrayBuffer())
    const path = `generations/${safe}.mp4`
    const { error } = await admin.storage.from('assets').upload(path, buf, { contentType: 'video/mp4', upsert: true })
    if (error) return url
    const pub = admin.storage.from('assets').getPublicUrl(path).data.publicUrl
    await admin.from('assets').insert({
      title: safe,
      type: 'Generation',
      category: quality === 'final' ? 'Final Video' : 'Draft Video',
      plan: 'free',
      tags: ['generation', 'video', quality],
      description: `Generated in Cineman Studio (${new Date().toISOString().slice(0, 10)})`,
      file_url: pub,
      thumbnail_url: pub,
    })
    return pub
  } catch {
    return url
  }
}

export async function GET(req: NextRequest) {
  try {
    const taskId = req.nextUrl.searchParams.get('taskId')
    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }
    const quality = req.nextUrl.searchParams.get('quality') || 'draft'
    if (taskId.startsWith('ark:')) {
      const info = await arkGetVideoTask(taskId.slice(4))
      if (info.state === 'success' && info.resultUrls?.length) {
        info.resultUrls = [await rehostVideo(taskId, info.resultUrls[0], quality)]
      }
      return NextResponse.json(info)
    }
    const info = await kieGetTask(taskId)
    if (info.state === 'success' && info.resultUrls?.length) {
      info.resultUrls = [await rehostVideo(taskId, info.resultUrls[0], quality)]
    }
    return NextResponse.json(info)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Status check failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
