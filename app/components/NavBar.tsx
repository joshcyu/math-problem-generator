'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import clsx from 'clsx'

export default function NavBar() {
  const [open, setOpen] = useState(false)

  // Lock background scroll & close on ESC
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const NavLinks = () => (
    <div className="flex flex-col sm:flex-row gap-3 sm:gap-5 text-sm">
      <Link href="/" className="text-gray-700 hover:text-gray-900">Home</Link>
      <Link href="/generator" className="text-gray-700 hover:text-gray-900">Generator</Link>
      <Link href="/sessions" className="text-gray-700 hover:text-gray-900">Session list</Link>
      <Link href="/history" className="text-gray-700 hover:text-gray-900">History</Link>
    </div>
  )

  return (
    <header className="sticky top-0 z-40 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <nav className="mx-auto max-w-5xl px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight text-gray-900">
          <span className="inline-block -rotate-3 mr-2 text-blue-600">∑</span>
          Math Problem Generator
        </Link>

        {/* Desktop */}
        <div className="hidden sm:block">
          <NavLinks />
        </div>

        {/* Mobile toggle */}
        <button
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="sm:hidden inline-flex items-center justify-center rounded-lg p-2 hover:bg-gray-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </nav>

      {/* Overlay + Drawer */}
      <div
        className={clsx(
          'fixed inset-0 z-40 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto bg-black/40' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setOpen(false)}
      />

      <aside
        aria-hidden={!open}
        className={clsx(
          'fixed right-0 top-0 z-50 h-[100dvh] w-72 sm:w-80',
          'bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80',
          'shadow-2xl border-l border-gray-200',
          'transition-transform duration-250 ease-out will-change-transform',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="p-4 flex items-center justify-between border-b">
          <div className="font-semibold">Menu</div>
          <button
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M6 18L18 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
        <div className="p-4 space-y-4 text-base" onClick={() => setOpen(false)}>
          <Link href="/" className="block hover:text-gray-900">Home</Link>
          <Link href="/generator" className="block hover:text-gray-900">Generator</Link>
          <Link href="/sessions" className="block hover:text-gray-900">Session list</Link>
          <Link href="/history" className="block hover:text-gray-900">History</Link>
        </div>
        <div className="mt-auto p-4 text-xs text-gray-500 border-t">
          © {new Date().getFullYear()} MPG
        </div>
      </aside>
    </header>
  )
}
