'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Share2, 
  Menu, 
  X, 
  User, 
  History, 
  Settings, 
  Home, 
  Send, 
  Download, 
  Info, 
  Mail 
} from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const { displayName, setDisplayName } = useStore();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!displayName && typeof window !== 'undefined') {
      const saved = localStorage.getItem('directshare_display_name');
      if (saved) {
        setDisplayName(saved);
      } else {
        const randName = 'Device_' + Math.random().toString(36).substring(2, 6).toUpperCase();
        setDisplayName(randName);
        localStorage.setItem('directshare_display_name', randName);
      }
    }
  }, [displayName, setDisplayName]);

  // Lock scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
  }, [isOpen]);

  const navItems = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Send', href: '/send', icon: Send },
    { name: 'Receive', href: '/receive', icon: Download },
    { name: 'About', href: '/about', icon: Info },
    { name: 'Contact', href: '/contact', icon: Mail },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-slate-950/60 backdrop-blur-xl border-b border-white/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand Name */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-lg shadow-primary/20 group-hover:scale-105 group-hover:rotate-6 transition-all duration-300">
              <Share2 className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent group-hover:text-white transition-colors duration-300">
              DirectShare
            </span>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1.5 relative">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                    isActive
                      ? 'text-primary'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeTab"
                      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                      className="absolute inset-0 bg-white/5 border border-white/10 rounded-xl z-[-1]"
                    />
                  )}
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Panel (Shortcuts & User ID) */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/history"
              title="History"
              className={`p-2 rounded-xl border transition-all duration-200 ${
                pathname === '/history'
                  ? 'border-primary/30 text-primary bg-primary/10'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <History className="w-4.5 h-4.5" />
            </Link>
            
            <Link
              href="/settings"
              title="Settings"
              className={`p-2 rounded-xl border transition-all duration-200 ${
                pathname === '/settings'
                  ? 'border-primary/30 text-primary bg-primary/10'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
            </Link>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
              <User className="w-3.5 h-3.5 text-primary animate-pulse" />
              <span className="max-w-[100px] truncate">{displayName || 'Loading...'}</span>
            </div>
          </div>

          {/* Hamburger Mobile Menu Trigger */}
          <div className="flex md:hidden items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-300 max-w-[110px]">
              <User className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate font-semibold">{displayName || '...'}</span>
            </div>
            
            <button
              onClick={() => setIsOpen(true)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 text-slate-300 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out Mobile Hamburger Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md"
            />

            {/* Sliding Drawer Container */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed right-0 top-0 bottom-0 w-80 z-50 bg-[#0F172A]/95 backdrop-blur-2xl border-l border-white/10 flex flex-col p-6 shadow-2xl"
            >
              {/* Header inside Drawer */}
              <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-6">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white">
                    <Share2 className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-bold text-slate-200 text-lg">DirectShare</span>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation Items list */}
              <nav className="flex flex-col gap-2.5 flex-grow">
                {navItems.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3.5 px-4 py-3 rounded-2xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-primary border border-primary/20 shadow-inner'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>

              {/* Utilities Drawer bottom links (History, Settings) */}
              <div className="border-t border-white/10 pt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/history"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${
                      pathname === '/history'
                        ? 'border-primary/20 text-primary bg-primary/10'
                        : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 bg-slate-900/30'
                    }`}
                  >
                    <History className="w-4 h-4" /> History
                  </Link>

                  <Link
                    href="/settings"
                    onClick={() => setIsOpen(false)}
                    className={`flex items-center justify-center gap-2 py-3 rounded-xl border text-xs font-bold transition-all ${
                      pathname === '/settings'
                        ? 'border-primary/20 text-primary bg-primary/10'
                        : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 bg-slate-900/30'
                    }`}
                  >
                    <Settings className="w-4 h-4" /> Settings
                  </Link>
                </div>

                <div className="flex items-center justify-between p-3.5 rounded-xl bg-white/5 border border-white/10 text-xs">
                  <span className="text-slate-500">Your Device:</span>
                  <span className="font-bold text-slate-300 truncate max-w-[120px]">
                    {displayName || 'Loading...'}
                  </span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
