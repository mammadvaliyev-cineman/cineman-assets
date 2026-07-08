'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ENGINE_CATS, DEFAULT_ENGINE_CONFIG, EngineConfig } from '@/lib/engine'

// ─────────────────────────────────────────────────────────────
// CINEMAN AI STUDIO — chat-first director agent.
// Работает как чат (Claude/GPT): лента сообщений, строка ввода
// с голосом, готовые варианты чипсами из Cineman Engine.
// Retrieval-first: герои и локации из базы, генерация — fallback.
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

// ── Thin line icons (lucide-style) ───────────────────────────
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
  wand: 'M15 4V2|M15 16v-2|M8 9h2|M20 9h2|M17.8 11.8L19 13|M17.8 6.2L19 5|M12.2 6.2L11 5|M12 22l5-5-8-8-5 5 8 8z',
  check: 'M20 6L9 17l-5-5',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M7 10l5 5 5-5|M12 15V3',
  film: 'M19.8 3H4.2A1.2 1.2 0 0 0 3 4.2v15.6A1.2 1.2 0 0 0 4.2 21h15.6a1.2 1.2 0 0 0 1.2-1.2V4.2A1.2 1.2 0 0 0 19.8 3z|M7 3v18|M17 3v18|M3 7.5h4|M3 12h18|M3 16.5h4|M17 7.5h4|M17 16.5h4',
  arrowR: 'M5 12h14|M12 5l7 7-7 7',
  arrowL: 'M19 12H5|M12 19l-7-7 7-7',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M12 1v2|M12 21v2|M4.2 4.2l1.4 1.4|M18.4 18.4l1.4 1.4|M1 12h2|M21 12h2|M4.2 19.8l1.4-1.4|M18.4 5.6l1.4-1.4',
  mic: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z|M19 10v2a7 7 0 0 1-14 0v-2|M12 19v4|M8 23h8',
  send: 'M22 2L11 13|M22 2l-7 20-4-9-9-4 20-7z',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2',
  cloud: 'M17.5 19a4.5 4.5 0 0 0 .42-8.98 7 7 0 0 0-13.42 1.9A4 4 0 0 0 6 19h11.5',
  aperture: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M14.3 8L8.6 4.7|M9.7 8h6.9|M12 12l-3.5 6.1|M9.7 16L6.2 9.9|M14.3 16H7.4|M12 12l3.5-6.1|M15.4 9.9l3.4 5.8',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  palette: 'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-2 2c0 1 .5 1.5.5 2.5S13.5 21 12 21z|M7.5 11a1 1 0 1 0 0-2|M12 8a1 1 0 1 0 0-2|M16.5 11a1 1 0 1 0 0-2',
  sliders: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6',
  smile: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M8 14s1.5 2 4 2 4-2 4-2|M9 9h.01|M15 9h.01',
  videoCam: 'M23 7l-7 5 7 5V7z|M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  frame: 'M3 7V5a2 2 0 0 1 2-2h2|M17 3h2a2 2 0 0 1 2 2v2|M21 17v2a2 2 0 0 1-2 2h-2|M7 21H5a2 2 0 0 1-2-2v-2|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M16 8l-2.5 5.5L8 16l2.5-5.5L16 8z',
}

// ── RU-названия значений движка (профи-термины остаются EN) ──
const RU_VAL: Record<string, string> = {
  // weather
  'Clear': 'Ясно', 'Light breeze': 'Лёгкий бриз', 'Windy': 'Ветрено', 'Snow': 'Снег',
  'Snowstorm': 'Метель', 'Rain': 'Дождь', 'Downpour': 'Ливень', 'Thunderstorm': 'Гроза',
  'Fog': 'Туман', 'Heat haze': 'Марево', 'Overcast': 'Пасмурно', 'Drizzle': 'Морось',
  'Dust in light': 'Пыль в лучах', 'Steam': 'Пар', 'God rays': 'Лучи света',
  'Volumetric fog': 'Объёмный туман', 'Floating particles': 'Частицы', 'Embers': 'Искры',
  'Falling leaves': 'Листопад',
  // time
  'Sunrise': 'Рассвет', 'Morning': 'Утро', 'Midday': 'Полдень', 'Afternoon': 'День',
  'Golden hour': 'Золотой час', 'Sunset': 'Закат', 'Blue hour': 'Синий час',
  'Night': 'Ночь', 'Midnight': 'Полночь', 'Dawn': 'Заря',
  // genre
  'Drama': 'Драма', 'Thriller': 'Триллер', 'Comedy': 'Комедия', 'Romance': 'Романтика',
  'Horror': 'Хоррор', 'Action': 'Экшн', 'Noir': 'Нуар', 'Documentary': 'Доку',
  'Fantasy': 'Фэнтези', 'Western': 'Вестерн', 'Commercial': 'Реклама', 'Poetic': 'Поэтика',
  'Melancholic': 'Меланхолия', 'Nightmare': 'Кошмар', 'Catastrophic': 'Катастрофа',
  'War': 'Война', 'Travel': 'Тревел', 'Sport': 'Спорт',
  // shot size
  'Extreme wide': 'Сверхобщий', 'Wide': 'Общий', 'Full shot': 'В полный рост',
  'Medium': 'Средний', 'Medium close-up': 'Средне-крупный', 'Close-up': 'Крупный',
  'Extreme close-up': 'Сверхкрупный', 'Insert / detail': 'Деталь',
  'Over-the-shoulder': 'Через плечо', 'Two-shot': 'Двое в кадре',
  // light (часть)
  'Natural': 'Естественный', 'Soft key': 'Мягкий свет', 'Hard contrast': 'Жёсткий контраст',
  'Neon practical': 'Неон', 'Backlit rim': 'Контровой', 'Window daylight': 'Свет из окна',
  'Candlelight': 'Свечи', 'Silhouette': 'Силуэт', 'Lens flare': 'Блики',
  'Warm sunlight': 'Тёплое солнце', 'Dark dramatic': 'Тёмный драматичный',
  // camera (базовые)
  'Static': 'Статика',
}
const ruVal = (label: string) => RU_VAL[label] || label

// Иконки категорий движка для карточек
const CAT_ICON: Record<string, string> = {
  camera: 'M23 7l-7 5 7 5V7z|M14 5H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2z',
  shottype: 'M3 7V5a2 2 0 0 1 2-2h2|M17 3h2a2 2 0 0 1 2 2v2|M21 17v2a2 2 0 0 1-2 2h-2|M7 21H5a2 2 0 0 1-2-2v-2|M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  angle: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M16 8l-2.5 5.5L8 16l2.5-5.5L16 8z',
  lens: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M14.3 8L8.6 4.7|M9.7 8h6.9|M12 12l-3.5 6.1|M9.7 16L6.2 9.9|M14.3 16H7.4|M12 12l3.5-6.1|M15.4 9.9l3.4 5.8',
  focus: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  camtype: 'M19.8 3H4.2A1.2 1.2 0 0 0 3 4.2v15.6A1.2 1.2 0 0 0 4.2 21h15.6a1.2 1.2 0 0 0 1.2-1.2V4.2A1.2 1.2 0 0 0 19.8 3z|M7 3v18|M17 3v18|M3 7.5h4|M3 12h18|M3 16.5h4|M17 7.5h4|M17 16.5h4',
  light: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z|M12 1v2|M12 21v2|M4.2 4.2l1.4 1.4|M18.4 18.4l1.4 1.4|M1 12h2|M21 12h2|M4.2 19.8l1.4-1.4|M18.4 5.6l1.4-1.4',
  time: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M12 7v5l3 2',
  weather: 'M17.5 19a4.5 4.5 0 0 0 .42-8.98 7 7 0 0 0-13.42 1.9A4 4 0 0 0 6 19h11.5',
  genre: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z|M8 14s1.5 2 4 2 4-2 4-2|M9 9h.01|M15 9h.01',
  styles: 'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3 3h-2a2 2 0 0 0-2 2c0 1 .5 1.5.5 2.5S13.5 21 12 21z|M7.5 11a1 1 0 1 0 0-2|M12 8a1 1 0 1 0 0-2|M16.5 11a1 1 0 1 0 0-2',
  colorgrade: 'M4 21v-7|M4 10V3|M12 21v-9|M12 8V3|M20 21v-5|M20 12V3|M1 14h6|M9 8h6|M17 16h6',
  music: 'M9 18V5l12-2v13|M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0z|M21 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  delivery: 'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z|M19 10v2a7 7 0 0 1-14 0v-2|M12 19v4|M8 23h8',
}

const VIDEO_TYPES = [
  { id: 'ad', label: 'Рекламный ролик', icon: I.megaphone, hint: 'Продукт, бренд, промо' },
  { id: 'film', label: 'Фильм / сцена', icon: I.clapper, hint: 'Кино, драма, экшн' },
  { id: 'product', label: 'Продуктовое видео', icon: I.box, hint: 'Обзор, демонстрация' },
  { id: 'music', label: 'Музыкальный клип', icon: I.music, hint: 'Ритм, стиль, вайб' },
]

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: 'type', label: 'Тип' },
  { id: 'hero', label: 'Герой' },
  { id: 'location', label: 'Локация' },
  { id: 'action', label: 'Действие' },
  { id: 'camera', label: 'Камера' },
  { id: 'details', label: 'Атмосфера' },
  { id: 'confirm', label: 'Финал' },
]

// Engine categories per step + RU titles
const CAMERA_CATS = ['camera', 'shottype', 'angle', 'lens', 'focus', 'camtype']
const DETAIL_CATS = ['light', 'time', 'weather', 'genre', 'styles', 'colorgrade', 'music', 'delivery']
const RU_CAT: Record<string, string> = {
  camera: 'Движение камеры', shottype: 'Крупность', angle: 'Ракурс', lens: 'Объектив',
  focus: 'Фокус', camtype: 'Тип камеры', light: 'Свет', time: 'Время суток',
  weather: 'Погода', genre: 'Жанр / настроение', styles: 'Стиль', colorgrade: 'Цветокор',
  music: 'Музыка', delivery: 'Подача голоса',
}

const BOT_LINES: Record<Step, string> = {
  type: 'Что снимаем сегодня? Выбери тип — или опиши своими словами.',
  hero: 'Кто главный герой? Опиши его — я найду варианты в базе.',
  location: 'Где происходит действие? Опиши локацию.',
  action: 'Что происходит в кадре? Напиши текстом или надиктуй голосом.',
  camera: 'Как работает камера? Выбери из вариантов — или доверься мне.',
  details: 'Добавим атмосферу? Это по желанию — могу решить сам.',
  confirm: 'Всё готово! Проверь сцену и жми Generate.',
  render: 'Снимаю твой ролик…',
  result: 'Готово! Вот твой ролик.',
}

const PLACEHOLDERS: Record<Step, string> = {
  type: 'Или напиши свой формат: тревел-влог, тизер…',
  hero: 'Например: молодой спортсмен, 25 лет, уверенный',
  location: 'Например: вечерний город, неон, дождь',
  action: 'Например: он бежит по улице и смотрит в камеру',
  camera: 'Уточнение для режиссёра (необязательно)…',
  details: 'Уточнение по атмосфере (необязательно)…',
  confirm: 'Финальное уточнение сцены (необязательно)…',
  render: '',
  result: '',
}

// ── Living mascot: floats, blinks, switches expressions ──────
// Ищет PNG-эмоции в /public; чего нет — работает на neutral.
const EXPR_SRC: Record<string, string> = {
  neutral: '/cineman-neutral.png',
  blink: '/cineman-blink.png',
  thinking: '/cineman-thinking.png',
  happy: '/cineman-happy.png',
  excited: '/cineman-excited.png',
  talking: '/cineman-talking.png',
}
const FALLBACK_SRC = '/cineman-mascot.png'
let exprCache: Record<string, boolean> | null = null
let exprPromise: Promise<Record<string, boolean>> | null = null
function probeExpressions(): Promise<Record<string, boolean>> {
  if (exprCache) return Promise.resolve(exprCache)
  if (!exprPromise) {
    exprPromise = Promise.all(
      Object.entries(EXPR_SRC).map(([k, src]) => new Promise<[string, boolean]>(res => {
        const img = new Image()
        img.onload = () => res([k, true])
        img.onerror = () => res([k, false])
        img.src = src
      })),
    ).then(pairs => { exprCache = Object.fromEntries(pairs); return exprCache })
  }
  return exprPromise
}

function Mascot({ size = 96, mood = 'neutral' }: { size?: number; mood?: string }) {
  const [avail, setAvail] = useState<Record<string, boolean>>(exprCache || {})
  const [blinking, setBlinking] = useState(false)
  useEffect(() => { probeExpressions().then(setAvail) }, [])
  useEffect(() => {
    if (!avail.blink) return
    let alive = true
    let t: ReturnType<typeof setTimeout>
    const loop = () => {
      t = setTimeout(() => {
        if (!alive) return
        setBlinking(true)
        setTimeout(() => { if (alive) setBlinking(false); loop() }, 150)
      }, 2600 + Math.random() * 2400)
    }
    loop()
    return () => { alive = false; clearTimeout(t) }
  }, [avail.blink])

  const pick = blinking && avail.blink ? 'blink' : (avail[mood] ? mood : (avail.neutral ? 'neutral' : ''))
  const src = pick ? EXPR_SRC[pick] : FALLBACK_SRC
  const amp = Math.max(6, Math.round(size * 0.14))
  return (
    <span className="relative inline-flex flex-col items-center shrink-0" style={{ width: size }}>
      <style>{`
        @keyframes cinemanFloat { 0%, 100% { transform: translateY(0) rotate(-3deg) } 25% { transform: translateY(-${Math.round(amp * 0.6)}px) rotate(0deg) } 50% { transform: translateY(-${amp}px) rotate(3deg) } 75% { transform: translateY(-${Math.round(amp * 0.5)}px) rotate(0.5deg) } }
        @keyframes cinemanShadow { 0%, 100% { transform: scaleX(1); opacity: 0.5 } 50% { transform: scaleX(0.6); opacity: 0.22 } }
      `}</style>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        onError={e => { const el = e.target as HTMLImageElement; if (el.src.indexOf(FALLBACK_SRC) < 0) el.src = FALLBACK_SRC; else el.style.visibility = 'hidden' }}
        className="shrink-0 object-contain"
        style={{ width: size, height: size, animation: 'cinemanFloat 2.6s ease-in-out infinite', filter: 'drop-shadow(0 10px 20px rgba(139,92,246,0.4))' }}
      />
      {size >= 60 && (
        <span
          aria-hidden
          style={{
            width: Math.round(size * 0.5),
            height: Math.max(4, Math.round(size * 0.06)),
            borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(139,92,246,0.5), transparent)',
            animation: 'cinemanShadow 2.6s ease-in-out infinite',
            marginTop: 3,
          }}
        />
      )}
    </span>
  )
}

function Chip({ active, onClick, children }: { active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full border text-[13px] transition-all ${
        active
          ? 'bg-violet-600 border-violet-400/60 text-white shadow-[0_0_16px_rgba(139,92,246,0.35)]'
          : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:border-violet-500/50 hover:text-zinc-100'
      }`}
    >
      {children}
    </button>
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

// Категории движка — карточки с иконками (как в референсе), клик
// открывает вопрос «Категория?» и варианты чипсами.
function CategoryPicker({
  cats, engineSel, onPick, openCat, setOpenCat, expanded, onToggleExpand,
}: {
  cats: string[]
  engineSel: Record<string, string>
  onPick: (catId: string, label: string) => void
  openCat: string | null
  setOpenCat: (c: string | null) => void
  expanded: Record<string, boolean>
  onToggleExpand: (c: string) => void
}) {
  const open = openCat && cats.includes(openCat) ? openCat : null
  const cat = open ? ENGINE_CATS[open] : null
  const items = cat ? (expanded[open!] ? cat.items : cat.items.slice(0, 10)) : []
  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-6">
        {cats.map(c => {
          const sel = engineSel[c]
          const isOpen = open === c
          return (
            <button
              key={c}
              onClick={() => setOpenCat(isOpen ? null : c)}
              className={`p-4 rounded-2xl border text-center transition-all ${
                isOpen
                  ? 'border-violet-400/70 bg-violet-500/10 shadow-[0_0_20px_rgba(139,92,246,0.25)]'
                  : sel
                    ? 'border-violet-500/40 bg-violet-500/5'
                    : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-600 hover:-translate-y-0.5'
              }`}
            >
              <div className={`mx-auto mb-2.5 w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                isOpen || sel ? 'text-violet-300 bg-violet-500/15 border border-violet-500/30' : 'text-zinc-400 bg-zinc-800/60 border border-zinc-700/50'
              }`}>
                <Icon d={CAT_ICON[c] || CAT_ICON.camera} size={19} />
              </div>
              <div className="text-[13px] text-zinc-200 leading-tight">{RU_CAT[c] || c}</div>
              {sel ? (
                <div className="text-[11px] text-violet-300 mt-1 truncate">{ruVal(sel)}</div>
              ) : (
                <div className="text-[11px] text-zinc-600 mt-1">—</div>
              )}
            </button>
          )
        })}
      </div>
      {open && cat && (
        <div className="fade-in-up mb-2" key={open}>
          <div className="inline-block bg-zinc-900/80 border border-zinc-800 rounded-2xl rounded-bl-md px-4 py-2 text-zinc-200 text-sm mb-3">
            {RU_CAT[open] || open}?
          </div>
          <div className="flex flex-wrap gap-1.5">
            {items.map(([label]) => (
              <Chip key={label} active={engineSel[open] === label} onClick={() => onPick(open, engineSel[open] === label ? '' : label)}>
                {ruVal(label)}
              </Chip>
            ))}
            {cat.items.length > 10 && (
              <button onClick={() => onToggleExpand(open)} className="px-3 py-1.5 rounded-full text-[13px] text-violet-400 hover:text-violet-300 transition-colors">
                {expanded[open] ? 'Свернуть' : `+${cat.items.length - 10} ещё`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Web Speech API (голосовой ввод, ru-RU) ───────────────────
type SpeechRec = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
}
function getSpeechRec(): SpeechRec | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { webkitSpeechRecognition?: new () => SpeechRec; SpeechRecognition?: new () => SpeechRec }
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

export default function StudioPage() {
  const [step, setStep] = useState<Step>('type')
  const [videoType, setVideoType] = useState<string>('')
  const [customType, setCustomType] = useState('')

  // hero / location
  const [heroQuery, setHeroQuery] = useState('')
  const [locQuery, setLocQuery] = useState('')
  const [heroResults, setHeroResults] = useState<Asset[]>([])
  const [locResults, setLocResults] = useState<Asset[]>([])
  const [heroOffset, setHeroOffset] = useState(0)
  const [locOffset, setLocOffset] = useState(0)
  const [heroMatched, setHeroMatched] = useState<number | null>(null)
  const [locMatched, setLocMatched] = useState<number | null>(null)
  const [heroes, setHeroes] = useState<Asset[]>([]) // cast: до 4 героев
  const [location, setLocation] = useState<Asset | null>(null)
  const [searching, setSearching] = useState(false)
  const [genState, setGenState] = useState<'idle' | 'working'>('idle')

  // scene
  const [action, setAction] = useState('')
  const [extraNote, setExtraNote] = useState('')
  const [engineSel, setEngineSel] = useState<Record<string, string>>({})
  const [expandedCat, setExpandedCat] = useState<Record<string, boolean>>({})
  const [engineCfg, setEngineCfg] = useState<EngineConfig>(DEFAULT_ENGINE_CONFIG)
  const [openCat, setOpenCat] = useState<string | null>(null)

  // render
  const [quality, setQuality] = useState<'draft' | 'final'>('draft')
  const [duration, setDuration] = useState(5)
  const [progress, setProgress] = useState(0)
  const [videoUrl, setVideoUrl] = useState('')
  const [error, setError] = useState('')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [typing, setTyping] = useState(false)
  const [speaking, setSpeaking] = useState(false)

  // chat input + voice
  const [input, setInput] = useState('')
  const [micOn, setMicOn] = useState(false)
  const recRef = useRef<SpeechRec | null>(null)
  const chatRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  useEffect(() => {
    fetch('/api/engine').then(r => r.json()).then(d => { if (d.config) setEngineCfg(d.config) }).catch(() => {})
  }, [])

  useEffect(() => {
    setTyping(true)
    setSpeaking(false)
    // печатает → говорит (рот двигается) → нейтральный
    const t = setTimeout(() => { setTyping(false); setSpeaking(true) }, 650)
    const t2 = setTimeout(() => setSpeaking(false), 2800)
    if (chatRef.current) chatRef.current.scrollTop = 0
    return () => { clearTimeout(t); clearTimeout(t2) }
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
      if (assetType === 'Character') { setHeroResults(json.results); setHeroOffset(offset); setHeroMatched(json.matched ?? null) }
      else { setLocResults(json.results); setLocOffset(offset); setLocMatched(json.matched ?? null) }
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
      await new Promise<void>((resolve, reject) => {
        const iv = setInterval(async () => {
          const r = await fetch(`/api/studio/generate?taskId=${taskId}&assetType=${assetType}&title=${encodeURIComponent(description.slice(0, 60))}&description=${encodeURIComponent(description)}`)
          const j = await r.json()
          if (j.state === 'success' && j.asset) {
            clearInterval(iv)
            if (assetType === 'Character') { setHeroes(prev => [...prev, j.asset].slice(0, 4)); setHeroResults(prev => [j.asset, ...prev].slice(0, 4)); setHeroMatched(1) }
            else { setLocation(j.asset); setLocResults(prev => [j.asset, ...prev].slice(0, 4)); setLocMatched(1) }
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
  }, [])

  const startRender = useCallback(async () => {
    setStep('render')
    setProgress(0)
    setError('')
    try {
      const fullAction = [action, extraNote].filter(Boolean).join('. ')
      const compileRes = await fetch('/api/studio/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoType: videoType || 'other',
          heroes: heroes.map(h => ({ title: h.title, description: h.description })),
          location: location ? { title: location.title, description: location.description } : null,
          action: fullAction,
          engine: engineSel,
          masterPreset: engineCfg.masterPreset,
        }),
      })
      const { prompt, error: cErr } = await compileRes.json()
      if (cErr) throw new Error(cErr)

      const refs = [...heroes.map(h => h.file_url), location?.file_url].filter(Boolean)
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
  }, [videoType, heroes, location, action, extraNote, engineSel, engineCfg.masterPreset, quality, duration])

  // ── chat input: контекстное действие по шагу ────────────────
  const submitInput = useCallback(() => {
    const text = input.trim()
    if (!text) return
    setInput('')
    if (step === 'type') { setVideoType('other'); setCustomType(text); setStep('hero') }
    else if (step === 'hero') { setHeroQuery(text); search('Character', text, 0) }
    else if (step === 'location') { setLocQuery(text); search('Location', text, 0) }
    else if (step === 'action') { setAction(text); setStep('camera') }
    else { setExtraNote(prev => (prev ? prev + '. ' : '') + text) }
  }, [input, step, search])

  const toggleMic = useCallback(() => {
    if (micOn) { recRef.current?.stop(); setMicOn(false); return }
    const rec = getSpeechRec()
    if (!rec) { setError('Голосовой ввод не поддерживается в этом браузере — попробуй Chrome'); return }
    rec.lang = 'ru-RU'
    rec.continuous = false
    rec.interimResults = true
    rec.onresult = e => {
      const t = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' ')
      setInput(t)
    }
    rec.onend = () => setMicOn(false)
    rec.onerror = () => setMicOn(false)
    recRef.current = rec
    setMicOn(true)
    rec.start()
  }, [micOn])

  const STEPS: Step[] = ['type', 'hero', 'location', 'action', 'camera', 'details', 'confirm']
  const stepIndex = STEPS.indexOf(step)

  const mood = searching || genState === 'working' || step === 'render' ? 'thinking'
    : speaking ? 'talking'
    : step === 'result' ? 'happy'
    : step === 'confirm' ? 'excited'
    : 'neutral'

  // Живые подсказки: маскот ведёт за руку по шагам
  let botLine = BOT_LINES[step]
  if (step === 'hero' && heroResults.length > 0) botLine = heroes.length > 0
    ? `Отлично, выбрано: ${heroes.length}. Можешь добавить ещё героев — или жми «Дальше», выберем локацию!`
    : 'Выбери героя — можно сразу нескольких! Дальше выберем локацию.'
  if (step === 'location' && locResults.length > 0) botLine = location
    ? 'Локация выбрана! Жми «Дальше» — опишем действие.'
    : 'Выбери локацию — и переходим к действию.'

  // История ответов — клик возвращает на шаг
  const history: { step: Step; q: string; a: string }[] = []
  if (stepIndex > 0 || step === 'render' || step === 'result') {
    const past = (s: Step) => STEPS.indexOf(s) < (stepIndex === -1 ? STEPS.length : stepIndex)
    if (past('hero') || stepIndex === -1) history.push({ step: 'type', q: BOT_LINES.type, a: customType || VIDEO_TYPES.find(t => t.id === videoType)?.label || '—' })
    if (past('location')) history.push({ step: 'hero', q: BOT_LINES.hero, a: heroes.length ? heroes.map(h => h.title).join(', ') : 'Без героя' })
    if (past('action')) history.push({ step: 'location', q: BOT_LINES.location, a: location ? location.title : 'Пропущено' })
    if (past('camera')) history.push({ step: 'action', q: BOT_LINES.action, a: action.slice(0, 80) + (action.length > 80 ? '…' : '') })
    if (past('details')) {
      const camSel = CAMERA_CATS.map(c => engineSel[c]).filter(Boolean).map(ruVal).join(', ')
      history.push({ step: 'camera', q: BOT_LINES.camera, a: camSel || 'На усмотрение Cineman' })
    }
    if (past('confirm')) {
      const detSel = DETAIL_CATS.map(c => engineSel[c]).filter(Boolean).map(ruVal).join(', ')
      history.push({ step: 'details', q: BOT_LINES.details, a: detSel || 'На усмотрение Cineman' })
    }
  }

  const visibleCameraCats = CAMERA_CATS.filter(c => engineCfg.visible[c])
  const visibleDetailCats = DETAIL_CATS.filter(c => engineCfg.visible[c])
  const canSend = step !== 'render' && step !== 'result'

  const noMatchBanner = (matched: number | null, kind: 'Character' | 'Location', query: string) =>
    matched === 0 ? (
      <div className="mb-4 px-4 py-3 rounded-xl bg-amber-950/40 border border-amber-700/40 text-amber-200/90 text-sm fade-in-up">
        Точного совпадения в базе нет — показываю ближайшее похожее. Могу{' '}
        <button
          onClick={() => generateAsset(kind, query)}
          disabled={genState === 'working'}
          className="underline decoration-amber-400/60 hover:text-amber-100 font-medium"
        >
          сгенерировать {kind === 'Character' ? 'нового героя' : 'новую локацию'}
        </button>{' '}
        по твоему описанию.
      </div>
    ) : null

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(800px 480px at 50% -100px, rgba(124,58,237,0.18), transparent 70%)' }} />

      {/* ЭКРАН — большая округлая рамка студии */}
      <div className="relative max-w-4xl mx-auto px-4 py-8">
        <div
          className="rounded-[2rem] border border-zinc-800/80 bg-zinc-950/60 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.04)] overflow-hidden flex flex-col"
          style={{ minHeight: 'calc(100vh - 4rem)' }}
        >
          {/* Шапка экрана: маскот + имя + шаги */}
          <div className="px-6 pt-6 pb-4 border-b border-zinc-800/60" style={{ background: 'linear-gradient(180deg, rgba(139,92,246,0.07), transparent)' }}>
            <div className="flex items-center gap-4 mb-4">
              <Mascot size={step === 'type' ? 180 : 132} mood={mood} />
              <div>
                <p className="text-zinc-50 font-semibold text-lg leading-tight">Cineman</p>
                <p className="text-violet-400/80 text-xs">AI-режиссёр · онлайн</p>
              </div>
            </div>
            {stepIndex >= 0 && (
              <div className="flex flex-wrap gap-1.5">
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
                      <span className="flex items-center justify-center rounded-full text-[10px] font-bold" style={{ width: 16, height: 16, background: isCurrent ? 'rgba(255,255,255,0.25)' : isPast ? 'rgba(139,92,246,0.3)' : 'rgba(63,63,70,0.6)' }}>
                        {isPast ? '✓' : i + 1}
                      </span>
                      {sl.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Лента чата */}
          <div ref={chatRef} className="flex-1 overflow-y-auto px-6 py-6">
            {/* История: вопрос бота + ответ юзера (клик = вернуться) */}
            {history.map(h => (
              <div key={h.step} className="mb-4">
                <div className="flex items-start gap-2.5 mb-2">
                  <div className="w-7 h-7 shrink-0"><Mascot size={28} /></div>
                  <div className="bg-zinc-900/60 border border-zinc-800/70 rounded-2xl rounded-tl-md px-4 py-2 text-zinc-400 text-sm max-w-lg">{h.q}</div>
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => canSend && setStep(h.step)}
                    title="Нажми, чтобы изменить"
                    className="bg-violet-600/20 border border-violet-500/30 hover:border-violet-400/60 rounded-2xl rounded-tr-md px-4 py-2 text-violet-100 text-sm max-w-md text-left transition-colors"
                  >
                    {h.a}
                  </button>
                </div>
              </div>
            ))}

            {/* Текущее сообщение бота */}
            <div className="flex items-end gap-3 mb-6" key={`bot-${step}`}>
              <div className="w-14 h-14 shrink-0"><Mascot size={56} mood={mood} /></div>
              <div className="bg-zinc-900/80 backdrop-blur border border-zinc-800 rounded-3xl rounded-bl-md px-5 py-3.5 text-zinc-100 text-[15px] leading-relaxed max-w-xl shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                {typing ? (
                  <span className="flex items-center gap-1.5 py-1 px-0.5">
                    <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
                  </span>
                ) : (
                  <span className="fade-in-up" style={{ display: 'block' }}>{botLine}</span>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-sm">{error}</div>
            )}

            <div key={step} className="fade-in-up">
              {/* TYPE */}
              {step === 'type' && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-left">
                  {VIDEO_TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => { setVideoType(t.id); setCustomType(''); setStep('hero') }}
                      className="group p-4 rounded-2xl bg-zinc-900/50 backdrop-blur border border-zinc-800 hover:border-violet-500/70 hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(139,92,246,0.18)] transition-all"
                    >
                      <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-3 group-hover:bg-violet-500/20 transition-colors">
                        <Icon d={t.icon} />
                      </div>
                      <div className="text-zinc-100 font-medium text-sm mb-0.5">{t.label}</div>
                      <div className="text-zinc-600 text-xs">{t.hint}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* HERO */}
              {step === 'hero' && (
                <div>
                  {heroQuery && (
                    <div className="flex justify-end mb-4">
                      <div className="bg-violet-600/20 border border-violet-500/30 rounded-2xl rounded-tr-md px-4 py-2 text-violet-100 text-sm max-w-md">{heroQuery}</div>
                    </div>
                  )}
                  {noMatchBanner(heroMatched, 'Character', heroQuery)}
                  {heroResults.length > 0 && (
                    <>
                      <div className="grid grid-cols-4 gap-3 mb-4">
                        {heroResults.map(a => (
                          <AssetCard
                            key={a.id}
                            asset={a}
                            selected={heroes.some(h => h.id === a.id)}
                            onClick={() => setHeroes(prev => prev.some(h => h.id === a.id) ? prev.filter(h => h.id !== a.id) : [...prev, a].slice(0, 4))}
                          />
                        ))}
                      </div>
                      {heroes.length > 0 && (
                        <p className="text-violet-300/90 text-sm mb-4 fade-in-up">
                          В касте: {heroes.map(h => h.title).join(' · ')} ({heroes.length}/4)
                        </p>
                      )}
                      <div className="flex gap-5 mb-6 text-sm">
                        <button onClick={() => search('Character', heroQuery, heroOffset + 4)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={searching}>
                          <Icon d={I.refresh} size={15} /> Ещё варианты
                        </button>
                        <button onClick={() => generateAsset('Character', heroQuery)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={genState === 'working'}>
                          <Icon d={I.sparkles} size={15} /> {genState === 'working' ? 'Генерирую (~20 сек)…' : 'Сгенерировать нового'}
                        </button>
                      </div>
                    </>
                  )}
                  {heroResults.length === 0 && !searching && (
                    <p className="text-zinc-600 text-sm mb-6">Напиши описание героя в строке ниже — покажу варианты из базы.</p>
                  )}
                  {searching && <p className="text-violet-300/80 text-sm mb-6 fade-in-up">Ищу в базе…</p>}
                  <div className="flex justify-end gap-3 items-center">
                    <button onClick={() => { setHeroes([]); setStep('location') }} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Без героя</button>
                    <button onClick={() => setStep('location')} disabled={heroes.length === 0} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition-colors">
                      Дальше <Icon d={I.arrowR} size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* LOCATION */}
              {step === 'location' && (
                <div>
                  {locQuery && (
                    <div className="flex justify-end mb-4">
                      <div className="bg-violet-600/20 border border-violet-500/30 rounded-2xl rounded-tr-md px-4 py-2 text-violet-100 text-sm max-w-md">{locQuery}</div>
                    </div>
                  )}
                  {noMatchBanner(locMatched, 'Location', locQuery)}
                  {locResults.length > 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {locResults.map(a => (
                          <AssetCard key={a.id} asset={a} selected={location?.id === a.id} onClick={() => setLocation(a)} wide />
                        ))}
                      </div>
                      <div className="flex gap-5 mb-6 text-sm">
                        <button onClick={() => search('Location', locQuery, locOffset + 4)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={searching}>
                          <Icon d={I.refresh} size={15} /> Ещё варианты
                        </button>
                        <button onClick={() => generateAsset('Location', locQuery)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={genState === 'working'}>
                          <Icon d={I.sparkles} size={15} /> {genState === 'working' ? 'Генерирую (~20 сек)…' : 'Сгенерировать новую'}
                        </button>
                      </div>
                    </>
                  )}
                  {locResults.length === 0 && !searching && (
                    <p className="text-zinc-600 text-sm mb-6">Опиши локацию в строке ниже — найду в базе.</p>
                  )}
                  {searching && <p className="text-violet-300/80 text-sm mb-6 fade-in-up">Ищу в базе…</p>}
                  <div className="flex justify-end gap-3 items-center">
                    <button onClick={() => { setLocation(null); setStep('action') }} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Пропустить</button>
                    <button onClick={() => setStep('action')} disabled={!location} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition-colors">
                      Дальше <Icon d={I.arrowR} size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* ACTION */}
              {step === 'action' && (
                <div>
                  {action && (
                    <div className="flex justify-end mb-5">
                      <div className="bg-violet-600/20 border border-violet-500/30 rounded-2xl rounded-tr-md px-4 py-2.5 text-violet-100 text-sm max-w-lg">{action}</div>
                    </div>
                  )}
                  <p className="text-zinc-600 text-sm mb-6">Напиши в строке ниже или нажми на микрофон и надиктуй.</p>
                  {action && (
                    <div className="flex justify-end">
                      <button onClick={() => setStep('camera')} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                        Дальше <Icon d={I.arrowR} size={15} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CAMERA — карточки категорий движка */}
              {step === 'camera' && (
                <div>
                  <CategoryPicker
                    cats={visibleCameraCats}
                    engineSel={engineSel}
                    onPick={(c, label) => setEngineSel(s => ({ ...s, [c]: label }))}
                    openCat={openCat}
                    setOpenCat={setOpenCat}
                    expanded={expandedCat}
                    onToggleExpand={c => setExpandedCat(s => ({ ...s, [c]: !s[c] }))}
                  />
                  {extraNote && (
                    <div className="flex justify-end my-3">
                      <div className="bg-violet-600/20 border border-violet-500/30 rounded-2xl rounded-tr-md px-4 py-2 text-violet-100 text-sm max-w-md">{extraNote}</div>
                    </div>
                  )}
                  <div className="flex justify-end mt-3">
                    <button onClick={() => { setOpenCat(null); setStep('details') }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                      Дальше <Icon d={I.arrowR} size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* DETAILS — карточки категорий движка */}
              {step === 'details' && (
                <div>
                  <CategoryPicker
                    cats={visibleDetailCats}
                    engineSel={engineSel}
                    onPick={(c, label) => setEngineSel(s => ({ ...s, [c]: label }))}
                    openCat={openCat}
                    setOpenCat={setOpenCat}
                    expanded={expandedCat}
                    onToggleExpand={c => setExpandedCat(s => ({ ...s, [c]: !s[c] }))}
                  />
                  {extraNote && (
                    <div className="flex justify-end my-3">
                      <div className="bg-violet-600/20 border border-violet-500/30 rounded-2xl rounded-tr-md px-4 py-2 text-violet-100 text-sm max-w-md">{extraNote}</div>
                    </div>
                  )}
                  <div className="flex justify-end mt-3">
                    <button onClick={() => { setOpenCat(null); setStep('confirm') }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                      Дальше <Icon d={I.arrowR} size={15} />
                    </button>
                  </div>
                </div>
              )}

              {/* CONFIRM */}
              {step === 'confirm' && (
                <div>
                  <div className="p-5 rounded-2xl bg-zinc-900/50 backdrop-blur border border-zinc-800 mb-6">
                    <div className="flex gap-3 mb-5 flex-wrap">
                      {heroes.map(h => (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img key={h.id} src={h.thumbnail_url || h.file_url} alt={h.title} className="h-36 w-28 object-cover rounded-xl border border-zinc-800" style={{ objectPosition: 'center top' }} />
                      ))}
                      {location && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={location.thumbnail_url || location.file_url} alt="location" className="h-36 flex-1 min-w-[200px] object-cover rounded-xl border border-zinc-800" />
                      )}
                    </div>
                    <ul className="text-sm text-zinc-300 space-y-2.5">
                      <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.film} size={15} /></span> {customType || VIDEO_TYPES.find(t => t.id === videoType)?.label || 'Видео'}</li>
                      {heroes.length > 0 && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.user} size={15} /></span> {heroes.map(h => h.title).join(', ')}</li>}
                      {location && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.pin} size={15} /></span> {location.title || 'Локация выбрана'}</li>}
                      <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.wand} size={15} /></span> {action.slice(0, 70)}{action.length > 70 ? '…' : ''}</li>
                      {Object.entries(engineSel).filter(([, v]) => v).length > 0 && (
                        <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5"><Icon d={I.camera} size={15} /></span> {Object.entries(engineSel).filter(([, v]) => v).map(([, v]) => ruVal(v)).join(' · ')}</li>
                      )}
                      {extraNote && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.bolt} size={15} /></span> {extraNote.slice(0, 70)}</li>}
                    </ul>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mb-7">
                    <div className="flex gap-2">
                      <Chip active={quality === 'draft'} onClick={() => setQuality('draft')}>Черновик · 720p · дёшево</Chip>
                      <Chip active={quality === 'final'} onClick={() => setQuality('final')}>Финал · 1080p + звук</Chip>
                    </div>
                    <div className="flex gap-2">
                      {[5, 10, 15].map(d => <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d} сек</Chip>)}
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button onClick={startRender} className="btn-shimmer glow-pulse flex items-center gap-2.5 px-10 py-3.5 rounded-2xl text-white text-lg font-semibold tracking-wide transition-all hover:-translate-y-0.5" style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' }}>
                      <Icon d={I.bolt} /> Generate
                    </button>
                  </div>
                </div>
              )}

              {/* RENDER */}
              {step === 'render' && (
                <div className="text-center py-12">
                  <div className="flex justify-center mb-6"><Mascot size={110} mood="thinking" /></div>
                  <h2 className="text-xl text-zinc-100 font-medium mb-2">Снимаю твой ролик…</h2>
                  <p className="text-zinc-500 text-sm mb-10">Обычно это 1–2 минуты</p>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                    <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.max(progress, 5)}%`, background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)' }} />
                  </div>
                  <p className="text-zinc-600 text-sm mt-3">{progress > 0 ? `${progress}%` : 'В очереди…'}</p>
                </div>
              )}

              {/* RESULT */}
              {step === 'result' && (
                <div>
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

          {/* Строка ввода — как в Claude/GPT: текст + голос */}
          {canSend && (
            <div className="px-5 pb-5 pt-3 border-t border-zinc-800/60" style={{ background: 'linear-gradient(0deg, rgba(139,92,246,0.05), transparent)' }}>
              <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur border border-zinc-800 focus-within:border-violet-500/70 rounded-2xl px-4 py-2 transition-colors shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitInput()}
                  placeholder={micOn ? 'Слушаю…' : PLACEHOLDERS[step]}
                  className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 outline-none py-1.5 text-[15px]"
                />
                <button
                  onClick={toggleMic}
                  title="Голосовой ввод"
                  className={`p-2 rounded-xl transition-all ${micOn ? 'bg-red-500/20 text-red-400 animate-pulse' : 'text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10'}`}
                >
                  <Icon d={I.mic} size={18} />
                </button>
                <button
                  onClick={submitInput}
                  disabled={!input.trim()}
                  className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 disabled:hover:bg-violet-600 transition-all"
                >
                  <Icon d={I.send} size={17} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
