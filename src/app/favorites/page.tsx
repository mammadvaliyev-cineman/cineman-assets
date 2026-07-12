'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// «My favorites» moved into Library → Saved (spec C2).
// This stub keeps old links and bookmarks working.
export default function FavoritesRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/library') }, [router])
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Favorites moved to your Library — redirecting…</p>
    </div>
  )
}
