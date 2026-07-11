import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ─────────────────────────────────────────────────────────────
// RECLASSIFY CARTOON HEROES (owner: «животные в животные,
// creatures в creatures…») — the opened Character/Characters
// assets move into the REAL taxonomy by title+tag keywords.
// style:cartoon stays, is_public stays. Free, no AI.
// Unmatched rows keep type Character (report shows them).
// GET = dry-run with the full mapping, POST = apply.
// ─────────────────────────────────────────────────────────────

const ANIMALS: Array<[string, string]> = [
  // word → animal class
  ['pig', 'wild-mammals'], ['boar', 'wild-mammals'], ['hog', 'wild-mammals'],
  ['rat', 'wild-mammals'], ['mouse', 'wild-mammals'], ['rhino', 'wild-mammals'],
  ['turtle', 'reptiles'], ['tortoise', 'reptiles'], ['lizard', 'reptiles'], ['snake', 'reptiles'], ['frog', 'reptiles'], ['toad', 'reptiles'], ['croc', 'reptiles'], ['gecko', 'reptiles'],
  ['cat', 'pets'], ['dog', 'pets'], ['puppy', 'pets'], ['kitten', 'pets'],
  ['wolf', 'predators'], ['fox', 'predators'], ['bear', 'predators'], ['lion', 'predators'], ['tiger', 'predators'], ['panther', 'predators'], ['hyena', 'predators'],
  ['ape', 'wild-mammals'], ['monkey', 'wild-mammals'], ['gorilla', 'wild-mammals'], ['rabbit', 'wild-mammals'], ['hare', 'wild-mammals'], ['hedgehog', 'wild-mammals'], ['badger', 'wild-mammals'], ['raccoon', 'wild-mammals'], ['squirrel', 'wild-mammals'], ['elephant', 'wild-mammals'], ['hippo', 'wild-mammals'], ['deer', 'wild-mammals'], ['moose', 'wild-mammals'], ['ox', 'wild-mammals'], ['bull', 'wild-mammals'], ['horse', 'wild-mammals'], ['donkey', 'wild-mammals'], ['panda', 'wild-mammals'], ['sloth', 'wild-mammals'], ['otter', 'wild-mammals'], ['beaver', 'wild-mammals'], ['skunk', 'wild-mammals'], ['bat', 'wild-mammals'],
  ['duck', 'birds'], ['goose', 'birds'], ['owl', 'birds'], ['eagle', 'birds'], ['hawk', 'birds'], ['penguin', 'birds'], ['parrot', 'birds'], ['rooster', 'birds'], ['chicken', 'birds'], ['crow', 'birds'], ['raven', 'birds'], ['bird', 'birds'],
  ['shark', 'fish-sea'], ['fish', 'fish-sea'], ['octopus', 'fish-sea'], ['squid', 'fish-sea'], ['crab', 'fish-sea'], ['whale', 'fish-sea'], ['dolphin', 'fish-sea'],
  ['spider', 'insects'], ['bee', 'insects'], ['ant', 'insects'], ['beetle', 'insects'], ['bug', 'insects'], ['wasp', 'insects'], ['scorpion', 'insects'],
]
const CLASS_LABEL: Record<string, string> = {
  'pets': 'Pets', 'predators': 'Predators', 'wild-mammals': 'Wild Mammals',
  'birds': 'Birds', 'fish-sea': 'Fish & Sea', 'insects': 'Insects', 'reptiles': 'Reptiles',
}
const CREATURES: Array<[string, string]> = [
  ['alien', 'Aliens'], ['extraterrestrial', 'Aliens'], ['martian', 'Aliens'],
  ['monster', 'Monsters'], ['demon', 'Monsters'], ['ghoul', 'Monsters'], ['zombie', 'Monsters'], ['ghost', 'Monsters'], ['vampire', 'Monsters'], ['werewolf', 'Monsters'], ['ogre', 'Monsters'], ['troll', 'Monsters'], ['goblin', 'Monsters'],
  ['dino', 'Dinosaurs'], ['dinosaur', 'Dinosaurs'], ['t-rex', 'Dinosaurs'], ['raptor', 'Dinosaurs'],
  ['dragon', 'Beasts'], ['beast', 'Beasts'], ['griffin', 'Beasts'], ['hydra', 'Beasts'], ['kraken', 'Beasts'], ['yeti', 'Beasts'], ['minotaur', 'Beasts'],
]
const ROBOTS = ['robot', 'android', 'mech', 'cyborg', 'droid', 'automaton', 'endoskeleton']
const LOCATION_WORDS = ['interior', 'street', 'city', 'room', 'landscape', 'skyline', 'alley', 'plaza', 'rooftop']
const WOMEN = ['woman', 'girl', 'female', 'queen', 'princess', 'witch', 'she-', 'lady', 'heroine']
const KIDS = ['boy', 'kid', 'child', 'teen ', 'young wizard']

type Verdict = { type: string; category: string } | null

function classify(title: string, tags: string[]): Verdict {
  const blob = (title + ' ' + tags.join(' ')).toLowerCase()
  const word = (w: string) => new RegExp(`(^|[^a-z])${w}([^a-z]|s[^a-z]|s$|$)`, 'i').test(blob)
  for (const [w, cat] of CREATURES) if (word(w)) return { type: 'Creature', category: cat }
  for (const w of ROBOTS) if (word(w)) return { type: 'Robot', category: w === 'mech' ? 'Mech' : w === 'endoskeleton' ? 'Endoskeleton' : w === 'android' ? 'Android' : 'Humanoid' }
  for (const [w, cls] of ANIMALS) if (word(w)) return { type: 'Animal', category: CLASS_LABEL[cls] }
  if (LOCATION_WORDS.some(w => word(w)) && !/character|hero|costume|suit/i.test(blob)) return { type: 'Location', category: 'Misc' }
  // humans: gendered words → Women/Kids, otherwise Men. Word boundaries
  // matter: «man» must not match «human/humanoid», «girl» not «girlish»
  if (WOMEN.some(w => word(w))) return { type: 'People', category: 'Women' }
  if (KIDS.some(w => word(w.trim()))) return { type: 'People', category: 'Kids' }
  if (/\b(man|hero|soldier|warrior|ninja|samurai|knight|pirate|sailor|astronaut|wizard|cowboy|outlaw|inventor|traveler|artist|hunter|agent|detective|king|guard|monk|viking|character)\b/i.test(blob)) {
    return { type: 'People', category: 'Men' }
  }
  return null
}

async function run(apply: boolean) {
  const admin = supabaseAdmin()
  const { data, error } = await admin.from('assets')
    .select('id, title, tags, category')
    .eq('type', 'Character').eq('category', 'Characters')
    .limit(1000)
  if (error || !data) return { error: error?.message ?? 'no data' }
  const moves: Array<{ id: string; title: string; to: string }> = []
  const unmatched: string[] = []
  let applied = 0
  for (const row of data) {
    const v = classify(String(row.title ?? ''), Array.isArray(row.tags) ? row.tags.map(String) : [])
    if (!v) { unmatched.push(String(row.title)); continue }
    moves.push({ id: String(row.id), title: String(row.title), to: `${v.type}/${v.category}` })
    if (apply) {
      const { error: upErr } = await admin.from('assets').update({ type: v.type, category: v.category }).eq('id', row.id)
      if (!upErr) applied++
    }
  }
  const byTarget: Record<string, number> = {}
  for (const m of moves) byTarget[m.to] = (byTarget[m.to] || 0) + 1
  return { total: data.length, matched: moves.length, applied: apply ? applied : undefined, byTarget, unmatched, sample: moves.slice(0, 30), rowsDebug: apply ? undefined : data.slice(0, 15).map(r => ({ t: r.title, tags: (Array.isArray(r.tags) ? r.tags : []).slice(0, 16) })) }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  return NextResponse.json({ dryRun: true, ...(await run(false)) })
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  return NextResponse.json({ applied: true, ...(await run(true)) })
}
