import { create } from 'zustand';
import { ReceiverState, FileMetadata, ReceiverStatus } from '../types/transfer';

interface ReceiverStoreActions {
  setReceiverStatus: (status: ReceiverStatus) => void;
  setReceiverMetadata: (meta: FileMetadata | null) => void;
  updateReceiverState: (state: Partial<ReceiverState>) => void;
  resetReceiver: () => void;
}

export const useReceiverStore = create<ReceiverState & ReceiverStoreActions>((set) => ({
  status: 'idle',
  metadata: null,
  nextExpected: 0,
  bytesReceived: 0,
  chunksReceived: 0,
  currentSpeedBps: 0,
  etaSeconds: null,
  missingChunks: 0,
  errorMessage: null,
  activeFiles: [],
  peerName: null,

  setReceiverStatus: (status) => set({ status }),
  setReceiverMetadata: (metadata) => set({ metadata }),
  updateReceiverState: (state) => set((prev) => ({ ...prev, ...state })),
  resetReceiver: () => set({
    status: 'idle',
    metadata: null,
    nextExpected: 0,
    bytesReceived: 0,
    chunksReceived: 0,
    currentSpeedBps: 0,
    etaSeconds: null,
    missingChunks: 0,
    errorMessage: null,
    activeFiles: [],
    peerName: null,
  }),
}));
