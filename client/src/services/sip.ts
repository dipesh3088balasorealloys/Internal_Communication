import { UserAgent, Registerer, Inviter, Invitation, SessionState, Session } from 'sip.js';
import type { UserAgentOptions, RegistererOptions } from 'sip.js';

// UCM6304 WebSocket gateway — proxied through our backend to avoid self-signed cert issues
const WSS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const UCM_WSS_URL = `${WSS_PROTOCOL}//${window.location.host}/wss-proxy`;
const UCM_SIP_DOMAIN = '192.168.7.2';

export type CallDirection = 'incoming' | 'outgoing';
export type CallType = 'audio' | 'video';

export interface ActiveCall {
  id: string;
  session: Session;
  direction: CallDirection;
  callType: CallType;
  remoteExtension: string;
  remoteName?: string;
  startTime?: Date;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  isMuted: boolean;
  isOnHold: boolean;
}

type CallEventHandler = (call: ActiveCall) => void;
type CallEndHandler = (callId: string, reason: string) => void;

class SIPService {
  private userAgent: UserAgent | null = null;
  private registerer: Registerer | null = null;
  private activeCalls: Map<string, ActiveCall> = new Map();

  // Event handlers
  onIncomingCall: CallEventHandler | null = null;
  onCallEstablished: CallEventHandler | null = null;
  onCallEnded: CallEndHandler | null = null;
  onRegistered: (() => void) | null = null;
  onUnregistered: (() => void) | null = null;
  onRegistrationFailed: ((error: string) => void) | null = null;

  get isRegistered(): boolean {
    return this.registerer?.state === 'Registered';
  }

  get calls(): ActiveCall[] {
    return Array.from(this.activeCalls.values());
  }

  async register(extension: string, password: string): Promise<void> {
    // Quick connectivity check — don't spam SIP errors if UCM is unreachable
    const reachable = await this.checkUCMReachable();
    if (!reachable) {
      console.log('[SIP] UCM6304 not reachable, skipping SIP registration (calling features disabled)');
      this.onRegistrationFailed?.('UCM6304 not reachable');
      return;
    }

    const uri = UserAgent.makeURI(`sip:${extension}@${UCM_SIP_DOMAIN}`);
    if (!uri) throw new Error('Failed to create SIP URI');

    const options: UserAgentOptions = {
      uri,
      transportOptions: {
        server: UCM_WSS_URL,
      },
      authorizationUsername: extension,
      authorizationPassword: password,
      displayName: extension,
      logLevel: 'error',
      delegate: {
        onInvite: (invitation: Invitation) => {
          this.handleIncomingCall(invitation);
        },
      },
    };

    this.userAgent = new UserAgent(options);

    // Start the user agent
    await this.userAgent.start();
    console.log('[SIP] UserAgent started');

    // Register
    const registererOptions: RegistererOptions = {
      expires: 600, // 10 minutes
    };
    this.registerer = new Registerer(this.userAgent, registererOptions);

    this.registerer.stateChange.addListener((state) => {
      switch (state) {
        case 'Registered':
          console.log('[SIP] Registered as extension', extension);
          this.onRegistered?.();
          break;
        case 'Unregistered':
          console.log('[SIP] Unregistered');
          this.onUnregistered?.();
          break;
        case 'Terminated':
          console.log('[SIP] Registration terminated');
          break;
      }
    });

    try {
      await this.registerer.register();
    } catch (err: any) {
      console.warn('[SIP] Registration failed — UCM6304 may be unreachable. Calling disabled.');
      this.onRegistrationFailed?.('UCM6304 unreachable — upgrade firmware to enable WebRTC');
      // Don't throw — allow app to continue without calling
    }
  }

  async unregister(): Promise<void> {
    try {
      if (this.registerer) {
        await this.registerer.unregister();
      }
      if (this.userAgent) {
        await this.userAgent.stop();
      }
    } catch (err) {
      console.error('[SIP] Unregister error:', err);
    }
    this.userAgent = null;
    this.registerer = null;
  }

  async makeCall(targetExtension: string, callType: CallType = 'audio'): Promise<ActiveCall> {
    if (!this.userAgent) throw new Error('Not registered');

    const targetUri = UserAgent.makeURI(`sip:${targetExtension}@${UCM_SIP_DOMAIN}`);
    if (!targetUri) throw new Error('Invalid target extension');

    const inviter = new Inviter(this.userAgent, targetUri, {
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: callType === 'video',
        },
      },
    });

    const callId = `call-${Date.now()}`;
    const call: ActiveCall = {
      id: callId,
      session: inviter,
      direction: 'outgoing',
      callType,
      remoteExtension: targetExtension,
      isMuted: false,
      isOnHold: false,
    };

    this.setupSessionHandlers(call);
    this.activeCalls.set(callId, call);

    await inviter.invite();
    console.log(`[SIP] Calling ${targetExtension} (${callType})`);

    return call;
  }

  /**
   * Join a UCM6304 conference room. Each group conversation maps to a
   * conference extension in the 6300-6399 range. The call is identical
   * to a regular makeCall — the UCM handles audio/video mixing.
   */
  async joinConference(roomExtension: string, callType: CallType = 'audio'): Promise<ActiveCall> {
    return this.makeCall(roomExtension, callType);
  }

  async answerCall(callId: string, callType: CallType = 'audio'): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call || !(call.session instanceof Invitation)) {
      throw new Error('Call not found or not an incoming call');
    }

    await (call.session as Invitation).accept({
      sessionDescriptionHandlerOptions: {
        constraints: {
          audio: true,
          video: callType === 'video',
        },
      },
    });

    call.callType = callType;
  }

  async rejectCall(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call || !(call.session instanceof Invitation)) return;

    await (call.session as Invitation).reject();
    this.activeCalls.delete(callId);
  }

  async hangup(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call) return;

    const session = call.session;
    switch (session.state) {
      case SessionState.Initial:
      case SessionState.Establishing:
        if (session instanceof Inviter) {
          await session.cancel();
        } else if (session instanceof Invitation) {
          await session.reject();
        }
        break;
      case SessionState.Established:
        await session.bye();
        break;
    }

    this.cleanupCall(callId);
  }

  toggleMute(callId: string): boolean {
    const call = this.activeCalls.get(callId);
    if (!call) return false;

    call.isMuted = !call.isMuted;
    const sdh = call.session.sessionDescriptionHandler;
    if (sdh) {
      const pc = (sdh as any).peerConnection as RTCPeerConnection | undefined;
      if (pc) {
        pc.getSenders().forEach((sender) => {
          if (sender.track?.kind === 'audio') {
            sender.track.enabled = !call.isMuted;
          }
        });
      }
    }
    return call.isMuted;
  }

  toggleVideo(callId: string): boolean {
    const call = this.activeCalls.get(callId);
    if (!call) return false;

    const sdh = call.session.sessionDescriptionHandler;
    if (sdh) {
      const pc = (sdh as any).peerConnection as RTCPeerConnection | undefined;
      if (pc) {
        const videoSenders = pc.getSenders().filter((s) => s.track?.kind === 'video');
        const isEnabled = videoSenders[0]?.track?.enabled ?? false;
        videoSenders.forEach((sender) => {
          if (sender.track) sender.track.enabled = !isEnabled;
        });
        return !isEnabled;
      }
    }
    return false;
  }

  async startScreenShare(callId: string): Promise<MediaStream | null> {
    const call = this.activeCalls.get(callId);
    if (!call) return null;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      const sdh = call.session.sessionDescriptionHandler;
      if (sdh) {
        const pc = (sdh as any).peerConnection as RTCPeerConnection | undefined;
        if (pc) {
          const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
          if (videoSender && screenStream.getVideoTracks()[0]) {
            await videoSender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        }
      }

      // Handle user stopping screen share
      screenStream.getVideoTracks()[0].onended = () => {
        this.stopScreenShare(callId);
      };

      return screenStream;
    } catch (err) {
      console.error('[SIP] Screen share failed:', err);
      return null;
    }
  }

  async stopScreenShare(callId: string): Promise<void> {
    const call = this.activeCalls.get(callId);
    if (!call || !call.localStream) return;

    const sdh = call.session.sessionDescriptionHandler;
    if (sdh) {
      const pc = (sdh as any).peerConnection as RTCPeerConnection | undefined;
      if (pc) {
        const videoSender = pc.getSenders().find((s) => s.track?.kind === 'video');
        const localVideoTrack = call.localStream.getVideoTracks()[0];
        if (videoSender && localVideoTrack) {
          await videoSender.replaceTrack(localVideoTrack);
        }
      }
    }
  }

  private checkUCMReachable(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 3000);

      const ws = new WebSocket(UCM_WSS_URL);
      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };
      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    });
  }

  private handleIncomingCall(invitation: Invitation) {
    const callId = `call-${Date.now()}`;
    const remoteUri = invitation.remoteIdentity.uri;
    const remoteExtension = remoteUri.user || 'unknown';
    const remoteName = invitation.remoteIdentity.displayName || remoteExtension;

    const call: ActiveCall = {
      id: callId,
      session: invitation,
      direction: 'incoming',
      callType: 'audio', // Will update when answered
      remoteExtension,
      remoteName,
      isMuted: false,
      isOnHold: false,
    };

    this.setupSessionHandlers(call);
    this.activeCalls.set(callId, call);

    console.log(`[SIP] Incoming call from ${remoteExtension}`);
    this.onIncomingCall?.(call);
  }

  private setupSessionHandlers(call: ActiveCall) {
    const session = call.session;

    session.stateChange.addListener((state) => {
      switch (state) {
        case SessionState.Established:
          call.startTime = new Date();
          this.setupMediaStreams(call);
          this.onCallEstablished?.(call);
          break;
        case SessionState.Terminated:
          this.cleanupCall(call.id);
          this.onCallEnded?.(call.id, 'ended');
          break;
      }
    });
  }

  private setupMediaStreams(call: ActiveCall) {
    const sdh = call.session.sessionDescriptionHandler;
    if (!sdh) return;

    const pc = (sdh as any).peerConnection as RTCPeerConnection | undefined;
    if (!pc) return;

    // Remote stream
    const remoteStream = new MediaStream();
    pc.getReceivers().forEach((receiver) => {
      if (receiver.track) {
        remoteStream.addTrack(receiver.track);
      }
    });
    call.remoteStream = remoteStream;

    // Local stream
    const localStream = new MediaStream();
    pc.getSenders().forEach((sender) => {
      if (sender.track) {
        localStream.addTrack(sender.track);
      }
    });
    call.localStream = localStream;
  }

  private cleanupCall(callId: string) {
    const call = this.activeCalls.get(callId);
    if (call) {
      // Stop all tracks
      call.localStream?.getTracks().forEach((t) => t.stop());
      call.remoteStream?.getTracks().forEach((t) => t.stop());
      this.activeCalls.delete(callId);
    }
  }
}

// Singleton
export const sipService = new SIPService();

/**
 * Derive a deterministic conference extension for a conversation.
 * Maps conversationId → UCM6304 conference range 6300-6399.
 */
export function conferenceExtension(conversationId: string): string {
  let hash = 0;
  for (let i = 0; i < conversationId.length; i++) {
    hash = conversationId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const ext = 6300 + (Math.abs(hash) % 100);
  return ext.toString();
}
