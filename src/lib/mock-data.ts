export interface Asset {
  id: string
  title: string
  type: 'Video Clip' | 'LUT' | 'Sound Design' | 'Motion Graphics'
  category: string
  plan: 'starter' | 'pro' | 'enterprise'
  thumbnailUrl: string
  tags: string[]
}

export const allAssets: Asset[] = [
  { id: '1', title: 'Golden Hour Aerial City', type: 'Video Clip', category: 'Aerial', plan: 'starter', thumbnailUrl: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&q=80', tags: ['aerial', 'city', 'sunset'] },
  { id: '2', title: 'Neon Street Rain Loop', type: 'Video Clip', category: 'Street', plan: 'pro', thumbnailUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80', tags: ['street', 'rain', 'neon'] },
  { id: '3', title: 'Cinematic Teal & Orange LUT', type: 'LUT', category: 'Abstract', plan: 'starter', thumbnailUrl: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=800&q=80', tags: ['lut', 'color grade'] },
  { id: '4', title: 'Mountain Timelapse 4K', type: 'Video Clip', category: 'Nature', plan: 'pro', thumbnailUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800&q=80', tags: ['nature', 'mountain', 'timelapse'] },
  { id: '5', title: 'Glass Architecture Reflections', type: 'Video Clip', category: 'Architecture', plan: 'enterprise', thumbnailUrl: 'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=800&q=80', tags: ['architecture', 'glass'] },
  { id: '6', title: 'Abstract Particle Flow', type: 'Motion Graphics', category: 'Abstract', plan: 'pro', thumbnailUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80', tags: ['particles', 'abstract'] },
  { id: '7', title: 'Desert Drone Sweep', type: 'Video Clip', category: 'Aerial', plan: 'starter', thumbnailUrl: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=800&q=80', tags: ['desert', 'aerial', 'drone'] },
  { id: '8', title: 'Cinematic Ambient Score', type: 'Sound Design', category: 'Abstract', plan: 'pro', thumbnailUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800&q=80', tags: ['sound', 'ambient'] },
  { id: '9', title: 'Urban Rooftop Bokeh', type: 'Video Clip', category: 'Street', plan: 'enterprise', thumbnailUrl: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800&q=80', tags: ['urban', 'bokeh'] },
  { id: '10', title: 'Futuristic HUD Overlay', type: 'Motion Graphics', category: 'Abstract', plan: 'enterprise', thumbnailUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&q=80', tags: ['hud', 'futuristic'] },
  { id: '11', title: 'Autumn Forest Walk', type: 'Video Clip', category: 'Nature', plan: 'starter', thumbnailUrl: 'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?w=800&q=80', tags: ['nature', 'forest'] },
  { id: '12', title: 'Action Sports Slowmo', type: 'Video Clip', category: 'Action', plan: 'pro', thumbnailUrl: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=800&q=80', tags: ['action', 'sports'] },
]

export const featuredAssets = allAssets.slice(0, 6)
