import { useEffect, useRef, useState } from 'react';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff,
  Monitor, MonitorOff, Maximize2, Minimize2,
  Users, UserCheck, UserX,
} from 'lucide-react';
import { useCallStore } from '@/stores/callStore';
import type { GroupCallParticipant } from '@/stores/callStore';

const AVATAR_COLORS = [
  '#6264A7', '#0078D4', '#038387', '#8764B8',
  '#CA5010', '#498205', '#DA3B01', '#005B70',
  '#C239B3', '#69797E', '#7A7574', '#0099BC',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getGridCols(count: number): number {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  if (count <= 9) return 3;
  return 3;
}

export default function GroupCallOverlay() {
  const {
    groupCall, leaveGroupCall, toggleMute, toggleVideo,
    startScreenShare, stopScreenShare, isScreenSharing, currentCall,
  } = useCallStore();
  const [isExpanded, setIsExpanded] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [duration, setDuration] = useState('00:00');
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(false);

  // Timer
  useEffect(() => {
    if (!groupCall?.startTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - groupCall.startTime!.getTime()) / 1000);
      const mins = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const secs = (elapsed % 60).toString().padStart(2, '0');
      setDuration(`${mins}:${secs}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [groupCall?.startTime]);

  useEffect(() => {
    if (groupCall) {
      setIsVideoOn(groupCall.callType === 'video');
    }
  }, [groupCall?.callType]);

  if (!groupCall?.isActive) return null;

  const participants = groupCall.participants || [];
  const connectedCount = participants.filter(p => p.status === 'connected').length;
  const groupName = groupCall.groupName || 'Group Call';

  const handleToggleMute = () => {
    if (currentCall) {
      toggleMute(currentCall.id);
    }
    setIsMuted(!isMuted);
  };

  const handleToggleVideo = () => {
    if (currentCall) {
      toggleVideo(currentCall.id);
    }
    setIsVideoOn(!isVideoOn);
  };

  const handleScreenShare = () => {
    if (!currentCall) return;
    if (isScreenSharing) {
      stopScreenShare(currentCall.id);
    } else {
      startScreenShare(currentCall.id);
    }
  };

  const handleLeave = () => {
    if (currentCall) {
      useCallStore.getState().hangup(currentCall.id);
    }
    leaveGroupCall();
  };

  // Minimized bar
  if (!isExpanded) {
    return (
      <div
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90,
          background: '#6BB700', color: '#fff',
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 8, height: 8, background: '#fff', borderRadius: '50%',
              animation: 'gcPulse 2s infinite',
            }}
          />
          <Users size={16} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>{groupName}</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{connectedCount} participants</span>
          <span style={{ fontSize: 12, opacity: 0.8 }}>{duration}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setIsExpanded(true)}
            style={{
              padding: 6, borderRadius: 6, border: 'none',
              background: 'transparent', color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <Maximize2 size={16} />
          </button>
          <button
            onClick={handleLeave}
            style={{
              padding: '4px 12px', borderRadius: 20, border: 'none',
              background: '#D13438', color: '#fff', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#C41E24'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#D13438'; }}
          >
            Leave
          </button>
        </div>
        <style>{`@keyframes gcPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
      </div>
    );
  }

  const gridCols = getGridCols(participants.length);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 90,
        background: '#1A1A2E',
        display: 'flex', flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 24px',
          background: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Users size={20} color="rgba(255,255,255,0.7)" />
          <div>
            <h3 style={{ color: '#fff', fontWeight: 600, fontSize: 18, margin: 0 }}>{groupName}</h3>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: '2px 0 0 0' }}>
              {duration} • {connectedCount} participant{connectedCount !== 1 ? 's' : ''} • {isVideoOn ? 'Video' : 'Audio'} Call
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setShowParticipants(!showParticipants)}
            onMouseEnter={() => setHoveredBtn('participants')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              padding: '6px 12px', borderRadius: 8, border: 'none',
              background: showParticipants ? 'rgba(255,255,255,0.2)' : hoveredBtn === 'participants' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500,
              display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background 0.15s',
            }}
          >
            <Users size={14} /> {connectedCount}
          </button>
          <button
            onClick={() => setIsExpanded(false)}
            onMouseEnter={() => setHoveredBtn('minimize')}
            onMouseLeave={() => setHoveredBtn(null)}
            style={{
              padding: 8, borderRadius: 8, border: 'none',
              background: hoveredBtn === 'minimize' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'all 0.15s',
            }}
          >
            <Minimize2 size={20} />
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Participant grid */}
        <div
          style={{
            flex: 1, padding: 12, overflow: 'auto',
            display: 'grid',
            gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
            gap: 8,
            alignContent: participants.length <= 4 ? 'center' : 'start',
          }}
        >
          {participants.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(255,255,255,0.5)', gap: 12, padding: 40,
            }}>
              <Users size={48} />
              <p style={{ fontSize: 16, margin: 0 }}>Waiting for participants to join...</p>
            </div>
          ) : (
            participants.map((p) => (
              <ParticipantTile key={p.userId} participant={p} isVideo={isVideoOn} />
            ))
          )}
        </div>

        {/* Participants sidebar */}
        {showParticipants && (
          <div
            style={{
              width: 260, minWidth: 260, borderLeft: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.2)', overflowY: 'auto',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <h4 style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: 0 }}>
                Participants ({participants.length})
              </h4>
            </div>
            {participants.map((p) => {
              const color = getAvatarColor(p.displayName);
              const statusIcon = p.status === 'connected'
                ? <UserCheck size={12} color="#6BB700" />
                : p.status === 'ringing'
                  ? <span style={{ fontSize: 10, color: '#FFAA44' }}>Ringing...</span>
                  : <UserX size={12} color="#D13438" />;
              return (
                <div
                  key={p.userId}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 16px',
                  }}
                >
                  <div
                    style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: color, color: '#fff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 600, flexShrink: 0,
                    }}
                  >
                    {p.displayName[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {p.displayName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {statusIcon}
                      {p.isMuted && <MicOff size={11} color="rgba(255,255,255,0.4)" />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screen Sharing Banner */}
      {isScreenSharing && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          padding: '8px 20px', background: '#6264A7', color: '#fff', flexShrink: 0,
          fontSize: 13, fontWeight: 500,
        }}>
          <Monitor size={16} />
          <span>You are sharing your screen with the group</span>
          <button
            onClick={handleScreenShare}
            style={{ marginLeft: 10, padding: '4px 14px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
          >
            Stop Sharing
          </button>
        </div>
      )}

      {/* Controls bar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
          padding: '24px 0',
          background: 'rgba(0,0,0,0.3)',
          flexShrink: 0,
        }}
      >
        <GCButton
          icon={isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          label={isMuted ? 'Unmute' : 'Mute'}
          active={isMuted}
          onClick={handleToggleMute}
          id="mute"
          hoveredBtn={hoveredBtn}
          setHoveredBtn={setHoveredBtn}
        />
        <GCButton
          icon={isVideoOn ? <Video size={22} /> : <VideoOff size={22} />}
          label={isVideoOn ? 'Stop Video' : 'Start Video'}
          active={!isVideoOn}
          onClick={handleToggleVideo}
          id="video"
          hoveredBtn={hoveredBtn}
          setHoveredBtn={setHoveredBtn}
        />
        <GCButton
          icon={isScreenSharing ? <MonitorOff size={22} /> : <Monitor size={22} />}
          label={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          active={isScreenSharing}
          onClick={handleScreenShare}
          id="screen"
          hoveredBtn={hoveredBtn}
          setHoveredBtn={setHoveredBtn}
        />
        {/* Leave button */}
        <button
          onClick={handleLeave}
          onMouseEnter={() => setHoveredBtn('leave')}
          onMouseLeave={() => setHoveredBtn(null)}
          title="Leave Call"
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: hoveredBtn === 'leave' ? '#C41E24' : '#D13438',
            color: '#fff', border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'background 0.15s',
            boxShadow: '0 4px 16px rgba(209,52,56,0.4)',
          }}
        >
          <PhoneOff size={24} />
        </button>
      </div>
    </div>
  );
}

function ParticipantTile({ participant: p, isVideo }: { participant: GroupCallParticipant; isVideo: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const color = getAvatarColor(p.displayName);

  useEffect(() => {
    if (videoRef.current && p.stream) {
      videoRef.current.srcObject = p.stream;
    }
  }, [p.stream]);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#252540',
        aspectRatio: isVideo ? '16/9' : '1',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: p.status === 'connected' ? '2px solid rgba(255,255,255,0.1)' : '2px solid rgba(255,255,255,0.05)',
        minHeight: isVideo ? 160 : 120,
      }}
    >
      {isVideo && p.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={p.userId === 'self'}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 64, height: 64, borderRadius: '50%',
              background: color, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 700, margin: '0 auto',
              boxShadow: p.status === 'connected' ? `0 0 0 3px rgba(255,255,255,0.1)` : 'none',
            }}
          >
            {p.displayName[0]?.toUpperCase() || '?'}
          </div>
        </div>
      )}

      {/* Name overlay at bottom */}
      <div
        style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '6px 10px',
          background: 'linear-gradient(transparent, rgba(0,0,0,0.6))',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.displayName}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {p.isMuted && <MicOff size={12} color="rgba(255,255,255,0.7)" />}
          {p.status === 'ringing' && (
            <span style={{ fontSize: 10, color: '#FFAA44' }}>Ringing</span>
          )}
          {p.status === 'disconnected' && (
            <span style={{ fontSize: 10, color: '#D13438' }}>Left</span>
          )}
        </div>
      </div>
    </div>
  );
}

function GCButton({
  icon, label, active, onClick, id, hoveredBtn, setHoveredBtn,
}: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
  id: string; hoveredBtn: string | null; setHoveredBtn: (id: string | null) => void;
}) {
  const isHovered = hoveredBtn === id;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHoveredBtn(id)}
      onMouseLeave={() => setHoveredBtn(null)}
      title={label}
      style={{
        width: 48, height: 48, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: 'none', cursor: 'pointer',
        transition: 'background 0.15s',
        color: active ? '#fff' : 'rgba(255,255,255,0.8)',
        background: active
          ? 'rgba(255,255,255,0.3)'
          : isHovered ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.1)',
      }}
    >
      {icon}
    </button>
  );
}
