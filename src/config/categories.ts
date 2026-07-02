// ─────────────────────────────────────────────────────────────
// CINEMAN AI — Full Category Taxonomy
// Single source of truth for categories, subcategories, styles, moods, lighting.
// Used in: Admin batch upload, Catalog filters, Asset cards.
// ─────────────────────────────────────────────────────────────

export type Subcategory = { id: string; label: string }

export type Category = {
  id: string          // stored in DB — never rename existing ids
  label: string
  emoji: string
  color: string
  subcategories: Subcategory[]
}

export const CATEGORIES: Category[] = [
  {
    id: 'Character',
    label: 'Characters',
    emoji: '🎭',
    color: '#CE95FB',
    subcategories: [
      { id: 'portrait',  label: 'Portrait'   },
      { id: 'full-body', label: 'Full Body'  },
      { id: 'group',     label: 'Group'      },
      { id: 'action',    label: 'Action'     },
      { id: 'fantasy',   label: 'Fantasy'    },
      { id: 'sci-fi',    label: 'Sci-Fi'     },
      { id: 'historical',label: 'Historical' },
    ],
  },
  {
    id: 'Location',
    label: 'Locations',
    emoji: '📍',
    color: '#9765E0',
    subcategories: [
      { id: 'interior',   label: 'Interior'   },
      { id: 'exterior',   label: 'Exterior'   },
      { id: 'urban',      label: 'Urban'      },
      { id: 'nature',     label: 'Nature'     },
      { id: 'industrial', label: 'Industrial' },
      { id: 'aerial',     label: 'Aerial'     },
      { id: 'underwater', label: 'Underwater' },
    ],
  },
  {
    id: 'Vehicle',
    label: 'Vehicles',
    emoji: '🚗',
    color: '#00C2BA',
    subcategories: [
      { id: 'car',         label: 'Car'         },
      { id: 'truck',       label: 'Truck'       },
      { id: 'aircraft',    label: 'Aircraft'    },
      { id: 'spacecraft',  label: 'Spacecraft'  },
      { id: 'boat',        label: 'Boat'        },
      { id: 'military',    label: 'Military'    },
      { id: 'futuristic',  label: 'Futuristic'  },
    ],
  },
  {
    id: 'Architecture',
    label: 'Architecture',
    emoji: '🏛️',
    color: '#534FA5',
    subcategories: [
      { id: 'modern',      label: 'Modern'      },
      { id: 'historical',  label: 'Historical'  },
      { id: 'futuristic',  label: 'Futuristic'  },
      { id: 'industrial',  label: 'Industrial'  },
      { id: 'residential', label: 'Residential' },
      { id: 'commercial',  label: 'Commercial'  },
    ],
  },
  {
    id: 'Nature',
    label: 'Nature',
    emoji: '🌿',
    color: '#00C2BA',
    subcategories: [
      { id: 'forest',  label: 'Forest'  },
      { id: 'desert',  label: 'Desert'  },
      { id: 'ocean',   label: 'Ocean'   },
      { id: 'mountain',label: 'Mountain'},
      { id: 'sky',     label: 'Sky'     },
      { id: 'field',   label: 'Field'   },
    ],
  },
  {
    id: 'Creature',
    label: 'Creatures',
    emoji: '🐉',
    color: '#CE95FB',
    subcategories: [
      { id: 'beast',    label: 'Beast'    },
      { id: 'alien',    label: 'Alien'    },
      { id: 'mythical', label: 'Mythical' },
      { id: 'robot',    label: 'Robot'    },
      { id: 'hybrid',   label: 'Hybrid'   },
    ],
  },
  {
    id: 'Fantasy',
    label: 'Fantasy',
    emoji: '✨',
    color: '#9765E0',
    subcategories: [
      { id: 'medieval', label: 'Medieval' },
      { id: 'magic',    label: 'Magic'    },
      { id: 'epic',     label: 'Epic'     },
      { id: 'dark',     label: 'Dark'     },
    ],
  },
  {
    id: 'Sci-Fi',
    label: 'Sci-Fi',
    emoji: '🚀',
    color: '#00C2BA',
    subcategories: [
      { id: 'cyberpunk',  label: 'Cyberpunk'  },
      { id: 'space',      label: 'Space'      },
      { id: 'dystopian',  label: 'Dystopian'  },
      { id: 'biopunk',    label: 'Biopunk'    },
      { id: 'post-apoc',  label: 'Post-Apoc'  },
    ],
  },
  {
    id: 'Prop',
    label: 'Props',
    emoji: '🎬',
    color: '#534FA5',
    subcategories: [
      { id: 'weapon',     label: 'Weapon'     },
      { id: 'technology', label: 'Technology' },
      { id: 'furniture',  label: 'Furniture'  },
      { id: 'clothing',   label: 'Clothing'   },
      { id: 'food',       label: 'Food'       },
    ],
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
