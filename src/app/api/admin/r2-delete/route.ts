import { NextRequest, NextResponse } from 'next/server'
import { createHmac, createHash } from 'crypto'
import { requireAdmin } from '@/lib/adminAuth'
import { r2Configured } from '@/lib/r2'

export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// ADMIN: delete objects from the private R2 bucket (dupes cleanup).
// POST { keys: string[] } → SigV4 DELETE per key. Admin-only.
// ─────────────────────────────────────────────────────────────

const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())

async function r2Delete(key: string): Promise<boolean> {
  const accountId = process.env.R2_ACCOUNT_ID!
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket = process.env.R2_BUCKET!
  const host = `${accountId}.r2.cloudflarestorage.com`
  const uri = '/' + [bucket, ...key.split('/')].map(enc).join('/')
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const date = amzDate.slice(0, 8)
  const payloadHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  const headers: Record<string, string> = { host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate }
  const signed = Object.keys(headers).sort()
  const canonical = ['DELETE', uri, '', ...signed.map(h => `${h}:${headers[h]}`), '', signed.join(';'), payloadHash].join('\n')
  const scope = `${date}/auto/s3/aws4_request`
  const sts = ['AWS4-HMAC-SHA256', amzDate, scope, createHash('sha256').update(canonical).digest('hex')].join('\n')
  const hm = (k: Buffer | string, d: string) => createHmac('sha256', k).update(d).digest()
  const sig = createHmac('sha256', hm(hm(hm(hm('AWS4' + secretKey, date), 'auto'), 's3'), 'aws4_request')).update(sts).digest('hex')
  const res = await fetch(`https://${host}${uri}`, {
    method: 'DELETE',
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${sig}`,
    },
  })
  return res.ok || res.status === 404
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  if (!r2Configured()) return NextResponse.json({ error: 'R2 is not configured' }, { status: 503 })
  try {
    const { keys } = await req.json()
    if (!Array.isArray(keys) || keys.length === 0 || keys.length > 200) {
      return NextResponse.json({ error: '1..200 keys required' }, { status: 400 })
    }
    const results: Record<string, boolean> = {}
    for (const k of keys) results[String(k)] = await r2Delete(String(k))
    return NextResponse.json({ ok: true, results })
  } catch {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }
}
