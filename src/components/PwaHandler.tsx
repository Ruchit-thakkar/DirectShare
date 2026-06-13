'use client';

import { useEffect, useState } from 'react';
import { Download, WifiOff, X, Sparkles } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PwaHandler() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallCard, setShowInstallCard] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    // 1. Service Worker Registration & Unregistration
    if ('serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        window.addEventListener('load', () => {
          navigator.serviceWorker
            .register('/sw.js')
            .then((registration) => {
              console.log('DirectShare SW registered: ', registration.scope);
            })
            .catch((registrationError) => {
              console.error('DirectShare SW registration failed: ', registrationError);
            });
        });
      } else {
        // In development, clean up service workers and caches to prevent infinite Fast Refresh reload loops
        if (typeof window !== 'undefined' && 'caches' in window) {
          caches.keys().then((keys) => {
            keys.forEach((key) => {
              caches.delete(key).then(() => {
                console.log('SW Cache deleted in dev mode:', key);
              });
            });
          });
        }
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          if (registrations.length > 0) {
            const isCleared = sessionStorage.getItem('directshare_sw_cleared');
            if (!isCleared) {
              for (const registration of registrations) {
                registration.unregister();
              }
              sessionStorage.setItem('directshare_sw_cleared', 'true');
              console.log('Service worker found and unregistered. Performing one-time reload to clear state...');
              window.location.reload();
            }
          }
        });
      }
    }

    // 2. Offline Status Handler
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    // Initial check
    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // 3. PWA Install Prompt Handler
    const handleBeforeInstallPrompt = (e: Event) => {
      // Prevent browser default mini-infobar
      e.preventDefault();
      // Store the event for trigger later
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Only show prompt if the user hasn't explicitly dismissed it in this browser session
      const dismissed = sessionStorage.getItem('directshare_install_dismissed');
      if (!dismissed) {
        setShowInstallCard(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Clean up listeners
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show native prompt
    await deferredPrompt.prompt();

    // Wait for choice
    const choiceResult = await deferredPrompt.userChoice;
    console.log(`User choice result: ${choiceResult.outcome}`);

    // Reset prompt state
    setDeferredPrompt(null);
    setShowInstallCard(false);
  };

  const handleLaterClick = () => {
    setShowInstallCard(false);
    // Remember preference for current tab session so we don't keep prompting
    sessionStorage.setItem('directshare_install_dismissed', 'true');
  };

  return (
    <>
      {/* 1. Offline Alert Banner */}
      {isOffline && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-sm">
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 backdrop-blur-md px-4 py-3 rounded-2xl flex items-center justify-between shadow-2xl animate-fade-in">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-lg bg-red-500/20 text-red-400">
                <WifiOff className="w-4 h-4" />
              </div>
              <div className="text-xs">
                <p className="font-bold">You are offline.</p>
                <p className="font-light opacity-90 text-[10px] mt-0.5">Some features may be unavailable.</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOffline(false)} 
              className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Glassmorphism Install Prompt Card */}
      {showInstallCard && (
        <div className="fixed bottom-6 right-6 z-50 w-[calc(100%-3rem)] sm:w-80 animate-slide-up">
          <div className="bg-slate-900/80 border border-white/10 backdrop-blur-xl p-5 rounded-2xl shadow-2xl space-y-4 relative overflow-hidden">
            {/* Background design glow */}
            <div className="absolute -right-10 -top-10 w-24 h-24 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-md">
                  <img src="/ds.png" alt="DirectShare" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-1">
                    Install DirectShare <Sparkles className="w-3.5 h-3.5 text-secondary animate-pulse" />
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 font-light leading-relaxed">
                    Access DirectShare like a native app.
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleLaterClick}
                className="p-1 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2 pt-1 relative z-10">
              <button
                onClick={handleLaterClick}
                className="flex-1 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
              >
                Later
              </button>
              <button
                onClick={handleInstallClick}
                className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white text-xs font-bold transition-colors shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                Install
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
