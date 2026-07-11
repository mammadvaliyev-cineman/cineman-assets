import { NextRequest, NextResponse } from 'next/server'
import { kieCreateTask, kieGetTask, KIE_MODELS } from '@/lib/kie'
import { supabaseAdmin } from '@/lib/supabase'
import { requireUser } from '@/lib/adminAuth'
import { checkUsage, incrementUsage } from '@/lib/usage'

export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// ASSET FALLBACK GENERATION — only fires when the library has
// no match. Every generated asset is SAVED BACK to the base
// (Supabase storage + assets row), so the library grows from
// real user demand and each generation amortizes to zero.
// POST → start Nano Banana task. GET → poll; on success the
// image is downloaded, re-hosted and inserted as an asset.
// ─────────────────────────────────────────────────────────────

const STYLE: Record<string, string> = {
  Character: [
    'character reference sheet, same character shown in three panels: full body front view, full body back view, close-up front portrait,',
    'neutral standing pose, arms down, legs straight, realistic anatomy, consistent clothing and hairstyle, centered framing,',
    'clean split-panel composition, reference photo style, no action pose, no extra angles, no side view.',
    'Ultra high-resolution 4K, hyper-realistic detail: skin texture, fabric fibers, surface imperfections, micro-details.',
    'Advanced de-noising, no compression artifacts, no grain, natural texture retained.',
    'Natural edge sharpness (no over-sharpening halos), accurate color grading, true-to-life tones and dynamic range.',
    'Realistic lighting: balanced highlights and shadows, improved contrast without crushing blacks or blowing highlights.',
    'Subtle cinematic depth: natural depth of field, realistic focus falloff, no artificial blur.',
    'Output should look like it was captured on a modern high-end cinema camera (ARRI Alexa / RED), hyper-realistic, clean, crisp, film-quality.',
    'NO artifacts, NO AI distortion, NO plastic skin, NO oversmoothing, NO stylization. no title no text.',
  ].join(' '),
  Location:
    'Cinematic location establishing plate, no people, photorealistic, film still quality, professional cinematography, atmospheric lighting.',
}

export async function POST(req: NextRequest) {
  try {
    const gate = await requireUser(req)
    if (!gate.ok) return NextResponse.json({ error: gate.error, code: 'auth' }, { status: gate.status })
    const usage = await checkUsage(gate.userId, gate.email)
    if (usage.remaining <= 0) return NextResponse.json({ error: `Daily limit reached (${usage.limit}). Upgrade for more.`, code: 'quota', usage }, { status: 402 })
    const { assetType, description } = await req.json()
    if (!assetType || !description) {
      return NextResponse.json({ error: 'assetType and description are required' }, { status: 400 })
    }

    // ONE CURRENCY (pricing copy): generation spends credits like
    // downloads do. Price lives in pricing_defaults.gen_base — editable
    // in Admin → Pricing. Spent BEFORE the task; refunded if the task
    // fails to start.
    const admin = supabaseAdmin()
    const { data: pd } = await admin.from('pricing_defaults').select('credits').eq('tier', 'gen_base').single()
    const cost = Number(pd?.credits ?? 5)
    const { data: remaining, error: rpcErr } = await admin.rpc('spend_credits', { p_user: gate.userId, p_cost: cost })
    if (rpcErr) return NextResponse.json({ error: 'Billing error, try again' }, { status: 500 })
    if (typeof remaining === 'number' && remaining < 0) {
      return NextResponse.json({ error: 'Not enough credits', code: 'credits', cost }, { status: 402 })
    }

    const prompt = `${description}. ${STYLE[assetType] || ''}`
    let taskId: string
    try {
      taskId = await kieCreateTask(KIE_MODELS.imageFallback, {
        prompt,
        output_format: 'png',
        // Character reference sheets are wide split-panel boards → 16:9
        ...(assetType === 'Character' ? { image_size: '16:9' } : {}),
      })
    } catch (err) {
      // task never started — give the money back
      await admin.rpc('spend_credits', { p_user: gate.userId, p_cost: -cost }).then(() => {}, () => {})
      throw err
    }
    await incrementUsage(gate.userId)
    return NextResponse.json({ taskId, credits: remaining, cost })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams
    const taskId = sp.get('taskId')
    const assetType = sp.get('assetType') || 'Character'
    const title = (sp.get('title') || 'Generated asset').slice(0, 80)
    if (!taskId) return NextResponse.json({ error: 'taskId is required' }, { status: 400 })

    const info = await kieGetTask(taskId)
    if (info.state !== 'success' || !info.resultUrls.length) {
      // «платит только за успех»: if the render FAILED, give the credits
      // back to the caller (client polls with its auth token)
      if (info.state === 'fail') {
        const auth = req.headers.get('authorization') || ''
        const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
        if (token) {
          const admin = supabaseAdmin()
          const { data: userData } = await admin.auth.getUser(token)
          if (userData?.user) {
            const { data: pd } = await admin.from('pricing_defaults').select('credits').eq('tier', 'gen_base').single()
            const cost = Number(pd?.credits ?? 5)
            const { data: remaining } = await admin.rpc('spend_credits', { p_user: userData.user.id, p_cost: -cost })
            return NextResponse.json({ state: info.state, progress: info.progress, error: info.failMsg || undefined, refunded: cost, credits: remaining })
          }
        }
      }
      return NextResponse.json({ state: info.state, progress: info.progress, error: info.failMsg || undefined })
    }

    // Success → re-host (kie URLs expire in ~24h) and save to the base
    const admin = supabaseAdmin()
    const imgRes = await fetch(info.resultUrls[0])
    const buf = Buffer.from(await imgRes.arrayBuffer())
    const path = `generated/${Date.now()}-${title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')}.png`

    const { error: upErr } = await admin.storage
      .from('assets')
      .upload(path, buf, { contentType: 'image/png', upsert: false })
    if (upErr) throw upErr

    const publicUrl = admin.storage.from('assets').getPublicUrl(path).data.publicUrl

    const { data: inserted, error: dbErr } = await admin
      .from('assets')
      .insert({
        title,
        type: assetType,
        category: assetType,
        plan: 'free',
        tags: ['generated', 'cineman-studio'],
        description: sp.get('description') || '',
        file_url: publicUrl,
        thumbnail_url: publicUrl,
      })
      .select()
      .single()
    if (dbErr) throw dbErr

    return NextResponse.json({ state: 'success', asset: inserted })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Save failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
