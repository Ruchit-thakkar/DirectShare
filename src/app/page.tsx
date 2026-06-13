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
      transition: { staggerChildren: 0.1, delayChildren: 0.15 }
    }
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } 
    }
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
    <div className="flex flex-col items-center justify-center min-h-[75vh] py-8 space-y-16 relative">
      
      {/* Hero Section */}
      <motion.div 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] as const }}
        className="text-center max-w-3xl mx-auto space-y-6 relative z-10"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/25 text-xs font-semibold text-primary mb-2 shadow-sm"
        >
          <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-ping shrink-0" />
          Direct Device-to-Device Sharing
        </motion.div>
        
        <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight bg-gradient-to-b from-white via-slate-100 to-slate-400 bg-clip-text text-transparent leading-none py-1">
          DirectShare
        </h1>
        
        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-200 tracking-tight">
          Fast, Secure and Private File Sharing
        </h2>
        
        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mx-auto font-light leading-relaxed">
          Transfer files directly between nearby devices over Wi-Fi or Hotspot without uploading anything to the cloud.
        </p>

        {/* CTA buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-6 max-w-md mx-auto">
          <Link href="/send" className="w-full sm:w-auto">
            <motion.button 
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold text-sm shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer"
            >
              <Send className="w-4.5 h-4.5" />
              Send Files
            </motion.button>
          </Link>
          
          <Link href="/receive" className="w-full sm:w-auto">
            <motion.button 
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 font-bold text-sm transition-all cursor-pointer backdrop-blur-md"
            >
              <Download className="w-4.5 h-4.5 text-secondary animate-bounce" />
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
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl relative z-10"
      >
        {features.map((feat) => {
          const Icon = feat.icon;
          return (
            <motion.div
              key={feat.title}
              variants={itemVariants}
              whileHover={{ 
                y: -6, 
                borderColor: 'rgba(255, 255, 255, 0.15)', 
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)'
              }}
              className="glass-panel p-6.5 rounded-3xl transition-all duration-300 flex flex-col gap-4 border border-white/10 backdrop-blur-xl bg-white/5"
            >
              <div className={`p-3 rounded-xl border ${feat.color} shrink-0 w-fit shadow-inner`}>
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
