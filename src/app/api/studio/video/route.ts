import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { kieCreateTask, kieGetTask } from '@/lib/kie'
import { presignR2Get, r2Configured, r2Put } from '@/lib/r2'
import { requireUser, isAdminEmail } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// STUDIO VIDEO GENERATION (Seedance 2.0 via kie.ai — one provider).
// • POST — start: price from pricing_defaults.gen_video, atomic
//   spend (admins free), createTask with multimodal references
//   (@-mentioned asset sheets go to reference_image_urls → character
//   and location consistency), generations row = History.
// • GET ?genId= — poll: on success the video is re-hosted to R2
//   (kie URLs expire ~24h), the row flips to done. Fail → refund.
// • GET ?list=1 — history with fresh presigned playback URLs.
// • DELETE {ids} — remove own history rows.
// • No KIE/FAL key → honest 503 {code:'soon'}, nobody is charged.
// ─────────────────────────────────────────────────────────────

const MODELS: Record<string, string> = {
  'seedance-2': 'bytedance/seedance-2',
  'seedance-2-fast': 'bytedance/seedance-2-fast',
  // Kling 3.0 via kie.ai — the exact market slug is env-tunable so the
  // owner can correct it without a deploy; failures refund credits
  'kling-3': process.env.KIE_KLING_MODEL || 'kwaivgi/kling-v3',
}

// Cost formula (DEV_studio_panel §6): base = pricing_defaults.gen_video,
// scaled by model / duration / resolution. The Studio UI mirrors this
// EXACTLY so the user sees the true price before generating.
const MODEL_MULT: Record<string, number> = { 'seedance-2': 1, 'seedance-2-fast': 0.6, 'kling-3': 1.2 }
function computeCost(base: number, model: string, settings: { duration?: unknown; resolution?: unknown }): number {
  const dur = [5, 10, 15].includes(Number(settings.duration)) ? Number(settings.duration) : 5
  const resMult = String(settings.resolution) === '1080p' ? 1.5 : 1
  return Math.max(1, Math.round(base * (MODEL_MULT[model] ?? 1) * (dur / 5) * resMult))
}

async function priceOf(admin: ReturnType<typeof supabaseAdmin>): Promise<number> {
  const { data } = await admin.from('pricing_defaults').select('credits').eq('tier', 'gen_video').single()
  return Number(data?.credits ?? 25)
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireUser(req)
    if (!gate.ok) return NextResponse.json({ error: gate.error, code: 'auth' }, { status: gate.status })
    if (!process.env.KIE_API_KEY) {
      return NextResponse.json({ error: 'Video generation is coming soon', code: 'soon' }, { status: 503 })
    }
    const body = await req.json()
    const prompt = String(body.prompt || '').trim()
    if (!prompt) return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    const settings = body.settings || {}
    const model = MODELS[String(settings.model)] ? String(settings.model) : 'seedance-2'
    const refs: { id?: string; title?: string; image?: string }[] = Array.isArray(body.refs) ? body.refs.slice(0, 6) : []
    const uploads = body.uploads || {}

    const admin = supabaseAdmin()
    const cost = computeCost(await priceOf(admin), model, settings)
    const adminFree = isAdminEmail(gate.email)
    let remaining: number | null = null
    if (!adminFree) {
      const { data: rem, error: rpcErr } = await admin.rpc('spend_credits', { p_user: gate.userId, p_cost: cost })
      if (rpcErr) return NextResponse.json({ error: 'Billing error, try again' }, { status: 500 })
      if (typeof rem === 'number' && rem < 0) {
        return NextResponse.json({ error: 'Not enough credits', code: 'credits', cost }, { status: 402 })
      }
      remaining = typeof rem === 'number' ? rem : null
    }

    // Multimodal references: @-mentioned asset sheets + optional uploads
    const refImages = [
      ...refs.map(r => String(r.image || '')).filter(Boolean),
      ...(uploads.image ? [String(uploads.image)] : []),
    ].slice(0, 4)
    const input: Record<string, unknown> = {
      prompt,
      generate_audio: !!settings.audio,
      resolution: ['720p', '1080p'].includes(String(settings.resolution)) ? String(settings.resolution) : '720p',
      aspect_ratio: ['16:9', '9:16', '1:1', '4:3'].includes(String(settings.aspect)) ? String(settings.aspect) : '16:9',
      // Kling caps at 10s — clamp so a stale draft can't send 15
      duration: Math.min(
        model === 'kling-3' ? 10 : 15,
        [5, 10, 15].includes(Number(settings.duration)) ? Number(settings.duration) : 5,
      ),
    }
    if (Number.isFinite(Number(settings.seed)) && String(settings.seed).trim() !== '') input.seed = Math.abs(Math.round(Number(settings.seed)))
    if (refImages.length) input.reference_image_urls = refImages
    if (uploads.video) input.reference_video_urls = [String(uploads.video)]
    if (uploads.audio) input.reference_audio_urls = [String(uploads.audio)]

    let taskId: string
    try {
      taskId = await kieCreateTask(MODELS[model], input)
    } catch (err) {
      if (!adminFree) await admin.rpc('spend_credits', { p_user: gate.userId, p_cost: -cost }).then(() => {}, () => {})
      const msg = err instanceof Error ? err.message : 'Generation failed to start'
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    const { data: row } = await admin.from('generations').insert({
      user_id: gate.userId,
      task_id: taskId,
      model,
      prompt,
      structured: body.structured ?? null,
      settings,
      refs,
      state: 'rendering',
      cost: adminFree ? 0 : cost,
    }).select('id').single()

    return NextResponse.json({ genId: row?.id, taskId, credits: remaining, cost: adminFree ? 0 : cost })
  } catch (err) {
    console.error('Studio video POST error:', err)
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const gate = await requireUser(req)
    if (!gate.ok) return NextResponse.json({ error: gate.error, code: 'auth' }, { status: gate.status })
    const admin = supabaseAdmin()
    const sp = req.nextUrl.searchParams

    // ── history list with fresh playback links ────────────────
    if (sp.get('list')) {
      const { data: rows } = await admin.from('generations')
        .select('id, model, prompt, structured, settings, refs, r2_key, state, favorite, cost, created_at')
        .eq('user_id', gate.userId).order('created_at', { ascending: false }).limit(200)
      return NextResponse.json({
        items: (rows || []).map(r => ({
          ...r,
          url: r.r2_key && r2Configured() ? presignR2Get(String(r.r2_key), undefined, 3600) : null,
        })),
      })
    }

    // ── poll one rendering generation ─────────────────────────
    const genId = sp.get('genId')
    if (!genId) return NextResponse.json({ error: 'genId is required' }, { status: 400 })
    const { data: gen } = await admin.from('generations')
      .select('id, task_id, state, r2_key, cost, prompt')
      .eq('id', genId).eq('user_id', gate.userId).single()
    if (!gen) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (gen.state === 'done' && gen.r2_key) {
      return NextResponse.json({ state: 'done', url: presignR2Get(String(gen.r2_key), undefined, 3600) })
    }
    if (gen.state === 'fail') return NextResponse.json({ state: 'fail', error: 'Generation failed' })

    const info = await kieGetTask(String(gen.task_id))
    if (info.state === 'fail') {
      await admin.from('generations').update({ state: 'fail' }).eq('id', gen.id)
      // pay only for success
      if (Number(gen.cost) > 0) {
        await admin.rpc('spend_credits', { p_user: gate.userId, p_cost: -Number(gen.cost) }).then(() => {}, () => {})
        await admin.from('generations').update({ cost: 0 }).eq('id', gen.id)
      }
      return NextResponse.json({ state: 'fail', error: info.failMsg || 'Generation failed — credits refunded', refunded: gen.cost })
    }
    if (info.state !== 'success' || !info.resultUrls[0]) {
      return NextResponse.json({ state: info.state, progress: info.progress })
    }

    // success → re-host to R2 (kie links expire), mark done
    const vid = await fetch(info.resultUrls[0])
    if (!vid.ok) return NextResponse.json({ state: 'generating', progress: 99 }) // retry next poll
    const buf = Buffer.from(await vid.arrayBuffer())
    const key = `gen/${gen.id}.mp4`
    if (r2Configured()) await r2Put(key, buf, 'video/mp4')
    await admin.from('generations').update({ r2_key: key, state: 'done' }).eq('id', gen.id)

    // OWNERSHIP: the generation belongs to its creator — it also lands in
    // the Library as a private owned asset (free re-downloads forever)
    try {
      const { data: asset } = await admin.from('assets').insert({
        title: String(gen.prompt || 'Generated video').slice(0, 70),
        type: 'Video',
        category: 'Generated',
        plan: 'free',
        tags: ['generated', 'cineman-studio', 'video'],
        description: '',
        file_url: 'https://cineman-assets.vercel.app/studio',
        thumbnail_url: '',
        is_public: false,
        r2_key: key,
        resolution: '2K',
      }).select('id').single()
      if (asset?.id) {
        await admin.from('purchases').upsert(
          { user_id: gate.userId, asset_id: asset.id, cost: Number(gen.cost) || 0 },
          { onConflict: 'user_id,asset_id', ignoreDuplicates: true },
        )
      }
    } catch { /* non-fatal */ }

    return NextResponse.json({ state: 'done', url: presignR2Get(key, undefined, 3600) })
  } catch (err) {
    console.error('Studio video GET error:', err)
    return NextResponse.json({ error: 'Poll failed' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const gate = await requireUser(req)
    if (!gate.ok) return NextResponse.json({ error: gate.error, code: 'auth' }, { status: gate.status })
    const { ids } = await req.json()
    if (!Array.isArray(ids) || ids.length === 0) return NextResponse.json({ error: 'ids required' }, { status: 400 })
    const admin = supabaseAdmin()
    await admin.from('generations').delete().eq('user_id', gate.userId).in('id', ids.slice(0, 100))
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
