import { create } from 'zustand';
import { webrtcService, type ActiveCall, type CallType, type CallEndData } from '@/services/webrtc';
import { getSocket } from '@/services/socket';
import {
  showDesktopNotification,
  playCallRingtone,
  playOutgoingRingtone,
  playCallConnectedChime,
  playCallEndedTone,
  getNotificationPrefs,
} from '@/services/notification';

let ringtoneHandle: { stop: () => void } | null = null;
let outgoingRingtoneHandle: { stop: () => void } | null = null;

function formatCallDuration(seconds: number): string {
  if (seconds < 60) return `0:${seconds.toString().padStart(2, '0')}`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildCallMessage(reason: string, data?: CallEndData): { content: string; metadata: any } | null {
  if (!data?.conversationId) return null;
  const typeLabel = data.callType === 'video' ? 'Video call' : 'Audio call';

  let content: string;
  let status: string;

  if (reason === 'rejected') {
    content = data.direction === 'outgoing' ? 'Call declined' : `Missed ${typeLabel.toLowerCase()}`;
    status = data.direction === 'outgoing' ? 'declined' : 'missed';
  } else if (reason === 'media-error' || reason === 'error' || reason === 'failed') {
    content = 'Call failed';
    status = 'failed';
  } else if (data.duration > 0) {
    content = `${typeLabel} \u00B7 ${formatCallDuration(data.duration)}`;
    status = 'completed';
  } else {
    content = data.direction === 'outgoing' ? 'Call not answered' : `Missed ${typeLabel.toLowerCase()}`;
    status = 'missed';
  }

  return {
    content,
    metadata: {
      callType: data.callType,
      duration: data.duration,
      direction: data.direction,
      status,
      remoteName: data.remoteName,
    },
  };
}

export interface GroupCallParticipant {
  userId: string;
  displayName: string;
  extension: string;
  status: 'ringing' | 'connected' | 'disconnected';
  isMuted: boolean;
  stream?: MediaStream;
}

export interface GroupCallState {
  isActive: boolean;
  conversationId: string | null;
  callType: CallType;
  groupName: string;
  participants: GroupCallParticipant[];
  startTime: Date | null;
}

interface CallState {
  isReady: boolean;
  activeCalls: ActiveCall[];
  incomingCall: ActiveCall | null;
  currentCall: ActiveCall | null;
  isScreenSharing: boolean;
  groupCall: GroupCallState | null;

  initWebRTC: (socket: any) => void;
  makeCall: (targetUserId: string, type: CallType, remoteName?: string, conversationId?: string) => Promise<void>;
  answerCall: (callId: string, type: CallType) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  hangup: (callId: string) => Promise<void>;
  toggleMute: (callId: string) => void;
  toggleVideo: (callId: string) => void;
  startScreenShare: (callId: string) => Promise<void>;
  stopScreenShare: (callId: string) => Promise<void>;
  dismissIncoming: () => void;

  // Group call actions
  startGroupCall: (conversationId: string, callType: CallType, groupName: string) => void;
  joinGroupCall: (conversationId: string, callType: CallType, groupName: string) => void;
  leaveGroupCall: () => void;
  addGroupParticipant: (participant: GroupCallParticipant) => void;
  removeGroupParticipant: (userId: string) => void;
  updateGroupParticipant: (userId: string, updates: Partial<GroupCallParticipant>) => void;
  endGroupCall: () => void;
}

export const useCallStore = create<CallState>((set, get) => {
  // Setup WebRTC event handlers
  webrtcService.onRegistered = () => {
    set({ isReady: true });
  };
  webrtcService.onUnregistered = () => {
    set({ isReady: false });
  };
  webrtcService.onIncomingCall = (call) => {
    set({ incomingCall: call, activeCalls: webrtcService.calls });

    // Play ringtone and show desktop notification
    const prefs = getNotificationPrefs();
    if (prefs.sound) {
      ringtoneHandle?.stop();
      ringtoneHandle = playCallRingtone();
    }
    if (prefs.desktop) {
      const callerName = call.remoteName || call.remoteUserId || 'Unknown';
      const callTypeLabel = call.callType === 'video' ? 'Video Call' : 'Audio Call';
      showDesktopNotification({
        title: `Incoming ${callTypeLabel}`,
        body: `${callerName} is calling you`,
        tag: 'incoming-call',
        requireInteraction: true,
      });
    }
  };
  webrtcService.onCallEstablished = (call) => {
    ringtoneHandle?.stop();
    ringtoneHandle = null;
    outgoingRingtoneHandle?.stop();
    outgoingRingtoneHandle = null;
    playCallConnectedChime();
    set({
      currentCall: call,
      incomingCall: null,
      activeCalls: webrtcService.calls,
    });
  };
  webrtcService.onCallEnded = (_callId: string, reason: string, callData?: CallEndData) => {
    ringtoneHandle?.stop();
    ringtoneHandle = null;
    outgoingRingtoneHandle?.stop();
    outgoingRingtoneHandle = null;
    playCallEndedTone();
    const calls = webrtcService.calls;
    set({
      activeCalls: calls,
      currentCall: calls.length > 0 ? calls[0] : null,
      incomingCall: null,
      isScreenSharing: false,
    });

    // Send call-ended system message — only from the CALLER side to avoid duplicates
    const msg = buildCallMessage(reason, callData);
    if (msg && callData?.conversationId && callData?.direction === 'outgoing') {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('message:send', {
          conversationId: callData.conversationId,
          type: 'system',
          content: msg.content,
          metadata: JSON.stringify(msg.metadata),
        });
      }
    }
  };

  return {
    isReady: false,
    activeCalls: [],
    incomingCall: null,
    currentCall: null,
    isScreenSharing: false,
    groupCall: null,

    initWebRTC: (socket) => {
      webrtcService.initSignaling(socket);
      set({ isReady: socket.connected });
    },

    makeCall: async (targetUserId, type, remoteName, conversationId) => {
      try {
        const call = await webrtcService.makeCall(targetUserId, type, remoteName, conversationId);
        // Play outgoing ring-back tone (caller hears this while waiting)
        outgoingRingtoneHandle?.stop();
        outgoingRingtoneHandle = playOutgoingRingtone();
        set({ currentCall: call, activeCalls: webrtcService.calls });
      } catch (err) {
        console.error('Call failed:', err);
      }
    },

    answerCall: async (callId, type) => {
      ringtoneHandle?.stop();
      ringtoneHandle = null;
      // Set currentCall immediately so UI shows "Connecting..." overlay
      const call = webrtcService.calls.find(c => c.id === callId);
      set({ incomingCall: null, currentCall: call || null });
      await webrtcService.answerCall(callId, type);
    },

    rejectCall: async (callId) => {
      ringtoneHandle?.stop();
      ringtoneHandle = null;
      await webrtcService.rejectCall(callId);
      set({ incomingCall: null });
    },

    hangup: async (callId) => {
      await webrtcService.hangup(callId);
    },

    toggleMute: (callId) => {
      webrtcService.toggleMute(callId);
      set({ activeCalls: [...webrtcService.calls] });
    },

    toggleVideo: (callId) => {
      webrtcService.toggleVideo(callId);
      set({ activeCalls: [...webrtcService.calls] });
    },

    startScreenShare: async (callId) => {
      const stream = await webrtcService.startScreenShare(callId);
      if (stream) {
        set({ isScreenSharing: true });
        const call = get().currentCall;
        if (call?.conversationId) {
          getSocket()?.emit('screen-share:started', { conversationId: call.conversationId });
        }
      }
    },

    stopScreenShare: async (callId) => {
      const call = get().currentCall;
      await webrtcService.stopScreenShare(callId);
      set({ isScreenSharing: false });
      if (call?.conversationId) {
        getSocket()?.emit('screen-share:stopped', { conversationId: call.conversationId });
      }
    },

    dismissIncoming: () => {
      ringtoneHandle?.stop();
      ringtoneHandle = null;
      set({ incomingCall: null });
    },

    // Group call actions
    startGroupCall: (conversationId, callType, groupName) => {
      set({
        groupCall: {
          isActive: true,
          conversationId,
          callType,
          groupName,
          participants: [],
          startTime: new Date(),
        },
      });
    },

    joinGroupCall: (conversationId, callType, groupName) => {
      set({
        groupCall: {
          isActive: true,
          conversationId,
          callType,
          groupName,
          participants: [],
          startTime: new Date(),
        },
      });
    },

    leaveGroupCall: () => {
      const state = useCallStore.getState();
      if (state.groupCall?.conversationId) {
        const socket = getSocket();
        socket?.emit('group-call:leave', { conversationId: state.groupCall.conversationId });
      }
      if (state.currentCall) {
        webrtcService.hangup(state.currentCall.id).catch(console.error);
      }
      set({ groupCall: null, currentCall: null });
    },

    addGroupParticipant: (participant) => {
      set((state) => {
        if (!state.groupCall) return state;
        const exists = state.groupCall.participants.some((p) => p.userId === participant.userId);
        if (exists) return state;
        return { groupCall: { ...state.groupCall, participants: [...state.groupCall.participants, participant] } };
      });
    },

    removeGroupParticipant: (userId) => {
      set((state) => {
        if (!state.groupCall) return state;
        return { groupCall: { ...state.groupCall, participants: state.groupCall.participants.filter((p) => p.userId !== userId) } };
      });
    },

    updateGroupParticipant: (userId, updates) => {
      set((state) => {
        if (!state.groupCall) return state;
        return { groupCall: { ...state.groupCall, participants: state.groupCall.participants.map((p) => p.userId === userId ? { ...p, ...updates } : p) } };
      });
    },

    endGroupCall: () => {
      set({ groupCall: null });
    },
  };
});
