// ─────────────────────────────────────────────────────────────
// STRUCTURED ATTRIBUTES — the single source of truth for how an
// asset is tagged AND how it is searched. Attributes are stored as
// prefixed tokens inside the normal tags[] array (no DB migration):
//   g:man  age:young  eth:asian        (Character)
//   place:interior  time:night         (Location)
// Free descriptive tags (beard, neon, brooding…) live alongside.
//
// The same word→code maps power three places:
//   • ai-name    — normalize Gemini's read into prefixed tokens
//   • search     — hard-filter query intent against asset attributes
//   • migration  — back-fill prefixes from existing plain-word tags
// Keeping it in one file guarantees upload and search never drift.
// ─────────────────────────────────────────────────────────────

export type AttrKey = 'g' | 'age' | 'eth' | 'place' | 'time'

// Canonical vocab. First token is the CODE we store; the rest are
// synonyms we recognise in free text / Gemini output / old tags.
const GENDER: Record<string, string[]> = {
  man: ['man', 'men', 'male', 'boy', 'guy', 'gentleman', 'he'],
  woman: ['woman', 'women', 'female', 'girl', 'lady', 'she'],
}
const AGE: Record<string, string[]> = {
  child: ['child', 'kid', 'toddler', 'infant', 'baby'],
  teen: ['teen', 'teenager', 'adolescent', 'teenage'],
  young: ['young', 'youth', 'young-adult', 'young adult', 'twenties'],
  adult: ['adult', 'middle-aged', 'middle aged', 'mid-aged', 'thirties', 'forties'],
  senior: ['senior', 'elderly', 'old', 'aged', 'grandfather', 'grandmother', 'grandpa', 'grandma'],
}
const ETH: Record<string, string[]> = {
  white: ['white', 'caucasian', 'european'],
  black: ['black', 'african', 'african-american'],
  asian: ['asian', 'east-asian', 'east asian', 'chinese', 'japanese', 'korean', 'oriental'],
  'south-asian': ['south-asian', 'south asian', 'indian', 'pakistani', 'desi'],
  latino: ['latino', 'latina', 'hispanic', 'latin'],
  mena: ['mena', 'middle-eastern', 'middle eastern', 'arab', 'arabic', 'persian', 'turkish'],
  mixed: ['mixed', 'multiracial', 'biracial'],
}
const PLACE: Record<string, string[]> = {
  interior: ['interior', 'indoor', 'indoors', 'inside', 'room'],
  exterior: ['exterior', 'outdoor', 'outdoors', 'outside', 'open-air'],
}
const TIME: Record<string, string[]> = {
  dawn: ['dawn', 'sunrise', 'daybreak', 'morning'],
  day: ['day', 'daytime', 'noon', 'midday', 'afternoon'],
  golden: ['golden', 'golden-hour', 'golden hour', 'sunset', 'dusk', 'twilight'],
  night: ['night', 'nighttime', 'midnight', 'nocturnal', 'evening'],
}

const MAPS: Record<AttrKey, Record<string, string[]>> = {
  g: GENDER, age: AGE, eth: ETH, place: PLACE, time: TIME,
}

// Which attributes apply to which asset type
export const CHAR_KEYS: AttrKey[] = ['g', 'age', 'eth']
export const LOC_KEYS: AttrKey[] = ['place', 'time']

// Age bucket: casting a teen must never surface an adult and vice
// versa, but neighbouring ages are tolerated within a bucket.
const AGE_BUCKET: Record<string, 'young' | 'old'> = {
  child: 'young', teen: 'young', young: 'young',
  adult: 'old', senior: 'old',
}

function codeForWord(key: AttrKey, word: string): string | null {
  const w = word.toLowerCase().trim()
  const map = MAPS[key]
  for (const code in map) {
    if (map[code].includes(w)) return code
  }
  return null
}

// Find a code by scanning a blob of text for ANY synonym (phrase-aware)
function codeInText(key: AttrKey, text: string): string | null {
  const t = ' ' + text.toLowerCase() + ' '
  const map = MAPS[key]
  for (const code in map) {
    for (const syn of map[code]) {
      const re = new RegExp('[^a-z]' + syn.replace(/[-\s]/g, '[-\\s]') + '[^a-z]')
      if (re.test(t)) return code
    }
  }
  return null
}

// ── For ai-name: normalize a raw value ("east asian") → code ──
export function normalizeAttr(key: AttrKey, raw: string): string | null {
  if (!raw) return null
  return codeForWord(key, raw) || codeInText(key, raw)
}

// ── For migration: derive prefixed tokens from plain tags/text ──
export function deriveAttrs(type: string, tags: string[], extraText = ''): string[] {
  const keys = type === 'Character' ? CHAR_KEYS : type === 'Location' ? LOC_KEYS : []
  if (!keys.length) return []
  const blob = tags.join(' ') + ' ' + extraText
  const out: string[] = []
  for (const key of keys) {
    // already prefixed? keep as-is
    const existing = tags.find(t => t.toLowerCase().startsWith(key + ':'))
    if (existing) { out.push(existing.toLowerCase()); continue }
    const code = codeInText(key, blob)
    if (code) out.push(`${key}:${code}`)
  }
  return out
}

// ── For search: read an asset's attributes (prefixed first, else
// fall back to scanning plain words so un-migrated rows still work) ─
export function parseAssetAttrs(type: string, tags: string[]): Partial<Record<AttrKey, string>> {
  const keys = type === 'Character' ? CHAR_KEYS : type === 'Location' ? LOC_KEYS : []
  const blob = tags.join(' ')
  const attrs: Partial<Record<AttrKey, string>> = {}
  for (const key of keys) {
    const pre = tags.find(t => t.toLowerCase().startsWith(key + ':'))
    if (pre) attrs[key] = pre.slice(key.length + 1).toLowerCase()
    else {
      const code = codeInText(key, blob)
      if (code) attrs[key] = code
    }
  }
  return attrs
}

// ── For search: what does the query intend? ──
export function desiredAttrs(type: string, keywords: string[]): Partial<Record<AttrKey, string>> {
  const keys = type === 'Character' ? CHAR_KEYS : type === 'Location' ? LOC_KEYS : []
  const blob = keywords.join(' ')
  const want: Partial<Record<AttrKey, string>> = {}
  for (const key of keys) {
    const code = codeInText(key, blob)
    if (code) want[key] = code
  }
  return want
}

// ── Hard filter: does an asset conflict with the query intent? ──
// Returns true if the asset should be EXCLUDED. Only excludes on a
// definite conflict; missing info never excludes.
export function attrConflict(
  want: Partial<Record<AttrKey, string>>,
  have: Partial<Record<AttrKey, string>>,
): boolean {
  for (const key of Object.keys(want) as AttrKey[]) {
    const w = want[key], h = have[key]
    if (!w || !h) continue
    if (key === 'age') {
      if (AGE_BUCKET[w] && AGE_BUCKET[h] && AGE_BUCKET[w] !== AGE_BUCKET[h]) return true
    } else if (w !== h) {
      return true
    }
  }
  return false
}
