import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Users } from 'lucide-react';
import { useChatStore } from '@/stores/chatStore';
import { useAuthStore } from '@/stores/authStore';
import type { Conversation } from '@/types';

// Color palette for avatars
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

interface Props {
  searchQuery: string;
}

export default function ConversationList({ searchQuery }: Props) {
  const { conversations, isLoadingConversations } = useChatStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { conversationId: activeId } = useParams();

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter((c) => {
      const name = getConversationName(c, user?.id);
      return name.toLowerCase().includes(q);
    });
  }, [conversations, searchQuery, user?.id]);

  if (isLoadingConversations) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #E0E1F5', borderTopColor: '#6264A7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            margin: '0 auto 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#F0F0FA',
          }}
        >
          <Users size={24} color="#6264A7" />
        </div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#242424', margin: '0 0 4px' }}>
          {searchQuery ? 'No results found' : 'No conversations yet'}
        </p>
        <p style={{ fontSize: 12, color: '#A19F9D', margin: 0 }}>
          {searchQuery ? 'Try a different search term' : 'Click + to start a new chat'}
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {filtered.map((conv) => (
        <ConversationItem
          key={conv.id}
          conversation={conv}
          isActive={conv.id === activeId}
          currentUserId={user?.id}
          onClick={() => navigate(`/chat/${conv.id}`)}
        />
      ))}
    </div>
  );
}

function ConversationItem({
  conversation: conv,
  isActive,
  currentUserId,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  currentUserId?: string;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const name = getConversationName(conv, currentUserId);
  const avatar = conv.type === 'direct' ? conv.other_user?.avatar_url : conv.avatar_url;
  const initial = name[0]?.toUpperCase() || '?';
  const avatarColor = conv.type === 'group' ? '#0078D4' : getAvatarColor(name);

  // last_message comes from API as an object { id, content, type, sender_id, created_at, sender_name }
  const lastMsgRaw = conv.last_message as any;
  const lastMsgText = typeof lastMsgRaw === 'object' && lastMsgRaw !== null
    ? lastMsgRaw.content || ''
    : (lastMsgRaw ?? '');
  const lastMsgSender = typeof lastMsgRaw === 'object' && lastMsgRaw !== null
    ? lastMsgRaw.sender_name
    : conv.last_message_sender;

  const unread = Number(conv.unread_count) || 0;
  const isOnline = conv.type === 'direct' && conv.other_user?.status === 'online';

  const timeStr = conv.last_message_at
    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })
    : '';

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        textAlign: 'left' as const,
        border: 'none',
        borderLeft: `3px solid ${isActive ? '#6264A7' : 'transparent'}`,
        background: isActive ? '#F0F0FA' : isHovered ? '#F5F5F5' : 'transparent',
        cursor: 'pointer',
        transition: 'background 0.1s ease',
        position: 'relative' as const,
      }}
    >
      {/* Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        {avatar ? (
          <img
            src={avatar}
            alt={name}
            style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 15,
              fontWeight: 600,
              background: avatarColor,
            }}
          >
            {conv.type === 'group' ? <Users size={20} /> : initial}
          </div>
        )}
        {isOnline && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              right: 0,
              width: 13,
              height: 13,
              borderRadius: '50%',
              background: '#6BB700',
              border: '2px solid #fff',
            }}
          />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {/* Name + Time row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <span
            style={{
              fontSize: 14,
              fontWeight: unread > 0 ? 600 : 500,
              color: '#242424',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
            }}
          >
            {name}
          </span>
          {timeStr && (
            <span style={{ fontSize: 11, color: '#A19F9D', marginLeft: 8, flexShrink: 0, whiteSpace: 'nowrap' }}>
              {timeStr}
            </span>
          )}
        </div>

        {/* Last message + Unread badge row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p
            style={{
              fontSize: 12,
              color: unread > 0 ? '#242424' : '#605E5C',
              fontWeight: unread > 0 ? 500 : 400,
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
              minWidth: 0,
              lineHeight: 1.4,
            }}
          >
            {lastMsgSender && conv.type === 'group' && (
              <span style={{ color: '#A19F9D' }}>{lastMsgSender}: </span>
            )}
            {lastMsgText || 'No messages yet'}
          </p>
          {unread > 0 && (
            <span
              style={{
                marginLeft: 8,
                minWidth: 20,
                height: 20,
                padding: '0 6px',
                borderRadius: 10,
                background: '#6264A7',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function getConversationName(conv: Conversation, _currentUserId?: string): string {
  if (conv.type === 'direct' && conv.other_user) {
    return conv.other_user.display_name || conv.other_user.username;
  }
  return conv.name || 'Unnamed Group';
}
