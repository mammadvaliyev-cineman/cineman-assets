import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function supabaseAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key'
  return createClient(supabaseUrl, serviceKey)
}

export async function getAssets(category?: string) {
  let query = supabase.from('assets').select('*').order('created_at', { ascending: false })
  if (category) {
    query = query.eq('category', category)
  }
  const { data, error } = await query
  if (error) throw error
  return data
}
