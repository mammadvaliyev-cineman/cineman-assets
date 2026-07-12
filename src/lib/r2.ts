import { createHmac, createHash } from 'crypto'

// ─────────────────────────────────────────────────────────────
// Cloudflare R2 — presigned GET links, zero dependencies.
// Originals live in a private R2 bucket; the download route hands
// out a short-lived signed URL ONLY after credits are spent.
// Previews stay on Supabase (render/image transforms need it).
//
// Env (Vercel): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
//               R2_SECRET_ACCESS_KEY, R2_BUCKET
// Secrets are never in the repo — it's public.
// ─────────────────────────────────────────────────────────────

const REGION = 'auto' // R2 uses "auto" for SigV4

export function r2Configured(): boolean {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET
  )
}

// RFC 3986 encoding (what SigV4 expects) — encodeURIComponent plus !'()*
function enc(s: string): string {
  return encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256hex(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex')
}

/**
 * Presigned GET for a private R2 object (AWS SigV4, query-string auth).
 * @param key      object key in the bucket, e.g. "orig/brave-firefighter-portrait.png"
 * @param filename pretty filename for the browser's Save dialog
 * @param expires  link lifetime in seconds (default 300 — long enough to
 *                 start the download, short enough not to be shareable)
 */
export function presignR2Get(key: string, filename?: string, expires = 300): string {
  const accountId = process.env.R2_ACCOUNT_ID!
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket = process.env.R2_BUCKET!

  const host = `${accountId}.r2.cloudflarestorage.com`
  // Path-style: /<bucket>/<key> — encode each segment, keep the slashes
  const canonicalUri = '/' + [bucket, ...key.split('/')].map(enc).join('/')

  const now = new Date()
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '') // YYYYMMDDTHHMMSSZ
  const date = amzDate.slice(0, 8)
  const scope = `${date}/${REGION}/s3/aws4_request`

  const params: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${accessKey}/${scope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expires),
    'X-Amz-SignedHeaders': 'host',
  }
  if (filename) {
    // Forces a download with a human filename instead of the storage key
    params['response-content-disposition'] = `attachment; filename="${filename.replace(/["\\]/g, '')}"`
  }

  const canonicalQuery = Object.keys(params)
    .sort()
    .map(k => `${enc(k)}=${enc(params[k])}`)
    .join('&')

  const canonicalRequest = [
    'GET',
    canonicalUri,
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonicalRequest)].join('\n')

  const kDate = hmac('AWS4' + secretKey, date)
  const kRegion = hmac(kDate, REGION)
  const kService = hmac(kRegion, 's3')
  const kSigning = hmac(kService, 'aws4_request')
  const signature = createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex')

  return `https://${host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`
}

/**
 * Server-side PUT into the private bucket (header-based SigV4).
 * Used by the 2K→4K upscale to cache Topaz results next to originals —
 * the first buyer pays for the render, everyone after gets the cache.
 */
export async function r2Put(key: string, body: Buffer | Uint8Array, contentType = 'image/png'): Promise<void> {
  const accountId = process.env.R2_ACCOUNT_ID!
  const accessKey = process.env.R2_ACCESS_KEY_ID!
  const secretKey = process.env.R2_SECRET_ACCESS_KEY!
  const bucket = process.env.R2_BUCKET!

  const host = `${accountId}.r2.cloudflarestorage.com`
  const uri = '/' + [bucket, ...key.split('/')].map(enc).join('/')
  const amzDate = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const date = amzDate.slice(0, 8)
  const payloadHash = createHash('sha256').update(body).digest('hex')
  const headers: Record<string, string> = {
    'content-type': contentType,
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  }
  const signed = Object.keys(headers).sort()
  const canonical = ['PUT', uri, '', ...signed.map(h => `${h}:${headers[h]}`), '', signed.join(';'), payloadHash].join('\n')
  const scope = `${date}/${REGION}/s3/aws4_request`
  const sts = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n')
  const kSigning2 = hmac(hmac(hmac(hmac('AWS4' + secretKey, date), REGION), 's3'), 'aws4_request')
  const sig = createHmac('sha256', kSigning2).update(sts, 'utf8').digest('hex')
  const res = await fetch(`https://${host}${uri}`, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${sig}`,
    },
    body: new Uint8Array(body),
  })
  if (!res.ok) throw new Error('r2 put ' + res.status + ' ' + (await res.text()).slice(0, 120))
}
