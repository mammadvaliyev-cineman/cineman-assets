import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { CATEGORIES } from "@/config/categories";
import HomeShelf, { ShelfItem } from "@/components/HomeShelf";
import Reveal from "@/components/Reveal";

// ─────────────────────────────────────────────────────────────
// HOMEPAGE v2 (owner's brief): a stylish STORE, not a text landing.
// First screen shows real product frames; showcase (featured
// collections + category tiles + shelves) comes BEFORE the
// how-it-works explainer. Server component, revalidates every 60s.
// ─────────────────────────────────────────────────────────────

export const revalidate = 60;

// ── Thin line icons — same style as catalog (LineIcon) ────────
function LineIcon({ d, size = 30, color = "#9765E0" }: { d: string; size?: number; color?: string }) {
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
    typeColor: TYPE_COLOR[r.type] ?? "#9765E0",
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

  let total = 0;
  const counts: Record<string, number> = {};
  const covers: Record<string, Row | null> = {};
  let newest: Row[] = [];
  let popular: Row[] = [];
  let freePicks: Row[] = [];
  let collageRows: Row[] = [];
  let featured: { title: string; cat: string; cover: string }[] = [];

  try {
    const catIds = CATEGORIES.filter(c => c.id !== "Prop").map(c => c.id);
    const [totalQ, newestQ, popularQ, freeQ, cfgQ, collageQ, ...perCat] = await Promise.all([
      supabase.from("assets").select("id", { count: "exact", head: true })
        .neq("type", "Config").neq("type", "Usage").neq("type", "Generation").eq("is_public", true),
      base().order("created_at", { ascending: false }).limit(24),
      base().order("download_count", { ascending: false }).limit(24),
      base().eq("is_free", true).order("created_at", { ascending: false }).limit(12),
      supabase.from("assets").select("description").eq("type", "Config").eq("title", "homepage-config").limit(1),
      // hero collage: LOCATIONS only — single cinematic frames that crop
      // beautifully in a mosaic (turnaround sheets never crop — owner's rule)
      base().eq("type", "Location").order("created_at", { ascending: false }).limit(6),
      ...catIds.map(id => base().eq("type", id).order("created_at", { ascending: false }).limit(1)),
      ...catIds.map(id =>
        supabase.from("assets").select("id", { count: "exact", head: true }).eq("type", id).eq("is_public", true)),
    ]);
    total = totalQ.count ?? 0;
    newest = breakGreyWalls((newestQ.data ?? []) as Row[]).slice(0, 12);
    popular = ((popularQ.data ?? []) as Row[]).filter(r => (r.download_count ?? 0) > 0);
    if (popular.length < 4) popular = (popularQ.data ?? []) as Row[];
    popular = breakGreyWalls(popular).slice(0, 12);
    freePicks = (freeQ.data ?? []) as Row[];
    collageRows = (collageQ.data ?? []) as Row[];
    catIds.forEach((id, i) => {
      covers[id] = ((perCat[i]?.data ?? []) as Row[])[0] ?? null;
      counts[id] = (perCat[catIds.length + i] as { count: number | null })?.count ?? 0;
    });
    try {
      const saved = cfgQ.data?.[0]?.description ? JSON.parse(cfgQ.data[0].description) : {};
      if (Array.isArray(saved.featured)) featured = saved.featured;
    } catch { /* fall back below */ }
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

  const catTiles = CATEGORIES.filter(c => c.id !== "Prop" && (counts[c.id] ?? 0) > 0);

  return (
    <>
      {/* ── HERO: text LEFT, live collage RIGHT ──────────────── */}
      <section className="relative overflow-hidden px-6" style={{ paddingTop: 64, paddingBottom: 56 }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "radial-gradient(ellipse 60% 55% at 30% 0%, rgba(151,101,224,0.16) 0%, transparent 70%)" }}
        />
        <div className="max-w-7xl mx-auto relative grid md:grid-cols-2 gap-12 items-center">
          {/* Left: copy + CTAs + mini-stats */}
          <div className="fade-in-up">
            <span
              className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-full mb-6"
              style={{ backgroundColor: "rgba(151,101,224,0.12)", color: "#CE95FB", border: "1px solid rgba(151,101,224,0.25)" }}
            >
              <LineIcon d={D.clapper} size={13} color="#CE95FB" /> Your personal AI film studio
            </span>
            <h1 className="text-5xl md:text-6xl font-bold mb-5 leading-[1.06] tracking-tight" style={{ color: "var(--fg)" }}>
              Direct films with{" "}
              <span className="gradient-animate">Cineman</span>
            </h1>
            <p className="text-lg mb-8 max-w-md" style={{ color: "var(--fg-muted)" }}>
              Ready cast, cinematic locations and an AI director that shoots
              video for films, ads and music videos. Commercial license included.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/studio" className="btn-primary text-base btn-shimmer">Try Studio →</Link>
              <Link href="/catalog" className="btn-secondary text-base">Browse catalog</Link>
            </div>
            <div className="mt-10 flex gap-10">
              {[
                [total > 0 ? total.toLocaleString("en-US") : "2,300+", "ready assets"],
                ["7 steps", "idea → video"],
                ["1", "AI director"],
              ].map(([val, label]) => (
                <div key={label}>
                  <div className="text-2xl font-bold" style={{ color: "#9765E0" }}>{val}</div>
                  <div className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Right: live collage of real frames */}
          <div className="fade-in-up hidden md:block" style={{ animationDelay: "0.12s" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridAutoRows: 110, gap: 10 }}>
              {collage.slice(0, 6).map((a, i) => (
                <Link
                  key={a.id}
                  href={`/catalog?category=${encodeURIComponent(a.type)}`}
                  className="cine-lift cine-sheen"
                  style={{
                    gridRow: i === 0 || i === 3 ? "span 2" : "span 1",
                    borderRadius: 12, overflow: "hidden",
                    border: "0.5px solid rgba(255,255,255,0.07)",
                    boxShadow: "0 10px 34px rgba(0,0,0,0.4)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={coverSrc(a)} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURED COLLECTIONS (owner curates via Admin → Settings) ── */}
      {featured.length > 0 && (
        <Reveal><section className="max-w-7xl mx-auto px-6" style={{ marginBottom: 56 }}>
          <div className="flex items-end justify-between mb-4">
            <h2 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Featured collections</h2>
            <Link href="/catalog" className="text-sm font-semibold" style={{ color: "#9765E0" }}>Browse all →</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.slice(0, 4).map(t => (
              <Link
                key={t.title}
                href={t.cat === "Free" ? "/catalog?free=1" : `/catalog?category=${encodeURIComponent(t.cat)}`}
                className="group cine-lift cine-sheen"
                style={{ position: "relative", borderRadius: 12, overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.07)", aspectRatio: "16/9", display: "block", backgroundColor: "#17151E" }}
              >
                {/* full sheet on the graphite mat, never cropped (owner's rule) */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.cover} alt={t.title} loading="lazy" className="group-hover:scale-[1.03] transition-transform duration-200" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", padding: 12 }} />
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%", background: "linear-gradient(to top, rgba(10,10,15,0.85) 0%, transparent 100%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", left: 14, right: 14, bottom: 12, zIndex: 2 }}>
                  <p className="text-base font-bold" style={{ color: "white", margin: 0 }}>{t.title}</p>
                  <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.65)", margin: 0 }}>
                    {t.cat === "Free" ? "Free assets" : `${(counts[t.cat] ?? 0).toLocaleString("en-US")} assets`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section></Reveal>
      )}

      {/* ── CATEGORY TILES with live counters ────────────────── */}
      <Reveal><section className="max-w-7xl mx-auto px-6" style={{ marginBottom: 56 }}>
        <h2 className="text-2xl font-bold mb-4" style={{ color: "var(--fg)" }}>Shop by category</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {catTiles.map(c => (
            <Link
              key={c.id}
              href={`/catalog?category=${encodeURIComponent(c.id)}`}
              className="group cine-lift"
              style={{ borderRadius: 12, overflow: "hidden", border: "0.5px solid rgba(255,255,255,0.07)", backgroundColor: "#17151E", display: "block", position: "relative" }}
            >
              <div style={{ aspectRatio: "16/9", overflow: "hidden", position: "relative" }}>
                {covers[c.id] && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={coverSrc(covers[c.id]!)} alt={c.label} loading="lazy" className="group-hover:scale-[1.03] transition-transform duration-200" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", padding: 8 }} />
                )}
                <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "45%", background: "linear-gradient(to top, rgba(10,10,15,0.85) 0%, transparent 100%)", pointerEvents: "none" }} />
                <div style={{ position: "absolute", left: 12, right: 12, bottom: 8, zIndex: 2 }}>
                  <p className="text-sm font-semibold" style={{ color: "#fff", margin: 0 }}>{c.label}</p>
                  <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.6)", margin: 0 }}>{(counts[c.id] ?? 0).toLocaleString("en-US")}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section></Reveal>

      {/* ── CURATED SHELVES: live store rows ─────────────────── */}
      <HomeShelf title="New this week" seeAllHref="/catalog" items={toShelf(newest)} />
      <HomeShelf title="Most downloaded" seeAllHref="/catalog" items={toShelf(popular)} />
      <HomeShelf title="Free picks" badge="Free" accent="#2DD4C4" seeAllHref="/catalog?free=1" items={toShelf(freePicks)} />

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
                  style={{ width: 34, height: 34, background: "linear-gradient(135deg, #9765E0, #534FA5)", boxShadow: "0 6px 18px rgba(151,101,224,0.45)" }}
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
            { icon: D.clapper, title: "AI Director Studio", desc: "Chat with Cineman: pick the type, cast heroes, set the scene — he writes the prompt and shoots the video for you.", accent: "#9765E0" },
            { icon: D.character, title: "Ready Cast & Locations", desc: "A curated base of consistent characters and cinematic locations. Search it, reuse it — or upload your own.", accent: "#CE95FB" },
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
          background: "linear-gradient(135deg, rgba(151,101,224,0.15) 0%, rgba(0,194,186,0.08) 100%)",
          border: "1px solid rgba(151,101,224,0.25)",
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
