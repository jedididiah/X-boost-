import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from '../context/RouterContext';
import { BrandLogo } from './BrandLogo';

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const { navigate, pathname } = useRouter();
  const { firebaseUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (target: string) => {
    setMobileMenuOpen(false);
    if (target.startsWith('#') && pathname === '/') {
      const el = document.getElementById(target.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }
    if (target.startsWith('#')) {
      navigate('/');
      setTimeout(() => {
        const el = document.getElementById(target.slice(1));
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 120);
      return;
    }
    navigate(target);
  };

  return (
    <div className="min-h-screen bg-[#050507] text-[#F4F4F6] flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#050507]/90 backdrop-blur-md border-b border-white/[0.08]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <button
            type="button"
            onClick={() => handleNav('/')}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] rounded-lg whitespace-nowrap shrink-0"
          >
            <BrandLogo size="md" />
          </button>

          {/* Zone 2: 4-5 Concise Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
            <button
              type="button"
              onClick={() => handleNav('/services')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${pathname === '/services' ? 'text-white' : ''}`}
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => handleNav('/pricing')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${pathname === '/pricing' ? 'text-white' : ''}`}
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => handleNav('#how-it-works')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => handleNav('#faq')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              FAQ
            </button>
            {!firebaseUser && (
              <button
                type="button"
                onClick={() => handleNav('/login')}
                className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${pathname === '/login' ? 'text-white' : ''}`}
              >
                Sign In
              </button>
            )}
          </nav>

          {/* Zone 3: Primary Action + Mobile Menu Button */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleNav(firebaseUser ? '/dashboard' : '/register')}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-[#2563EB] hover:bg-[#1D4ED8] rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]"
            >
              {firebaseUser ? 'Dashboard' : 'Get Started'}
            </button>

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden p-2.5 text-zinc-300 hover:text-white border border-white/10 rounded-lg"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#0B0C10] px-4 py-4 space-y-2">
            <button
              type="button"
              onClick={() => handleNav('/services')}
              className="block w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-white/[0.04]"
            >
              Services
            </button>
            <button
              type="button"
              onClick={() => handleNav('/pricing')}
              className="block w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-white/[0.04]"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() => handleNav('#how-it-works')}
              className="block w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-white/[0.04]"
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => handleNav('#faq')}
              className="block w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:text-white rounded-lg hover:bg-white/[0.04]"
            >
              FAQ
            </button>
            {!firebaseUser ? (
              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleNav('/login')}
                  className="w-full py-2.5 text-sm font-medium text-white border border-white/15 rounded-lg"
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/register')}
                  className="w-full py-2.5 text-sm font-medium text-white bg-[#2563EB] rounded-lg"
                >
                  Get Started
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleNav('/dashboard')}
                className="w-full py-2.5 text-sm font-medium text-white bg-[#2563EB] rounded-lg"
              >
                Dashboard
              </button>
            )}
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      {/* Quiet Professional Footer */}
      <footer className="border-t border-white/[0.08] bg-[#050507] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-2 space-y-4">
              <BrandLogo size="md" />
              <p className="text-sm text-zinc-400 max-w-md leading-relaxed">
                Structured social media growth infrastructure built for creators, brands, and digital agencies across X, Instagram, TikTok, Facebook, YouTube, Telegram, and WhatsApp.
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Platform</h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>
                  <button type="button" onClick={() => handleNav('/services')} className="hover:text-white transition-colors">
                    Services Catalog
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('/pricing')} className="hover:text-white transition-colors">
                    Pricing Matrix
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('/login')} className="hover:text-white transition-colors">
                    Client Sign In
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('/register')} className="hover:text-white transition-colors">
                    Create Account
                  </button>
                </li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-white">Operations</h3>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li>
                  <button type="button" onClick={() => handleNav('/support')} className="hover:text-white transition-colors">
                    Support Desk
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('/wallet')} className="hover:text-white transition-colors">
                    Wallet & Payments
                  </button>
                </li>
                <li>
                  <button type="button" onClick={() => handleNav('/orders')} className="hover:text-white transition-colors">
                    Order Tracking
                  </button>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-6 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
            <p>© {new Date().getFullYear()} 𝕏 Boost. All rights reserved.</p>
            <p>Server-verified ledger · Role-protected administration</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
