// Adler-32 Checksum Algorithm (Fast)
function adler32(data) {
  let a = 1;
  let b = 0;
  const len = data.length;
  
  // Process in batches of 3854 to prevent 32-bit overflow
  let i = 0;
  while (i < len) {
    const limit = Math.min(i + 3854, len);
    for (; i < limit; i++) {
      a += data[i];
      b += a;
    }
    a %= 65521;
    b %= 65521;
  }
  return (b << 16) | a;
}

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

        // Compute Adler-32 checksum
        const checksum = adler32(uint8);

        // Post chunk back to main thread and transfer ownership of the ArrayBuffer
        self.postMessage(
          {
            type: 'CHUNK_GENERATED',
            payload: {
              sessionId,
              fileId,
              chunkIndex: i,
              totalChunks,
              checksum,
              data: arrayBuffer,
            },
          },
          [arrayBuffer] // transfer buffer
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
