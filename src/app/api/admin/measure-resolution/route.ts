import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// REAL RESOLUTION (polish §3): read actual pixel dimensions from
// the file header (PNG IHDR / JPEG SOF / WebP VP8x) — no full
// download, just the first bytes via Range. Longest side ≥3200px
// → '4K', else '2K'. Price follows resolution (4K = ×2).
// GET = dry-run counts, POST = apply one batch (repeat till 0).
// A 'resd' marker in the row is avoided: measured rows are those
// whose resolution differs OR the unmeasured majority default —
// we track via resolution_measured tag-free approach: re-running
// is cheap and idempotent (same result), so POST just walks rows
// ordered by created_at with an offset cursor in the query param.
// ─────────────────────────────────────────────────────────────

function parseDims(buf: Buffer): { w: number; h: number } | null {
  // PNG
  if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  // JPEG: scan for SOF0/1/2 markers
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      }
      const len = buf.readUInt16BE(i + 2)
      i += 2 + len
    }
  }
  // WebP VP8X / VP8 / VP8L
  if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    const fourcc = buf.toString('ascii', 12, 16)
    if (fourcc === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) }
    if (fourcc === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff }
  }
  return null
}

async function run(startFrom: number) {
  const admin = supabaseAdmin()
  const started = Date.now()
  let measured = 0, to4k = 0, failed = 0
  const WINDOW = 400
  const { data, error } = await admin.from('assets')
    .select('id, file_url, resolution')
    .not('type', 'in', '("Config","Generation","Usage")')
    .order('created_at', { ascending: true })
    .range(startFrom, startFrom + WINDOW - 1)
  if (error || !data) return { measured, to4k, failed, nextFrom: -1 }
  let idx = 0
  // measure in parallel chunks of 12 — header fetches are tiny
  for (; idx < data.length; idx += 12) {
    if (Date.now() - started > 42000) break
    const chunk = data.slice(idx, idx + 12)
    await Promise.all(chunk.map(async row => {
      const url = String(row.file_url || '')
      if (!url.includes('/storage/v1/object/public/')) return
      try {
        const res = await fetch(url, { headers: { Range: 'bytes=0-131071' } })
        if (!res.ok && res.status !== 206) { failed++; return }
        const buf = Buffer.from(await res.arrayBuffer())
        const dims = parseDims(buf)
        if (!dims) { failed++; return }
        const wanted = Math.max(dims.w, dims.h) >= 3200 ? '4K' : '2K'
        measured++
        if (wanted === '4K') to4k++
        if (wanted !== row.resolution) {
          await admin.from('assets').update({ resolution: wanted }).eq('id', row.id)
        }
      } catch { failed++ }
    }))
  }
  const done = data.length < WINDOW && idx >= data.length
  return { measured, to4k, failed, nextFrom: done ? -1 : startFrom + idx }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const admin = supabaseAdmin()
  const { count: total } = await admin.from('assets').select('id', { count: 'exact', head: true }).not('type', 'in', '("Config","Generation","Usage")')
  const { count: fourK } = await admin.from('assets').select('id', { count: 'exact', head: true }).eq('resolution', '4K')
  return NextResponse.json({ total, fourK })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  const from = Math.max(0, Number(req.nextUrl.searchParams.get('from') ?? 0))
  return NextResponse.json(await run(from))
}
