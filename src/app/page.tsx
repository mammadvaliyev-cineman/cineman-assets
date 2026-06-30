import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden py-28 px-6">
        {/* Radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(151,101,224,0.18) 0%, transparent 70%)",
          }}
        />
        <div className="max-w-5xl mx-auto text-center relative">
          <span
            className="inline-block text-xs font-semibold uppercase tracking-widest px-4 py-1.5 rounded-full mb-6"
            style={{
              backgroundColor: "rgba(151,101,224,0.12)",
              color: "#9765E0",
              border: "1px solid rgba(151,101,224,0.25)",
            }}
          >
            🎬 AI-Powered Cinematic Assets
          </span>

          <h1
            className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            style={{ color: "var(--fg)" }}
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
            className="text-xl mb-10 max-w-2xl mx-auto"
            style={{ color: "var(--fg-muted)" }}
          >
            AI-generated locations and characters for film, advertising, and creative production.
            Commercial license included.
          </p>

          <div className="flex flex-wrap gap-4 justify-center">
            <Link href="/catalog" className="btn-primary text-lg">
              Browse Catalog →
            </Link>
            <Link href="/pricing" className="btn-secondary text-lg">
              See Pricing
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              ["2", "Asset Types"],
              ["∞", "Inspiration"],
              ["3", "Plans"],
            ].map(([val, label]) => (
              <div key={label}>
                <div
                  className="text-3xl font-bold"
                  style={{ color: "#9765E0" }}
                >
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
        <div className="text-center mb-12">
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
              icon: "🏛️",
              title: "AI Locations",
              desc: "Cinematic AI-generated environments — interiors, exteriors, urban, nature. Ready for production.",
              accent: "#9765E0",
            },
            {
              icon: "🧍",
              title: "AI Characters",
              desc: "Photorealistic AI-generated characters for storyboards, lookbooks, and creative reference.",
              accent: "#CE95FB",
            },
            {
              icon: "⚡",
              title: "Instant Download",
              desc: "No watermarks. Full commercial license. Download and use immediately in your projects.",
              accent: "#00C2BA",
            },
          ].map(({ icon, title, desc, accent }) => (
            <div key={title} className="card p-8 text-center">
              <div className="text-4xl mb-4">{icon}</div>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: "var(--fg)" }}
              >
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--fg-muted)" }}>
                {desc}
              </p>
              <div
                className="mt-4 h-0.5 w-12 mx-auto rounded-full"
                style={{ backgroundColor: accent }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="mx-6 mb-24 rounded-2xl p-12 text-center max-w-5xl mx-auto"
        style={{
          background: "linear-gradient(135deg, rgba(151,101,224,0.15) 0%, rgba(0,194,186,0.08) 100%)",
          border: "1px solid rgba(151,101,224,0.25)",
        }}
      >
        <h2
          className="text-3xl font-bold mb-4"
          style={{ color: "var(--fg)" }}
        >
          Ready to create?
        </h2>
        <p className="mb-8" style={{ color: "var(--fg-muted)" }}>
          Get access to all cinematic AI assets starting at $9.99/mo
        </p>
        <Link href="/pricing" className="btn-primary">
          Get Started
        </Link>
      </section>
    </>
  );
}
