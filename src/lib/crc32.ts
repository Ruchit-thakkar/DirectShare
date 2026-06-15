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

export function crc32(buffer: ArrayBuffer): number {
  const uint8 = new Uint8Array(buffer);
  let crc = -1;
  for (let i = 0; i < uint8.length; i++) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ uint8[i]) & 0xFF];
  }
  return (crc ^ -1) >>> 0;
}
