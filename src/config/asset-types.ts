// ─────────────────────────────────────────────────────────────
// ASSET TYPES CONFIG — single source of truth
// To add a new type (e.g. Props): just add one object to the array below.
// Admin form, catalog filters, and AI auto-naming all update automatically.
// ─────────────────────────────────────────────────────────────

export type AssetType = {
  /** Stored in DB — never change existing ids, only add new ones */
  id: string
  /** Display label */
  label: string
  /** Emoji for UI */
  emoji: string
  /** Brand color */
  color: string
  /** Short description for homepage / catalog */
  description: string
  /** Default tags auto-added when this type is detected */
  autoTags: string[]
  /** Filename keywords that trigger auto-detection of this type */
  keywords: string[]
}

export const ASSET_TYPES: AssetType[] = [
  // ── LOCATION ──────────────────────────────────────────────
  {
    id: 'location',
    label: 'Location',
    emoji: '📍',
    color: '#9765E0',
    description: 'Cinematic AI-generated environments — interiors, exteriors, urban, nature.',
    autoTags: ['ai location', 'cinematic', 'environment'],
    keywords: [
      'location', 'loc', 'scene', 'interior', 'exterior',
      'landscape', 'urban', 'nature', 'environment', 'bg',
      'background', 'street', 'building', 'forest', 'desert',
      'city', 'room', 'studio', 'outdoor', 'indoor',
    ],
  },

  // ── CHARACTER ─────────────────────────────────────────────
  {
    id: 'character',
    label: 'Character',
    emoji: '🧍',
    color: '#CE95FB',
    description: 'Photorealistic AI-generated characters for storyboards and lookbooks.',
    autoTags: ['ai character', 'cinematic'],
    keywords: [
      'character', 'char', 'person', 'portrait', 'face',
      'model', 'actor', 'human', 'woman', 'man', 'girl',
      'boy', 'hero', 'villain', 'people', 'figure',
    ],
  },

  // ── ADD NEW TYPES BELOW ───────────────────────────────────
  // Example — uncomment and customize when ready:
  //
  // {
  //   id: 'props',
  //   label: 'Props',
  //   emoji: '🎭',
  //   color: '#00C2BA',
  //   description: 'AI-generated props and objects for set decoration and storyboards.',
  //   autoTags: ['ai props', 'cinematic', 'object'],
  //   keywords: ['prop', 'props', 'object', 'item', 'furniture', 'tool', 'weapon', 'vehicle'],
  // },
]

// ── Helpers ────────────────────────────────────────────────

/** Find a type by its id */
export function getAssetType(id: string): AssetType {
  return ASSET_TYPES.find(t => t.id === id.toLowerCase()) ?? ASSET_TYPES[0]
}

/** Auto-detect type from a filename */
export function detectAssetTypeFromFilename(filename: string): AssetType {
  const lower = filename.toLowerCase()
  return (
    ASSET_TYPES.find(t => t.keywords.some(k => lower.includes(k))) ??
    ASSET_TYPES[0]
  )
}

/** Map of id → color for quick lookups (e.g. in tables) */
export const TYPE_COLOR_MAP: Record<string, string> = Object.fromEntries(
  ASSET_TYPES.map(t => [t.label, t.color])
)
