import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'
import { ThemeProvider } from '@/components/ThemeProvider'

export const metadata: Metadata = {
  title: 'Cineman Assets — AI-Generated Cinematic Content',
  description:
    'Premium AI-generated cinematic assets for filmmakers, directors, and content creators. Video clips, LUTs, sound design, and motion graphics.',
  keywords: ['AI assets', 'cinematic', 'video generation', 'LUT', 'motion graphics', 'sound design'],
  openGraph: {
    title: 'Cineman Assets',
    description: 'Premium AI-generated cinematic assets',
    url: 'https://cineman.ai',
    siteName: 'Cineman Assets',
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
          <Navbar />
          <main className="flex-1">{children}</main>
          <Footer />
        </ThemeProvider>
      </body>
    </html>
  )
}
