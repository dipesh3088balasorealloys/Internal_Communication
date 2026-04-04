import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, MessageSquare, Phone, Loader2, Search } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useUIStore } from '@/stores/uiStore';
import { useChatStore } from '@/stores/chatStore';
import api from '@/services/api';
import type { User } from '@/types';

interface ContactsListProps {
  searchQuery: string;
}

const STATUS_COLORS: Record<string, string> = {
  online: '#6BB700',
  away: '#FFAA44',
  busy: '#D13438',
  dnd: '#D13438',
  offline: '#A0A0A0',
};

const STATUS_LABELS: Record<string, string> = {
  online: 'Online',
  away: 'Away',
  busy: 'Busy',
  dnd: 'Do Not Disturb',
  offline: 'Offline',
};

export default function ContactsList({ searchQuery }: ContactsListProps) {
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const { setSidebarTab } = useUIStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/users', { params: { limit: 200 } });
        setUsers(data.users || []);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();

    // Refresh every 30s for presence updates
    const interval = setInterval(fetchUsers, 30000);
    return () => clearInterval(interval);
  }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return users.filter((u) => u.id !== currentUser?.id);
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.id !== currentUser?.id &&
        (u.display_name?.toLowerCase().includes(q) ||
          u.username?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q) ||
          u.designation?.toLowerCase().includes(q))
    );
  }, [users, searchQuery, currentUser?.id]);

  // Group by department
  const grouped = useMemo(() => {
    const groups: Record<string, User[]> = {};
    const onlineFirst = [...filtered].sort((a, b) => {
      if (a.status === 'online' && b.status !== 'online') return -1;
      if (a.status !== 'online' && b.status === 'online') return 1;
      return (a.display_name || a.username).localeCompare(b.display_name || b.username);
    });

    for (const u of onlineFirst) {
      const dept = u.department || 'Other';
      if (!groups[dept]) groups[dept] = [];
      groups[dept].push(u);
    }
    return groups;
  }, [filtered]);

  const handleStartDM = async (userId: string) => {
    try {
      const { data } = await api.post('/conversations', {
        type: 'direct',
        memberIds: [userId],
      });
      // Add to chat store so it appears in the list immediately
      if (!data.existing) {
        // New conversation — fetch full details and add to store
        try {
          const { data: fullConv } = await api.get(`/conversations/${data.id}`);
          useChatStore.getState().addConversation(fullConv);
        } catch {
          useChatStore.getState().fetchConversations();
        }
      }
      // Switch sidebar to chat tab and navigate to the conversation
      setSidebarTab('chat');
      navigate(`/chat/${data.id}`);
    } catch (err) {
      console.error('Failed to create DM:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
        <Loader2 size={28} style={{ color: '#6264A7', animation: 'spin 1s linear infinite' }} />
        <p style={{ fontSize: 13, color: '#8B8CA7', margin: 0 }}>Loading contacts...</p>
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 24px' }}>
        <div style={{ width: 56, height: 56, borderRadius: 14, background: '#F0F0FA', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
          {searchQuery ? <Search size={24} style={{ color: '#8B8CA7' }} /> : <Users size={24} style={{ color: '#6264A7' }} />}
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#242424', margin: '0 0 4px 0' }}>
          {searchQuery ? 'No contacts found' : 'No contacts yet'}
        </p>
        <p style={{ fontSize: 12, color: '#A0A0A0', textAlign: 'center', margin: 0 }}>
          {searchQuery ? `No users match "${searchQuery}"` : 'Organization contacts will appear here'}
        </p>
      </div>
    );
  }

  const onlineCount = filtered.filter((u) => u.status === 'online').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Summary bar */}
      <div
        style={{
          padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: '1px solid #F0F0F0',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: '#8B8CA7' }}>
          {filtered.length} contact{filtered.length !== 1 ? 's' : ''}
        </span>
        <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#D0D0D8', flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: '#6BB700', fontWeight: 500 }}>
          {onlineCount} online
        </span>
      </div>

      {/* Contact list */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {Object.entries(grouped).map(([dept, deptUsers]) => (
          <div key={dept}>
            {/* Department header */}
            <div
              style={{
                padding: '10px 16px 6px',
                fontSize: 11,
                fontWeight: 700,
                color: '#8B8CA7',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                position: 'sticky',
                top: 0,
                background: '#FFFFFF',
                zIndex: 1,
              }}
            >
              {dept} ({deptUsers.length})
            </div>

            {deptUsers.map((contact) => {
              const isHovered = hoveredId === contact.id;
              return (
                <div
                  key={contact.id}
                  onMouseEnter={() => setHoveredId(contact.id)}
                  onMouseLeave={() => { setHoveredId(null); setHoveredAction(null); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 16px',
                    background: isHovered ? '#F8F8FC' : 'transparent',
                    cursor: 'pointer',
                    transition: 'background 0.12s',
                  }}
                  onClick={() => handleStartDM(contact.id)}
                >
                  {/* Avatar */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div
                      style={{
                        width: 40, height: 40, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6264A7, #5B5FC7)',
                        color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 15, fontWeight: 600,
                      }}
                    >
                      {contact.display_name?.[0]?.toUpperCase() || contact.username[0]?.toUpperCase()}
                    </div>
                    <div
                      style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 12, height: 12, borderRadius: '50%',
                        background: STATUS_COLORS[contact.status] || '#A0A0A0',
                        border: '2px solid #FFFFFF',
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p
                        style={{
                          fontSize: 13, fontWeight: 600, color: '#1A1A2E', margin: 0,
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {contact.display_name || contact.username}
                      </p>
                      {contact.role === 'admin' && (
                        <span
                          style={{
                            fontSize: 9, fontWeight: 700, color: '#6264A7',
                            background: '#EDEDFA', padding: '1px 6px', borderRadius: 4,
                            textTransform: 'uppercase', letterSpacing: '0.3px',
                          }}
                        >
                          Admin
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 11, color: '#8B8CA7', margin: '1px 0 0 0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                    >
                      {contact.designation || contact.department || STATUS_LABELS[contact.status] || 'Offline'}
                      {contact.status_message ? ` · ${contact.status_message}` : ''}
                    </p>
                  </div>

                  {/* Action buttons (visible on hover) */}
                  {isHovered && (
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartDM(contact.id); }}
                        onMouseEnter={() => setHoveredAction(`msg-${contact.id}`)}
                        onMouseLeave={() => setHoveredAction(null)}
                        title="Send message"
                        style={{
                          width: 30, height: 30, borderRadius: 6,
                          border: 'none',
                          background: hoveredAction === `msg-${contact.id}` ? '#EDEDFA' : 'transparent',
                          color: '#6264A7', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.12s',
                        }}
                      >
                        <MessageSquare size={15} />
                      </button>
                      <button
                        onMouseEnter={() => setHoveredAction(`call-${contact.id}`)}
                        onMouseLeave={() => setHoveredAction(null)}
                        title="Audio call"
                        style={{
                          width: 30, height: 30, borderRadius: 6,
                          border: 'none',
                          background: hoveredAction === `call-${contact.id}` ? '#E8F5E9' : 'transparent',
                          color: '#6BB700', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          transition: 'background 0.12s',
                        }}
                      >
                        <Phone size={15} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
