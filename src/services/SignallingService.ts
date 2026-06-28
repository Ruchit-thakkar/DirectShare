import { useStore } from '../store/useStore';

export class SignallingService {
  private roomId: string | null = null;
  private peerId: string | null = null;
  private isHost = false;
  private pollInterval: any = null;
  private ws: WebSocket | null = null;
  private wsFallbackActive = false;
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
    this.wsFallbackActive = false;

    // Try WebSocket connection first (FastAPI backend)
    if (typeof window !== 'undefined' && this.roomId && this.peerId) {
      try {
        const wsUrl = `ws://localhost:8000/ws/signaling/${this.roomId}?peerId=${this.peerId}&role=${this.isHost ? 'sender' : 'receiver'}&displayName=${encodeURIComponent(useStore.getState().displayName || '')}`;
        console.log(`[SignallingService] Attempting WebSocket connection to: ${wsUrl}`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[SignallingService] WebSocket connection established successfully.');
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'peer-joined') {
              this.onPeerNameCallback?.(data.peerName);
            } else {
              this.onMessageCallback?.(data);
            }
          } catch (err) {
            console.error('[SignallingService] WebSocket JSON parse error:', err);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('[SignallingService] WebSocket connection error. Falling back to HTTP polling:', err);
          this.activateHttpFallback();
        };

        this.ws.onclose = (event) => {
          if (!this.wsFallbackActive) {
            console.warn(`[SignallingService] WebSocket closed (code: ${event.code}). Falling back to HTTP polling.`);
            this.activateHttpFallback();
          }
        };
        return; // Success or pending connection
      } catch (err) {
        console.warn('[SignallingService] WebSocket failed to initialize. Falling back to HTTP polling:', err);
      }
    }

    this.activateHttpFallback();
  }

  private activateHttpFallback() {
    if (this.wsFallbackActive) return;
    this.wsFallbackActive = true;
    this.cleanUpWs();
    console.log('[SignallingService] Activating HTTP polling fallback...');

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

    // Use WebSocket if open and active
    if (this.ws && this.ws.readyState === WebSocket.OPEN && !this.wsFallbackActive) {
      try {
        this.ws.send(JSON.stringify(message));
        return;
      } catch (err) {
        console.error('[SignallingService] WebSocket send failed, falling back to HTTP:', err);
      }
    }

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
    this.cleanUpWs();
  }

  private cleanUpWs() {
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onerror = null;
        this.ws.onclose = null;
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
  }

  cleanUp() {
    this.stopPolling();
    this.roomId = null;
    this.peerId = null;
    this.isHost = false;
  }
}
