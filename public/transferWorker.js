let currentFile = null;
let currentFileId = null;
let currentSessionId = null;
let currentChunkSize = 0;

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

      // Compute cryptographic SHA-256 hash
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const checksumVal = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

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
