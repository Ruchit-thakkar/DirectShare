export const enum PacketType {
  FILE_METADATA  = 0x01,
  CHUNK          = 0x02,
  ACK            = 0x03,
  NACK           = 0x04,
  SNACK          = 0x05,
  PAUSE          = 0x06,
  RESUME         = 0x07,
  HEARTBEAT      = 0x08,
  HEARTBEAT_ACK  = 0x09,
  FILE_COMPLETE  = 0x0A,
  ABORT          = 0x0B,
}

export const enum ChunkFlags {
  NONE       = 0b000,
  COMPRESSED = 0b001,
  ENCRYPTED  = 0b010,
  LAST       = 0b100,
}

export interface CommonPacketHeader {
  packetType: PacketType;
  version: number;
  flags: number;
  fileId: string; // Hex representation of 16-byte UUID (32 chars)
}

export interface ChunkPacket extends CommonPacketHeader {
  packetType: PacketType.CHUNK;
  sequenceNumber: number;
  totalChunks: number;
  chunkChecksum: string;
  payload: ArrayBuffer;
}

export interface AckPacket extends CommonPacketHeader {
  packetType: PacketType.ACK | PacketType.NACK;
  sequenceNumber: number;
}

export interface SnackPacket extends CommonPacketHeader {
  packetType: PacketType.SNACK;
  missingSequences: number[];
}
