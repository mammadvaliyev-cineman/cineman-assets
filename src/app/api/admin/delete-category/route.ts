import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// DELETE WHOLE CATEGORY — admin-gated, service-role.
// GET                → list of real categories with asset counts
// GET ?category=X    → dry-run: how many rows/files would go
// POST {category: X} → delete every asset in X (DB rows + Storage)
// System rows (Config/Usage/Generation) are never touched.
// ─────────────────────────────────────────────────────────────

const SYSTEM_TYPES = ['Config', 'Usage', 'Generation']

type Row = { id: string; title: string | null; type: string | null; category: string | null; file_url: string | null; thumbnail_url: string | null }

async function fetchAll(category?: string): Promise<Row[]> {
  const admin = supabaseAdmin()
  const rows: Row[] = []
  const PAGE = 1000
  for (let from = 0; from < 20000; from += PAGE) {
    let q = admin
      .from('assets')
      .select('id,title,type,category,file_url,thumbnail_url')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1)
    if (category) q = q.eq('category', category)
    const { data, error } = await q
    if (error) throw error
    const batch = ((data || []) as Row[]).filter(r => !SYSTEM_TYPES.includes(r.type || ''))
    rows.push(...batch)
    if (!data || data.length < PAGE) break
  }
  return rows
}

function storagePaths(rows: Row[]): string[] {
  const paths: string[] = []
  for (const r of rows) {
    for (const url of [r.file_url, r.thumbnail_url]) {
      if (typeof url === 'string' && url.includes('/assets/')) {
        const p = url.split('/assets/')[1]
        if (p && !p.startsWith('config')) paths.push(p)
      }
    }
  }
  return Array.from(new Set(paths))
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const category = req.nextUrl.searchParams.get('category') || undefined
    if (!category) {
      const rows = await fetchAll()
      const counts: Record<string, number> = {}
      for (const r of rows) {
        const c = r.category || '(none)'
        counts[c] = (counts[c] || 0) + 1
      }
      const categories = Object.entries(counts)
        .map(([cat, count]) => ({ category: cat, count }))
        .sort((a, b) => a.category.localeCompare(b.category))
      return NextResponse.json({ categories })
    }
    const rows = await fetchAll(category)
    return NextResponse.json({
      dryRun: true,
      category,
      assets: rows.length,
      storageFiles: storagePaths(rows).length,
      sample: rows.slice(0, 20).map(r => ({ id: r.id, title: r.title, type: r.type })),
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const { category } = await req.json()
    if (!category || typeof category !== 'string') {
      return NextResponse.json({ error: 'category is required' }, { status: 400 })
    }
    const admin = supabaseAdmin()
    const rows = await fetchAll(category)
    if (rows.length === 0) return NextResponse.json({ deleted: 0, storageRemoved: 0 })

    // Storage first (best-effort, batches of 100), then the DB rows
    const paths = storagePaths(rows)
    let storageRemoved = 0
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100)
      const { data } = await admin.storage.from('assets').remove(chunk)
      storageRemoved += (data || []).length
    }

    let deleted = 0
    const ids = rows.map(r => r.id)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { error } = await admin.from('assets').delete().in('id', chunk)
      if (!error) deleted += chunk.length
    }

    return NextResponse.json({ deleted, storageRemoved, category })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
