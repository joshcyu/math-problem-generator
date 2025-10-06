import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import NavBar from './components/NavBar'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Math Problem Generator',
  description: 'AI-powered math problem generator for Primary 5 students',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className={inter.className + ' overflow-x-hidden'}>
        <NavBar />
        <div className="min-h-screen">{children}</div>
        <footer className="border-t bg-white/70 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-gray-500 flex items-center justify-between">
            <span>© {new Date().getFullYear()} MPG</span>
            <span className="hidden sm:inline">Built with Next.js + Tailwind</span>
          </div>
        </footer>
      </body>
    </html>
  )
}
