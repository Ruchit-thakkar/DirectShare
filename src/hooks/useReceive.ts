import { useReceiverStore } from '../store/receiverStore';
import { ReceiverService } from '../services/ReceiverService';
import { SignallingService } from '../services/SignallingService';
import { WebRTCService } from '../services/WebRTCService';

// Module-level singletons to persist receiver state across re-renders
const signalling = new SignallingService();
const webrtc = new WebRTCService();
const receiverService = new ReceiverService(signalling, webrtc);

export function useReceive() {
  const storeState = useReceiverStore();

  return {
    ...storeState,
    startSession: (roomId: string, displayName: string) => receiverService.startSession(roomId, displayName),
    acceptManualOffer: (offerSdp: string) => receiverService.acceptManualOffer(offerSdp),
    acceptTransfer: (approved: boolean) => receiverService.acceptTransfer(approved),
    cleanUp: () => receiverService.cleanUp(),
  };
}
