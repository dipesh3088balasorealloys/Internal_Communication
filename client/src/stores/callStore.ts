import { create } from 'zustand';
import { webrtcService, type ActiveCall, type CallType, type CallEndData } from '@/services/webrtc';
import { getSocket } from '@/services/socket';
import * as livekitApi from '@/services/livekit';
import { useAuthStore } from '@/stores/authStore';
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
  participants: GroupCallParticipant[];   // (legacy — LiveKit's own roster is in the component)
  startTime: Date | null;

  // New LiveKit fields — present when we're connected via SFU
  callId: string | null;
  livekitToken: string | null;
  livekitWsUrl: string | null;
  livekitRoomName: string | null;
  isHost: boolean;
}

export interface IncomingGroupCallInvite {
  callId: string;
  conversationId: string;
  callType: CallType;
  hostId: string;
  hostName: string;
  roomName: string;
  startedAt: string;
}

interface CallState {
  isReady: boolean;
  activeCalls: ActiveCall[];
  incomingCall: ActiveCall | null;
  currentCall: ActiveCall | null;
  isScreenSharing: boolean;
  groupCall: GroupCallState | null;
  incomingGroupInvite: IncomingGroupCallInvite | null;

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

  // Group call actions (LiveKit-backed)
  startGroupCall: (conversationId: string, callType: CallType, groupName?: string) => Promise<void>;
  acceptGroupInvite: (callId: string) => Promise<void>;
  declineGroupInvite: (callId: string) => Promise<void>;
  receiveGroupInvite: (invite: IncomingGroupCallInvite) => void;
  leaveGroupCall: () => Promise<void>;
  endGroupCallForAll: () => Promise<void>;
  endGroupCall: () => void;
  // (legacy helpers retained for any callers — no-ops in LiveKit mode)
  joinGroupCall: (conversationId: string, callType: CallType, groupName: string) => void;
  addGroupParticipant: (participant: GroupCallParticipant) => void;
  removeGroupParticipant: (userId: string) => void;
  updateGroupParticipant: (userId: string, updates: Partial<GroupCallParticipant>) => void;
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
    incomingGroupInvite: null,

    initWebRTC: (socket) => {
      webrtcService.initSignaling(socket);
      set({ isReady: socket.connected });

      // Listen for group call socket events emitted by the server
      socket.on('group-call:incoming', (invite: IncomingGroupCallInvite) => {
        // Ignore if we're the one who started it (server broadcasts to whole conv room)
        const me = useAuthStore.getState().user?.id;
        if (me && invite.hostId === me) return;
        // Ignore if we're already in this call
        if (useCallStore.getState().groupCall?.callId === invite.callId) return;

        useCallStore.getState().receiveGroupInvite(invite);
      });

      socket.on('group-call:ended', (data: { callId: string; endedBy?: string }) => {
        const state = useCallStore.getState();
        if (state.groupCall?.callId === data.callId) {
          state.endGroupCall();
        }
        if (state.incomingGroupInvite?.callId === data.callId) {
          set({ incomingGroupInvite: null });
          ringtoneHandle?.stop();
          ringtoneHandle = null;
        }
      });
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

    // ─── Group call actions (LiveKit-backed) ──────────────────────────────

    startGroupCall: async (conversationId, callType, groupName = '') => {
      try {
        const result = await livekitApi.startGroupCall(conversationId, callType);
        set({
          groupCall: {
            isActive: true,
            conversationId,
            callType,
            groupName,
            participants: [],
            startTime: new Date(),
            callId: result.callId,
            livekitToken: result.livekit.token,
            livekitWsUrl: result.livekit.wsUrl,
            livekitRoomName: result.livekit.roomName,
            isHost: true,
          },
        });
        playCallConnectedChime();
      } catch (err: any) {
        console.error('[CallStore] startGroupCall failed:', err?.response?.data?.error || err.message);
        alert('Failed to start group call: ' + (err?.response?.data?.error || err.message));
      }
    },

    receiveGroupInvite: (invite) => {
      set({ incomingGroupInvite: invite });
      const prefs = getNotificationPrefs();
      if (prefs.sound) {
        ringtoneHandle?.stop();
        ringtoneHandle = playCallRingtone();
      }
      if (prefs.desktop) {
        const callTypeLabel = invite.callType === 'video' ? 'Group Video Call' : 'Group Audio Call';
        showDesktopNotification({
          title: `Incoming ${callTypeLabel}`,
          body: `${invite.hostName} started a group call`,
          tag: `group-call-${invite.callId}`,
          requireInteraction: true,
        });
      }
    },

    acceptGroupInvite: async (callId) => {
      const invite = useCallStore.getState().incomingGroupInvite;
      if (!invite || invite.callId !== callId) return;
      ringtoneHandle?.stop();
      ringtoneHandle = null;
      try {
        const result = await livekitApi.joinGroupCall(callId);
        set({
          incomingGroupInvite: null,
          groupCall: {
            isActive: true,
            conversationId: invite.conversationId,
            callType: invite.callType,
            groupName: '',
            participants: [],
            startTime: new Date(),
            callId,
            livekitToken: result.livekit.token,
            livekitWsUrl: result.livekit.wsUrl,
            livekitRoomName: result.livekit.roomName,
            isHost: false,
          },
        });
        playCallConnectedChime();
      } catch (err: any) {
        console.error('[CallStore] acceptGroupInvite failed:', err?.response?.data?.error || err.message);
        alert('Failed to join call: ' + (err?.response?.data?.error || err.message));
        set({ incomingGroupInvite: null });
      }
    },

    declineGroupInvite: async (callId) => {
      ringtoneHandle?.stop();
      ringtoneHandle = null;
      set({ incomingGroupInvite: null });
      try {
        await livekitApi.declineGroupCall(callId);
      } catch (err) {
        console.warn('[CallStore] decline call failed (non-critical):', err);
      }
    },

    leaveGroupCall: async () => {
      // Just clear local state. LiveKit's <LiveKitRoom> will trigger an onDisconnected
      // handler that notifies the server. Server cleans up empty rooms automatically.
      playCallEndedTone();
      set({ groupCall: null });
    },

    endGroupCallForAll: async () => {
      const state = useCallStore.getState();
      const callId = state.groupCall?.callId;
      if (!callId) return;
      playCallEndedTone();
      try {
        await livekitApi.endGroupCall(callId);
      } catch (err: any) {
        console.error('[CallStore] endGroupCall failed:', err?.response?.data?.error || err.message);
      }
      set({ groupCall: null });
    },

    endGroupCall: () => {
      playCallEndedTone();
      set({ groupCall: null });
    },

    // ─── Legacy no-op shims (kept for backward compat with any existing callers) ─

    joinGroupCall: () => {
      // Legacy peer-to-peer flow is replaced by acceptGroupInvite(callId).
      console.warn('[CallStore] joinGroupCall is deprecated — use acceptGroupInvite');
    },

    addGroupParticipant: () => { /* LiveKit owns participant state now */ },
    removeGroupParticipant: () => { /* LiveKit owns participant state now */ },
    updateGroupParticipant: () => { /* LiveKit owns participant state now */ },
  };
});
