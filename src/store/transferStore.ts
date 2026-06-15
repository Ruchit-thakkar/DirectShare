import { create } from 'zustand';
import { TransferState, FileMetadata, TransferStatus } from '../types/transfer';

interface TransferStoreActions {
  setTransferStatus: (status: TransferStatus) => void;
  setTransferMetadata: (meta: FileMetadata | null) => void;
  updateTransferState: (state: Partial<TransferState>) => void;
  resetTransfer: () => void;
}

export const useTransferStore = create<TransferState & TransferStoreActions>((set) => ({
  status: 'idle',
  metadata: null,
  windowSize: 16,
  nextToSend: 0,
  inFlightCount: 0,
  bytesSent: 0,
  chunksAcked: 0,
  currentSpeedBps: 0,
  etaSeconds: null,
  smoothedRTT: 100,
  errorMessage: null,
  activeFiles: [],
  peerName: null,

  setTransferStatus: (status) => set({ status }),
  setTransferMetadata: (metadata) => set({ metadata }),
  updateTransferState: (state) => set((prev) => ({ ...prev, ...state })),
  resetTransfer: () => set({
    status: 'idle',
    metadata: null,
    windowSize: 16,
    nextToSend: 0,
    inFlightCount: 0,
    bytesSent: 0,
    chunksAcked: 0,
    currentSpeedBps: 0,
    etaSeconds: null,
    smoothedRTT: 100,
    errorMessage: null,
    activeFiles: [],
    peerName: null,
  }),
}));
