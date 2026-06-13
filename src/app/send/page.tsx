'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { transferManager } from '@/utils/webrtc';
import { formatBytes, formatSpeed, formatTime } from '@/utils/format';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import {
  Upload,
  File as FileIcon,
  X,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Pause,
  Play,
  RefreshCw,
  QrCode,
  FileText,
  Video,
  Image as ImageIcon,
  FileArchive,
  Music,
  ArrowRight,
  Home as HomeIcon,
  Activity,
  Zap
} from 'lucide-react';

export default function SendPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    displayName,
    connectionState,
    selectedFiles,
    activeFiles,
    transferProgress,
    transferSpeed,
    transferSpeedCurrent,
    transferSpeedPeak,
    remainingTime,
    errorMsg,
    roomId,
    peerName,
    chunkSizePreset,
    setConnectionState,
    setSelectedFiles,
    setErrorMsg,
  } = useStore();

  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [showManual, setShowManual] = useState<boolean>(false);
  const [manualOffer, setManualOffer] = useState<string>('');
  const [manualAnswer, setManualAnswer] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingManual, setIsGeneratingManual] = useState<boolean>(false);

  // Initialize room for LAN signaling
  useEffect(() => {
    if (selectedFiles.length > 0 && connectionState === 'Waiting') {
      transferManager.initialize(true);
    }
  }, [selectedFiles, connectionState]);

  // Generate QR Code for receiver room URL
  useEffect(() => {
    if (roomId) {
      const origin = window.location.origin;
      const receiverUrl = `${origin}/receive?room=${roomId}`;
      QRCode.toDataURL(receiverUrl, { margin: 1.5, width: 220 })
        .then((url) => setQrCodeUrl(url))
        .catch((err) => console.error('QR code generation failed:', err));
    }
  }, [roomId]);

  // Play celebration confetti on completion
  useEffect(() => {
    if (connectionState === 'Completed') {
      const duration = 2 * 1000;
      const end = Date.now() + duration;

      const frame = () => {
        confetti({
          particleCount: 3,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
          colors: ['#3b82f6', '#8b5cf6'],
        });
        confetti({
          particleCount: 3,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
          colors: ['#3b82f6', '#8b5cf6'],
        });

        if (Date.now() < end) {
          requestAnimationFrame(frame);
        }
      };
      frame();
    }
  }, [connectionState]);

  // Clean up WebRTC connection on unmount
  useEffect(() => {
    return () => {
      transferManager.cleanUp();
      useStore.getState().resetTransfer();
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles([...selectedFiles, ...files]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles([...selectedFiles, ...files]);
    }
  };

  const removeFile = (index: number) => {
    const next = [...selectedFiles];
    next.splice(index, 1);
    setSelectedFiles(next);
  };

  const startTransfer = async () => {
    if (selectedFiles.length === 0) return;
    await transferManager.sendSelectedFiles(selectedFiles);
  };

  const handleGenerateManualOffer = async () => {
    setIsGeneratingManual(true);
    setErrorMsg(null);
    try {
      const sdp = await transferManager.setupManualConnection(true);
      setManualOffer(sdp);
      setConnectionState('Discovering');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate SDP offer');
    } finally {
      setIsGeneratingManual(false);
    }
  };

  const handleConnectManual = async () => {
    if (!manualAnswer) return;
    setErrorMsg(null);
    try {
      await transferManager.acceptManualAnswer(manualAnswer);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept answer SDP');
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(manualOffer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetPage = () => {
    transferManager.cleanUp();
    useStore.getState().resetTransfer();
  };

  // Icon selector based on file type
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

  const getChunkStats = () => {
    const presetSizeMap = { '128KB': 128 * 1024, '256KB': 256 * 1024, '512KB': 512 * 1024, '1MB': 1024 * 1024 };
    const chunkSize = presetSizeMap[chunkSizePreset] || 256 * 1024;
    const activeFile = activeFiles.find(f => f.status === 'transferring');
    if (!activeFile) return { current: 0, total: 0 };
    
    const total = Math.ceil(activeFile.size / chunkSize);
    const current = Math.min(total, Math.ceil((activeFile.progress / 100) * total));
    return { current, total };
  };

  const { current: currentChunk, total: totalChunks } = getChunkStats();

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2 px-3 sm:px-4 relative z-10">
      
      {/* Page Header */}
      {connectionState !== 'Completed' && connectionState !== 'Sending' && connectionState !== 'Paused' && (
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <img src="/ds.png" alt="DirectShare Logo" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Send Files</h1>
              <p className="text-slate-400 text-xs mt-0.5">Direct peer-to-peer file sharing</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-300">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>LAN Mode</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-xs sm:text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Error:</span> {errorMsg}
          </div>
        </div>
      )}

      {/* STEP 1: File Upload Box */}
      {selectedFiles.length === 0 && (
        <div
          className="border border-dashed border-white/20 hover:border-primary/50 rounded-2xl p-8 sm:p-12 text-center bg-white/[0.01] hover:bg-white/[0.02] cursor-pointer transition-all duration-200 group"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            multiple
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
          />
          <div className="flex flex-col items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 group-hover:text-primary group-hover:border-primary/30 transition-colors">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm sm:text-base font-bold text-slate-200">Drag & drop files here, or click to browse</p>
              <p className="text-[11px] text-slate-500">Supports images, videos, documents, and files up to 10GB+</p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: Selected Files and Discovery */}
      {selectedFiles.length > 0 && connectionState === 'Waiting' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* File list */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-sm font-bold text-slate-300">Selected Files ({selectedFiles.length})</h2>
              <button
                onClick={() => setSelectedFiles([])}
                className="text-[11px] font-semibold text-red-400 hover:text-red-300 transition-colors"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {selectedFiles.map((file, i) => {
                const Icon = getFileIcon(file.type);
                const colorClass = getFileIconColor(file.type);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-lg border ${colorClass} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-slate-200 truncate">{file.name}</p>
                        <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between p-3 rounded-2xl bg-white/[0.01] border border-white/10 gap-3">
              <div className="text-xs">
                <span className="text-slate-400">Total size:</span>{' '}
                <span className="font-bold text-slate-200 font-mono">
                  {formatBytes(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
                </span>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    fileInputRef.current?.click();
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 text-slate-300 transition-colors text-center cursor-pointer"
                >
                  Add Files
                </button>
                <button
                  onClick={startTransfer}
                  className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary hover:bg-blue-600 transition-colors shadow-sm cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  Connect & Share
                </button>
              </div>
            </div>
          </div>

          {/* Quick instructions / Display identity */}
          <div className="p-5 rounded-2xl bg-[#1E293B] border border-white/10 h-fit space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instructions</h3>
            <ul className="text-xs text-slate-300 space-y-2.5">
              <li className="flex gap-2 items-start">
                <span className="text-primary shrink-0 font-bold">•</span>
                <span>Connect both devices to the same local Wi-Fi router or hotspot.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-primary shrink-0 font-bold">•</span>
                <span>Open DirectShare on the receiver machine and select <strong>Receive</strong>.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-primary shrink-0 font-bold">•</span>
                <span>Do not close this tab during transmission.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* STEP 3: Connecting / Discovery Panel (Radar Connection Screen) */}
      {selectedFiles.length > 0 &&
        (connectionState === 'Discovering' || connectionState === 'Connecting' || connectionState === 'Connected') && (
          <div className="p-6 rounded-2xl bg-[#1E293B] border border-white/10 text-center max-w-xl mx-auto space-y-6">
            
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center w-20 h-20">
                <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping opacity-75" />
                <div className="relative w-16 h-16 rounded-full bg-[#0F172A] border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
                  <img src="/ds.png" alt="DirectShare Logo" className="w-10 h-10 object-contain" />
                </div>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                {connectionState === 'Connected' ? 'Connected to Peer' : connectionState === 'Connecting' ? 'Connecting...' : 'Waiting for connection...'}
              </h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {connectionState === 'Connected'
                  ? `Connected to ${peerName || 'receiver'}. Waiting for file acceptance...`
                  : 'Enter the code below or scan the QR code on the receiving device.'}
              </p>
            </div>

            {/* Room Code view */}
            {!showManual && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center bg-slate-900/60 p-4.5 rounded-xl border border-white/5 text-left">
                <div className="space-y-3">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Room Code
                    </span>
                    <div className="text-3xl font-black tracking-widest bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent py-0.5 font-mono">
                      {roomId || '......'}
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 font-light leading-relaxed">
                    Input this 6-digit code on the Receive page to initiate peer connection.
                  </p>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-1.5">
                  <div className="bg-white p-2 rounded-xl shadow-md">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Receiver QR Code" className="w-[120px] h-[120px]" />
                    ) : (
                      <div className="w-[120px] h-[120px] bg-slate-800 animate-pulse rounded-lg" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                    <QrCode className="w-3 h-3 text-primary" /> Scan to link
                  </span>
                </div>
              </div>
            )}

            {/* Offline manual connection toggle */}
            <div className="border-t border-white/10 pt-4">
              <button
                onClick={() => setShowManual(!showManual)}
                className="text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1 mx-auto cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {showManual ? 'Show Room Info' : 'Try Fully Offline (No Signaling Server)'}
              </button>
            </div>

            {/* Manual SDP exchange blocks */}
            {showManual && (
              <div className="space-y-4 text-left border border-white/10 bg-slate-900/40 p-4 rounded-xl">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-300">1. Local SDP Offer</h3>
                  {!manualOffer ? (
                    <button
                      onClick={handleGenerateManualOffer}
                      disabled={isGeneratingManual}
                      className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg border border-white/10 transition-colors flex items-center gap-1 disabled:opacity-50 cursor-pointer"
                    >
                      {isGeneratingManual && <Loader2 className="w-3 h-3 animate-spin" />}
                      Generate Offer
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={manualOffer}
                        className="w-full text-[10px] font-mono p-2 bg-slate-950/80 rounded-lg border border-white/10 resize-none h-[60px]"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                      <button
                        onClick={copyToClipboard}
                        className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg border border-white/10 transition-colors flex flex-col items-center justify-center shrink-0 w-14 gap-1 cursor-pointer"
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-slate-300">2. Paste Receiver SDP Answer</h3>
                  <textarea
                    placeholder="Paste receiver answer SDP JSON here..."
                    value={manualAnswer}
                    onChange={(e) => setManualAnswer(e.target.value)}
                    className="w-full text-[10px] font-mono p-2 bg-slate-950/80 rounded-lg border border-white/10 resize-none h-[60px]"
                  />
                  <button
                    onClick={handleConnectManual}
                    disabled={!manualAnswer}
                    className="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Connect Manually
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-center w-full pt-2">
              <button
                onClick={resetPage}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-colors cursor-pointer"
              >
                Cancel Transfer
              </button>
            </div>
          </div>
        )}

      {/* STEP 4: Active Sending Progress / Metrics Panel (Lightweight Transfer Screen) */}
      {selectedFiles.length > 0 &&
        (connectionState === 'Sending' || connectionState === 'Paused') && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Left side: stats and linear progress bar */}
            <div className="md:col-span-2 space-y-4">
              <div className="p-5 rounded-2xl bg-[#1E293B] border border-white/10 space-y-5">
                
                {/* Header status bar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        connectionState === 'Paused' ? 'bg-amber-400' : 'bg-primary animate-pulse'
                      }`}
                    />
                    <div>
                      <h3 className="text-sm font-bold text-slate-200">
                        {connectionState === 'Paused' ? 'Transfer Paused' : `Sending to ${peerName || 'Receiver'}`}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Avg Speed: {formatSpeed(transferSpeed)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {connectionState === 'Sending' ? (
                      <button
                        onClick={() => transferManager.pause()}
                        className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                        title="Pause"
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => transferManager.resume()}
                        className="p-2 rounded-lg bg-primary hover:bg-blue-600 text-white transition-colors cursor-pointer"
                        title="Resume"
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => transferManager.cancel()}
                      className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-colors cursor-pointer"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Lightweight Linear Progress Bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                    <span>Overall Progress</span>
                    <span className="text-primary font-mono">{transferProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-white/10">
                    <div
                      className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-300"
                      style={{ width: `${transferProgress}%` }}
                    />
                  </div>
                </div>

                {/* Dashboard Stats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                  <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                      Speed Current
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 font-mono mt-0.5">
                      {formatSpeed(transferSpeedCurrent)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                      Speed Peak
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 font-mono mt-0.5">
                      {formatSpeed(transferSpeedPeak)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                      Time Left
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                      {formatTime(remainingTime).replace(' remaining', '')}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5">
                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                      Chunks
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-200 font-mono mt-0.5">
                      {currentChunk}/{totalChunks}
                    </p>
                  </div>
                </div>

                {/* Current transferring file banner */}
                <div className="p-3 rounded-xl bg-white/[0.01] border border-white/10 flex items-center justify-between text-xs">
                  <div className="min-w-0 flex-grow pr-3">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">File Name</span>
                    <span className="text-slate-200 font-semibold truncate block mt-0.5">
                      {activeFiles.find(f => f.status === 'transferring')?.name || 'Preparing next...'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Size</span>
                    <span className="text-slate-200 font-mono block mt-0.5">
                      {formatBytes(activeFiles.find(f => f.status === 'transferring')?.size || 0)}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Right side: File queue list */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Queue</h3>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                {activeFiles.map((file) => {
                  const Icon = getFileIcon(file.type);
                  const colorClass = getFileIconColor(file.type);
                  return (
                    <div
                      key={file.id}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2 relative overflow-hidden shadow-sm"
                    >
                      <div
                        className="absolute bottom-0 left-0 h-0.5 bg-primary/20 transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />

                      <div className="flex items-center justify-between min-w-0 gap-2 relative z-10">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`p-1.5 rounded-lg border ${colorClass} shrink-0`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-200 truncate">{file.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{formatBytes(file.size)}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono text-[11px]">
                          {file.status === 'completed' ? (
                            <span className="text-emerald-400 font-bold">Done</span>
                          ) : file.status === 'transferring' ? (
                            <span className="text-primary font-bold">{file.progress}%</span>
                          ) : file.status === 'paused' ? (
                            <span className="text-amber-400 font-bold">Paused</span>
                          ) : (
                            <span className="text-slate-500 uppercase">Wait</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

      {/* STEP 5: Completion Screen */}
      {connectionState === 'Completed' && (
        <div className="p-8 rounded-2xl bg-[#1E293B] border border-white/10 text-center max-w-md mx-auto space-y-6 shadow-xl">
          
          <div className="w-14 h-14 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mx-auto shadow-inner">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Transfer Completed Successfully
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed font-light">
              All files have been successfully sent to the receiver machine.
            </p>
          </div>

          {/* Files Summary list */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-white/5 text-left max-h-[120px] overflow-y-auto space-y-1.5 text-[11px]">
            <div className="text-slate-500 font-bold uppercase tracking-wider">Sent Files:</div>
            {activeFiles.map((f, i) => (
              <div key={i} className="flex justify-between items-center gap-2">
                <span className="text-slate-300 truncate font-semibold">{f.name}</span>
                <span className="text-slate-500 shrink-0 font-mono">{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1 w-full">
            <button
              onClick={resetPage}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Send Another
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            
            <Link href="/" className="w-full sm:w-auto" onClick={resetPage}>
              <button
                className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 text-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <HomeIcon className="w-3.5 h-3.5" />
                Go Home
              </button>
            </Link>
          </div>
        </div>
      )}

    </div>
  );
}
