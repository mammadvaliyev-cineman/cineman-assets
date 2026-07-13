'use client'

// Short fade between page navigations (DEV_flair_motion §5).
// A template remounts on every route change — the .cine-page
// animation plays once per navigation, 220ms, transform+opacity only.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="cine-page">{children}</div>
}
