import { NextResponse } from 'next/server';

interface Room {
  roomId: string;
  hostId: string;
  hostName: string;
  clientId: string | null;
  clientName: string | null;
  messages: {
    [peerId: string]: any[]; // messages queued for this peerId
  };
  lastActive: number;
}

// Global in-memory storage for rooms (Fallback when Redis is not configured)
const globalForSignaling = globalThis as unknown as {
  signalingRooms?: Map<string, Room>;
};

if (!globalForSignaling.signalingRooms) {
  globalForSignaling.signalingRooms = new Map();
}
const rooms = globalForSignaling.signalingRooms;

// Redis REST Config
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const isRedisConfigured = !!(redisUrl && redisToken);

async function getRoom(roomId: string): Promise<Room | undefined> {
  if (isRedisConfigured) {
    try {
      const url = `${redisUrl}/get/rooms:${roomId}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${redisToken}` },
        cache: 'no-store'
      });
      const data = await res.json();
      if (data && typeof data.result === 'string') {
        return JSON.parse(data.result) as Room;
      }
    } catch (e) {
      console.error('[Signaling Redis] Get error:', e);
    }
  }
  return rooms.get(roomId);
}

async function saveRoom(roomId: string, room: Room): Promise<void> {
  room.lastActive = Date.now();
  if (isRedisConfigured) {
    try {
      const url = `${redisUrl}/set/rooms:${roomId}?ex=3600`; // 1 hour expiration TTL
      await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(JSON.stringify(room)),
        cache: 'no-store'
      });
      return;
    } catch (e) {
      console.error('[Signaling Redis] Save error:', e);
    }
  }
  rooms.set(roomId, room);
}

// Prune local in-memory rooms inactive for more than 1 hour
function cleanLocalRooms() {
  if (isRedisConfigured) return;
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    if (now - room.lastActive > 60 * 60 * 1000) {
      rooms.delete(roomId);
    }
  }
}

export async function POST(req: Request) {
  cleanLocalRooms();
  try {
    const body = await req.json();
    const { action, roomId, peerId, displayName, message } = body;

    if (action === 'create') {
      const newRoomId = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
      const hostId = Math.random().toString(36).substring(2, 11);

      const room: Room = {
        roomId: newRoomId,
        hostId,
        hostName: displayName || 'Sender Device',
        clientId: null,
        clientName: null,
        messages: {
          [hostId]: [],
        },
        lastActive: Date.now(),
      };

      await saveRoom(newRoomId, room);
      return NextResponse.json({ roomId: newRoomId, peerId: hostId });
    }

    if (action === 'join') {
      if (!roomId) {
        return NextResponse.json({ error: 'Room ID is required' }, { status: 400 });
      }
      const room = await getRoom(roomId);
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      if (room.clientId && room.clientId !== peerId) {
        return NextResponse.json({ error: 'Room is full' }, { status: 400 });
      }

      const clientId = peerId || Math.random().toString(36).substring(2, 11);
      room.clientId = clientId;
      room.clientName = displayName || 'Receiver Device';

      if (!room.messages[clientId]) {
        room.messages[clientId] = [];
      }

      await saveRoom(roomId, room);
      return NextResponse.json({ peerId: clientId, hostName: room.hostName });
    }

    if (action === 'send') {
      if (!roomId || !peerId || !message) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
      }
      const room = await getRoom(roomId);
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      // Relay to the partner peer
      const targetPeerId = peerId === room.hostId ? room.clientId : room.hostId;
      if (targetPeerId) {
        if (!room.messages[targetPeerId]) {
          room.messages[targetPeerId] = [];
        }
        room.messages[targetPeerId].push(message);
      }

      await saveRoom(roomId, room);
      return NextResponse.json({ success: true });
    }

    if (action === 'poll') {
      if (!roomId || !peerId) {
        return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
      }
      const room = await getRoom(roomId);
      if (!room) {
        return NextResponse.json({ error: 'Room not found' }, { status: 404 });
      }

      const messages = room.messages[peerId] || [];
      room.messages[peerId] = []; // Clear read messages

      await saveRoom(roomId, room);

      const partnerName = peerId === room.hostId ? room.clientName : room.hostName;
      return NextResponse.json({ messages, peerName: partnerName });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('[Signaling Error]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
