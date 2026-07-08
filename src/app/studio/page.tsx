'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// CINEMAN AI STUDIO — conversational director agent.
// Retrieval-first: heroes & locations come from the asset base
// (free, instant). Generation is only a fallback. The single
// paid step is the final Seedance render.
// Design: deep charcoal + violet glow, thin line icons, glass
// cards — approved concept (Linear/Vercel aesthetic).
// ─────────────────────────────────────────────────────────────

type Asset = {
  id: string
  title: string
  type: string
  tags: string[] | null
  description: string | null
  file_url: string
  thumbnail_url: string | null
}

type Step = 'type' | 'hero' | 'location' | 'action' | 'camera' | 'details' | 'confirm' | 'render' | 'result'

// ── Thin line icons (lucide-style, stroke = currentColor) ────
function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {d.split('|').map((p, i) => <path key={i} d={p} />)}
    </svg>
  )
}
const I = {
  megaphone: 'M3 11l18-5v12L3 13v-2z|M11.6 16.8a3 3 0 1 1-5.8-1.6',
  clapper: 'M20.2 6L3 11l-.9-3.2a2 2 0 0 1 1.4-2.5l13.5-3.6a2 2 0 0 1 2.4 1.4L20.2 6z|M6.2 5.3l3.1 3.9|M12.4 3.6l3.1 4|M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z',
  box: 'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8z|M3.3 7l8.7 5 8.7-5|M12 22V12',
  music: 'M9 18V5l12-2v13|M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z|M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z|M21 21l-4.3-4.3',
  sparkles: 'M12 3l1.9 5.8L19.7 11l-5.8 1.9L12 18.7l-1.9-5.8L4.3 11l5.8-2.2L12 3z|M19 3v4|M17 5h4',
  refresh: 'M3 12a9 9 0 0 1 15-6.7L21 8|M21 3v5h-5|M21 12a9 9 0 0 1-15 6.7L3 16|M3 21v-5h5',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  pin: 'M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z|M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  camera: 'M23 7l-7 5 7 5V7z|M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  wand: 'M15 4V2|M15 16v-2|M8 9h2|M20 9h2|M17.8 11.8L19 13|M15 9h0|M17.8 6.2L19 5|M12.2 6.2L11 5|M12 22l5-5-8-8-5 5 8 8z',
  check: 'M20 6L9 17l-5-5',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  film: 'M19.8 3H4.2A1.2 1.2 0 0 0 3 4.2v15.6A1.2 1.2 0 0 0 4.2 21h15.6a1.2 1.2 0 0 0 1.2-1.2V4.2A1.2 1.2 0 0 0 19.8 3z|M7 3v18|M17 3v18|M3 7.5h4|M3 12h18|M3 16.5h4|M17 7.5h4|M17 16.5h4',
  arrowR: 'M5 12h14|M12 5l7 7-7 7',
  arrowL: 'M19 12H5|M12 19l-7-7 7-7',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M12 1v2|M12 21v2|M4.2 4.2l1.4 1.4|M18.4 18.4l1.4 1.4|M1 12h2|M21 12h2|M4.2 19.8l1.4-1.4|M18.4 5.6l1.4-1.4',
}

const VIDEO_TYPES = [
  { id: 'ad', label: 'Рекламный ролик', icon: I.megaphone, hint: 'Продукт, бренд, промо' },
  { id: 'film', label: 'Фильм / сцена', icon: I.clapper, hint: 'Кино, драма, экшн' },
  { id: 'product', label: 'Продуктовое видео', icon: I.box, hint: 'Обзор, демонстрация' },
  { id: 'music', label: 'Музыкальный клип', icon: I.music, hint: 'Ритм, стиль, вайб' },
]
const CAM_MOVES = [
  { id: 'static', label: 'Статично' },
  { id: 'follow', label: 'Следит за героем' },
  { id: 'orbit', label: 'Облёт вокруг' },
  { id: 'drone', label: 'Дрон' },
  { id: 'handheld', label: 'Handheld' },
]
const FRAMINGS = [
  { id: 'closeup', label: 'Крупный план' },
  { id: 'medium', label: 'Средний план' },
  { id: 'wide', label: 'Общий план' },
]
const CUTS = [
  { id: 'smooth', label: 'Плавные' },
  { id: 'dynamic', label: 'Динамичные' },
  { id: 'mixed', label: 'Смешанные' },
]
const WEATHER = ['Ясно', 'Облачно', 'Дождь', 'Снег', 'Туман']
const TIME_OF_DAY = ['Утро', 'День', 'Вечер / закат', 'Ночь']
const MOODS = ['Эпично', 'Тепло', 'Драматично', 'Неон', 'Минимализм']

// EN values for the compiler
const RU_EN: Record<string, string> = {
  'Ясно': 'clear', 'Облачно': 'overcast', 'Дождь': 'rain', 'Снег': 'snow', 'Туман': 'fog',
  'Утро': 'morning light', 'День': 'daylight', 'Вечер / закат': 'golden hour sunset', 'Ночь': 'night',
  'Эпично': 'epic grand', 'Тепло': 'warm golden', 'Драматично': 'dark dramatic', 'Неон': 'neon night', 'Минимализм': 'minimal clean',
}

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: 'type', label: 'Тип' },
  { id: 'hero', label: 'Герой' },
  { id: 'location', label: 'Локация' },
  { id: 'action', label: 'Действие' },
  { id: 'camera', label: 'Камера' },
  { id: 'details', label: 'Атмосфера' },
  { id: 'confirm', label: 'Финал' },
]

function Mascot({ size = 64 }: { size?: number }) {
  return (
    <>
      <style>{`@keyframes cinemanFloat { 0%, 100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-7px) rotate(2deg) } }`}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/cineman-mascot.png"
        alt=""
        onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
        className="shrink-0 object-contain"
        style={{ width: size, height: size, animation: 'cinemanFloat 3.5s ease-in-out infinite', filter: 'drop-shadow(0 10px 16px rgba(0,212,255,0.28))' }}
      />
    </>
  )
}

function Robot({ line, typing }: { line: string; typing?: boolean }) {
  return (
    <div className="flex items-end gap-4 mb-8">
      <Mascot size={96} />
      <div className="pb-2">
        <p className="text-violet-400/80 text-xs font-medium mb-1.5 ml-1 tracking-wide">Cineman</p>
        <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-3xl rounded-bl-md px-5 py-3.5 text-zinc-100 text-[15px] leading-relaxed max-w-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
          {typing ? (
            <span className="flex items-center gap-1.5 py-1 px-0.5">
              <span className="typing-dot" />
              <span className="typing-dot" />
              <span className="typing-dot" />
            </span>
          ) : (
            <span className="fade-in-up" style={{ display: 'block' }}>{line}</span>
          )}
        </div>
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm transition-all ${
        active
          ? 'bg-violet-600 border-violet-400/60 text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]'
          : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-violet-500/50 hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
  )
}

function SectionLabel({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-zinc-500 text-xs uppercase tracking-widest mb-2.5">
      <span className="text-violet-400"><Icon d={icon} size={14} /></span>
      {children}
    </p>
  )
}

function AssetCard({ asset, selected, onClick, wide }: { asset: Asset; selected: boolean; onClick: () => void; wide?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-2xl overflow-hidden border transition-all text-left group ${
        selected
          ? 'border-violet-500 shadow-[0_0_24px_rgba(139,92,246,0.35)]'
          : 'border-zinc-800 hover:border-zinc-600 hover:-translate-y-0.5'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.thumbnail_url || asset.file_url} alt={asset.title} className={wide ? 'w-full aspect-video object-cover' : 'w-full aspect-[3/4] object-cover'} style={wide ? undefined : { objectPosition: 'center top' }} loading="lazy" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2.5">
        <p className="text-xs text-zinc-200 line-clamp-2">{asset.title}</p>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-violet-500 flex items-center justify-center text-white">
          <Icon d={I.check} size={13} />
        </div>
      )}
    </button>
  )
}

export default function StudioPage() {
  const [step, setStep] = useState<Step>('type')
  const [videoType, setVideoType] = useState<string>('')

  // hero / location
  const [heroQuery, setHeroQuery] = useState('')
  const [locQuery, setLocQuery] = useState('')
  const [heroResults, setHeroResults] = useState<Asset[]>([])
  const [locResults, setLocResults] = useState<Asset[]>([])
  const [heroOffset, setHeroOffset] = useState(0)
  const [locOffset, setLocOffset] = useState(0)
  const [hero, setHero] = useState<Asset | null>(null)
  const [location, setLocation] = useState<Asset | null>(null)
  const [searching, setSearching] = useState(false)
  const [genState, setGenState] = useState<'idle' | 'working'>('idle')

  // scene
  const [action, setAction] = useState('')
  const [camMove, setCamMove] = useState('follow')
  const [framing, setFraming] = useState('medium')
  const [cuts, setCuts] = useState('dynamic')
  const [weather, setWeather] = useState('')
  const [timeOfDay, setTimeOfDay] = useState('')
  const [mood, setMood] = useState('')

  // render
  const [quality, setQuality] = useState<'draft' | 'final'>('draft')
  const [duration, setDuration] = useState(5)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [typing, setTyping] = useState(false)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Cineman "types" for a moment on every step change — chat feel
  useEffect(() => {
    setTyping(true)
    const t = setTimeout(() => setTyping(false), 700)
    return () => clearTimeout(t)
  }, [step])

  const search = useCallback(async (assetType: 'Character' | 'Location', text: string, offset: number) => {
    setSearching(true)
    setError('')
    try {
      const res = await fetch('/api/studio/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, assetType, offset }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      if (assetType === 'Character') { setHeroResults(json.results); setHeroOffset(offset) }
      else { setLocResults(json.results); setLocOffset(offset) }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка поиска')
    } finally {
      setSearching(false)
    }
  }, [])

  const generateAsset = useCallback(async (assetType: 'Character' | 'Location', description: string) => {
    setGenState('working')
    setError('')
    try {
      const res = await fetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetType, description }),
      })
      const { taskId, error: err } = await res.json()
      if (err) throw new Error(err)
      // poll
      await new Promise<void>((resolve, reject) => {
        const iv = setInterval(async () => {
          const r = await fetch(`/api/studio/generate?taskId=${taskId}&assetType=${assetType}&title=${encodeURIComponent(description.slice(0, 60))}&description=${encodeURIComponent(description)}`)
          const j = await r.json()
          if (j.state === 'success' && j.asset) {
            clearInterval(iv)
            if (assetType === 'Character') { setHero(j.asset); setHeroResults([j.asset, ...heroResults].slice(0, 4)) }
            else { setLocation(j.asset); setLocResults([j.asset, ...locResults].slice(0, 4)) }
            resolve()
          } else if (j.state === 'fail' || j.error) {
            clearInterval(iv)
            reject(new Error(j.error || 'Генерация не удалась'))
          }
        }, 4000)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка генерации')
    } finally {
      setGenState('idle')
    }
  }, [heroResults, locResults])

  const startRender = useCallback(async () => {
    setStep('render')
    setProgress(0)
    setError('')
    try {
      const compileRes = await fetch('/api/studio/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoType,
          hero: hero ? { title: hero.title, description: hero.description } : null,
          location: location ? { title: location.title, description: location.description } : null,
          action,
          camera: { move: camMove, framing, cuts },
          details: { weather: RU_EN[weather], timeOfDay: RU_EN[timeOfDay], mood: RU_EN[mood] },
        }),
      })
      const { prompt, error: cErr } = await compileRes.json()
      if (cErr) throw new Error(cErr)

      const refs = [hero?.file_url, location?.file_url].filter(Boolean)
      const videoRes = await fetch('/api/studio/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, referenceImageUrls: refs, quality, duration }),
      })
      const { taskId, error: vErr } = await videoRes.json()
      if (vErr) throw new Error(vErr)

      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/studio/video?taskId=${taskId}`)
        const j = await r.json()
        setProgress(j.progress || 0)
        if (j.state === 'success' && j.resultUrls?.length) {
          if (pollRef.current) clearInterval(pollRef.current)
          setVideoUrl(j.resultUrls[0])
          setStep('result')
        } else if (j.state === 'fail') {
          if (pollRef.current) clearInterval(pollRef.current)
          setError(j.failMsg || 'Генерация видео не удалась')
          setStep('confirm')
        }
      }, 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setStep('confirm')
    }
  }, [videoType, hero, location, action, camMove, framing, cuts, weather, timeOfDay, mood, quality, duration])

  const STEPS: Step[] = ['type', 'hero', 'location', 'action', 'camera', 'details', 'confirm']
  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Violet ambient glow */}
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(700px 420px at 50% -80px, rgba(124,58,237,0.16), transparent 70%)' }} />

      <div className="relative max-w-3xl mx-auto px-6 py-10">
        {/* Step navigation — numbered, past steps clickable */}
        {stepIndex >= 0 && (
          <div className="flex flex-wrap gap-1.5 justify-center mb-6">
            {STEP_LABELS.map((sl, i) => {
              const isCurrent = i === stepIndex
              const isPast = i < stepIndex
              return (
                <button
                  key={sl.id}
                  onClick={() => isPast && setStep(sl.id)}
                  disabled={!isPast}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all"
                  style={{
                    background: isCurrent ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)' : isPast ? 'rgba(139,92,246,0.12)' : 'rgba(39,39,42,0.5)',
                    color: isCurrent ? '#fff' : isPast ? '#c4b5fd' : '#52525b',
                    border: `1px solid ${isCurrent ? 'rgba(167,139,250,0.6)' : isPast ? 'rgba(139,92,246,0.25)' : 'rgba(63,63,70,0.5)'}`,
                    boxShadow: isCurrent ? '0 0 16px rgba(139,92,246,0.4)' : 'none',
                    cursor: isPast ? 'pointer' : 'default',
                  }}
                >
                  <span
                    className="flex items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ width: 16, height: 16, background: isCurrent ? 'rgba(255,255,255,0.25)' : isPast ? 'rgba(139,92,246,0.3)' : 'rgba(63,63,70,0.6)' }}
                  >
                    {isPast ? '✓' : i + 1}
                  </span>
                  {sl.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Live selections bar */}
        {stepIndex >= 1 && (hero || location) && (
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8 fade-in-up">
            {hero && (
              <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={hero.thumbnail_url || hero.file_url} alt="" className="w-6 h-6 rounded-full object-cover" style={{ objectPosition: 'center top' }} />
                {(hero.title || 'Герой').slice(0, 24)}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-zinc-900/70 border border-zinc-800 text-xs text-zinc-300">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={location.thumbnail_url || location.file_url} alt="" className="w-6 h-6 rounded-full object-cover" />
                {(location.title || 'Локация').slice(0, 24)}
              </span>
            )}
          </div>
        )}

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>
        )}

        <div key={step} className="fade-in-up">
        {/* STEP: type — welcome */}
        {step === 'type' && (
          <div className="text-center">
            <div className="flex justify-center mb-5"><Mascot size={110} /></div>
            <h1 className="text-3xl font-semibold text-zinc-50 mb-2">Что снимаем сегодня?</h1>
            <p className="text-zinc-500 mb-10">Я проведу тебя от идеи до готового ролика</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-left">
              {VIDEO_TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setVideoType(t.id); setStep('hero') }}
                  className="group p-5 rounded-2xl bg-zinc-900/50 backdrop-blur border border-zinc-800 hover:border-violet-500/70 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(139,92,246,0.18)] transition-all"
                >
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4 group-hover:bg-violet-500/20 transition-colors">
                    <Icon d={t.icon} />
                  </div>
                  <div className="text-zinc-100 font-medium text-sm mb-1">{t.label}</div>
                  <div className="text-zinc-600 text-xs">{t.hint}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP: hero */}
        {step === 'hero' && (
          <div>
            <Robot typing={typing} line="Кто главный герой? Опиши его — я найду варианты в базе." />
            <div className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"><Icon d={I.search} size={17} /></span>
                <input
                  value={heroQuery}
                  onChange={e => setHeroQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && heroQuery.trim() && search('Character', heroQuery, 0)}
                  placeholder="Например: молодой спортсмен, 25 лет, уверенный"
                  className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-zinc-100 placeholder-zinc-600 focus:border-violet-500 outline-none transition-colors"
                />
              </div>
              <button
                onClick={() => heroQuery.trim() && search('Character', heroQuery, 0)}
                disabled={searching}
                className="px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors shadow-[0_0_20px_rgba(139,92,246,0.25)]"
              >
                {searching ? '…' : 'Найти'}
              </button>
            </div>
            {heroResults.length > 0 && (
              <>
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {heroResults.map(a => (
                    <AssetCard key={a.id} asset={a} selected={hero?.id === a.id} onClick={() => setHero(a)} />
                  ))}
                </div>
                <div className="flex gap-5 mb-7 text-sm">
                  <button onClick={() => search('Character', heroQuery, heroOffset + 4)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={searching}>
                    <Icon d={I.refresh} size={15} /> Ещё варианты
                  </button>
                  <button onClick={() => generateAsset('Character', heroQuery)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={genState === 'working'}>
                    <Icon d={I.sparkles} size={15} /> {genState === 'working' ? 'Генерирую (~20 сек)…' : 'Сгенерировать нового'}
                  </button>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep('type')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"><Icon d={I.arrowL} size={15} /> Назад</button>
              <div className="flex gap-3 items-center">
                <button onClick={() => { setHero(null); setStep('location') }} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Без героя</button>
                <button
                  onClick={() => setStep('location')}
                  disabled={!hero}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition-colors"
                >
                  Дальше <Icon d={I.arrowR} size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: location */}
        {step === 'location' && (
          <div>
            <Robot typing={typing} line="Где происходит действие? Опиши локацию." />
            <div className="flex gap-2 mb-6">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500"><Icon d={I.search} size={17} /></span>
                <input
                  value={locQuery}
                  onChange={e => setLocQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && locQuery.trim() && search('Location', locQuery, 0)}
                  placeholder="Например: вечерний город, неон, дождь"
                  className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-zinc-100 placeholder-zinc-600 focus:border-violet-500 outline-none transition-colors"
                />
              </div>
              <button
                onClick={() => locQuery.trim() && search('Location', locQuery, 0)}
                disabled={searching}
                className="px-5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 transition-colors shadow-[0_0_20px_rgba(139,92,246,0.25)]"
              >
                {searching ? '…' : 'Найти'}
              </button>
            </div>
            {locResults.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {locResults.map(a => (
                    <AssetCard key={a.id} asset={a} selected={location?.id === a.id} onClick={() => setLocation(a)} wide />
                  ))}
                </div>
                <div className="flex gap-5 mb-7 text-sm">
                  <button onClick={() => search('Location', locQuery, locOffset + 4)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={searching}>
                    <Icon d={I.refresh} size={15} /> Ещё варианты
                  </button>
                  <button onClick={() => generateAsset('Location', locQuery)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={genState === 'working'}>
                    <Icon d={I.sparkles} size={15} /> {genState === 'working' ? 'Генерирую (~20 сек)…' : 'Сгенерировать новую'}
                  </button>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <button onClick={() => setStep('hero')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"><Icon d={I.arrowL} size={15} /> Назад</button>
              <div className="flex gap-3 items-center">
                <button onClick={() => { setLocation(null); setStep('action') }} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Пропустить</button>
                <button
                  onClick={() => setStep('action')}
                  disabled={!location}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition-colors"
                >
                  Дальше <Icon d={I.arrowR} size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP: action */}
        {step === 'action' && (
          <div>
            <Robot typing={typing} line="Что происходит в кадре? Опиши действие своими словами." />
            <textarea
              value={action}
              onChange={e => setAction(e.target.value)}
              rows={4}
              placeholder="Например: он бежит по улице, перепрыгивает препятствие, камера показывает кроссовки крупным планом"
              className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:border-violet-500 outline-none mb-7 transition-colors"
            />
            <div className="flex justify-between">
              <button onClick={() => setStep('location')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"><Icon d={I.arrowL} size={15} /> Назад</button>
              <button
                onClick={() => setStep('camera')}
                disabled={!action.trim()}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition-colors"
              >
                Дальше <Icon d={I.arrowR} size={15} />
              </button>
            </div>
          </div>
        )}

        {/* STEP: camera */}
        {step === 'camera' && (
          <div>
            <Robot typing={typing} line="Как работает камера? Выбери — или доверься мне." />
            <SectionLabel icon={I.camera}>Движение</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-6">
              {CAM_MOVES.map(m => <Chip key={m.id} active={camMove === m.id} onClick={() => setCamMove(m.id)}>{m.label}</Chip>)}
            </div>
            <SectionLabel icon={I.user}>План</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-6">
              {FRAMINGS.map(f => <Chip key={f.id} active={framing === f.id} onClick={() => setFraming(f.id)}>{f.label}</Chip>)}
            </div>
            <SectionLabel icon={I.film}>Монтаж</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-9">
              {CUTS.map(c => <Chip key={c.id} active={cuts === c.id} onClick={() => setCuts(c.id)}>{c.label}</Chip>)}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep('action')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"><Icon d={I.arrowL} size={15} /> Назад</button>
              <button onClick={() => setStep('details')} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">Дальше <Icon d={I.arrowR} size={15} /></button>
            </div>
          </div>
        )}

        {/* STEP: details */}
        {step === 'details' && (
          <div>
            <Robot typing={typing} line="Добавим атмосферу? Это по желанию — могу решить сам." />
            <SectionLabel icon={I.sun}>Погода</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-6">
              {WEATHER.map(w => <Chip key={w} active={weather === w} onClick={() => setWeather(weather === w ? '' : w)}>{w}</Chip>)}
            </div>
            <SectionLabel icon={I.sun}>Время суток</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-6">
              {TIME_OF_DAY.map(t => <Chip key={t} active={timeOfDay === t} onClick={() => setTimeOfDay(timeOfDay === t ? '' : t)}>{t}</Chip>)}
            </div>
            <SectionLabel icon={I.sparkles}>Настроение</SectionLabel>
            <div className="flex flex-wrap gap-2 mb-9">
              {MOODS.map(m => <Chip key={m} active={mood === m} onClick={() => setMood(mood === m ? '' : m)}>{m}</Chip>)}
            </div>
            <div className="flex justify-between">
              <button onClick={() => setStep('camera')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"><Icon d={I.arrowL} size={15} /> Назад</button>
              <button onClick={() => setStep('confirm')} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">Дальше <Icon d={I.arrowR} size={15} /></button>
            </div>
          </div>
        )}

        {/* STEP: confirm */}
        {step === 'confirm' && (
          <div>
            <Robot typing={typing} line="Всё готово к съёмке! Проверь и жми «Снимаем»." />
            <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur border border-zinc-800 mb-7">
              <div className="flex gap-3 mb-5">
                {hero && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={hero.thumbnail_url || hero.file_url} alt="hero" className="h-36 w-28 object-cover rounded-xl border border-zinc-800" style={{ objectPosition: 'center top' }} />
                )}
                {location && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={location.thumbnail_url || location.file_url} alt="location" className="h-36 flex-1 object-cover rounded-xl border border-zinc-800" />
                )}
              </div>
              <ul className="text-sm text-zinc-300 space-y-2.5">
                  <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.film} size={15} /></span> {VIDEO_TYPES.find(t => t.id === videoType)?.label}</li>
                  {hero && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.user} size={15} /></span> {hero.title || 'Герой выбран'}</li>}
                  {location && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.pin} size={15} /></span> {location.title || 'Локация выбрана'}</li>}
                  <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.wand} size={15} /></span> {action.slice(0, 70)}{action.length > 70 ? '…' : ''}</li>
                  <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.camera} size={15} /></span> {CAM_MOVES.find(m => m.id === camMove)?.label}, {FRAMINGS.find(f => f.id === framing)?.label}</li>
                {(weather || timeOfDay || mood) && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.sun} size={15} /></span> {[weather, timeOfDay, mood].filter(Boolean).join(', ')}</li>}
              </ul>
            </div>

            <div className="flex flex-wrap items-center gap-4 mb-9">
              <div className="flex gap-2">
                <Chip active={quality === 'draft'} onClick={() => setQuality('draft')}>Черновик · 720p · дёшево</Chip>
                <Chip active={quality === 'final'} onClick={() => setQuality('final')}>Финал · 1080p + звук</Chip>
              </div>
              <div className="flex gap-2">
                {[5, 10, 15].map(d => <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d} сек</Chip>)}
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button onClick={() => setStep('details')} className="flex items-center gap-1.5 text-zinc-500 hover:text-zinc-300 text-sm transition-colors"><Icon d={I.arrowL} size={15} /> Назад</button>
              <button onClick={startRender} className="btn-shimmer glow-pulse flex items-center gap-2.5 px-10 py-3.5 rounded-2xl text-white text-lg font-medium transition-all hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>
                <Icon d={I.clapper} /> Снимаем!
              </button>
            </div>
          </div>
        )}

        {/* STEP: render */}
        {step === 'render' && (
          <div className="text-center py-16">
            <div className="flex justify-center mb-6"><Mascot size={110} /></div>
            <h2 className="text-xl text-zinc-100 font-medium mb-2">Снимаю твой ролик…</h2>
            <p className="text-zinc-500 text-sm mb-10">Обычно это 1–2 минуты</p>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
              <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.max(progress, 5)}%`, background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)' }} />
            </div>
            <p className="text-zinc-600 text-sm mt-3">{progress > 0 ? `${progress}%` : 'В очереди…'}</p>
          </div>
        )}

        {/* STEP: result */}
        {step === 'result' && (
          <div>
            <Robot typing={typing} line="Готово! Вот твой ролик." />
            <video src={videoUrl} controls autoPlay loop className="w-full rounded-2xl border border-zinc-800 mb-6 shadow-[0_8px_40px_rgba(0,0,0,0.5)]" />
            <div className="flex flex-wrap gap-3">
              <a href={videoUrl} download className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                <Icon d={I.download} size={16} /> Скачать
              </a>
              {quality === 'draft' && (
                <button onClick={() => { setQuality('final'); startRender() }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-violet-500/60 text-violet-300 hover:bg-violet-950/40 transition-colors">
                  <Icon d={I.sparkles} size={16} /> Финальное качество
                </button>
              )}
              <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
                Новый ролик
              </button>
            </div>
            <p className="text-zinc-600 text-xs mt-4">Ссылка на видео живёт ~24 часа — скачай сразу.</p>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}
