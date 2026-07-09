import { supabaseAdmin } from '@/lib/supabase'
import { ADMIN_EMAILS } from '@/lib/adminAuth'

// ─────────────────────────────────────────────────────────────
// USAGE / QUOTA — protects the ModelArk budget. Daily render caps
// per user, stored as a Config-style row in the assets table
// (type='Usage', title='<userId>:<YYYY-MM-DD>', description=count)
// so no DB migration is needed. Admin is unlimited.
// ─────────────────────────────────────────────────────────────

export type Plan = 'free' | 'basic' | 'pro' | 'ultra'

// Daily render limits per plan (draft or final each count as 1)
export const DAILY_LIMITS: Record<Plan, number> = {
  free: 3,
  basic: 30,
  pro: 100,
  ultra: 400,
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// Plan lookup — for now everyone is 'free' until subscriptions
// (LemonSqueezy) are wired in. Admin bypasses limits entirely.
export async function getUserPlan(email: string | null): Promise<Plan | 'admin'> {
  if (email && ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase())) return 'admin'
  return 'free'
}

export type UsageInfo = { used: number; limit: number; remaining: number; plan: Plan | 'admin' }

export async function checkUsage(userId: string, email: string | null): Promise<UsageInfo> {
  const plan = await getUserPlan(email)
  if (plan === 'admin') return { used: 0, limit: Infinity, remaining: Infinity, plan }
  const admin = supabaseAdmin()
  const key = `${userId}:${today()}`
  const { data } = await admin
    .from('assets')
    .select('description')
    .eq('type', 'Usage')
    .eq('title', key)
    .limit(1)
  const used = data?.[0]?.description ? Number(data[0].description) || 0 : 0
  const limit = DAILY_LIMITS[plan]
  return { used, limit, remaining: Math.max(0, limit - used), plan }
}

// Atomically-ish increment the day's counter (best-effort; the
// window between read and write is negligible for per-user caps).
export async function incrementUsage(userId: string): Promise<void> {
  const admin = supabaseAdmin()
  const key = `${userId}:${today()}`
  const { data } = await admin
    .from('assets')
    .select('id,description')
    .eq('type', 'Usage')
    .eq('title', key)
    .limit(1)
  const next = (data?.[0]?.description ? Number(data[0].description) || 0 : 0) + 1
  if (data?.length) {
    await admin.from('assets').update({ description: String(next) }).eq('id', data[0].id)
  } else {
    await admin.from('assets').insert({
      title: key,
      type: 'Usage',
      category: 'System',
      plan: 'free',
      tags: ['usage'],
      description: String(next),
      file_url: 'usage://counter',
      thumbnail_url: 'usage://counter',
    })
  }
}
