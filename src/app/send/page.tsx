'use client';

import { useEffect, useState, useRef } from 'react';
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

      // Automatically clean up and return to initial state after 4 seconds
      const timeoutId = setTimeout(() => {
        transferManager.cleanUp();
        useStore.getState().resetTransfer();
        window.location.reload();
      }, 4000);

      return () => clearTimeout(timeoutId);
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
      setSelectedFiles(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      setSelectedFiles(files);
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
      // Setup WebRTC and output local SDP Offer
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

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Send Files</h1>
          <p className="text-slate-400 text-sm mt-1">Select files to transfer directly over the local network</p>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <span className="font-semibold">Error:</span> {errorMsg}
          </div>
        </div>
      )}

      {/* STEP 1: File Upload Box */}
      {selectedFiles.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-2 border-dashed border-white/10 hover:border-primary/40 rounded-3xl p-12 text-center bg-slate-800/15 cursor-pointer hover:bg-slate-800/25 transition-all duration-300 group"
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
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-white/5 flex items-center justify-center text-slate-400 group-hover:scale-110 group-hover:text-primary transition-all duration-300">
              <Upload className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-200">Drag & drop files here, or browse</p>
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
            <h2 className="text-lg font-bold text-slate-300">Selected Files ({selectedFiles.length})</h2>
            <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
              {selectedFiles.map((file, i) => {
                const Icon = getFileIcon(file.type);
                const colorClass = getFileIconColor(file.type);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl border ${colorClass} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">{file.name}</p>
                        <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1.5 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/20 border border-white/5">
              <div className="text-sm">
                <span className="text-slate-400">Total Size:</span>{' '}
                <span className="font-semibold text-slate-200">
                  {formatBytes(selectedFiles.reduce((acc, f) => acc + f.size, 0))}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedFiles([])}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  Clear All
                </button>
                <button
                  onClick={startTransfer}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:bg-blue-600 shadow-md shadow-blue-500/10 transition-colors cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                  Connect & Share
                </button>
              </div>
            </div>
          </div>

          {/* Quick instructions / Display identity */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/5 h-fit">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Instructions</h3>
            <ul className="text-xs text-slate-300 space-y-2.5 list-disc list-inside">
              <li>Keep both devices connected to the same local Wi-Fi or hotspot network.</li>
              <li>Open DirectShare on the receiver device and select "Receive Files".</li>
              <li>Wait for the connection to establish directly peer-to-peer.</li>
              <li>Do not close this tab during the transfer.</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* STEP 3: Connecting / Discovery Panel */}
      {selectedFiles.length > 0 &&
        (connectionState === 'Discovering' || connectionState === 'Connecting' || connectionState === 'Connected') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-panel p-8 rounded-3xl border border-white/5 text-center max-w-2xl mx-auto space-y-8"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary animate-pulse-slow">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-100">
                {connectionState === 'Connected' ? 'Connected!' : 'Waiting for Connection'}
              </h2>
              <p className="text-sm text-slate-400">
                {connectionState === 'Connected'
                  ? `Connected to ${peerName || 'Receiver'}. Waiting for them to approve and accept the files...`
                  : 'To receive files, scan the QR code or enter the code on the receiving device'}
              </p>
            </div>

            {/* Room Code view */}
            {!showManual && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 items-center bg-slate-900/40 p-6 rounded-2xl border border-white/5">
                <div className="space-y-4 text-left">
                  <div className="space-y-1">
                    <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                      6-Digit Connection Code
                    </span>
                    <div className="text-4xl sm:text-5xl font-black letter tracking-widest bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent py-1">
                      {roomId || '......'}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">
                    Make sure the receiver device is on the same local network, opens the Receive page, and enters this code.
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-white p-2.5 rounded-2xl shadow-xl w-fit">
                    {qrCodeUrl ? (
                      <img src={qrCodeUrl} alt="Receiver QR Code" className="w-[160px] h-[160px]" />
                    ) : (
                      <div className="w-[160px] h-[160px] bg-slate-800 animate-pulse rounded-lg" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                    <QrCode className="w-3.5 h-3.5 text-primary" /> Scan to join instantly
                  </span>
                </div>
              </div>
            )}

            {/* Offline manual connection toggle */}
            <div className="border-t border-white/5 pt-6">
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
                className="space-y-6 text-left border border-white/5 bg-slate-900/30 p-6 rounded-2xl"
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
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/5 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                    >
                      {isGeneratingManual && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Generate Offer SDP
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={manualOffer}
                        className="w-full text-[10px] font-mono p-3 bg-slate-950/80 rounded-xl border border-white/5 resize-none h-[80px]"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                      <button
                        onClick={copyToClipboard}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/5 transition-colors flex flex-col items-center justify-center shrink-0 w-16 gap-1 cursor-pointer"
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
                    className="w-full text-[10px] font-mono p-3 bg-slate-950/80 rounded-xl border border-white/5 resize-none h-[80px]"
                  />
                  <button
                    onClick={handleConnectManual}
                    disabled={!manualAnswer}
                    className="px-4 py-2 bg-primary hover:bg-blue-600 text-white text-xs font-bold rounded-xl shadow-md transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    Connect Manually
                  </button>
                </div>
              </motion.div>
            )}

            <button
              onClick={() => transferManager.cancel()}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all cursor-pointer"
            >
              Cancel Transfer
            </button>
          </motion.div>
        )}

      {/* STEP 4: Active Sending Progress / Metrics Panel */}
      {selectedFiles.length > 0 &&
        (connectionState === 'Sending' ||
          connectionState === 'Paused' ||
          connectionState === 'Completed') && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-6"
          >
            {/* Left side: stats and progress bar */}
            <div className="md:col-span-2 space-y-6">
              <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-3.5 h-3.5 rounded-full ${
                        connectionState === 'Completed'
                          ? 'bg-emerald-400'
                          : connectionState === 'Paused'
                          ? 'bg-amber-400'
                          : 'bg-primary animate-pulse'
                      }`}
                    />
                    <div>
                      <h3 className="font-bold text-slate-200">
                        {connectionState === 'Completed'
                          ? 'Transfer Completed!'
                          : connectionState === 'Paused'
                          ? 'Transfer Paused'
                          : `Sending to ${peerName || 'Peer'}`}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {connectionState === 'Completed'
                          ? 'All files successfully sent'
                          : `${formatSpeed(transferSpeed)} average speed`}
                      </p>
                    </div>
                  </div>

                  {connectionState !== 'Completed' && (
                    <div className="flex items-center gap-2">
                      {connectionState === 'Sending' ? (
                        <button
                          onClick={() => transferManager.pause()}
                          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                          title="Pause Transfer"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                      ) : (
                        <button
                          onClick={() => transferManager.resume()}
                          className="p-2 rounded-xl bg-primary hover:bg-blue-600 text-white transition-colors cursor-pointer"
                          title="Resume Transfer"
                        >
                          <Play className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => transferManager.cancel()}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/10 cursor-pointer"
                        title="Cancel Transfer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Progress Visuals */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>Overall Progress</span>
                    <span className="text-primary">{transferProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-white/5">
                    <motion.div
                      className="bg-gradient-to-r from-primary to-secondary h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${transferProgress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                {/* Grid stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Current Speed
                    </span>
                    <p className="text-sm sm:text-base font-extrabold text-slate-200">
                      {formatSpeed(transferSpeedCurrent)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Avg / Peak Speed
                    </span>
                    <p className="text-sm sm:text-base font-extrabold text-slate-200 truncate">
                      {formatSpeed(transferSpeed)} / {formatSpeed(transferSpeedPeak)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Time Left
                    </span>
                    <p className="text-sm sm:text-base font-extrabold text-slate-200">
                      {connectionState === 'Completed' ? 'Finished' : formatTime(remainingTime)}
                    </p>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-1">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                      Status
                    </span>
                    <p className="text-sm sm:text-base font-extrabold text-slate-200">
                      {connectionState}
                    </p>
                  </div>
                </div>

                {connectionState === 'Completed' && (
                  <button
                    onClick={() => {
                      transferManager.cleanUp();
                      useStore.getState().resetTransfer();
                    }}
                    className="w-full py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-sm transition-colors border border-white/5 cursor-pointer"
                  >
                    Share More Files
                  </button>
                )}
              </div>
            </div>

            {/* Right side: File queue list showing progress */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">File Queue</h3>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                {activeFiles.map((file) => {
                  const Icon = getFileIcon(file.type);
                  const colorClass = getFileIconColor(file.type);
                  return (
                    <div
                      key={file.id}
                      className="p-3.5 rounded-2xl bg-slate-800/60 border border-white/5 space-y-3 relative overflow-hidden"
                    >
                      {/* Background progress fill */}
                      <div
                        className="absolute bottom-0 left-0 h-1 bg-primary/20 transition-all duration-300"
                        style={{ width: `${file.progress}%` }}
                      />

                      <div className="flex items-center justify-between min-w-0 gap-3 relative z-10">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`p-2.5 rounded-xl border ${colorClass} shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-200 truncate">{file.name}</p>
                            <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {file.status === 'completed' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                          ) : file.status === 'transferring' ? (
                            <span className="text-xs font-bold text-primary">{file.progress}%</span>
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
    </div>
  );
}
