import { SignallingService } from './SignallingService';
import { WebRTCService } from './WebRTCService';
import { useTransferStore } from '../store/transferStore';
import { useStore } from '../store/useStore';
import { getSafeChunkSize, CHUNK_SIZE_MAP } from '../lib/chunker';
import { PacketType } from '../types/packets';
import { serializeMetadata, deserializeAck, deserializeSnack, serializeChunk, serializeControl } from '../lib/serializer';
import { addHistory } from '../utils/db';

export class SenderService {
  private signalling: SignallingService;
  private webrtc: WebRTCService;
  
  private files: Array<{ file: File; id: string }> = [];
  private currentFileIndex = 0;
  private isPaused = false;
  private offerSent = false;
  
  // Reliable transfer properties
  private worker: Worker | null = null;
  private currentFileId = '';
  private totalChunks = 0;
  private nextSeqNum = 0;
  private sendBase = 0;
  private windowSize = 16;
  private readonly maxWindowSize = 64;
  private readonly minWindowSize = 4;
  private rtt = 100; // ms
  private rto = 500; // ms
  private ackedChunks = new Set<number>();
  private inFlight = new Map<number, {
    data: ArrayBuffer;
    checksum: number;
    timestamp: number;
    retries: number;
  }>();
  private pendingPackets: Array<{
    chunkIndex: number;
    data: ArrayBuffer;
    checksum: number;
  }> = [];
  
  private retransmitTimer: any = null;
  private isWaitingForBuffer = false;
  
  // Speed calculator
  private speedTimer: any = null;
  private totalBytesTransferred = 0;
  private lastBytesTransferred = 0;
  private totalSizeToTransfer = 0;
  private peakSpeed = 0;
  private startTime: number | null = null;
  private speedWindow: number[] = [];
  private sentBytesMap = new Map<string, number>();

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
        useTransferStore.getState().setTransferStatus('transferring');
        this.signalling.stopPolling();
        this.startSpeedCalculator();
      } else if (state === 'disconnected' || state === 'failed') {
        this.handleDisconnect();
      }
    };

    this.webrtc.onChannelOpen = () => {
      console.log('[Sender] WebRTC DataChannel opened!');
      // Reloop client display info
      this.sendFileList();
    };

    this.webrtc.onChannelClose = () => {
      console.log('[Sender] DataChannel closed');
      this.handleDisconnect();
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
      } else if (packetType === PacketType.NACK) {
        const nack = deserializeAck(data);
        this.handleNack(nack.sequenceNumber);
      } else if (packetType === PacketType.SNACK) {
        const snack = deserializeSnack(data);
        this.handleSnack(snack.missingSequences);
      } else if (packetType === PacketType.FILE_COMPLETE) {
        this.handleFileCompleteAck();
      }
    };

    this.webrtc.onControlMessage = (msg) => {
      if (msg.type === 'file-list-accepted') {
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
        console.warn('[Sender] Receiver requested missing verification chunks. Retransmitting window from sendBase:', this.sendBase);
        this.nextSeqNum = this.sendBase;
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
      // Mark all files as completed
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
    this.sendBase = 0;
    this.windowSize = 16;
    this.ackedChunks.clear();
    this.stopRetransmitScheduler();
    this.inFlight.clear();
    this.pendingPackets = [];
    this.isWaitingForBuffer = false;

    const metadata = {
      fileId,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      totalChunks: this.totalChunks,
      chunkSize,
      checksum: '', // SHA-256 computed on demand / placeholder
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
      windowSize: this.windowSize,
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

    while (this.ackedChunks.has(this.sendBase) && this.sendBase < this.totalChunks) {
      this.sendBase++;
    }
    this.nextSeqNum = this.sendBase;

    this.startRetransmitScheduler();

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

    while (
      this.nextSeqNum < this.totalChunks &&
      (this.pendingPackets.length + this.inFlight.size) < this.windowSize
    ) {
      const seq = this.nextSeqNum;
      
      if (this.ackedChunks.has(seq)) {
        this.nextSeqNum++;
        while (this.ackedChunks.has(this.sendBase) && this.sendBase < this.totalChunks) {
          this.sendBase++;
        }
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

    const limit = 2 * 1024 * 1024; // 2MB safety threshold

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

      let chunkObj = this.inFlight.get(chunkIndex);
      if (chunkObj) {
        chunkObj.timestamp = Date.now();
      } else {
        chunkObj = {
          data,
          checksum,
          timestamp: Date.now(),
          retries: 0,
        };
        this.inFlight.set(chunkIndex, chunkObj);
        useTransferStore.getState().updateTransferState({ inFlightCount: this.inFlight.size });
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
    const chunk = this.inFlight.get(chunkIndex);
    if (!chunk) return;

    // RTT/RTO updates
    const sampleRTT = Date.now() - chunk.timestamp;
    this.rtt = 0.9 * this.rtt + 0.1 * sampleRTT;
    this.rto = Math.max(200, Math.min(5000, this.rtt * 2));

    // Congestion control: Additive Increase
    this.windowSize = Math.min(this.maxWindowSize, this.windowSize + (1 / Math.floor(this.windowSize)));

    this.inFlight.delete(chunkIndex);
    this.ackedChunks.add(chunkIndex);

    while (this.ackedChunks.has(this.sendBase) && this.sendBase < this.totalChunks) {
      this.sendBase++;
    }

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
        inFlightCount: this.inFlight.size,
        windowSize: this.windowSize,
        smoothedRTT: this.rtt,
        activeFiles: currentActiveFiles,
      });
    }

    if (this.sendBase === this.totalChunks) {
      // Completed sending all chunks
      this.finishFileSending();
    } else {
      this.requestMoreChunks();
    }
  }

  private handleNack(chunkIndex: number) {
    console.warn(`[Sender] NACK received for chunk ${chunkIndex}`);
    const chunk = this.inFlight.get(chunkIndex);
    if (chunk) {
      this.pendingPackets.push({
        chunkIndex,
        data: chunk.data,
        checksum: chunk.checksum,
      });
      this.sendPendingPackets();
    }
  }

  private handleSnack(missing: number[]) {
    console.warn(`[Sender] SNACK received for missing sequences:`, missing);
    let queuedAny = false;
    missing.forEach((seq) => {
      const chunk = this.inFlight.get(seq);
      if (chunk) {
        const alreadyQueued = this.pendingPackets.some(p => p.chunkIndex === seq);
        if (!alreadyQueued) {
          this.pendingPackets.push({
            chunkIndex: seq,
            data: chunk.data,
            checksum: chunk.checksum,
          });
          queuedAny = true;
        }
      }
    });

    if (queuedAny) {
      this.sendPendingPackets();
    }
  }

  private finishFileSending() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.stopRetransmitScheduler();
    this.inFlight.clear();
    this.pendingPackets = [];

    // Prompt receiver for verification
    this.webrtc.send(JSON.stringify({
      type: 'file-complete-verify',
      fileId: this.currentFileId,
    }));
  }

  private handleFileCompleteAck() {
    console.log(`[Sender] Receiver successfully verified file: ${this.currentFileId}`);
    
    // Progress to next file
    this.currentFileIndex++;
    setTimeout(() => this.streamNextFile(), 200);
  }

  private startRetransmitScheduler() {
    this.stopRetransmitScheduler();
    this.retransmitTimer = setInterval(() => {
      this.checkRetransmissions();
    }, 150);
  }

  private stopRetransmitScheduler() {
    if (this.retransmitTimer) {
      clearInterval(this.retransmitTimer);
      this.retransmitTimer = null;
    }
  }

  private checkRetransmissions() {
    if (this.isPaused || useTransferStore.getState().status !== 'transferring') {
      return;
    }

    const now = Date.now();
    let hasRetransmissions = false;

    this.inFlight.forEach((chunk, chunkIndex) => {
      if (now - chunk.timestamp > this.rto) {
        chunk.retries++;
        if (chunk.retries > 10) {
          console.error('[Sender] Max retransmissions exceeded for chunk:', chunkIndex);
          useTransferStore.getState().updateTransferState({
            errorMessage: 'Retransmission timeout limit exceeded.',
            status: 'error',
          });
          this.cleanUp();
          return;
        }

        console.warn(`[Sender] Timeout! Retransmitting chunk ${chunkIndex} (Attempt ${chunk.retries}). RTO: ${this.rto.toFixed(0)}ms`);
        this.windowSize = Math.max(this.minWindowSize, Math.floor(this.windowSize / 2));
        chunk.timestamp = now;

        const alreadyInPending = this.pendingPackets.some(p => p.chunkIndex === chunkIndex);
        if (!alreadyInPending) {
          this.pendingPackets.push({
            chunkIndex,
            data: chunk.data,
            checksum: chunk.checksum,
          });
          hasRetransmissions = true;
        }
      }
    });

    if (hasRetransmissions) {
      this.sendPendingPackets();
    }
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
    this.stopRetransmitScheduler();
    this.inFlight.clear();
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
    
    // Set status to connecting.
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
    this.stopRetransmitScheduler();
    this.inFlight.clear();
    this.pendingPackets = [];
    
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
