export interface HistoryEntry {
  id?: number;
  fileName: string;
  fileSize: number;
  fileType: string;
  direction: 'send' | 'receive';
  peerName: string;
  status: 'completed' | 'failed' | 'cancelled';
  speed: number; // in bytes/sec
  timestamp: number;
}

export interface TransferMetadata {
  fileId: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  completedChunks: number[]; // Indices of chunks already saved
  sessionKey: string | null;
  timestamp: number;
}

const DB_NAME = 'directshare_db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBDatabase> | null = null;

export function initDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      dbPromise = null;
      reject(new Error('IndexedDB is only available in the browser'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('history')) {
        db.createObjectStore('history', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('chunks')) {
        db.createObjectStore('chunks');
      }
      if (!db.objectStoreNames.contains('transfers')) {
        db.createObjectStore('transfers', { keyPath: 'fileId' });
      }
    };
  });

  return dbPromise;
}

// Chunks storage functions (IndexedDB key is string: "${fileId}_${chunkIndex}")
export async function saveChunk(fileId: string, chunkIndex: number, data: ArrayBuffer): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chunks', 'readwrite');
    const store = transaction.objectStore('chunks');
    const key = `${fileId}_${chunkIndex}`;
    
    // Store raw ArrayBuffer directly
    const request = store.put(data, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getChunk(fileId: string, chunkIndex: number): Promise<ArrayBuffer> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chunks', 'readonly');
    const store = transaction.objectStore('chunks');
    const key = `${fileId}_${chunkIndex}`;
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result as ArrayBuffer);
    request.onerror = () => reject(request.error);
  });
}

export async function clearChunks(fileId: string, totalChunks: number): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('chunks', 'readwrite');
    const store = transaction.objectStore('chunks');
    for (let i = 0; i < totalChunks; i++) {
      store.delete(`${fileId}_${i}`);
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

// Transfer metadata functions for pause/resume
export async function saveTransferMetadata(meta: TransferMetadata): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('transfers', 'readwrite');
    const store = transaction.objectStore('transfers');
    const request = store.put(meta);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getTransferMetadata(fileId: string): Promise<TransferMetadata | undefined> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('transfers', 'readonly');
    const store = transaction.objectStore('transfers');
    const request = store.get(fileId);

    request.onsuccess = () => resolve(request.result as TransferMetadata);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllTransfers(): Promise<TransferMetadata[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('transfers', 'readonly');
    const store = transaction.objectStore('transfers');
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as TransferMetadata[];
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTransferMetadata(fileId: string): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('transfers', 'readwrite');
    const store = transaction.objectStore('transfers');
    const request = store.delete(fileId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function markChunkCompleted(fileId: string, chunkIndex: number): Promise<void> {
  const meta = await getTransferMetadata(fileId);
  if (!meta) return;
  if (!meta.completedChunks.includes(chunkIndex)) {
    meta.completedChunks.push(chunkIndex);
    await saveTransferMetadata(meta);
  }
}

// Transfer history functions
export async function addHistory(entry: HistoryEntry): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('history', 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.add(entry);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getHistory(): Promise<HistoryEntry[]> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('history', 'readonly');
    const store = transaction.objectStore('history');
    const request = store.getAll();

    request.onsuccess = () => {
      const results = request.result as HistoryEntry[];
      results.sort((a, b) => b.timestamp - a.timestamp);
      resolve(results);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function clearHistory(): Promise<void> {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('history', 'readwrite');
    const store = transaction.objectStore('history');
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
