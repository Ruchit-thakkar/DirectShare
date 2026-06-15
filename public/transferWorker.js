let currentFile = null;
let currentFileId = null;
let currentSessionId = null;
let currentChunkSize = 0;

const CRC32_TABLE = (() => {
  const table = new Int32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(buffer) {
  const uint8 = new Uint8Array(buffer);
  let crc = -1;
  for (let i = 0; i < uint8.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ uint8[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}

self.onmessage = async function (e) {
  const { type, payload } = e.data;

  if (type === 'START_CHUNKING') {
    const { file, fileId, sessionId, chunkSize } = payload;
    currentFile = file;
    currentFileId = fileId;
    currentSessionId = sessionId;
    currentChunkSize = chunkSize;

    self.postMessage({ type: 'CHUNKING_STARTED', payload: { fileId } });
  } else if (type === 'REQUEST_CHUNK') {
    const { chunkIndex } = payload;
    if (!currentFile) {
      self.postMessage({
        type: 'CHUNKING_ERROR',
        payload: { fileId: currentFileId, error: 'No active file chunking session' },
      });
      return;
    }

    try {
      const fileSize = currentFile.size;
      const start = chunkIndex * currentChunkSize;
      const end = Math.min(start + currentChunkSize, fileSize);

      if (start >= fileSize) {
        self.postMessage({
          type: 'CHUNKING_ERROR',
          payload: { fileId: currentFileId, error: `Requested chunk index ${chunkIndex} is out of bounds` },
        });
        return;
      }

      // Slice and read the chunk
      const slice = currentFile.slice(start, end);
      const reader = new FileReaderSync();
      const arrayBuffer = reader.readAsArrayBuffer(slice);

      // Compute CRC32 checksum
      const checksumVal = crc32(arrayBuffer);

      // Post chunk back to main thread and transfer ownership
      self.postMessage(
        {
          type: 'CHUNK_GENERATED',
          payload: {
            sessionId: currentSessionId,
            fileId: currentFileId,
            chunkIndex,
            checksum: checksumVal,
            data: arrayBuffer,
          },
        },
        [arrayBuffer] // transfer buffer
      );
    } catch (err) {
      self.postMessage({
        type: 'CHUNKING_ERROR',
        payload: { fileId: currentFileId, error: err.message || 'Unknown chunking error' },
      });
    }
  }
};
