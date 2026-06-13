'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { clearHistory } from '@/utils/db';
import {
  Settings,
  User,
  Sliders,
  Bell,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const {
    displayName,
    setDisplayName,
    chunkSizePreset,
    setChunkSizePreset,
    notificationsEnabled,
    setNotificationsEnabled,
  } = useStore();

  const [inputName, setInputName] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setInputName(displayName);
  }, [displayName]);

  const handleSaveDisplayName = () => {
    if (!inputName.trim()) return;
    setDisplayName(inputName.trim());
    localStorage.setItem('directshare_display_name', inputName.trim());
    showSuccess('Display name updated successfully');
  };

  const handlePresetChange = (preset: '128KB' | '256KB' | '512KB' | '1MB') => {
    setChunkSizePreset(preset);
    showSuccess(`Chunk size preset updated to ${preset}`);
  };

  const handleNotificationToggle = () => {
    const nextVal = !notificationsEnabled;
    
    if (nextVal && typeof window !== 'undefined' && 'Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          setNotificationsEnabled(true);
          showSuccess('Notifications enabled');
        } else {
          setNotificationsEnabled(false);
        }
      });
    } else {
      setNotificationsEnabled(nextVal);
      showSuccess(nextVal ? 'Notifications enabled' : 'Notifications disabled');
    }
  };

  const handleResetCache = async () => {
    if (confirm('Are you sure you want to clear all cache? This deletes all history logs.')) {
      try {
        await clearHistory();
        showSuccess('Browser database cache cleared successfully');
      } catch (e) {
        console.error(e);
      }
    }
  };

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
            <Settings className="w-8 h-8 text-primary" /> Settings
          </h1>
          <p className="text-slate-400 text-sm mt-1">Configure your DirectShare settings and preferences</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-400 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <div>{successMsg}</div>
        </div>
      )}

      <div className="space-y-6">
        {/* Profile Identity Settings */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-slate-200">Device Identity</h2>
          </div>
          
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Display Name
            </label>
            <div className="flex gap-2 max-w-md">
              <input
                type="text"
                placeholder="Enter display name"
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                className="flex-grow px-4 py-2.5 bg-slate-900/60 rounded-xl border border-white/10 hover:border-white/20 focus:border-primary/50 text-slate-200 text-sm focus:outline-none transition-colors"
              />
              <button
                onClick={handleSaveDisplayName}
                disabled={!inputName.trim() || inputName === displayName}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-600 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-blue-500/10 transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              This name is shown to other devices on the network when initiating transfers.
            </p>
          </div>
        </div>

        {/* Network & Protocol presets */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
            <Sliders className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-slate-200">Transfer Presets</h2>
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div className="space-y-0.5">
                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                  Default Chunk Size
                </span>
                <p className="text-xs text-slate-500 leading-relaxed max-w-md">
                  WebRTC Data Channels perform best with smaller payloads. Default 256KB is optimal. Large files stream faster with 512KB/1MB but might stall under poor Wi-Fi conditions.
                </p>
              </div>

              {/* Chunk Presets dropdown */}
              <div className="flex gap-1 bg-slate-950/40 border border-white/5 p-1 rounded-xl w-fit shrink-0">
                {(['128KB', '256KB', '512KB', '1MB'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handlePresetChange(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      chunkSizePreset === preset
                        ? 'bg-slate-800 text-slate-200 border border-white/5 shadow-inner'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* System Settings */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-base font-bold text-slate-200">System Preferences</h2>
          </div>

          <div className="flex justify-between items-center">
            <div className="space-y-0.5">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Desktop Notifications
              </span>
              <p className="text-xs text-slate-500">
                Show alert messages when file transfers complete or fail.
              </p>
            </div>
            <button
              onClick={handleNotificationToggle}
              className={`w-12 h-6.5 rounded-full p-1 transition-colors cursor-pointer ${
                notificationsEnabled ? 'bg-primary' : 'bg-slate-800 border border-white/5'
              }`}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full bg-white transition-transform ${
                  notificationsEnabled ? 'translate-x-5.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Cache & Maintenance */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-4">
          <div className="flex items-center gap-2.5 border-b border-white/5 pb-3">
            <Trash2 className="w-5 h-5 text-red-500" />
            <h2 className="text-base font-bold text-slate-200">Maintenance</h2>
          </div>

          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div className="space-y-0.5">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Reset App Cache
              </span>
              <p className="text-xs text-slate-500">
                Wipe all transfer records from IndexedDB storage. Does not affect your files.
              </p>
            </div>
            <button
              onClick={handleResetCache}
              className="px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 hover:border-red-500/40 text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
            >
              Clear DB Storage
            </button>
          </div>
        </div>

        {/* Documentation details */}
        <div className="glass-panel p-6 rounded-3xl border border-white/5 flex items-start gap-4 bg-slate-900/20">
          <HelpCircle className="w-6 h-6 text-slate-500 shrink-0" />
          <div className="space-y-1 text-xs text-slate-400 leading-relaxed">
            <p className="font-bold text-slate-300">How DirectShare Works:</p>
            <p>
              DirectShare establishes a WebRTC connection directly between device browsers. It uses a lightweight local Signaling room code server to exchange SDP offer/answer handshake packets, allowing browsers to connect peer-to-peer over the local subnet. Once connected, your files never touch the signaling server; they stream directly from one local machine to another, ensuring zero latency, maximum throughput, and complete privacy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
