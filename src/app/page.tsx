'use client';

import Link from 'next/link';
import {
  Send,
  Download,
  Zap,
  Shield,
  Laptop,
  Database,
  Layers,
  Activity
} from 'lucide-react';

export default function Home() {
  const features = [
    {
      icon: Zap,
      title: 'Fast Transfer',
      desc: 'High-speed local peer-to-peer file sharing that takes full advantage of your local Wi-Fi router or hotspot bandwidth.',
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    },
    {
      icon: Shield,
      title: 'Privacy First',
      desc: 'No cloud storage or remote servers involved. Your files flow directly between devices and never touch our servers.',
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
    {
      icon: Laptop,
      title: 'Cross Platform',
      desc: 'Fully browser-based local connection. Works seamlessly on Windows, macOS, Linux, Android, and iOS devices.',
      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20'
    },
    {
      icon: Database,
      title: 'Large Files',
      desc: 'Transfer huge files (10GB+) without memory crashes. Files are chunked and streamed directly using browser disk storage.',
      color: 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    },
    {
      icon: Layers,
      title: 'Multiple Files',
      desc: 'Select and transfer multiple files or directories simultaneously, all wrapped in a single, clean transfer session.',
      color: 'text-pink-400 bg-pink-500/10 border-pink-500/20'
    },
    {
      icon: Activity,
      title: 'Reliable Connection',
      desc: 'Uses stable chunk-based transport with backpressure checks (DataChannel buffer checks) and Adler-32 integrity validation.',
      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20'
    }
  ];

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-6 space-y-12">

      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto space-y-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary mb-1 shadow-sm">
          <span className="flex h-2 w-2 rounded-full bg-primary shrink-0" />
          Direct Device-to-Device Sharing
        </div>

        <div className="flex justify-center pt-2">
          <img src="/ds.png" alt="DirectShare Logo" className="w-24 h-24 object-contain hover:scale-105 transition-transform duration-300" />
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          DirectShare
        </h1>

        <h2 className="text-xl sm:text-2xl font-bold text-slate-200 tracking-tight">
          Fast, Secure and Private File Sharing
        </h2>

        <p className="text-sm sm:text-base text-slate-400 max-w-xl mx-auto font-light leading-relaxed">
          Transfer files directly between nearby devices over Wi-Fi or Hotspot without uploading anything to the cloud.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 pt-4 max-w-md mx-auto px-4">
          <Link href="/send" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold text-sm transition-colors cursor-pointer shadow-md shadow-blue-500/10">
              <Send className="w-4 h-4" />
              Send Files
            </button>
          </Link>

          <Link href="/receive" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto flex items-center justify-center gap-2 px-7 py-3.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 font-bold text-sm transition-colors cursor-pointer">
              <Download className="w-4 h-4 text-secondary" />
              Receive Files
            </button>
          </Link>
        </div>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5 w-full max-w-6xl px-4">
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <div
              key={feat.title}
              className="p-5 rounded-2xl border border-white/10 bg-[#1E293B]"
            >
              <div className={`p-2.5 rounded-xl border ${feat.color} shrink-0 w-fit mb-3`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-slate-200">{feat.title}</h3>
                <p className="text-xs text-slate-400 font-light leading-relaxed">{feat.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}
