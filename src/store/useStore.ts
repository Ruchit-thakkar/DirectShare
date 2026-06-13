import { create } from 'zustand';

export type ConnectionState =
  | 'Waiting'
  | 'Discovering'
  | 'Connecting'
  | 'Connected'
  | 'Sending'
  | 'Receiving'
  | 'Paused'
  | 'Completed'
  | 'Failed';

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'failed' | 'paused';
}

interface AppState {
  displayName: string;
  connectionState: ConnectionState;
  selectedFiles: File[];
  activeFiles: FileMetadata[];
  transferProgress: number; // 0 to 100
  transferSpeed: number; // in bytes per second
  transferSpeedCurrent: number;
  transferSpeedPeak: number;
  remainingTime: number | null; // in seconds
  currentFileIndex: number;
  totalFilesCount: number;
  currentFileName: string;
  errorMsg: string | null;
  roomId: string | null;
  isHost: boolean;
  peerName: string | null;

  // Settings
  chunkSizePreset: '128KB' | '256KB' | '512KB' | '1MB';
  notificationsEnabled: boolean;

  // Actions
  setDisplayName: (name: string) => void;
  setConnectionState: (state: ConnectionState) => void;
  setSelectedFiles: (files: File[]) => void;
  setActiveFiles: (files: FileMetadata[]) => void;
  updateActiveFileProgress: (id: string, progress: number, status?: FileMetadata['status']) => void;
  updateTransferMetrics: (metrics: {
    progress: number;
    speed: number;
    speedCurrent?: number;
    speedPeak?: number;
    remainingTime: number | null;
    currentFileName: string;
    currentFileIndex: number;
    totalFilesCount: number;
  }) => void;
  setErrorMsg: (error: string | null) => void;
  setRoomInfo: (roomId: string | null, isHost: boolean) => void;
  setPeerName: (name: string | null) => void;
  setChunkSizePreset: (preset: '128KB' | '256KB' | '512KB' | '1MB') => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  resetTransfer: () => void;
}

export const useStore = create<AppState>((set) => ({
  displayName: '',
  connectionState: 'Waiting',
  selectedFiles: [],
  activeFiles: [],
  transferProgress: 0,
  transferSpeed: 0,
  transferSpeedCurrent: 0,
  transferSpeedPeak: 0,
  remainingTime: null,
  currentFileIndex: 0,
  totalFilesCount: 0,
  currentFileName: '',
  errorMsg: null,
  roomId: null,
  isHost: false,
  peerName: null,

  // Settings defaults
  chunkSizePreset: '512KB', // Set default to 512KB for higher performance
  notificationsEnabled: false,

  setDisplayName: (name) => set({ displayName: name }),
  setConnectionState: (state) => set({ connectionState: state }),
  setSelectedFiles: (selectedFiles) =>
    set({
      selectedFiles,
      totalFilesCount: selectedFiles.length,
    }),
  setActiveFiles: (activeFiles) =>
    set({
      activeFiles,
      totalFilesCount: activeFiles.length,
    }),
  updateActiveFileProgress: (id, progress, status) =>
    set((state) => ({
      activeFiles: state.activeFiles.map((f) =>
        f.id === id ? { ...f, progress, ...(status ? { status } : {}) } : f
      ),
    })),
  updateTransferMetrics: (metrics) => set({
    transferProgress: metrics.progress,
    transferSpeed: metrics.speed,
    transferSpeedCurrent: metrics.speedCurrent || 0,
    transferSpeedPeak: metrics.speedPeak || 0,
    remainingTime: metrics.remainingTime,
    currentFileName: metrics.currentFileName,
    currentFileIndex: metrics.currentFileIndex,
    totalFilesCount: metrics.totalFilesCount,
  }),
  setErrorMsg: (errorMsg) => set({ errorMsg }),
  setRoomInfo: (roomId, isHost) => set({ roomId, isHost }),
  setPeerName: (peerName) => set({ peerName }),
  setChunkSizePreset: (chunkSizePreset) => set({ chunkSizePreset }),
  setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),

  resetTransfer: () =>
    set({
      connectionState: 'Waiting',
      selectedFiles: [],
      activeFiles: [],
      transferProgress: 0,
      transferSpeed: 0,
      transferSpeedCurrent: 0,
      transferSpeedPeak: 0,
      remainingTime: null,
      currentFileIndex: 0,
      totalFilesCount: 0,
      currentFileName: '',
      errorMsg: null,
      roomId: null,
      isHost: false,
      peerName: null,
    }),
}));
