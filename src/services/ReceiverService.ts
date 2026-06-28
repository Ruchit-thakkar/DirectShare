import { SignallingService } from './SignallingService';
import { WebRTCService } from './WebRTCService';
import { useReceiverStore } from '../store/receiverStore';
import { PacketType } from '../types/packets';
import { deserializeMetadata, deserializeChunk, serializeAck, serializeControl } from '../lib/serializer';
import { getFileCategory } from '../utils/fileTypes';
import {
  saveChunk,
  getChunk,
  clearChunks,
  addHistory,
  deleteTransferMetadata,
  markChunkCompleted
} from '../utils/db';

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export class ReceiverService {
  private signalling: SignallingService;
  private webrtc: WebRTCService;

  // Active files mapping
  private activeFilesMeta: any[] = [];
  private receivedChunksSetMap = new Map<string, Set<number>>();
  private fileChunkSizes = new Map<string, number>();
  private fileTotalChunks = new Map<string, number>();
  private fileWritePromises = new Map<string, Promise<any>[]>();
  
  // Speed metrics
  private speedTimer: any = null;
  private totalBytesTransferred = 0;
  private lastBytesTransferred = 0;
  private totalSizeToTransfer = 0;
  private peakSpeed = 0;
  private startTime: number | null = null;
  private speedWindow: number[] = [];
  private fileMetadataMap = new Map<string, any>();
  private currentFileIndex = 0;
  private isReconnecting = false;
  private failTimeout: any = null;

  constructor(signalling: SignallingService, webrtc: WebRTCService) {
    this.signalling = signalling;
    this.webrtc = webrtc;
  }

  async startSession(roomId: string, displayName: string) {
    this.cleanUp();
    useReceiverStore.getState().setReceiverStatus('connecting');

    try {
      const joinData = await this.signalling.joinRoom(roomId, displayName);
      
      this.webrtc.setupConnection(false);
      this.setupWebRTCCallbacks();

      // Start polling for host SDP
      this.signalling.startPolling(
        (msg) => this.handleSignalingMessage(msg),
        (name) => {
          useReceiverStore.getState().updateReceiverState({ peerName: name });
        },
        () => {
          useReceiverStore.getState().updateReceiverState({
            errorMessage: 'Signaling session expired or room not found.',
            status: 'error',
          });
          this.cleanUp();
        }
      );
    } catch (err: any) {
      useReceiverStore.getState().updateReceiverState({
        errorMessage: err.message || 'Failed to join session',
        status: 'error',
      });
    }
  }

  private setupWebRTCCallbacks() {
    this.webrtc.onConnectionStateChange = (state) => {
      console.log('[Receiver] ICE state changed:', state);
      if (state === 'connected' || state === 'completed') {
        if (this.isReconnecting) {
          console.log('[Receiver] ICE connection successfully recovered!');
          this.isReconnecting = false;
          if (this.failTimeout) {
            clearTimeout(this.failTimeout);
            this.failTimeout = null;
          }
          useReceiverStore.getState().updateReceiverState({
            errorMessage: null,
          });
        }

        useReceiverStore.getState().setReceiverStatus('receiving');
        this.signalling.stopPolling();
        this.startSpeedCalculator();
      } else if (state === 'disconnected' || state === 'failed') {
        this.handleIceDisconnect();
      }
    };

    this.webrtc.onChannelOpen = () => {
      console.log('[Receiver] DataChannel opened!');
    };

    this.webrtc.onChannelClose = () => {
      console.log('[Receiver] DataChannel closed');
      this.handleIceDisconnect();
    };

    this.webrtc.onError = (err) => {
      useReceiverStore.getState().updateReceiverState({
        errorMessage: err,
        status: 'error',
      });
      this.cleanUp();
    };

    this.webrtc.onBinaryMessage = async (data) => {
      const view = new DataView(data);
      const packetType = view.getUint8(0);

      if (packetType === PacketType.FILE_METADATA) {
        const { metadata } = deserializeMetadata(data);
        await this.handleFileMetadata(metadata);
      } else if (packetType === PacketType.CHUNK) {
        const chunk = deserializeChunk(data);
        await this.handleChunk(chunk);
      }
    };

    this.webrtc.onControlMessage = async (msg) => {
      if (msg.type === 'rtt-update') {
        return;
      } else if (msg.type === 'file-list') {
        this.activeFilesMeta = msg.files.map((f: any) => ({
          ...f,
          progress: 0,
          status: 'pending',
          category: getFileCategory(f.name, f.type),
        }));
        
        this.totalSizeToTransfer = msg.files.reduce((acc: number, f: any) => acc + f.size, 0);
        this.totalBytesTransferred = 0;
        this.lastBytesTransferred = 0;
        this.currentFileIndex = 0;
        
        useReceiverStore.getState().updateReceiverState({
          status: 'waiting_metadata',
          metadata: null,
          bytesReceived: 0,
          chunksReceived: 0,
          activeFiles: this.activeFilesMeta,
        });

        useReceiverStore.getState().setReceiverMetadata(this.activeFilesMeta[0] || null);
      } else if (msg.type === 'file-complete-verify') {
        await this.handleFileCompleteVerify(msg.fileId);
      } else if (msg.type === 'file-pause') {
        useReceiverStore.getState().setReceiverStatus('paused');
      } else if (msg.type === 'file-resume') {
        useReceiverStore.getState().setReceiverStatus('receiving');
      } else if (msg.type === 'file-cancel') {
        useReceiverStore.getState().updateReceiverState({
          errorMessage: 'Transfer cancelled by peer.',
          status: 'error',
        });
        this.cleanUp();
      }
    };
  }

  private handleIceDisconnect() {
    if (this.isReconnecting) return;
    this.isReconnecting = true;
    console.warn('[Receiver] Connection unstable/disconnected. Starting auto-recovery...');

    this.stopSpeedCalculator();

    useReceiverStore.getState().updateReceiverState({
      errorMessage: 'Connection unstable. Reconnecting...',
      status: 'connecting',
    });

    this.signalling.startPolling(
      (msg) => this.handleSignalingMessage(msg),
      (name) => {
        useReceiverStore.getState().updateReceiverState({ peerName: name });
      },
      () => {
        this.handleDisconnect();
      }
    );
  }

  private handleDisconnect() {
    if (useReceiverStore.getState().status !== 'complete') {
      useReceiverStore.getState().updateReceiverState({
        errorMessage: 'Direct connection lost.',
        status: 'error',
      });
      this.cleanUp();
    }
  }

  private async handleSignalingMessage(msg: any) {
    if (msg.type === 'sdp' && msg.sdp.type === 'offer') {
      try {
        console.log('[Receiver] Received SDP offer for ICE restart/reconnect.');
        const answer = await this.webrtc.acceptOffer(JSON.stringify(msg.sdp));
        await this.signalling.sendMessage({ type: 'sdp', sdp: JSON.parse(answer) });
      } catch (err: any) {
        console.error('[Receiver] Handle SDP offer failed:', err);
      }
    }
  }

  acceptTransfer(approved: boolean) {
    if (approved) {
      useReceiverStore.getState().setReceiverStatus('receiving');
      this.webrtc.send(JSON.stringify({
        type: 'file-list-accepted',
        accepted: true,
      }));
    } else {
      useReceiverStore.getState().setReceiverStatus('idle');
      this.webrtc.send(JSON.stringify({
        type: 'file-list-accepted',
        accepted: false,
      }));
      this.cleanUp();
    }
  }

  private async handleFileMetadata(meta: any) {
    console.log('[Receiver] Received file metadata:', meta);
    
    this.fileMetadataMap.set(meta.fileId, meta);
    this.fileChunkSizes.set(meta.fileId, meta.chunkSize);
    this.fileTotalChunks.set(meta.fileId, meta.totalChunks);

    const receivedSet = new Set<number>();
    this.receivedChunksSetMap.set(meta.fileId, receivedSet);

    useReceiverStore.getState().updateReceiverState({
      status: 'receiving',
      metadata: meta,
      chunksReceived: 0,
      bytesReceived: 0,
      nextExpected: 0,
    });

    this.webrtc.send(JSON.stringify({
      type: 'file-start-ack',
      fileId: meta.fileId,
      completedChunks: [],
    }));

    if (this.currentFileIndex === 0) {
      this.startTime = Date.now();
    }
  }

  private async handleChunk(chunk: any) {
    const { fileId, sequenceNumber, totalChunks, chunkChecksum, payload } = chunk;

    // Cryptographic SHA-256 integrity validation
    const computedHash = await computeSha256(payload);
    if (computedHash !== chunkChecksum) {
      console.error(`[Receiver] SHA-256 hash mismatch on chunk ${sequenceNumber}! Got: ${computedHash}, Expected: ${chunkChecksum}`);
      useReceiverStore.getState().updateReceiverState({
        errorMessage: `Integrity check failed: Chunk ${sequenceNumber} was corrupted.`,
        status: 'error',
      });
      this.cleanUp();
      return;
    }

    let receivedSet = this.receivedChunksSetMap.get(fileId);
    if (!receivedSet) {
      receivedSet = new Set<number>();
      this.receivedChunksSetMap.set(fileId, receivedSet);
    }

    receivedSet.add(sequenceNumber);

    // Save and mark complete in database
    const writePromise = Promise.all([
      saveChunk(fileId, sequenceNumber, payload),
      markChunkCompleted(fileId, sequenceNumber),
    ]);

    let list = this.fileWritePromises.get(fileId);
    if (!list) {
      list = [];
      this.fileWritePromises.set(fileId, list);
    }
    list.push(writePromise);

    writePromise.finally(() => {
      const currentList = this.fileWritePromises.get(fileId);
      if (currentList) {
        const idx = currentList.indexOf(writePromise);
        if (idx > -1) {
          currentList.splice(idx, 1);
        }
      }
    });

    await writePromise;

    // Send ACK back to update progress on sender side
    const ackBuffer = serializeAck(PacketType.ACK, fileId, sequenceNumber);
    this.webrtc.send(ackBuffer);

    // Update state progress
    const activeMeta = useReceiverStore.getState().metadata;
    if (activeMeta && activeMeta.fileId === fileId) {
      const nextExpected = sequenceNumber + 1;
      
      let receivedBytesSoFar = 0;
      this.receivedChunksSetMap.forEach((set, id) => {
        const meta = this.fileMetadataMap.get(id);
        if (meta) {
          const fChunkSize = this.fileChunkSizes.get(id) || 524288;
          receivedBytesSoFar += Math.min(set.size * fChunkSize, meta.fileSize);
        }
      });
      this.totalBytesTransferred = receivedBytesSoFar;

      const currentActiveFiles = useReceiverStore.getState().activeFiles.map(f => {
        if (f.id === fileId) {
          return {
            ...f,
            progress: Math.min(Math.round((receivedSet.size / totalChunks) * 100), 100),
            status: receivedSet.size === totalChunks ? ('completed' as const) : ('transferring' as const),
          };
        }
        return f;
      });

      useReceiverStore.getState().updateReceiverState({
        nextExpected,
        chunksReceived: receivedSet.size,
        bytesReceived: receivedSet.size * activeMeta.chunkSize,
        activeFiles: currentActiveFiles,
      });
    }
  }

  private async handleFileCompleteVerify(fileId: string) {
    const receivedSet = this.receivedChunksSetMap.get(fileId);
    const totalChunks = this.fileTotalChunks.get(fileId) || 0;
    const metadata = this.fileMetadataMap.get(fileId);

    if (metadata && receivedSet && receivedSet.size === totalChunks) {
      useReceiverStore.getState().setReceiverStatus('verifying');
      
      const activeWrites = this.fileWritePromises.get(fileId) || [];
      if (activeWrites.length > 0) {
        console.log(`[Receiver] Awaiting ${activeWrites.length} pending writes to IndexedDB for file verification...`);
        await Promise.all(activeWrites);
      }
      
      await deleteTransferMetadata(fileId);
      await this.reconstructAndDownload(fileId, totalChunks, metadata.fileName || metadata.name, metadata.mimeType || metadata.type);

      await addHistory({
        fileName: metadata.fileName || metadata.name,
        fileSize: metadata.fileSize || metadata.size,
        fileType: metadata.mimeType || metadata.type || 'application/octet-stream',
        direction: 'receive',
        peerName: 'Sender',
        status: 'completed',
        speed: this.totalBytesTransferred / (Date.now() - (this.startTime || Date.now())) * 1000,
        timestamp: Date.now(),
      });

      // Confirm verification back to sender
      const verifySuccess = serializeControl(PacketType.FILE_COMPLETE, fileId);
      this.webrtc.send(verifySuccess);

      const currentActiveFiles = useReceiverStore.getState().activeFiles.map(f => {
        if (f.id === fileId) {
          return {
            ...f,
            progress: 100,
            status: 'completed' as const,
          };
        }
        return f;
      });

      this.currentFileIndex++;
      if (this.currentFileIndex >= this.activeFilesMeta.length) {
        useReceiverStore.getState().updateReceiverState({
          status: 'complete',
          activeFiles: currentActiveFiles,
        });
      } else {
        useReceiverStore.getState().updateReceiverState({
          status: 'waiting_metadata',
          metadata: this.activeFilesMeta[this.currentFileIndex],
          activeFiles: currentActiveFiles,
        });
      }
    } else {
      console.error('[Receiver] Missing chunks on verify!', receivedSet?.size, '/', totalChunks);
      this.webrtc.send(JSON.stringify({
        type: 'request-missing-verification',
        fileId,
      }));
    }
  }

  private async reconstructAndDownload(fileId: string, totalChunks: number, fileName: string, fileType: string) {
    const fileSize = this.fileMetadataMap.get(fileId)?.fileSize || 0;

    // 1. Try File System Access API (if supported) for a streaming local save
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await (window as any).showSaveFilePicker({
          suggestedName: fileName,
        });
        const writable = await handle.createWritable();
        
        for (let i = 0; i < totalChunks; i++) {
          const chunk = await getChunk(fileId, i);
          if (!chunk) {
            throw new Error(`Missing chunk ${i} in IndexedDB.`);
          }
          await writable.write(chunk);
        }
        
        await writable.close();
        await clearChunks(fileId, totalChunks);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          console.log('[Receiver] Save file picker cancelled by user.');
          return;
        }
        console.warn('[Receiver] File System Access API failed or requires user gesture, falling back:', err);
      }
    }

    const isLargeFile = fileSize > 50 * 1024 * 1024; // > 50MB

    // 2. Check if Service Worker is active and intercepting download requests
    let useServiceWorkerStream = false;
    if (isLargeFile && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const pingRes = await fetch('/api/download-stream?ping=true');
        if (pingRes.status === 200) {
          useServiceWorkerStream = true;
        }
      } catch (err) {
        console.warn('[Receiver] SW ping failed, falling back to memory buffer:', err);
      }
    }

    if (useServiceWorkerStream) {
      const streamUrl = `/api/download-stream?fileId=${fileId}&name=${encodeURIComponent(fileName)}&type=${encodeURIComponent(fileType)}&size=${fileSize}&totalChunks=${totalChunks}`;
      
      // Use iframe to bypass the browser's link-click SW interception limitation
      try {
        let iframe = document.getElementById('sw-download-iframe') as HTMLIFrameElement;
        if (!iframe) {
          iframe = document.createElement('iframe');
          iframe.id = 'sw-download-iframe';
          iframe.style.display = 'none';
          document.body.appendChild(iframe);
        }
        iframe.src = streamUrl;
        return;
      } catch (err) {
        console.warn('[Receiver] IFrame download failed, falling back to <a> click:', err);
        const a = document.createElement('a');
        a.href = streamUrl;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
    }

    // 3. Fallback: Buffer in memory
    const SAFE_MEMORY_LIMIT = 50 * 1024 * 1024; // 50MB
    if (fileSize > SAFE_MEMORY_LIMIT) {
      const proceed = confirm(
        `Warning: Your browser does not support streaming downloads for large files. ` +
        `This fallback download requires loading the entire file (${Math.round(fileSize / (1024 * 1024))}MB) into your browser's memory, ` +
        `which may crash the tab on some devices. Do you want to proceed anyway?`
      );
      if (!proceed) {
        useReceiverStore.getState().updateReceiverState({
          errorMessage: 'Download cancelled due to size limits in this browser. Please use Chrome/Edge.',
          status: 'error',
        });
        return;
      }
    }

    const chunkArray: ArrayBuffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunk = await getChunk(fileId, i);
      if (!chunk) {
        useReceiverStore.getState().updateReceiverState({
          errorMessage: 'Missing chunks in IndexedDB. Reconstruction failed.',
          status: 'error',
        });
        return;
      }
      chunkArray.push(chunk);
    }

    const blob = new Blob(chunkArray, { type: fileType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    await clearChunks(fileId, totalChunks);
    URL.revokeObjectURL(url);
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

      useReceiverStore.getState().updateReceiverState({
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

  async acceptManualOffer(offerSdp: string): Promise<string> {
    this.cleanUp();
    useReceiverStore.getState().setReceiverStatus('connecting');

    this.webrtc.setupConnection(false);
    this.setupWebRTCCallbacks();

    const answer = await this.webrtc.acceptOffer(offerSdp);
    return answer;
  }

  cleanUp() {
    this.stopSpeedCalculator();
    this.signalling.cleanUp();
    this.webrtc.cleanUp();

    if (this.failTimeout) {
      clearTimeout(this.failTimeout);
      this.failTimeout = null;
    }
    this.isReconnecting = false;

    this.activeFilesMeta = [];
    this.receivedChunksSetMap.clear();
    this.fileChunkSizes.clear();
    this.fileTotalChunks.clear();
    this.fileMetadataMap.clear();
    this.fileWritePromises.clear();
    this.currentFileIndex = 0;
    this.totalSizeToTransfer = 0;
    this.totalBytesTransferred = 0;
  }
}
