import { useEffect, useRef } from 'react';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import { Loader2 } from 'lucide-react';
import type { Message } from '@/types';
import MessageBubble from './MessageBubble';

interface Props {
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  currentUserId?: string;
  onReply?: (message: Message) => void;
}

export default function MessageList({ messages, isLoading, hasMore, onLoadMore, currentUserId, onReply }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevLengthRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg?.sender_id === currentUserId || isNearBottom(containerRef.current)) {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, currentUserId]);

  // Scroll to bottom on first load
  useEffect(() => {
    if (messages.length > 0 && prevLengthRef.current === 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, [messages]);

  // Infinite scroll — load more when scrolling to top
  const handleScroll = () => {
    if (!containerRef.current || isLoading || !hasMore) return;
    if (containerRef.current.scrollTop < 100) {
      onLoadMore();
    }
  };

  return (
    <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
      {/* BAL Logo Watermark — fixed behind messages */}
      <img
        src="/BAL_logo.png"
        alt=""
        draggable={false}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 250, height: 'auto',
          opacity: 0.30,
          pointerEvents: 'none', userSelect: 'none',
          zIndex: 0,
        }}
      />

      {/* Scrollable messages container */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          position: 'absolute', inset: 0,
          overflowY: 'auto', overflowX: 'hidden',
          paddingTop: 8, paddingBottom: 8,
          zIndex: 1,
        }}
      >
      {/* Load More Indicator */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0' }}>
          <Loader2 size={20} style={{ color: '#6264A7', animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {hasMore && !isLoading && (
        <button
          onClick={onLoadMore}
          style={{
            width: '100%',
            textAlign: 'center',
            padding: '8px 0',
            fontSize: 12,
            color: '#6264A7',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Load older messages
        </button>
      )}

      {/* Messages */}
      {messages.map((msg, idx) => {
        const prev = idx > 0 ? messages[idx - 1] : null;
        const showDateSep = !prev || !isSameDay(new Date(msg.created_at), new Date(prev.created_at));
        const showAvatar = !prev || prev.sender_id !== msg.sender_id || showDateSep;

        return (
          <div key={msg.id}>
            {showDateSep && <DateSeparator date={new Date(msg.created_at)} />}
            <MessageBubble
              message={msg}
              isOwn={msg.sender_id === currentUserId}
              showAvatar={showAvatar}
              onReply={onReply}
            />
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
    </div>
  );
}

function DateSeparator({ date }: { date: Date }) {
  let label: string;
  if (isToday(date)) label = 'Today';
  else if (isYesterday(date)) label = 'Yesterday';
  else label = format(date, 'EEEE, MMMM d, yyyy');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 20px', userSelect: 'none' }}>
      <div style={{ flex: 1, height: 1, background: '#EDEBE9' }} />
      <span style={{ fontSize: 12, color: '#A19F9D', fontWeight: 500, padding: '0 4px' }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: '#EDEBE9' }} />
    </div>
  );
}

function isNearBottom(el: HTMLElement | null): boolean {
  if (!el) return true;
  return el.scrollHeight - el.scrollTop - el.clientHeight < 150;
}
