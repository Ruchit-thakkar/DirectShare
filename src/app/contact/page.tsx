'use client';

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
  const socials = [
    {
      name: 'LinkedIn',
      username: 'ruchit-thakkar',
      href: 'https://www.linkedin.com/in/ruchit-thakkar-38ab37379',
      icon: LinkedinIcon,
      color: 'border-blue-500/20 text-blue-400',
      accent: '#3b82f6',
      desc: 'Connect professionally, check out my industry network, and view career achievements.'
    },
    {
      name: 'GitHub',
      username: 'Ruchit-thakkar',
      href: 'https://github.com/Ruchit-thakkar',
      icon: GithubIcon,
      color: 'border-slate-200/20 text-slate-100',
      accent: '#f8fafc',
      desc: 'Explore the source code, check commits, open issues, and star direct-sharing projects.'
    },
    {
      name: 'Instagram',
      username: '@ruchit1744',
      href: 'https://www.instagram.com/ruchit1744',
      icon: InstagramIcon,
      color: 'border-pink-500/20 text-pink-400',
      accent: '#ec4899',
      desc: 'Send a DM, see stories or updates, and check out photos and highlights.'
    },
    {
      name: 'X / Twitter',
      username: '@RuchitThakkar19',
      href: 'https://x.com/RuchitThakkar19',
      icon: TwitterIcon,
      color: 'border-sky-400/20 text-sky-400',
      accent: '#38bdf8',
      desc: 'Read technical writeups, project previews, and quick thoughts on current Web3/P2P development.'
    },
    {
      name: 'Email',
      username: 'ruchitthakkar12@gmail.com',
      href: 'mailto:ruchitthakkar12@gmail.com',
      icon: Mail,
      color: 'border-emerald-500/20 text-emerald-400',
      accent: '#34d399',
      desc: 'Submit feedback, propose cooperations, or ask direct-share questions.'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-10 py-2 px-3 sm:px-4 relative z-10">
      
      {/* Page Header */}
      <div className="border-b border-white/10 pb-4 text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center justify-center sm:justify-start gap-2.5 text-slate-100">
          <MessageSquare className="w-7 h-7 text-primary" /> Connect With Me
        </h1>
        <p className="text-slate-400 text-xs sm:text-sm mt-1 font-light">
          Feel free to reach out or connect with me through these social platforms.
        </p>
      </div>

      {/* Social Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
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
              <div
                className={`p-5 rounded-2xl bg-[#1E293B] border border-white/10 transition-colors duration-150 flex items-start gap-4 hover:bg-[#233046] ${soc.color}`}
              >
                {/* Left Side branding icon */}
                <div 
                  className="p-3 rounded-xl border border-white/10 bg-slate-900 shrink-0 shadow-sm"
                  style={{ color: 'inherit' }}
                >
                  <Icon className="w-5.5 h-5.5" />
                </div>

                {/* Details */}
                <div className="space-y-1 flex-grow min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-200 text-sm sm:text-base">{soc.name}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition-colors duration-150" />
                  </div>
                  <p className="text-[11px] font-mono text-slate-400 truncate font-light">{soc.username}</p>
                  <p className="text-xs text-slate-500 leading-relaxed font-light mt-1.5">{soc.desc}</p>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
