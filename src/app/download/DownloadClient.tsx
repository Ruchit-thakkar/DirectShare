'use client';

import { useState } from 'react';
import { 
  Download, 
  Check, 
  Smartphone, 
  Shield, 
  Zap, 
  FileText, 
  X, 
  Wifi, 
  Layers, 
  Info, 
  Calendar, 
  CheckCircle2,
  RefreshCw,
  QrCode,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DownloadClientProps {
  apkSize: string;
  apkChecksum: string;
}

type ScreenType = 'home' | 'send' | 'receive' | 'transfer';

export default function DownloadClient({ apkSize, apkChecksum }: DownloadClientProps) {
  const [activeScreen, setActiveScreen] = useState<ScreenType>('home');
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  const appInfo = [
    { label: 'Platform', value: 'Android', icon: Smartphone },
    { label: 'Version', value: '1.0.0', icon: Info },
    { label: 'APK Size', value: apkSize, icon: Layers },
    { label: 'Compatibility', value: 'Android 10+', icon: Shield },
    { label: 'Category', value: 'File Sharing', icon: Zap },
    { label: 'Technology', value: 'Kotlin + Compose', icon: FileText }
  ];

  const features = [
    'Ultra-fast transfer',
    'No internet required',
    'WiFi and Hotspot support',
    'Nearby device discovery',
    'Multiple file transfer',
    'Folder transfer',
    'Resume transfers',
    'Privacy-first design',
    'No account required',
    'No ads inside app',
    '100% local transfer'
  ];

  return (
    <div className="w-full min-h-screen py-10 relative overflow-hidden flex flex-col justify-center items-center">
      {/* Background Ambient Glows */}
      <div className="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-primary/20 rounded-full blur-[100px] sm:blur-[150px] -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] bg-secondary/20 rounded-full blur-[100px] sm:blur-[150px] -z-10 pointer-events-none" />

      {/* Header Breadcrumb / Tag */}
      <div className="mb-8 text-center space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-wider text-slate-300 uppercase">
          <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
          Android App Available
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-tight">
          DirectShare for Android
        </h1>
        <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto font-light">
          Experience ultra-fast, local device-to-device sharing directly from your pocket.
        </p>
      </div>

      {/* Main Download Card Section */}
      <div className="w-full max-w-6xl px-4 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        
        {/* Left Side: Premium Download Details Card (7 Cols) */}
        <div className="lg:col-span-7 bg-slate-900/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.4)] relative overflow-hidden group">
          {/* Subtle top border reflection */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          
          <div className="space-y-8">
            {/* Header: App Logo, Name & Tagline */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="relative group shrink-0">
                <div className="absolute inset-0 bg-gradient-to-tr from-primary to-secondary rounded-2xl blur-md opacity-40 group-hover:opacity-60 transition-opacity" />
                <img 
                  src="/DirectShare.png" 
                  alt="DirectShare App Logo" 
                  className="w-20 h-20 rounded-2xl border border-white/10 relative z-10 shadow-lg object-cover" 
                  onError={(e) => {
                    // Fallback to ds.png if DirectShare.png is not loaded
                    e.currentTarget.src = '/ds.png';
                  }}
                />
              </div>
              <div className="text-center sm:text-left space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-2">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">DirectShare</h2>
                  <span className="px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] font-mono text-primary font-bold">APK</span>
                </div>
                <p className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400">
                  Fast. Private. Offline.
                </p>
                <p className="text-xs sm:text-sm text-slate-400 font-light leading-relaxed max-w-md">
                  Ultra-fast offline file sharing for Android. Transfer photos, videos, documents, APKs and folders without internet using WiFi and Hotspot.
                </p>
              </div>
            </div>

            {/* App Info Grid (2 Columns) */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 border-t border-b border-white/5 py-6">
              {appInfo.map((info, idx) => {
                const Icon = info.icon;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-slate-400 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{info.label}</p>
                      <p className="text-xs sm:text-sm font-bold text-slate-200 font-mono">{info.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Main Features Checklist */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 font-mono">Main Features</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2.5 text-slate-300">
                    <div className="h-4.5 w-4.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-emerald-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-light">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Download Buttons Section */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <a 
                href="/downloads/DirectShare.apk" 
                download="DirectShare.apk"
                className="flex-grow group/btn"
              >
                <button className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white text-slate-950 hover:bg-slate-100 font-extrabold text-sm transition-all duration-300 shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] cursor-pointer relative overflow-hidden active:scale-98">
                  {/* Subtle hover overlay */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-black/[0.03] to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000 ease-out" />
                  <Download className="w-5 h-5 text-slate-950 animate-bounce" />
                  <div className="flex flex-col items-start leading-none text-left">
                    <span className="text-sm font-black">Download APK</span>
                    <span className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">v1.0.0 • {apkSize}</span>
                  </div>
                </button>
              </a>

              <button 
                onClick={() => setShowReleaseNotes(true)}
                className="flex-grow sm:flex-grow-0 flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-200 hover:text-white font-bold text-sm transition-colors cursor-pointer active:scale-98"
              >
                <FileText className="w-4 h-4 text-violet-400" />
                View Release Notes
              </button>
            </div>

            {/* Additional Information Section (Date, SDK) */}
            <div className="pt-6 border-t border-white/5 space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 font-mono">App Verification & Integrity</h3>
              
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[11px] font-mono text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>Released: June 21, 2026</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-slate-500" />
                    <span>SDK Min: Android 10+</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-slate-500" />
                    <span>Signature: Verified</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Side: Interactive Phone Mockup (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col items-center">
          
          {/* Screen Switcher Tabs (Nothing OS / Dot Matrix styled) */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 bg-slate-900/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/5 mb-6 w-full max-w-sm">
            {(['home', 'send', 'receive', 'transfer'] as ScreenType[]).map((screen) => (
              <button
                key={screen}
                onClick={() => setActiveScreen(screen)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all cursor-pointer ${
                  activeScreen === screen
                    ? 'bg-primary text-white font-bold shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {screen}
              </button>
            ))}
          </div>

          {/* Smartphone Container */}
          <div className="relative w-full max-w-[290px] aspect-[9/19] rounded-[48px] border-[10px] border-slate-950 bg-slate-950 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_0_1px_rgba(255,255,255,0.08)] overflow-hidden group">
            {/* Phone Speaker & Camera Notch */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-950 rounded-b-2xl z-40 flex items-center justify-center">
              <div className="w-12 h-1 bg-slate-900 rounded-full mb-1" />
              <div className="w-2.5 h-2.5 bg-slate-900/80 rounded-full absolute right-6 bottom-1" />
            </div>

            {/* Status Bar */}
            <div className="absolute top-6 inset-x-0 h-6 px-5 flex items-center justify-between text-[10px] font-mono text-slate-400 z-35 bg-slate-950/20 backdrop-blur-xs select-none">
              <span>14:48</span>
              <div className="flex items-center gap-1.5">
                <Wifi className="w-3 h-3" />
                <span className="w-4 h-2.5 border border-slate-400 rounded-xs relative flex items-center p-0.5">
                  <span className="h-full w-3/4 bg-slate-400 rounded-2xs" />
                </span>
              </div>
            </div>

            {/* Phone Screen Canvas */}
            <div className="w-full h-full pt-12 pb-4 px-4 bg-[#0a0f1d] flex flex-col relative overflow-hidden select-none">
              
              {/* Grid Background */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

              {/* Dynamic Screen Layout */}
              <div className="flex-grow flex flex-col relative z-10 text-slate-200 text-center justify-between py-4">
                <AnimatePresence mode="wait">
                  
                  {/* Home Screen View */}
                  {activeScreen === 'home' && (
                    <motion.div
                      key="home"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="flex-grow flex flex-col justify-between py-2"
                    >
                      {/* Logo and Status */}
                      <div className="space-y-1 mt-2">
                        <div className="flex justify-center">
                          <img src="/ds.png" alt="logo" className="w-12 h-12 object-contain" />
                        </div>
                        <h4 className="font-bold text-sm tracking-tight text-white">DirectShare</h4>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-mono text-emerald-400 uppercase">
                          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Ready
                        </div>
                      </div>

                      {/* Radar Waves Animation */}
                      <div className="relative h-28 w-28 mx-auto flex items-center justify-center my-4">
                        <div className="absolute inset-0 rounded-full border border-primary/20 animate-[ping_2s_infinite] scale-100" />
                        <div className="absolute inset-2 rounded-full border border-primary/30 animate-[ping_2.5s_infinite] scale-90" />
                        <div className="absolute inset-6 rounded-full border border-primary/40 animate-[ping_3s_infinite] scale-75" />
                        <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/20">
                          <Smartphone className="w-5 h-5 text-white" />
                        </div>
                      </div>

                      {/* CTA Buttons */}
                      <div className="space-y-2 px-1">
                        <button className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm shadow-primary/10">
                          <span>Send Files</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <button className="w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold">
                          Receive Files
                        </button>
                      </div>

                      {/* Device visible details */}
                      <p className="text-[9px] font-mono text-slate-500 mt-2">
                        Visible as: <span className="text-slate-300">NOTHING_PHONE_2</span>
                      </p>
                    </motion.div>
                  )}

                  {/* Send Screen View */}
                  {activeScreen === 'send' && (
                    <motion.div
                      key="send"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="flex-grow flex flex-col justify-between py-2 text-left"
                    >
                      <div className="space-y-3">
                        <h4 className="font-bold text-xs text-white uppercase tracking-wider font-mono">Select Files</h4>
                        
                        {/* File lists simulated */}
                        <div className="space-y-1.5">
                          {[
                            { name: 'IMG_3848.jpg', size: '2.4 MB', type: 'image' },
                            { name: 'travel_vlog.mp4', size: '45.1 MB', type: 'video' },
                            { name: 'lecture_notes.pdf', size: '1.2 MB', type: 'file' }
                          ].map((file, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="p-1 rounded bg-slate-800 text-slate-400">
                                  <FileText className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="min-w-0 leading-none">
                                  <p className="text-[10px] text-slate-200 font-medium truncate leading-tight">{file.name}</p>
                                  <span className="text-[8px] text-slate-500 font-mono mt-0.5 block">{file.size}</span>
                                </div>
                              </div>
                              <div className="h-4 w-4 rounded bg-primary flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5 text-white" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Radar scan for devices */}
                      <div className="space-y-2 mt-4">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">Searching Devices</span>
                          <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                        </div>
                        
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 p-1.5 px-2 rounded-xl border border-primary/20 bg-primary/5 cursor-pointer">
                            <div className="w-6 h-6 rounded-lg bg-primary/20 flex items-center justify-center text-primary text-[10px] font-bold">PP</div>
                            <div className="leading-none">
                              <p className="text-[10px] text-slate-200 font-bold">Pixel 8 Pro</p>
                              <span className="text-[7px] text-emerald-400 font-mono font-medium">Ready to pair</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 p-1.5 px-2 rounded-xl border border-white/5 bg-slate-900/40 opacity-70">
                            <div className="w-6 h-6 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-[10px]">MB</div>
                            <div className="leading-none">
                              <p className="text-[10px] text-slate-400">Ruchit's Mac</p>
                              <span className="text-[7px] text-slate-500 font-mono">Offline</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {/* Receive Screen View */}
                  {activeScreen === 'receive' && (
                    <motion.div
                      key="receive"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="flex-grow flex flex-col justify-between py-2"
                    >
                      <div className="space-y-1 mt-2">
                        <h4 className="font-bold text-xs text-white uppercase tracking-wider font-mono">Receive Files</h4>
                        <p className="text-[9px] text-slate-400 max-w-[180px] mx-auto leading-relaxed">
                          Scan this QR code from the sender device to connect.
                        </p>
                      </div>

                      {/* QR Code Graphic Mockup */}
                      <div className="p-3 bg-white rounded-2xl w-36 h-36 mx-auto flex items-center justify-center shadow-lg relative my-2">
                        <QrCode className="w-32 h-32 text-slate-950" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-7 h-7 bg-slate-950 rounded-lg flex items-center justify-center p-1 border-2 border-white shadow-md">
                            <img src="/ds.png" alt="" className="w-5 h-5 object-contain" />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1 px-2">
                        <div className="p-2 rounded-xl bg-white/5 border border-white/5 text-[9px] font-mono text-slate-400 flex items-center justify-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Waiting for connection...
                        </div>
                      </div>

                      <p className="text-[9px] font-mono text-slate-500">
                        Device Name: <span className="text-slate-300">NOTHING_PHONE_2</span>
                      </p>
                    </motion.div>
                  )}

                  {/* Transfer Screen View */}
                  {activeScreen === 'transfer' && (
                    <motion.div
                      key="transfer"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="flex-grow flex flex-col justify-between py-2 text-left"
                    >
                      <div className="space-y-1 mt-1 leading-none">
                        <span className="text-[8px] font-mono text-slate-500 uppercase tracking-wider">Active Transfer</span>
                        <h4 className="font-bold text-xs text-white">Sending to Pixel 8 Pro</h4>
                      </div>

                      {/* Central Speed and Progress */}
                      <div className="relative h-24 w-24 mx-auto flex items-center justify-center my-3 select-none">
                        {/* Circular Progress Bar Background */}
                        <svg className="w-full h-full transform -rotate-90">
                          <circle cx="48" cy="48" r="40" className="stroke-slate-800" strokeWidth="6" fill="transparent" />
                          <circle cx="48" cy="48" r="40" className="stroke-primary" strokeWidth="6" fill="transparent" strokeDasharray="251.2" strokeDashoffset="55.2" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                          <span className="text-base font-black text-white font-mono">78%</span>
                          <span className="text-[8px] text-emerald-400 font-mono font-bold mt-1">48.2 MB/s</span>
                        </div>
                      </div>

                      {/* File Queue List */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="text-[9px] text-slate-300 truncate leading-tight font-medium">IMG_3848.jpg</span>
                          </div>
                          <span className="text-[8px] font-mono text-slate-500 shrink-0">Done</span>
                        </div>
                        <div className="flex items-center justify-between p-2 rounded-xl bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <RefreshCw className="w-3.5 h-3.5 text-primary shrink-0 animate-spin" />
                            <span className="text-[9px] text-slate-200 truncate leading-tight font-bold">travel_vlog.mp4</span>
                          </div>
                          <span className="text-[8px] font-mono text-primary font-bold shrink-0">62%</span>
                        </div>
                      </div>

                      {/* Estimated time */}
                      <p className="text-[8px] font-mono text-slate-500 text-center mt-2">
                        Estimated Time: <span className="text-slate-300">4s remaining</span>
                      </p>
                    </motion.div>
                  )}
                  
                </AnimatePresence>
              </div>

              {/* Bottom Phone Gesture Bar */}
              <div className="h-1 w-20 bg-slate-700 rounded-full mx-auto mt-auto shrink-0" />
            </div>
          </div>
        </div>

      </div>

      {/* Release Notes Modal Overlay */}
      <AnimatePresence>
        {showReleaseNotes && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Dark glass backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReleaseNotes(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative z-10"
            >
              {/* Top gradient detail */}
              <div className="h-1.5 bg-gradient-to-r from-primary to-secondary" />

              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-white/5">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold text-white">Release Notes</h3>
                </div>
                <button 
                  onClick={() => setShowReleaseNotes(false)}
                  className="p-2 rounded-xl hover:bg-white/5 text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6 max-h-[350px] overflow-y-auto space-y-6">
                
                {/* v1.0.0 (Latest) */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-white font-mono flex items-center gap-1.5">
                      v1.0.0
                      <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-[8px] font-mono font-bold text-emerald-400 uppercase">
                        Latest
                      </span>
                    </h4>
                    <span className="text-xs text-slate-500 font-mono">June 21, 2026</span>
                  </div>
                  <p className="text-xs text-slate-300 font-light leading-relaxed">
                    Official initial release of DirectShare for Android devices, bringing local, ultra-fast device-to-device file transfer directly to Android.
                  </p>
                  <ul className="space-y-1.5 pl-3 list-none">
                    {[
                      'Complete Kotlin codebase built with Jetpack Compose for UI.',
                      'High-speed local networking utilizing WiFi Direct / Hotspot protocols.',
                      'Fully offline operations; files do not touch any remote servers.',
                      'Support for multi-file selections and recursive directory/folder sharing.',
                      'Zero ads, zero accounts required, and zero network configuration required.',
                      'Integrity checks using Adler-32 algorithm to secure chunk-based transmission.'
                    ].map((bullet, index) => (
                      <li key={index} className="text-xs text-slate-400 font-light flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="h-px bg-white/5" />

                {/* v0.9.0 (Beta) */}
                <div className="space-y-3 opacity-60">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-black text-white font-mono">v0.9.0-beta</h4>
                    <span className="text-xs text-slate-500 font-mono">May 14, 2026</span>
                  </div>
                  <p className="text-xs text-slate-300 font-light leading-relaxed">
                    Beta release testing P2P sockets and backpressure calculations.
                  </p>
                  <ul className="space-y-1.5 pl-3 list-none">
                    {[
                      'First build testing direct Wi-Fi local socket bridges.',
                      'Implemented basic chunking logic for files exceeding 100MB.',
                      'Optimized memory usage on entry-level Android devices.'
                    ].map((bullet, index) => (
                      <li key={index} className="text-xs text-slate-400 font-light flex items-start gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-slate-600 mt-1.5 shrink-0" />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 bg-slate-950/40 border-t border-white/5 flex justify-end">
                <button
                  onClick={() => setShowReleaseNotes(false)}
                  className="px-5 py-2 rounded-xl bg-white text-slate-950 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Got it
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
