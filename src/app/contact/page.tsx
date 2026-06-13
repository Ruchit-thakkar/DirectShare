'use client';

import { motion } from 'framer-motion';
import { 
  Mail, 
  ArrowUpRight,
  MessageSquare
} from 'lucide-react';
import { 
  InstagramIcon, 
  LinkedinIcon, 
  GithubIcon, 
  TwitterIcon 
} from '@/components/SocialIcons';

export default function ContactPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { 
      y: 0, 
      opacity: 1, 
      transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } 
    }
  };

  const socials = [
    {
      name: 'LinkedIn',
      username: 'ruchit-thakkar',
      href: 'https://www.linkedin.com/in/ruchit-thakkar-38ab37379',
      icon: LinkedinIcon,
      color: 'hover:border-blue-500/40 text-blue-400',
      bgGlow: 'group-hover:bg-blue-500/5',
      accent: '#3b82f6',
      desc: 'Connect professionally, check out my industry network, and view career achievements.'
    },
    {
      name: 'GitHub',
      username: 'Ruchit-thakkar',
      href: 'https://github.com/Ruchit-thakkar',
      icon: GithubIcon,
      color: 'hover:border-slate-200/40 text-slate-100',
      bgGlow: 'group-hover:bg-white/5',
      accent: '#f8fafc',
      desc: 'Explore the source code, check commits, open issues, and star direct-sharing projects.'
    },
    {
      name: 'Instagram',
      username: '@ruchit1744',
      href: 'https://www.instagram.com/ruchit1744',
      icon: InstagramIcon,
      color: 'hover:border-pink-500/40 text-pink-400',
      bgGlow: 'group-hover:bg-pink-500/5',
      accent: '#ec4899',
      desc: 'Send a DM, see stories or updates, and check out photos and highlights.'
    },
    {
      name: 'X / Twitter',
      username: '@RuchitThakkar19',
      href: 'https://x.com/RuchitThakkar19',
      icon: TwitterIcon,
      color: 'hover:border-sky-400/40 text-sky-400',
      bgGlow: 'group-hover:bg-sky-400/5',
      accent: '#38bdf8',
      desc: 'Read technical writeups, project previews, and quick thoughts on current Web3/P2P development.'
    },
    {
      name: 'Email',
      username: 'ruchitthakkar12@gmail.com',
      href: 'mailto:ruchitthakkar12@gmail.com',
      icon: Mail,
      color: 'hover:border-emerald-500/40 text-emerald-400',
      bgGlow: 'group-hover:bg-emerald-500/5',
      accent: '#34d399',
      desc: 'Submit feedback, propose cooperations, or ask direct-share questions.'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-4 px-2 sm:px-4 relative z-10">
      
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="border-b border-white/10 pb-6 text-center sm:text-left"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center justify-center sm:justify-start gap-3">
          <MessageSquare className="w-8 h-8 text-primary" /> Connect With Me
        </h1>
        <p className="text-slate-400 text-sm mt-2 font-light">
          Feel free to reach out or connect with me through these social platforms.
        </p>
      </motion.div>

      {/* Social Cards Grid */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full"
      >
        {socials.map((soc) => {
          const Icon = soc.icon;
          return (
            <a
              key={soc.name}
              href={soc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <motion.div
                variants={itemVariants}
                whileHover={{ 
                  y: -5,
                  boxShadow: '0 20px 40px -15px rgba(0,0,0,0.5)'
                }}
                className={`glass-panel p-6 border border-white/10 transition-all duration-300 relative overflow-hidden flex items-start gap-4.5 ${soc.color} ${soc.bgGlow}`}
              >
                {/* Visual hover corner glow */}
                <div 
                  className="absolute right-0 top-0 w-24 h-24 pointer-events-none rounded-full blur-2xl opacity-0 group-hover:opacity-15 transition-all duration-500"
                  style={{ backgroundColor: soc.accent }}
                />

                {/* Left Side branding icon */}
                <div 
                  className="p-3.5 rounded-2xl border border-white/10 bg-slate-900 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shrink-0 shadow-inner"
                  style={{ color: 'inherit' }}
                >
                  <Icon className="w-6 h-6" />
                </div>

                {/* Details */}
                <div className="space-y-1.5 flex-grow min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-200 text-base">{soc.name}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
                  </div>
                  <p className="text-xs font-mono text-slate-400 truncate font-light">{soc.username}</p>
                  <p className="text-xs sm:text-sm text-slate-500 leading-relaxed font-light mt-1">{soc.desc}</p>
                </div>
              </motion.div>
            </a>
          );
        })}
      </motion.div>
    </div>
  );
}
