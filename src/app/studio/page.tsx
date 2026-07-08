'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// CINEMAN AI STUDIO — conversational director agent.
// Retrieval-first: heroes & locations come from the asset base
// (free, instant). Generation is only a fallback. The single
// paid step is the final Seedance render.
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

const VIDEO_TYPES = [
  { id: 'ad', label: 'Рекламный ролик', emoji: '📣' },
  { id: 'film', label: 'Фильм / сцена', emoji: '🎬' },
  { id: 'product', label: 'Продуктовое видео', emoji: '📦' },
  { id: 'music', label: 'Музыкальный клип', emoji: '🎵' },
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

function Robot({ line }: { line: string }) {
  return (
    <div className="flex items-start gap-3 mb-6">
      <div className="relative shrink-0 w-12 h-12 rounded-full bg-gradient-to-b from-zinc-700 to-zinc-900 border border-zinc-600 flex items-center justify-center text-xl shadow-lg shadow-purple-900/30">
        <span aria-hidden>🤖</span>
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-sm" aria-hidden>🎩</span>
      </div>
      <div className="bg-zinc-800/80 border border-zinc-700 rounded-2xl rounded-tl-sm px-4 py-3 text-zinc-100 max-w-xl">
        {line}
      </div>
    </div>
  )
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full border text-sm transition ${
        active
          ? 'bg-purple-600 border-purple-500 text-white'
          : 'bg-zinc-800/60 border-zinc-700 text-zinc-300 hover:border-purple-500/60'
      }`}
    >
      {children}
    </button>
  )
}

function AssetCard({ asset, selected, onClick }: { asset: Asset; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative rounded-xl overflow-hidden border-2 transition text-left ${
        selected ? 'border-purple-500 shadow-lg shadow-purple-900/40' : 'border-zinc-800 hover:border-zinc-600'
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={asset.thumbnail_url || asset.file_url} alt={asset.title} className="w-full aspect-[3/4] object-cover" loading="lazy" />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2">
        <p className="text-xs text-zinc-200 line-clamp-2">{asset.title}</p>
      </div>
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs">✓</div>
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

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

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
    <div className="min-h-screen max-w-3xl mx-auto px-6 py-10">
      {/* progress dots */}
      {stepIndex >= 0 && (
        <div className="flex gap-2 justify-center mb-10">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 rounded-full transition-all ${i <= stepIndex ? 'w-8 bg-purple-500' : 'w-4 bg-zinc-800'}`} />
          ))}
        </div>
      )}

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>
      )}

      {/* STEP: type */}
      {step === 'type' && (
        <div>
          <Robot line="Привет! Я Cineman. Что снимаем сегодня?" />
          <div className="grid grid-cols-2 gap-4">
            {VIDEO_TYPES.map(t => (
              <button
                key={t.id}
                onClick={() => { setVideoType(t.id); setStep('hero') }}
                className="p-6 rounded-2xl bg-zinc-900/80 border border-zinc-800 hover:border-purple-500 transition text-left"
              >
                <div className="text-3xl mb-2">{t.emoji}</div>
                <div className="text-zinc-100 font-medium">{t.label}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* STEP: hero */}
      {step === 'hero' && (
        <div>
          <Robot line="Кто главный герой? Опиши его — я найду варианты в базе." />
          <div className="flex gap-2 mb-6">
            <input
              value={heroQuery}
              onChange={e => setHeroQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && heroQuery.trim() && search('Character', heroQuery, 0)}
              placeholder="Например: молодой спортсмен, 25 лет, уверенный"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-purple-500 outline-none"
            />
            <button
              onClick={() => heroQuery.trim() && search('Character', heroQuery, 0)}
              disabled={searching}
              className="px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
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
              <div className="flex gap-3 mb-6 text-sm">
                <button onClick={() => search('Character', heroQuery, heroOffset + 4)} className="text-zinc-400 hover:text-purple-400" disabled={searching}>
                  Ещё варианты →
                </button>
                <button onClick={() => generateAsset('Character', heroQuery)} className="text-zinc-400 hover:text-purple-400" disabled={genState === 'working'}>
                  {genState === 'working' ? 'Генерирую (~20 сек)…' : '✨ Сгенерировать нового'}
                </button>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep('type')} className="text-zinc-500 hover:text-zinc-300 text-sm">← Назад</button>
            <div className="flex gap-3">
              <button onClick={() => { setHero(null); setStep('location') }} className="text-zinc-500 hover:text-zinc-300 text-sm">Без героя</button>
              <button
                onClick={() => setStep('location')}
                disabled={!hero}
                className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-30"
              >
                Дальше →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP: location */}
      {step === 'location' && (
        <div>
          <Robot line="Где происходит действие? Опиши локацию." />
          <div className="flex gap-2 mb-6">
            <input
              value={locQuery}
              onChange={e => setLocQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && locQuery.trim() && search('Location', locQuery, 0)}
              placeholder="Например: вечерний город, неон, дождь"
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-purple-500 outline-none"
            />
            <button
              onClick={() => locQuery.trim() && search('Location', locQuery, 0)}
              disabled={searching}
              className="px-5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-50"
            >
              {searching ? '…' : 'Найти'}
            </button>
          </div>
          {locResults.length > 0 && (
            <>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {locResults.map(a => (
                  <AssetCard key={a.id} asset={a} selected={location?.id === a.id} onClick={() => setLocation(a)} />
                ))}
              </div>
              <div className="flex gap-3 mb-6 text-sm">
                <button onClick={() => search('Location', locQuery, locOffset + 4)} className="text-zinc-400 hover:text-purple-400" disabled={searching}>
                  Ещё варианты →
                </button>
                <button onClick={() => generateAsset('Location', locQuery)} className="text-zinc-400 hover:text-purple-400" disabled={genState === 'working'}>
                  {genState === 'working' ? 'Генерирую (~20 сек)…' : '✨ Сгенерировать новую'}
                </button>
              </div>
            </>
          )}
          <div className="flex justify-between">
            <button onClick={() => setStep('hero')} className="text-zinc-500 hover:text-zinc-300 text-sm">← Назад</button>
            <div className="flex gap-3">
              <button onClick={() => { setLocation(null); setStep('action') }} className="text-zinc-500 hover:text-zinc-300 text-sm">Пропустить</button>
              <button
                onClick={() => setStep('action')}
                disabled={!location}
                className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-30"
              >
                Дальше →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP: action */}
      {step === 'action' && (
        <div>
          <Robot line="Что происходит в кадре? Опиши действие своими словами." />
          <textarea
            value={action}
            onChange={e => setAction(e.target.value)}
            rows={4}
            placeholder="Например: он бежит по улице, перепрыгивает препятствие, камера показывает кроссовки крупным планом"
            className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-purple-500 outline-none mb-6"
          />
          <div className="flex justify-between">
            <button onClick={() => setStep('location')} className="text-zinc-500 hover:text-zinc-300 text-sm">← Назад</button>
            <button
              onClick={() => setStep('camera')}
              disabled={!action.trim()}
              className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-30"
            >
              Дальше →
            </button>
          </div>
        </div>
      )}

      {/* STEP: camera */}
      {step === 'camera' && (
        <div>
          <Robot line="Как работает камера? Выбери — или доверься мне." />
          <p className="text-zinc-500 text-sm mb-2">Движение</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {CAM_MOVES.map(m => <Chip key={m.id} active={camMove === m.id} onClick={() => setCamMove(m.id)}>{m.label}</Chip>)}
          </div>
          <p className="text-zinc-500 text-sm mb-2">План</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {FRAMINGS.map(f => <Chip key={f.id} active={framing === f.id} onClick={() => setFraming(f.id)}>{f.label}</Chip>)}
          </div>
          <p className="text-zinc-500 text-sm mb-2">Монтаж</p>
          <div className="flex flex-wrap gap-2 mb-8">
            {CUTS.map(c => <Chip key={c.id} active={cuts === c.id} onClick={() => setCuts(c.id)}>{c.label}</Chip>)}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep('action')} className="text-zinc-500 hover:text-zinc-300 text-sm">← Назад</button>
            <button onClick={() => setStep('details')} className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white">Дальше →</button>
          </div>
        </div>
      )}

      {/* STEP: details */}
      {step === 'details' && (
        <div>
          <Robot line="Добавим атмосферу? Это по желанию — могу решить сам." />
          <p className="text-zinc-500 text-sm mb-2">Погода</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {WEATHER.map(w => <Chip key={w} active={weather === w} onClick={() => setWeather(weather === w ? '' : w)}>{w}</Chip>)}
          </div>
          <p className="text-zinc-500 text-sm mb-2">Время суток</p>
          <div className="flex flex-wrap gap-2 mb-5">
            {TIME_OF_DAY.map(t => <Chip key={t} active={timeOfDay === t} onClick={() => setTimeOfDay(timeOfDay === t ? '' : t)}>{t}</Chip>)}
          </div>
          <p className="text-zinc-500 text-sm mb-2">Настроение</p>
          <div className="flex flex-wrap gap-2 mb-8">
            {MOODS.map(m => <Chip key={m} active={mood === m} onClick={() => setMood(mood === m ? '' : m)}>{m}</Chip>)}
          </div>
          <div className="flex justify-between">
            <button onClick={() => setStep('camera')} className="text-zinc-500 hover:text-zinc-300 text-sm">← Назад</button>
            <button onClick={() => setStep('confirm')} className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white">Дальше →</button>
          </div>
        </div>
      )}

      {/* STEP: confirm */}
      {step === 'confirm' && (
        <div>
          <Robot line="Всё готово к съёмке! Проверь и жми «Снимаем»." />
          <div className="grid grid-cols-[auto_1fr] gap-6 mb-8">
            <div className="flex gap-3">
              {hero && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={hero.thumbnail_url || hero.file_url} alt="hero" className="w-24 h-32 object-cover rounded-lg border border-zinc-700" />
              )}
              {location && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={location.thumbnail_url || location.file_url} alt="location" className="w-24 h-32 object-cover rounded-lg border border-zinc-700" />
              )}
            </div>
            <ul className="text-sm text-zinc-300 space-y-2">
              <li>✅ Тип — {VIDEO_TYPES.find(t => t.id === videoType)?.label}</li>
              {hero && <li>✅ Герой — {hero.title}</li>}
              {location && <li>✅ Локация — {location.title}</li>}
              <li>✅ Действие — {action.slice(0, 80)}{action.length > 80 ? '…' : ''}</li>
              <li>✅ Камера — {CAM_MOVES.find(m => m.id === camMove)?.label}, {FRAMINGS.find(f => f.id === framing)?.label}</li>
              {(weather || timeOfDay || mood) && <li>✅ Атмосфера — {[weather, timeOfDay, mood].filter(Boolean).join(', ')}</li>}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-4 mb-8">
            <div className="flex gap-2">
              <Chip active={quality === 'draft'} onClick={() => setQuality('draft')}>Черновик · 720p · дёшево</Chip>
              <Chip active={quality === 'final'} onClick={() => setQuality('final')}>Финал · 1080p + звук</Chip>
            </div>
            <div className="flex gap-2">
              {[5, 10, 15].map(d => <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d} сек</Chip>)}
            </div>
          </div>

          <div className="flex justify-between items-center">
            <button onClick={() => setStep('details')} className="text-zinc-500 hover:text-zinc-300 text-sm">← Назад</button>
            <button onClick={startRender} className="px-10 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-lg font-medium shadow-lg shadow-purple-900/50">
              🎬 Снимаем!
            </button>
          </div>
        </div>
      )}

      {/* STEP: render */}
      {step === 'render' && (
        <div className="text-center py-20">
          <div className="text-5xl mb-6 animate-bounce">🎬</div>
          <Robot line="Снимаю твой ролик… Обычно это 1–2 минуты." />
          <div className="w-full bg-zinc-800 rounded-full h-2 mt-8 overflow-hidden">
            <div className="bg-purple-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.max(progress, 5)}%` }} />
          </div>
          <p className="text-zinc-500 text-sm mt-3">{progress > 0 ? `${progress}%` : 'В очереди…'}</p>
        </div>
      )}

      {/* STEP: result */}
      {step === 'result' && (
        <div>
          <Robot line="Готово! Вот твой ролик." />
          <video src={videoUrl} controls autoPlay loop className="w-full rounded-2xl border border-zinc-700 mb-6" />
          <div className="flex gap-4">
            <a href={videoUrl} download className="px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white">Скачать</a>
            {quality === 'draft' && (
              <button onClick={() => { setQuality('final'); startRender() }} className="px-6 py-2 rounded-xl border border-purple-500 text-purple-400 hover:bg-purple-950/50">
                Перегенерить в финальном качестве
              </button>
            )}
            <button onClick={() => window.location.reload()} className="px-6 py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:text-zinc-200">
              Новый ролик
            </button>
          </div>
          <p className="text-zinc-600 text-xs mt-4">Ссылка на видео живёт ~24 часа — скачай сразу.</p>
        </div>
      )}
    </div>
  )
}
