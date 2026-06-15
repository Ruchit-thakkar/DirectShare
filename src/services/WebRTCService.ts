const getIceServers = (): RTCIceServer[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('directshare_ice_servers');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('[WebRTCService] Failed to parse custom ICE servers from localStorage:', e);
      }
    }
  }
  return [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];
};

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private isHost = false;
  private heartbeatInterval: any = null;

  // Callbacks
  public onConnectionStateChange: ((state: RTCIceConnectionState) => void) | null = null;
  public onChannelOpen: (() => void) | null = null;
  public onChannelClose: (() => void) | null = null;
  public onBinaryMessage: ((data: ArrayBuffer) => void) | null = null;
  public onControlMessage: ((msg: any) => void) | null = null;
  public onError: ((err: string) => void) | null = null;

  setupConnection(isHost: boolean) {
    this.isHost = isHost;
    this.pc = new RTCPeerConnection({
      iceServers: getIceServers(),
    });

    this.pc.oniceconnectionstatechange = () => {
      if (this.pc && this.onConnectionStateChange) {
        this.onConnectionStateChange(this.pc.iceConnectionState);
      }
    };

    if (isHost) {
      // Create DataChannel (unordered as specified in design for custom app-level reliability)
      this.channel = this.pc.createDataChannel('directshare-channel', { ordered: false });
      this.setupDataChannel(this.channel);
    } else {
      this.pc.ondatachannel = (event) => {
        this.channel = event.channel;
        this.setupDataChannel(this.channel);
      };
    }
  }

  private setupDataChannel(channel: RTCDataChannel) {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = 1 * 1024 * 1024; // 1 MB low threshold

    channel.onopen = () => {
      this.startHeartbeat();
      this.onChannelOpen?.();
    };

    channel.onclose = () => {
      this.stopHeartbeat();
      this.onChannelClose?.();
    };

    channel.onerror = (e) => {
      const err = (e as any).error;
      const msg = err ? `${err.message} (${err.errorDetail})` : 'DataChannel error';
      this.onError?.(msg);
    };

    channel.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.onBinaryMessage?.(event.data);
      } else if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'ping') {
            if (this.channel && this.channel.readyState === 'open') {
              this.channel.send(JSON.stringify({
                type: 'pong',
                timestamp: msg.timestamp
              }));
            }
          } else if (msg.type === 'pong') {
            const sampleRTT = Date.now() - msg.timestamp;
            this.onControlMessage?.({
              type: 'rtt-update',
              rtt: sampleRTT
            });
          } else {
            this.onControlMessage?.(msg);
          }
        } catch (e) {
          console.error('[WebRTCService] Control parsing error:', e);
        }
      }
    };
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.channel && this.channel.readyState === 'open') {
        try {
          this.channel.send(JSON.stringify({
            type: 'ping',
            timestamp: Date.now()
          }));
        } catch (e) {
          console.error('[WebRTCService] Heartbeat ping send failed:', e);
        }
      }
    }, 10000); // 10 seconds heartbeat
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  async createOffer(): Promise<string> {
    if (!this.pc) throw new Error('Peer connection not set up');
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    await this.waitForIceGathering();
    return JSON.stringify(this.pc.localDescription);
  }

  async acceptOffer(offerSdp: string): Promise<string> {
    if (!this.pc) throw new Error('Peer connection not set up');
    const offer = JSON.parse(offerSdp);
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    await this.waitForIceGathering();
    return JSON.stringify(this.pc.localDescription);
  }

  async acceptAnswer(answerSdp: string) {
    if (!this.pc) throw new Error('Peer connection not set up');
    const answer = JSON.parse(answerSdp);
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async initiateIceRestart(): Promise<string> {
    if (!this.pc) throw new Error('Peer connection not set up');
    console.log('[WebRTCService] Creating SDP offer for ICE Restart...');
    const offer = await this.pc.createOffer({ iceRestart: true });
    await this.pc.setLocalDescription(offer);
    await this.waitForIceGathering();
    return JSON.stringify(this.pc.localDescription);
  }

  private waitForIceGathering(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.pc || this.pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const check = () => {
        if (this.pc?.iceGatheringState === 'complete') {
          this.pc.removeEventListener('icegatheringstatechange', check);
          resolve();
        }
      };
      this.pc.addEventListener('icegatheringstatechange', check);
      // Fallback timeout
      setTimeout(() => {
        if (this.pc) {
          this.pc.removeEventListener('icegatheringstatechange', check);
        }
        resolve();
      }, 2000);
    });
  }

  send(data: string | ArrayBuffer): boolean {
    if (!this.channel || this.channel.readyState !== 'open') {
      return false;
    }
    try {
      this.channel.send(data as any);
      return true;
    } catch (err) {
      console.error('[WebRTCService] Send failed:', err);
      return false;
    }
  }

  getBufferedAmount(): number {
    return this.channel ? this.channel.bufferedAmount : 0;
  }

  getMaxMessageSize(): number {
    return this.pc?.sctp?.maxMessageSize || 262144;
  }

  registerBufferLow(onLow: () => void) {
    if (this.channel) {
      this.channel.onbufferedamountlow = () => {
        if (this.channel) {
          this.channel.onbufferedamountlow = null;
        }
        onLow();
      };
    }
  }

  cleanUp() {
    this.stopHeartbeat();
    if (this.channel) {
      try {
        this.channel.onopen = null;
        this.channel.onclose = null;
        this.channel.onerror = null;
        this.channel.onmessage = null;
        this.channel.onbufferedamountlow = null;
        this.channel.close();
      } catch (e) {}
      this.channel = null;
    }
    if (this.pc) {
      try {
        this.pc.oniceconnectionstatechange = null;
        this.pc.ondatachannel = null;
        this.pc.close();
      } catch (e) {}
      this.pc = null;
    }
  }
}
