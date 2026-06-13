'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { transferManager } from '@/utils/webrtc';
import { formatBytes, formatSpeed, formatTime } from '@/utils/format';
import { motion, AnimatePresence } from 'framer-motion';
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
  Share2,
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
  const [filePreviews, setFilePreviews] = useState<Record<string, string>>({});

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

  // Generate local file image previews
  useEffect(() => {
    const newPreviews: Record<string, string> = {};
    selectedFiles.forEach((file) => {
      if (file.type.startsWith('image/')) {
        newPreviews[file.name] = URL.createObjectURL(file);
      }
    });
    setFilePreviews((prev) => {
      // Clean up previous URLs to avoid memory leaks
      Object.values(prev).forEach((url) => URL.revokeObjectURL(url));
      return newPreviews;
    });

    return () => {
      Object.values(newPreviews).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [selectedFiles]);

  // Play celebration confetti on completion
  useEffect(() => {
    if (connectionState === 'Completed') {
      const duration = 3 * 1000;
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

  // Math helper for current chunk calculations
  const getChunkStats = () => {
    const presetSizeMap = { '128KB': 128 * 1024, '256KB': 256 * 1024, '512KB': 512 * 1024, '1MB': 1024 * 1024 };
    const chunkSize = presetSizeMap[chunkSizePreset] || 256 * 1024;
    
    // Find first active transferring file
    const activeFile = activeFiles.find(f => f.status === 'transferring');
    if (!activeFile) return { current: 0, total: 0 };
    
    const total = Math.ceil(activeFile.size / chunkSize);
    const current = Math.min(total, Math.ceil((activeFile.progress / 100) * total));
    return { current, total };
  };

  const { current: currentChunk, total: totalChunks } = getChunkStats();

  return (
    <div className="max-w-5xl mx-auto space-y-8 py-4 px-2 sm:px-4 relative z-10">
      
      {/* Page Header */}
      {connectionState !== 'Completed' && connectionState !== 'Sending' && connectionState !== 'Paused' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Send Files</h1>
            <p className="text-slate-400 text-sm mt-1">Select files to transfer directly over the local network</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 w-fit">
            <Activity className="w-3.5 h-3.5 text-primary" />
            <span>LAN Mode Active</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm animate-pulse-slow">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Transfer Error:</span> {errorMsg}
          </div>
        </div>
      )}

      {/* STEP 1: File Upload Box */}
      {selectedFiles.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-dashed border-white/10 hover:border-primary/45 rounded-3xl p-12 text-center bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all duration-300 group shadow-lg"
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
          <div className="flex flex-col items-center gap-5">
            <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:text-primary group-hover:border-primary/30 transition-all duration-300 shadow-md">
              <Upload className="w-8 h-8 group-hover:-translate-y-1 transition-transform" />
            </div>
            <div className="space-y-1.5">
              <p className="text-base sm:text-lg font-bold text-slate-200">Drag & drop files here, or click to browse</p>
              <p className="text-xs text-slate-500">Supports images, videos, documents, and files up to 10GB+</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* STEP 2: Selected Files and Discovery */}
      {selectedFiles.length > 0 && connectionState === 'Waiting' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* File list */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-300">Selected Files ({selectedFiles.length})</h2>
              <button
                onClick={() => setSelectedFiles([])}
                className="text-xs font-semibold text-red-400 hover:text-red-300 transition-colors flex items-center gap-1 cursor-pointer"
              >
                Clear all
              </button>
            </div>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {selectedFiles.map((file, i) => {
                const Icon = getFileIcon(file.type);
                const colorClass = getFileIconColor(file.type);
                const isImage = file.type.startsWith('image/');
                const previewUrl = filePreviews[file.name];

                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-3xl bg-white/5 border border-white/10 hover:border-white/20 transition-all duration-200 shadow-sm"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {isImage && previewUrl ? (
                        <div className="w-11 h-11 rounded-xl overflow-hidden border border-white/10 shrink-0 bg-slate-950">
                          <img src={previewUrl} alt={file.name} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className={`p-3 rounded-xl border ${colorClass} shrink-0 shadow-inner`}>
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                      )}
                      
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-2 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-3xl bg-white/[0.02] border border-white/10 gap-4">
              <div className="text-sm text-center sm:text-left">
                <span className="text-slate-400">Total size to transfer:</span>{' '}
                <span className="font-extrabold text-slate-100 font-mono">
                  {formatBytes(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
                </span>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    fileInputRef.current?.click();
                  }}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 transition-colors cursor-pointer text-center"
                >
                  Add Files
                </button>
                <button
                  onClick={startTransfer}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-xs sm:text-sm font-bold text-white bg-primary hover:bg-blue-600 shadow-lg shadow-blue-500/10 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Connect & Share
                </button>
              </div>
            </div>
          </div>

          {/* Quick instructions / Display identity */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 h-fit space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instructions</h3>
            <ul className="text-xs text-slate-300 space-y-3 list-none">
              <li className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">1</span>
                <span>Connect both devices to the same local Wi-Fi router or hotspot.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">2</span>
                <span>Open DirectShare on the receiving device and select <strong>Receive Files</strong>.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 mt-0.5">3</span>
                <span>The connection establishes directly peer-to-peer. Keep this browser window active during the transfer.</span>
              </li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* STEP 3: Connecting / Discovery Panel (Radar Connection Screen) */}
      {selectedFiles.length > 0 &&
        (connectionState === 'Discovering' || connectionState === 'Connecting' || connectionState === 'Connected') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-8 rounded-3xl border border-white/10 text-center max-w-2xl mx-auto space-y-8"
          >
            {/* Pulsing connection radar animation */}
            <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
              {/* Radar waves */}
              <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: '3s' }} />
              <div className="absolute inset-4 rounded-full border border-primary/30 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.8s' }} />
              <div className="absolute inset-8 rounded-full border border-secondary/20 animate-ping" style={{ animationDuration: '2s', animationDelay: '1.4s' }} />
              
              {/* Center icon */}
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-secondary flex items-center justify-center text-white shadow-xl shadow-primary/20">
                <Share2 className="w-9 h-9 animate-pulse" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                {connectionState === 'Connected' ? (
                  <>Connected to Peer</>
                ) : (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    {connectionState === 'Connecting' ? 'Connecting...' : 'Searching...'}
                  </>
                )}
              </h2>
              <p className="text-sm text-slate-400 max-w-md">
                {connectionState === 'Connected'
                  ? `Waiting for ${peerName || 'receiver'} to accept the file transfer request...`
                  : 'Establish connection by scanning the QR code or keying in the room code below.'}
              </p>
            </div>

            {/* Room Code view */}
            {!showManual && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center bg-slate-900/60 p-6 rounded-2xl border border-white/5 text-left">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Connection Room Code
                    </span>
                    <div className="text-4xl sm:text-5xl font-black tracking-widest bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent py-1">
                      {roomId || '......'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed font-light">
                    On the receiver machine, input this 6-digit code or navigate to this tab to link instantly.
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-2.5">
                  <div className="bg-white p-3 rounded-2xl shadow-xl w-fit">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Receiver QR Code" className="w-[150px] h-[150px]" />
                    ) : (
                      <div className="w-[150px] h-[150px] bg-slate-800 animate-pulse rounded-xl" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 bg-white/5 px-2 py-1 rounded-md border border-white/10">
                    <QrCode className="w-3.5 h-3.5 text-primary" /> Scan to join instantly
                  </span>
                </div>
              </div>
            )}

            {/* Offline manual connection toggle */}
            <div className="border-t border-white/10 pt-6">
              <button
                onClick={() => setShowManual(!showManual)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-1.5 mx-auto cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {showManual ? 'Show Room Connection Info' : 'Try Fully Offline Connection (No Signaling Server)'}
              </button>
            </div>

            {/* Manual SDP exchange blocks */}
            {showManual && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-6 text-left border border-white/10 bg-slate-900/40 p-6 rounded-2xl"
              >
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-300">1. Generate & Copy Local SDP Offer</h3>
                  <p className="text-xs text-slate-400">
                    This generated handshake package contains the connection credentials.
                  </p>
                  {!manualOffer ? (
                    <button
                      onClick={handleGenerateManualOffer}
                      disabled={isGeneratingManual}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isGeneratingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Generate Offer SDP
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={manualOffer}
                        className="w-full text-[10px] font-mono p-3 bg-slate-950/80 rounded-xl border border-white/10 resize-none h-[80px]"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                      <button
                        onClick={copyToClipboard}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition-colors flex flex-col items-center justify-center shrink-0 w-16 gap-1 cursor-pointer"
                      >
                        {copied ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-400" />
                            <span className="text-[10px] text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span className="text-[10px]">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-slate-300">2. Paste Receiver SDP Answer</h3>
                  <p className="text-xs text-slate-400">
                    Paste the handshake response generated by the receiver device below to connect.
                  </p>
                  <textarea
                    placeholder="Paste receiver answer SDP JSON here..."
                    value={manualAnswer}
                    onChange={(e) => setManualAnswer(e.target.value)}
                    className="w-full text-[10px] font-mono p-3 bg-slate-950/80 rounded-xl border border-white/10 resize-none h-[80px]"
                  />
                  <button
                    onClick={handleConnectManual}
                    disabled={!manualAnswer}
                    className="px-5 py-2.5 bg-primary hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Connect Manually
                  </button>
                </div>
              </motion.div>
            )}

            <div className="flex justify-center w-full pt-4">
              <button
                onClick={resetPage}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl text-xs font-bold text-slate-400 hover:text-red-400 hover:bg-red-500/10 border border-white/10 hover:border-red-500/20 transition-all cursor-pointer"
              >
                Cancel Transfer
              </button>
            </div>
          </motion.div>
        )}

      {/* STEP 4: Active Sending Progress / Metrics Panel (Transfer Screen) */}
      {selectedFiles.length > 0 &&
        (connectionState === 'Sending' || connectionState === 'Paused') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Left side: circular progress stats */}
            <div className="md:col-span-2 space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-white/10 space-y-8 flex flex-col items-center">
                
                {/* Header status bar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-4 w-full">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3 h-3 rounded-full ${
                        connectionState === 'Paused'
                          ? 'bg-amber-400'
                          : 'bg-primary animate-pulse'
                      }`}
                    />
                    <div>
                      <h3 className="font-bold text-slate-200">
                        {connectionState === 'Paused'
                          ? 'Transfer Paused'
                          : `Sending to ${peerName || 'Peer'}`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Average Speed: {formatSpeed(transferSpeed)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {connectionState === 'Sending' ? (
                      <button
                        onClick={() => transferManager.pause()}
                        className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
                        title="Pause Transfer"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => transferManager.resume()}
                        className="p-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white transition-colors cursor-pointer"
                        title="Resume Transfer"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => transferManager.cancel()}
                      className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-colors cursor-pointer"
                      title="Cancel Transfer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* SVG Progress Circle */}
                <div className="relative w-56 h-56 flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 200 200">
                    {/* Background Circle */}
                    <circle
                      cx="100"
                      cy="100"
                      r="85"
                      className="stroke-slate-800 fill-none"
                      strokeWidth="10"
                    />
                    {/* Progress Circle with Gradient */}
                    <motion.circle
                      cx="100"
                      cy="100"
                      r="85"
                      className="stroke-primary fill-none"
                      strokeWidth="10"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 85}
                      animate={{ strokeDashoffset: (2 * Math.PI * 85) - (transferProgress / 100) * (2 * Math.PI * 85) }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </svg>
                  
                  {/* Central Text Metrics */}
                  <div className="absolute flex flex-col items-center justify-center text-center space-y-1">
                    <span className="text-4xl font-black text-white font-mono">{transferProgress}%</span>
                    <span className="text-xs text-primary font-bold tracking-wide flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 fill-current" />
                      {formatSpeed(transferSpeedCurrent)}
                    </span>
                  </div>
                </div>

                {/* Secondary Metrics details dashboard */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full text-center">
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Speed Peak
                    </span>
                    <p className="text-sm font-extrabold text-slate-200">
                      {formatSpeed(transferSpeedPeak)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Remaining
                    </span>
                    <p className="text-sm font-extrabold text-slate-200">
                      {formatTime(remainingTime)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      File Chunk
                    </span>
                    <p className="text-xs font-extrabold text-slate-200 truncate">
                      {currentChunk} / {totalChunks}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Queue Info
                    </span>
                    <p className="text-sm font-extrabold text-slate-200">
                      {activeFiles.filter(f => f.status === 'completed').length} / {activeFiles.length}
                    </p>
                  </div>
                </div>

                {/* Active Transfer Details banner */}
                <div className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                  <div className="p-2.5 bg-primary/10 border border-primary/20 text-primary rounded-xl shrink-0">
                    <FileIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <div className="text-xs text-slate-400 font-medium">Currently Sending</div>
                    <div className="text-sm font-semibold text-slate-200 truncate mt-0.5">
                      {activeFiles.find(f => f.status === 'transferring')?.name || 'Loading next...'}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-mono text-slate-400 font-semibold">
                      {formatBytes(activeFiles.find(f => f.status === 'transferring')?.size || 0)}
                    </span>
                  </div>
                </div>

              </div>
            </div>

            {/* Right side: File queue list */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">File Queue</h3>
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {activeFiles.map((file) => {
                  const Icon = getFileIcon(file.type);
                  const colorClass = getFileIconColor(file.type);
                  return (
                    <div
                      key={file.id}
                      className="p-3.5 rounded-3xl bg-white/5 border border-white/10 space-y-3 relative overflow-hidden shadow-sm"
                    >
                      {/* Background progress fill overlay */}
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-primary/20 transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />

                      <div className="flex items-center justify-between min-w-0 gap-3 relative z-10">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`p-2.5 rounded-xl border ${colorClass} shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{file.name}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{formatBytes(file.size)}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {file.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : file.status === 'transferring' ? (
                            <span className="text-xs font-bold text-primary font-mono">{file.progress}%</span>
                          ) : file.status === 'paused' ? (
                            <span className="text-xs font-bold text-amber-400 uppercase">Paused</span>
                          ) : (
                            <span className="text-xs text-slate-500 font-semibold uppercase">Pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

      {/* STEP 5: Completion Screen */}
      {connectionState === 'Completed' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="glass-panel p-10 rounded-3xl border border-white/10 text-center max-w-xl mx-auto space-y-8 shadow-2xl relative overflow-hidden"
        >
          {/* Glowing gradient bubble */}
          <div className="absolute right-[-100px] top-[-100px] w-48 h-48 bg-glow-purple pointer-events-none rounded-full" />
          
          <div className="relative space-y-6">
            
            {/* Scaling check animation */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/5"
            >
              <CheckCircle2 className="w-10 h-10 animate-bounce" />
            </motion.div>

            <div className="space-y-2.5">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Transfer Completed Successfully
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed font-light">
                All selected files have been successfully sent to <span className="font-semibold text-slate-200">{peerName || 'receiver device'}</span> directly over the WebRTC network channel.
              </p>
            </div>

            {/* Files Summary list */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 text-left max-h-[140px] overflow-y-auto space-y-2.5 text-xs">
              <div className="text-slate-500 font-bold uppercase tracking-wider">Sent Files Summary:</div>
              {activeFiles.map((f, i) => (
                <div key={i} className="flex justify-between items-center gap-2">
                  <span className="text-slate-300 truncate font-medium">{f.name}</span>
                  <span className="text-slate-500 shrink-0 font-mono">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>

            {/* Action buttons (Full width on mobile) */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={resetPage}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-primary hover:bg-blue-600 shadow-md shadow-blue-500/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                Send Another File
                <ArrowRight className="w-4 h-4" />
              </button>
              
              <Link href="/" className="w-full sm:w-auto" onClick={resetPage}>
                <button
                  className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold border border-white/10 hover:border-white/20 hover:bg-white/5 text-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <HomeIcon className="w-4 h-4" />
                  Go Home
                </button>
              </Link>
            </div>
            
          </div>
        </motion.div>
      )}

    </div>
  );
}
