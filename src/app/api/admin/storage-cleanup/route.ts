import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// STORAGE ↔ CATALOG SYNC — admin-gated.
// GET  → dry-run report:
//   orphans — files in the bucket that NO asset row references
//             (neither file_url nor thumbnail_url). Safe to delete.
//   broken  — asset rows whose file_url points to a missing file.
// POST {confirm:true} → delete the orphan files (batches of 100).
// Rows are NEVER touched here; config/ paths are never touched.
// Logic adapted from the owner's storage_cleanup.mjs.
// ─────────────────────────────────────────────────────────────

const BUCKET = 'assets'

async function listAllFiles(prefix = ''): Promise<Array<{ path: string; size: number }>> {
  const admin = supabaseAdmin()
  const out: Array<{ path: string; size: number }> = []
  let page = 0
  for (;;) {
    const { data, error } = await admin.storage.from(BUCKET)
      .list(prefix, { limit: 1000, offset: page * 1000 })
    if (error) throw error
    if (!data || data.length === 0) break
    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name
      if ((item as { id?: string | null }).id == null || item.metadata == null) {
        out.push(...await listAllFiles(path)) // folder — recurse
      } else {
        const size = Number((item.metadata as { size?: number })?.size || 0)
        out.push({ path, size })
      }
    }
    if (data.length < 1000) break
    page++
  }
  return out
}

// Referenced storage paths extracted from file_url / thumbnail_url
// of EVERY row (hidden included — hidden must keep its files!)
async function referencedPaths(): Promise<Set<string>> {
  const admin = supabaseAdmin()
  const refs = new Set<string>()
  const rows: Array<{ file_url: string | null; thumbnail_url: string | null }> = []
  for (let from = 0; from < 50000; from += 1000) {
    const { data, error } = await admin.from('assets')
      .select('file_url, thumbnail_url').range(from, from + 999)
    if (error) throw error
    rows.push(...((data || []) as typeof rows))
    if (!data || data.length < 1000) break
  }
  for (const r of rows) {
    for (const u of [r.file_url, r.thumbnail_url]) {
      if (typeof u === 'string' && u.includes(`/${BUCKET}/`)) {
        const p = u.split(`/${BUCKET}/`)[1]?.split('?')[0]
        if (p) refs.add(decodeURIComponent(p))
      }
    }
  }
  return refs
}

async function report() {
  const [entries, refs] = await Promise.all([listAllFiles(), referencedPaths()])
  const files = entries.map(e => e.path)
  const fileSet = new Set(files)
  const orphans = files.filter(p => !refs.has(p) && !p.startsWith('config'))
  const broken = Array.from(refs).filter(p => !fileSet.has(p) && !p.startsWith('config'))
  return { filesInBucket: files.length, referenced: refs.size, orphans, broken }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    // ?sizes=1 → map of storage path → bytes (for the admin table sort)
    if (req.nextUrl.searchParams.get('sizes')) {
      const entries = await listAllFiles()
      const sizes: Record<string, number> = {}
      for (const e of entries) sizes[e.path] = e.size
      return NextResponse.json({ sizes })
    }
    const r = await report()
    return NextResponse.json({
      dryRun: true,
      filesInBucket: r.filesInBucket,
      referenced: r.referenced,
      orphanCount: r.orphans.length,
      brokenCount: r.broken.length,
      orphans: r.orphans.slice(0, 300),
      broken: r.broken.slice(0, 100),
      note: 'POST {"confirm":true} removes orphans from Storage. Catalog rows are untouched.',
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const body = await req.json().catch(() => ({}))
    if (body.confirm !== true) {
      return NextResponse.json({ error: 'Pass {"confirm":true} to delete orphans' }, { status: 400 })
    }
    const admin = supabaseAdmin()
    const r = await report()
    let deleted = 0
    for (let i = 0; i < r.orphans.length; i += 100) {
      const batch = r.orphans.slice(i, i + 100)
      const { error } = await admin.storage.from(BUCKET).remove(batch)
      if (error) throw error
      deleted += batch.length
    }
    return NextResponse.json({ applied: true, deleted, brokenLeft: r.broken.length })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
