import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'Cineman AI — Direct Films with an AI Director',
  description:
    'Your personal AI film studio: chat with Cineman, cast consistent heroes and locations from a curated base, and generate cinematic video for films, ads and music videos.',
  keywords: ['AI film studio', 'AI director', 'video generation', 'Seedance', 'cinematic', 'AI assets'],
  openGraph: {
    title: 'Cineman AI',
    description: 'Direct films with an AI director — from idea to cinematic shot',
    url: 'https://cineman.ai',
    siteName: 'Cineman AI',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark scroll-smooth">
      <body className="min-h-screen flex flex-col antialiased">
        <ThemeProvider>
          <AuthProvider>
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
