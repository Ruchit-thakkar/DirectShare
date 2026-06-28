import { SignallingService } from './SignallingService';
import { WebRTCService } from './WebRTCService';
import { useTransferStore } from '../store/transferStore';
import { useStore } from '../store/useStore';
import { getSafeChunkSize } from '../lib/chunker';
import { PacketType } from '../types/packets';
import { serializeMetadata, deserializeAck, serializeChunk } from '../lib/serializer';
import { addHistory } from '../utils/db';

export class SenderService {
  private signalling: SignallingService;
  private webrtc: WebRTCService;
  
  private files: Array<{ file: File; id: string }> = [];
  private currentFileIndex = 0;
  private isPaused = false;
  private offerSent = false;
  
  private worker: Worker | null = null;
  private currentFileId = '';
  private totalChunks = 0;
  private nextSeqNum = 0;
  private ackedChunks = new Set<number>();
  private pendingPackets: Array<{
    chunkIndex: number;
    data: ArrayBuffer;
    checksum: string;
  }> = [];
  
  private isWaitingForBuffer = false;
  private isReconnecting = false;
  private iceRestartTimeout: any = null;
  private failTimeout: any = null;
  
  // ICE reconnect attempts
  private iceRetryCount = 0;
  private readonly maxIceRetries = 3;
  private readonly iceRetryInterval = 5000;

  // Speed calculator
  private speedTimer: any = null;
  private totalBytesTransferred = 0;
  private lastBytesTransferred = 0;
  private totalSizeToTransfer = 0;
  private peakSpeed = 0;
  private startTime: number | null = null;
  private speedWindow: number[] = [];
  private sentBytesMap = new Map<string, number>();
  private rtt = 100; // ms

  constructor(signalling: SignallingService, webrtc: WebRTCService) {
    this.signalling = signalling;
    this.webrtc = webrtc;
  }

  async startSession(files: File[], displayName: string) {
    this.cleanUp();
    this.files = files.map(f => ({
      file: f,
      id: Math.random().toString(36).substring(2, 10),
    }));
    this.currentFileIndex = 0;
    this.isPaused = false;
    this.offerSent = false;
    this.totalSizeToTransfer = files.reduce((acc, f) => acc + f.size, 0);
    this.totalBytesTransferred = 0;
    this.lastBytesTransferred = 0;
    this.sentBytesMap.clear();

    const activeFiles = this.files.map((f, idx) => ({
      id: f.id,
      name: f.file.name,
      size: f.file.size,
      type: f.file.type || 'application/octet-stream',
      progress: 0,
      status: idx === 0 ? ('transferring' as const) : ('pending' as const),
    }));

    useTransferStore.getState().updateTransferState({
      status: 'connecting',
      activeFiles,
    });

    try {
      const room = await this.signalling.createRoom(displayName);
      useTransferStore.getState().updateTransferState({
        metadata: null,
      });

      this.webrtc.setupConnection(true);
      this.setupWebRTCCallbacks();

      // Start polling for receiver
      this.signalling.startPolling(
        (msg) => this.handleSignalingMessage(msg),
        async (name) => {
          useTransferStore.getState().updateTransferState({ peerName: name });
          if (!this.offerSent) {
            this.offerSent = true;
            try {
              console.log('[Sender] Receiver joined! Creating SDP offer...');
              const offer = await this.webrtc.createOffer();
              await this.signalling.sendMessage({ type: 'sdp', sdp: JSON.parse(offer) });
            } catch (err: any) {
              console.error('[Sender] Create offer failed:', err);
            }
          }
        },
        () => {
          useTransferStore.getState().updateTransferState({
            errorMessage: 'Signaling session expired or room not found.',
            status: 'error',
          });
          this.cleanUp();
        }
      );
    } catch (err: any) {
      useTransferStore.getState().updateTransferState({
        errorMessage: err.message || 'Failed to start session',
        status: 'error',
      });
    }
  }

  private setupWebRTCCallbacks() {
    this.webrtc.onConnectionStateChange = (state) => {
      console.log('[Sender] ICE state changed:', state);
      if (state === 'connected' || state === 'completed') {
        if (this.isReconnecting) {
          console.log('[Sender] ICE connection successfully recovered!');
          this.isReconnecting = false;
          this.iceRetryCount = 0; // Reset reconnect attempts
          if (this.iceRestartTimeout) {
            clearTimeout(this.iceRestartTimeout);
            this.iceRestartTimeout = null;
          }
          if (this.failTimeout) {
            clearTimeout(this.failTimeout);
            this.failTimeout = null;
          }
          useTransferStore.getState().updateTransferState({
            errorMessage: null,
          });
        }
        
        this.isPaused = false;
        useTransferStore.getState().setTransferStatus('transferring');
        this.signalling.stopPolling();
        this.startSpeedCalculator();
        
        // Trigger sending more chunks in case the queue stalled
        this.requestMoreChunks();
        this.sendPendingPackets();
      } else if (state === 'disconnected' || state === 'failed') {
        this.handleIceDisconnect();
      }
    };

    this.webrtc.onChannelOpen = () => {
      console.log('[Sender] WebRTC DataChannel opened!');
      this.sendFileList();
    };

    this.webrtc.onChannelClose = () => {
      console.log('[Sender] DataChannel closed');
      this.handleIceDisconnect();
    };

    this.webrtc.onError = (err) => {
      useTransferStore.getState().updateTransferState({
        errorMessage: err,
        status: 'error',
      });
      this.cleanUp();
    };

    this.webrtc.onBinaryMessage = (data) => {
      const view = new DataView(data);
      const packetType = view.getUint8(0);

      if (packetType === PacketType.ACK) {
        const ack = deserializeAck(data);
        this.handleAck(ack.sequenceNumber);
      } else if (packetType === PacketType.FILE_COMPLETE) {
        this.handleFileCompleteAck();
      }
    };

    this.webrtc.onControlMessage = (msg) => {
      if (msg.type === 'rtt-update') {
        this.rtt = 0.9 * this.rtt + 0.1 * msg.rtt;
        useTransferStore.getState().updateTransferState({
          smoothedRTT: this.rtt,
        });
      } else if (msg.type === 'file-list-accepted') {
        if (msg.accepted) {
          this.streamNextFile();
        } else {
          useTransferStore.getState().updateTransferState({
            errorMessage: 'Receiver rejected the transfer request.',
            status: 'error',
          });
          this.cleanUp();
        }
      } else if (msg.type === 'file-start-ack') {
        this.handleFileStartAck(msg.completedChunks);
      } else if (msg.type === 'request-missing-verification') {
        console.warn('[Sender] Receiver requested missing verification chunks. Retransmitting from 0:', this.nextSeqNum);
        this.nextSeqNum = 0;
        this.requestMoreChunks();
      } else if (msg.type === 'file-pause') {
        this.pauseLocally();
      } else if (msg.type === 'file-resume') {
        this.resumeLocally();
      } else if (msg.type === 'file-cancel') {
        useTransferStore.getState().updateTransferState({
          errorMessage: 'Transfer cancelled by peer.',
          status: 'aborted',
        });
        this.cleanUp();
      }
    };
  }

  private handleIceDisconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    console.warn('[Sender] Connection unstable/disconnected. Starting auto-recovery...');

    this.isPaused = true;
    this.stopSpeedCalculator();

    // Update status showing current attempt
    useTransferStore.getState().updateTransferState({
      errorMessage: `Connection unstable. Reconnecting... (Attempt ${this.iceRetryCount + 1}/${this.maxIceRetries})`,
      status: 'connecting',
    });

    // Resume polling so signaling works
    this.signalling.startPolling(
      (msg) => this.handleSignalingMessage(msg),
      (name) => {
        useTransferStore.getState().updateTransferState({ peerName: name });
      },
      () => {
        this.handleDisconnect();
      }
    );

    // Try ICE Restart with adaptive retry
    this.iceRestartTimeout = setTimeout(async () => {
      if (this.isReconnecting && this.iceRetryCount < this.maxIceRetries) {
        try {
          this.iceRetryCount++;
          console.warn(`[Sender] Initiating ICE Restart Offer (Attempt ${this.iceRetryCount}/${this.maxIceRetries})...`);
          const offer = await this.webrtc.initiateIceRestart();
          await this.signalling.sendMessage({ type: 'sdp', sdp: JSON.parse(offer) });
          
          useTransferStore.getState().updateTransferState({
            errorMessage: `Reconnecting... (Attempt ${this.iceRetryCount}/${this.maxIceRetries})`,
          });
        } catch (err) {
          console.error('[Sender] ICE Restart offer failed:', err);
        }
      }
    }, this.iceRetryInterval);

    // 30 seconds failure timeout
    this.failTimeout = setTimeout(() => {
      if (this.isReconnecting) {
        console.error('[Sender] Connection failed to recover within 30 seconds.');
        useTransferStore.getState().updateTransferState({
          errorMessage: 'Connection lost. Reconnection timed out.',
          status: 'error',
        });
        this.cleanUp();
      }
    }, 30000);
  }

  private handleDisconnect() {
    if (useTransferStore.getState().status !== 'complete') {
      useTransferStore.getState().updateTransferState({
        errorMessage: 'Direct connection lost.',
        status: 'error',
      });
      this.cleanUp();
    }
  }

  private async handleSignalingMessage(msg: any) {
    if (msg.type === 'sdp' && msg.sdp.type === 'answer') {
      try {
        await this.webrtc.acceptAnswer(JSON.stringify(msg.sdp));
      } catch (err: any) {
        console.error('[Sender] Accept answer failed:', err);
      }
    }
  }

  private sendFileList() {
    const list = this.files.map((f) => ({
      id: f.id,
      name: f.file.name,
      size: f.file.size,
      type: f.file.type || 'application/octet-stream',
    }));

    this.webrtc.send(JSON.stringify({
      type: 'file-list',
      files: list,
    }));
  }

  private streamNextFile() {
    if (this.currentFileIndex >= this.files.length) {
      const finalFiles = useTransferStore.getState().activeFiles.map(f => ({
        ...f,
        progress: 100,
        status: 'completed' as const
      }));
      useTransferStore.getState().updateTransferState({
        status: 'complete',
        activeFiles: finalFiles
      });
      this.saveHistoryLog();
      return;
    }

    const { file, id: fileId } = this.files[this.currentFileIndex];
    const chunkSize = getSafeChunkSize(this.rtt, useStore.getState().chunkSizePreset || '512KB', this.webrtc.getMaxMessageSize());
    this.totalChunks = Math.ceil(file.size / chunkSize);

    this.currentFileId = fileId;
    this.nextSeqNum = 0;
    this.ackedChunks.clear();
    this.pendingPackets = [];
    this.isWaitingForBuffer = false;

    const metadata = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks: this.totalChunks,
      chunkSize,
      checksum: '',
      createdAt: Date.now(),
    };

    const currentActiveFiles = useTransferStore.getState().activeFiles.map(f => {
      if (f.id === fileId) {
        return { ...f, status: 'transferring' as const };
      }
      return f;
    });

    useTransferStore.getState().updateTransferState({
      status: 'transferring',
      metadata,
      nextToSend: 0,
      inFlightCount: 0,
      bytesSent: 0,
      chunksAcked: 0,
      activeFiles: currentActiveFiles,
    });

    console.log(`[Sender] Sending file-start message for ${file.name}...`);
    const metaBuffer = serializeMetadata(fileId, metadata);
    this.webrtc.send(metaBuffer);
  }

  private handleFileStartAck(completedChunks: number[]) {
    console.log(`[Sender] Peer acknowledged file start. Completed: ${completedChunks.length}/${this.totalChunks}`);
    
    completedChunks.forEach((idx) => {
      this.ackedChunks.add(idx);
    });

    this.nextSeqNum = this.ackedChunks.size;

    // Spawn chunking worker
    const { file } = this.files[this.currentFileIndex];
    const chunkSize = useTransferStore.getState().metadata?.chunkSize || 524288;
    
    this.worker = new Worker('/transferWorker.js');
    this.worker.postMessage({
      type: 'START_CHUNKING',
      payload: {
        file,
        fileId: this.currentFileId,
        sessionId: this.signalling.getRoomId() || 'manual',
        chunkSize,
      },
    });

    this.worker.onmessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'CHUNKING_STARTED') {
        this.requestMoreChunks();
      } else if (type === 'CHUNK_GENERATED') {
        const { chunkIndex, data, checksum } = payload;
        
        if (this.ackedChunks.has(chunkIndex)) {
          this.requestMoreChunks();
          return;
        }

        this.pendingPackets.push({ chunkIndex, data, checksum });
        this.sendPendingPackets();
        this.requestMoreChunks();
      } else if (type === 'CHUNKING_ERROR') {
        console.error('Worker chunking error:', payload.error);
        useTransferStore.getState().updateTransferState({
          errorMessage: 'Chunking worker failed: ' + payload.error,
          status: 'error',
        });
        this.cleanUp();
      }
    };
  }

  private requestMoreChunks() {
    if (this.isPaused || useTransferStore.getState().status !== 'transferring') {
      return;
    }

    // Limit worker slicing queue to avoid memory overload
    const pacingLimit = 32;

    while (
      this.nextSeqNum < this.totalChunks &&
      (this.pendingPackets.length) < pacingLimit
    ) {
      const seq = this.nextSeqNum;
      
      if (this.ackedChunks.has(seq)) {
        this.nextSeqNum++;
        continue;
      }

      if (this.worker) {
        this.worker.postMessage({
          type: 'REQUEST_CHUNK',
          payload: { chunkIndex: seq }
        });
      }
      this.nextSeqNum++;
      useTransferStore.getState().updateTransferState({ nextToSend: this.nextSeqNum });
    }
  }

  private sendPendingPackets() {
    if (this.isPaused || !this.webrtc) return;
    if (this.isWaitingForBuffer) return;

    const limit = 2 * 1024 * 1024; // 2MB safety backpressure threshold

    while (this.pendingPackets.length > 0) {
      if (this.webrtc.getBufferedAmount() > limit) {
        this.isWaitingForBuffer = true;
        this.webrtc.registerBufferLow(() => {
          this.isWaitingForBuffer = false;
          this.sendPendingPackets();
        });
        return;
      }

      const packetInfo = this.pendingPackets.shift()!;
      const { chunkIndex, data, checksum } = packetInfo;

      if (this.ackedChunks.has(chunkIndex)) {
        continue;
      }

      const packet = serializeChunk(
        this.currentFileId,
        chunkIndex,
        this.totalChunks,
        checksum,
        data
      );

      const success = this.webrtc.send(packet);

      if (!success) {
        console.warn(`[Sender] Send failed for chunk ${chunkIndex}. Putting back in queue.`);
        this.pendingPackets.unshift(packetInfo);
        this.isWaitingForBuffer = true;
        this.webrtc.registerBufferLow(() => {
          this.isWaitingForBuffer = false;
          this.sendPendingPackets();
        });
        return;
      }
    }
  }

  private handleAck(chunkIndex: number) {
    if (this.ackedChunks.has(chunkIndex)) return;
    this.ackedChunks.add(chunkIndex);

    const metadata = useTransferStore.getState().metadata;
    if (metadata) {
      const chunkSize = metadata.chunkSize;
      const sentBytes = this.ackedChunks.size * chunkSize;
      const actualSent = Math.min(sentBytes, this.files[this.currentFileIndex].file.size);
      this.sentBytesMap.set(this.currentFileId, actualSent);

      let totalSent = 0;
      this.sentBytesMap.forEach((bytes) => {
        totalSent += bytes;
      });
      this.totalBytesTransferred = totalSent;

      const currentActiveFiles = useTransferStore.getState().activeFiles.map(f => {
        if (f.id === this.currentFileId) {
          const progress = Math.min(Math.round((this.ackedChunks.size / this.totalChunks) * 100), 100);
          return {
            ...f,
            progress,
            status: this.ackedChunks.size === this.totalChunks ? ('completed' as const) : ('transferring' as const)
          };
        }
        return f;
      });

      useTransferStore.getState().updateTransferState({
        bytesSent: actualSent,
        chunksAcked: this.ackedChunks.size,
        inFlightCount: 0,
        activeFiles: currentActiveFiles,
      });
    }

    if (this.ackedChunks.size === this.totalChunks) {
      this.finishFileSending();
    } else {
      this.requestMoreChunks();
    }
  }

  private finishFileSending() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingPackets = [];

    // Prompt receiver for verification
    this.webrtc.send(JSON.stringify({
      type: 'file-complete-verify',
      fileId: this.currentFileId,
    }));
  }

  private handleFileCompleteAck() {
    console.log(`[Sender] Receiver successfully verified file: ${this.currentFileId}`);
    this.currentFileIndex++;
    setTimeout(() => this.streamNextFile(), 200);
  }

  private startSpeedCalculator() {
    this.stopSpeedCalculator();
    this.startTime = Date.now();
    this.peakSpeed = 0;
    this.lastBytesTransferred = 0;
    this.speedWindow = [];

    this.speedTimer = setInterval(() => {
      const bytesTransferredThisSecond = Math.max(0, this.totalBytesTransferred - this.lastBytesTransferred);
      this.lastBytesTransferred = this.totalBytesTransferred;

      if (bytesTransferredThisSecond > this.peakSpeed) {
        this.peakSpeed = bytesTransferredThisSecond;
      }

      this.speedWindow.push(bytesTransferredThisSecond);
      if (this.speedWindow.length > 3) this.speedWindow.shift();
      const currentSpeed = this.speedWindow.reduce((a, b) => a + b, 0) / this.speedWindow.length;

      const elapsedSeconds = (Date.now() - (this.startTime || Date.now())) / 1000;
      const averageSpeed = elapsedSeconds > 0 ? this.totalBytesTransferred / elapsedSeconds : currentSpeed;

      const remainingBytes = Math.max(0, this.totalSizeToTransfer - this.totalBytesTransferred);
      const remainingTime = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : null;

      useTransferStore.getState().updateTransferState({
        currentSpeedBps: averageSpeed,
        etaSeconds: remainingTime,
      });
    }, 1000);
  }

  private stopSpeedCalculator() {
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
  }

  pause() {
    if (useTransferStore.getState().status === 'transferring') {
      this.pauseLocally();
      this.webrtc.send(JSON.stringify({ type: 'file-pause' }));
    }
  }

  private pauseLocally() {
    this.isPaused = true;
    this.pendingPackets = [];
    useTransferStore.getState().setTransferStatus('paused');
  }

  resume() {
    if (useTransferStore.getState().status === 'paused') {
      this.resumeLocally();
      this.webrtc.send(JSON.stringify({ type: 'file-resume' }));
      this.streamNextFile();
    }
  }

  private resumeLocally() {
    this.isPaused = false;
    useTransferStore.getState().setTransferStatus('transferring');
  }

  cancel() {
    this.webrtc.send(JSON.stringify({ type: 'file-cancel' }));
    useTransferStore.getState().setTransferStatus('aborted');
    this.cleanUp();
  }

  private saveHistoryLog() {
    this.files.forEach(async ({ file: f }) => {
      await addHistory({
        fileName: f.name,
        fileSize: f.size,
        fileType: f.type || 'application/octet-stream',
        direction: 'send',
        peerName: 'Receiver',
        status: 'completed',
        speed: this.totalSizeToTransfer / (Date.now() - (this.startTime || Date.now())) * 1000,
        timestamp: Date.now(),
      });
    });
  }

  async setupManualConnection(): Promise<string> {
    const savedFiles = this.files;
    this.cleanUp();
    this.files = savedFiles;
    
    useTransferStore.getState().setTransferStatus('connecting');

    const activeFiles = this.files.map((f, idx) => ({
      id: f.id,
      name: f.file.name,
      size: f.file.size,
      type: f.file.type || 'application/octet-stream',
      progress: 0,
      status: idx === 0 ? ('transferring' as const) : ('pending' as const),
    }));

    useTransferStore.getState().updateTransferState({
      status: 'connecting',
      activeFiles,
    });

    this.webrtc.setupConnection(true);
    this.setupWebRTCCallbacks();

    const offer = await this.webrtc.createOffer();
    return offer;
  }

  async acceptManualAnswer(answerSdp: string) {
    await this.webrtc.acceptAnswer(answerSdp);
  }

  cleanUp() {
    this.stopSpeedCalculator();
    this.pendingPackets = [];
    this.iceRetryCount = 0;
    
    if (this.iceRestartTimeout) {
      clearTimeout(this.iceRestartTimeout);
      this.iceRestartTimeout = null;
    }
    if (this.failTimeout) {
      clearTimeout(this.failTimeout);
      this.failTimeout = null;
    }
    this.isReconnecting = false;
    
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    this.signalling.cleanUp();
    this.webrtc.cleanUp();
    
    this.files = [];
    this.currentFileIndex = 0;
    this.isPaused = false;
    this.ackedChunks.clear();
    this.isWaitingForBuffer = false;
    this.offerSent = false;
  }
}
