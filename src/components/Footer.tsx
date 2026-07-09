import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="border-t border-[#1a1a1a] py-8 px-6 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-sm text-gray-500">&copy; 2026 Cineman AI. All rights reserved.</p>
        <div className="flex gap-6">
          <Link href="/studio" className="text-sm text-gray-500 hover:text-white transition-colors">Cineman Studio</Link>
          <Link href="/catalog" className="text-sm text-gray-500 hover:text-white transition-colors">AI Assets</Link>
          <Link href="/pricing" className="text-sm text-gray-500 hover:text-white transition-colors">Pricing</Link>
          <Link href="/account" className="text-sm text-gray-500 hover:text-white transition-colors">Account</Link>
        </div>
      </div>
    </footer>
  )
}
