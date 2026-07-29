import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/adminAuth'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─────────────────────────────────────────────────────────────
// TAXONOMY FIX (DEV_taxonomy_fix, #88) — animal/creature
// sub-categories are derived from the SPECIES IN THE FILE NAME,
// not from Gemini vision (which mis-filed antelopes as insects,
// lionfish as predators, collies as predators, etc).
//
// Rules, in priority order:
// 1. zombie / infected / undead → humans go to Zombies, animals
//    and creatures go to Creature/Monsters + a 'zombie' tag
//    (one public Zombie category — never two).
// 2. anthropomorphic animal characters (fox in a cloak, dressed
//    chimp, animal-character sheets) → Character/Characters.
// 3. cartoon humans (boy character…) → People + style:cartoon.
// 4. prehistoric humans → People/Prehistoric; dinosaurs and
//    palaeo-fauna → Creature/Dinosaurs. Never mixed.
// 5. real species → dictionary lookup (Pets / Predators /
//    Wild Mammals / Birds / Fish & Sea / Insects / Reptiles).
// 6. unrecognised Animal → category 'Review' — NEVER guessed.
//
// GET ?dry=1 → full plan + report, no writes.
// POST → apply the plan. Both admin-gated.
// ─────────────────────────────────────────────────────────────

type Row = { id: string; type: string; category: string | null; title: string | null; file_url: string; tags: string[] | null }

const MULTI: [string, string][] = [
  // multi-word species FIRST — they must win over their last word
  ['sea lion', 'Fish & Sea'], ['sea turtle', 'Reptiles'], ['sea serpent', '__creature__'],
  ['komodo dragon', 'Reptiles'], ['monitor lizard', 'Reptiles'], ['draco lizard', 'Reptiles'],
  ['gila monster', 'Reptiles'], ['giant tortoise', 'Reptiles'], ['tree frog', 'Reptiles'],
  ['killer whale', 'Fish & Sea'], ['blue whale', 'Fish & Sea'], ['leafy seadragon', 'Fish & Sea'],
  ['highland cow', 'Pets'], ['jacob sheep', 'Pets'],
  ['african wild dog', 'Predators'], ['feral dog', 'Predators'], ['fennec fox', 'Predators'],
  ['cock of the rock', 'Birds'],
  ['red panda', 'Wild Mammals'], ['giant panda', 'Wild Mammals'],
  ['naked molerat', 'Wild Mammals'], ['patagonian mara', 'Wild Mammals'],
  ['king vulture', 'Birds'], ['eagle owl', 'Birds'], ['ground hornbill', 'Birds'],
  ['king penguin', 'Birds'], ['sage grouse', 'Birds'], ['crowned pigeon', 'Birds'],
  ['cape buffalo', 'Wild Mammals'], ['forest buffalo', 'Wild Mammals'],
]

const TOKENS: Record<string, string[]> = {
  'Pets': ['dog', 'puppy', 'hound', 'collie', 'retriever', 'terrier', 'pointer', 'setter', 'spaniel', 'mastiff', 'sheepdog', 'shiba', 'basenji', 'borzoi', 'saluki', 'samoyed', 'weimaraner', 'dane', 'deerhound', 'greyhound', 'ridgeback', 'affenpinscher', 'azawakh', 'otterhound', 'pharaoh', 'spinone', 'wirehaired', 'dalmatian', 'corgi', 'poodle', 'bulldog', 'pug', 'beagle', 'husky', 'malamute', 'akita', 'chihuahua', 'doberman', 'rottweiler', 'schnauzer', 'cat', 'kitten', 'shorthair', 'sphynx', 'abyssinian', 'bengal', 'ragdoll', 'siamese', 'persian', 'rabbit', 'bunny', 'ferret', 'hamster', 'guinea', 'horse', 'pony', 'donkey', 'goat', 'sheep', 'lamb', 'cow', 'calf', 'bull', 'ox', 'llama', 'alpaca', 'pig', 'piglet', 'chicken', 'rooster', 'hen'],
  'Predators': ['lion', 'lioness', 'tiger', 'leopard', 'jaguar', 'cheetah', 'panther', 'cougar', 'puma', 'lynx', 'ocelot', 'serval', 'caracal', 'genet', 'civet', 'fossa', 'dhole', 'wolf', 'coyote', 'jackal', 'bear', 'grizzly', 'badger', 'marten', 'wolverine', 'hyena', 'aardwolf', 'mongoose', 'fox', 'crocodile', 'alligator', 'caiman'],
  'Wild Mammals': ['antelope', 'bongo', 'kudu', 'hartebeest', 'oryx', 'gemsbok', 'gerenuk', 'gazelle', 'springbok', 'wildebeest', 'ibex', 'deer', 'stag', 'elk', 'moose', 'reindeer', 'zebra', 'monkey', 'baboon', 'macaque', 'mandrill', 'tamarin', 'lemur', 'sifaka', 'orangutan', 'chimpanzee', 'chimp', 'gorilla', 'capuchin', 'gibbon', 'otter', 'wombat', 'kangaroo', 'wallaby', 'possum', 'opossum', 'koala', 'beaver', 'capybara', 'aardvark', 'pangolin', 'tapir', 'okapi', 'takin', 'gaur', 'buffalo', 'bison', 'yak', 'panda', 'colugo', 'mara', 'molerat', 'platypus', 'echidna', 'elephant', 'giraffe', 'hippo', 'hippopotamus', 'rhino', 'rhinoceros', 'camel', 'coati', 'hedgehog', 'sloth', 'armadillo', 'anteater', 'boar', 'warthog', 'hare', 'squirrel', 'chipmunk', 'raccoon', 'skunk', 'porcupine', 'mole', 'bat', 'meerkat', 'genets', 'civets'],
  'Birds': ['bird', 'owl', 'eagle', 'vulture', 'hornbill', 'heron', 'macaw', 'parrot', 'cockatoo', 'penguin', 'cassowary', 'ostrich', 'emu', 'flamingo', 'toucan', 'peacock', 'raven', 'crow', 'jay', 'pigeon', 'dove', 'grouse', 'secretarybird', 'roadrunner', 'potoo', 'kingfisher', 'crane', 'stork', 'swan', 'goose', 'duck', 'falcon', 'hawk', 'kestrel', 'kite', 'bateleur', 'hummingbird', 'woodpecker', 'sparrow', 'finch', 'cardinal', 'magpie', 'pelican', 'albatross', 'puffin', 'kiwi'],
  'Fish & Sea': ['shark', 'tuna', 'trevally', 'betta', 'seahorse', 'seadragon', 'cuttlefish', 'nautilus', 'octopus', 'squid', 'jelly', 'jellyfish', 'whale', 'orca', 'dolphin', 'porpoise', 'seal', 'walrus', 'manatee', 'dugong', 'axolotl', 'ray', 'stingray', 'eel', 'marlin', 'barracuda', 'grouper', 'salmon', 'trout', 'carp', 'koi', 'crab', 'lobster', 'shrimp', 'starfish', 'urchin', 'anemone', 'coral'],
  'Insects': ['beetle', 'moth', 'mantis', 'cricket', 'grasshopper', 'wasp', 'bee', 'bumblebee', 'hornet', 'butterfly', 'ant', 'dragonfly', 'damselfly', 'spider', 'tarantula', 'scorpion', 'centipede', 'millipede', 'ladybug', 'firefly', 'cicada', 'locust', 'weevil', 'cockroach', 'termite', 'flea', 'tick', 'snail', 'slug', 'worm', 'caterpillar'],
  'Reptiles': ['lizard', 'iguana', 'chameleon', 'komodo', 'monitor', 'gila', 'tortoise', 'turtle', 'snake', 'python', 'cobra', 'viper', 'boa', 'anaconda', 'mamba', 'rattlesnake', 'gecko', 'skink', 'draco', 'frog', 'toad', 'bullfrog', 'salamander', 'newt', 'gharial'],
}

const DINO = ['dinosaur', 'dino', 'raptor', 'rex', 'tyrannosaurus', 'triceratops', 'stegosaurus', 'ankylosaur', 'ankylosaurus', 'hadrosaur', 'sauropod', 'theropod', 'pteranodon', 'pterodactyl', 'plesiosaur', 'mosasaur', 'dimetrodon', 'therizinosaurus', 'spinosaurus', 'velociraptor', 'brachiosaurus', 'diplodocus', 'allosaurus', 'carnotaurus', 'parasaurolophus', 'smilodon', 'sabertooth', 'glyptodon', 'mammoth', 'anomalocaris', 'dunkleosteus', 'trilobite', 'megalodon']
const FANTASY = ['creature', 'beast', 'monster', 'demon', 'alien', 'dragon', 'werewolf', 'minotaur', 'troll', 'orc', 'goblin', 'ghoul', 'wraith', 'golem', 'chimera', 'hydra', 'kraken', 'humanoid', 'tentacle', 'bioluminescent', 'elemental', 'mutant', 'insectoid', 'cephalopod', 'biped']
const HUMANISH = ['survivor', 'walker', 'office', 'worker', 'corporate', 'human', 'man', 'male', 'woman', 'female', 'person', 'people', 'attire', 'formal', 'tactical', 'nurse', 'doctor', 'soldier', 'businessman']
const ANTHRO = ['anthropomorphic', 'dressed', 'cloak', 'cloaked', 'hooded', 'clothed']
const CARTOON_HUMAN_WHO = ['boy', 'girl', 'kid', 'child', 'man', 'woman', 'teen']
const CARTOON_MARK = ['character', 'cartoon', 'animated', 'stylized']

function textOf(r: Row): { slugText: string; slugTokens: Set<string>; fullText: string; fullTokens: Set<string> } {
  const slug = decodeURIComponent(String(r.file_url).split('/').pop() || '')
    .split('?')[0].replace(/^\d+-/, '').replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const slugText = slug.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  const fullText = (slugText + ' ' + (r.title || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return { slugText, slugTokens: new Set(slugText.split(' ')), fullText, fullTokens: new Set(fullText.split(' ')) }
}

type Move = { id: string; from: string; to: string; name: string; addTag?: string }

function speciesLookup(text: string, tokens: Set<string>): { type: string; category: string } | null {
  for (const [phrase, cat] of MULTI) {
    if (text.includes(phrase)) {
      if (cat === '__creature__') return { type: 'Creature', category: 'Beasts' }
      return { type: 'Animal', category: cat }
    }
  }
  if (Array.from(tokens).some(t => t.length > 4 && t.endsWith('fish'))) return { type: 'Animal', category: 'Fish & Sea' }
  for (const [cat, words] of Object.entries(TOKENS)) {
    if (words.some(w => tokens.has(w))) return { type: 'Animal', category: cat }
  }
  return null
}

function classify(r: Row): { type: string; category: string; addTag?: string } | null {
  // THE FILE NAME IS THE SOURCE OF TRUTH (owner's brief). Gemini titles
  // only break ties: owner-flagged cases (anthro / cartoon humans) and
  // files whose slug carries no species at all (hf-… batches).
  const { slugText, slugTokens, fullText, fullTokens } = textOf(r)
  const hasS = (t: string) => slugTokens.has(t)
  const anyS = (list: string[]) => list.some(hasS)
  const hasF = (t: string) => fullTokens.has(t)
  const anyF = (list: string[]) => list.some(hasF)

  // 1 ── zombie / infected / undead (slug is always explicit here)
  if (anyS(['zombie', 'zombies', 'infected', 'undead'])) {
    return anyS(HUMANISH) || anyF(HUMANISH)
      ? { type: 'Zombie', category: 'Zombies' }
      : { type: 'Creature', category: 'Monsters', addTag: 'zombie' }
  }
  // 2 ── anthropomorphic animal characters (slug OR title — owner's cases)
  if (anyF(ANTHRO) || fullText.includes('animal character')) {
    return { type: 'Character', category: 'Characters' }
  }
  // 3 ── cartoon humans (slug OR title)
  if (anyF(CARTOON_HUMAN_WHO) && anyF(CARTOON_MARK)) {
    const cat = hasF('boy') || hasF('girl') || hasF('kid') || hasF('child') ? 'Kids' : hasF('woman') ? 'Women' : 'Men'
    return { type: 'People', category: cat, addTag: 'style:cartoon' }
  }
  // 4 ── prehistoric humans vs palaeo-fauna (slug)
  if (slugText.includes('prehistoric human') || hasS('neanderthal') || hasS('caveman')) {
    return { type: 'People', category: 'Prehistoric' }
  }
  if (anyS(DINO)) return { type: 'Creature', category: 'Dinosaurs' }
  // 5 ── EXACT multi-word species outrank fantasy tokens: a komodo
  //      dragon is a reptile, a gila monster is a lizard
  for (const [phrase, cat] of MULTI) {
    if (slugText.includes(phrase)) {
      if (cat === '__creature__') return { type: 'Creature', category: 'Beasts' }
      return { type: 'Animal', category: cat }
    }
  }
  // 6 ── fantasy creatures keep their kingdom (slug ONLY — Gemini titles
  //      love the word «alien» far too much)
  if (anyS(FANTASY)) {
    const cat = hasS('alien') ? 'Aliens'
      : (hasS('monster') || hasS('demon') || hasS('orc') || hasS('goblin') || hasS('ghoul') || hasS('wraith')) ? 'Monsters'
      : 'Beasts'
    return { type: 'Creature', category: cat }
  }
  // 6 ── real species from the slug; title only when the slug is mute
  const bySlug = speciesLookup(slugText, slugTokens)
  if (bySlug) return bySlug
  const byTitle = speciesLookup(fullText, fullTokens)
  if (byTitle) return byTitle
  // 7 ── unknown: Animals go to Review (never guessed), others stay
  if (r.type === 'Animal') return { type: 'Animal', category: 'Review' }
  return null
}

async function buildPlan() {
  const admin = supabaseAdmin()
  const { data, error } = await admin.from('assets')
    .select('id,type,category,title,file_url,tags')
    .in('type', ['Animal', 'Creature', 'Zombie'])
    .limit(2000)
  if (error) throw error
  const rows = (data || []) as Row[]

  const moves: Move[] = []
  const review: string[] = []
  const perTarget: Record<string, number> = {}
  for (const r of rows) {
    const target = classify(r)
    if (!target) continue
    const name = decodeURIComponent(String(r.file_url).split('/').pop() || '').split('?')[0]
    const needTag = target.addTag && !(r.tags || []).includes(target.addTag)
    if (target.type !== r.type || target.category !== (r.category || '') || needTag) {
      moves.push({
        id: r.id,
        from: `${r.type}/${r.category}`,
        to: `${target.type}/${target.category}`,
        name,
        addTag: needTag ? target.addTag : undefined,
      })
      perTarget[`${target.type}/${target.category}`] = (perTarget[`${target.type}/${target.category}`] || 0) + 1
      if (target.category === 'Review') review.push(name)
    }
  }

  // possible duplicates: identical species slug (index stripped) appearing 2+ times
  const groups: Record<string, string[]> = {}
  for (const r of rows) {
    const base = decodeURIComponent(String(r.file_url).split('/').pop() || '')
      .split('?')[0].replace(/^\d+-/, '').replace(/\.(jpg|jpeg|png|webp)$/i, '')
      .replace(/-\d+(-\d+)?$/, '')
    if (!groups[base]) groups[base] = []
    groups[base].push(r.id)
  }
  const possibleDupes = Object.entries(groups).filter(([b, ids]) => ids.length > 1 && !b.startsWith('animal-character')).map(([b, ids]) => `${b} ×${ids.length}`)

  return { total: rows.length, planned: moves.length, perTarget, review, possibleDupes, moves }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const plan = await buildPlan()
    // dry run: full report, moves trimmed for readability
    return NextResponse.json({ ok: true, dry: true, ...plan, moves: plan.moves.slice(0, 400) })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin(req)
  if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status })
  try {
    const admin = supabaseAdmin()
    const plan = await buildPlan()
    let applied = 0
    for (const m of plan.moves) {
      const [type, ...rest] = m.to.split('/')
      const category = rest.join('/')
      const patch: Record<string, unknown> = { type, category }
      if (m.addTag) {
        const { data } = await admin.from('assets').select('tags').eq('id', m.id).single()
        const tags: string[] = Array.isArray(data?.tags) ? data.tags : []
        if (!tags.includes(m.addTag)) patch.tags = [...tags, m.addTag]
      }
      const { error } = await admin.from('assets').update(patch).eq('id', m.id)
      if (!error) applied++
    }
    return NextResponse.json({ ok: true, applied, planned: plan.planned, perTarget: plan.perTarget, review: plan.review, possibleDupes: plan.possibleDupes })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'failed' }, { status: 500 })
  }
}
