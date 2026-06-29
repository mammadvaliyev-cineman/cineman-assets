import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SIGNED_URL_EXPIRY = 60 // seconds

export async function POST(request: NextRequest) {
  try {
    const { assetId, filePath } = await request.json()
    if (!assetId || !filePath) {
      return NextResponse.json({ error: 'Missing assetId or filePath' }, { status: 400 })
    }

    // TODO: add real auth check here
    // For now, verify the asset exists in the DB
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: asset, error: assetErr } = await admin
      .from('assets')
      .select('id, plan, file_url')
      .eq('id', assetId)
      .single()

    if (assetErr || !asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Generate signed URL (works with private bucket)
    const { data, error } = await admin.storage
      .from('assets')
      .createSignedUrl(filePath, SIGNED_URL_EXPIRY)

    if (error || !data) {
      return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
    }

    return NextResponse.json({ url: data.signedUrl, expiresIn: SIGNED_URL_EXPIRY })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
