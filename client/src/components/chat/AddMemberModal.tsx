import { useState, useEffect } from 'react';
import { X, Search, Loader2, Check, UserPlus } from 'lucide-react';
import api from '@/services/api';
import type { User, Conversation } from '@/types';

interface Props {
  conversation: Conversation;
  onClose: () => void;
  onMembersAdded: (members: any[], memberCount: number) => void;
}

export default function AddMemberModal({ conversation, onClose, onMembersAdded }: Props) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [hoveredUserId, setHoveredUserId] = useState<string | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoverAdd, setHoverAdd] = useState(false);

  // Existing member IDs to filter out
  const existingMemberIds = new Set(
    (conversation.members || []).map((m) => m.user_id)
  );

  // Fetch users with debounce
  useEffect(() => {
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const { data } = await api.get('/users', {
          params: { search: search || undefined, limit: 30 },
        });
        const allUsers: User[] = data.users || data || [];
        // Filter out users already in the group
        setUsers(allUsers.filter((u) => !existingMemberIds.has(u.id)));
      } catch (err) {
        console.error('Failed to fetch users:', err);
      }
      setIsLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const toggleUser = (user: User) => {
    setSelectedUsers((prev) =>
      prev.some((u) => u.id === user.id)
        ? prev.filter((u) => u.id !== user.id)
        : [...prev, user]
    );
  };

  const handleAddMembers = async () => {
    if (selectedUsers.length === 0) return;
    setIsAdding(true);
    setError('');
    try {
      const { data } = await api.post(`/conversations/${conversation.id}/members`, {
        memberIds: selectedUsers.map((u) => u.id),
      });
      onMembersAdded(data.members, data.memberCount);
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add members');
    }
    setIsAdding(false);
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

  const canAdd = selectedUsers.length > 0 && !isAdding;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.45)',
        backdropFilter: 'blur(4px)',
        padding: 16,
      }}
    >
      <div
        style={{
          width: '100%', maxWidth: 420,
          background: '#FFFFFF',
          borderRadius: 16,
          boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '80vh',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} style={{ color: '#6264A7' }} />
            <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>
              Add Members
            </h2>
          </div>
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

        {/* Group info */}
        <div style={{ padding: '10px 20px', background: '#F8F8FC', borderBottom: '1px solid #E8E8F0', flexShrink: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: '#8B8CA7' }}>
            Adding to <strong style={{ color: '#1A1A2E' }}>{conversation.name}</strong>
            {' '}&middot; {conversation.member_count || conversation.members?.length || 0} current members
          </p>
        </div>

        {/* Selected users chips */}
        {selectedUsers.length > 0 && (
          <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {selectedUsers.map((u) => (
                <span
                  key={u.id}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: '#EDEDFA', color: '#6264A7',
                    borderRadius: 20, padding: '3px 10px',
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
        <div style={{ padding: '8px 8px', maxHeight: 260, overflowY: 'auto', flex: 1 }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <Loader2 size={20} style={{ color: '#6264A7', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : users.length === 0 ? (
            <p style={{ textAlign: 'center', fontSize: 13, color: '#8B8CA7', padding: '32px 0', margin: 0 }}>
              {search ? 'No users found' : 'All users are already members'}
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
                  disabled={isAdding}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: 'none',
                    background: selected ? '#F0F0FA' : isHovered ? '#F8F8FC' : 'transparent',
                    cursor: isAdding ? 'not-allowed' : 'pointer',
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
                    {u.display_name?.[0]?.toUpperCase() || u.username?.[0]?.toUpperCase() || '?'}
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
                      {u.department || u.email || u.username}
                    </p>
                  </div>
                  {selected && (
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

        {/* Error */}
        {error && (
          <div style={{ padding: '0 20px 8px', flexShrink: 0 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#D13438' }}>{error}</p>
          </div>
        )}

        {/* Add Button */}
        <div style={{ padding: '8px 20px 16px', borderTop: '1px solid #E8E8F0', flexShrink: 0 }}>
          <button
            onClick={handleAddMembers}
            disabled={!canAdd}
            onMouseEnter={() => setHoverAdd(true)}
            onMouseLeave={() => setHoverAdd(false)}
            style={{
              width: '100%',
              padding: '11px 24px',
              fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
              color: '#fff',
              background: !canAdd ? '#C4C5DB' : hoverAdd ? '#4F51A0' : 'linear-gradient(135deg, #6264A7, #5558B2)',
              border: 'none', borderRadius: 10,
              cursor: canAdd ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              transition: 'all 0.2s',
              boxShadow: canAdd ? '0 4px 14px rgba(98,100,167,0.3)' : 'none',
            }}
          >
            {isAdding ? (
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
            ) : (
              <>
                <UserPlus size={15} />
                {selectedUsers.length > 0
                  ? `Add ${selectedUsers.length} member${selectedUsers.length > 1 ? 's' : ''}`
                  : 'Select users to add'}
              </>
            )}
          </button>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
