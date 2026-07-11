// ─────────────────────────────────────────────────────────────
// DROPBOX AS THE ORIGINALS STORE (owner's decision): originals
// stay in the owner's Dropbox (AI BASE); Supabase keeps the
// compressed copies as catalog previews. Downloads hand out a
// short-lived direct link via files/get_temporary_link.
// Auth: PKCE app (no secret) — refresh with client_id only.
// env: DROPBOX_APP_KEY, DROPBOX_REFRESH_TOKEN
// ─────────────────────────────────────────────────────────────

let cachedToken: { token: string; exp: number } | null = null

export async function dropboxAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.exp - 60_000) return cachedToken.token
  const key = process.env.DROPBOX_APP_KEY
  const refresh = process.env.DROPBOX_REFRESH_TOKEN
  if (!key || !refresh) throw new Error('Dropbox env not configured')
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: key }),
  })
  if (!res.ok) throw new Error(`Dropbox token ${res.status}: ${(await res.text()).slice(0, 120)}`)
  const j = await res.json()
  cachedToken = { token: j.access_token, exp: Date.now() + (Number(j.expires_in ?? 14400) * 1000) }
  return cachedToken.token
}

// Temporary direct download link (valid ~4h), by immutable file id —
// renames/moves inside Dropbox never break it
export async function dropboxTempLink(dropboxId: string): Promise<string> {
  const token = await dropboxAccessToken()
  const res = await fetch('https://api.dropboxapi.com/2/files/get_temporary_link', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ path: dropboxId }),
  })
  if (!res.ok) throw new Error(`Dropbox link ${res.status}: ${(await res.text()).slice(0, 120)}`)
  const j = await res.json()
  return String(j.link)
}

// List every image in the account (recursive), returning slug → id.
// Slug mirrors the ingest's srcSlug: basename, lowercased, non-alnum → '-'
export async function dropboxListImages(): Promise<Map<string, { id: string; path: string }>> {
  const token = await dropboxAccessToken()
  const out = new Map<string, { id: string; path: string }>()
  let cursor: string | null = null
  const firstBody: Record<string, unknown> = { path: '', recursive: true, limit: 2000 }
  let url = 'https://api.dropboxapi.com/2/files/list_folder'
  for (let i = 0; i < 30; i++) {
    const res: Response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(cursor ? { cursor } : firstBody),
    })
    if (!res.ok) throw new Error(`Dropbox list ${res.status}: ${(await res.text()).slice(0, 120)}`)
    const j: { entries?: Array<Record<string, unknown>>; has_more?: boolean; cursor?: string } = await res.json()
    for (const e of j.entries ?? []) {
      if ((e as Record<string, unknown>)['.tag'] !== 'file') continue
      const name = String(e.name)
      if (!/\.(png|jpe?g|webp)$/i.test(name)) continue
      const slug = name.toLowerCase().replace(/\.[^.]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      out.set(slug, { id: String(e.id), path: String(e.path_lower) })
    }
    if (!j.has_more) break
    cursor = String(j.cursor)
    url = 'https://api.dropboxapi.com/2/files/list_folder/continue'
  }
  return out
}
