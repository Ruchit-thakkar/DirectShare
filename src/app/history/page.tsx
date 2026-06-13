'use client';

import { useEffect, useState } from 'react';
import { getHistory, clearHistory, HistoryEntry } from '@/utils/db';
import { formatBytes, formatSpeed } from '@/utils/format';
import { motion } from 'framer-motion';
import {
  History,
  Trash2,
  Send,
  Download,
  CheckCircle,
  File as FileIcon,
  Video,
  Image as ImageIcon,
  FileArchive,
  Music,
  FileText,
  Calendar,
  Zap,
} from 'lucide-react';

export default function HistoryPage() {
  const [logs, setLogs] = useState<HistoryEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'send' | 'receive'>('all');

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const data = await getHistory();
      setLogs(data);
    } catch (e) {
      console.error('Failed to load history:', e);
    }
  };

  const handleClearHistory = async () => {
    if (confirm('Are you sure you want to clear your local transfer history?')) {
      try {
        await clearHistory();
        setLogs([]);
      } catch (e) {
        console.error('Failed to clear history:', e);
      }
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (filter === 'all') return true;
    return log.direction === filter;
  });

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return ImageIcon;
    if (type.startsWith('video/')) return Video;
    if (type.startsWith('audio/')) return Music;
    if (type.startsWith('text/')) return FileText;
    if (type.includes('zip') || type.includes('tar') || type.includes('compressed')) return FileArchive;
    return FileIcon;
  };

  const getFileIconColor = (type: string) => {
    if (type.startsWith('image/')) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    if (type.startsWith('video/')) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    if (type.startsWith('audio/')) return 'text-pink-400 bg-pink-500/10 border-pink-500/20';
    if (type.startsWith('text/')) return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2.5">
            <History className="w-8 h-8 text-primary" /> Transfer History
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Logs of sent and received file transfers stored securely inside your browser database
          </p>
        </div>

        {logs.length > 0 && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-400 hover:text-red-400 bg-slate-800/40 border border-slate-700/40 hover:border-red-500/20 hover:bg-red-500/10 rounded-xl transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear History
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 p-1 bg-slate-900/60 border border-white/5 rounded-xl w-fit">
        {(['all', 'send', 'receive'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setFilter(type)}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              filter === type
                ? 'bg-slate-800 text-slate-200 border border-white/5 shadow-inner'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {type === 'all' ? 'All' : type === 'send' ? 'Sent' : 'Received'}
          </button>
        ))}
      </div>

      {/* History List */}
      {filteredLogs.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-3xl p-12 text-center bg-slate-800/10">
          <div className="w-12 h-12 rounded-xl bg-slate-800/60 border border-white/5 flex items-center justify-center text-slate-500 mx-auto mb-4">
            <History className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-slate-400">No transfer history matches your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3.5">
          {filteredLogs.map((log) => {
            const Icon = getFileIcon(log.fileType);
            const colorClass = getFileIconColor(log.fileType);
            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-4.5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={`p-2.5 rounded-xl border ${colorClass} shrink-0`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-bold text-slate-200 truncate">{log.fileName}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                      <span>{formatBytes(log.fileSize)}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-600" />
                        {formatDate(log.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 sm:text-right shrink-0 border-t sm:border-t-0 border-white/5 pt-3 sm:pt-0">
                  <div className="space-y-0.5 text-left sm:text-right">
                    <div className="flex items-center sm:justify-end gap-1.5">
                      {log.direction === 'send' ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Send className="w-2.5 h-2.5" /> Sent
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-secondary bg-secondary/10 border border-secondary/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                          <Download className="w-2.5 h-2.5" /> Received
                        </span>
                      )}
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" /> Done
                      </span>
                    </div>
                    {log.speed > 0 && (
                      <p className="text-xs text-slate-400 flex items-center sm:justify-end gap-1">
                        <Zap className="w-3 h-3 text-amber-500" /> {formatSpeed(log.speed)}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
