import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { filePath } = await req.json()

    if (!filePath) {
      return NextResponse.json({ error: 'No file path provided' }, { status: 400 })
    }

    // filePath is the full public Supabase Storage URL.
    // Bucket is public — return it directly as the download URL.
    return NextResponse.json({ url: filePath })
  } catch (err) {
    console.error('Download error:', err)
    return NextResponse.json({ error: 'Could not generate download link' }, { status: 500 })
  }
}
