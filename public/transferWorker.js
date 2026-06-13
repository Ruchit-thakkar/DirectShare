self.onmessage = async function (e) {
  const { type, payload } = e.data;

  if (type === 'START_CHUNKING') {
    const { file, fileId, sessionId, chunkSize } = payload;
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    try {
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);

        // Slice the file
        const slice = file.slice(start, end);
        
        // Read slice as ArrayBuffer synchronously
        const reader = new FileReaderSync();
        const arrayBuffer = reader.readAsArrayBuffer(slice);
        const uint8 = new Uint8Array(arrayBuffer);

        // Compute SHA-256 checksum
        const hashBuffer = await self.crypto.subtle.digest('SHA-256', uint8);

        // Post chunk back to main thread and transfer ownership of the ArrayBuffer
        self.postMessage(
          {
            type: 'CHUNK_GENERATED',
            payload: {
              sessionId,
              fileId,
              chunkIndex: i,
              totalChunks,
              checksum: hashBuffer,
              data: arrayBuffer,
            },
          },
          [arrayBuffer, hashBuffer] // transfer buffers
        );
      }

      self.postMessage({ type: 'CHUNKING_COMPLETE', payload: { fileId } });
    } catch (err) {
      self.postMessage({
        type: 'CHUNKING_ERROR',
        payload: { fileId, error: err.message || 'Unknown chunking error' },
      });
    }
  }
};
