#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────
// CINEMAN BULK INGEST — Dropbox folder → Supabase asset base
// Usage:
//   node scripts/ingest.mjs "/Users/you/Dropbox/AI BASE"
// Requires .env.local with:
//   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY
// Resumable: progress saved to scripts/.ingest-log.json — safe to
// stop and re-run. Gemini Flash tags each image (~$0.0002/image).
// ─────────────────────────────────────────────────────────────

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// ── env ──────────────────────────────────────────────────────
function loadEnv() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
    }
  }
}
loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const GEMINI_KEY = process.env.GEMINI_API_KEY
if (!SUPABASE_URL || !SERVICE_KEY || !GEMINI_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY (put them in .env.local)')
  process.exit(1)
}

const ROOT = process.argv[2]
if (!ROOT || !fs.existsSync(ROOT)) {
  console.error('Usage: node scripts/ingest.mjs "/path/to/AI BASE"')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const LOG_PATH = path.join(process.cwd(), 'scripts', '.ingest-log.json')
const done = fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')) : {}
const saveLog = () => fs.writeFileSync(LOG_PATH, JSON.stringify(done))

// ── folder name → asset type ─────────────────────────────────
function typeFromPath(p) {
  const s = p.toLowerCase()
  if (s.includes('character')) return 'Character'
  if (s.includes('location')) return 'Location'
  if (s.includes('vehicle')) return 'Vehicle'
  if (s.includes('prop')) return 'Prop'
  return 'Location'
}

// ── Gemini tagging (same contract as /api/ai-name) ───────────
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const PROMPT = `You are a professional cinematographer analyzing images for a cinematic asset library. Study the image and return ONLY valid JSON (no markdown):
{"title":"Precise cinematic title, 4-6 words, Title Case","type":"Location or Character","category":"One word: Urban|Nature|Portrait|Aerial|Interior|Desert|Forest|Industrial|Coastal|Mountain|Sci-Fi|Fantasy|Street|Architecture|Underwater|Studio","description":"2-3 sentence cinematic description of exactly what is in frame","tags":["8 specific lowercase tags: subject, style, lighting, mood, color, genre, texture, environment"]}`

async function tagImage(buf, mime) {
  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: mime, data: buf.toString('base64') } }, { text: PROMPT }] }],
      generationConfig: { temperature: 0.4, maxOutputTokens: 512 },
    }),
  })
  const json = await res.json()
  const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || ''
  return JSON.parse(raw.replace(/```json|```/g, '').trim())
}

// ── walk files ───────────────────────────────────────────────
function* walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) yield* walk(full)
    else if (/\.(png|jpe?g|webp)$/i.test(e.name)) yield full
  }
}

const files = [...walk(ROOT)]
console.log(`Found ${files.length} images. Already done: ${Object.keys(done).length}`)

let ok = 0, fail = 0
for (const [i, file] of files.entries()) {
  const rel = path.relative(ROOT, file)
  if (done[rel]) continue
  try {
    const buf = fs.readFileSync(file)
    const mime = file.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    const type = typeFromPath(rel)

    let meta
    try {
      meta = await tagImage(buf, mime)
    } catch {
      meta = { title: path.basename(file, path.extname(file)).replace(/[-_]/g, ' ').slice(0, 60), category: type, description: '', tags: [] }
    }

    const safe = (meta.title || 'asset').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const storagePath = `${type.toLowerCase()}/${Date.now()}-${safe}${path.extname(file).toLowerCase()}`

    const { error: upErr } = await supabase.storage.from('assets').upload(storagePath, buf, { contentType: mime, upsert: false })
    if (upErr) throw upErr
    const url = supabase.storage.from('assets').getPublicUrl(storagePath).data.publicUrl

    const { error: dbErr } = await supabase.from('assets').insert({
      title: meta.title || 'Untitled',
      type,
      category: meta.category || type,
      plan: 'free',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      description: meta.description || '',
      file_url: url,
      thumbnail_url: url,
    })
    if (dbErr) throw dbErr

    done[rel] = true
    ok++
    if (ok % 10 === 0) saveLog()
    console.log(`[${i + 1}/${files.length}] OK  ${meta.title}`)
    await new Promise(r => setTimeout(r, 350)) // rate limit
  } catch (err) {
    fail++
    console.error(`[${i + 1}/${files.length}] FAIL ${rel}: ${err.message}`)
  }
}
saveLog()
console.log(`\nDone. Uploaded: ${ok}, failed: ${fail}, total logged: ${Object.keys(done).length}`)

