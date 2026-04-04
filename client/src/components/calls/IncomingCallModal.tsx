import { useState } from 'react';
import { Phone, Video, PhoneOff } from 'lucide-react';
import { useCallStore } from '@/stores/callStore';

export default function IncomingCallModal() {
  const { incomingCall, answerCall, rejectCall } = useCallStore();
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null);

  if (!incomingCall) return null;

  const isVideo = incomingCall.callType === 'video';
  const accentColor = isVideo ? '#0078D4' : '#6264A7';
  const callerInitial = incomingCall.remoteName?.[0]?.toUpperCase() || '?';
  const callerName = incomingCall.remoteName || 'Unknown caller';

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(10, 10, 30, 0.65)',
        backdropFilter: 'blur(8px)',
        padding: 16,
        animation: 'icmFadeIn 0.25s ease-out',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 24,
          boxShadow: '0 24px 80px rgba(0,0,0,0.3), 0 0 0 1px rgba(0,0,0,0.06)',
          padding: '40px 36px 36px',
          textAlign: 'center',
          maxWidth: 380, width: '100%',
          animation: 'icmSlideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Animated ring pulses around avatar */}
        <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto 20px' }}>
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: `2px solid ${accentColor}`, opacity: 0.4,
            animation: 'icmRingPulse 2s ease-out infinite',
          }} />
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: `2px solid ${accentColor}`, opacity: 0.4,
            animation: 'icmRingPulse 2s ease-out infinite 0.8s',
          }} />
          <div style={{
            position: 'absolute', inset: -8, borderRadius: '50%',
            border: `2px solid ${accentColor}`, opacity: 0.4,
            animation: 'icmRingPulse 2s ease-out infinite 1.6s',
          }} />
          <div
            style={{
              width: 96, height: 96, borderRadius: '50%',
              background: `linear-gradient(135deg, ${accentColor}, ${isVideo ? '#50A0E0' : '#8B8DF0'})`,
              color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 36, fontWeight: 700, letterSpacing: -1,
              boxShadow: `0 6px 28px ${accentColor}44`,
              position: 'relative', zIndex: 1,
              animation: 'icmAvatarBounce 2s ease-in-out infinite',
            }}
          >
            {callerInitial}
          </div>
        </div>

        {/* Call type badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 12px', borderRadius: 20,
          background: isVideo ? '#E8F4FD' : '#F0F0FA',
          color: accentColor,
          fontSize: 11, fontWeight: 600, marginBottom: 12,
        }}>
          {isVideo ? <Video size={13} /> : <Phone size={13} />}
          {isVideo ? 'Video Call' : 'Audio Call'}
        </div>

        <h3 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', margin: '0 0 4px 0', letterSpacing: -0.3 }}>
          {callerName}
        </h3>
        <p style={{
          fontSize: 13, color: '#8B8CA7', margin: '0 0 32px 0',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2,
        }}>
          <span>Ringing</span>
          <span style={{ animation: 'icmDotPulse 1.4s ease-in-out infinite 0.0s' }}>.</span>
          <span style={{ animation: 'icmDotPulse 1.4s ease-in-out infinite 0.2s' }}>.</span>
          <span style={{ animation: 'icmDotPulse 1.4s ease-in-out infinite 0.4s' }}>.</span>
        </p>

        {/* Action buttons — match the caller's call type */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          {[
            { key: 'reject', icon: <PhoneOff size={24} />, label: 'Decline', bg: '#D13438', hoverBg: '#B91C22', action: () => rejectCall(incomingCall.id) },
            isVideo
              ? { key: 'video', icon: <Video size={24} />, label: 'Accept', bg: '#0078D4', hoverBg: '#0068BA', action: () => answerCall(incomingCall.id, 'video') }
              : { key: 'audio', icon: <Phone size={24} />, label: 'Accept', bg: '#6BB700', hoverBg: '#52940A', action: () => answerCall(incomingCall.id, 'audio') },
          ].map(btn => (
            <div key={btn.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <button
                onClick={btn.action}
                onMouseEnter={() => setHoveredBtn(btn.key)}
                onMouseLeave={() => setHoveredBtn(null)}
                style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: hoveredBtn === btn.key ? btn.hoverBg : btn.bg,
                  color: '#fff', border: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s ease',
                  boxShadow: `0 4px 20px ${btn.bg}${hoveredBtn === btn.key ? '80' : '4D'}`,
                  transform: hoveredBtn === btn.key ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {btn.icon}
              </button>
              <span style={{ fontSize: 12, color: '#8B8CA7', fontWeight: 500 }}>{btn.label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes icmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes icmSlideUp { from { opacity: 0; transform: translateY(30px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes icmRingPulse { 0% { transform: scale(1); opacity: 0.4; } 100% { transform: scale(1.8); opacity: 0; } }
        @keyframes icmAvatarBounce { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.04); } }
        @keyframes icmDotPulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );
}
