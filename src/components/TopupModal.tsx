'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/components/AuthProvider'
import { supabase } from '@/lib/supabase'
import { CreditGem } from '@/components/AssetGrid'

// ─────────────────────────────────────────────────────────────
// TOP-UP MODAL (DEV_topup_credits) — one-time credit packs.
// • Packs come from /api/topup/packs (owner edits them in
//   Admin → Pricing). Base rate $0.10/credit — bonus % is shown.
// • Click a pack → LemonSqueezy checkout opens in a new tab with
//   the user id + credits in checkout custom data; the webhook
//   credits topup_credits automatically after payment.
// • While the tab is open we poll the balance every 4s — the
//   moment it grows, the success screen shows «Начислено N.
//   Баланс: M» and the navbar chip updates via the credits event.
// • Top-up credits NEVER expire (monthly reset only clears the
//   subscription pool — see spend_credits in the DB).
// Opened from: the balance chip, «Buy credits» buttons, and the
// «not enough credits» flows via the 'cineman-open-topup' event.
// ─────────────────────────────────────────────────────────────

type Pack = { credits: number; usd: number; popular?: boolean; ls_url?: string }

const BASE_RATE = 0.10 // $ per credit — packs cheaper than this show a bonus

function bonusPct(p: Pack): number {
  const base = p.credits * BASE_RATE
  if (p.usd >= base) return 0
  return Math.round((1 - p.usd / base) * 100)
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function TopupModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth()
  // PORTAL to <body>: the modal is hosted inside the glass navbar whose
  // backdrop-filter creates a containing block — position:fixed would
  // pin to the navbar instead of the viewport without this.
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  const [packs, setPacks] = useState<Pack[] | null>(null)
  const [phase, setPhase] = useState<'pick' | 'waiting' | 'success'>('pick')
  const [granted, setGranted] = useState(0)
  const [balance, setBalance] = useState<number | null>(null)
  const baselineRef = useRef<number | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetch('/api/topup/packs').then(r => r.json())
      .then(j => setPacks(Array.isArray(j.packs) ? j.packs : []))
      .catch(() => setPacks([]))
  }, [])

  const readTotal = async (): Promise<number | null> => {
    if (!user) return null
    const { data } = await supabase.from('profiles').select('credits, topup_credits').eq('id', user.id).single()
    if (!data) return null
    return Number(data.credits ?? 0) + Number(data.topup_credits ?? 0)
  }

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  const buy = async (p: Pack) => {
    if (!user || !p.ls_url) return
    const total = await readTotal()
    baselineRef.current = total
    // LS buy links accept checkout params — custom data reaches the webhook
    const sep = p.ls_url.includes('?') ? '&' : '?'
    const url = `${p.ls_url}${sep}checkout[custom][user_id]=${encodeURIComponent(user.id)}` +
      `&checkout[custom][credits]=${p.credits}` +
      (user.email ? `&checkout[email]=${encodeURIComponent(user.email)}` : '')
    window.open(url, '_blank', 'noopener')
    setPhase('waiting')
    if (pollRef.current) clearInterval(pollRef.current)
    const started = Date.now()
    pollRef.current = setInterval(async () => {
      if (Date.now() - started > 10 * 60 * 1000) { if (pollRef.current) clearInterval(pollRef.current); return }
      const t = await readTotal()
      if (t !== null && baselineRef.current !== null && t > baselineRef.current) {
        if (pollRef.current) clearInterval(pollRef.current)
        setGranted(t - baselineRef.current)
        setBalance(t)
        setPhase('success')
        window.dispatchEvent(new CustomEvent('cineman-credits-changed', { detail: t }))
      }
    }, 4000)
  }

  const anyLink = (packs ?? []).some(p => p.ls_url)

  if (!mounted) return null
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(8,5,15,0.80)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-lg w-full rounded-2xl p-8"
        style={{
          background: 'linear-gradient(135deg, var(--bg-card) 0%, color-mix(in srgb, var(--accent) 8%, transparent) 100%)',
          border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)',
          boxShadow: '0 0 60px color-mix(in srgb, var(--accent) 25%, transparent)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4" style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}>
          <CloseIcon />
        </button>

        {phase === 'success' ? (
          <div className="text-center py-4">
            <div className="mb-4 flex justify-center"><CreditGem size={48} /></div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Начислено {granted} кредитов</h2>
            <p className="text-base mb-6 inline-flex items-center gap-1.5" style={{ color: 'var(--fg-muted)' }}>
              Баланс: <strong style={{ color: 'var(--accent-soft)' }}>{balance}</strong> <CreditGem size={15} />
            </p>
            <button onClick={onClose} className="btn-primary w-full py-3 text-sm font-bold">Отлично</button>
          </div>
        ) : phase === 'waiting' ? (
          <div className="text-center py-6">
            <div className="mb-4 flex justify-center"><CreditGem size={44} /></div>
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--fg)' }}>Ждём оплату…</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--fg-muted)' }}>
              Заверши оплату во вкладке LemonSqueezy — кредиты начислятся сюда автоматически, ничего обновлять не нужно.
            </p>
            <button
              onClick={() => { if (pollRef.current) clearInterval(pollRef.current); setPhase('pick') }}
              className="text-xs font-semibold"
              style={{ color: 'var(--fg-subtle)', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              ← Выбрать другую пачку
            </button>
          </div>
        ) : (
          <>
            <div className="mb-1 flex items-center gap-2">
              <CreditGem size={22} />
              <h2 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Buy credits</h2>
            </div>
            <p className="text-xs mb-5" style={{ color: 'var(--fg-muted)' }}>
              Разовый докуп — без подписки. Купленные кредиты <strong style={{ color: 'var(--fg)' }}>не сгорают</strong> в конце месяца.
            </p>

            {!user ? (
              <div className="text-center py-4">
                <p className="text-sm mb-4" style={{ color: 'var(--fg-muted)' }}>Войди в аккаунт, чтобы докупить кредиты.</p>
                <a href="/account" className="btn-primary inline-block px-8 py-2.5 text-sm font-bold">Sign in</a>
              </div>
            ) : packs === null ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--fg-subtle)' }}>Загружаю пачки…</p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {packs.map((p, i) => {
                    const bonus = bonusPct(p)
                    const ready = Boolean(p.ls_url)
                    return (
                      <button
                        key={i}
                        onClick={() => ready && buy(p)}
                        disabled={!ready}
                        className="relative rounded-xl p-4 text-left transition-all"
                        style={{
                          backgroundColor: 'var(--bg-subtle)',
                          border: p.popular
                            ? '1.5px solid color-mix(in srgb, var(--accent) 65%, transparent)'
                            : '1px solid var(--border)',
                          boxShadow: p.popular ? '0 0 24px color-mix(in srgb, var(--accent) 15%, transparent)' : undefined,
                          cursor: ready ? 'pointer' : 'not-allowed',
                          opacity: ready ? 1 : 0.55,
                        }}
                      >
                        {p.popular && (
                          <span
                            className="absolute -top-2.5 left-3 text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-strong))', color: 'var(--on-accent)' }}
                          >
                            Popular
                          </span>
                        )}
                        <span className="flex items-center gap-1.5 text-lg font-bold" style={{ color: 'var(--fg)' }}>
                          {p.credits} <CreditGem size={15} />
                        </span>
                        <span className="block text-sm font-semibold mt-0.5" style={{ color: 'var(--accent-soft)' }}>${p.usd}</span>
                        {bonus > 0 && (
                          <span className="block text-[11px] mt-0.5" style={{ color: '#2DD4C4' }}>+{bonus}% бонус</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                {!anyLink && (
                  <p className="text-[11px] mb-2" style={{ color: '#E5A94B' }}>
                    Оплата подключается — пачки станут кликабельными, как только владелец добавит платёжные ссылки.
                  </p>
                )}
                <p className="text-[11px]" style={{ color: 'var(--fg-subtle)' }}>
                  Оплата картой в защищённом окне LemonSqueezy. Кредиты начислятся автоматически после оплаты.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
