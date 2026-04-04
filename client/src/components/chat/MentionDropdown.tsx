import { useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import type { ConversationMember } from '@/types';

interface Props {
  members: ConversationMember[];
  query: string;
  selectedIndex: number;
  onSelect: (member: ConversationMember | 'everyone') => void;
  onClose: () => void;
}

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

const STATUS_COLORS: Record<string, string> = {
  online: '#16A34A',
  away: '#D97706',
  busy: '#DC2626',
  dnd: '#DC2626',
  offline: '#C0C1D4',
};

export default function MentionDropdown({ members, query, selectedIndex, onSelect, onClose }: Props) {
  const listRef = useRef<HTMLDivElement>(null);
  const q = query.toLowerCase();

  // Filter members by query
  const filtered = members.filter((m) => {
    if (!q) return true;
    return (
      m.display_name.toLowerCase().includes(q) ||
      m.username.toLowerCase().includes(q)
    );
  });

  // Check if @everyone matches
  const showEveryone = !q || 'everyone'.startsWith(q);

  // Build combined list: filtered members + @everyone
  const totalCount = filtered.length + (showEveryone ? 1 : 0);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.children;
    if (items[selectedIndex]) {
      (items[selectedIndex] as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (totalCount === 0) return null;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 10,
        border: '1px solid #E1DFDD',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        maxHeight: 260,
        overflowY: 'auto',
        minWidth: 260,
        maxWidth: 320,
        zIndex: 100,
      }}
      ref={listRef}
    >
      {/* Header */}
      <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 600, color: '#8B8CA7', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        Members
      </div>

      {/* Member rows */}
      {filtered.map((member, idx) => {
        const isSelected = idx === selectedIndex;
        const initial = (member.display_name || member.username)?.[0]?.toUpperCase() || '?';
        const color = getAvatarColor(member.display_name || member.username);
        const statusColor = STATUS_COLORS[member.status || 'offline'] || STATUS_COLORS.offline;

        return (
          <div
            key={member.user_id}
            onClick={() => onSelect(member)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              background: isSelected ? '#F0F0FA' : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = '#F8F8FC'; }}
            onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
          >
            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: color, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 600,
                }}
              >
                {initial}
              </div>
              {/* Status dot */}
              <div
                style={{
                  position: 'absolute', bottom: 0, right: 0,
                  width: 8, height: 8, borderRadius: '50%',
                  background: statusColor, border: '2px solid #fff',
                }}
              />
            </div>
            {/* Name + username */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member.display_name}
              </div>
              <div style={{ fontSize: 11, color: '#8B8CA7' }}>
                @{member.username}
              </div>
            </div>
          </div>
        );
      })}

      {/* @everyone option */}
      {showEveryone && (
        <>
          <div style={{ height: 1, background: '#F0F0F5', margin: '2px 0' }} />
          <div
            onClick={() => onSelect('everyone')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 12px',
              cursor: 'pointer',
              background: selectedIndex === filtered.length ? '#F0F0FA' : 'transparent',
              transition: 'background 0.1s',
            }}
            onMouseEnter={(e) => { if (selectedIndex !== filtered.length) e.currentTarget.style.background = '#F8F8FC'; }}
            onMouseLeave={(e) => { if (selectedIndex !== filtered.length) e.currentTarget.style.background = 'transparent'; }}
          >
            <div
              style={{
                width: 32, height: 32, borderRadius: '50%',
                background: '#6264A7', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Users size={15} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>@everyone</div>
              <div style={{ fontSize: 11, color: '#8B8CA7' }}>Notify all members</div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Returns the total count of visible items for keyboard navigation */
export function getMentionFilteredCount(members: ConversationMember[], query: string): number {
  const q = query.toLowerCase();
  const filtered = members.filter((m) =>
    !q || m.display_name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
  );
  const showEveryone = !q || 'everyone'.startsWith(q);
  return filtered.length + (showEveryone ? 1 : 0);
}

/** Returns the item at the given index (member or 'everyone') */
export function getMentionItemAtIndex(members: ConversationMember[], query: string, index: number): ConversationMember | 'everyone' | null {
  const q = query.toLowerCase();
  const filtered = members.filter((m) =>
    !q || m.display_name.toLowerCase().includes(q) || m.username.toLowerCase().includes(q)
  );
  if (index < filtered.length) return filtered[index];
  const showEveryone = !q || 'everyone'.startsWith(q);
  if (showEveryone && index === filtered.length) return 'everyone';
  return null;
}
