import { ConnectionState, FileMetadata, useStore } from '../store/useStore';
import { saveChunk, getChunk, clearChunks, addHistory } from './db';
import { getFileCategory, generateThumbnail } from './fileTypes';

// Pack formatting helpers (Header layout: 56 bytes)
// Layout: sessionId(8B) | fileId(8B) | chunkIndex(4B) | totalChunks(4B) | checksum(32B SHA-256)
export function packChunk(
  sessionId: string, // 8 chars
  fileId: string,    // 8 chars
  chunkIndex: number,
  totalChunks: number,
  checksum: ArrayBuffer, // 32 bytes SHA-256
  data: ArrayBuffer
): ArrayBuffer {
  const headerBuffer = new ArrayBuffer(56);
  const view = new DataView(headerBuffer);
  const encoder = new TextEncoder();

  const sessBytes = encoder.encode(sessionId.padEnd(8).substring(0, 8));
  for (let i = 0; i < 8; i++) {
    view.setUint8(i, sessBytes[i]);
  }

  const fileBytes = encoder.encode(fileId.padEnd(8).substring(0, 8));
  for (let i = 0; i < 8; i++) {
    view.setUint8(8 + i, fileBytes[i]);
  }

  view.setUint32(16, chunkIndex, false); // big-endian
  view.setUint32(20, totalChunks, false);

  const packet = new Uint8Array(56 + data.byteLength);
  packet.set(new Uint8Array(headerBuffer), 0);
  packet.set(new Uint8Array(checksum), 24);
  packet.set(new Uint8Array(data), 56);

  return packet.buffer;
}

export function unpackChunk(packet: ArrayBuffer): {
  sessionId: string;
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  checksum: ArrayBuffer;
  data: ArrayBuffer;
} {
  const view = new DataView(packet, 0, 24);
  const decoder = new TextDecoder();

  const sessBytes = new Uint8Array(packet, 0, 8);
  const sessionId = decoder.decode(sessBytes).trim();

  const fileBytes = new Uint8Array(packet, 8, 8);
  const fileId = decoder.decode(fileBytes).trim();

  const chunkIndex = view.getUint32(16, false);
  const totalChunks = view.getUint32(20, false);

  const checksum = packet.slice(24, 56);
  const data = packet.slice(56);

  return { sessionId, fileId, chunkIndex, totalChunks, checksum, data };
}

const PC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CHUNK_SIZE_MAP = {
  '128KB': 128 * 1024,
  '256KB': 256 * 1024,
  '512KB': 512 * 1024,
  '1MB': 1024 * 1024,
};

export class WebRTCTransferManager {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private isHost: boolean = false;
  private roomId: string | null = null;
  private peerId: string | null = null;
  
  // Polling state
  private pollInterval: any = null;
  private isConnecting: boolean = false;

  // Sending State
  private sendingFiles: File[] = [];
  private currentSendingFileIndex = 0;
  private isSendingPaused = false;
  private sentBytesMap = new Map<string, number>();

  // Receiving State
  private receivedChunksCount = new Map<string, number>();
  private activeFilesMeta: FileMetadata[] = [];
  private fileWritables = new Map<string, FileSystemWritableFileStream>(); // For direct disk write
  private fileMetadataMap = new Map<string, FileMetadata>();
  private fileChunkSizes = new Map<string, number>();
  private currentFileChunks = new Map<number, { data: ArrayBuffer, checksum: ArrayBuffer }>();
  private currentFileTotalChunks = 0;
  private receivedChunksSetMap = new Map<string, Set<number>>();
  private missingChunksMap = new Map<string, Set<number>>();

  // Speed and time calculation
  private speedTimer: any = null;
  private lastBytesTransferred = 0;
  private totalBytesTransferred = 0;
  private totalSizeToTransfer = 0;
  private speedWindow: number[] = [];
  private startTime: number | null = null;
  private peakSpeed = 0;

  // Diagnostic metrics
  private totalSendTime = 0;
  private sendCount = 0;
  private totalVerifyTime = 0;
  private totalWriteTime = 0;
  private receiveCount = 0;

  constructor() {}

  // --- WebRTC Setup & Connection ---

  async initialize(isHost: boolean, roomId: string | null = null) {
    this.cleanUp();
    this.isHost = isHost;
    this.roomId = roomId;

    const displayName = useStore.getState().displayName || 'Device_' + Math.random().toString(36).substring(2, 6).toUpperCase();
    useStore.getState().setDisplayName(displayName);

    if (isHost) {
      // Create room
      try {
        const res = await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'create', displayName }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        this.roomId = data.roomId;
        this.peerId = data.peerId;
        useStore.getState().setRoomInfo(data.roomId, true);
        useStore.getState().setConnectionState('Discovering');

        // Start polling for receiver join
        this.startSignalingPoll();
      } catch (err: any) {
        useStore.getState().setErrorMsg(err.message || 'Failed to create room');
        useStore.getState().setConnectionState('Failed');
      }
    } else {
      // Join room
      if (!roomId) return;
      try {
        const res = await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'join', roomId, displayName }),
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        this.peerId = data.peerId;
        useStore.getState().setRoomInfo(roomId, false);
        useStore.getState().setPeerName(data.hostName);
        useStore.getState().setConnectionState('Connecting');

        // Start polling for host offer (Host initiates connection)
        this.startSignalingPoll();
      } catch (err: any) {
        useStore.getState().setErrorMsg(err.message || 'Failed to join room');
        useStore.getState().setConnectionState('Failed');
      }
    }
  }

  private setupPeerConnection() {
    this.pc = new RTCPeerConnection(PC_CONFIG);

    this.pc.oniceconnectionstatechange = () => {
      const state = this.pc?.iceConnectionState;
      console.log('ICE Connection State:', state);
      if (state === 'connected' || state === 'completed') {
        useStore.getState().setConnectionState('Connected');
        this.stopSignalingPoll();
        this.startSpeedCalculator();
      } else if (state === 'disconnected' || state === 'failed') {
        if (useStore.getState().connectionState !== 'Completed') {
          useStore.getState().setConnectionState('Failed');
          useStore.getState().setErrorMsg('Direct WebRTC connection lost.');
          this.cleanUp();
        }
      }
    };

    if (this.isHost) {
      // Host creates the DataChannel
      this.channel = this.pc.createDataChannel('directshare-channel', { ordered: true });
      this.setupDataChannel(this.channel);
    } else {
      // Client waits for the DataChannel
      this.pc.ondatachannel = (event) => {
        this.channel = event.channel;
        this.setupDataChannel(this.channel);
      };
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 1 * 1024 * 1024; // 1 MB buffer low threshold for high throughput

    channel.onopen = () => {
      console.log('RTC DataChannel Opened!');
      useStore.getState().setConnectionState('Connected');
      
      // Send exchange peer display names
      const name = useStore.getState().displayName;
      channel.send(JSON.stringify({ type: 'peer-info', displayName: name }));

      // If host, automatically initiate the file transmission handshake by sending the selected files list
      if (this.isHost) {
        const selected = useStore.getState().selectedFiles;
        if (selected.length > 0) {
          this.sendSelectedFiles(selected);
        }
      }
    };

    channel.onclose = () => {
      console.log('RTC DataChannel Closed!');
      if (useStore.getState().connectionState !== 'Completed') {
        useStore.getState().setConnectionState('Waiting');
        this.cleanUp();
      }
    };

    channel.onerror = (e) => {
      const err = (e as any).error;
      console.error('Data Channel Error:', err || e);
      const errMsg = err ? `${err.message} (${err.errorDetail})` : 'Data Channel error occurred';
      if (useStore.getState().connectionState !== 'Completed') {
        useStore.getState().setErrorMsg(errMsg);
        useStore.getState().setConnectionState('Failed');
      }
    };

    channel.onmessage = async (event) => {
      if (typeof event.data === 'string') {
        // Handle control messages
        try {
          const msg = JSON.parse(event.data);
          await this.handleControlMessage(msg);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Handle binary chunks
        await this.handleBinaryChunk(event.data);
      }
    };
  }

  // --- Manual SDP Setup for Offline QR Code transfer ---

  async setupManualConnection(isOfferSide: boolean): Promise<string> {
    this.cleanUp();
    this.setupPeerConnection();

    if (isOfferSide) {
      // Offer side creates the channel
      this.channel = this.pc!.createDataChannel('directshare-channel', { ordered: true });
      this.setupDataChannel(this.channel);

      const offer = await this.pc!.createOffer();
      await this.pc!.setLocalDescription(offer);
      await this.waitForIceGathering();
      return JSON.stringify(this.pc!.localDescription);
    }
    return '';
  }

  async acceptManualOffer(offerText: string): Promise<string> {
    this.cleanUp();
    this.setupPeerConnection();

    try {
      const offer = JSON.parse(offerText);
      await this.pc!.setRemoteDescription(new RTCSessionDescription(offer));

      const answer = await this.pc!.createAnswer();
      await this.pc!.setLocalDescription(answer);
      await this.waitForIceGathering();
      return JSON.stringify(this.pc!.localDescription);
    } catch (err: any) {
      throw new Error('Invalid Offer SDP: ' + err.message);
    }
  }

  async acceptManualAnswer(answerText: string) {
    try {
      const answer = JSON.parse(answerText);
      await this.pc!.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (err: any) {
      throw new Error('Invalid Answer SDP: ' + err.message);
    }
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      let resolved = false;

      const done = () => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeoutId);
        if (this.pc) {
          this.pc.removeEventListener('icegatheringstatechange', check);
        }
        resolve();
      };

      if (this.pc?.iceGatheringState === 'complete') {
        done();
        return;
      }

      const check = () => {
        if (this.pc?.iceGatheringState === 'complete') {
          done();
        }
      };

      this.pc?.addEventListener('icegatheringstatechange', check);

      // Fallback timeout of 2 seconds
      const timeoutId = setTimeout(() => {
        console.warn('ICE gathering timed out, proceeding with current candidates.');
        done();
      }, 2000);
    });
  }

  // --- Signaling Loop ---

  private startSignalingPoll() {
    this.stopSignalingPoll();
    this.pollInterval = setInterval(async () => {
      if (!this.roomId || !this.peerId) return;

      try {
        const res = await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'poll',
            roomId: this.roomId,
            peerId: this.peerId,
          }),
        });
        const data = await res.json();
        if (data.error) {
          if (data.error === 'Room not found') {
            this.stopSignalingPoll();
            useStore.getState().setErrorMsg('Signaling session expired or room not found.');
            useStore.getState().setConnectionState('Failed');
            this.cleanUp();
          }
          return;
        }

        if (data.peerName) {
          useStore.getState().setPeerName(data.peerName);
        }

        // Host setup peer connection when client connects (Host is Offerer)
        if (this.isHost && data.peerName && !this.pc && !this.isConnecting) {
          this.isConnecting = true;
          try {
            this.setupPeerConnection();

            // Create local offer
            const offer = await this.pc!.createOffer();
            await this.pc!.setLocalDescription(offer);
            await this.waitForIceGathering();

            // Send local offer to Client
            const resSend = await fetch('/api/signaling', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'send',
                roomId: this.roomId,
                peerId: this.peerId,
                message: { type: 'sdp', sdp: this.pc!.localDescription },
              }),
            });
            const dataSend = await resSend.json();
            if (dataSend.error) {
              console.error('Failed to send SDP offer:', dataSend.error);
            }
          } catch (err: any) {
            console.error('Host peer connection setup failed:', err);
            useStore.getState().setErrorMsg(err.message || 'Failed to establish peer connection');
            useStore.getState().setConnectionState('Failed');
          }
        }

        for (const msg of data.messages) {
          if (msg.type === 'sdp') {
            if (this.isHost) {
              // Host receives SDP Answer from Client
              await this.pc!.setRemoteDescription(new RTCSessionDescription(msg.sdp));
            } else {
              // Client receives SDP Offer from Host
              if (!this.pc) {
                this.setupPeerConnection();
              }
              await this.pc!.setRemoteDescription(new RTCSessionDescription(msg.sdp));

              const answer = await this.pc!.createAnswer();
              await this.pc!.setLocalDescription(answer);
              await this.waitForIceGathering();

              const resSend = await fetch('/api/signaling', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'send',
                  roomId: this.roomId,
                  peerId: this.peerId,
                  message: { type: 'sdp', sdp: this.pc!.localDescription },
                }),
              });
              const dataSend = await resSend.json();
              if (dataSend.error) {
                console.error('Failed to send SDP answer:', dataSend.error);
              }
            }
          }
        }
      } catch (err) {
        console.error('Signaling poll error:', err);
      }
    }, 1200);
  }

  private stopSignalingPoll() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // --- File Control Logic ---

  private async handleControlMessage(msg: any) {
    if (msg.type === 'peer-info') {
      useStore.getState().setPeerName(msg.displayName);
    } else if (msg.type === 'file-list') {
      this.activeFilesMeta = msg.files.map((f: any) => ({
        id: f.id,
        name: f.name,
        size: f.size,
        type: f.type,
        progress: 0,
        status: 'pending',
        category: f.category,
        thumbnail: f.thumbnail,
      }));
      useStore.getState().setActiveFiles(this.activeFilesMeta);

      // Setup file size to transfer for display
      this.totalSizeToTransfer = msg.files.reduce((acc: number, cur: any) => acc + cur.size, 0);
      this.totalBytesTransferred = 0;
      this.lastBytesTransferred = 0;
      this.receivedChunksCount.clear();
      this.receivedChunksSetMap.clear();
      this.missingChunksMap.clear();

      // Set connection state to Receiving so user gets the Accept/Reject invitation prompt
      useStore.getState().setConnectionState('Receiving');
    } else if (msg.type === 'file-list-accepted') {
      if (msg.accepted) {
        useStore.getState().setConnectionState('Sending');
        this.currentSendingFileIndex = 0;
        this.isSendingPaused = false;
        this.totalSizeToTransfer = this.sendingFiles.reduce((acc, f) => acc + f.size, 0);
        this.totalBytesTransferred = 0;
        this.lastBytesTransferred = 0;
        this.sentBytesMap.clear();

        // Start sending the first file
        this.streamNextFile();
      } else {
        useStore.getState().setErrorMsg('Transfer request rejected by peer.');
        useStore.getState().setConnectionState('Failed');
      }
    } else if (msg.type === 'file-start') {
      const { fileId, name, size, fileType, totalChunks, chunkSize } = msg;
      const existingMeta = this.activeFilesMeta.find((f) => f.id === fileId);
      const fileMeta: FileMetadata = {
        id: fileId,
        name,
        size,
        type: fileType || 'application/octet-stream',
        progress: 0,
        status: 'transferring',
        category: existingMeta?.category,
        thumbnail: existingMeta?.thumbnail,
      };
      this.fileMetadataMap.set(fileId, fileMeta);
      useStore.getState().updateActiveFileProgress(fileId, 0, 'transferring');
      this.receivedChunksCount.set(fileId, 0);
      this.receivedChunksSetMap.set(fileId, new Set<number>());
      this.missingChunksMap.set(fileId, new Set<number>());

      if (chunkSize) {
        this.fileChunkSizes.set(fileId, chunkSize);
      }

      // Keep track of the current transferring file's index on the receiver side
      const fileIndex = this.activeFilesMeta.findIndex((f) => f.id === fileId);
      if (fileIndex !== -1) {
        this.currentSendingFileIndex = fileIndex;
      }

      // Check if we can prompt the user to save the file
      if ('showSaveFilePicker' in window) {
        try {
          // Attempt direct disk stream if user allows (will do fallback if rejected)
          // Since showSaveFilePicker requires a user interaction, we might fallback to IndexedDB 
          // if it fails or if we do it in a button click. Let's design IndexedDB as default,
          // but we can ask the user on UI for direct saving.
        } catch (e) {
          console.warn('Direct file save skipped, using IndexedDB fallback.', e);
        }
      }
    } else if (msg.type === 'file-pause') {
      this.isSendingPaused = true;
      useStore.getState().setConnectionState('Paused');
    } else if (msg.type === 'file-resume') {
      this.isSendingPaused = false;
      useStore.getState().setConnectionState('Sending');
      this.streamNextFile();
    } else if (msg.type === 'file-cancel') {
      useStore.getState().setErrorMsg('Transfer cancelled by peer.');
      useStore.getState().setConnectionState('Failed');
      this.cleanUp();
    } else if (msg.type === 'file-sent') {
      const { fileId, totalChunks } = msg;
      
      let receivedSet = this.receivedChunksSetMap.get(fileId);
      if (!receivedSet) {
        receivedSet = new Set<number>();
        this.receivedChunksSetMap.set(fileId, receivedSet);
      }

      let missingSet = this.missingChunksMap.get(fileId);
      if (!missingSet) {
        missingSet = new Set<number>();
        this.missingChunksMap.set(fileId, missingSet);
      }

      // Check for any missing chunks that were never received
      for (let i = 0; i < totalChunks; i++) {
        if (!receivedSet.has(i)) {
          missingSet.add(i);
        }
      }

      if (missingSet.size > 0) {
        // Display status
        useStore.getState().setErrorMsg("Waiting for missing chunks...");
        console.log(`[Receiver] Missing chunks detected for file ${fileId}. Requesting retransmission of:`, Array.from(missingSet));

        // Request retransmission
        this.channel?.send(JSON.stringify({
          type: 'request-retransmission',
          fileId,
          missingChunks: Array.from(missingSet),
        }));
      } else {
        // All chunks are present and verified! Clear any error/warning
        useStore.getState().setErrorMsg(null);
        useStore.getState().updateActiveFileProgress(fileId, 100, 'completed');

        // Reconstruct file
        const meta = this.fileMetadataMap.get(fileId);
        const writable = this.fileWritables.get(fileId);
        if (meta) {
          if (writable) {
            await writable.close();
            this.fileWritables.delete(fileId);
          } else {
            await this.reconstructAndDownload(fileId, totalChunks, meta.name, meta.type);
          }

          // Write to history
          await addHistory({
            fileName: meta.name,
            fileSize: meta.size,
            fileType: meta.type,
            direction: 'receive',
            peerName: useStore.getState().peerName || 'Sender',
            status: 'completed',
            speed: this.totalBytesTransferred / (useStore.getState().transferProgress > 0 ? 1 : 1),
            timestamp: Date.now(),
          });
        }

        // Notify sender of success
        this.channel?.send(JSON.stringify({
          type: 'file-success',
          fileId,
        }));

        // Check if all files are complete
        let allComplete = true;
        useStore.getState().activeFiles.forEach((f) => {
          if (f.status !== 'completed') allComplete = false;
        });

        if (allComplete) {
          useStore.getState().setConnectionState('Completed');
        }
      }
    } else if (msg.type === 'request-retransmission') {
      const { fileId, missingChunks } = msg;
      console.log(`[Sender] Peer requested retransmission of chunks for file ${fileId}:`, missingChunks);
      
      for (const index of missingChunks) {
        const chunk = this.currentFileChunks.get(index);
        if (chunk) {
          // Pack and send the chunk again
          const packet = packChunk(this.roomId || 'manual', fileId, index, this.currentFileTotalChunks, chunk.checksum, chunk.data);
          this.channel?.send(packet);
          console.log(`[Sender] Resent chunk ${index}`);
        }
      }
      
      // Once finished resending all requested chunks, send 'file-sent' again
      this.channel?.send(JSON.stringify({
        type: 'file-sent',
        fileId,
        totalChunks: this.currentFileTotalChunks,
      }));
    } else if (msg.type === 'file-success') {
      const { fileId } = msg;
      this.currentFileChunks.clear();
      useStore.getState().updateActiveFileProgress(fileId, 100, 'completed');
      this.currentSendingFileIndex++;
      setTimeout(() => this.streamNextFile(), 200);
    }
  }

  acceptTransfer(approved: boolean) {
    if (!this.channel) return;
    
    if (approved) {
      const acceptedIds = this.activeFilesMeta.map((f) => f.id);
      this.channel.send(JSON.stringify({
        type: 'file-list-accepted',
        accepted: true,
        fileIds: acceptedIds,
      }));
      
      // Set connection state to connected
      useStore.getState().setConnectionState('Connected');
      this.startSpeedCalculator();
    } else {
      this.channel.send(JSON.stringify({
        type: 'file-list-accepted',
        accepted: false,
        fileIds: [],
      }));
      useStore.getState().setConnectionState('Connected'); // Reset to idle connected state
      this.activeFilesMeta = [];
      useStore.getState().setActiveFiles([]);
    }
  }

  // --- Binary Streaming Sender (With Backpressure) ---

  async sendSelectedFiles(files: File[]) {
    this.sendingFiles = files;
    
    const metaList = await Promise.all(
      files.map(async (f) => {
        const id = Math.random().toString(36).substring(2, 10); // 8 chars
        const category = getFileCategory(f.name, f.type);
        const thumbnail = await generateThumbnail(f);
        return {
          id,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          progress: 0,
          status: 'pending' as const,
          category,
          thumbnail,
        };
      })
    );

    useStore.getState().setSelectedFiles(files);
    useStore.getState().setActiveFiles(metaList);

    // Send file list to peer
    this.channel?.send(JSON.stringify({
      type: 'file-list',
      files: metaList.map((m) => ({
        id: m.id,
        name: m.name,
        size: m.size,
        type: m.type,
        category: m.category,
        thumbnail: m.thumbnail,
      })),
    }));
  }

  private getSafeChunkSize(): number {
    const preset = useStore.getState().chunkSizePreset;
    const requestedSize = CHUNK_SIZE_MAP[preset];

    // Determine maxMessageSize of the peer connection SCTP transport
    let maxMsgSize = this.pc?.sctp?.maxMessageSize;
    if (maxMsgSize === undefined || maxMsgSize === 0) {
      // Fallback: 256KB is the safest standard limit for Chromium data channels
      maxMsgSize = 262144;
    }

    // Leave 1024 bytes buffer for headers (28 bytes) and safety margin
    const maxSafeSize = maxMsgSize - 1024;
    
    // Return the minimum of requested and safe size
    return Math.min(requestedSize, maxSafeSize);
  }

  private streamNextFile() {
    if (this.currentSendingFileIndex >= this.sendingFiles.length) {
      // All files sent!
      useStore.getState().setConnectionState('Completed');
      
      // Record in local history DB
      const active = useStore.getState().activeFiles;
      active.forEach(async (f) => {
        await addHistory({
          fileName: f.name,
          fileSize: f.size,
          fileType: f.type,
          direction: 'send',
          peerName: useStore.getState().peerName || 'Receiver',
          status: 'completed',
          speed: this.totalSizeToTransfer / (useStore.getState().transferProgress > 0 ? 1 : 1), // rough estimate
          timestamp: Date.now(),
        });
      });

      return;
    }

    const file = this.sendingFiles[this.currentSendingFileIndex];
    const meta = useStore.getState().activeFiles[this.currentSendingFileIndex];
    const fileId = meta.id;
    const sessionId = this.roomId || 'manual';

    // Get dynamic safe chunk size
    const chunkSize = this.getSafeChunkSize();

    const totalChunks = Math.ceil(file.size / chunkSize);

    // Store metadata for retransmission
    this.currentFileTotalChunks = totalChunks;
    this.currentFileChunks.clear();

    // Send file-start metadata
    this.channel?.send(JSON.stringify({
      type: 'file-start',
      fileId,
      name: file.name,
      size: file.size,
      fileType: file.type || 'application/octet-stream',
      totalChunks,
      chunkSize,
    }));

    useStore.getState().updateActiveFileProgress(fileId, 0, 'transferring');

    // Start Web Worker for slicing & hashing
    const worker = new Worker('/transferWorker.js');
    worker.postMessage({
      type: 'START_CHUNKING',
      payload: {
        file,
        fileId,
        sessionId,
        chunkSize,
      },
    });

    let currentChunkIndex = 0;
    const chunkBuffer: ArrayBuffer[] = [];
    const chunkChecksums: ArrayBuffer[] = [];
    let isWorkerFinished = false;

    const sendChunks = () => {
      if (this.isSendingPaused || useStore.getState().connectionState !== 'Sending') {
        worker.terminate();
        return;
      }

      while (chunkBuffer.length > 0) {
        const bufferedAmount = this.channel?.bufferedAmount || 0;
        const limit = 4 * 1024 * 1024; // 4 MB buffer threshold for streaming pipeline

        if (bufferedAmount > limit) {
          // DataChannel buffer full! Pause and wait for bufferedamountlow
          this.channel!.onbufferedamountlow = () => {
            this.channel!.onbufferedamountlow = null;
            sendChunks();
          };
          return;
        }

        const data = chunkBuffer.shift()!;
        const checksum = chunkChecksums.shift()!;
        const index = currentChunkIndex++;

        // Pack & send binary packet
        const packet = packChunk(sessionId, fileId, index, totalChunks, checksum, data);
        
        const tStartSend = performance.now();
        this.channel?.send(packet);
        const tEndSend = performance.now();
        this.totalSendTime += (tEndSend - tStartSend);
        this.sendCount++;

        if (this.sendCount > 0 && this.sendCount % 100 === 0) {
          console.log(`[Sender Diagnostic] Chunks ${this.sendCount-100}-${this.sendCount} Avg Channel Send Time: ${(this.totalSendTime / 100).toFixed(2)}ms`);
          this.totalSendTime = 0;
        }

        // Update overall transfer metrics
        const sentForThisFile = (index + 1) * chunkSize;
        const actualSent = Math.min(sentForThisFile, file.size);
        this.sentBytesMap.set(fileId, actualSent);

        let totalSent = 0;
        this.sentBytesMap.forEach((bytes) => {
          totalSent += bytes;
        });

        this.totalBytesTransferred = totalSent;

        const fileProg = Math.min(Math.round((actualSent / file.size) * 100), 100);
        useStore.getState().updateActiveFileProgress(fileId, fileProg);
      }

      if (isWorkerFinished && chunkBuffer.length === 0) {
        // Finished initial streaming of this file
        worker.terminate();
        
        // Notify receiver that initial stream is finished
        this.channel?.send(JSON.stringify({
          type: 'file-sent',
          fileId,
          totalChunks,
        }));
      }
    };

    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'CHUNK_GENERATED') {
        // Store chunk in memory cache for retransmission
        this.currentFileChunks.set(payload.chunkIndex, {
          data: payload.data,
          checksum: payload.checksum,
        });

        chunkBuffer.push(payload.data);
        chunkChecksums.push(payload.checksum);
        sendChunks();
      } else if (type === 'CHUNKING_COMPLETE') {
        isWorkerFinished = true;
        sendChunks();
      } else if (type === 'CHUNKING_ERROR') {
        console.error('Worker error:', payload.error);
        useStore.getState().setErrorMsg('Error generating file chunks');
        useStore.getState().setConnectionState('Failed');
        worker.terminate();
      }
    };
  }

  // --- Binary Streaming Receiver ---

  private async handleBinaryChunk(packet: ArrayBuffer) {
    const { sessionId, fileId, chunkIndex, totalChunks, checksum, data } = unpackChunk(packet);
    
    // Verify chunk checksum (SHA-256)
    const tStartVerify = performance.now();
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = new Uint8Array(hashBuffer);
    const expectedArray = new Uint8Array(checksum);
    let match = true;
    for (let i = 0; i < 32; i++) {
      if (hashArray[i] !== expectedArray[i]) {
        match = false;
        break;
      }
    }
    const tEndVerify = performance.now();
    this.totalVerifyTime += (tEndVerify - tStartVerify);

    if (!match) {
      console.error("Corrupted chunk:", chunkIndex);
      console.log("Requesting retransmission");

      let missingSet = this.missingChunksMap.get(fileId);
      if (!missingSet) {
        missingSet = new Set<number>();
        this.missingChunksMap.set(fileId, missingSet);
      }
      missingSet.add(chunkIndex);

      useStore.getState().setErrorMsg("A damaged chunk was detected. Requesting retransmission... Transfer will continue automatically.");
      return;
    }

    console.log(`Chunk ${chunkIndex} received`);
    console.log("Checksum verification passed");

    let receivedSet = this.receivedChunksSetMap.get(fileId);
    if (!receivedSet) {
      receivedSet = new Set<number>();
      this.receivedChunksSetMap.set(fileId, receivedSet);
    }

    // Ignore duplicate chunks
    if (receivedSet.has(chunkIndex)) {
      return;
    }

    // Mark chunk as valid/received and remove from missing chunks
    receivedSet.add(chunkIndex);
    
    let missingSet = this.missingChunksMap.get(fileId);
    if (missingSet) {
      missingSet.delete(chunkIndex);
    }

    // Clear error message if integrity issues are resolved
    const currentError = useStore.getState().errorMsg;
    if (currentError && 
        (currentError.includes("damaged chunk") || currentError.includes("Waiting for missing chunks")) && 
        (!missingSet || missingSet.size === 0)) {
      useStore.getState().setErrorMsg(null);
    }

    // Write chunk
    const writable = this.fileWritables.get(fileId);
    const chunkSize = this.fileChunkSizes.get(fileId) || CHUNK_SIZE_MAP[useStore.getState().chunkSizePreset];
    
    const tStartWrite = performance.now();
    if (writable) {
      // Write directly to disk
      const startPos = chunkIndex * chunkSize;
      await writable.write({ type: 'write', position: startPos, data });
    } else {
      // Fallback: Save in IndexedDB
      await saveChunk(fileId, chunkIndex, data);
    }
    const tEndWrite = performance.now();
    this.totalWriteTime += (tEndWrite - tStartWrite);

    this.receiveCount++;
    if (this.receiveCount > 0 && this.receiveCount % 100 === 0) {
      console.log(`[Receiver Diagnostic] Chunks ${this.receiveCount-100}-${this.receiveCount} Avg Verify Time: ${(this.totalVerifyTime / 100).toFixed(2)}ms, Avg Write Time: ${(this.totalWriteTime / 100).toFixed(2)}ms`);
      this.totalVerifyTime = 0;
      this.totalWriteTime = 0;
    }

    // Update Progress
    const meta = this.fileMetadataMap.get(fileId);
    if (meta) {
      const fileProgress = Math.min(Math.round((receivedSet.size / totalChunks) * 100), 100);
      useStore.getState().updateActiveFileProgress(fileId, fileProgress);

      // Calculate total bytes received
      let receivedBytesSoFar = 0;
      this.receivedChunksSetMap.forEach((set, id) => {
        const fileMeta = this.fileMetadataMap.get(id);
        if (fileMeta) {
          const fChunkSize = this.fileChunkSizes.get(id) || CHUNK_SIZE_MAP[useStore.getState().chunkSizePreset];
          const bytes = Math.min(set.size * fChunkSize, fileMeta.size);
          receivedBytesSoFar += bytes;
        }
      });
      this.totalBytesTransferred = receivedBytesSoFar;
    }
  }

  private async reconstructAndDownload(fileId: string, totalChunks: number, fileName: string, fileType: string) {
    const meta = this.fileMetadataMap.get(fileId);
    const fileSize = meta ? meta.size : 0;

    // Check if Service Worker is active and ready to intercept streaming download
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const streamUrl = `/api/download-stream?fileId=${fileId}&name=${encodeURIComponent(fileName)}&type=${encodeURIComponent(fileType)}&size=${fileSize}&totalChunks=${totalChunks}`;
      
      // Trigger download
      const a = document.createElement('a');
      a.href = streamUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // Fallback: standard Blob reconstruction (in case service worker is not active)
    const chunkArray: ArrayBuffer[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunk = await getChunk(fileId, i);
      if (!chunk) {
        useStore.getState().setErrorMsg('Missing file chunks in database. Reconstruction aborted.');
        useStore.getState().setConnectionState('Failed');
        return;
      }
      chunkArray.push(chunk);
    }

    const blob = new Blob(chunkArray, { type: fileType });
    const url = URL.createObjectURL(blob);

    // Trigger auto-download
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Clean up DB chunks
    await clearChunks(fileId, totalChunks);
    URL.revokeObjectURL(url);
  }

  // --- Transfer Control Actions ---

  pause() {
    if (useStore.getState().connectionState === 'Sending') {
      this.isSendingPaused = true;
      useStore.getState().setConnectionState('Paused');
      this.channel?.send(JSON.stringify({ type: 'file-pause' }));
    }
  }

  resume() {
    if (useStore.getState().connectionState === 'Paused') {
      this.isSendingPaused = false;
      useStore.getState().setConnectionState('Sending');
      this.channel?.send(JSON.stringify({ type: 'file-resume' }));
      this.streamNextFile();
    }
  }

  cancel() {
    this.channel?.send(JSON.stringify({ type: 'file-cancel' }));
    useStore.getState().setConnectionState('Waiting');
    this.cleanUp();
  }

  // --- Metrics Speed Calculator ---

  private startSpeedCalculator() {
    this.stopSpeedCalculator();
    this.lastBytesTransferred = 0;
    this.totalBytesTransferred = 0;
    this.speedWindow = [];
    this.startTime = Date.now();
    this.peakSpeed = 0;

    this.speedTimer = setInterval(() => {
      const bytesTransferredThisSecond = Math.max(0, this.totalBytesTransferred - this.lastBytesTransferred);
      this.lastBytesTransferred = this.totalBytesTransferred;

      // Peak Speed
      if (bytesTransferredThisSecond > this.peakSpeed) {
        this.peakSpeed = bytesTransferredThisSecond;
      }

      // Add to window for moving average (Current Speed)
      this.speedWindow.push(bytesTransferredThisSecond);
      if (this.speedWindow.length > 3) this.speedWindow.shift();
      const currentSpeed = this.speedWindow.reduce((a, b) => a + b, 0) / this.speedWindow.length;

      // Average Speed over entire transfer
      const elapsedSeconds = (Date.now() - (this.startTime || Date.now())) / 1000;
      const averageSpeed = elapsedSeconds > 0 ? this.totalBytesTransferred / elapsedSeconds : currentSpeed;

      const progress = this.totalSizeToTransfer > 0 ? (this.totalBytesTransferred / this.totalSizeToTransfer) * 100 : 0;
      
      const remainingBytes = Math.max(0, this.totalSizeToTransfer - this.totalBytesTransferred);
      const remainingTime = currentSpeed > 0 ? Math.round(remainingBytes / currentSpeed) : null;

      useStore.getState().updateTransferMetrics({
        progress: Math.min(Math.round(progress), 100),
        speed: averageSpeed, // We use average speed for overall
        speedCurrent: currentSpeed,
        speedPeak: this.peakSpeed,
        remainingTime,
        currentFileName: useStore.getState().activeFiles[this.currentSendingFileIndex]?.name || '',
        currentFileIndex: Math.min(this.currentSendingFileIndex + 1, useStore.getState().totalFilesCount),
        totalFilesCount: useStore.getState().totalFilesCount,
      });
    }, 1000);
  }

  private stopSpeedCalculator() {
    if (this.speedTimer) {
      clearInterval(this.speedTimer);
      this.speedTimer = null;
    }
  }

  // --- Clean Up ---

  cleanUp() {
    this.stopSignalingPoll();
    this.stopSpeedCalculator();

    if (this.channel) {
      try {
        this.channel.close();
      } catch (e) {}
      this.channel = null;
    }

    if (this.pc) {
      try {
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }

    this.roomId = null;
    this.peerId = null;
    this.isHost = false;
    this.isConnecting = false;
    this.sendingFiles = [];
    this.currentSendingFileIndex = 0;
    this.isSendingPaused = false;
    this.sentBytesMap.clear();
    this.receivedChunksCount.clear();
    this.fileWritables.clear();
    this.fileMetadataMap.clear();
    this.fileChunkSizes.clear();
    this.currentFileChunks.clear();
    this.currentFileTotalChunks = 0;
    this.receivedChunksSetMap.clear();
    this.missingChunksMap.clear();
    this.activeFilesMeta = [];
    this.totalSendTime = 0;
    this.sendCount = 0;
    this.totalVerifyTime = 0;
    this.totalWriteTime = 0;
    this.receiveCount = 0;
    this.peakSpeed = 0;
    this.startTime = null;
  }
}

// Global Singleton instance
export const transferManager = new WebRTCTransferManager();
