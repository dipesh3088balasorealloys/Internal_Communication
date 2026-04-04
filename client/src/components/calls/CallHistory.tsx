import { useState, useEffect } from 'react';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Video, Clock, Loader2, RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';

interface CallRecord {
  id: string;
  sender_id: string;
  sender_name: string;
  conversation_id: string;
  call_type: 'audio' | 'video';
  status: 'completed' | 'missed' | 'declined' | 'failed';
  duration_seconds: number;
  direction: 'incoming' | 'outgoing';
  remote_name: string;
  content: string;
  started_at: string;
}

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  completed: { color: '#6BB700', label: 'Completed' },
  missed: { color: '#D13438', label: 'Missed' },
  declined: { color: '#D13438', label: 'Declined' },
  failed: { color: '#D13438', label: 'Failed' },
};

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) return `Today ${time}`;
  if (isYesterday) return `Yesterday ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ` ${time}`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#5B5FC7', '#107C10', '#D83B01', '#5C2D91', '#008272', '#B4009E', '#E81123', '#00188F'];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export default function CallHistory() {
  const { user } = useAuthStore();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverRefresh, setHoverRefresh] = useState(false);

  const fetchCalls = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data } = await api.get('/calls/history', { params: { limit: 50 } });
      setCalls(data.calls || []);
    } catch (err) {
      console.error('Failed to fetch call history:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalls();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Loader2 size={28} style={{ color: '#6264A7', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 13, color: '#8B8CA7', margin: 0 }}>Loading call history...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#FFF0F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Phone size={28} style={{ color: '#D13438' }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#242424', margin: '0 0 4px 0' }}>Could not load call history</p>
        <p style={{ fontSize: 12, color: '#A0A0A0', textAlign: 'center', margin: '0 0 16px 0' }}>
          Please try again or restart the server
        </p>
        <button
          onClick={fetchCalls}
          onMouseEnter={() => setHoverRefresh(true)}
          onMouseLeave={() => setHoverRefresh(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid #E0E0E0', background: hoverRefresh ? '#F5F5F5' : '#fff',
            cursor: 'pointer', fontSize: 13, color: '#424242', transition: 'all 0.15s',
          }}
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  if (calls.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 24px' }}>
        <div style={{ width: 64, height: 64, borderRadius: 16, background: '#F0F0FA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
          <Phone size={28} style={{ color: '#6264A7' }} />
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#242424', margin: '0 0 4px 0' }}>No calls yet</p>
        <p style={{ fontSize: 12, color: '#A0A0A0', textAlign: 'center', margin: '0 0 16px 0' }}>
          Your call history will appear here once you make or receive calls
        </p>
        <button
          onClick={fetchCalls}
          onMouseEnter={() => setHoverRefresh(true)}
          onMouseLeave={() => setHoverRefresh(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', borderRadius: 8,
            border: '1px solid #E0E0E0',
            background: hoverRefresh ? '#F5F5F5' : '#FFFFFF',
            color: '#616161', fontSize: 12, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s',
            fontFamily: 'inherit',
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div
        style={{
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #F0F0F0',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: '#8B8CA7' }}>
          {calls.length} call{calls.length !== 1 ? 's' : ''}
        </span>
        <button
          onClick={fetchCalls}
          onMouseEnter={() => setHoverRefresh(true)}
          onMouseLeave={() => setHoverRefresh(false)}
          title="Refresh"
          style={{
            width: 26, height: 26, borderRadius: 6,
            border: 'none',
            background: hoverRefresh ? '#F0F0F5' : 'transparent',
            color: '#8B8CA7', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Call list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {calls.map((call) => {
          const isOutgoing = call.direction === 'outgoing';
          const isMissed = call.status === 'missed' || call.status === 'declined' || call.status === 'failed';
          const statusConf = STATUS_CONFIG[call.status] || { color: '#A0A0A0', label: call.status };
          const isHovered = hoveredId === call.id;
          const remoteName = call.remote_name || 'Unknown';
          const avatarColor = getAvatarColor(remoteName);

          let DirectionIcon = isOutgoing ? PhoneOutgoing : PhoneIncoming;
          if (isMissed) DirectionIcon = PhoneMissed;

          return (
            <div
              key={call.id}
              onMouseEnter={() => setHoveredId(call.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 16px',
                background: isHovered ? '#F8F8FC' : 'transparent',
                borderBottom: '1px solid #F8F8F8',
                transition: 'background 0.12s',
                cursor: 'default',
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: avatarColor,
                  color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600,
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                {getInitials(remoteName)}
                {/* Call type badge */}
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 18, height: 18, borderRadius: '50%',
                  background: isMissed ? '#D13438' : '#6BB700',
                  border: '2px solid #fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {call.call_type === 'video' ? (
                    <Video size={9} color="#fff" />
                  ) : (
                    <Phone size={9} color="#fff" />
                  )}
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <p
                    style={{
                      fontSize: 13, fontWeight: 600,
                      color: isMissed ? '#D13438' : '#1A1A2E',
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {remoteName}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  <DirectionIcon size={12} color={isMissed ? '#D13438' : '#8B8CA7'} />
                  <span style={{ fontSize: 11, color: statusConf.color, fontWeight: 500 }}>
                    {isOutgoing ? 'Outgoing' : 'Incoming'}
                  </span>
                  {call.duration_seconds > 0 && (
                    <>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D0D0D8' }} />
                      <span style={{ fontSize: 11, color: '#8B8CA7', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} /> {formatDuration(call.duration_seconds)}
                      </span>
                    </>
                  )}
                  {isMissed && (
                    <span style={{ fontSize: 11, color: '#D13438', fontWeight: 500 }}>
                      · {statusConf.label}
                    </span>
                  )}
                </div>
              </div>

              {/* Timestamp */}
              <div style={{ flexShrink: 0, textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: '#A0A1BC', margin: 0 }}>
                  {formatTime(call.started_at)}
                </p>
                <p style={{ fontSize: 10, color: '#C0C0D0', margin: '2px 0 0 0' }}>
                  {call.call_type === 'video' ? 'Video' : 'Audio'}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
