export interface FileMetadata {
  fileId: string; // UUID v4
  fileName: string; // original filename
  fileSize: number; // bytes
  mimeType: string; // mime category
  totalChunks: number; // total slices
  chunkSize: number; // adaptive size in bytes
  checksum: string; // SHA-256 hex of entire file
  createdAt: number; // Unix timestamp
  resumeFromChunk?: number; // resume pointer
}

export type TransferStatus =
  | 'idle'
  | 'connecting'
  | 'hashing'
  | 'transferring'
  | 'paused'
  | 'complete'
  | 'error'
  | 'aborted';

export interface InFlightChunk {
  sequenceNumber: number;
  sentAt: number; // timestamp
  retries: number;
}

export interface TransferState {
  status: TransferStatus;
  metadata: FileMetadata | null;
  windowSize: number; // current sliding window size
  nextToSend: number; // next sequence number to enqueue
  inFlightCount: number; // size of inFlight map
  bytesSent: number;
  chunksAcked: number;
  currentSpeedBps: number;
  etaSeconds: number | null;
  smoothedRTT: number; // round trip time in ms
  errorMessage: string | null;
  activeFiles: ReceiverFile[];
  peerName: string | null;
}


export type ReceiverStatus =
  | 'idle'
  | 'connecting'
  | 'waiting_metadata'
  | 'receiving'
  | 'paused'
  | 'verifying'
  | 'complete'
  | 'corrupt'
  | 'error';

export interface ReceiverFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'paused' | 'failed';
}

export interface ReceiverState {
  status: ReceiverStatus;
  metadata: FileMetadata | null;
  nextExpected: number; // lowest un-written sequence number
  bytesReceived: number;
  chunksReceived: number;
  currentSpeedBps: number;
  etaSeconds: number | null;
  missingChunks: number;
  errorMessage: string | null;
  activeFiles: ReceiverFile[];
  peerName: string | null;
}
