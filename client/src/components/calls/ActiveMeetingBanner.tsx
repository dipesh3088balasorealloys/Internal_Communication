/**
 * ActiveMeetingBanner — persistent "Meeting in progress — Join" pill shown
 * above the chat message list when a group call is in progress in the
 * currently-open conversation.
 *
 * Lets users who weren't online when the call started discover and join it —
 * the same UX pattern as Microsoft Teams' channel meeting banner.
 *
 * Behavior:
 *   - Reads `activeGroupCalls[conversationId]` from callStore
 *   - On mount and on conversationId change, calls `refreshActiveGroupCall()`
 *     to catch up on calls started while the user wasn't subscribed yet
 *   - Hidden while the current user is already in this call (avoids self-loop)
 *   - Live duration counter, host name, participant count
 *   - "Join" button calls existing `acceptGroupInvite` flow (uses /join endpoint)
 */

import { useEffect, useMemo, useState } from 'react';
import { Video, Phone, Users } from 'lucide-react';
import { useCallStore } from '@/stores/callStore';

interface Props {
  conversationId: string;
}

function formatDuration(startedAt: string): string {
  const start = new Date(startedAt).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - start) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  // For multi-hour meetings, use "1h 23m" style to avoid being confused with a clock time
  if (h >= 1) return `${h}h ${m}m`;
  // For short meetings, show MM:SS like a stopwatch
  return `${m}:${pad(s)}`;
}

export default function ActiveMeetingBanner({ conversationId }: Props) {
  const activeCall = useCallStore((s) => s.activeGroupCalls[conversationId]);
  const currentCallId = useCallStore((s) => s.groupCall?.callId);
  const refreshActiveGroupCall = useCallStore((s) => s.refreshActiveGroupCall);
  const acceptGroupInvite = useCallStore((s) => s.acceptGroupInvite);
  const [joining, setJoining] = useState(false);
  const [tick, setTick] = useState(0); // forces re-render every second for duration

  // Catch up on calls started while we weren't subscribed
  useEffect(() => {
    if (!conversationId) return;
    refreshActiveGroupCall(conversationId);
  }, [conversationId, refreshActiveGroupCall]);

  // 1s ticker for the live duration display
  useEffect(() => {
    if (!activeCall) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [activeCall]);

  const duration = useMemo(() => {
    if (!activeCall) return '';
    return formatDuration(activeCall.startedAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCall?.startedAt, tick]);

  // Don't show if there's no active call, or if we're already in this exact call
  if (!activeCall) return null;
  if (currentCallId === activeCall.callId) return null;

  const participantCount = activeCall.participants?.length || 1;
  const callTypeLabel = activeCall.callType === 'video' ? 'Video meeting' : 'Audio meeting';
  const Icon = activeCall.callType === 'video' ? Video : Phone;

  const handleJoin = async () => {
    if (joining) return;
    setJoining(true);
    try {
      await acceptGroupInvite(activeCall.callId);
    } catch (err: any) {
      console.error('[ActiveMeetingBanner] Join failed:', err?.response?.data?.error || err.message);
      alert('Failed to join meeting: ' + (err?.response?.data?.error || err.message));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        margin: '8px 12px 4px',
        background: 'linear-gradient(90deg, #5B5FC7 0%, #6B5FD4 100%)',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(91, 95, 199, 0.25)',
        color: '#fff',
      }}
    >
      {/* Pulse dot to draw attention */}
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#4ADE80',
          boxShadow: '0 0 0 0 rgba(74, 222, 128, 0.7)',
          animation: 'meeting-pulse 1.6s infinite',
          flexShrink: 0,
        }}
      />
      <Icon size={18} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.2 }}>
          {callTypeLabel} in progress
        </div>
        <div
          style={{
            fontSize: 12,
            opacity: 0.85,
            marginTop: 2,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          Started by <strong>{activeCall.hostName}</strong> · {duration} ·{' '}
          <Users
            size={11}
            style={{ display: 'inline-block', verticalAlign: '-1px', marginRight: 2 }}
          />
          {participantCount}
        </div>
      </div>
      <button
        onClick={handleJoin}
        disabled={joining}
        style={{
          background: '#fff',
          color: '#5B5FC7',
          border: 'none',
          padding: '7px 16px',
          borderRadius: 6,
          fontSize: 13,
          fontWeight: 600,
          cursor: joining ? 'wait' : 'pointer',
          opacity: joining ? 0.7 : 1,
          flexShrink: 0,
          transition: 'transform 0.1s',
        }}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.97)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {joining ? 'Joining…' : 'Join'}
      </button>
      <style>{`
        @keyframes meeting-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.7); }
          70%  { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
          100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
        }
      `}</style>
    </div>
  );
}
