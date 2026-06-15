import { SignallingService } from './SignallingService';
import { WebRTCService } from './WebRTCService';
import { useReceiverStore } from '../store/receiverStore';
import { PacketType } from '../types/packets';
import { deserializeMetadata, deserializeChunk, serializeAck, serializeControl } from '../lib/serializer';
import { getFileCategory } from '../utils/fileTypes';
import { crc32 } from '../lib/crc32';
import {
  saveChunk,
  getChunk,
  clearChunks,
  addHistory,
  saveTransferMetadata,
  getTransferMetadata,
  deleteTransferMetadata,
  markChunkCompleted,
  TransferMetadata
} from '../utils/db';

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
        // Pings/pongs update smoothed RTT on the sender's end, receiver just ignores/logs.
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

        // Trigger invitation display in UI
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

    // Update status to show reconnecting
    useReceiverStore.getState().updateReceiverState({
      errorMessage: 'Connection unstable. Reconnecting...',
      status: 'connecting',
    });

    // Resume polling so signaling works
    this.signalling.startPolling(
      (msg) => this.handleSignalingMessage(msg),
      (name) => {
        useReceiverStore.getState().updateReceiverState({ peerName: name });
      },
      () => {
        this.handleDisconnect();
      }
    );

    // 30 seconds failure timeout
    this.failTimeout = setTimeout(() => {
      if (this.isReconnecting) {
        console.error('[Receiver] Connection failed to recover within 30 seconds.');
        useReceiverStore.getState().updateReceiverState({
          errorMessage: 'Connection lost. Reconnection timed out.',
          status: 'error',
        });
        this.cleanUp();
      }
    }, 30000);
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
        const answer = await this.webrtc.acceptOffer(JSON.stringify(msg.sdp));
        await this.signalling.sendMessage({ type: 'sdp', sdp: JSON.parse(answer) });
      } catch (err: any) {
        console.error('[Receiver] Accept offer failed:', err);
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

  private async handleFileMetadata(metadata: any) {
    const { fileId, fileName, fileSize, mimeType, totalChunks, chunkSize } = metadata;
    
    this.fileTotalChunks.set(fileId, totalChunks);
    this.fileChunkSizes.set(fileId, chunkSize);
    this.fileMetadataMap.set(fileId, metadata);

    const existingMeta = await getTransferMetadata(fileId);
    let completedChunks: number[] = [];

    if (existingMeta && existingMeta.size === fileSize) {
      completedChunks = existingMeta.completedChunks;
      console.log(`[Receiver] Resuming transfer. Completed: ${completedChunks.length}/${totalChunks}`);
    } else {
      const newMeta: TransferMetadata = {
        fileId,
        name: fileName,
        size: fileSize,
        type: mimeType,
        totalChunks,
        completedChunks: [],
        sessionKey: this.signalling.getRoomId(),
        timestamp: Date.now(),
      };
      await saveTransferMetadata(newMeta);
    }

    this.receivedChunksSetMap.set(fileId, new Set<number>(completedChunks));

    const meta = {
      fileId,
      fileName,
      fileSize,
      mimeType,
      totalChunks,
      chunkSize,
      checksum: metadata.checksum,
      createdAt: metadata.createdAt,
    };

    const fileIndex = this.activeFilesMeta.findIndex(f => f.id === fileId);
    if (fileIndex !== -1) {
      this.currentFileIndex = fileIndex;
    }

    const currentActiveFiles = useReceiverStore.getState().activeFiles.map(f => {
      if (f.id === fileId) {
        return {
          ...f,
          progress: totalChunks > 0 ? Math.round((completedChunks.length / totalChunks) * 100) : 0,
          status: 'transferring' as const,
        };
      }
      return f;
    });

    useReceiverStore.getState().updateReceiverState({
      status: 'receiving',
      metadata: meta,
      nextExpected: this.findNextExpected(fileId, completedChunks, totalChunks),
      chunksReceived: completedChunks.length,
      bytesReceived: completedChunks.length * chunkSize,
      activeFiles: currentActiveFiles,
    });

    // Send ACK back to sender to begin worker execution
    this.webrtc.send(JSON.stringify({
      type: 'file-start-ack',
      fileId,
      completedChunks,
    }));
  }

  private findNextExpected(fileId: string, completed: number[], total: number): number {
    const set = new Set(completed);
    for (let i = 0; i < total; i++) {
      if (!set.has(i)) return i;
    }
    return total;
  }

  private async handleChunk(chunk: any) {
    const { fileId, sequenceNumber, totalChunks, chunkChecksum, payload } = chunk;

    // CRC validation
    const computedCrc = crc32(payload);
    if (computedCrc !== chunkChecksum) {
      console.error(`[Receiver] CRC-32 checksum mismatch on chunk ${sequenceNumber}! Got: ${computedCrc}, Expected: ${chunkChecksum}`);
      // Send NACK to trigger immediate sender retransmission
      const nackBuffer = serializeAck(PacketType.NACK, fileId, sequenceNumber);
      this.webrtc.send(nackBuffer);
      return;
    }

    let receivedSet = this.receivedChunksSetMap.get(fileId);
    if (!receivedSet) {
      receivedSet = new Set<number>();
      this.receivedChunksSetMap.set(fileId, receivedSet);
    }

    // Duplicate detection
    if (receivedSet.has(sequenceNumber)) {
      // Re-send ACK to slide window in case it was lost
      const ackBuffer = serializeAck(PacketType.ACK, fileId, sequenceNumber);
      this.webrtc.send(ackBuffer);
      return;
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

    // Send ACK back
    const ackBuffer = serializeAck(PacketType.ACK, fileId, sequenceNumber);
    this.webrtc.send(ackBuffer);

    // Update state progress
    const activeMeta = useReceiverStore.getState().metadata;
    if (activeMeta && activeMeta.fileId === fileId) {
      const nextExpected = this.findNextExpected(fileId, Array.from(receivedSet), totalChunks);
      
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
      
      // Await any pending database writes for this file
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

      // Confirm verification
      const verifySuccess = serializeControl(PacketType.FILE_COMPLETE, fileId);
      this.webrtc.send(verifySuccess);

      // Update activeFiles status in store
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

      // Check if all files completed
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
    const isLargeFile = fileSize > 50 * 1024 * 1024; // > 50MB

    // Check for Service Worker stream downloads (only for large files to avoid SW overhead and localhost issues)
    if (isLargeFile && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const streamUrl = `/api/download-stream?fileId=${fileId}&name=${encodeURIComponent(fileName)}&type=${encodeURIComponent(fileType)}&size=${fileSize}&totalChunks=${totalChunks}`;
      const a = document.createElement('a');
      a.href = streamUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Fallback: Buffer in memory
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
