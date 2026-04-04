import { useState, useEffect, useMemo } from 'react';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, PhoneCall,
  Video, Clock, Loader2, RefreshCw, Search,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useCallStore } from '@/stores/callStore';
import api from '@/services/api';

/* ===================================================================
   TYPES
   =================================================================== */
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
  remote_user_id: string | null;
  content: string;
  started_at: string;
}

type FilterType = 'all' | 'missed' | 'incoming' | 'outgoing';

/* ===================================================================
   HELPERS
   =================================================================== */
function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `0:${s.toString().padStart(2, '0')}`;
}

function formatCallTime(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = d.toDateString() === yesterday.toDateString();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  let date: string;

  if (isToday) date = 'Today';
  else if (isYesterday) date = 'Yesterday';
  else {
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays < 7) date = dayNames[d.getDay()];
    else date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  return { date, time };
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

/* ===================================================================
   MAIN COMPONENT
   =================================================================== */
export default function CallsWindow() {
  const { user } = useAuthStore();
  const { makeCall } = useCallStore();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [hoveredCallId, setHoveredCallId] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);

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

  useEffect(() => { fetchCalls(); }, []);

  // Client-side filtering
  const filteredCalls = useMemo(() => {
    let result = calls;
    if (activeFilter === 'missed') result = result.filter(c => c.status === 'missed' || c.status === 'declined' || c.status === 'failed');
    if (activeFilter === 'incoming') result = result.filter(c => c.direction === 'incoming');
    if (activeFilter === 'outgoing') result = result.filter(c => c.direction === 'outgoing');
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => c.remote_name.toLowerCase().includes(q));
    }
    return result;
  }, [calls, activeFilter, searchQuery]);

  const handleCallBack = (call: CallRecord, type: 'audio' | 'video' = 'audio') => {
    if (!call.remote_user_id) return;
    makeCall(call.remote_user_id, type, call.remote_name, call.conversation_id);
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: '#F5F5F5' }}>
      {/* ─── Left Panel: Call History List ─── */}
      <div style={{
        width: 420, minWidth: 340, display: 'flex', flexDirection: 'column',
        background: '#fff', borderRight: '1px solid #E0E0E0', flexShrink: 0,
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 8, background: '#5B5FC7',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Phone size={16} color="#fff" />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#242424', margin: 0 }}>Calls</h2>
            </div>
            <RefreshButton onClick={fetchCalls} />
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
            background: '#F5F5F5', borderRadius: 8,
            border: searchFocused ? '1px solid #5B5FC7' : '1px solid transparent',
            transition: 'border 0.15s',
          }}>
            <Search size={14} color="#8B8CA7" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search call history..."
              style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13, color: '#242424' }}
            />
          </div>
        </div>

        {/* Filter Chips */}
        <div style={{ display: 'flex', gap: 6, padding: '0 20px 12px', flexShrink: 0, flexWrap: 'wrap' }}>
          {([
            { key: 'all' as FilterType, label: 'All' },
            { key: 'missed' as FilterType, label: 'Missed' },
            { key: 'incoming' as FilterType, label: 'Incoming' },
            { key: 'outgoing' as FilterType, label: 'Outgoing' },
          ]).map(f => (
            <FilterChip
              key={f.key}
              label={f.label}
              active={activeFilter === f.key}
              onClick={() => setActiveFilter(f.key)}
            />
          ))}
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: '#E8E8E8', flexShrink: 0 }} />

        {/* Call List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10 }}>
              <Loader2 size={24} style={{ color: '#5B5FC7', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#8B8CA7' }}>Loading calls...</span>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : loadError ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
              <Phone size={32} color="#D13438" />
              <p style={{ fontSize: 14, fontWeight: 500, color: '#242424', margin: 0 }}>Could not load calls</p>
              <button onClick={fetchCalls} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 6,
                border: '1px solid #E0E0E0', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#424242',
              }}>
                <RefreshCw size={13} /> Retry
              </button>
            </div>
          ) : filteredCalls.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, padding: 24 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#F0F0FA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Phone size={24} color="#5B5FC7" />
              </div>
              <p style={{ fontSize: 14, fontWeight: 500, color: '#242424', margin: 0 }}>
                {searchQuery ? 'No calls match your search' : activeFilter !== 'all' ? `No ${activeFilter} calls` : 'No calls yet'}
              </p>
              <p style={{ fontSize: 12, color: '#8B8CA7', margin: 0, textAlign: 'center' }}>
                {!searchQuery && activeFilter === 'all' ? 'Your call history will appear here once you make or receive calls' : 'Try adjusting your search or filter'}
              </p>
            </div>
          ) : (
            <>
              {/* History Section Header */}
              <div style={{ padding: '10px 20px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#8B8CA7', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  History
                </span>
                <span style={{ fontSize: 11, color: '#B0B0B0' }}>
                  ({filteredCalls.length})
                </span>
              </div>

              {filteredCalls.map(call => (
                <CallRow
                  key={call.id}
                  call={call}
                  isHovered={hoveredCallId === call.id}
                  onHover={() => setHoveredCallId(call.id)}
                  onLeave={() => setHoveredCallId(null)}
                  onCallBack={(type) => handleCallBack(call, type)}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* ─── Right Panel: Empty / Detail State ─── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', background: '#FAFAFA', minWidth: 0,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: 20, background: '#F0F0FA',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <PhoneCall size={36} color="#5B5FC7" strokeWidth={1.5} />
        </div>
        <p style={{ fontSize: 16, fontWeight: 600, color: '#242424', margin: '0 0 6px' }}>Make a call</p>
        <p style={{ fontSize: 13, color: '#8B8CA7', margin: 0, textAlign: 'center', maxWidth: 280, lineHeight: 1.5 }}>
          Click the call button on any contact in the history to start a call, or start a new call from a chat conversation.
        </p>
      </div>
    </div>
  );
}

/* ===================================================================
   FILTER CHIP
   =================================================================== */
function FilterChip({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '5px 14px', borderRadius: 16,
        border: active ? '1px solid #5B5FC7' : '1px solid #E0E0E0',
        background: active ? '#E8EBFA' : hovered ? '#F0F0F0' : '#fff',
        color: active ? '#5B5FC7' : '#616161',
        fontSize: 12, fontWeight: active ? 600 : 400,
        cursor: 'pointer', transition: 'all 0.12s',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  );
}

/* ===================================================================
   CALL ROW
   =================================================================== */
function CallRow({ call, isHovered, onHover, onLeave, onCallBack }: {
  call: CallRecord;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
  onCallBack: (type: 'audio' | 'video') => void;
}) {
  const isMissed = call.status === 'missed' || call.status === 'declined' || call.status === 'failed';
  const { date, time } = formatCallTime(call.started_at);
  const avatarColor = getAvatarColor(call.remote_name);
  const initials = getInitials(call.remote_name);
  const isOutgoing = call.direction === 'outgoing';

  // Direction label
  let directionLabel: string;
  let directionColor: string;
  if (isMissed) {
    directionLabel = call.status === 'declined' ? 'Call declined' : `Missed ${call.direction === 'incoming' ? 'incoming' : 'outgoing'}`;
    directionColor = '#D13438';
  } else {
    directionLabel = isOutgoing ? 'Outgoing' : 'Incoming';
    directionColor = '#8B8CA7';
  }

  const DirectionIcon = isMissed ? PhoneMissed : isOutgoing ? PhoneOutgoing : PhoneIncoming;
  const iconColor = isMissed ? '#D13438' : '#8B8CA7';

  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        background: isHovered ? '#F5F5FA' : 'transparent',
        transition: 'background 0.1s',
        cursor: 'default',
        borderBottom: '1px solid #F8F8F8',
      }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          width: 40, height: 40, borderRadius: '50%', background: avatarColor,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 600,
        }}>
          {initials}
        </div>
        {/* Call type badge */}
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 16, height: 16, borderRadius: '50%',
          background: isMissed ? '#D13438' : '#6BB700',
          border: '2px solid #fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {call.call_type === 'video'
            ? <Video size={8} color="#fff" />
            : <Phone size={8} color="#fff" />
          }
        </div>
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 13, fontWeight: 600, margin: 0,
          color: isMissed ? '#D13438' : '#242424',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {call.remote_name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
          <DirectionIcon size={12} color={iconColor} />
          <span style={{ fontSize: 11, color: directionColor, fontWeight: isMissed ? 500 : 400 }}>
            {directionLabel}
          </span>
        </div>
      </div>

      {/* Right side: timestamp or hover actions */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
        {isHovered && call.remote_user_id ? (
          /* Hover: Show Call buttons */
          <>
            <HoverActionBtn
              icon={<Phone size={15} />}
              label="Audio call"
              color="#107C10"
              hoverBg="#E8F5E9"
              onClick={() => onCallBack('audio')}
            />
            <HoverActionBtn
              icon={<Video size={15} />}
              label="Video call"
              color="#5B5FC7"
              hoverBg="#E8EBFA"
              onClick={() => onCallBack('video')}
            />
          </>
        ) : (
          /* Normal: Show date + duration */
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 12, color: '#8B8CA7', margin: 0, whiteSpace: 'nowrap' }}>
              {date}
            </p>
            {call.duration_seconds > 0 ? (
              <p style={{ fontSize: 11, color: '#B0B0B0', margin: '2px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3 }}>
                <Clock size={10} /> {formatDuration(call.duration_seconds)}
              </p>
            ) : (
              <p style={{ fontSize: 11, color: '#B0B0B0', margin: '2px 0 0' }}>{time}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================================================================
   HOVER ACTION BUTTON
   =================================================================== */
function HoverActionBtn({ icon, label, color, hoverBg, onClick }: {
  icon: React.ReactNode; label: string; color: string; hoverBg: string; onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        width: 32, height: 32, borderRadius: 6, border: 'none',
        background: hovered ? hoverBg : 'transparent',
        color, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.1s',
      }}
    >
      {icon}
    </button>
  );
}

/* ===================================================================
   REFRESH BUTTON
   =================================================================== */
function RefreshButton({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title="Refresh"
      style={{
        width: 32, height: 32, borderRadius: 6, border: 'none',
        background: hovered ? '#F0F0F0' : 'transparent',
        color: '#8B8CA7', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.12s',
      }}
    >
      <RefreshCw size={15} />
    </button>
  );
}
