'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { transferManager } from '@/utils/webrtc';
import { formatBytes, formatSpeed, formatTime } from '@/utils/format';
import { motion, AnimatePresence } from 'framer-motion';
import { Html5Qrcode } from 'html5-qrcode';
import confetti from 'canvas-confetti';
import {
  Download,
  Key,
  Camera,
  Loader2,
  CheckCircle2,
  AlertCircle,
  XCircle,
  User,
  FolderOpen,
  File as FileIcon,
  Video,
  Image as ImageIcon,
  FileArchive,
  Music,
  FileText,
  Check,
  X,
  RefreshCw,
  Copy,
  Home as HomeIcon,
  ArrowRight,
  Zap,
  Activity
} from 'lucide-react';

function ReceivePageContent() {
  const searchParams = useSearchParams();
  const {
    displayName,
    connectionState,
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
    setErrorMsg,
  } = useStore();

  const [inputRoomId, setInputRoomId] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [showScanner, setShowScanner] = useState<boolean>(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  
  // Manual SDP states for offline fallback
  const [showManual, setShowManual] = useState<boolean>(false);
  const [manualOffer, setManualOffer] = useState<string>('');
  const [manualAnswer, setManualAnswer] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingAnswer, setIsGeneratingAnswer] = useState<boolean>(false);

  const qrScannerRef = useRef<Html5Qrcode | null>(null);

  // Check URL query parameters for ?room=XXXXXX on load
  useEffect(() => {
    const roomParam = searchParams.get('room');
    if (roomParam && roomParam.length === 6) {
      setInputRoomId(roomParam);
      handleConnect(roomParam);
    }
  }, [searchParams]);

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
      stopScanner();
      transferManager.cleanUp();
      useStore.getState().resetTransfer();
    };
  }, []);

  const handleConnect = async (targetRoomId: string) => {
    const code = targetRoomId || inputRoomId;
    if (code.length !== 6) {
      setErrorMsg('Please enter a valid 6-digit connection code');
      return;
    }

    setIsConnecting(true);
    setErrorMsg(null);
    stopScanner();

    try {
      await transferManager.initialize(false, code);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to connect');
    } finally {
      setIsConnecting(false);
    }
  };

  const startScanner = async () => {
    setScannerError(null);
    setShowScanner(true);

    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode('qr-reader');
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 220, height: 220 },
          },
          (decodedText) => {
            let code = decodedText;
            if (decodedText.includes('/receive?room=')) {
              const url = new URL(decodedText);
              code = url.searchParams.get('room') || '';
            }

            if (code.length === 6) {
              setInputRoomId(code);
              handleConnect(code);
              stopScanner();
            } else {
              setScannerError('Scanned QR code does not contain a valid DirectShare link');
            }
          },
          () => {}
        );
      } catch (err: any) {
        console.error('Camera access failed:', err);
        setScannerError('Failed to access camera. Please check permissions.');
        setShowScanner(false);
      }
    }, 100);
  };

  const stopScanner = async () => {
    if (qrScannerRef.current && qrScannerRef.current.isScanning) {
      try {
        await qrScannerRef.current.stop();
      } catch (e) {
        console.error(e);
      }
    }
    qrScannerRef.current = null;
    setShowScanner(false);
  };

  const handleAcceptTransfer = () => {
    transferManager.acceptTransfer(true);
  };

  const handleRejectTransfer = () => {
    transferManager.acceptTransfer(false);
  };

  const handleGenerateManualAnswer = async () => {
    if (!manualOffer) return;
    setIsGeneratingAnswer(true);
    setErrorMsg(null);
    try {
      const answer = await transferManager.acceptManualOffer(manualOffer);
      setManualAnswer(answer);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to accept offer SDP');
    } finally {
      setIsGeneratingAnswer(false);
    }
  };

  const copyAnswerToClipboard = () => {
    navigator.clipboard.writeText(manualAnswer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetPage = () => {
    transferManager.cleanUp();
    useStore.getState().resetTransfer();
  };

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
    <div className="max-w-5xl mx-auto space-y-8 py-4 px-2 sm:px-4 relative z-10">
      
      {/* Page Header */}
      {connectionState !== 'Completed' && connectionState !== 'Connected' && connectionState !== 'Receiving' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">Receive Files</h1>
            <p className="text-slate-400 text-sm mt-1">Connect and accept direct P2P file transfers from nearby devices</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-slate-300 w-fit">
            <Activity className="w-3.5 h-3.5 text-secondary animate-pulse" />
            <span>Receiver Mode Active</span>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-400 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Error:</span> {errorMsg}
          </div>
        </div>
      )}

      {/* STEP 1: Enter Room Code / Scanning View */}
      {connectionState === 'Waiting' && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Main Join Panel */}
          <div className="md:col-span-2 glass-panel p-8 border border-white/10 shadow-lg space-y-6">
            <h2 className="text-lg font-bold text-slate-200">Connect to Sender</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-light">
              Enter the 6-digit connection room code displayed on the sender machine or scan their QR code to pair the devices.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow">
                <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-Digit Code"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-900/60 rounded-2xl border border-white/10 hover:border-white/20 focus:border-primary/50 text-slate-200 placeholder-slate-500 font-bold tracking-widest text-lg focus:outline-none transition-colors"
                />
              </div>

              <button
                onClick={() => handleConnect('')}
                disabled={inputRoomId.length !== 6 || isConnecting}
                className="px-6 py-3.5 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Connecting
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" /> Connect
                  </>
                )}
              </button>

              <button
                onClick={showScanner ? stopScanner : startScanner}
                className="px-5 py-3.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-secondary" /> Scan QR
              </button>
            </div>

            {/* Scanner Container */}
            <AnimatePresence>
              {showScanner && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-4 border border-white/10 bg-slate-950/65 p-5 rounded-2xl relative overflow-hidden"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                      Align QR Code in Window
                    </span>
                    <button
                      onClick={stopScanner}
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  {scannerError && (
                    <div className="p-3 text-xs rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                      {scannerError}
                    </div>
                  )}
                  <div className="flex justify-center">
                    <div
                      id="qr-reader"
                      className="w-[260px] h-[260px] border border-white/10 rounded-2xl overflow-hidden shadow-lg shadow-black/45 bg-black relative"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Offline manual connection option toggle */}
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
                  <h3 className="text-sm font-bold text-slate-300">1. Paste Sender SDP Offer</h3>
                  <p className="text-xs text-slate-400">
                    Paste the handshake package generated by the sender device below.
                  </p>
                  <textarea
                    placeholder="Paste sender offer SDP JSON here..."
                    value={manualOffer}
                    onChange={(e) => setManualOffer(e.target.value)}
                    className="w-full text-[10px] font-mono p-3 bg-slate-950/80 rounded-xl border border-white/10 resize-none h-[80px]"
                  />
                  <button
                    onClick={handleGenerateManualAnswer}
                    disabled={!manualOffer || isGeneratingAnswer}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingAnswer && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Generate Answer SDP
                  </button>
                </div>

                {manualAnswer && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-300">2. Copy & Send Local SDP Answer</h3>
                    <p className="text-xs text-slate-400">
                      Copy this generated response SDP and paste it on the sender device to finish connecting.
                    </p>
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={manualAnswer}
                        className="w-full text-[10px] font-mono p-3 bg-slate-950/80 rounded-xl border border-white/10 resize-none h-[80px]"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                      <button
                        onClick={copyAnswerToClipboard}
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
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Identity instructions */}
          <div className="glass-panel p-6 rounded-3xl border border-white/10 h-fit space-y-4 text-slate-300">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instructions</h3>
            <ul className="text-xs space-y-3 list-none">
              <li className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-secondary shrink-0 mt-0.5">1</span>
                <span>Ensure both machines are connected to the same LAN or hotspot network.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-secondary shrink-0 mt-0.5">2</span>
                <span>Wait for the sender to select their files and share the connection code.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="w-5 h-5 rounded-md bg-white/5 border border-white/10 flex items-center justify-center text-[10px] font-bold text-secondary shrink-0 mt-0.5">3</span>
                <span>Approve the incoming request list. Files stream and assemble directly in IndexedDB browser memory.</span>
              </li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* STEP 2: Connecting / ICE handshake loading */}
      {(connectionState === 'Connecting' || (connectionState === 'Connected' && activeFiles.length === 0)) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-10 border border-white/10 text-center max-w-md mx-auto space-y-5"
        >
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto animate-pulse-slow">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
          <h2 className="text-lg font-bold text-slate-200">
            {connectionState === 'Connected' ? 'Retrieving File Metadata' : 'Connecting to Sender'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-light leading-relaxed">
            {connectionState === 'Connected'
              ? 'Data channel opened. Awaiting incoming files list description packet...'
              : 'P2P WebRTC ICE candidates are exchanging. Establishing direct socket stream connection...'}
          </p>
          <button
            onClick={resetPage}
            className="px-4 py-2 border border-white/10 hover:border-red-500/20 hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-xs font-bold rounded-xl transition-all cursor-pointer mt-2"
          >
            Cancel
          </button>
        </motion.div>
      )}

      {/* STEP 3: Transfer approval modal dialog */}
      {connectionState === 'Receiving' && activeFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 border border-white/10 max-w-2xl mx-auto space-y-6 shadow-2xl relative"
        >
          <div className="flex items-center gap-3.5 border-b border-white/10 pb-4">
            <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <User className="w-5.5 h-5.5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-200">Incoming Files Invitation</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                From: <span className="font-bold text-slate-200 font-mono">{peerName || 'Sender Device'}</span>
              </p>
            </div>
          </div>

          <div className="space-y-4.5">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Files to Receive ({activeFiles.length})
            </span>
            
            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {activeFiles.map((file) => {
                const Icon = getFileIcon(file.type);
                const colorClass = getFileIconColor(file.type);
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3.5 rounded-3xl bg-slate-900/40 border border-white/5 shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2.5 rounded-xl border ${colorClass} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-200 truncate">{file.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 font-mono">{formatBytes(file.size)}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-xs sm:text-sm text-slate-400 bg-slate-900/60 p-4 rounded-2xl border border-white/10 flex items-center justify-between font-mono">
              <span className="font-sans text-slate-500 font-semibold">Aggregate Size:</span>
              <span className="font-bold text-slate-200">
                {formatBytes(activeFiles.reduce((acc, f) => acc + f.size, 0))}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
            <button
              onClick={handleRejectTransfer}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-white/10 hover:bg-red-500/10 hover:text-red-400 text-slate-400 font-semibold text-sm transition-colors cursor-pointer text-center"
            >
              Reject
            </button>
            <button
              onClick={handleAcceptTransfer}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold text-sm shadow-lg shadow-blue-500/10 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Accept & Receive
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 4: Active Receive progress stats (Transfer Screen) */}
      {((connectionState === 'Connected' && activeFiles.length > 0) ||
        (connectionState === 'Receiving' && activeFiles.length > 0 && !activeFiles.some(f => f.status === 'pending'))) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Progress Visuals Card */}
          <div className="md:col-span-2 space-y-6">
            <div className="glass-panel p-6 border border-white/10 space-y-8 flex flex-col items-center">
              
              {/* Header section */}
              <div className="flex items-center justify-between border-b border-white/10 pb-4 w-full">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-secondary animate-pulse" />
                  <div>
                    <h3 className="font-bold text-slate-200">
                      Receiving from {peerName || 'Peer'}
                    </h3>
                    <p className="text-xs text-slate-400">
                      Average Speed: {formatSpeed(transferSpeed)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => transferManager.cancel()}
                  className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-red-500/10 text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer"
                  title="Cancel Transfer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Ring */}
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
                    className="stroke-secondary fill-none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 85}
                    animate={{ strokeDashoffset: (2 * Math.PI * 85) - (transferProgress / 100) * (2 * Math.PI * 85) }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                  />
                </svg>
                
                {/* Central percentage stats */}
                <div className="absolute flex flex-col items-center justify-center text-center space-y-1">
                  <span className="text-4xl font-black text-white font-mono">{transferProgress}%</span>
                  <span className="text-xs text-secondary font-bold tracking-wide flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5 fill-current animate-bounce" />
                    {formatSpeed(transferSpeedCurrent)}
                  </span>
                </div>
              </div>

              {/* Grid Dashboard */}
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
                    Time Left
                  </span>
                  <p className="text-sm font-extrabold text-slate-200">
                    {formatTime(remainingTime)}
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Progress
                  </span>
                  <p className="text-sm font-extrabold text-slate-200 font-mono">
                    {transferProgress}%
                  </p>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Finished
                  </span>
                  <p className="text-sm font-extrabold text-slate-200">
                    {activeFiles.filter(f => f.status === 'completed').length} / {activeFiles.length}
                  </p>
                </div>
              </div>

              {/* Current Active File Info */}
              <div className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center gap-3">
                <div className="p-2.5 bg-secondary/10 border border-secondary/20 text-secondary rounded-xl shrink-0">
                  <FileIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-grow">
                  <div className="text-xs text-slate-400 font-medium">Currently Downloading</div>
                  <div className="text-sm font-semibold text-slate-200 truncate mt-0.5">
                    {activeFiles.find(f => f.status === 'transferring')?.name || 'Assembling chunks...'}
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

          {/* Right side: File queue showing progress */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">File Queue</h3>
            <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
              {activeFiles.map((file) => {
                const Icon = getFileIcon(file.type);
                const colorClass = getFileIconColor(file.type);
                return (
                  <div
                    key={file.id}
                    className="p-3.5 rounded-3xl bg-white/5 border border-white/10 space-y-3 relative overflow-hidden shadow-sm animate-fade-in"
                  >
                    <div
                      className="absolute bottom-0 left-0 h-1 bg-secondary/20 transition-all duration-300"
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

                      <div className="text-right shrink-0 font-mono">
                        {file.status === 'completed' ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        ) : file.status === 'transferring' ? (
                          <span className="text-xs font-bold text-secondary">{file.progress}%</span>
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

      {/* STEP 5: Success Completion Screen */}
      {connectionState === 'Completed' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', damping: 20 }}
          className="glass-panel p-10 rounded-3xl border border-white/10 text-center max-w-xl mx-auto space-y-8 shadow-2xl relative overflow-hidden"
        >
          {/* Glowing purple bubble */}
          <div className="absolute right-[-100px] top-[-100px] w-48 h-48 bg-glow-purple pointer-events-none rounded-full" />

          <div className="relative space-y-6">
            
            {/* Scaling check circle */}
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
                All incoming files have been successfully received, verified, and saved to your device.
              </p>
            </div>

            {/* Files list summary */}
            <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 text-left max-h-[140px] overflow-y-auto space-y-2.5 text-xs">
              <div className="text-slate-500 font-bold uppercase tracking-wider">Received Files Summary:</div>
              {activeFiles.map((f, i) => (
                <div key={i} className="flex justify-between items-center gap-2">
                  <span className="text-slate-300 truncate font-medium">{f.name}</span>
                  <span className="text-slate-500 shrink-0 font-mono">{formatBytes(f.size)}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                onClick={resetPage}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-sm font-bold text-white bg-primary hover:bg-blue-600 shadow-md shadow-blue-500/10 transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                Receive More Files
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

export default function ReceivePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        Loading receiver page content...
      </div>
    }>
      <ReceivePageContent />
    </Suspense>
  );
}
