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
  Character:
    'Full body cinematic character reference, single person, natural pose, photorealistic, film still quality, neutral cinematic background, professional color grade.',
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
    const prompt = `${description}. ${STYLE[assetType] || ''}`
    const taskId = await kieCreateTask(KIE_MODELS.imageFallback, {
      prompt,
      output_format: 'png',
    })
    await incrementUsage(gate.userId)
    return NextResponse.json({ taskId })
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
