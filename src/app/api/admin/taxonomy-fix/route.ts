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
  ['african wild dog', 'Predators'], ['feral dog', 'Predators'],
  ['red panda', 'Wild Mammals'], ['giant panda', 'Wild Mammals'],
  ['naked molerat', 'Wild Mammals'], ['patagonian mara', 'Wild Mammals'],
  ['king vulture', 'Birds'], ['eagle owl', 'Birds'], ['ground hornbill', 'Birds'],
  ['king penguin', 'Birds'], ['sage grouse', 'Birds'], ['crowned pigeon', 'Birds'],
  ['cape buffalo', 'Wild Mammals'], ['forest buffalo', 'Wild Mammals'],
]

const TOKENS: Record<string, string[]> = {
  'Pets': ['dog', 'puppy', 'hound', 'collie', 'retriever', 'terrier', 'pointer', 'setter', 'spaniel', 'mastiff', 'sheepdog', 'shiba', 'basenji', 'borzoi', 'saluki', 'samoyed', 'weimaraner', 'dane', 'deerhound', 'greyhound', 'ridgeback', 'affenpinscher', 'azawakh', 'otterhound', 'pharaoh', 'spinone', 'wirehaired', 'dalmatian', 'corgi', 'poodle', 'bulldog', 'pug', 'beagle', 'husky', 'malamute', 'akita', 'chihuahua', 'doberman', 'rottweiler', 'schnauzer', 'cat', 'kitten', 'shorthair', 'sphynx', 'abyssinian', 'bengal', 'ragdoll', 'siamese', 'persian', 'rabbit', 'bunny', 'ferret', 'hamster', 'guinea', 'horse', 'pony', 'donkey', 'goat', 'sheep', 'lamb', 'cow', 'calf', 'bull', 'ox', 'llama', 'alpaca', 'pig', 'piglet', 'chicken', 'rooster', 'hen'],
  'Predators': ['lion', 'lioness', 'tiger', 'leopard', 'jaguar', 'cheetah', 'panther', 'cougar', 'puma', 'lynx', 'ocelot', 'serval', 'caracal', 'genet', 'civet', 'fossa', 'dhole', 'wolf', 'coyote', 'jackal', 'bear', 'grizzly', 'badger', 'marten', 'wolverine', 'hyena', 'aardwolf', 'mongoose', 'crocodile', 'alligator', 'caiman'],
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

function textOf(r: Row): { text: string; tokens: Set<string> } {
  const slug = decodeURIComponent(String(r.file_url).split('/').pop() || '')
    .split('?')[0].replace(/^\d+-/, '').replace(/\.(jpg|jpeg|png|webp)$/i, '')
  const text = (slug + ' ' + (r.title || '')).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  return { text, tokens: new Set(text.split(' ')) }
}

type Move = { id: string; from: string; to: string; name: string; addTag?: string }

function classify(r: Row): { type: string; category: string; addTag?: string } | null {
  const { text, tokens } = textOf(r)
  const has = (t: string) => tokens.has(t)
  const anyTok = (list: string[]) => list.some(has)
  const fishSuffix = Array.from(tokens).some(t => t.length > 4 && t.endsWith('fish'))

  // 1 ── zombie / infected / undead
  if (anyTok(['zombie', 'zombies', 'infected', 'undead'])) {
    return anyTok(HUMANISH)
      ? { type: 'Zombie', category: 'Zombies' }
      : { type: 'Creature', category: 'Monsters', addTag: 'zombie' }
  }
  // 2 ── anthropomorphic animal characters
  if (anyTok(ANTHRO) || text.includes('animal character')) {
    return { type: 'Character', category: 'Characters' }
  }
  // 3 ── cartoon humans
  if (anyTok(CARTOON_HUMAN_WHO) && anyTok(CARTOON_MARK)) {
    const cat = has('boy') || has('girl') || has('kid') || has('child') ? 'Kids' : has('woman') ? 'Women' : 'Men'
    return { type: 'People', category: cat, addTag: 'style:cartoon' }
  }
  // 4 ── prehistoric humans vs palaeo-fauna
  if (text.includes('prehistoric human') || has('neanderthal') || has('caveman')) {
    return { type: 'People', category: 'Prehistoric' }
  }
  if (anyTok(DINO)) return { type: 'Creature', category: 'Dinosaurs' }
  // 5 ── fantasy creatures keep their kingdom
  if (anyTok(FANTASY)) {
    const cat = has('alien') ? 'Aliens'
      : (has('monster') || has('demon') || has('orc') || has('goblin') || has('ghoul') || has('wraith')) ? 'Monsters'
      : 'Beasts'
    return { type: 'Creature', category: cat }
  }
  // 6 ── real species by dictionary: multi-word first, then tokens
  for (const [phrase, cat] of MULTI) {
    if (text.includes(phrase)) {
      if (cat === '__creature__') return { type: 'Creature', category: 'Beasts' }
      return { type: 'Animal', category: cat }
    }
  }
  if (fishSuffix) return { type: 'Animal', category: 'Fish & Sea' }
  for (const [cat, words] of Object.entries(TOKENS)) {
    if (anyTok(words)) return { type: 'Animal', category: cat }
  }
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
