import { PacketType, CommonPacketHeader, ChunkPacket, AckPacket, SnackPacket } from '../types/packets';

function stringTo16Bytes(str: string): Uint8Array {
  const bytes = new Uint8Array(16);
  const encoded = new TextEncoder().encode(str);
  bytes.set(encoded.slice(0, 16));
  return bytes;
}

function bytesToString16(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes).replace(/\0/g, '').trim();
}

// Write the 20-byte common header into a DataView at offset 0
export function writeCommonHeader(
  view: DataView,
  packetType: PacketType,
  fileId: string,
  flags = 0,
  version = 1
) {
  view.setUint8(0, packetType);
  view.setUint8(1, version);
  view.setUint16(2, flags, false); // big-endian

  const fileBytes = stringTo16Bytes(fileId);
  for (let i = 0; i < 16; i++) {
    view.setUint8(4 + i, fileBytes[i]);
  }
}

// Read the 20-byte common header from a DataView
export function readCommonHeader(view: DataView): CommonPacketHeader {
  const packetType = view.getUint8(0) as PacketType;
  const version = view.getUint8(1);
  const flags = view.getUint16(2, false);

  const fileBytes = new Uint8Array(view.buffer, view.byteOffset + 4, 16);
  const fileId = bytesToString16(fileBytes);

  return { packetType, version, flags, fileId };
}

// ── CHUNK Packet ──
export function serializeChunk(
  fileId: string,
  sequenceNumber: number,
  totalChunks: number,
  chunkChecksum: number,
  payload: ArrayBuffer,
  flags = 0
): ArrayBuffer {
  // Total size: 20B (common) + 12B (chunk) + payload size
  const headerSize = 32;
  const buffer = new ArrayBuffer(headerSize + payload.byteLength);
  const view = new DataView(buffer);

  writeCommonHeader(view, PacketType.CHUNK, fileId, flags);
  view.setUint32(20, sequenceNumber, false);
  view.setUint32(24, totalChunks, false);
  view.setUint32(28, chunkChecksum, false);

  const payloadArray = new Uint8Array(buffer, headerSize);
  payloadArray.set(new Uint8Array(payload));

  return buffer;
}

export function deserializeChunk(buffer: ArrayBuffer): ChunkPacket {
  const view = new DataView(buffer);
  const header = readCommonHeader(view);

  const sequenceNumber = view.getUint32(20, false);
  const totalChunks = view.getUint32(24, false);
  const chunkChecksum = view.getUint32(28, false);

  const payload = buffer.slice(32);

  return {
    ...header,
    packetType: PacketType.CHUNK,
    sequenceNumber,
    totalChunks,
    chunkChecksum,
    payload,
  };
}

// ── ACK / NACK Packet ──
export function serializeAck(
  packetType: PacketType.ACK | PacketType.NACK,
  fileId: string,
  sequenceNumber: number,
  flags = 0
): ArrayBuffer {
  // Total size: 20B (common) + 4B (ack) = 24 bytes
  const buffer = new ArrayBuffer(24);
  const view = new DataView(buffer);

  writeCommonHeader(view, packetType, fileId, flags);
  view.setUint32(20, sequenceNumber, false);

  return buffer;
}

export function deserializeAck(buffer: ArrayBuffer): AckPacket {
  const view = new DataView(buffer);
  const header = readCommonHeader(view);
  const sequenceNumber = view.getUint32(20, false);

  return {
    ...header,
    packetType: header.packetType as PacketType.ACK | PacketType.NACK,
    sequenceNumber,
  };
}

// ── SNACK Packet ──
export function serializeSnack(
  fileId: string,
  missingSequences: number[],
  flags = 0
): ArrayBuffer {
  // Total size: 20B (common) + 4B (count) + N * 4B
  const buffer = new ArrayBuffer(24 + missingSequences.length * 4);
  const view = new DataView(buffer);

  writeCommonHeader(view, PacketType.SNACK, fileId, flags);
  view.setUint32(20, missingSequences.length, false);

  for (let i = 0; i < missingSequences.length; i++) {
    view.setUint32(24 + i * 4, missingSequences[i], false);
  }

  return buffer;
}

export function deserializeSnack(buffer: ArrayBuffer): SnackPacket {
  const view = new DataView(buffer);
  const header = readCommonHeader(view);
  const length = view.getUint32(20, false);

  const missingSequences: number[] = [];
  for (let i = 0; i < length; i++) {
    missingSequences.push(view.getUint32(24 + i * 4, false));
  }

  return {
    ...header,
    packetType: PacketType.SNACK,
    missingSequences,
  };
}

// ── FILE_METADATA Packet ──
export function serializeMetadata(
  fileId: string,
  metadata: any,
  flags = 0
): ArrayBuffer {
  const jsonStr = JSON.stringify(metadata);
  const encoded = new TextEncoder().encode(jsonStr);

  const buffer = new ArrayBuffer(20 + encoded.byteLength);
  const view = new DataView(buffer);

  writeCommonHeader(view, PacketType.FILE_METADATA, fileId, flags);

  const payloadArray = new Uint8Array(buffer, 20);
  payloadArray.set(encoded);

  return buffer;
}

export function deserializeMetadata(buffer: ArrayBuffer): {
  header: CommonPacketHeader;
  metadata: any;
} {
  const view = new DataView(buffer);
  const header = readCommonHeader(view);

  const payloadArray = new Uint8Array(buffer, 20);
  const jsonStr = new TextDecoder().decode(payloadArray);
  const metadata = JSON.parse(jsonStr);

  return { header, metadata };
}

// ── Simple Control Packet (PAUSE, RESUME, HEARTBEAT, HEARTBEAT_ACK, FILE_COMPLETE, ABORT) ──
export function serializeControl(
  packetType: PacketType,
  fileId: string,
  flags = 0
): ArrayBuffer {
  // Just the 20-byte common header
  const buffer = new ArrayBuffer(20);
  const view = new DataView(buffer);
  writeCommonHeader(view, packetType, fileId, flags);
  return buffer;
}
