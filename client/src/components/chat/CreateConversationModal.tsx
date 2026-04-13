import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Search, Users, MessageSquare, Loader2, Check } from 'lucide-react';
import api from '@/services/api';
import { useChatStore } from '@/stores/chatStore';
import { useUIStore } from '@/stores/uiStore';
import type { User } from '@/types';

interface Props {
  onClose: () => void;
}

type Mode = 'direct' | 'group';

export default function CreateConversationModal({ onClose }: Props) {
  const navigate = useNavigate();
  const { addConversation } = useChatStore();
  const { setSidebarTab } = useUIStore();
  const [mode, setMode] = useState<Mode>('direct');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [groupNameFocused, setGroupNameFocused] = useState(false);
  const [hoverCreate, setHoverCreate] = useState(false);

  // Fetch users
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get('/users', {
          params: { search: search || undefined, limit: 20 },
        });
        setUsers(data.users || data || []);
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleUser = (user: User) => {
    if (mode === 'direct') {
      handleCreateDirect(user);
      return;
    }
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleCreateDirect = async (user: User) => {
    setIsCreating(true);
    try {
      const { data } = await api.post('/conversations', {
        type: 'direct',
        memberIds: [user.id],
      });
      await useChatStore.getState().fetchConversations();
      setSidebarTab('chat');
      navigate(`/chat/${data.id}`);
      onClose();
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
    setIsCreating(false);
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2 || !groupName.trim()) return;
    setIsCreating(true);
    try {
      const { data } = await api.post('/conversations', {
        type: 'group',
        name: groupName.trim(),
        memberIds: selectedUsers.map((u) => u.id),
      });
      await useChatStore.getState().fetchConversations();
      setSidebarTab('chat');
      navigate(`/chat/${data.id}`);
      onClose();
    } catch (err) {
      console.error('Failed to create group:', err);
    }
    setIsCreating(false);
  };

  const inputBase: React.CSSProperties = {
    width: '100%',
    fontSize: 13,
    color: '#242424',
    border: '2px solid #E8E8F0',
    borderRadius: 10,
    outline: 'none',
    transition: 'all 0.2s',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  };

  const canCreate = mode === 'group' && selectedUsers.length >= 2 && groupName.trim() && !isCreating;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 440,
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '85vh',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #E8E8F0',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: 17, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>New Conversation</h2>
          <button
            onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: 8,
              border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#8B8CA7', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#F0F0F5'; e.currentTarget.style.color = '#1A1A2E'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8B8CA7'; }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #E8E8F0', flexShrink: 0 }}>
          {(['direct', 'group'] as Mode[]).map((m) => {
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => { setMode(m); setSelectedUsers([]); }}
                style={{
                  flex: 1,
                  padding: '12px 0',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#6264A7' : '#8B8CA7',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #6264A7' : '2px solid transparent',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                }}
              >
                {m === 'direct' ? <MessageSquare size={15} /> : <Users size={15} />}
                {m === 'direct' ? 'Direct Message' : 'Group Chat'}
              </button>
            );
          })}
        </div>

        {/* Group Name + Selected */}
        {mode === 'group' && (
          <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onFocus={() => setGroupNameFocused(true)}
              onBlur={() => setGroupNameFocused(false)}
              placeholder="Group name"
              style={{
                ...inputBase,
                padding: '9px 14px',
                background: groupNameFocused ? '#fff' : '#F8F8FC',
                borderColor: groupNameFocused ? '#6264A7' : '#E8E8F0',
                boxShadow: groupNameFocused ? '0 0 0 3px rgba(98,100,167,0.1)' : 'none',
              }}
            />
            {selectedUsers.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {selectedUsers.map((u) => (
                  <span
                    key={u.id}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: '#EDEDFA', color: '#6264A7',
                      borderRadius: 20, padding: '3px 10px 3px 10px',
                      fontSize: 12, fontWeight: 500,
                    }}
                  >
                    {u.display_name || u.username}
                    <button
                      onClick={() => toggleUser(u)}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#8B8CA7', padding: 0, display: 'flex',
                        transition: 'color 0.1s',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#D13438'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = '#8B8CA7'; }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search */}
        <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={15}
              style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#A0A1BC' }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search users..."
              autoFocus
              style={{
                ...inputBase,
                padding: '9px 14px 9px 36px',
                background: searchFocused ? '#fff' : '#F8F8FC',
                borderColor: searchFocused ? '#6264A7' : '#E8E8F0',
                boxShadow: searchFocused ? '0 0 0 3px rgba(98,100,167,0.1)' : 'none',
              }}
            />
          </div>
        </div>

        {/* User List */}
        <div style={{ padding: '8px 8px', maxHeight: 280, overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <Loader2 size={20} style={{ color: '#6264A7', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : users.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#8B8CA7', padding: '32px 0', margin: 0 }}>
              No users found
            </p>
          ) : (
            users.map((u) => {
              const selected = selectedUsers.some((s) => s.id === u.id);
              const isHovered = hoveredUserId === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => toggleUser(u)}
                  onMouseEnter={() => setHoveredUserId(u.id)}
                  onMouseLeave={() => setHoveredUserId(null)}
                  disabled={isCreating}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: isHovered ? '#F8F8FC' : 'transparent',
                    cursor: isCreating ? 'not-allowed' : 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.12s',
                    fontFamily: 'inherit',
                  }}
                >
                  <div
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'linear-gradient(135deg, #6264A7, #5B5FC7)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, fontWeight: 600, flexShrink: 0,
                    }}
                  >
                    {u.display_name?.[0]?.toUpperCase() || u.username[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 13, fontWeight: 500, color: '#1A1A2E', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {u.display_name || u.username}
                    </p>
                    <p style={{
                      fontSize: 11, color: '#8B8CA7', margin: '1px 0 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {u.department || u.email}
                    </p>
                  </div>
                  {mode === 'group' && selected && (
                    <div
                      style={{
                        width: 20, height: 20, borderRadius: '50%',
                        background: '#6264A7',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Check size={12} color="#fff" />
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Group Create Button */}
        {mode === 'group' && (
          <div style={{ padding: '8px 20px 16px', borderTop: '1px solid #E8E8F0', flexShrink: 0 }}>
            <button
              onClick={handleCreateGroup}
              disabled={!canCreate}
              onMouseEnter={() => setHoverCreate(true)}
              onMouseLeave={() => setHoverCreate(false)}
              style={{
                width: '100%',
                padding: '11px 24px',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                color: '#fff',
                background: !canCreate ? '#C4C5DB' : hoverCreate ? '#4F51A0' : 'linear-gradient(135deg, #6264A7, #5558B2)',
                border: 'none', borderRadius: 10,
                cursor: canCreate ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s',
                boxShadow: canCreate ? '0 4px 14px rgba(98,100,167,0.3)' : 'none',
              }}
            >
              {isCreating ? (
                <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              ) : (
                `Create Group (${selectedUsers.length} members)`
              )}
            </button>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
