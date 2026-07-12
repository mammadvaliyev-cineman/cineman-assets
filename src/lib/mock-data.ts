export type Asset = {
  id: string
  title: string
  type: 'photo' | 'video' | 'Video Clip' | 'LUT' | 'Sound Design' | 'Motion Graphics'
  category: string
  url: string
  thumbnail: string
  plan: 'starter' | 'pro' | 'enterprise'
  tags: string[]
  fileUrl?: string // storage path for signed URL generation
  creditCost?: number // download price in credits (default 5)
  exclusivePrice?: number // exclusive buyout price in credits (default = tier)
  priceTier?: string // 'standard' | 'premium' | 'exclusive' — pricing_defaults key
  resolution?: string // '2K' | '4K' — 4K doubles the download price
  downloadCount?: number // popularity — for the «Most downloaded» sort
  exclusiveOwner?: string | null // uuid — set = exclusively sold (asset stays in catalog, locked)
  exclusiveSoldAt?: string | null
}

// No mock data — all assets come from Supabase
export const MOCK_ASSETS: Asset[] = []
