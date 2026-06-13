'use client';

import { motion } from 'framer-motion';
import { 
  Info, 
  Sparkles, 
  Terminal, 
  Code2, 
  Cpu, 
  User, 
  Mail,
  Zap,
  Shield,
  Laptop
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

  const principles = [
    { 
      title: 'Speed', 
      desc: 'Saturates local network interfaces directly between devices without cloud routing or throttling.',
      icon: Zap,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    },
    { 
      title: 'Reliability', 
      desc: 'Stable chunk-based transport with backpressure checks (data channel buffer checks) and integrity validation.',
      icon: Cpu,
      color: 'text-secondary bg-secondary/10 border-secondary/20'
    },
    { 
      title: 'Privacy', 
      desc: 'Direct socket connection. Zero server logging or file persistence. Your files never touch our servers.',
      icon: Shield,
      color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    },
  ];

  const technologies = [
    { 
      name: 'Next.js', 
      desc: 'React framework powering routes, layout rendering, and optimized performance.',
      iconClass: 'text-slate-100'
    },
    { 
      name: 'TypeScript', 
      desc: 'Statically typed JavaScript code ensuring memory chunk structs remain valid.',
      iconClass: 'text-blue-400'
    },
    { 
      name: 'Tailwind CSS', 
      desc: 'Utility-first CSS styling enabling modern, fluid, responsive visual interfaces.',
      iconClass: 'text-sky-400'
    },
    { 
      name: 'WebRTC', 
      desc: 'Underlying peer-to-peer browser standard establishing direct data channel interfaces.',
      iconClass: 'text-orange-400'
    },
    { 
      name: 'Zustand', 
      desc: 'Lightweight state management coordinating WebRTC socket events and speed calculations.',
      iconClass: 'text-amber-500'
    },
    { 
      name: 'Framer Motion', 
      desc: 'Hardware-accelerated animations for smooth layouts and page transitions.',
      iconClass: 'text-pink-500'
    }
  ];

  const devSocials = [
    { icon: InstagramIcon, href: 'https://www.instagram.com/ruchit1744', color: 'hover:text-pink-500 hover:border-pink-500/30' },
    { icon: LinkedinIcon, href: 'https://www.linkedin.com/in/ruchit-thakkar-38ab37379', color: 'hover:text-blue-500 hover:border-blue-500/30' },
    { icon: GithubIcon, href: 'https://github.com/Ruchit-thakkar', color: 'hover:text-white hover:border-white/30' },
    { icon: TwitterIcon, href: 'https://x.com/RuchitThakkar19', color: 'hover:text-sky-400 hover:border-sky-400/30' },
    { icon: Mail, href: 'mailto:ruchitthakkar12@gmail.com', color: 'hover:text-emerald-400 hover:border-emerald-500/30' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-12 py-4 px-2 sm:px-4 relative z-10">
      
      {/* Page Header */}
      <motion.div 
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="border-b border-white/10 pb-6"
      >
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight flex items-center gap-3">
          <Info className="w-8 h-8 text-primary" /> About DirectShare
        </h1>
        <p className="text-slate-400 text-sm mt-2 font-light">
          An open-source peer-to-peer alternative to AirDrop and Quick Share
        </p>
      </motion.div>

      {/* Main Vision */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.6 }}
        className="glass-panel p-6 sm:p-8 border border-white/10 shadow-lg space-y-8"
      >
        <div className="space-y-3">
          <h2 className="text-xl font-bold text-slate-200">Our Vision</h2>
          <p className="text-sm sm:text-base text-slate-400 leading-relaxed font-light">
            DirectShare is a modern, high-performance local network file transfer utility. Inspired by the convenience of <strong>AirDrop</strong> and <strong>Quick Share</strong>, we wanted to build a web-first equivalent that functions instantly on any device equipped with a browser. By bypassing third-party servers entirely, DirectShare gives you full local-network bandwidth speeds and total data security.
          </p>
        </div>

        {/* Pillars / Key Priorities */}
        <div className="space-y-4">
          <h3 className="text-xs text-slate-500 font-bold uppercase tracking-wider">Key Pillars</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {principles.map((pr, idx) => {
              const Icon = pr.icon;
              return (
                <div key={idx} className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2.5">
                  <div className={`p-2.5 rounded-xl border ${pr.color} shrink-0 w-fit shadow-inner`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-slate-200">{pr.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed font-light">{pr.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* Technology Stack Grid */}
      <div className="space-y-5">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <Code2 className="w-4.5 h-4.5 text-secondary" /> Technology Stack
        </h3>
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-50px' }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {technologies.map((tech) => (
            <motion.div
              key={tech.name}
              variants={itemVariants}
              whileHover={{ 
                y: -4, 
                borderColor: 'rgba(255, 255, 255, 0.15)',
                backgroundColor: 'rgba(255, 255, 255, 0.08)'
              }}
              className="glass-panel p-5 border border-white/10 space-y-2 transition-all duration-300 shadow-sm"
            >
              <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                <Terminal className={`w-4 h-4 ${tech.iconClass}`} /> {tech.name}
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-light">{tech.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>

      {/* Developer Ruchit Profile Section */}
      <div className="space-y-5">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <User className="w-4.5 h-4.5 text-secondary" /> Developer
        </h3>
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-panel p-6 sm:p-8 border border-white/10 flex flex-col md:flex-row items-center gap-6 md:gap-8 bg-gradient-to-br from-[#1E293B]/70 to-[#0F172A]/50 relative overflow-hidden shadow-xl"
        >
          {/* Decorative glowing gradient sphere */}
          <div className="absolute right-[-100px] bottom-[-100px] w-64 h-64 bg-glow-purple pointer-events-none rounded-full" />

          {/* Leftside: Profile Avatar */}
          <div className="relative group shrink-0">
            <div className="absolute inset-0 bg-gradient-to-tr from-primary to-secondary rounded-3xl blur opacity-30 group-hover:opacity-50 transition-opacity duration-300" />
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl border border-white/10 bg-slate-900 flex flex-col items-center justify-center text-white shadow-xl group-hover:scale-105 transition-transform duration-300">
              <span className="text-4xl font-black bg-gradient-to-tr from-primary to-secondary bg-clip-text text-transparent">RT</span>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-1.5">Ruchit</span>
            </div>
          </div>

          {/* Rightside: Details & Socials */}
          <div className="flex-grow space-y-4 text-center md:text-left z-10">
            <div className="space-y-1">
              <h4 className="text-xl font-extrabold text-slate-100">Made by Ruchit</h4>
              <p className="text-xs text-primary font-bold tracking-wider uppercase">
                Full-Stack Web & P2P Developer
              </p>
            </div>

            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light max-w-xl">
              Hi, I'm Ruchit Thakkar. I built DirectShare to solve the cross-platform file sharing problem on local networks without needing cloud transfers or platform lock-ins. I focus on creating high-performance, real-time web applications with sleek user interfaces.
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
                    className={`p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 transition-all duration-300 hover:scale-115 ${social.color}`}
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
