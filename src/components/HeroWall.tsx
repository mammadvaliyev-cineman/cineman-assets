'use client'

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────
// HERO WALL (owner's brief #82): a living wall of hand-framed
// tiles on the first screen. Columns drift vertically — slow,
// soft, opposite directions — the wall feels alive but calm.
//
// Every tile is an owner-cropped frame: the admin picks an asset
// (or uploads one), then frames it MANUALLY with the same
// drag-and-zoom positioner the profile avatar uses. No automatic
// cropping anywhere. We store the crop as pure numbers
// { x, y (fractions of the frame), z (zoom) } and re-create the
// exact framing with CSS — no canvas, no CORS, no re-uploads,
// and re-cropping later starts from the saved position.
// ─────────────────────────────────────────────────────────────

export type HeroTile = { src: string; x: number; y: number; z: number }

export const TILE_ASPECT = '3 / 4' // portrait — faces and locations both read well

// The math mirrors the avatar cropper 1:1: the image covers the
// frame (min-width/height 100%), sits centered, then is offset by
// the saved fractions of the FRAME size and zoomed. Offsets are
// fractions, so the framing is identical at any tile size as long
// as the aspect matches the crop editor (it does — 3:4 everywhere).
export function TileView({ tile, radius = 12 }: { tile: HeroTile; radius?: number }) {
  // measured aspect → explicit COVER sizing in % of the frame (#85):
  // width = max(1, ratio · 4/3) · zoom — both axes always fill the 3:4
  // frame, so no black bars at any zoom or position
  const [ratio, setRatio] = useState<number | null>(null)
  return (
    <div
      style={{
        position: 'relative', overflow: 'hidden', width: '100%', aspectRatio: TILE_ASPECT,
        borderRadius: radius, backgroundColor: '#17151E',
        border: '0.5px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.src}
        alt=""
        draggable={false}
        onLoad={e => { const im = e.currentTarget; if (im.naturalWidth && im.naturalHeight) setRatio(im.naturalWidth / im.naturalHeight) }}
        style={{
          position: 'absolute',
          left: `calc(50% + ${(tile.x * 100).toFixed(3)}%)`,
          top: `calc(50% + ${(tile.y * 100).toFixed(3)}%)`,
          transform: 'translate(-50%, -50%)',
          width: ratio ? `${(Math.max(1, ratio * (4 / 3)) * tile.z * 100).toFixed(2)}%` : '100%',
          height: 'auto', maxWidth: 'none',
          visibility: ratio ? 'visible' : 'hidden',
          userSelect: 'none', pointerEvents: 'none',
        }}
      />
    </div>
  )
}

const COLS = 3
// different speeds per column → the drift never looks mechanical
const DRIFT = [
  { duration: '64s', reverse: false },
  { duration: '84s', reverse: true },
  { duration: '72s', reverse: false },
]

export default function HeroWall({ tiles }: { tiles: HeroTile[] }) {
  if (!tiles.length) return null

  // distinct tiles only (owner's #83: no visible repeats) — the page
  // tops the set up to 9 different assets, we just guard against dupes
  const seen = new Set<string>()
  const norm = (u: string) => u.split('?')[0].replace('/render/image/public/', '/object/public/')
  let filled = tiles.filter(t => { const k = norm(t.src); if (seen.has(k)) return false; seen.add(k); return true })
  // safety net for a nearly-empty config: a too-short column would leave
  // gaps in the seamless loop, so only then we allow repetition
  while (filled.length > 0 && filled.length < 6) filled = [...filled, filled[filled.length % tiles.length] ?? filled[0]]
  const cols: HeroTile[][] = Array.from({ length: COLS }, () => [])
  filled.forEach((t, i) => cols[i % COLS].push(t))

  return (
    <div
      aria-hidden
      style={{
        position: 'relative', height: 560, overflow: 'hidden', borderRadius: 16,
        // soft fade top & bottom so tiles are born and dissolve, not clipped
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 7%, black 93%, transparent 100%)',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 7%, black 93%, transparent 100%)',
      }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLS}, 1fr)`, gap: 12, height: '100%' }}>
        {cols.map((col, ci) => (
          <div key={ci} style={{ overflow: 'hidden', position: 'relative' }}>
            <div
              className="cine-drift"
              style={{
                display: 'flex', flexDirection: 'column', gap: 12, willChange: 'transform',
                animation: `cineWallDrift ${DRIFT[ci].duration} linear infinite ${DRIFT[ci].reverse ? 'reverse' : 'normal'}`,
                // middle column starts mid-phase so seams never align
                paddingTop: ci === 1 ? 0 : 0,
              }}
            >
              {/* content twice → translateY(-50%) loops seamlessly */}
              {[...col, ...col].map((t, i) => (
                <div key={i} style={{ flexShrink: 0 }}>
                  <TileView tile={t} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
