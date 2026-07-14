import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/config/categories";
import HomeShelf, { ShelfItem } from "@/components/HomeShelf";
import PoweredBy from "@/components/PoweredBy";
import HeroSearch from "@/components/HeroSearch";
import Reveal from "@/components/Reveal";
import Tilt from "@/components/Tilt";
import HeroWall, { type HeroTile } from "@/components/HeroWall";

// Signature moment (DEV_flair_motion §4): the hero headline reveals
// letter by letter, once, on load. The ONLY branded flourish.
function Letters({ text, base = 0 }: { text: string; base?: number }) {
  return (
    <>
      {text.split("").map((ch, i) => (
        <span key={i} className="cine-letter" style={{ animationDelay: `${base + i * 26}ms` }}>
          {ch === " " ? "\u00A0" : ch}
        </span>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// HOMEPAGE v2 (owner's brief): a stylish STORE, not a text landing.
// First screen shows real product frames; showcase (featured
// collections + category tiles + shelves) comes BEFORE the
// how-it-works explainer. Server component, revalidates every 60s.
// ─────────────────────────────────────────────────────────────

export const revalidate = 60;

// ── Thin line icons — same style as catalog (LineIcon) ────────
function LineIcon({ d, size = 30, color = "var(--accent)" }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
const D = {
  character: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  bolt: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  clapper: "M20.2 6L3 11l-.9-3.2a2 2 0 0 1 1.4-2.5l13.5-3.6a2 2 0 0 1 2.4 1.4L20.2 6z|M6.2 5.3l3.1 3.9|M12.4 3.6l3.1 4|M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z",
  sparkles: "M12 3l1.9 5.8L19.7 11l-5.8 1.9L12 18.7l-1.9-5.8L4.3 11l5.8-2.2L12 3z|M19 3v4|M17 5h4",
};

// preview transforms: 1024px for big tiles, 480px for shelf cards
function img1024(url: string): string {
  if (!url?.includes("/storage/v1/object/public/")) return url;
  return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=1024&quality=72&resize=contain";
}
function img480(url: string): string {
  if (!url?.includes("/storage/v1/object/public/")) return url;
  return url.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") + "?width=480&quality=68&resize=contain";
}

type Row = { id: string; title: string; type: string; file_url: string; cover_url?: string | null; credit_cost: number | null; is_free: boolean; resolution: string | null; download_count?: number };

const TYPE_COLOR: Record<string, string> = Object.fromEntries(CATEGORIES.map(c => [c.id, c.color]));

// Owner's rule: turnaround sheets are shown WHOLE — object-fit: contain,
// horizontal cards (~3/2), neutral dark background, no cropping ever.
function coverSrc(r: Row, big = false): string {
  return big ? img1024(r.file_url) : img480(r.file_url);
}

// DEV_shelf_style §3: never 4+ grey studio sheets in a row. Heuristic:
// People/Animal/Zombie/Vehicle sit on grey studio, Location/Creature/Robot
// bring dark or colored frames. Reorder so a colored card breaks every
// run of three greys — the row breathes without losing its content.
const GREY_TYPES = new Set(["People", "Animal", "Zombie", "Vehicle", "Character"]);
function breakGreyWalls<T extends { type: string }>(rows: T[]): T[] {
  const out = [...rows];
  let run = 0;
  for (let i = 0; i < out.length; i++) {
    if (!GREY_TYPES.has(out[i].type)) { run = 0; continue; }
    run++;
    if (run >= 3) {
      const j = out.findIndex((r, k) => k > i && !GREY_TYPES.has(r.type));
      if (j === -1) break; // no colored cards left — nothing to interleave
      const [colored] = out.splice(j, 1);
      out.splice(i, 0, colored);
      run = 0;
    }
  }
  return out;
}

function toShelf(rows: Row[]): ShelfItem[] {
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    img: coverSrc(r),
    type: r.type,
    typeColor: TYPE_COLOR[r.type] ?? "var(--accent)",
    price: r.credit_cost ?? 5,
    isFree: Boolean(r.is_free),
    resolution: r.resolution ?? "2K",
    href: `/catalog?category=${encodeURIComponent(r.type)}`,
  }));
}

const PUBLIC = (q: ReturnType<typeof supabase.from>) => q; // readability marker

export default async function HomePage() {
  // ── Live data (all public-catalog rules apply) ──────────────
  const base = () => supabase.from("assets")
    .select("id,title,type,file_url,cover_url,credit_cost,is_free,resolution,download_count")
    .neq("type", "Config").neq("type", "Usage").neq("type", "Generation")
    .eq("is_public", true);
  void PUBLIC;

  // NOTE (DEV_batch_60 §4): NO asset counts anywhere on the public
  // homepage — scale is communicated with words; exact numbers live
  // in the admin dashboard only.
  const covers: Record<string, Row | null> = {};
  let newest: Row[] = [];
  let popular: Row[] = [];
  let freePicks: Row[] = [];
  let collageRows: Row[] = [];
  let featured: { title: string; cat: string; cover: string; promo?: boolean; href?: string; hideTitle?: boolean }[] = [];
  // owner-curated section imagery (DEV_batch_60 §5) — empty = automatic
  let catCoversCfg: Record<string, string> = {};
  let heroFramesCfg: string[] = [];
  let heroTilesCfg: HeroTile[] = [];
  let newWeekIdsCfg: string[] = [];
  let heroFrames0: string | null = null;
  let trendingCfg: string[] = ["Sci-fi", "Cyberpunk", "Portraits", "Zombies", "Locations", "Vehicles", "Creatures"];

  try {
    const catIds = CATEGORIES.filter(c => c.id !== "Prop").map(c => c.id);
    const [newestQ, popularQ, freeQ, cfgQ, collageQ, ...perCat] = await Promise.all([
      base().order("created_at", { ascending: false }).limit(24),
      base().order("download_count", { ascending: false }).limit(24),
      base().eq("is_free", true).order("created_at", { ascending: false }).limit(12),
      supabase.from("assets").select("description").eq("type", "Config").eq("title", "homepage-config").limit(1),
      // hero showreel: LOCATIONS only — single cinematic frames
      base().eq("type", "Location").order("created_at", { ascending: false }).limit(6),
      ...catIds.map(id => base().eq("type", id).order("created_at", { ascending: false }).limit(1)),
    ]);
    newest = breakGreyWalls((newestQ.data ?? []) as Row[]).slice(0, 12);
    popular = ((popularQ.data ?? []) as Row[]).filter(r => (r.download_count ?? 0) > 0);
    if (popular.length < 4) popular = (popularQ.data ?? []) as Row[];
    popular = breakGreyWalls(popular).slice(0, 12);
    freePicks = (freeQ.data ?? []) as Row[];
    collageRows = (collageQ.data ?? []) as Row[];
    catIds.forEach((id, i) => {
      covers[id] = ((perCat[i]?.data ?? []) as Row[])[0] ?? null;
    });
    try {
      const saved = cfgQ.data?.[0]?.description ? JSON.parse(cfgQ.data[0].description) : {};
      if (Array.isArray(saved.featured)) featured = saved.featured;
      if (saved.catCovers && typeof saved.catCovers === "object") catCoversCfg = saved.catCovers;
      if (Array.isArray(saved.heroFrames)) heroFramesCfg = saved.heroFrames.filter(Boolean);
      // hand-framed wall tiles (#82) — fall back to legacy plain frames
      if (Array.isArray(saved.heroTiles)) {
        heroTilesCfg = saved.heroTiles
          .filter((t: { src?: unknown }) => t && typeof t.src === "string" && t.src)
          .map((t: { src: string; x?: number; y?: number; z?: number }) => ({
            src: t.src, x: Number(t.x) || 0, y: Number(t.y) || 0, z: Number(t.z) || 1,
          }));
      }
      if (!heroTilesCfg.length && heroFramesCfg.length) {
        heroTilesCfg = heroFramesCfg.map(u => ({ src: u, x: 0, y: 0, z: 1 }));
      }
      heroFrames0 = heroTilesCfg[0]?.src ?? heroFramesCfg[0] ?? null;
      if (Array.isArray(saved.newWeekIds)) newWeekIdsCfg = saved.newWeekIds.filter(Boolean);
      if (Array.isArray(saved.trending) && saved.trending.length > 0) trendingCfg = saved.trending.filter(Boolean);
    } catch { /* fall back below */ }
    // hand-picked «New this week» (§5): fetch by ids, keep the saved order
    if (newWeekIdsCfg.length) {
      const { data } = await base().in("id", newWeekIdsCfg);
      const byId = new Map(((data ?? []) as Row[]).map(r => [r.id, r]));
      const picked = newWeekIdsCfg.map(id => byId.get(id)).filter(Boolean) as Row[];
      if (picked.length >= 4) newest = picked;
    }
  } catch { /* the page still renders with fallbacks */ }

  // Featured fallback: top categories, covers from the freshest asset
  if (featured.length === 0) {
    featured = [
      { title: "Portraits & people", cat: "People", cover: covers.People ? coverSrc(covers.People, true) : "" },
      { title: "Cinematic worlds", cat: "Location", cover: covers.Location ? coverSrc(covers.Location, true) : "" },
      { title: "Vehicles & starships", cat: "Vehicle", cover: covers.Vehicle ? coverSrc(covers.Vehicle, true) : "" },
      { title: "Creatures & monsters", cat: "Creature", cover: covers.Creature ? coverSrc(covers.Creature, true) : "" },
    ].filter(t => t.cover);
  }

  // Hero collage: cinematic location frames — single images that crop
  // cleanly in a mosaic; turnaround sheets never get cropped anywhere
  const collage = collageRows.length >= 4
    ? collageRows
    : (["Location", "People", "Vehicle", "Creature", "Robot", "Zombie"].map(t => covers[t]).filter(Boolean) as Row[]);

  const catTiles = CATEGORIES.filter(c => c.id !== "Prop" && covers[c.id]);

  return (
    <>
      {/* ── HERO: text LEFT, live collage RIGHT ──────────────── */}
      <section className="relative overflow-hidden px-6" style={{ paddingTop: 64, paddingBottom: 56 }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 55% at 30% 0%, color-mix(in srgb, var(--accent) 16%, transparent) 0%, transparent 70%)" }}
        />
        <div className="max-w-7xl mx-auto relative grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy + CTAs + mini-stats */}
          <div className="fade-in-up">
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full mb-6"
              style={{ backgroundColor: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent-soft)", border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" }}
            >
              <LineIcon d={D.clapper} size={13} color="var(--accent-soft)" /> Your personal AI film studio
            </span>
            <h1 className="text-5xl md:text-6xl font-bold mb-5 leading-[1.06] tracking-tight" style={{ color: "var(--fg)" }}>
              <Letters text="Direct films with" />{" "}
              <span className="cine-letter gradient-animate" style={{ animationDelay: "520ms" }}>Cineman</span>
            </h1>
            <p className="text-lg mb-4 max-w-md" style={{ color: "var(--fg-muted)" }}>
              A huge library of cinematic assets for AI video — cast, locations,
              vehicles and more.
            </p>
            {/* trust: commercial license */}
            <p className="inline-flex items-center gap-2 text-sm mb-8" style={{ color: "var(--accent-soft)" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />
              </svg>
              Commercial license included
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/studio" className="btn-primary text-base cine-sheen">Try Studio →</Link>
              <Link href="/catalog" className="btn-secondary text-base">Browse catalog</Link>
            </div>

            {/* STOCK-STYLE HERO SEARCH (DEV_homepage_search) */}
            <div className="mt-8">
              <HeroSearch trending={trendingCfg} />
              <p className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "#2DD4C4" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                Includes free assets — try before you spend a credit.
              </p>
            </div>
            {/* marketing line instead of the stats row (owner's copy §A1) */}
            <p className="mt-10 text-[15px] leading-relaxed max-w-lg" style={{ color: "var(--fg-muted)" }}>
              A massive library of ready-made cinematic assets for AI creators — cast,
              locations, props and more. Find anything in seconds and spend your time
              creating, not building. <span style={{ color: "#2DD4C4", fontWeight: 600 }}>Free assets included.</span>
            </p>
          </div>
          {/* Right: living showreel — ken-burns crossfade over cinematic
              location frames (single images, safe to cover-crop) */}
          <div className="fade-in-up hidden md:block" style={{ animationDelay: "0.12s" }}>
            <HeroWall
              tiles={heroTilesCfg.length >= 3
                ? heroTilesCfg
                : collage.slice(0, 9).map(a => ({ src: coverSrc(a, true), x: 0, y: 0, z: 1 }))}
            />
          </div>
        </div>
      </section>

      {/* ── FEATURED COLLECTIONS (owner curates via Admin → Settings) ── */}
      {/* cinematic frames lead (owner's polish §4): promo posters first,
          then colourful location frames; grey studio sheets sink below */}
      {(() => { const rank = (t: typeof featured[number]) => t.promo ? 0 : t.cat === 'Location' ? 1 : ['Vehicle', 'Creature'].includes(t.cat) ? 2 : 3; featured = [...featured].sort((x, y) => rank(x) - rank(y)); return null })()}
      {featured.length > 0 && (
        <Reveal><section className="max-w-7xl mx-auto px-6" style={{ marginBottom: 56 }}>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Featured collections</h2>
            <Link href="/catalog" className="text-sm font-semibold" style={{ color: "var(--accent)" }}>Browse all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.slice(0, 4).map((t, i) => (
              <Link
                key={`${t.title}-${i}`}
                href={t.promo && t.href
                  ? t.href
                  : t.cat === "Free" ? "/catalog?free=1" : `/catalog?category=${encodeURIComponent(t.cat)}`}
                className="group block cine-stagger"
                style={{ ["--stg" as never]: `${i * 60}ms` }}
              >
                <Tilt
                  max={6}
                  className="cine-ring cine-shadow cine-sheen"
                  style={{ borderRadius: 12, overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.07)", backgroundColor: "#17151E" }}
                >
                  {/* full sheet on the graphite mat — no text on the photo.
                      PROMO posters (§6) fill the 16:9 frame edge to edge. */}
                  <div style={{ aspectRatio: "16/9", overflow: "hidden", position: "relative" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.cover} alt={t.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: t.promo ? "cover" : "contain", display: "block", padding: t.promo ? 0 : 12 }} />
                  </div>
                  {/* caption UNDER the image — hidden for promo posters that
                      carry their own artwork text (§6) */}
                  {!(t.promo && t.hideTitle) && (
                    <div style={{ padding: "11px 14px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                      <p className="text-base font-bold" style={{ color: "var(--fg)", margin: 0 }}>{t.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)", margin: 0 }}>
                        {t.promo ? "Promo" : t.cat === "Free" ? "Free picks" : "Curated collection"}
                      </p>
                    </div>
                  )}
                </Tilt>
              </Link>
            ))}
          </div>
        </section></Reveal>
      )}

      {/* ── CATEGORY TILES with live counters ────────────────── */}
      <Reveal><section className="max-w-7xl mx-auto px-6" style={{ marginBottom: 56 }}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Shop by category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {catTiles.map((c, i) => (
            <Link
              key={c.id}
              href={`/catalog?category=${encodeURIComponent(c.id)}`}
              className="group block cine-stagger"
              style={{ ["--stg" as never]: `${i * 45}ms` }}
            >
              <Tilt
                max={7}
                className="cine-ring cine-shadow"
                style={{ borderRadius: 12, overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.07)", backgroundColor: "#17151E" }}
              >
                <div style={{ aspectRatio: "16/9", overflow: "hidden" }}>
                  {(catCoversCfg[c.id] || covers[c.id]) && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={catCoversCfg[c.id] || coverSrc(covers[c.id]!)} alt={c.label} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", padding: 8 }} />
                  )}
                </div>
                {/* label UNDER the image — no counters on the public page */}
                <div style={{ padding: "9px 12px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                  <p className="text-sm font-semibold" style={{ color: "var(--fg)", margin: 0 }}>{c.label}</p>
                </div>
              </Tilt>
            </Link>
          ))}
        </div>
      </section></Reveal>

      {/* ── CURATED SHELVES: live store rows ─────────────────── */}
      <HomeShelf title="New this week" seeAllHref="/catalog" items={toShelf(newest)} />
      <HomeShelf title="Most downloaded" seeAllHref="/catalog" items={toShelf(popular)} />
      <HomeShelf title="Free picks" badge="Free" accent="#2DD4C4" seeAllHref="/catalog?free=1" items={toShelf(freePicks)} />

      {/* ── STUDIO PROMO (owner's copy §A2): the bridge from finding
          assets to directing with them ── */}
      <Reveal><section className="px-6 max-w-7xl mx-auto" style={{ marginBottom: 64 }}>
        <div
          className="relative overflow-hidden rounded-2xl px-8 py-14 md:px-16 text-center"
          style={{ backgroundColor: "#120D1D", border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)" }}
        >
          {/* cinematic backdrop: dimmed location frame + accent glow */}
          {heroFrames0 && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={heroFrames0} alt="" className="absolute inset-0 w-full h-full" style={{ objectFit: "cover", opacity: 0.16, filter: "saturate(1.15)" }} />
          )}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 70% 90% at 50% 110%, color-mix(in srgb, var(--accent) 24%, transparent) 0%, transparent 70%)" }} />
          <div className="relative">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: "var(--fg)" }}>
              Don&apos;t just find assets — direct with them.
            </h2>
            <p className="text-base max-w-2xl mx-auto mb-8" style={{ color: "var(--fg-muted)" }}>
              Bring ready-made characters and locations into Cineman Studio — or upload
              your own — describe your scene, and get a cinematic video back. Consistent
              cast, real direction, done in minutes.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/studio" className="btn-primary text-base cine-sheen">Create in Studio →</Link>
              <Link href="/catalog" className="btn-secondary text-base">Browse catalog</Link>
            </div>
          </div>
        </div>
      </section></Reveal>

      {/* ── HOW IT WORKS — after the showcase (owner's order) ── */}
      <Reveal><section className="px-6 max-w-5xl mx-auto" style={{ marginBottom: 64 }}>
        <div className="text-center mb-10 fade-in-up">
          <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--fg)" }}>How it works</h2>
          <p style={{ color: "var(--fg-muted)" }}>From idea to cinematic shot in three moves</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: "1", title: "Describe your idea", desc: "Type or dictate: what are we shooting, who is the hero, where it happens." },
            { n: "2", title: "Cineman sets the scene", desc: "He casts consistent heroes and locations from the base and directs camera, light and mood." },
            { n: "3", title: "Hit Generate", desc: "A cinematic Seedance shot with your exact cast — draft in minutes, final in 1080p with audio." },
          ].map(({ n, title, desc }, i) => (
            <div key={n} className="card p-7 fade-in-up" style={{ animationDelay: `${0.08 + i * 0.1}s` }}>
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="flex items-center justify-center rounded-xl font-bold text-white shrink-0"
                  style={{ width: 34, height: 34, background: "linear-gradient(135deg, var(--accent), var(--accent-strong))", boxShadow: "0 6px 18px color-mix(in srgb, var(--accent) 45%, transparent)" }}
                >
                  {n}
                </div>
                <h3 className="text-base font-bold" style={{ color: "var(--fg)" }}>{title}</h3>
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section></Reveal>

      {/* ── POWERED BY + MODEL MATCH (DEV_homepage_powered_by) ── */}
      <Reveal><PoweredBy /></Reveal>

      {/* ── EVERYTHING YOU NEED (kept) ───────────────────────── */}
      <Reveal><section className="px-6 max-w-7xl mx-auto" style={{ marginBottom: 64 }}>
        <div className="text-center mb-12 fade-in-up">
          <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--fg)" }}>Everything you need</h2>
          <p style={{ color: "var(--fg-muted)" }}>
            One studio: AI director, ready cast and locations, cinematic video generation
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { icon: D.clapper, title: "AI Director Studio", desc: "Chat with Cineman: pick the type, cast heroes, set the scene — he writes the prompt and shoots the video for you.", accent: "var(--accent)" },
            { icon: D.character, title: "Ready Cast & Locations", desc: "A curated base of consistent characters and cinematic locations. Search it, reuse it — or upload your own.", accent: "var(--accent-soft)" },
            { icon: D.bolt, title: "Cinematic Video in Minutes", desc: "Seedance-powered generation with face-consistent heroes. Draft fast, finalize in 1080p with audio. Commercial license.", accent: "#00C2BA" },
          ].map(({ icon, title, desc, accent }, i) => (
            <div
              key={title}
              className="card p-8 text-center fade-in-up transition-transform duration-300 hover:-translate-y-1.5"
              style={{ animationDelay: `${0.1 + i * 0.12}s` }}
            >
              <div
                className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
                style={{ width: 60, height: 60, background: `linear-gradient(135deg, ${accent}22, ${accent}0d)`, border: `1px solid ${accent}40`, boxShadow: `0 8px 24px ${accent}1f` }}
              >
                <LineIcon d={icon} color={accent} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--fg)" }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>{desc}</p>
              <div className="mt-4 h-0.5 w-12 mx-auto rounded-full" style={{ backgroundColor: accent }} />
            </div>
          ))}
        </div>
      </section></Reveal>

      {/* ── FINAL CTA ─────────────────────────────────────────── */}
      <section
        className="mx-6 mb-24 rounded-2xl p-12 text-center max-w-5xl md:mx-auto fade-in-up"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, transparent) 0%, rgba(0,194,186,0.08) 100%)",
          border: "1px solid color-mix(in srgb, var(--accent) 25%, transparent)",
        }}
      >
        <div className="flex justify-center mb-4"><LineIcon d={D.sparkles} size={34} /></div>
        <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--fg)" }}>Ready to shoot your first AI film?</h2>
        <p className="mb-8" style={{ color: "var(--fg-muted)" }}>
          Chat with your AI director and get your first cinematic shot today. Plans from $9.99/mo
        </p>
        <Link href="/pricing" className="btn-primary btn-shimmer">Get Started</Link>
      </section>
    </>
  );
}
