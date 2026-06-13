'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useStore } from '@/store/useStore';
import { transferManager } from '@/utils/webrtc';
import { formatBytes, formatSpeed, formatTime } from '@/utils/format';
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
    <div className="max-w-4xl mx-auto space-y-6 py-2 px-3 sm:px-4 relative z-10">
      
      {/* Page Header */}
      {connectionState !== 'Completed' && connectionState !== 'Connected' && connectionState !== 'Receiving' && (
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <img src="/ds.png" alt="DirectShare Logo" className="w-8 h-8 object-contain" />
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Receive Files</h1>
              <p className="text-slate-400 text-xs mt-0.5">Accept P2P file transfers</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-300">
            <Activity className="w-3.5 h-3.5 text-secondary" />
            <span>Receiver Mode</span>
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

      {/* STEP 1: Enter Room Code / Scanning View */}
      {connectionState === 'Waiting' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Main Join Panel */}
          <div className="md:col-span-2 p-6 rounded-2xl bg-[#1E293B] border border-white/10 shadow-md space-y-5">
            <h2 className="text-sm font-bold text-slate-200">Connect to Sender</h2>
            <p className="text-xs text-slate-400 font-light leading-relaxed">
              Enter the 6-digit room code shown on the sender device or scan their QR code to start.
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-grow">
                <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="Enter 6-Digit Code"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.replace(/[^0-9]/g, ''))}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-900/60 rounded-xl border border-white/10 text-slate-200 placeholder-slate-500 font-bold tracking-widest text-sm focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <button
                onClick={() => handleConnect('')}
                disabled={inputRoomId.length !== 6 || isConnecting}
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white font-bold text-xs shadow-sm transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Connecting
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" /> Connect
                  </>
                )}
              </button>

              <button
                onClick={showScanner ? stopScanner : startScanner}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-secondary" /> Scan QR
              </button>
            </div>

            {/* Scanner Container */}
            {showScanner && (
              <div className="space-y-3 border border-white/10 bg-slate-950/60 p-4 rounded-xl relative">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    Scan QR Code
                  </span>
                  <button
                    onClick={stopScanner}
                    className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {scannerError && (
                  <div className="p-2.5 text-xs rounded bg-red-500/10 border border-red-500/20 text-red-400">
                    {scannerError}
                  </div>
                )}
                <div className="flex justify-center">
                  <div
                    id="qr-reader"
                    className="w-[200px] h-[200px] border border-white/10 rounded-xl overflow-hidden bg-black relative"
                  />
                </div>
              </div>
            )}

            {/* Offline manual connection option toggle */}
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
                  <h3 className="text-xs font-bold text-slate-300">1. Paste Sender SDP Offer</h3>
                  <textarea
                    placeholder="Paste sender offer SDP JSON here..."
                    value={manualOffer}
                    onChange={(e) => setManualOffer(e.target.value)}
                    className="w-full text-[10px] font-mono p-2 bg-slate-950/80 rounded-lg border border-white/10 resize-none h-[60px]"
                  />
                  <button
                    onClick={handleGenerateManualAnswer}
                    disabled={!manualOffer || isGeneratingAnswer}
                    className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg border border-white/10 transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isGeneratingAnswer && <Loader2 className="w-3 h-3 animate-spin" />}
                    Generate Answer
                  </button>
                </div>

                {manualAnswer && (
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-slate-300">2. Local SDP Answer</h3>
                    <div className="flex gap-2">
                      <textarea
                        readOnly
                        value={manualAnswer}
                        className="w-full text-[10px] font-mono p-2 bg-slate-950/80 rounded-lg border border-white/10 resize-none h-[60px]"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                      <button
                        onClick={copyAnswerToClipboard}
                        className="px-3 py-1.5 bg-slate-800 text-slate-200 text-xs font-bold rounded-lg border border-white/10 transition-colors flex flex-col items-center justify-center shrink-0 w-14 gap-1 cursor-pointer"
                      >
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Identity instructions */}
          <div className="p-5 rounded-2xl bg-[#1E293B] border border-white/10 h-fit space-y-3 text-slate-300">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Instructions</h3>
            <ul className="text-xs space-y-2.5">
              <li className="flex gap-2 items-start">
                <span className="text-secondary font-bold">•</span>
                <span>Both devices must connect to the same Wi-Fi router or local subnet.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-secondary font-bold">•</span>
                <span>Input the 6-digit code or scan the QR code to pair.</span>
              </li>
              <li className="flex gap-2 items-start">
                <span className="text-secondary font-bold">•</span>
                <span>Approve the request list. Data transfers directly peer-to-peer.</span>
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* STEP 2: Connecting / ICE handshake loading */}
      {(connectionState === 'Connecting' || (connectionState === 'Connected' && activeFiles.length === 0)) && (
        <div className="p-8 rounded-2xl bg-[#1E293B] border border-white/10 text-center max-w-md mx-auto space-y-5">
          <div className="relative flex items-center justify-center w-20 h-20 mx-auto">
            <div className="absolute inset-0 rounded-full border border-primary/30 border-t-primary animate-spin" />
            <div className="relative w-16 h-16 rounded-full bg-[#0F172A] border border-white/10 flex items-center justify-center overflow-hidden shadow-inner">
              <img src="/ds.png" alt="DirectShare Logo" className="w-10 h-10 object-contain" />
            </div>
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-200">
            {connectionState === 'Connected' ? 'Retrieving file metadata...' : 'Connecting to Peer...'}
          </h2>
          <p className="text-xs text-slate-400 font-light">
            Exchanging descriptions to establish a direct local socket connection...
          </p>
          <button
            onClick={resetPage}
            className="px-3.5 py-1.5 border border-white/10 hover:border-red-500/20 hover:bg-red-500/10 text-slate-400 hover:text-red-400 text-xs font-semibold rounded-lg transition-colors cursor-pointer mt-1"
          >
            Cancel
          </button>
        </div>
      )}

      {/* STEP 3: Transfer approval modal dialog */}
      {connectionState === 'Receiving' && activeFiles.length > 0 && (
        <div className="p-6 rounded-2xl bg-[#1E293B] border border-white/10 max-w-xl mx-auto space-y-5 shadow-xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-200">Incoming Files Invitation</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                From: <span className="font-bold text-slate-200 font-mono">{peerName || 'Sender'}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Files to Receive ({activeFiles.length})
            </span>
            
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
              {activeFiles.map((file) => {
                const Icon = getFileIcon(file.type);
                const colorClass = getFileIconColor(file.type);
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/40 border border-white/5"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`p-2 rounded-lg border ${colorClass} shrink-0`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate">{file.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 font-mono">{formatBytes(file.size)}</span>
                  </div>
                );
              })}
            </div>

            <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-white/10 flex items-center justify-between font-mono">
              <span className="font-sans text-slate-500 font-semibold">Total size:</span>
              <span className="font-bold text-slate-200">
                {formatBytes(activeFiles.reduce((acc, f) => acc + f.size, 0))}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-1.5">
            <button
              onClick={handleRejectTransfer}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-white/10 hover:bg-red-500/10 hover:text-red-400 text-slate-400 font-semibold text-xs transition-colors cursor-pointer text-center"
            >
              Reject
            </button>
            <button
              onClick={handleAcceptTransfer}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" /> Accept & Receive
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Active Receive progress stats (Lightweight Transfer Screen) */}
      {((connectionState === 'Connected' && activeFiles.length > 0) ||
        (connectionState === 'Receiving' && activeFiles.length > 0 && !activeFiles.some(f => f.status === 'pending'))) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Progress Visuals Card */}
          <div className="md:col-span-2 space-y-4">
            <div className="p-5 rounded-2xl bg-[#1E293B] border border-white/10 space-y-5">
              
              {/* Header section */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">
                      Receiving from {peerName || 'Peer'}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Avg Speed: {formatSpeed(transferSpeed)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => transferManager.cancel()}
                  className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-red-500/10 text-slate-400 hover:text-red-400 hover:border-red-500/20 transition-colors cursor-pointer"
                  title="Cancel"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Lightweight Linear Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 font-mono">
                  <span>Download Progress</span>
                  <span className="text-secondary">{transferProgress}%</span>
                </div>
                <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-white/10">
                  <div
                    className="bg-gradient-to-r from-primary to-secondary h-full rounded-full transition-all duration-300"
                    style={{ width: `${transferProgress}%` }}
                  />
                </div>
              </div>

              {/* Grid Dashboard */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                    Speed
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-200 font-mono mt-0.5">
                    {formatSpeed(transferSpeedCurrent)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                    Peak Speed
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-200 font-mono mt-0.5">
                    {formatSpeed(transferSpeedPeak)}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                    Remaining
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                    {formatTime(remainingTime).replace(' remaining', '')}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-900/40 border border-white/5">
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider block">
                    Saved
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                    {activeFiles.filter(f => f.status === 'completed').length}/{activeFiles.length}
                  </p>
                </div>
              </div>

              {/* Current Active File Info */}
              <div className="p-3 rounded-xl bg-white/[0.01] border border-white/10 flex items-center justify-between text-xs">
                <div className="min-w-0 flex-grow pr-3">
                  <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Downloading</span>
                  <span className="text-slate-200 font-semibold truncate block mt-0.5">
                    {activeFiles.find(f => f.status === 'transferring')?.name || 'Assembling chunks...'}
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

          {/* Right side: File queue showing progress */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">Queue</h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {activeFiles.map((file) => {
                const Icon = getFileIcon(file.type);
                const colorClass = getFileIconColor(file.type);
                return (
                  <div
                    key={file.id}
                    className="p-2.5 rounded-xl bg-white/5 border border-white/10 space-y-2 relative overflow-hidden shadow-sm animate-fade-in"
                  >
                    <div
                      className="absolute bottom-0 left-0 h-0.5 bg-secondary/20 transition-all duration-300"
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
                          <span className="text-secondary font-bold">{file.progress}%</span>
                        ) : (
                          <span className="text-slate-500">Wait</span>
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

      {/* STEP 5: Success Completion Screen */}
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
              All files have been successfully received and saved to your device.
            </p>
          </div>

          {/* Files list summary */}
          <div className="bg-slate-900/60 p-3.5 rounded-xl border border-white/5 text-left max-h-[120px] overflow-y-auto space-y-1.5 text-[11px]">
            <div className="text-slate-500 font-bold uppercase tracking-wider">Received Files:</div>
            {activeFiles.map((f, i) => (
              <div key={i} className="flex justify-between items-center gap-2">
                <span className="text-slate-300 truncate font-semibold">{f.name}</span>
                <span className="text-slate-500 shrink-0 font-mono">{formatBytes(f.size)}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1 w-full">
            <button
              onClick={resetPage}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-xs font-bold text-white bg-primary hover:bg-blue-600 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              Receive More Files
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

export default function ReceivePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[40vh] text-slate-400 gap-2 text-xs">
        <Loader2 className="w-4.5 h-4.5 animate-spin text-primary" />
        Loading receiver...
      </div>
    }>
      <ReceivePageContent />
    </Suspense>
  );
}
