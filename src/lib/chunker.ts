export const CHUNK_SIZE_MAP = {
  '128KB': 128 * 1024,
  '256KB': 256 * 1024,
  '512KB': 512 * 1024,
  '1MB': 1024 * 1024,
};

export function getSafeChunkSize(
  rtt: number,
  preset: '128KB' | '256KB' | '512KB' | '1MB',
  maxMessageSize?: number
): number {
  let effectivePreset = preset;

  // Adaptive chunk size based on RTT:
  // High latency: reduce chunk size to limit retransmission penalty
  // Very low latency: scale up to 1MB for maximum throughput
  if (rtt > 300) {
    effectivePreset = '256KB';
  } else if (rtt < 50) {
    effectivePreset = '1MB';
  }

  const requestedSize = CHUNK_SIZE_MAP[effectivePreset];

  let limit = maxMessageSize;
  if (limit === undefined || limit === 0) {
    limit = 262144; // Default to 256KB SCTP limit
  }

  const maxSafeSize = limit - 1024; // 1KB buffer for protocol headers
  return Math.min(requestedSize, maxSafeSize);
}
