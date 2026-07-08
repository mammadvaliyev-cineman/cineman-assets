import Link from "next/link";

// ── Thin line icons — same style as catalog (LineIcon) ────────
function LineIcon({ d, size = 30, color = "#9765E0" }: { d: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {d.split("|").map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}
const D = {
  location: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z|M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  character: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2|M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  bolt: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  clapper: "M20.2 6L3 11l-.9-3.2a2 2 0 0 1 1.4-2.5l13.5-3.6a2 2 0 0 1 2.4 1.4L20.2 6z|M6.2 5.3l3.1 3.9|M12.4 3.6l3.1 4|M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8z",
  sparkles: "M12 3l1.9 5.8L19.7 11l-5.8 1.9L12 18.7l-1.9-5.8L4.3 11l5.8-2.2L12 3z|M19 3v4|M17 5h4",
};

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-24 px-6">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(151,101,224,0.18) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-5xl mx-auto text-center relative">
          {/* Cineman mascot — живой маскот на главной */}
          <div className="flex justify-center mb-6 fade-in-up">
            <style>{`@keyframes cinemanFloatHome { 0%, 100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-10px) rotate(2deg) } }`}</style>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/cineman-mascot.png"
              alt="Cineman"
              width={150}
              height={150}
              className="object-contain"
              style={{
                animation: "cinemanFloatHome 3.8s ease-in-out infinite",
                filter: "drop-shadow(0 14px 28px rgba(139,92,246,0.4))",
              }}
            />
          </div>

          <span
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6 fade-in-up"
            style={{
              backgroundColor: "rgba(151,101,224,0.12)",
              color: "#9765E0",
              border: "1px solid rgba(151,101,224,0.25)",
              animationDelay: "0.08s",
            }}
          >
            <LineIcon d={D.clapper} size={14} /> AI-Powered Cinematic Studio
          </span>

          <h1
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight fade-in-up"
            style={{ color: "var(--fg)", animationDelay: "0.16s" }}
          >
            Premium AI Assets
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #9765E0, #00C2BA)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              for Filmmakers
            </span>
          </h1>

          <p
            className="text-xl mb-10 max-w-2xl mx-auto fade-in-up"
            style={{ color: "var(--fg-muted)", animationDelay: "0.24s" }}
          >
            AI-generated locations and characters for film, advertising, and creative production.
            Commercial license included.
          </p>

          <div className="flex flex-wrap gap-4 justify-center fade-in-up" style={{ animationDelay: "0.32s" }}>
            <Link href="/studio" className="btn-primary text-lg btn-shimmer">
              Try Studio →
            </Link>
            <Link href="/catalog" className="btn-secondary text-lg">
              Browse Catalog
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto fade-in-up" style={{ animationDelay: "0.4s" }}>
            {[
              ["2", "Asset Types"],
              ["∞", "Inspiration"],
              ["3", "Plans"],
            ].map(([val, label]) => (
              <div key={label}>
                <div className="text-3xl font-bold" style={{ color: "#9765E0" }}>
                  {val}
                </div>
                <div className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature highlights */}
      <section className="px-6 pb-24 max-w-7xl mx-auto">
        <div className="text-center mb-12 fade-in-up">
          <h2 className="text-3xl font-bold mb-3" style={{ color: "var(--fg)" }}>
            Everything You Need
          </h2>
          <p style={{ color: "var(--fg-muted)" }}>
            Professional-grade AI assets built for cinematic production
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: D.location,
              title: "AI Locations",
              desc: "Cinematic AI-generated environments — interiors, exteriors, urban, nature. Ready for production.",
              accent: "#9765E0",
            },
            {
              icon: D.character,
              title: "AI Characters",
              desc: "Photorealistic AI-generated characters for storyboards, lookbooks, and reference.",
              accent: "#CE95FB",
            },
            {
              icon: D.bolt,
              title: "Instant Download",
              desc: "No watermarks. Full commercial license. Download and use immediately in your projects.",
              accent: "#00C2BA",
            },
          ].map(({ icon, title, desc, accent }, i) => (
            <div
              key={title}
              className="card p-8 text-center fade-in-up transition-transform duration-300 hover:-translate-y-1.5"
              style={{ animationDelay: `${0.1 + i * 0.12}s` }}
            >
              <div
                className="mx-auto mb-5 flex items-center justify-center rounded-2xl"
                style={{
                  width: 60,
                  height: 60,
                  background: `linear-gradient(135deg, ${accent}22, ${accent}0d)`,
                  border: `1px solid ${accent}40`,
                  boxShadow: `0 8px 24px ${accent}1f`,
                }}
              >
                <LineIcon d={icon} color={accent} />
              </div>
              <h3 className="text-lg font-bold mb-2" style={{ color: "var(--fg)" }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                {desc}
              </p>
              <div className="mt-4 h-0.5 w-12 mx-auto rounded-full" style={{ backgroundColor: accent }} />
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section
        className="mx-6 mb-24 rounded-2xl p-12 text-center max-w-5xl md:mx-auto fade-in-up"
        style={{
          background: "linear-gradient(135deg, rgba(151,101,224,0.15) 0%, rgba(0,194,186,0.08) 100%)",
          border: "1px solid rgba(151,101,224,0.25)",
        }}
      >
        <div className="flex justify-center mb-4">
          <LineIcon d={D.sparkles} size={34} />
        </div>
        <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--fg)" }}>
          Ready to create?
        </h2>
        <p className="mb-8" style={{ color: "var(--fg-muted)" }}>
          Get access to all cinematic AI assets starting at $9.99/mo
        </p>
        <Link href="/pricing" className="btn-primary btn-shimmer">
          Get Started
        </Link>
      </section>
    </>
  );
}
