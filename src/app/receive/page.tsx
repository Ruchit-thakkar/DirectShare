'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
} from 'lucide-react';

function ReceivePageContent() {
  const searchParams = useSearchParams();
  const {
    displayName,
    connectionState,
    activeFiles,
    transferProgress,
    transferSpeed,
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

      // Automatically clean up and return to initial state after 4 seconds
      const timeoutId = setTimeout(() => {
        transferManager.cleanUp();
        useStore.getState().resetTransfer();
      }, 4000);

      return () => clearTimeout(timeoutId);
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

    // Wait a brief tick for the DOM element to mount
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
            // Check if URL or room code
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
          () => {} // Silent parse errors
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

  // Icon mapping helpers
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
          <h1 className="text-3xl font-extrabold tracking-tight">Receive Files</h1>
          <p className="text-slate-400 text-sm mt-1">Connect and accept direct P2P file transfers from nearby devices</p>
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

      {/* STEP 1: Enter Room Code / Scanning View */}
      {connectionState === 'Waiting' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Main Join Panel */}
          <div className="md:col-span-2 glass-panel p-8 rounded-3xl border border-white/5 space-y-6">
            <h2 className="text-lg font-bold text-slate-200">Connect to Sender</h2>
            <p className="text-xs text-slate-400">
              Enter the 6-digit connection code displayed on the sender device or scan their QR code.
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
                className="px-6 py-3.5 rounded-2xl bg-primary hover:bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/10 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
                className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700/40 text-slate-300 font-semibold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
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
                  className="space-y-4 border border-white/5 bg-slate-950/40 p-5 rounded-2xl relative overflow-hidden"
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
                  <h3 className="text-sm font-bold text-slate-300">1. Paste Sender SDP Offer</h3>
                  <p className="text-xs text-slate-400">
                    Paste the handshake package generated by the sender device below.
                  </p>
                  <textarea
                    placeholder="Paste sender offer SDP JSON here..."
                    value={manualOffer}
                    onChange={(e) => setManualOffer(e.target.value)}
                    className="w-full text-[10px] font-mono p-3 bg-slate-950/80 rounded-xl border border-white/5 resize-none h-[80px]"
                  />
                  <button
                    onClick={handleGenerateManualAnswer}
                    disabled={!manualOffer || isGeneratingAnswer}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/5 transition-colors flex items-center gap-2 disabled:opacity-50 cursor-pointer"
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
                        className="w-full text-[10px] font-mono p-3 bg-slate-950/80 rounded-xl border border-white/5 resize-none h-[80px]"
                        onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                      />
                      <button
                        onClick={copyAnswerToClipboard}
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
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Identity instructions */}
          <div className="glass-panel p-6 rounded-2xl space-y-4 border border-white/5 h-fit text-slate-300">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Instructions</h3>
            <ul className="text-xs space-y-2.5 list-disc list-inside">
              <li>Ensure both devices are on the same local network (Wi-Fi or hotspot).</li>
              <li>Sender should have selected files and generated a code.</li>
              <li>After connecting, you will be prompted to approve the incoming transfer.</li>
              <li>Wait for reconstruction to complete before closing this tab.</li>
            </ul>
          </div>
        </motion.div>
      )}

      {/* STEP 2: Connecting / ICE handshake loading */}
      {(connectionState === 'Connecting' || (connectionState === 'Connected' && activeFiles.length === 0)) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel p-10 rounded-3xl border border-white/5 text-center max-w-md mx-auto space-y-4"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
          <h2 className="text-lg font-bold text-slate-200">
            {connectionState === 'Connected' ? 'Retrieving File Information' : 'Connecting to Peer'}
          </h2>
          <p className="text-xs text-slate-400">
            {connectionState === 'Connected'
              ? 'WebRTC channel opened. Waiting for files list metadata...'
              : 'Exchanging WebRTC handshake descriptions to establish a direct local socket connection...'}
          </p>
        </motion.div>
      )}

      {/* STEP 3: Transfer approval modal dialog */}
      {connectionState === 'Receiving' && activeFiles.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-panel p-8 rounded-3xl border border-white/5 max-w-2xl mx-auto space-y-6 shadow-2xl"
        >
          <div className="flex items-center gap-3 border-b border-white/5 pb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-200">Incoming Transfer Request</h2>
              <p className="text-xs text-slate-400">
                From: <span className="font-bold text-slate-200">{peerName || 'Sender Device'}</span>
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Files to Receive ({activeFiles.length})
            </span>
            <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
              {activeFiles.map((file) => {
                const Icon = getFileIcon(file.type);
                const colorClass = getFileIconColor(file.type);
                return (
                  <div
                    key={file.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/40 border border-white/5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`p-2 rounded-xl border ${colorClass} shrink-0`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-sm font-semibold text-slate-200 truncate">{file.name}</span>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 font-medium">{formatBytes(file.size)}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-white/5 flex items-center justify-between">
              <span>Total size:</span>
              <span className="font-bold text-slate-200">
                {formatBytes(activeFiles.reduce((acc, f) => acc + f.size, 0))}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              onClick={handleRejectTransfer}
              className="px-5 py-2.5 rounded-xl border border-white/10 hover:bg-red-500/10 hover:text-red-400 text-slate-400 font-semibold text-sm transition-colors cursor-pointer"
            >
              Reject
            </button>
            <button
              onClick={handleAcceptTransfer}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white font-bold text-sm shadow-md shadow-blue-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-4 h-4" /> Accept Transfer
            </button>
          </div>
        </motion.div>
      )}

      {/* STEP 4: Active Receive progress stats */}
      {((connectionState === 'Connected' && activeFiles.length > 0) ||
        connectionState === 'Completed') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {/* Progress Visuals */}
          <div className="md:col-span-2 space-y-6">
            <div className="glass-panel p-6 rounded-3xl border border-white/5 space-y-6">
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-3.5 h-3.5 rounded-full ${
                      connectionState === 'Completed'
                        ? 'bg-emerald-400'
                        : 'bg-primary animate-pulse'
                    }`}
                  />
                  <div>
                    <h3 className="font-bold text-slate-200">
                      {connectionState === 'Completed'
                        ? 'Transfer Completed!'
                        : `Receiving from ${peerName || 'Peer'}`}
                    </h3>
                    <p className="text-xs text-slate-400">
                      {connectionState === 'Completed'
                        ? 'All files successfully saved'
                        : `${formatSpeed(transferSpeed)} average speed`}
                    </p>
                  </div>
                </div>

                {connectionState !== 'Completed' && (
                  <button
                    onClick={() => transferManager.cancel()}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-transparent hover:border-red-500/10 transition-colors cursor-pointer"
                    title="Cancel Transfer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

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
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Speed
                  </span>
                  <p className="text-sm sm:text-base font-extrabold text-slate-200">
                    {formatSpeed(transferSpeed)}
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
                  Receive More Files
                </button>
              )}
            </div>
          </div>

          {/* Right side: File queue showing progress */}
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

export default function ReceivePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[50vh] text-slate-400 gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        Loading...
      </div>
    }>
      <ReceivePageContent />
    </Suspense>
  );
}
