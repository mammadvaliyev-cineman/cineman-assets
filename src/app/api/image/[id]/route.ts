import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 15

const ALLOWED = ['cineman-assets.vercel.app', 'cineman.ai', 'localhost']

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const referer = req.headers.get('referer') ?? ''
  const origin  = req.headers.get('origin')  ?? ''

  if (referer || origin) {
    const combined = referer + origin
    const ok = ALLOWED.some(h => combined.includes(h))
    if (!ok) return new NextResponse('Forbidden', { status: 403 })
  }

  const { data, error } = await supabase
    .from('assets')
    .select('thumbnail_url')
    .eq('id', params.id)
    .single()

  if (error || !data?.thumbnail_url) {
    return new NextResponse('Not found', { status: 404 })
  }

  let imgRes: Response
  try {
    imgRes = await fetch(data.thumbnail_url, { headers: { 'User-Agent': 'CinemanProxy/1.0' } })
  } catch {
    return new NextResponse('Image fetch failed', { status: 502 })
  }

  if (!imgRes.ok) return new NextResponse('Image unavailable', { status: 502 })

  const bytes = await imgRes.arrayBuffer()
  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=7200',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow',
      'Vary': 'Referer',
    },
  })
}
