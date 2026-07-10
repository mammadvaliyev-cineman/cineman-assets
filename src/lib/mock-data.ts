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
  exclusivePrice?: number // exclusive buyout price in credits (default 50)
}

// No mock data — all assets come from Supabase
export const MOCK_ASSETS: Asset[] = []
