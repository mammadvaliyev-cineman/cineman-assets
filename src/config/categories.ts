// ─────────────────────────────────────────────────────────────
// CINEMAN AI — Category Taxonomy (mirrors the Dropbox AI BASE)
// Top level = asset type (one folder = one type), subcategories =
// the folders inside. DEFAULTS live here; the ADMIN can edit the
// live taxonomy at /admin → Categories (stored in Supabase via
// /api/categories) without touching code.
// ─────────────────────────────────────────────────────────────

export type Subcategory = { id: string; label: string }

export type Category = {
  id: string          // stored in DB — never rename existing ids
  label: string
  emoji: string       // legacy field, admin/catalog render SVG icons
  color: string
  subcategories: Subcategory[]
}

const sub = (label: string): Subcategory => ({
  id: label.toLowerCase().replace(/\s*&\s*/g, '-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
  label,
})

export const CATEGORIES: Category[] = [
  {
    id: 'People',
    label: 'People',
    emoji: '',
    color: '#CE95FB',
    subcategories: ['Men', 'Women', 'Kids'].map(sub),
  },
  {
    id: 'Animal',
    label: 'Animals',
    emoji: '',
    color: '#00C264',
    subcategories: [
      'Pets', 'Predators', 'Wild Mammals', 'Birds', 'Fish & Sea', 'Insects', 'Reptiles',
    ].map(sub),
  },
  {
    id: 'Creature',
    label: 'Creatures',
    emoji: '',
    color: '#DC5050',
    subcategories: ['Monsters', 'Aliens', 'Dinosaurs', 'Beasts'].map(sub),
  },
  {
    id: 'Robot',
    label: 'Robots',
    emoji: '',
    color: '#00C2BA',
    subcategories: ['Humanoid', 'Android', 'Mech', 'Endoskeleton'].map(sub),
  },
  {
    id: 'Location',
    label: 'Locations',
    emoji: '',
    color: '#9765E0',
    subcategories: [
      'Bathrooms', 'Bedrooms', 'Cafes & Bars', 'Grand & Palaces', 'Hospitals & Labs',
      'Industrial & Garages', 'Kitchens & Dining', 'Landmarks', 'Libraries',
      'Living Rooms', 'Misc', 'Nature', 'Offices', 'Parks & Outdoor',
      'Post-Apocalyptic', 'Rural & Farms', 'Salons & Services', 'Schools',
      'Sci-Fi & Space', 'Shops', 'Sports & Gyms', 'Streets & City',
      'Studios & Media', 'Transport',
    ].map(sub),
  },
  {
    id: 'Vehicle',
    label: 'Vehicles',
    emoji: '',
    color: '#534FA5',
    subcategories: [
      'Cars', 'Trucks', 'Aircraft', 'Spacecraft', 'Boats', 'Military', 'Futuristic',
    ].map(sub),
  },
  {
    id: 'Prop',
    label: 'Props',
    emoji: '',
    color: '#00C2BA',
    subcategories: [
      'Weapons', 'Technology', 'Furniture', 'Clothing', 'Food', 'Misc',
    ].map(sub),
  },
]

// ── Visual style of the asset ───────────────────────────────
export const STYLES = [
  'Cinematic',
  'Photorealistic',
  'Stylized',
  'Concept Art',
  'Noir',
  'Futuristic',
  'Historical',
  'Documentary',
  'Minimalist',
]

// ── Emotional tone / atmosphere ─────────────────────────────
export const MOODS = [
  'Dark / Dramatic',
  'Warm / Golden',
  'Cold / Blue',
  'Foggy / Misty',
  'Neon / Night',
  'Bright / Airy',
  'Epic / Grand',
  'Minimal / Clean',
  'Tense / Thriller',
]

// ── Lighting conditions ─────────────────────────────────────
export const LIGHTING = [
  'Golden Hour',
  'Natural',
  'Night',
  'Studio',
  'Neon',
  'Overcast',
  'Backlit',
  'Blue Hour',
  'Harsh Sun',
]

// ── Helpers ─────────────────────────────────────────────────
export function getCategoryById(id: string): Category | undefined {
  return CATEGORIES.find(c => c.id === id)
}

export function getSubcategoriesFor(categoryId: string): Subcategory[] {
  return getCategoryById(categoryId)?.subcategories ?? []
}

export function makeSubcategory(label: string): Subcategory {
  return sub(label)
}
