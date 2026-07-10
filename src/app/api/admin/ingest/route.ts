import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// ADMIN INGEST — one file per request, browser-compressed JPEG.
// FormData: file (jpeg ≤4MB), rel (path inside Dropbox AI BASE).
// Server does everything else: Gemini tagging, v2 taxonomy
// mapping (People/Animal/Creature/Robot/Location/Vehicle/Prop),
// src: tag for idempotency, is_public=false for copyright
// folders, Storage upload + assets insert.
// Skips silently if this src: slug is already in the base.
// ─────────────────────────────────────────────────────────────

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent'
const PROMPT = `You are a cinematographer analysing an image for a cinematic asset library. Return ONLY valid JSON (no markdown):
{
 "title":"Precise cinematic title, 4-6 words, Title Case, based on what you see",
 "description":"2-3 sentence cinematic description of exactly what is in frame",
 "tags":["exactly 12 lowercase descriptive tags: hair, wardrobe, build, vibe, style, lighting, mood, color, genre, environment, texture — NO gender/age/ethnicity here"],
 "asset_type":"what is the MAIN subject: people | animal | creature | robot | location | vehicle | prop",
 "gender":"for a PERSON: man | woman. Else empty string.",
 "age":"for a PERSON: child | teen | young | adult | senior (young=~18-29, adult=~30-55). Else empty string.",
 "ethnicity":"for a PERSON: white | black | asian | south-asian | latino | mena | mixed. Else empty string.",
 "place":"for a LOCATION: interior | exterior. Else empty string.",
 "time":"for a LOCATION: dawn | day | golden | night. Else empty string.",
 "animal_class":"for a real-world ANIMAL: pets | predators | wild-mammals | birds | fish-sea | insects | reptiles. Else empty string.",
 "creature_kind":"for a fantasy CREATURE: monsters | aliens | dinosaurs | beasts. Else empty string.",
 "robot_type":"for a ROBOT: humanoid | android | mech | endoskeleton. Else empty string.",
 "vehicle_kind":"for a VEHICLE: cars | motorcycles. Else empty string.",
 "vehicle_brand":"for a VEHICLE the brand in lowercase (bmw, porsche, ducati...). Else empty string.",
 "vehicle_color":"for a VEHICLE the main body color in lowercase. Else empty string."
}`

const GENDER = ['man', 'woman']
const AGE = ['child', 'teen', 'young', 'adult', 'senior']
const ETH = ['white', 'black', 'asian', 'south-asian', 'latino', 'mena', 'mixed']
const PLACE = ['interior', 'exterior']
const TIME = ['dawn', 'day', 'golden', 'night']
const ACLASS = ['pets', 'predators', 'wild-mammals', 'birds', 'fish-sea', 'insects', 'reptiles']
const CKIND = ['monsters', 'aliens', 'dinosaurs', 'beasts']
const RTYPE = ['humanoid', 'android', 'mech', 'endoskeleton']
const ACLASS_LABEL: Record<string, string> = { 'pets': 'Pets', 'predators': 'Predators', 'wild-mammals': 'Wild Mammals', 'birds': 'Birds', 'fish-sea': 'Fish & Sea', 'insects': 'Insects', 'reptiles': 'Reptiles' }
const CKIND_LABEL: Record<string, string> = { 'monsters': 'Monsters', 'aliens': 'Aliens', 'dinosaurs': 'Dinosaurs', 'beasts': 'Beasts' }
const RTYPE_LABEL: Record<string, string> = { 'humanoid': 'Humanoid', 'android': 'Android', 'mech': 'Mech', 'endoskeleton': 'Endoskeleton' }
const pick = (val: unknown, allowed: string[]) => (allowed.includes(String(val || '').toLowerCase().trim()) ? String(val).toLowerCase().trim() : null)

const srcSlug = (rel: string) => {
  const base = rel.split('/').pop() || rel
  return base.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()).replace(/\s-\s/g, ' - ')
}

// folder mapping; category 'GEMINI' → decided by the model
function classifyByFolder(rel: string): { type: string; category: string; hidden: boolean } | null {
  const parts = rel.split('/').map(s => s.toUpperCase())
  if (parts.length < 2) return null // root — Gemini decides
  const section = parts[0]
  const folder = parts.length >= 3 ? parts[1] : ''
  const hidden = ['CELEBRITIES', 'CHARACTERS'].includes(folder)
  if (section.includes('CHARCTER') || section.includes('CHARACTER')) {
    if (folder.startsWith('PEOPLE')) {
      const sub = folder.includes('WOMEN') ? 'Women' : folder.includes('MEN') ? 'Men' : 'Kids'
      return { type: 'People', category: sub, hidden }
    }
    if (folder === 'ANIMALS') return { type: 'Animal', category: 'GEMINI', hidden }
    if (folder === 'ALIENS') return { type: 'Creature', category: 'Aliens', hidden }
    if (folder === 'MONSTERS') return { type: 'Creature', category: 'Monsters', hidden }
    if (folder === 'PREHISTORIC') return { type: 'Creature', category: 'Dinosaurs', hidden }
    if (folder === 'CREATURES') return { type: 'Creature', category: 'Beasts', hidden }
    if (folder === 'ROBOTS') return { type: 'Robot', category: 'GEMINI', hidden }
    return { type: 'Character', category: folder ? titleCase(folder) : 'Characters', hidden: true }
  }
  if (section.includes('LOCATION')) return { type: 'Location', category: folder ? titleCase(folder) : 'Misc', hidden }
  if (section.includes('VEHICLE')) return { type: 'Vehicle', category: 'GEMINI', hidden }
  if (section.includes('PROP')) return { type: 'Prop', category: folder ? titleCase(folder) : 'Misc', hidden }
  return null
}

async function gemini(buf: Buffer, key: string) {
  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: 'image/jpeg', data: buf.toString('base64') } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0.5, maxOutputTokens: 900, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })
  if (!res.ok) throw new Error('gemini ' + res.status)
  const json = await res.json()
  const raw = (json?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('')
  const m = raw.match(/\{[\s\S]*\}/)
  return JSON.parse(m ? m[0] : raw.replace(/```json|```/g, '').trim())
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: 'no gemini key' }, { status: 500 })
  try {
    const form = await req.formData()
    const file = form.get('file') as File | null
    const rel = String(form.get('rel') || '')
    if (!file || !rel) return NextResponse.json({ error: 'file and rel are required' }, { status: 400 })
    if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'file too large' }, { status: 413 })

    const slug = srcSlug(rel)
    const admin = supabaseAdmin()

    // idempotency: skip if this source is already in the base
    const { data: existing } = await admin.from('assets').select('id').contains('tags', [`src:${slug}`]).limit(1)
    if (existing && existing.length > 0) {
      return NextResponse.json({ skipped: true, reason: 'already in base', slug })
    }

    const buf = Buffer.from(await file.arrayBuffer())
    let meta: Record<string, unknown> = {}
    try { meta = await gemini(buf, key) } catch { meta = {} }

    const byFolder = classifyByFolder(rel)
    let type = byFolder?.type || ''
    let category = byFolder?.category || ''
    let hidden = byFolder?.hidden || false

    if (!type) {
      // root file — Gemini decides the main subject
      const at = String(meta.asset_type || '').toLowerCase()
      if (at === 'people') { type = 'People'; category = 'GEMINI' }
      else if (at === 'animal') { type = 'Animal'; category = 'GEMINI' }
      else if (at === 'creature') { type = 'Creature'; category = 'GEMINI' }
      else if (at === 'robot') { type = 'Robot'; category = 'GEMINI' }
      else if (at === 'vehicle') { type = 'Vehicle'; category = 'GEMINI' }
      else if (at === 'prop') { type = 'Prop'; category = 'Misc' }
      else { type = 'Location'; category = 'Misc' }
    }

    const attrs: string[] = [`src:${slug}`]
    if (type === 'People') {
      const g = pick(meta.gender, GENDER); if (g) attrs.push('g:' + g)
      const a = pick(meta.age, AGE); if (a) attrs.push('age:' + a)
      const e = pick(meta.ethnicity, ETH); if (e) attrs.push('eth:' + e)
      if (category === 'GEMINI') {
        const a2 = pick(meta.age, AGE)
        category = (a2 === 'child' || a2 === 'teen') ? 'Kids' : (pick(meta.gender, GENDER) === 'woman' ? 'Women' : 'Men')
      }
    } else if (type === 'Location') {
      const pl = pick(meta.place, PLACE); if (pl) attrs.push('place:' + pl)
      const t = pick(meta.time, TIME); if (t) attrs.push('time:' + t)
    } else if (type === 'Animal') {
      const ac = pick(meta.animal_class, ACLASS) || 'wild-mammals'
      attrs.push('class:' + ac)
      if (category === 'GEMINI') category = ACLASS_LABEL[ac]
    } else if (type === 'Creature') {
      if (category === 'GEMINI') category = CKIND_LABEL[pick(meta.creature_kind, CKIND) || 'beasts']
    } else if (type === 'Robot') {
      const rt = pick(meta.robot_type, RTYPE) || 'humanoid'
      attrs.push('rtype:' + rt)
      if (category === 'GEMINI') category = RTYPE_LABEL[rt]
    } else if (type === 'Vehicle') {
      const vk = String(meta.vehicle_kind || '').toLowerCase() === 'motorcycles' ? 'Motorcycles' : 'Cars'
      if (category === 'GEMINI') category = vk
      const vb = String(meta.vehicle_brand || '').toLowerCase().trim().replace(/\s+/g, '-')
      const vc = String(meta.vehicle_color || '').toLowerCase().trim().replace(/\s+/g, '-')
      if (vb && /^[a-z-]{2,20}$/.test(vb)) attrs.push('brand:' + vb)
      if (vc && /^[a-z-]{2,15}$/.test(vc)) attrs.push('color:' + vc)
    }

    const free = Array.isArray(meta.tags) ? (meta.tags as unknown[]).slice(0, 12).map(String) : []
    const tags = [...attrs, ...free]
    const title = String(meta.title || slug.replace(/-/g, ' ')).slice(0, 80)
    const safe = title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50) || 'asset'
    const storagePath = `${type.toLowerCase()}/${Date.now()}-${safe}.jpg`

    const { error: upErr } = await admin.storage.from('assets').upload(storagePath, buf, { contentType: 'image/jpeg', upsert: true })
    if (upErr) throw upErr
    const url = admin.storage.from('assets').getPublicUrl(storagePath).data.publicUrl

    const { data: inserted, error: dbErr } = await admin.from('assets').insert({
      title, type, category, plan: 'free', tags,
      description: String(meta.description || ''),
      file_url: url, thumbnail_url: url,
      is_public: !hidden,
    }).select('id,title,type,category,is_public').single()
    if (dbErr) throw dbErr

    return NextResponse.json({ ok: true, asset: inserted })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'ingest failed' }, { status: 500 })
  }
}
