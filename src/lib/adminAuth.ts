import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ─────────────────────────────────────────────────────────────
// ADMIN AUTH — server-side gate for every write operation.
// The client sends its Supabase session token; we verify it with
// the service role and check the email against the allowlist.
// Emails are not secrets, so the list can live in code.
// ─────────────────────────────────────────────────────────────

export const ADMIN_EMAILS = ['mammadvaliyev@gmail.com']

export async function requireAdmin(req: NextRequest): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return { ok: false, error: 'Sign in required', status: 401 }
  try {
    const admin = supabaseAdmin()
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) return { ok: false, error: 'Invalid session', status: 401 }
    const email = (data.user.email || '').toLowerCase()
    if (!ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email)) {
      return { ok: false, error: 'Admin access only', status: 403 }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Auth check failed', status: 500 }
  }
}

// Any signed-in user (for user-facing writes like own uploads)
export async function requireUser(req: NextRequest): Promise<{ ok: true; userId: string; email: string | null } | { ok: false; error: string; status: number }> {
  const auth = req.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token) return { ok: false, error: 'Sign in required', status: 401 }
  try {
    const admin = supabaseAdmin()
    const { data, error } = await admin.auth.getUser(token)
    if (error || !data.user) return { ok: false, error: 'Invalid session', status: 401 }
    return { ok: true, userId: data.user.id, email: data.user.email ?? null }
  } catch {
    return { ok: false, error: 'Auth check failed', status: 500 }
  }
}

// A-batch: admin accounts never spend credits (unlimited testing).
// Emails are not secrets; the allowlist above is the source of truth.
export const isAdminEmail = (e?: string | null): boolean =>
  !!e && ADMIN_EMAILS.map(x => x.toLowerCase()).includes(e.toLowerCase())
