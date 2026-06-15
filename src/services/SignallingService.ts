export class SignallingService {
  private roomId: string | null = null;
  private peerId: string | null = null;
  private isHost = false;
  private pollInterval: any = null;
  private onMessageCallback: ((msg: any) => void) | null = null;
  private onPeerNameCallback: ((name: string) => void) | null = null;
  private onSessionExpiredCallback: (() => void) | null = null;

  getRoomId() {
    return this.roomId;
  }

  getPeerId() {
    return this.peerId;
  }

  async createRoom(displayName: string): Promise<{ roomId: string; peerId: string }> {
    const res = await fetch('/api/signaling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', displayName }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    this.roomId = data.roomId;
    this.peerId = data.peerId;
    this.isHost = true;
    return data;
  }

  async joinRoom(roomId: string, displayName: string): Promise<{ peerId: string; hostName: string }> {
    const res = await fetch('/api/signaling', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'join', roomId, displayName }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    this.roomId = roomId;
    this.peerId = data.peerId;
    this.isHost = false;
    return data;
  }

  startPolling(
    onMessage: (msg: any) => void,
    onPeerName: (name: string) => void,
    onSessionExpired: () => void
  ) {
    this.onMessageCallback = onMessage;
    this.onPeerNameCallback = onPeerName;
    this.onSessionExpiredCallback = onSessionExpired;

    this.stopPolling();
    this.pollInterval = setInterval(async () => {
      if (!this.roomId || !this.peerId) return;
      try {
        const res = await fetch('/api/signaling', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'poll', roomId: this.roomId, peerId: this.peerId }),
        });
        const data = await res.json();
        if (data.error) {
          if (data.error === 'Room not found') {
            this.stopPolling();
            this.onSessionExpiredCallback?.();
          }
          return;
        }
        if (data.peerName) {
          this.onPeerNameCallback?.(data.peerName);
        }
        if (data.messages && data.messages.length > 0) {
          for (const msg of data.messages) {
            this.onMessageCallback?.(msg);
          }
        }
      } catch (err) {
        console.error('[SignallingService] Poll error:', err);
      }
    }, 1200);
  }

  async sendMessage(message: any) {
    if (!this.roomId || !this.peerId) return;
    try {
      await fetch('/api/signaling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          roomId: this.roomId,
          peerId: this.peerId,
          message,
        }),
      });
    } catch (err) {
      console.error('[SignallingService] Send message failed:', err);
    }
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  cleanUp() {
    this.stopPolling();
    this.roomId = null;
    this.peerId = null;
    this.isHost = false;
  }
}
