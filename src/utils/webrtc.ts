import { ConnectionState, FileMetadata, useStore } from '../store/useStore';
import { saveChunk, getChunk, clearChunks, addHistory } from './db';

// Pack formatting helpers (Header layout: 28 bytes)
export function packChunk(
  sessionId: string, // 8 chars
  fileId: string,    // 8 chars
  chunkIndex: number,
  totalChunks: number,
  checksum: number,
  data: ArrayBuffer
): ArrayBuffer {
  const headerBuffer = new ArrayBuffer(28);
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
  view.setUint32(24, checksum, false);

  const packet = new Uint8Array(28 + data.byteLength);
  packet.set(new Uint8Array(headerBuffer), 0);
  packet.set(new Uint8Array(data), 28);

  return packet.buffer;
}

export function unpackChunk(packet: ArrayBuffer): {
  sessionId: string;
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  checksum: number;
  data: ArrayBuffer;
} {
  const view = new DataView(packet, 0, 28);
  const decoder = new TextDecoder();

  const sessBytes = new Uint8Array(packet, 0, 8);
  const sessionId = decoder.decode(sessBytes).trim();

  const fileBytes = new Uint8Array(packet, 8, 8);
  const fileId = decoder.decode(fileBytes).trim();

  const chunkIndex = view.getUint32(16, false);
  const totalChunks = view.getUint32(20, false);
  const checksum = view.getUint32(24, false);

  const data = packet.slice(28);

  return { sessionId, fileId, chunkIndex, totalChunks, checksum, data };
}

// Adler-32 Checksum
export function computeAdler32(data: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (let i = 0; i < data.length; i++) {
    a += data[i];
    b += a;
  }
  a %= 65521;
  b %= 65521;
  return (b << 16) | a;
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

  // Speed and time calculation
  private speedTimer: any = null;
  private lastBytesTransferred = 0;
  private totalBytesTransferred = 0;
  private totalSizeToTransfer = 0;
  private speedWindow: number[] = [];

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

        // Initialize PeerConnection
        this.setupPeerConnection();

        // Create manual offer since client connects
        const offer = await this.pc!.createOffer();
        await this.pc!.setLocalDescription(offer);

        // Wait for ICE complete
        useStore.getState().setConnectionState('Connecting');
        await this.waitForIceGathering();

        // Send local description to Host
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
        if (dataSend.error) throw new Error(dataSend.error);

        // Start polling for host response
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
      if (state === 'connected') {
        useStore.getState().setConnectionState('Connected');
        this.stopSignalingPoll();
        this.startSpeedCalculator();
      } else if (state === 'disconnected' || state === 'failed') {
        useStore.getState().setConnectionState('Failed');
        useStore.getState().setErrorMsg('Direct WebRTC connection lost.');
        this.cleanUp();
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
      useStore.getState().setConnectionState('Waiting');
      this.cleanUp();
    };

    channel.onerror = (e) => {
      console.error('Data Channel Error:', e);
      useStore.getState().setErrorMsg('Data Channel error occurred');
      useStore.getState().setConnectionState('Failed');
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
      if (this.pc?.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const check = () => {
        if (this.pc?.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      this.pc?.addEventListener('icegatheringstatechange', check);
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

        // Host setup peer connection when client connects
        if (this.isHost && data.peerName && !this.pc && !this.isConnecting) {
          this.isConnecting = true;
          this.setupPeerConnection();
        }

        for (const msg of data.messages) {
          if (msg.type === 'sdp') {
            await this.pc!.setRemoteDescription(new RTCSessionDescription(msg.sdp));

            if (this.isHost) {
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
      }));
      useStore.getState().setActiveFiles(this.activeFilesMeta);

      // Setup file size to transfer for display
      this.totalSizeToTransfer = msg.files.reduce((acc: number, cur: any) => acc + cur.size, 0);
      this.totalBytesTransferred = 0;
      this.lastBytesTransferred = 0;
      this.receivedChunksCount.clear();

      // Change state to Receiving and await manual user approval
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
      const { fileId, name, size, fileType, totalChunks } = msg;
      const fileMeta: FileMetadata = {
        id: fileId,
        name,
        size,
        type: fileType || 'application/octet-stream',
        progress: 0,
        status: 'transferring',
      };
      this.fileMetadataMap.set(fileId, fileMeta);
      useStore.getState().updateActiveFileProgress(fileId, 0, 'transferring');
      this.receivedChunksCount.set(fileId, 0);

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
    const metaList = files.map((f, i) => ({
      id: Math.random().toString(36).substring(2, 10), // 8 chars
      name: f.name,
      size: f.size,
      type: f.type || 'application/octet-stream',
      progress: 0,
      status: 'pending' as const,
    }));

    useStore.getState().setSelectedFiles(files);
    useStore.getState().setActiveFiles(metaList);

    // Send file list to peer
    this.channel?.send(JSON.stringify({
      type: 'file-list',
      files: metaList,
    }));
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

    // Get chunk size
    const preset = useStore.getState().chunkSizePreset;
    const chunkSize = CHUNK_SIZE_MAP[preset];

    const totalChunks = Math.ceil(file.size / chunkSize);

    // Send file-start metadata
    this.channel?.send(JSON.stringify({
      type: 'file-start',
      fileId,
      name: file.name,
      size: file.size,
      fileType: file.type || 'application/octet-stream',
      totalChunks,
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
    const chunkChecksums: number[] = [];
    let isWorkerFinished = false;

    const sendChunks = () => {
      if (this.isSendingPaused || useStore.getState().connectionState !== 'Sending') {
        worker.terminate();
        return;
      }

      while (chunkBuffer.length > 0) {
        const bufferedAmount = this.channel?.bufferedAmount || 0;
        const limit = 1024 * 1024; // 1 MB buffer threshold

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
        this.channel?.send(packet);

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
        // Finished streaming this file
        worker.terminate();
        useStore.getState().updateActiveFileProgress(fileId, 100, 'completed');
        this.currentSendingFileIndex++;
        setTimeout(() => this.streamNextFile(), 200); // Small pause between files
      }
    };

    worker.onmessage = (event) => {
      const { type, payload } = event.data;

      if (type === 'CHUNK_GENERATED') {
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
    
    // Verify chunk checksum
    const uint8 = new Uint8Array(data);
    const localChecksum = computeAdler32(uint8);

    if (localChecksum !== checksum) {
      console.error(`Checksum mismatch at chunk ${chunkIndex} of file ${fileId}!`);
      useStore.getState().setErrorMsg(`Corrupted file chunk received. integrity check failed.`);
      useStore.getState().setConnectionState('Failed');
      return;
    }

    // Write chunk
    const writable = this.fileWritables.get(fileId);
    if (writable) {
      // Write directly to disk
      const preset = useStore.getState().chunkSizePreset;
      const chunkSize = CHUNK_SIZE_MAP[preset];
      const startPos = chunkIndex * chunkSize;
      await writable.write({ type: 'write', position: startPos, data });
    } else {
      // Fallback: Save in IndexedDB
      await saveChunk(fileId, chunkIndex, data);
    }

    const currentCount = (this.receivedChunksCount.get(fileId) || 0) + 1;
    this.receivedChunksCount.set(fileId, currentCount);

    // Update Progress
    const meta = this.fileMetadataMap.get(fileId);
    if (meta) {
      const fileProgress = Math.min(Math.round((currentCount / totalChunks) * 100), 100);
      useStore.getState().updateActiveFileProgress(fileId, fileProgress);

      // Calculate total bytes received
      const preset = useStore.getState().chunkSizePreset;
      const chunkSize = CHUNK_SIZE_MAP[preset];
      
      let receivedBytesSoFar = 0;
      this.receivedChunksCount.forEach((count, id) => {
        const fileMeta = this.fileMetadataMap.get(id);
        if (fileMeta) {
          const bytes = Math.min(count * chunkSize, fileMeta.size);
          receivedBytesSoFar += bytes;
        }
      });
      this.totalBytesTransferred = receivedBytesSoFar;

      if (currentCount === totalChunks) {
        // Complete receiving this file!
        useStore.getState().updateActiveFileProgress(fileId, 100, 'completed');
        
        if (writable) {
          await writable.close();
          this.fileWritables.delete(fileId);
        } else {
          // Reconstruct file from IndexedDB
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

        // Check if all files complete
        let allComplete = true;
        useStore.getState().activeFiles.forEach((f) => {
          if (f.status !== 'completed') allComplete = false;
        });

        if (allComplete) {
          useStore.getState().setConnectionState('Completed');
        }
      }
    }
  }

  private async reconstructAndDownload(fileId: string, totalChunks: number, fileName: string, fileType: string) {
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

    this.speedTimer = setInterval(() => {
      const bytesTransferredThisSecond = Math.max(0, this.totalBytesTransferred - this.lastBytesTransferred);
      this.lastBytesTransferred = this.totalBytesTransferred;

      // Add to window for moving average
      this.speedWindow.push(bytesTransferredThisSecond);
      if (this.speedWindow.length > 3) this.speedWindow.shift();

      const avgSpeed = this.speedWindow.reduce((a, b) => a + b, 0) / this.speedWindow.length;
      const progress = this.totalSizeToTransfer > 0 ? (this.totalBytesTransferred / this.totalSizeToTransfer) * 100 : 0;
      
      const remainingBytes = Math.max(0, this.totalSizeToTransfer - this.totalBytesTransferred);
      const remainingTime = avgSpeed > 0 ? Math.round(remainingBytes / avgSpeed) : null;

      useStore.getState().updateTransferMetrics({
        progress: Math.min(Math.round(progress), 100),
        speed: avgSpeed,
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
    this.activeFilesMeta = [];
  }
}

// Global Singleton instance
export const transferManager = new WebRTCTransferManager();
