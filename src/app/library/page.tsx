'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Library merged into the catalog shell (owner's spec A1):
// «My downloads» and «Saved» render inside the catalog with the
// sidebar staying put. This stub keeps old links working.
export default function LibraryRedirect() {
  const router = useRouter()
  useEffect(() => {
    const saved = window.location.search.includes('tab=saved')
    router.replace(saved ? '/catalog?view=saved' : '/catalog?view=downloads')
  }, [router])
  return (
    <div className="max-w-2xl mx-auto px-6 py-24 text-center">
      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Opening your library…</p>
    </div>
  )
}
