import React, { useState, useEffect } from 'react'
import NotePanel from './NotePanel'

const NAV_ITEMS = [
  { id: 'flight-data', label: 'Flight Data', icon: 'fa-plane' },
  { id: 'checklists', label: 'Checklists', icon: 'fa-list-check' },
  { id: 'radio', label: 'Radio', icon: 'fa-radio' },
  { id: 'acars', label: 'ACARS', icon: 'fa-paper-plane' },
  { id: 'atis-lookup', label: 'ATIS', icon: 'fa-cloud' },
]

const FOOTER_PAGES = [
  { id: 'about', label: 'About' },
  { id: 'data-privacy', label: 'Data Privacy' },
  { id: 'terms-of-use', label: 'Terms of Use' },
]

const EXTERNAL_LINKS = [
  { href: 'https://discord.gg/m8qZJ6BKP6', label: 'Discord' },
  { href: 'https://buymeacoffee.com/tbindlosse', label: 'Buy me a coffee' },
]

function ZuluClock() {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      const now = new Date()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      setTime(`${h}:${m}`)
    }
    update()
    const timer = setInterval(update, 10000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex items-center gap-1.5 font-mono text-sm tabular-nums">
      <span className="text-aviation-nav-text">{time}</span>
      <span className="text-aviation-accent text-xs font-sans font-semibold">UTC</span>
    </div>
  )
}

function Layout({ children, activePage, onNavigate }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleNavigate = (pageId) => {
    onNavigate(pageId)
    setIsMobileMenuOpen(false)
  }

  // Check if current page is a footer/info page
  const isInfoPage = ['about', 'data-privacy', 'terms-of-use'].includes(activePage)

  return (
    <div className="min-h-screen bg-aviation-bg flex flex-col">
      <NotePanel />

      {/* Top Navigation */}
      <header className="bg-aviation-nav-bg sticky top-0 z-30 shadow-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <button
              onClick={() => handleNavigate('flight-data')}
              className="text-aviation-nav-text font-bold text-lg tracking-tight hover:text-white transition-colors shrink-0"
            >
              Vat-Officer
            </button>

            {/* Desktop nav tabs */}
            <nav className="hidden md:flex items-center gap-0.5 ml-8">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`px-3 py-1.5 text-[13px] font-medium rounded transition-colors ${
                    activePage === item.id && !isInfoPage
                      ? 'bg-white/10 text-white'
                      : 'text-aviation-nav-text-secondary hover:text-aviation-nav-text hover:bg-white/5'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-3 ml-auto">
              <ZuluClock />

              {/* Mobile hamburger */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 -mr-2 text-aviation-nav-text-secondary hover:text-aviation-nav-text transition-colors"
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 pb-3 bg-aviation-nav-bg">
            <div className="max-w-5xl mx-auto px-4 pt-2 space-y-0.5">
              {NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={`flex items-center gap-3 w-full text-left px-3 py-2.5 text-sm font-medium rounded transition-colors ${
                    activePage === item.id && !isInfoPage
                      ? 'bg-white/10 text-white'
                      : 'text-aviation-nav-text-secondary hover:text-aviation-nav-text hover:bg-white/5'
                  }`}
                >
                  <i className={`fas ${item.icon} w-4 text-center text-xs`} aria-hidden="true"></i>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-aviation-border/60 mt-auto bg-aviation-surface-light/50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5">
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
            {FOOTER_PAGES.map((page) => (
              <button
                key={page.id}
                onClick={() => handleNavigate(page.id)}
                className={`transition-colors ${
                  activePage === page.id
                    ? 'text-aviation-accent font-medium'
                    : 'text-aviation-text-secondary hover:text-aviation-text'
                }`}
              >
                {page.label}
              </button>
            ))}
            <span className="text-aviation-border hidden sm:inline">·</span>
            {EXTERNAL_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-aviation-text-secondary hover:text-aviation-text transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Layout
