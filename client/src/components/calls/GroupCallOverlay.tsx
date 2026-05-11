/**
 * GroupCallOverlay — Teams/Meet-style group call UI backed by LiveKit SFU.
 *
 * Renders only when `callStore.groupCall.isActive && groupCall.livekitToken` is set.
 * Hands media routing entirely to LiveKit's React SDK (`<LiveKitRoom>`) — we keep
 * the BAL Connect look (purple theme, Lucide icons) but reuse the battle-tested
 * SFU primitives for grid layout, mute toggles, active speaker, screen share.
 */

import { useEffect, useRef, useState } from 'react';
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  ControlBar,
  useTracks,
  useParticipants,
  useLocalParticipant,
  RoomAudioRenderer,
  ConnectionStateToast,
} from '@livekit/components-react';
import { Track, RoomEvent, type DisconnectReason } from 'livekit-client';
import '@livekit/components-styles';
import { PhoneOff, Users, Minimize2, Maximize2 } from 'lucide-react';
import { useCallStore } from '@/stores/callStore';
import * as livekitApi from '@/services/livekit';

export default function GroupCallOverlay() {
  const { groupCall, endGroupCall } = useCallStore();

  // Only mount when we have a token (i.e. we're actually in a LiveKit room)
  if (!groupCall?.isActive || !groupCall.livekitToken || !groupCall.livekitWsUrl) {
    return null;
  }

  return (
    <LiveKitRoom
      serverUrl={groupCall.livekitWsUrl}
      token={groupCall.livekitToken}
      connect={true}
      video={groupCall.callType === 'video'}
      audio={true}
      onDisconnected={(reason?: DisconnectReason) => {
        console.log('[LiveKit] Disconnected:', reason);
        endGroupCall();
      }}
      onError={(err) => {
        console.error('[LiveKit] Connection error:', err);
      }}
      style={{ height: '100vh' }}
      data-lk-theme="default"
    >
      <RoomAudioRenderer />
      <ConnectionStateToast />
      <GroupCallContent />
    </LiveKitRoom>
  );
}

function GroupCallContent() {
  const { groupCall, leaveGroupCall, endGroupCallForAll } = useCallStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [duration, setDuration] = useState('00:00');
  const [showParticipantsPanel, setShowParticipantsPanel] = useState(false);
  const startTimeRef = useRef(groupCall?.startTime ?? new Date());

  // Duration timer
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current.getTime()) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      setDuration(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get all tracks (camera + screen share) for grid
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const participants = useParticipants();
  const participantCount = participants.length;
  const isHost = !!groupCall?.isHost;

  const handleLeave = async () => {
    await leaveGroupCall();
  };

  const handleEndForAll = async () => {
    if (!confirm('End the call for everyone?')) return;
    await endGroupCallForAll();
  };

  // ─── Minimized bar ─────────────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <div
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
          background: '#1A1A2E', color: '#fff', borderRadius: 16,
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
          fontFamily: 'inherit',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 12, fontWeight: 700 }}>Group Call</span>
          <span style={{ fontSize: 11, color: '#8B8CA7' }}>
            {participantCount} {participantCount === 1 ? 'participant' : 'participants'} · {duration}
          </span>
        </div>
        <button
          onClick={() => setIsExpanded(true)}
          title="Expand"
          style={iconBtnStyle('#3A3A55')}
        >
          <Maximize2 size={14} />
        </button>
        <button
          onClick={handleLeave}
          title="Leave"
          style={iconBtnStyle('#DC2626')}
        >
          <PhoneOff size={14} />
        </button>
      </div>
    );
  }

  // ─── Expanded full-screen overlay ──────────────────────────────────────
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#0F0F1F',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'inherit',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px', borderBottom: '1px solid #2A2A45',
          color: '#fff', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%', background: '#16A34A',
            boxShadow: '0 0 8px #16A34A',
          }} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
              {groupCall?.callType === 'video' ? 'Group Video Call' : 'Group Audio Call'}
            </p>
            <p style={{ fontSize: 11, color: '#8B8CA7', margin: 0 }}>
              {duration} · {participantCount} {participantCount === 1 ? 'participant' : 'participants'}
              {isHost && <span style={{ marginLeft: 8, padding: '1px 6px', background: '#6264A7', borderRadius: 4, fontSize: 10 }}>HOST</span>}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowParticipantsPanel(!showParticipantsPanel)}
            style={topBarBtnStyle(showParticipantsPanel)}
            title="Participants"
          >
            <Users size={14} /> {participantCount}
          </button>
          <button onClick={() => setIsExpanded(false)} style={topBarBtnStyle(false)} title="Minimize">
            <Minimize2 size={14} />
          </button>
        </div>
      </div>

      {/* Main area: grid + optional participants panel */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Grid */}
        <div style={{ flex: 1, padding: 16, minWidth: 0 }}>
          <GridLayout tracks={tracks} style={{ height: '100%' }}>
            <ParticipantTile />
          </GridLayout>
        </div>

        {/* Participants side panel (toggleable) */}
        {showParticipantsPanel && (
          <ParticipantsPanel isHost={isHost} callId={groupCall?.callId ?? null} />
        )}
      </div>

      {/* Bottom controls */}
      <div
        style={{
          padding: '12px 20px', borderTop: '1px solid #2A2A45',
          background: '#1A1A2E',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0, gap: 12,
        }}
      >
        {/* LiveKit's built-in control bar (mute/camera/screen share/leave) */}
        <div style={{ flex: 1 }}>
          <ControlBar
            variation="minimal"
            controls={{
              microphone: true,
              camera: groupCall?.callType === 'video',
              screenShare: true,
              chat: false,
              leave: false, // We render our own leave button (handles "end for all" host option)
              settings: false,
            }}
          />
        </div>

        {/* Custom leave / end-for-all */}
        <div style={{ display: 'flex', gap: 8 }}>
          {isHost && (
            <button onClick={handleEndForAll} style={endForAllBtnStyle}>
              End for all
            </button>
          )}
          <button onClick={handleLeave} style={leaveBtnStyle} title="Leave call">
            <PhoneOff size={16} />
            <span style={{ fontWeight: 600 }}>Leave</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Participants side panel ──────────────────────────────────────────────
function ParticipantsPanel({ isHost, callId }: { isHost: boolean; callId: string | null }) {
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const [busyOnUser, setBusyOnUser] = useState<string | null>(null);

  const handleKick = async (identity: string) => {
    if (!callId || !isHost || identity === localParticipant.identity) return;
    if (!confirm(`Remove ${identity} from the call?`)) return;
    setBusyOnUser(identity);
    try { await livekitApi.kickGroupParticipant(callId, identity); }
    catch (err: any) { alert('Kick failed: ' + (err?.response?.data?.error || err.message)); }
    finally { setBusyOnUser(null); }
  };

  const handleMuteOther = async (identity: string, isMuted: boolean) => {
    if (!callId || !isHost || identity === localParticipant.identity) return;
    setBusyOnUser(identity);
    try { await livekitApi.muteGroupParticipant(callId, identity, !isMuted); }
    catch (err: any) { alert('Mute failed: ' + (err?.response?.data?.error || err.message)); }
    finally { setBusyOnUser(null); }
  };

  return (
    <div
      style={{
        width: 280, flexShrink: 0,
        background: '#1A1A2E', borderLeft: '1px solid #2A2A45',
        padding: 16, overflowY: 'auto',
        color: '#fff',
      }}
    >
      <h3 style={{ fontSize: 13, fontWeight: 700, color: '#fff', margin: '0 0 12px 0' }}>
        Participants ({participants.length})
      </h3>
      {participants.map((p) => {
        const isLocal = p.identity === localParticipant.identity;
        const audioPub = p.getTrackPublication(Track.Source.Microphone);
        const isMuted = !!audioPub?.isMuted;
        const busy = busyOnUser === p.identity;
        return (
          <div
            key={p.identity}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', marginBottom: 6,
              fontSize: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: '#6264A7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700, flexShrink: 0,
              }}>
                {(p.name || p.identity || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.name || p.identity}
                  {isLocal && <span style={{ color: '#8B8CA7', fontWeight: 400 }}> (you)</span>}
                </p>
                <p style={{ margin: 0, fontSize: 10, color: '#8B8CA7' }}>
                  {isMuted ? 'Muted' : 'Speaking-allowed'}
                </p>
              </div>
            </div>
            {isHost && !isLocal && (
              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                <button
                  onClick={() => handleMuteOther(p.identity, isMuted)}
                  disabled={busy}
                  style={participantActionBtnStyle('#D97706')}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  onClick={() => handleKick(p.identity)}
                  disabled={busy}
                  style={participantActionBtnStyle('#DC2626')}
                  title="Remove from call"
                >
                  Remove
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Style helpers ────────────────────────────────────────────────────────
const iconBtnStyle = (bg: string): React.CSSProperties => ({
  width: 32, height: 32, borderRadius: '50%',
  background: bg, color: '#fff', border: 'none',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer',
});

const topBarBtnStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', gap: 4,
  padding: '6px 10px', borderRadius: 8,
  background: active ? '#6264A7' : '#2A2A45',
  color: '#fff', border: 'none', cursor: 'pointer',
  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
});

const leaveBtnStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', borderRadius: 24,
  background: '#DC2626', color: '#fff', border: 'none',
  cursor: 'pointer', fontFamily: 'inherit',
};

const endForAllBtnStyle: React.CSSProperties = {
  padding: '8px 14px', borderRadius: 24,
  background: 'transparent', color: '#FECACA', border: '1px solid #DC2626',
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
};

const participantActionBtnStyle = (color: string): React.CSSProperties => ({
  padding: '4px 8px', borderRadius: 6,
  background: 'transparent', color, border: `1px solid ${color}`,
  cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 600,
});
