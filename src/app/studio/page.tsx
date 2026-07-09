'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ENGINE_CATS, CAM_GROUPS, DEFAULT_ENGINE_CONFIG, EngineConfig } from '@/lib/engine'
import { supabase } from '@/lib/supabase'

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
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4|M17 8l-5-5-5 5|M12 3v12',
  dice: 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z|M8.5 8.5h.01|M15.5 8.5h.01|M12 12h.01|M8.5 15.5h.01|M15.5 15.5h.01',
  library: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20|M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z',
  scroll: 'M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v3h4|M19 17V5a2 2 0 0 0-2-2H4|M13 7h4|M13 11h4',
  copy: 'M20 9h-9a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z|M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
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
const ruVal = (label: string) => label // interface is English-only; RU map kept for later localization
void RU_VAL

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
  { id: 'ad', label: 'Commercial', icon: I.megaphone, hint: 'Product, brand, promo' },
  { id: 'film', label: 'Film / Scene', icon: I.clapper, hint: 'Cinema, drama, action' },
  { id: 'product', label: 'Product Video', icon: I.box, hint: 'Review, showcase' },
  { id: 'music', label: 'Music Video', icon: I.music, hint: 'Rhythm, style, vibe' },
]

const STEP_LABELS: { id: Step; label: string }[] = [
  { id: 'type', label: 'Type' },
  { id: 'hero', label: 'Hero' },
  { id: 'location', label: 'Location' },
  { id: 'action', label: 'Action' },
  { id: 'camera', label: 'Camera' },
  { id: 'details', label: 'Mood' },
  { id: 'confirm', label: 'Final' },
]

// Engine categories per step + RU titles
const CAMERA_CATS = ['camera', 'shottype', 'angle', 'lens', 'focus', 'camtype']
const DETAIL_CATS = ['light', 'time', 'weather', 'genre', 'styles', 'colorgrade', 'music', 'delivery']
const RU_CAT: Record<string, string> = {
  camera: 'Camera Move', shottype: 'Shot Size', angle: 'Angle', lens: 'Lens',
  focus: 'Focus', camtype: 'Camera Body', light: 'Light', time: 'Time of Day',
  weather: 'Weather', genre: 'Genre / Mood', styles: 'Style', colorgrade: 'Color Grade',
  music: 'Music', delivery: 'Voice Delivery',
}

const BOT_LINES: Record<Step, string> = {
  type: 'What are we shooting today? Pick a type — or describe your own.',
  hero: "Who's in the cast? Describe the first hero — you can add up to 4 (and more later on the final step).",
  location: 'Where does the action happen? Describe the location.',
  action: 'What happens in the frame? Type it or dictate with the mic.',
  camera: 'How does the camera move? Pick options — or trust me.',
  details: 'Add atmosphere? Optional — I can decide myself.',
  confirm: 'All set! Review the scene and hit Generate.',
  render: 'Shooting your video…',
  result: "Done! Here's your video.",
}

const PLACEHOLDERS: Record<Step, string> = {
  type: 'Or type your own format: travel vlog, teaser…',
  hero: 'E.g.: young athlete, 25, confident',
  location: 'E.g.: night city, neon, rain',
  action: 'E.g.: he runs down the street looking into the camera',
  camera: 'A note for the director (optional)…',
  details: 'Atmosphere note (optional)…',
  confirm: 'Final scene note (optional)…',
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
  // Expression set disabled — using the approved Cineman mascot (bowler hat + mustache)
  useEffect(() => { /* probeExpressions().then(setAvail) */ }, [])
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

  // ВАЖНО: один набор кадров. Если neutral не загружен — базой служит
  // happy из того же сета, чтобы маскот не «прыгал» в размере при
  // смене выражения (mascot.png отрисован с другим кадрированием).
  const base = avail.neutral ? 'neutral' : (avail.happy ? 'happy' : '')
  const pick = blinking && avail.blink ? 'blink' : (avail[mood] ? mood : base)
  const src = pick ? EXPR_SRC[pick] : FALLBACK_SRC
  const amp = Math.max(6, Math.round(size * 0.14))
  return (
    <span
      className="relative inline-flex flex-col items-center shrink-0"
      style={{ width: size, transition: 'width .5s cubic-bezier(.16,1,.3,1)' }}
    >
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
        style={{ width: size, height: size, transition: 'width .5s cubic-bezier(.16,1,.3,1), height .5s cubic-bezier(.16,1,.3,1)', animation: 'cinemanFloat 2.6s ease-in-out infinite', filter: 'drop-shadow(0 10px 20px rgba(139,92,246,0.4))' }}
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

// The 8 moves directors reach for first — the rest live in group tabs
const POPULAR_MOVES = ['Static', 'Slow zoom in', 'Dolly in', 'Tracking shot', 'Orbit clockwise', 'Handheld', 'Crane up', 'FPV drone']

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
  const [camGroup, setCamGroup] = useState('Popular')
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
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
            {open === 'camera' ? (
              // 50 camera moves — group tabs, one clean row at a time
              <div>
                <div className="flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-zinc-800/70">
                  {['Popular', ...Object.keys(CAM_GROUPS)].map(g => (
                    <button
                      key={g}
                      onClick={() => setCamGroup(g)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-wider transition-all ${
                        camGroup === g
                          ? 'bg-violet-600/25 text-violet-200 border border-violet-500/50 shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                          : 'text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5" key={camGroup}>
                  {(camGroup === 'Popular' ? POPULAR_MOVES : CAM_GROUPS[camGroup] || []).map(label => (
                    <Chip key={label} active={engineSel[open] === label} onClick={() => onPick(open, engineSel[open] === label ? '' : label)}>
                      {label}
                    </Chip>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {items.map(([label]) => (
                  <Chip key={label} active={engineSel[open] === label} onClick={() => onPick(open, engineSel[open] === label ? '' : label)}>
                    {ruVal(label)}
                  </Chip>
                ))}
                {cat.items.length > 10 && (
                  <button onClick={() => onToggleExpand(open)} className="px-3 py-1.5 rounded-full text-[13px] text-violet-400 hover:text-violet-300 transition-colors">
                    {expanded[open] ? 'Show less' : `+${cat.items.length - 10} more`}
                  </button>
                )}
              </div>
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

  // Director's script preview (compiled Seedance prompt)
  const [script, setScript] = useState('')
  const [scriptLoading, setScriptLoading] = useState(false)
  const [scriptCopied, setScriptCopied] = useState(false)

  // "Surprise me" — a coherent random cinematic setup from the engine
  const surpriseMe = useCallback(() => {
    const pick = (catId: string) => {
      const items = ENGINE_CATS[catId]?.items || []
      return items.length ? items[Math.floor(Math.random() * items.length)][0] : ''
    }
    setEngineSel({
      camera: POPULAR_MOVES[Math.floor(Math.random() * POPULAR_MOVES.length)],
      shottype: pick('shottype'),
      light: pick('light'),
      time: pick('time'),
      weather: pick('weather'),
      genre: pick('genre'),
    })
    setScript('')
  }, [])

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
  const [uploading, setUploading] = useState(false)
  // «My library» — герои/локации/пропсы из Favorites и Downloads юзера
  const [libFor, setLibFor] = useState<'hero' | 'location' | 'prop' | null>(null)
  const [libAssets, setLibAssets] = useState<Asset[]>([])
  const [libLoading, setLibLoading] = useState(false)
  const [extraRefs, setExtraRefs] = useState<Asset[]>([])
  const fileRef = useRef<HTMLInputElement | null>(null)
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
      setError(e instanceof Error ? e.message : 'Search failed')
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
            // Невыбранные варианты уходят — остаётся только новый герой
            if (assetType === 'Character') { setHeroes(prev => [...prev, j.asset].slice(0, 4)); setHeroResults([j.asset]); setHeroMatched(1) }
            else { setLocation(j.asset); setLocResults([j.asset]); setLocMatched(1) }
            resolve()
          } else if (j.state === 'fail' || j.error) {
            clearInterval(iv)
            reject(new Error(j.error || 'Generation failed'))
          }
        }, 4000)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
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

      const refs = [...heroes.map(h => h.file_url), location?.file_url, ...extraRefs.map(r => r.file_url)].filter(Boolean)
      const videoRes = await fetch('/api/studio/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, referenceImageUrls: refs, quality, duration }),
      })
      const { taskId, error: vErr } = await videoRes.json()
      if (vErr) throw new Error(vErr)

      pollRef.current = setInterval(async () => {
        const r = await fetch(`/api/studio/video?taskId=${taskId}&quality=${quality}`)
        const j = await r.json()
        setProgress(j.progress || 0)
        if (j.state === 'success' && j.resultUrls?.length) {
          if (pollRef.current) clearInterval(pollRef.current)
          setVideoUrl(j.resultUrls[0])
          setStep('result')
        } else if (j.state === 'fail') {
          if (pollRef.current) clearInterval(pollRef.current)
          setError(j.failMsg || 'Video generation failed')
          setStep('confirm')
        }
      }, 5000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
      setStep('confirm')
    }
  }, [videoType, heroes, location, action, extraNote, extraRefs, engineSel, engineCfg.masterPreset, quality, duration])

  const openLibrary = useCallback(async (kind: 'hero' | 'location' | 'prop') => {
    setLibFor(kind)
    setLibLoading(true)
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('cineman_favs') ?? '[]')
      const dls: string[] = JSON.parse(localStorage.getItem('cineman_dl_ids') ?? '[]')
      const idSet = new Set<string>()
      favs.forEach(x => idSet.add(x))
      dls.forEach(x => idSet.add(x))
      const ids: string[] = []
      idSet.forEach(x => ids.push(x))
      ids.splice(60)
      if (!ids.length) { setLibAssets([]); return }
      const { data } = await supabase
        .from('assets')
        .select('id,title,type,tags,description,file_url,thumbnail_url')
        .in('id', ids)
      const wantType = kind === 'hero' ? 'Character' : kind === 'location' ? 'Location' : null
      const list = (data || []).filter(a => !wantType || a.type === wantType) as Asset[]
      setLibAssets(list)
    } catch { setLibAssets([]) }
    finally { setLibLoading(false) }
  }, [])

  const pickFromLibrary = useCallback((a: Asset) => {
    if (libFor === 'hero') setHeroes(prev => prev.some(h => h.id === a.id) ? prev : [...prev, a].slice(0, 4))
    else if (libFor === 'location') setLocation(a)
    else setExtraRefs(prev => prev.some(r => r.id === a.id) ? prev : [...prev, a].slice(0, 3))
    setLibFor(null)
  }, [libFor])

  // ── User uploads: own character / location / prop ───────────
  const toJpeg = (file: File, max = 1600, q = 0.85): Promise<Blob> => new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
      const c = document.createElement('canvas')
      c.width = Math.round(img.naturalWidth * sc)
      c.height = Math.round(img.naturalHeight * sc)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      c.toBlob(b => { URL.revokeObjectURL(url); b ? resolve(b) : reject(new Error('convert failed')) }, 'image/jpeg', q)
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image load failed')) }
    img.src = url
  })

  const handleUpload = useCallback(async (file: File) => {
    setUploading(true)
    setError('')
    try {
      const blob = await toJpeg(file)
      let meta: { title?: string; category?: string; description?: string; tags?: string } = {}
      try {
        const fd = new FormData()
        fd.append('file', new File([blob], 'upload.jpg', { type: 'image/jpeg' }))
        meta = await (await fetch('/api/ai-name', { method: 'POST', body: fd })).json()
      } catch { /* best-effort naming */ }
      const assetType = step === 'location' ? 'Location' : step === 'hero' ? 'Character' : 'Prop'
      // Server-mediated write: the browser never touches storage/DB directly
      const fd2 = new FormData()
      fd2.append('file', new File([blob], 'upload.jpg', { type: 'image/jpeg' }))
      fd2.append('type', assetType)
      fd2.append('title', meta.title || file.name.replace(/\.[^.]+$/, ''))
      fd2.append('category', meta.category || 'User Upload')
      fd2.append('description', meta.description || '')
      fd2.append('tags', typeof meta.tags === 'string' ? meta.tags : '')
      const upRes = await fetch('/api/user-upload', { method: 'POST', body: fd2 })
      const upJson = await upRes.json()
      if (!upRes.ok || !upJson.asset) throw new Error(upJson.error || 'Upload failed')
      const asset = upJson.asset as Asset
      if (assetType === 'Character') { setHeroes(prev => [...prev, asset].slice(0, 4)); setHeroResults([asset]); setHeroMatched(1) }
      else if (assetType === 'Location') { setLocation(asset); setLocResults([asset]); setLocMatched(1) }
      else setExtraRefs(prev => [...prev, asset].slice(0, 3))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [step])

  const loadScript = useCallback(async () => {
    if (script) { setScript(''); return }
    setScriptLoading(true)
    try {
      const fullAction = [action, extraNote].filter(Boolean).join('. ')
      const res = await fetch('/api/studio/compile', {
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
      const { prompt } = await res.json()
      setScript(prompt || '')
    } catch { setScript('') }
    finally { setScriptLoading(false) }
  }, [script, action, extraNote, videoType, heroes, location, engineSel, engineCfg.masterPreset])

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
    if (!rec) { setError('Voice input is not supported in this browser — try Chrome'); return }
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
    ? `Great, ${heroes.length} selected. Add more heroes — or hit Next to pick a location!`
    : 'Pick a hero — you can select several! Next we choose a location.'
  if (step === 'location' && locResults.length > 0) botLine = location
    ? "Location locked! Hit Next — let's describe the action."
    : 'Pick a location — then we move to the action.'

  // История ответов — клик возвращает на шаг
  const history: { step: Step; q: string; a: string }[] = []
  if (stepIndex > 0 || step === 'render' || step === 'result') {
    const past = (s: Step) => STEPS.indexOf(s) < (stepIndex === -1 ? STEPS.length : stepIndex)
    if (past('hero') || stepIndex === -1) history.push({ step: 'type', q: BOT_LINES.type, a: customType || VIDEO_TYPES.find(t => t.id === videoType)?.label || '—' })
    if (past('location')) history.push({ step: 'hero', q: BOT_LINES.hero, a: heroes.length ? heroes.map(h => h.title).join(', ') : 'No hero' })
    if (past('action')) history.push({ step: 'location', q: BOT_LINES.location, a: location ? location.title : 'Skipped' })
    if (past('camera')) history.push({ step: 'action', q: BOT_LINES.action, a: action.slice(0, 80) + (action.length > 80 ? '…' : '') })
    if (past('details')) {
      const camSel = CAMERA_CATS.map(c => engineSel[c]).filter(Boolean).map(ruVal).join(', ')
      history.push({ step: 'camera', q: BOT_LINES.camera, a: camSel || 'Up to Cineman' })
    }
    if (past('confirm')) {
      const detSel = DETAIL_CATS.map(c => engineSel[c]).filter(Boolean).map(ruVal).join(', ')
      history.push({ step: 'details', q: BOT_LINES.details, a: detSel || 'Up to Cineman' })
    }
  }

  const visibleCameraCats = CAMERA_CATS.filter(c => engineCfg.visible[c])
  const visibleDetailCats = DETAIL_CATS.filter(c => engineCfg.visible[c])
  const canSend = step !== 'render' && step !== 'result'

  const noMatchBanner = (matched: number | null, kind: 'Character' | 'Location', query: string) =>
    matched === 0 ? (
      <div className="mb-4 px-4 py-3 rounded-xl bg-amber-950/40 border border-amber-700/40 text-amber-200/90 text-sm fade-in-up">
        No exact match in the base — showing the closest. I can{' '}
        <button
          onClick={() => generateAsset(kind, query)}
          disabled={genState === 'working'}
          className="underline decoration-amber-400/60 hover:text-amber-100 font-medium"
        >
          generate {kind === 'Character' ? 'a new hero' : 'a new location'}
        </button>{' '}
        from your description.
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
                <p className="text-violet-400/80 text-xs">AI Director · online</p>
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
                    title="Click to edit"
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

            {/* My library picker (Favorites + Downloads) */}
            {libFor && (
              <div className="mb-6 rounded-2xl border border-violet-500/40 bg-zinc-900/70 p-4 fade-in-up">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm text-zinc-200 flex items-center gap-2">
                    <Icon d={I.library} size={16} /> My library — {libFor === 'hero' ? 'characters' : libFor === 'location' ? 'locations' : 'any asset as a prop'}
                  </p>
                  <button onClick={() => setLibFor(null)} className="text-zinc-500 hover:text-zinc-300 text-sm">Close</button>
                </div>
                {libLoading ? (
                  <p className="text-zinc-500 text-sm py-4">Loading your library…</p>
                ) : libAssets.length === 0 ? (
                  <p className="text-zinc-500 text-sm py-4">Nothing here yet — add favorites or download assets in the catalog first.</p>
                ) : (
                  <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                    {libAssets.map(a => (
                      <button key={a.id} onClick={() => pickFromLibrary(a)} className="relative rounded-xl overflow-hidden border border-zinc-800 hover:border-violet-500/70 transition-all text-left group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={a.thumbnail_url || a.file_url} alt={a.title} className="w-full aspect-square object-cover" style={{ objectPosition: 'center top' }} loading="lazy" />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-1.5">
                          <p className="text-[10px] text-zinc-200 line-clamp-1">{a.title}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
                  {(genState === 'working' || uploading) && (
                    <div className="rounded-2xl border border-violet-500/40 bg-zinc-900/60 p-8 flex flex-col items-center gap-3 mb-6 fade-in-up">
                      <Mascot size={72} mood="thinking" />
                      <p className="text-zinc-300 text-sm">{uploading ? 'Uploading your image…' : 'Generating your hero… ~20s'}</p>
                      <div className="w-44 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full w-1/2 rounded-full animate-pulse" style={{ background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)' }} /></div>
                    </div>
                  )}
                  {genState !== 'working' && !uploading && heroResults.length > 0 && (
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
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="rounded-2xl border border-dashed border-zinc-700 hover:border-violet-500/70 text-zinc-500 hover:text-violet-300 aspect-[3/4] flex flex-col items-center justify-center gap-2 transition-all text-xs"
                        >
                          <Icon d={I.upload} size={20} /> Add your own
                        </button>
                        <button
                          onClick={() => openLibrary('hero')}
                          className="rounded-2xl border border-dashed border-zinc-700 hover:border-violet-500/70 text-zinc-500 hover:text-violet-300 aspect-[3/4] flex flex-col items-center justify-center gap-2 transition-all text-xs"
                        >
                          <Icon d={I.library} size={20} /> My library
                        </button>
                      </div>
                      {heroes.length > 0 && (
                        <p className="text-violet-300/90 text-sm mb-4 fade-in-up">
                          Cast: {heroes.map(h => h.title).join(' · ')} ({heroes.length}/4)
                        </p>
                      )}
                      <div className="flex gap-5 mb-6 text-sm">
                        <button onClick={() => search('Character', heroQuery, heroOffset + 4)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={searching}>
                          <Icon d={I.refresh} size={15} /> More options
                        </button>
                        <button onClick={() => generateAsset('Character', heroQuery)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors">
                          <Icon d={I.sparkles} size={15} /> Generate new
                        </button>
                      </div>
                    </>
                  )}
                  {heroResults.length === 0 && !searching && (
                    <p className="text-zinc-600 text-sm mb-6">Describe the hero in the input below — options will appear here.</p>
                  )}
                  {searching && <p className="text-violet-300/80 text-sm mb-6 fade-in-up">Searching the base…</p>}
                  <div className="flex justify-end gap-3 items-center">
                    <button onClick={() => { setHeroes([]); setStep('location') }} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">No hero</button>
                    <button onClick={() => setStep('location')} disabled={heroes.length === 0} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition-colors">
                      Next <Icon d={I.arrowR} size={15} />
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
                  {(genState === 'working' || uploading) && (
                    <div className="rounded-2xl border border-violet-500/40 bg-zinc-900/60 p-8 flex flex-col items-center gap-3 mb-6 fade-in-up">
                      <Mascot size={72} mood="thinking" />
                      <p className="text-zinc-300 text-sm">{uploading ? 'Uploading your image…' : 'Generating your location… ~20s'}</p>
                      <div className="w-44 h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full w-1/2 rounded-full animate-pulse" style={{ background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)' }} /></div>
                    </div>
                  )}
                  {genState !== 'working' && !uploading && locResults.length > 0 && (
                    <>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        {locResults.map(a => (
                          <AssetCard key={a.id} asset={a} selected={location?.id === a.id} onClick={() => setLocation(a)} wide />
                        ))}
                        <button
                          onClick={() => fileRef.current?.click()}
                          className="rounded-2xl border border-dashed border-zinc-700 hover:border-violet-500/70 text-zinc-500 hover:text-violet-300 aspect-video flex flex-col items-center justify-center gap-2 transition-all text-xs"
                        >
                          <Icon d={I.upload} size={20} /> Add your own
                        </button>
                        <button
                          onClick={() => openLibrary('location')}
                          className="rounded-2xl border border-dashed border-zinc-700 hover:border-violet-500/70 text-zinc-500 hover:text-violet-300 aspect-video flex flex-col items-center justify-center gap-2 transition-all text-xs"
                        >
                          <Icon d={I.library} size={20} /> My library
                        </button>
                      </div>
                      <div className="flex gap-5 mb-6 text-sm">
                        <button onClick={() => search('Location', locQuery, locOffset + 4)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors" disabled={searching}>
                          <Icon d={I.refresh} size={15} /> More options
                        </button>
                        <button onClick={() => generateAsset('Location', locQuery)} className="flex items-center gap-1.5 text-zinc-400 hover:text-violet-400 transition-colors">
                          <Icon d={I.sparkles} size={15} /> Generate new
                        </button>
                      </div>
                    </>
                  )}
                  {locResults.length === 0 && !searching && (
                    <p className="text-zinc-600 text-sm mb-6">Describe the location below — I'll search the base.</p>
                  )}
                  {searching && <p className="text-violet-300/80 text-sm mb-6 fade-in-up">Searching the base…</p>}
                  <div className="flex justify-end gap-3 items-center">
                    <button onClick={() => { setLocation(null); setStep('action') }} className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">Skip</button>
                    <button onClick={() => setStep('action')} disabled={!location} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-30 transition-colors">
                      Next <Icon d={I.arrowR} size={15} />
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
                  <p className="text-zinc-600 text-sm mb-6">Type below or tap the mic and dictate.</p>
                  {action && (
                    <div className="flex justify-end">
                      <button onClick={() => setStep('camera')} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                        Next <Icon d={I.arrowR} size={15} />
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
                  <div className="flex justify-between mt-3">
                    <button onClick={surpriseMe} title="Random cinematic setup" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-500/40 text-violet-300 hover:bg-violet-950/40 transition-colors text-sm">
                      <Icon d={I.dice} size={16} /> Surprise me
                    </button>
                    <button onClick={() => { setOpenCat(null); setStep('details') }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                      Next <Icon d={I.arrowR} size={15} />
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
                  <div className="flex justify-between mt-3">
                    <button onClick={surpriseMe} title="Random cinematic setup" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-violet-500/40 text-violet-300 hover:bg-violet-950/40 transition-colors text-sm">
                      <Icon d={I.dice} size={16} /> Surprise me
                    </button>
                    <button onClick={() => { setOpenCat(null); setStep('confirm') }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                      Next <Icon d={I.arrowR} size={15} />
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
                      <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.film} size={15} /></span> {customType || VIDEO_TYPES.find(t => t.id === videoType)?.label || 'Video'}</li>
                      {heroes.length > 0 && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.user} size={15} /></span> {heroes.map(h => h.title).join(', ')}</li>}
                      {location && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.pin} size={15} /></span> {location.title || 'Location selected'}</li>}
                      <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.wand} size={15} /></span> {action.slice(0, 70)}{action.length > 70 ? '…' : ''}</li>
                      {Object.entries(engineSel).filter(([, v]) => v).length > 0 && (
                        <li className="flex items-start gap-2"><span className="text-violet-400 mt-0.5"><Icon d={I.camera} size={15} /></span> {Object.entries(engineSel).filter(([, v]) => v).map(([, v]) => ruVal(v)).join(' · ')}</li>
                      )}
                      {extraRefs.length > 0 && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.upload} size={15} /></span> {extraRefs.map(r => r.title).join(', ')}</li>}
                      {extraNote && <li className="flex items-center gap-2"><span className="text-violet-400"><Icon d={I.bolt} size={15} /></span> {extraNote.slice(0, 70)}</li>}
                    </ul>
                  </div>

                  {/* Director's script — the exact Seedance prompt */}
                  <div className="mb-6">
                    <button onClick={loadScript} className="flex items-center gap-2 text-sm text-violet-300 hover:text-violet-200 transition-colors">
                      <Icon d={I.scroll} size={16} />
                      {scriptLoading ? 'Writing the script…' : script ? 'Hide director\u2019s script' : 'Show director\u2019s script'}
                    </button>
                    {script && (
                      <div className="mt-3 relative rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 fade-in-up">
                        <p className="text-[13px] leading-relaxed text-zinc-300 font-mono whitespace-pre-wrap pr-10">{script}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(script).catch(() => {}); setScriptCopied(true); setTimeout(() => setScriptCopied(false), 1500) }}
                          title="Copy prompt"
                          className="absolute top-3 right-3 p-2 rounded-lg text-zinc-500 hover:text-violet-300 hover:bg-violet-500/10 transition-all"
                        >
                          {scriptCopied ? <Icon d={I.check} size={15} /> : <Icon d={I.copy} size={15} />}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Quick-add: вернуться и дополнить сцену */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    <button onClick={() => setStep('hero')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-violet-500/60 hover:text-violet-200 transition-colors text-sm">
                      <Icon d={I.user} size={15} /> {heroes.length ? 'Add / change heroes' : 'Add a hero'}
                    </button>
                    <button onClick={() => setStep('location')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-violet-500/60 hover:text-violet-200 transition-colors text-sm">
                      <Icon d={I.pin} size={15} /> {location ? 'Change location' : 'Add a location'}
                    </button>
                    <button onClick={() => fileRef.current?.click()} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-violet-500/60 hover:text-violet-200 transition-colors text-sm">
                      <Icon d={I.upload} size={15} /> Add a prop
                    </button>
                    <button onClick={() => openLibrary('prop')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-violet-500/60 hover:text-violet-200 transition-colors text-sm">
                      <Icon d={I.library} size={15} /> From my library
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 mb-7">
                    <div className="flex gap-2">
                      <Chip active={quality === 'draft'} onClick={() => setQuality('draft')}>Draft · 720p</Chip>
                      <Chip active={quality === 'final'} onClick={() => setQuality('final')}>Final · 1080p + audio</Chip>
                    </div>
                    <div className="flex gap-2">
                      {[5, 10, 15].map(d => <Chip key={d} active={duration === d} onClick={() => setDuration(d)}>{d}s</Chip>)}
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
                  <h2 className="text-xl text-zinc-100 font-medium mb-2">Shooting your video…</h2>
                  <p className="text-zinc-500 text-sm mb-10">Usually takes 1–2 minutes</p>
                  <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden border border-zinc-800">
                    <div className="h-2 rounded-full transition-all duration-1000" style={{ width: `${Math.max(progress, 5)}%`, background: 'linear-gradient(90deg,#8b5cf6,#22d3ee)' }} />
                  </div>
                  <p className="text-zinc-600 text-sm mt-3">{progress > 0 ? `${progress}%` : 'Queued…'}</p>
                </div>
              )}

              {/* RESULT */}
              {step === 'result' && (
                <div>
                  <video src={videoUrl} controls autoPlay loop className="w-full rounded-2xl border border-zinc-800 mb-6 shadow-[0_8px_40px_rgba(0,0,0,0.5)]" />
                  <div className="flex flex-wrap gap-3">
                    <a href={videoUrl} download className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white transition-colors">
                      <Icon d={I.download} size={16} /> Download
                    </a>
                    {quality === 'draft' && (
                      <button onClick={() => { setQuality('final'); startRender() }} className="flex items-center gap-2 px-6 py-2.5 rounded-xl border border-violet-500/60 text-violet-300 hover:bg-violet-950/40 transition-colors">
                        <Icon d={I.sparkles} size={16} /> Final quality
                      </button>
                    )}
                    <button onClick={() => window.location.reload()} className="px-6 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors">
                      New video
                    </button>
                  </div>
                  <p className="text-zinc-600 text-xs mt-4">Saved to your Cineman library — this link is permanent.</p>
                </div>
              )}
            </div>
          </div>

          {/* Строка ввода — как в Claude/GPT: текст + голос */}
          {canSend && (
            <div className="px-6 pb-8 pt-4 border-t border-zinc-800/60" style={{ background: 'linear-gradient(0deg, rgba(139,92,246,0.05), transparent)' }}>
              <div className="flex items-center gap-2 bg-zinc-900/80 backdrop-blur border border-zinc-800 focus-within:border-violet-500/70 rounded-2xl px-4 py-2 transition-colors shadow-[0_8px_30px_rgba(0,0,0,0.35)]">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  title="Upload your own character, location or prop"
                  className={`p-2 rounded-xl transition-all ${uploading ? 'text-violet-400 animate-pulse' : 'text-zinc-500 hover:text-violet-400 hover:bg-violet-500/10'}`}
                >
                  <Icon d={I.upload} size={18} />
                </button>
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitInput()}
                  placeholder={micOn ? 'Listening…' : PLACEHOLDERS[step]}
                  className="flex-1 bg-transparent text-zinc-100 placeholder-zinc-600 outline-none py-1.5 text-[15px]"
                />
                <button
                  onClick={toggleMic}
                  title="Voice input"
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
