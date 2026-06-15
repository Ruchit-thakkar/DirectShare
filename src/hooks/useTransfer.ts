import { useTransferStore } from '../store/transferStore';
import { SenderService } from '../services/SenderService';
import { SignallingService } from '../services/SignallingService';
import { WebRTCService } from '../services/WebRTCService';

// Module-level singletons to persist transfer state across re-renders
const signalling = new SignallingService();
const webrtc = new WebRTCService();
const senderService = new SenderService(signalling, webrtc);

export function useTransfer() {
  const storeState = useTransferStore();

  return {
    ...storeState,
    roomId: signalling.getRoomId(),
    peerId: signalling.getPeerId(),
    startSession: (files: File[], displayName: string) => senderService.startSession(files, displayName),
    setupManualConnection: () => senderService.setupManualConnection(),
    acceptManualAnswer: (answerSdp: string) => senderService.acceptManualAnswer(answerSdp),
    pause: () => senderService.pause(),
    resume: () => senderService.resume(),
    cancel: () => senderService.cancel(),
    cleanUp: () => senderService.cleanUp(),
  };
}
