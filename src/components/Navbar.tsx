'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '@/store/useStore';
import { 
  Menu, 
  X, 
  User, 
  History, 
  Settings, 
  Home, 
  Send, 
  Download, 
  Info, 
  Mail,
  Smartphone
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

  // Lock scroll when mobile drawer is open
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
    { name: 'Download', href: '/download', icon: Smartphone },
    { name: 'About', href: '/about', icon: Info },
    { name: 'Contact', href: '/contact', icon: Mail },
  ];

  return (
    <>
      <header className="sticky top-0 z-45 w-full bg-[#0F172A] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Brand Name */}
          <Link href="/" className="flex items-center gap-3">
            <img src="/ds.png" alt="DirectShare Logo" className="w-9 h-9 object-contain" />
            <span className="text-lg font-bold tracking-tight text-slate-100">
              DirectShare
            </span>
          </Link>

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors duration-150 ${
                    isActive
                      ? 'bg-white/5 border border-white/10 text-primary'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02] border border-transparent'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* Desktop Right Panel (Shortcuts & User ID) */}
          <div className="hidden md:flex items-center gap-2.5">
            <Link
              href="/history"
              title="History"
              className={`p-2 rounded-xl border transition-colors duration-150 ${
                pathname === '/history'
                  ? 'border-primary/20 text-primary bg-primary/10'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <History className="w-4 h-4" />
            </Link>
            
            <Link
              href="/settings"
              title="Settings"
              className={`p-2 rounded-xl border transition-colors duration-150 ${
                pathname === '/settings'
                  ? 'border-primary/20 text-primary bg-primary/10'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Settings className="w-4 h-4" />
            </Link>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300">
              <User className="w-3.5 h-3.5 text-primary" />
              <span className="max-w-[90px] truncate">{displayName || 'Loading...'}</span>
            </div>
          </div>

          {/* Hamburger Mobile Menu Trigger */}
          <div className="flex md:hidden items-center gap-2">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 max-w-[100px]">
              <User className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate font-semibold">{displayName || '...'}</span>
            </div>
            
            <button
              onClick={() => setIsOpen(true)}
              className="p-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Slide-out Mobile Drawer (Pure CSS Transitions for CPU/GPU efficiency) */}
      <div 
        className={`fixed inset-0 z-50 bg-black/60 transition-opacity duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      />

      <div 
        className={`fixed right-0 top-0 bottom-0 w-72 z-50 bg-[#0F172A] border-l border-white/10 flex flex-col p-5 shadow-2xl transition-transform duration-250 ease-out transform ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header inside Drawer */}
        <div className="flex items-center justify-between pb-5 border-b border-white/10 mb-5">
          <div className="flex items-center gap-2">
            <img src="/ds.png" alt="DirectShare Logo" className="w-8 h-8 object-contain" />
            <span className="font-bold text-slate-200 text-base">DirectShare</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Items list */}
        <nav className="flex flex-col gap-1.5 flex-grow">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors duration-100 ${
                  isActive
                    ? 'bg-white/5 border border-white/10 text-primary shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Utilities Drawer bottom links (History, Settings) */}
        <div className="border-t border-white/10 pt-5 space-y-3.5">
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/history"
              onClick={() => setIsOpen(false)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors duration-100 ${
                pathname === '/history'
                  ? 'border-primary/20 text-primary bg-primary/10'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 bg-slate-900/30'
              }`}
            >
              <History className="w-3.5 h-3.5" /> History
            </Link>

            <Link
              href="/settings"
              onClick={() => setIsOpen(false)}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border text-xs font-bold transition-colors duration-100 ${
                pathname === '/settings'
                  ? 'border-primary/20 text-primary bg-primary/10'
                  : 'border-white/10 text-slate-400 hover:text-slate-200 hover:bg-white/5 bg-slate-900/30'
              }`}
            >
              <Settings className="w-3.5 h-3.5" /> Settings
            </Link>
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 text-xs">
            <span className="text-slate-500">Device:</span>
            <span className="font-bold text-slate-300 truncate max-w-[100px]">
              {displayName || 'Loading...'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
