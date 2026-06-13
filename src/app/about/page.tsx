'use client';

import { motion } from 'framer-motion';
import { 
  Info, 
  Sparkles, 
  Terminal, 
  Code2, 
  Cpu, 
  User, 
  Mail 
} from 'lucide-react';
import { 
  InstagramIcon, 
  LinkedinIcon, 
  GithubIcon, 
  TwitterIcon 
} from '@/components/SocialIcons';

export default function AboutPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 15, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.5, ease: 'easeOut' as const } }
  };

  const principles = [
    { title: 'Speed', desc: 'Saturate local network interfaces without cloud throttling.' },
    { title: 'Reliability', desc: 'Chunked binary data stream with Adler-32 integrity checking.' },
    { title: 'Privacy', desc: 'Direct socket connection. Zero server logging or file persistence.' },
    { title: 'Cross-platform support', desc: 'Standard browser stack runs on desktop, mobile, and tablets.' },
    { title: 'Excellent user experience', desc: 'Minimal connection pathways and responsive interfaces.' },
  ];

  const technologies = [
    { name: 'Next.js', desc: 'React framework powering page routes, server layout rendering, and local signaling APIs.' },
    { name: 'TypeScript', desc: 'Statically typed JavaScript code ensuring memory chunk structs remain valid.' },
    { name: 'Tailwind CSS', desc: 'Utility classes and themes enabling a responsive glassmorphic aesthetic.' },
    { name: 'Zustand', desc: 'Lightweight local state manager coordinating WebRTC socket events and speed meters.' },
    { name: 'Framer Motion', desc: 'Smooth hardware-accelerated animations for page transitions and drawer sliders.' },
    { name: 'WebRTC', desc: 'Underlying peer-to-peer browser standard establishing direct data channel interfaces.' }
  ];

  const devSocials = [
    { icon: InstagramIcon, href: 'https://www.instagram.com/ruchit1744' },
    { icon: LinkedinIcon, href: 'https://www.linkedin.com/in/ruchit-thakkar-38ab37379' },
    { icon: GithubIcon, href: 'https://github.com/Ruchit-thakkar' },
    { icon: TwitterIcon, href: 'https://x.com/RuchitThakkar19' },
    { icon: Mail, href: 'mailto:ruchitthakkar12@gmail.com' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-4">
      {/* Intro Header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-white/5 pb-6"
      >
        <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
          <Info className="w-8 h-8 text-primary" /> About DirectShare
        </h1>
        <p className="text-slate-400 text-sm mt-2">
          An open-source peer-to-peer alternative to AirDrop and Quick Share
        </p>
      </motion.div>

      {/* Main Pitch */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="glass-panel p-8 rounded-3xl border border-white/5 space-y-6"
      >
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-slate-200">Our Vision</h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-light">
            DirectShare is a modern peer-to-peer file-sharing platform designed to provide fast and private file transfers over Wi-Fi or Hotspot. Inspired by <strong>AirDrop</strong> and <strong>Quick Share</strong>, we wanted to build a web-equivalent that works instantly on any platform with a browser, removing the constraints of vendor ecosystems.
          </p>
        </div>

        {/* Pillars / Key Priorities */}
        <div className="space-y-4">
          <h3 className="text-xs text-slate-500 font-bold uppercase tracking-wider">Key Project Focus areas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {principles.map((pr, idx) => (
              <div key={idx} className="flex gap-2.5 items-start">
                <div className="w-5 h-5 rounded-md bg-primary/10 border border-primary/25 flex items-center justify-center text-primary shrink-0 mt-0.5">
                  <Sparkles className="w-3 h-3" />
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-sm font-bold text-slate-300">{pr.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{pr.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Technology Stack Grid */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Code2 className="w-4.5 h-4.5 text-secondary" /> Technology Stack
        </h3>
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {technologies.map((tech) => (
            <motion.div
              key={tech.name}
              variants={itemVariants}
              whileHover={{ y: -3, borderColor: 'rgba(255, 255, 255, 0.12)' }}
              className="p-5 rounded-2xl bg-slate-900/40 border border-white/5 space-y-2 hover:bg-slate-900/60 transition-all"
            >
              <h4 className="text-sm font-extrabold text-slate-200 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-primary" /> {tech.name}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed font-light">{tech.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Developer Ruchit Profile Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <User className="w-4.5 h-4.5 text-secondary" /> Developer
        </h3>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-panel p-6 sm:p-8 rounded-3xl border border-white/5 flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-gradient-to-br from-slate-900/80 to-slate-900/30 relative overflow-hidden"
        >
          {/* Decorative glowing gradient sphere */}
          <div className="absolute right-[-100px] bottom-[-100px] w-64 h-64 bg-glow-purple pointer-events-none rounded-full" />

          {/* Leftside: Profile placeholder/logo */}
          <div className="relative group shrink-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary to-secondary rounded-2xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-2xl border border-white/10 bg-slate-950 flex flex-col items-center justify-center text-white shadow-xl">
              <span className="text-3xl font-black bg-gradient-to-tr from-primary to-secondary bg-clip-text text-transparent">RT</span>
              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-1">Ruchit Thakkar</span>
            </div>
          </div>

          {/* Rightside: Details & Socials */}
          <div className="flex-grow space-y-4 text-center md:text-left z-10">
            <div className="space-y-1">
              <h4 className="text-xl font-extrabold text-slate-100">Made by Ruchit</h4>
              <p className="text-xs text-slate-400 font-semibold tracking-wide flex items-center justify-center md:justify-start gap-1">
                Full-Stack Web & P2P Developer
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light max-w-xl">
              Hi, I'm Ruchit Thakkar. I built DirectShare to solve the cross-platform file sharing problem on local subnets without vendor lock-in. I focus on high-performance web engineering, direct network socket protocols, and sleek user experiences.
            </p>

            {/* Social Grid */}
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              {devSocials.map((social, i) => {
                const Icon = social.icon;
                return (
                  <a
                    key={i}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-xl bg-slate-950/60 border border-white/5 text-slate-500 hover:text-primary hover:border-primary/25 transition-all duration-300"
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

    </div>
  );
}
