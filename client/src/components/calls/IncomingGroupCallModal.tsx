/**
 * IncomingGroupCallModal — shown to every conversation member when someone
 * starts a group call. User can accept (joins LiveKit room) or decline.
 *
 * Mirrors the visual style of the existing IncomingCallModal but tailored
 * for multi-party context (shows host name + "started a group call" verbiage).
 */

import { useEffect, useState } from 'react';
import { Phone, PhoneOff, Video, Mic } from 'lucide-react';
import { useCallStore } from '@/stores/callStore';

const AUTO_DECLINE_MS = 60_000;

export default function IncomingGroupCallModal() {
  const { incomingGroupInvite, acceptGroupInvite, declineGroupInvite } = useCallStore();
  const [busy, setBusy] = useState(false);

  // Auto-decline after 60s
  useEffect(() => {
    if (!incomingGroupInvite) return;
    const timer = setTimeout(() => {
      declineGroupInvite(incomingGroupInvite.callId).catch(console.error);
    }, AUTO_DECLINE_MS);
    return () => clearTimeout(timer);
  }, [incomingGroupInvite?.callId]);

  if (!incomingGroupInvite) return null;

  const isVideo = incomingGroupInvite.callType === 'video';

  const handleAccept = async () => {
    setBusy(true);
    try { await acceptGroupInvite(incomingGroupInvite.callId); }
    finally { setBusy(false); }
  };

  const handleDecline = async () => {
    setBusy(true);
    try { await declineGroupInvite(incomingGroupInvite.callId); }
    finally { setBusy(false); }
  };

  const initial = (incomingGroupInvite.hostName || '?').charAt(0).toUpperCase();

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          background: 'linear-gradient(145deg, #1A1A2E 0%, #2A2A45 100%)',
          borderRadius: 24, padding: 36,
          maxWidth: 380, width: '100%', textAlign: 'center',
          color: '#fff',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Animated avatar */}
        <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto 16px' }}>
          <div
            style={{
              position: 'absolute', inset: -8, borderRadius: '50%',
              background: '#6264A7', opacity: 0.4,
              animation: 'lk-pulse 1.5s ease-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute', inset: -16, borderRadius: '50%',
              background: '#6264A7', opacity: 0.2,
              animation: 'lk-pulse 1.5s ease-out infinite 0.3s',
            }}
          />
          <div
            style={{
              position: 'relative',
              width: 100, height: 100, borderRadius: '50%',
              background: '#6264A7', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 40, fontWeight: 700,
            }}
          >
            {initial}
          </div>
        </div>

        <p style={{ fontSize: 11, fontWeight: 600, color: '#8B8CA7', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Incoming {isVideo ? 'video' : 'audio'} group call
        </p>
        <p style={{ fontSize: 22, fontWeight: 700, margin: '0 0 6px 0' }}>
          {incomingGroupInvite.hostName}
        </p>
        <p style={{ fontSize: 13, color: '#A0A1BC', margin: '0 0 28px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {isVideo ? <Video size={14} /> : <Mic size={14} />}
          started a group call
        </p>

        {/* Accept / Decline buttons */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
          <button
            onClick={handleDecline}
            disabled={busy}
            style={btnStyle('#DC2626', busy)}
            title="Decline"
          >
            <PhoneOff size={26} />
          </button>
          <button
            onClick={handleAccept}
            disabled={busy}
            style={btnStyle('#16A34A', busy)}
            title="Join call"
          >
            <Phone size={26} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes lk-pulse {
          0%   { transform: scale(1);   opacity: 0.4; }
          70%  { transform: scale(1.3); opacity: 0; }
          100% { transform: scale(1.3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function btnStyle(bg: string, disabled: boolean): React.CSSProperties {
  return {
    width: 64, height: 64, borderRadius: '50%',
    background: bg, color: '#fff', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.6 : 1,
    boxShadow: '0 8px 20px rgba(0,0,0,0.3)',
    fontFamily: 'inherit',
    transition: 'transform 120ms',
  };
}
