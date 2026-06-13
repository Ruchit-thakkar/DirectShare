'use client';

import { 
  Sparkles, 
  Terminal, 
  Code2, 
  Cpu, 
  User, 
  Mail,
  Zap,
  Shield
} from 'lucide-react';
import { 
  InstagramIcon, 
  LinkedinIcon, 
  GithubIcon, 
  TwitterIcon 
} from '@/components/SocialIcons';

export default function AboutPage() {
  const principles = [
    { 
      title: 'Speed', 
      desc: 'Saturates local network interfaces directly between devices without cloud routing or throttling.',
      icon: Zap,
      color: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
    },
    { 
      title: 'Reliability', 
      desc: 'Stable chunk-based transport with backpressure checks and integrity validation.',
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
    { icon: InstagramIcon, href: 'https://www.instagram.com/ruchit1744', color: 'hover:text-pink-500' },
    { icon: LinkedinIcon, href: 'https://www.linkedin.com/in/ruchit-thakkar-38ab37379', color: 'hover:text-blue-500' },
    { icon: GithubIcon, href: 'https://github.com/Ruchit-thakkar', color: 'hover:text-white' },
    { icon: TwitterIcon, href: 'https://x.com/RuchitThakkar19', color: 'hover:text-sky-400' },
    { icon: Mail, href: 'mailto:ruchitthakkar12@gmail.com', color: 'hover:text-emerald-400' },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-2 px-3 sm:px-4 relative z-10">
      
      {/* Page Header */}
      <div className="border-b border-white/10 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5 text-slate-100">
          <img src="/ds.png" alt="DirectShare Logo" className="w-7 h-7 object-contain" /> About DirectShare
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1 font-light">
          An open-source peer-to-peer alternative to AirDrop and Quick Share
        </p>
      </div>

      {/* Main Vision */}
      <div className="p-5 sm:p-6 rounded-2xl bg-[#1E293B] border border-white/10 shadow-md space-y-6">
        <div className="space-y-2">
          <h2 className="text-base sm:text-lg font-bold text-slate-200">Our Vision</h2>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light">
            DirectShare is a lightweight network file transfer utility. Inspired by the convenience of <strong>AirDrop</strong> and <strong>Quick Share</strong>, we built a web-first equivalent that functions instantly on any device equipped with a browser. By bypassing third-party servers entirely, DirectShare gives you full local-network bandwidth speeds and total data security.
          </p>
        </div>

        {/* Pillars / Key Priorities */}
        <div className="space-y-3">
          <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Key Pillars</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {principles.map((pr, idx) => {
              const Icon = pr.icon;
              return (
                <div key={idx} className="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-2">
                  <div className={`p-2 rounded-lg border ${pr.color} shrink-0 w-fit`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-200">{pr.title}</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed font-light">{pr.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Technology Stack Grid */}
      <div className="space-y-3">
        <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Code2 className="w-4 h-4 text-secondary" /> Technology Stack
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {technologies.map((tech) => (
            <div
              key={tech.name}
              className="p-4 rounded-xl border border-white/10 bg-[#1E293B] space-y-1.5"
            >
              <h4 className="text-xs sm:text-sm font-bold text-slate-200 flex items-center gap-1.5">
                <Terminal className={`w-3.5 h-3.5 ${tech.iconClass}`} /> {tech.name}
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed font-light">{tech.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Developer Ruchit Profile Section */}
      <div className="space-y-3">
        <h3 className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <User className="w-4 h-4 text-secondary" /> Developer
        </h3>
        <div className="p-5 sm:p-6 rounded-2xl bg-[#1E293B] border border-white/10 flex flex-col md:flex-row items-center gap-5 md:gap-6 shadow-md">
          {/* Leftside: Profile Avatar */}
          <div className="relative shrink-0">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-white/10 bg-slate-900 flex flex-col items-center justify-center text-white shadow-sm">
              <span className="text-2xl font-black bg-gradient-to-tr from-primary to-secondary bg-clip-text text-transparent">RT</span>
              <span className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Ruchit</span>
            </div>
          </div>

          {/* Rightside: Details & Socials */}
          <div className="flex-grow space-y-2.5 text-center md:text-left">
            <div className="space-y-0.5">
              <h4 className="text-base font-bold text-slate-200">Made by Ruchit</h4>
              <p className="text-[10px] text-primary font-bold tracking-wider uppercase">
                Full-Stack Web & P2P Developer
              </p>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-light max-w-xl">
              Hi, I'm Ruchit Thakkar. I built DirectShare to solve the cross-platform file sharing problem on local subnets. I focus on creating high-performance, real-time web applications with sleek user interfaces.
            </p>

            {/* Social Grid */}
            <div className="flex items-center justify-center md:justify-start gap-3">
              {devSocials.map((social, i) => {
                const Icon = social.icon;
                return (
                  <a
                    key={i}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`p-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 transition-colors ${social.color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                );
              })}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
