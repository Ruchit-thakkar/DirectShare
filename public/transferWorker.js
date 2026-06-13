self.onmessage = async function (e) {
  const { type, payload } = e.data;

  if (type === 'START_CHUNKING') {
    const { file, fileId, sessionId, chunkSize } = payload;
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / chunkSize);

    try {
      let totalReadTime = 0;
      let totalHashTime = 0;

      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, fileSize);

        // Slice and read the file
        const t0 = performance.now();
        const slice = file.slice(start, end);
        const reader = new FileReaderSync();
        const arrayBuffer = reader.readAsArrayBuffer(slice);
        const t1 = performance.now();
        totalReadTime += (t1 - t0);

        // Compute SHA-256 checksum
        const uint8 = new Uint8Array(arrayBuffer);
        const hashBuffer = await self.crypto.subtle.digest('SHA-256', uint8);
        const t2 = performance.now();
        totalHashTime += (t2 - t1);

        // Log average times every 100 chunks to identify bottlenecks
        if (i > 0 && i % 100 === 0) {
          console.log(`[Worker Diagnostic] Chunks ${i-100}-${i} Avg Read Time: ${(totalReadTime / 100).toFixed(2)}ms, Avg Hash Time: ${(totalHashTime / 100).toFixed(2)}ms`);
          totalReadTime = 0;
          totalHashTime = 0;
        }

        // Post chunk back to main thread and transfer ownership
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
