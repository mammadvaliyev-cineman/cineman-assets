'use client'

import { useEffect, useState } from 'react'
import { ENGINE_CATS, DEFAULT_ENGINE_CONFIG, EngineConfig } from '@/lib/engine'

// ─────────────────────────────────────────────────────────────
// ENGINE CONTROL ROOM — тут решается, какие категории движка
// видны пользователям в студии как готовые варианты (чипсы).
// Всё остальное продолжает работать «под капотом» компилятора.
// ─────────────────────────────────────────────────────────────

const RU_TITLES: Record<string, string> = {
  genre: 'Жанр / Настроение',
  styles: 'Стиль / Look',
  shottype: 'Крупность плана',
  angle: 'Ракурс камеры',
  lens: 'Объектив',
  focus: 'Фокус',
  camtype: 'Тип камеры',
  camera: 'Движение камеры',
  light: 'Свет',
  time: 'Время суток',
  weather: 'Погода / Атмосфера',
  delivery: 'Подача голоса',
  music: 'Музыка',
  colorgrade: 'Цветокор',
}

export default function EnginePage() {
  const [config, setConfig] = useState<EngineConfig>(DEFAULT_ENGINE_CONFIG)
  const [open, setOpen] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    fetch('/api/engine')
      .then(r => r.json())
      .then(d => { if (d.config) setConfig(d.config) })
      .catch(() => {})
  }, [])

  const toggle = (id: string) => {
    setConfig(c => ({ ...c, visible: { ...c.visible, [id]: !c.visible[id] } }))
    setSaved(false)
  }

  const save = async () => {
    setSaving(true)
    await fetch('/api/engine', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ config }),
    }).catch(() => {})
    setSaving(false)
    setSaved(true)
  }

  const visibleCount = Object.values(config.visible).filter(Boolean).length

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white px-6 py-10">
      <div className="max-w-4xl mx-auto fade-in-up">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">
            Cineman <span className="text-violet-400">Engine</span>
          </h1>
          <button
            onClick={save}
            disabled={saving}
            className="btn-shimmer px-6 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            {saving ? 'Сохраняю…' : saved ? 'Сохранено ✓' : 'Сохранить'}
          </button>
        </div>
        <p className="text-white/50 mb-8">
          Галочка = категория видна в студии как готовые варианты. Без галочки — работает под капотом.
          Сейчас видно: {visibleCount} из {Object.keys(ENGINE_CATS).length}.
        </p>

        <label className="flex items-center gap-3 mb-8 p-4 rounded-2xl border border-violet-500/30 bg-violet-500/5 cursor-pointer">
          <input
            type="checkbox"
            checked={config.masterPreset}
            onChange={() => { setConfig(c => ({ ...c, masterPreset: !c.masterPreset })); setSaved(false) }}
            className="w-5 h-5 accent-violet-500"
          />
          <div>
            <div className="font-semibold">Master Preset — 8K IMAX фотореализм</div>
            <div className="text-sm text-white/40">Добавлять кинематографичный стайл-блок в каждый промпт</div>
          </div>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {Object.entries(ENGINE_CATS).map(([id, cat]) => (
            <div
              key={id}
              className={`rounded-2xl border p-4 transition ${
                config.visible[id]
                  ? 'border-violet-500/50 bg-violet-500/10'
                  : 'border-white/10 bg-white/[0.02]'
              }`}
            >
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!config.visible[id]}
                  onChange={() => toggle(id)}
                  className="w-5 h-5 accent-violet-500"
                />
                <div className="flex-1">
                  <div className="font-semibold">{RU_TITLES[id] || cat.title}</div>
                  <div className="text-xs text-white/40">{cat.items.length} опций · {cat.title}</div>
                </div>
                <button
                  onClick={e => { e.preventDefault(); setOpen(open === id ? null : id) }}
                  className="text-xs text-violet-300 hover:text-violet-200 px-2 py-1 rounded-lg bg-white/5"
                >
                  {open === id ? 'Скрыть' : 'Показать'}
                </button>
              </label>
              {open === id && (
                <div className="mt-3 flex flex-wrap gap-1.5 fade-in-up">
                  {cat.items.map(([label]) => (
                    <span key={label} className="text-xs px-2 py-1 rounded-full bg-white/5 border border-white/10 text-white/60">
                      {label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
