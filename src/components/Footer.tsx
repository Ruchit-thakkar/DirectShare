import Link from 'next/link';
import { Mail } from 'lucide-react';
import { 
  InstagramIcon, 
  LinkedinIcon, 
  GithubIcon, 
  TwitterIcon 
} from './SocialIcons';

export default function Footer() {
  const navLinks = [
    { name: 'Home', href: '/' },
    { name: 'Send', href: '/send' },
    { name: 'Receive', href: '/receive' },
    { name: 'About', href: '/about' },
    { name: 'Contact', href: '/contact' },
  ];

  const socialLinks = [
    { 
      name: 'Instagram', 
      href: 'https://www.instagram.com/ruchit1744', 
      icon: InstagramIcon, 
      color: 'hover:text-pink-500 hover:bg-pink-500/10 hover:border-pink-500/30' 
    },
    { 
      name: 'LinkedIn', 
      href: 'https://www.linkedin.com/in/ruchit-thakkar-38ab37379', 
      icon: LinkedinIcon, 
      color: 'hover:text-blue-500 hover:bg-blue-500/10 hover:border-blue-500/30' 
    },
    { 
      name: 'GitHub', 
      href: 'https://github.com/Ruchit-thakkar', 
      icon: GithubIcon, 
      color: 'hover:text-white hover:bg-white/10 hover:border-white/30' 
    },
    { 
      name: 'X', 
      href: 'https://x.com/RuchitThakkar19', 
      icon: TwitterIcon, 
      color: 'hover:text-sky-400 hover:bg-sky-400/10 hover:border-sky-400/30' 
    },
    { 
      name: 'Email', 
      href: 'mailto:ruchitthakkar12@gmail.com', 
      icon: Mail, 
      color: 'hover:text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30' 
    },
  ];

  return (
    <footer className="w-full border-t border-white/10 py-10 bg-slate-950/20 text-slate-500 mt-auto relative z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Navigation & Branding row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <img src="/ds.png" alt="DirectShare Logo" className="w-8 h-8 object-contain group-hover:scale-105 transition-transform duration-300" />
            <span className="font-bold text-slate-300 text-lg group-hover:text-white transition-colors duration-300">DirectShare</span>
          </Link>

          <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2.5">
            {navLinks.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className="text-sm text-slate-400 hover:text-primary transition-colors duration-250 font-medium"
              >
                {item.name}
              </Link>
            ))}
          </nav>
        </div>

        {/* Divider */}
        <div className="w-full h-px bg-white/10" />

        {/* Copyright, Credits & Socials row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm">
          <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-4 text-center sm:text-left">
            <span>© 2026 DirectShare. All rights reserved.</span>
            <span className="hidden sm:inline text-slate-800">|</span>
            <span className="flex items-center gap-1.5">
              Made by <span className="font-semibold text-slate-300">Ruchit</span> <span className="text-red-500 animate-pulse">❤️</span>
            </span>
          </div>

          {/* Social Icons grid */}
          <div className="flex gap-2.5">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.name}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={social.name}
                  className={`p-2 rounded-xl bg-white/5 border border-white/10 text-slate-400 transition-all duration-300 hover:scale-110 ${social.color}`}
                >
                  <Icon className="w-4.5 h-4.5" />
                </a>
              );
            })}
          </div>
        </div>

      </div>
    </footer>
  );
}
