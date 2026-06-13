'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
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
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: 'easeOut' as const } }
  };

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
    <div className="flex flex-col items-center justify-center min-h-[75vh] py-8 space-y-16">
      
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: 'easeOut' }}
        className="text-center max-w-3xl mx-auto space-y-6"
      >
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold text-primary mb-2">
          <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
          Direct Device-to-Device Sharing
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-tight">
          DirectShare
        </h1>
        
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-200">
          Fast, Secure and Private File Sharing
        </h2>
        
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
          Transfer files directly between nearby devices using Wi-Fi or Hotspot without uploading anything to the cloud.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link href="/send" className="w-full sm:w-auto">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-primary/25 transition-all cursor-pointer"
            >
              <Send className="w-4.5 h-4.5" />
              Send Files
            </motion.button>
          </Link>
          
          <Link href="/receive" className="w-full sm:w-auto">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 hover:bg-slate-800 hover:border-slate-600 text-slate-300 font-bold text-sm transition-all cursor-pointer"
            >
              <Download className="w-4.5 h-4.5 text-secondary" />
              Receive Files
            </motion.button>
          </Link>
        </div>
      </motion.div>

      {/* Features Grid */}
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl"
      >
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <motion.div
              key={feat.title}
              variants={itemVariants}
              whileHover={{ y: -5, borderColor: 'rgba(255, 255, 255, 0.12)', backgroundColor: 'rgba(30, 41, 59, 0.8)' }}
              className="glass-panel p-6 rounded-2xl transition-all duration-300 flex flex-col gap-4 border border-white/5"
            >
              <div className={`p-3 rounded-xl border ${feat.color} shrink-0 w-fit`}>
                <Icon className="w-5.5 h-5.5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-base font-bold text-slate-200">{feat.title}</h3>
                <p className="text-xs sm:text-sm text-slate-400 font-light leading-relaxed">{feat.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

    </div>
  );
}
