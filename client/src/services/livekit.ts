/**
 * LiveKit API client — wraps the BAL Connect backend endpoints.
 *
 * The actual LiveKit WebSocket / WebRTC connection is established inside the
 * <LiveKitRoom> React component (from @livekit/components-react) — this file
 * only handles the BAL Connect REST API that mints tokens and tracks call state.
 */

import api from './api';

export interface GroupCallStartResponse {
  callId: string;
  livekit: {
    wsUrl: string;
    token: string;
    roomName: string;
  };
}

export interface GroupCallJoinResponse {
  livekit: {
    wsUrl: string;
    token: string;
    roomName: string;
  };
}

/** Host starts a new group call. Backend mints token + rings every conversation member. */
export async function startGroupCall(
  conversationId: string,
  callType: 'audio' | 'video',
): Promise<GroupCallStartResponse> {
  const { data } = await api.post('/calls/group/start', { conversationId, callType });
  return data;
}

/** Callee accepts an incoming ring — mint their own token for the room. */
export async function joinGroupCall(callId: string): Promise<GroupCallJoinResponse> {
  const { data } = await api.post(`/calls/group/${callId}/join`);
  return data;
}

/** Callee declines an incoming ring — backend marks declined for analytics. */
export async function declineGroupCall(callId: string): Promise<void> {
  await api.post(`/calls/group/${callId}/decline`);
}

/** Host force-ends the call for everyone. */
export async function endGroupCall(callId: string): Promise<void> {
  await api.post(`/calls/group/${callId}/end`);
}

/** Host removes a single participant. */
export async function kickGroupParticipant(callId: string, targetUserId: string): Promise<void> {
  await api.post(`/calls/group/${callId}/kick`, { targetUserId });
}

/** Host server-side mutes a participant's audio. */
export async function muteGroupParticipant(callId: string, targetUserId: string, mute: boolean): Promise<void> {
  await api.post(`/calls/group/${callId}/mute-user`, { targetUserId, mute });
}
