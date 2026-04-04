import React, { useState, useRef, useEffect } from 'react';
import {
  Mail, Send, Paperclip, Bold, Italic, Underline, Link2, Image,
  Reply, ReplyAll, Forward, Trash2, Archive, Star, StarOff,
  ChevronDown, Plus, Inbox, SendHorizontal, FileText, Users,
  Search, MoreVertical, X, RefreshCw, Loader,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import { playMessageSound, showDesktopNotification } from '@/services/notification';

/* ===================================================================
   FOLDER DEFINITIONS — counts are fetched dynamically from API
   =================================================================== */


/* ===================================================================
   HELPER FUNCTIONS
   =================================================================== */
function formatEmailDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 24 * 3600000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
  if (diff < 48 * 3600000) return 'Yesterday';
  if (diff < 7 * 24 * 3600000) return d.toLocaleDateString('en', { weekday: 'short' });
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

const AVATAR_COLORS = ['#0078D4', '#107C10', '#D83B01', '#5C2D91', '#008272', '#B4009E', '#E81123', '#00188F'];
function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/* ===================================================================
   MAIN EMAIL WINDOW
   =================================================================== */
export default function EmailWindow() {
  const { user } = useAuthStore();
  const [activeFolder, setActiveFolder] = useState('sent');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [editingDraft, setEditingDraft] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [forwardEmail, setForwardEmail] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [emails, setEmails] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [folderCounts, setFolderCounts] = useState<Record<string, number>>({ sent: 0, draft: 0, deleted: 0 });
  const prevInboxCountRef = useRef<number>(0);
  const isRefreshing = useRef(false);

  // Persist read email IDs in localStorage so they survive refresh
  const getReadIds = (): Set<string> => {
    try {
      const stored = localStorage.getItem('bal_read_emails');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  };
  const readEmailIds = useRef<Set<string>>(getReadIds());
  const markAsRead = (id: string) => {
    readEmailIds.current.add(id);
    try {
      localStorage.setItem('bal_read_emails', JSON.stringify([...readEmailIds.current]));
    } catch { /* ignore */ }
  };

  // Fetch folder counts
  const loadCounts = async () => {
    try {
      const { data } = await api.get('/email/counts');
      setFolderCounts(data);
    } catch { /* ignore */ }
  };

  // Fetch emails for active folder
  const loadEmails = async (folder?: string) => {
    const f = folder || activeFolder;
    const isSilentRefresh = isRefreshing.current;
    if (!isSilentRefresh) setLoading(true);
    try {
      let endpoint = '/email/sent';
      if (f === 'drafts') endpoint = '/email/drafts';
      else if (f === 'deleted') endpoint = '/email/deleted';
      else if (f === 'inbox') endpoint = '/email/inbox';

      const { data } = await api.get(endpoint);
      // Normalize DB rows to email display format
      const normalized = (data.emails || []).map((e: any) => ({
        id: e.id || e.uid?.toString(),
        from: e.from || user?.display_name || 'You',
        fromEmail: e.fromEmail || 'it.helpdesk@balasorealloys.com',
        to: typeof e.to_addresses === 'string' ? JSON.parse(e.to_addresses) : (e.to_addresses || e.to || []),
        cc: typeof e.cc_addresses === 'string' ? JSON.parse(e.cc_addresses) : (e.cc_addresses || e.cc || []),
        subject: e.subject || '(No subject)',
        preview: e.text_body?.substring(0, 120) || e.preview || '',
        body: e.html_body || e.body || e.text_body || '',
        date: e.created_at || e.date || new Date().toISOString(),
        // For inbox: use local read tracking (persisted in localStorage)
        // For sent/drafts/deleted: always mark as read
        isRead: f === 'inbox'
          ? readEmailIds.current.has((e.id || e.uid)?.toString() || '')
          : true,
        isStarred: e.isStarred || false,
        attachments: e.attachments || [],
        status: e.status,
        folder: f,
      }));

      // Detect new inbox emails and play notification sound
      if (f === 'inbox' && normalized.length > prevInboxCountRef.current && prevInboxCountRef.current > 0) {
        const newCount = normalized.length - prevInboxCountRef.current;
        playMessageSound();
        showDesktopNotification({
          title: 'New Email',
          body: newCount === 1
            ? `From: ${normalized[0]?.from} — ${normalized[0]?.subject}`
            : `You have ${newCount} new emails`,
          tag: 'email-new',
        });
      }
      if (f === 'inbox') prevInboxCountRef.current = normalized.length;

      setEmails(normalized);
    } catch (err: any) {
      if (f === 'inbox') {
        if (!isSilentRefresh) setEmails([]);
      } else {
        console.error('Failed to load emails:', err.message);
      }
    } finally {
      if (!isSilentRefresh) setLoading(false);
    }
  };

  useEffect(() => { loadEmails(); loadCounts(); }, [activeFolder]);

  // Auto-refresh inbox every 30 seconds silently (no loading spinner, no blink)
  useEffect(() => {
    if (activeFolder !== 'inbox') return;
    const interval = setInterval(() => {
      isRefreshing.current = true;
      loadEmails('inbox').finally(() => { isRefreshing.current = false; });
    }, 30000);
    return () => clearInterval(interval);
  }, [activeFolder]);

  const filteredEmails = searchQuery
    ? emails.filter(e => e.subject.toLowerCase().includes(searchQuery.toLowerCase()) || e.from?.toLowerCase().includes(searchQuery.toLowerCase()))
    : emails;

  const selectedEmail = emails.find(e => e.id === selectedEmailId) || null;

  const folders = [
    { id: 'inbox', name: 'Inbox', icon: 'inbox', count: 0 },
    { id: 'sent', name: 'Sent Items', icon: 'send', count: 0 },
    { id: 'drafts', name: 'Drafts', icon: 'file', count: folderCounts.draft || 0 },
    { id: 'deleted', name: 'Deleted Items', icon: 'trash', count: 0 },
  ];

  const handleSelectEmail = (id: string) => {
    setSelectedEmailId(id);
    setComposing(false);
    setReplyTo(null);
    setForwardEmail(null);
    setEditingDraft(null);
    // Mark as read — persisted in localStorage so it survives refresh
    markAsRead(id);
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isRead: true } : e));
  };

  const handleCompose = () => {
    setComposing(true);
    setSelectedEmailId(null);
    setReplyTo(null);
    setForwardEmail(null);
    setEditingDraft(null);
  };

  const handleOpenDraft = (email: any) => {
    setComposing(true);
    setEditingDraft(email);
    setSelectedEmailId(null);
    setReplyTo(null);
    setForwardEmail(null);
  };

  const handleReply = (email: any, all?: boolean) => {
    setComposing(true);
    setReplyTo({ ...email, replyAll: all });
    setSelectedEmailId(null);
  };

  const handleForward = (email: any) => {
    setComposing(true);
    setForwardEmail(email);
    setReplyTo(null);
    setSelectedEmailId(null);
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/email/${id}`);
      setEmails(prev => prev.filter(e => e.id !== id));
      if (selectedEmailId === id) setSelectedEmailId(null);
      loadCounts();
    } catch { /* ignore */ }
  };

  const handleRestore = async (id: string) => {
    try {
      await api.put(`/email/${id}/restore`);
      setEmails(prev => prev.filter(e => e.id !== id));
      loadCounts();
    } catch { /* ignore */ }
  };

  const handleToggleStar = (id: string) => {
    setEmails(prev => prev.map(e => e.id === id ? { ...e, isStarred: !e.isStarred } : e));
  };

  const handleSend = async (data: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; attachments?: File[] }) => {
    try {
      if (data.attachments && data.attachments.length > 0) {
        // Use FormData for attachments
        const formData = new FormData();
        formData.append('to', JSON.stringify(data.to));
        if (data.cc.length > 0) formData.append('cc', JSON.stringify(data.cc));
        if (data.bcc.length > 0) formData.append('bcc', JSON.stringify(data.bcc));
        formData.append('subject', data.subject);
        formData.append('html', data.body);
        if (editingDraft?.id) formData.append('draftId', editingDraft.id);
        data.attachments.forEach(file => formData.append('attachments', file));
        await api.post('/email/send', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/email/send', {
          to: data.to,
          cc: data.cc.length > 0 ? data.cc : undefined,
          bcc: data.bcc.length > 0 ? data.bcc : undefined,
          subject: data.subject,
          html: data.body,
          draftId: editingDraft?.id || undefined,
        });
      }
      setComposing(false);
      setReplyTo(null);
      setForwardEmail(null);
      setEditingDraft(null);
      // Refresh sent items and counts
      if (activeFolder === 'sent') loadEmails('sent');
      loadCounts();
    } catch (err: any) {
      alert('Failed to send email: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleSaveDraft = async (data: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }) => {
    try {
      if (editingDraft?.id) {
        await api.put(`/email/draft/${editingDraft.id}`, { to: data.to, cc: data.cc, bcc: data.bcc, subject: data.subject, html: data.body });
      } else {
        await api.post('/email/draft', { to: data.to, cc: data.cc, bcc: data.bcc, subject: data.subject, html: data.body });
      }
      setComposing(false);
      setEditingDraft(null);
      if (activeFolder === 'drafts') loadEmails('drafts');
      loadCounts();
    } catch (err: any) {
      alert('Failed to save draft: ' + (err.response?.data?.error || err.message));
    }
  };

  // ─── Resizable panel widths ───
  const [folderWidth, setFolderWidth] = useState(220);
  const [listWidth, setListWidth] = useState(360);
  const dragging = useRef<'folder' | 'list' | null>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const handleMouseDown = (panel: 'folder' | 'list', e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = panel;
    startX.current = e.clientX;
    startWidth.current = panel === 'folder' ? folderWidth : listWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (ev: MouseEvent) => {
      const delta = ev.clientX - startX.current;
      if (dragging.current === 'folder') {
        setFolderWidth(Math.max(160, Math.min(350, startWidth.current + delta)));
      } else if (dragging.current === 'list') {
        setListWidth(Math.max(250, Math.min(600, startWidth.current + delta)));
      }
    };

    const handleMouseUp = () => {
      dragging.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const userEmail = user?.email || `${user?.username || 'user'}@balasorealloys.in`;

  return (
    <div style={{ display: 'flex', height: '100%', background: '#F5F5F5' }}>
      {/* ─── Folder Panel (resizable) ─── */}
      <div style={{ width: folderWidth, background: '#FAFAFA', borderRight: 'none', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Compose Button */}
        <div style={{ padding: 16 }}>
          <button
            onClick={handleCompose}
            style={{
              width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
              background: '#0078D4', color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: '0 2px 6px rgba(0,120,212,0.3)', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#106EBE'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#0078D4'; }}
          >
            <Plus size={16} /> New Email
          </button>
        </div>

        {/* Folder List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ padding: '0 8px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, color: '#8B8CA7', textTransform: 'uppercase', letterSpacing: 1, padding: '8px 12px', margin: 0 }}>Folders</p>
            {folders.map(folder => (
              <FolderItem
                key={folder.id}
                folder={folder}
                active={activeFolder === folder.id}
                onClick={() => { setActiveFolder(folder.id); setSelectedEmailId(null); }}
              />
            ))}
          </div>
        </div>

        {/* Account Info */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #E8E8E8', fontSize: 11, color: '#8B8CA7' }}>
          <p style={{ margin: 0, fontWeight: 600, color: '#242424' }}>{user?.display_name}</p>
          <p style={{ margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis' }}>{userEmail}</p>
        </div>
      </div>

      {/* ─── Resize Handle: Folder ↔ List ─── */}
      <div
        onMouseDown={(e) => handleMouseDown('folder', e)}
        style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, position: 'relative', zIndex: 5 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#0078D4'; }}
        onMouseLeave={(e) => { if (!dragging.current) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* ─── Email List Panel (resizable) ─── */}
      <div style={{ width: listWidth, borderRight: 'none', display: 'flex', flexDirection: 'column', background: '#fff', flexShrink: 0 }}>
        {/* Search */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #F0F0F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#F5F5F5', borderRadius: 8 }}>
            <Search size={14} color="#8B8CA7" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search emails..."
              style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13, color: '#242424' }}
            />
          </div>
        </div>

        {/* Focused / Other toggle */}
        <div style={{ display: 'flex', borderBottom: '1px solid #F0F0F0' }}>
          <button style={{ flex: 1, padding: '10px 0', border: 'none', background: 'none', fontSize: 13, fontWeight: 600, color: '#0078D4', borderBottom: '2px solid #0078D4', cursor: 'pointer' }}>Focused</button>
          <button style={{ flex: 1, padding: '10px 0', border: 'none', background: 'none', fontSize: 13, fontWeight: 500, color: '#8B8CA7', cursor: 'pointer' }}>Other</button>
        </div>

        {/* Email Items */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
              <Loader size={20} color="#0078D4" style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#8B8CA7' }}>Loading...</span>
              <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
            </div>
          ) : activeFolder === 'inbox' && filteredEmails.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 24, textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Inbox size={28} color="#0078D4" />
              </div>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#242424', margin: 0 }}>
                Inbox
              </p>
              <p style={{ fontSize: 12, color: '#8B8CA7', margin: 0, lineHeight: 1.6 }}>
                To view received emails, open your mailbox<br/>in Outlook Web App.
              </p>
              <button
                onClick={() => window.open('https://outlook.office.com/mail/', '_blank')}
                style={{
                  marginTop: 4, padding: '9px 24px', borderRadius: 8, border: 'none',
                  background: '#0078D4', color: '#fff', fontSize: 13, fontWeight: 600,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 2px 6px rgba(0,120,212,0.3)',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = '#106EBE'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#0078D4'; }}
              >
                <Mail size={14} /> Open Outlook
              </button>
              <p style={{ fontSize: 10, color: '#B0B0B0', margin: '6px 0 0', lineHeight: 1.5 }}>
                Compose, send, drafts, and sent items work directly in BAL Connect.<br/>
                Inbox reading will be available when OAuth2 is configured by admin.
              </p>
            </div>
          ) : filteredEmails.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8 }}>
              <Mail size={32} color="#D0D0D0" />
              <p style={{ fontSize: 13, color: '#8B8CA7', margin: 0 }}>No emails in this folder</p>
            </div>
          ) : (
            filteredEmails.map(email => (
              <EmailListItem
                key={email.id}
                email={email}
                selected={selectedEmailId === email.id}
                onSelect={() => activeFolder === 'drafts' ? handleOpenDraft(email) : handleSelectEmail(email.id)}
                onStar={() => handleToggleStar(email.id)}
                onDelete={() => activeFolder === 'deleted' ? handleRestore(email.id) : handleDelete(email.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ─── Resize Handle: List ↔ Reader ─── */}
      <div
        onMouseDown={(e) => handleMouseDown('list', e)}
        style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0, position: 'relative', zIndex: 5 }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#0078D4'; }}
        onMouseLeave={(e) => { if (!dragging.current) e.currentTarget.style.background = 'transparent'; }}
      />

      {/* ─── Reader / Compose Panel ─── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0 }}>
        {composing ? (
          <EmailCompose
            userEmail={userEmail}
            userName={user?.display_name || user?.username || ''}
            replyTo={replyTo}
            forwardEmail={forwardEmail}
            editingDraft={editingDraft}
            onSend={handleSend}
            onSaveDraft={handleSaveDraft}
            onDiscard={() => { setComposing(false); setReplyTo(null); setForwardEmail(null); setEditingDraft(null); }}
          />
        ) : selectedEmail ? (
          <EmailReader
            email={selectedEmail}
            onReply={() => handleReply(selectedEmail)}
            onReplyAll={() => handleReply(selectedEmail, true)}
            onForward={() => handleForward(selectedEmail)}
            onDelete={() => handleDelete(selectedEmail.id)}
            onStar={() => handleToggleStar(selectedEmail.id)}
          />
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#C0C0C0' }}>
            <Mail size={48} strokeWidth={1} />
            <p style={{ fontSize: 15, fontWeight: 500, color: '#8B8CA7', margin: 0 }}>Select an email to read</p>
            <p style={{ fontSize: 12, color: '#B0B0B0', margin: 0 }}>Or click "New Email" to compose</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ===================================================================
   FOLDER ITEM
   =================================================================== */
function FolderItem({ folder, active, onClick }: { folder: any; active: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const IconMap: Record<string, any> = { inbox: Inbox, send: SendHorizontal, file: FileText, trash: Trash2, users: Users };
  const Icon = IconMap[folder.icon] || Mail;

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '8px 12px',
        borderRadius: 6, border: 'none', cursor: 'pointer', textAlign: 'left',
        background: active ? '#E8F0FE' : hovered ? '#F0F0F0' : 'transparent',
        color: active ? '#0078D4' : '#424242', fontSize: 13, fontWeight: active ? 600 : 400,
        transition: 'all 0.12s',
      }}
    >
      <Icon size={16} color={active ? '#0078D4' : '#8B8CA7'} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{folder.name}</span>
      {folder.count > 0 && (
        <span style={{ fontSize: 11, fontWeight: 600, color: active ? '#0078D4' : '#8B8CA7', minWidth: 18, textAlign: 'right' }}>{folder.count}</span>
      )}
    </button>
  );
}

/* ===================================================================
   EMAIL LIST ITEM
   =================================================================== */
function EmailListItem({ email, selected, onSelect, onStar, onDelete }: { email: any; selected: boolean; onSelect: () => void; onStar: () => void; onDelete: () => void }) {
  const [hovered, setHovered] = useState(false);
  const color = getAvatarColor(email.from);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', gap: 12, padding: '12px 16px', cursor: 'pointer',
        background: selected ? '#E8F0FE' : hovered ? '#F8F8FC' : 'transparent',
        borderBottom: '1px solid #F5F5F5', borderLeft: selected ? '3px solid #0078D4' : '3px solid transparent',
        transition: 'all 0.12s',
      }}
    >
      {/* Unread dot + Avatar */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
        {!email.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0078D4' }} />}
        <div style={{
          width: 36, height: 36, borderRadius: '50%', background: color,
          color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600, marginTop: email.isRead ? 12 : 0,
        }}>
          {getInitials(email.from)}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
          <span style={{ fontSize: 13, fontWeight: email.isRead ? 400 : 700, color: '#242424', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {email.from}
          </span>
          <span style={{ fontSize: 11, color: '#8B8CA7', flexShrink: 0, marginLeft: 8 }}>
            {formatEmailDate(email.date)}
          </span>
        </div>
        <p style={{ fontSize: 12, fontWeight: email.isRead ? 400 : 600, color: '#424242', margin: '0 0 2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {email.subject}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <p style={{ fontSize: 11, color: '#8B8CA7', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
            {email.preview}
          </p>
          {email.attachments?.length > 0 && <Paperclip size={12} color="#8B8CA7" style={{ flexShrink: 0 }} />}
          {hovered && (
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
              <button onClick={onStar} style={{ width: 24, height: 24, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {email.isStarred ? <Star size={13} fill="#FFB900" color="#FFB900" /> : <Star size={13} color="#8B8CA7" />}
              </button>
              <button onClick={onDelete} style={{ width: 24, height: 24, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Trash2 size={13} color="#D83B01" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   EMAIL READER
   =================================================================== */
function EmailReader({ email, onReply, onReplyAll, onForward, onDelete, onStar }: {
  email: any; onReply: () => void; onReplyAll: () => void; onForward: () => void; onDelete: () => void; onStar: () => void;
}) {
  const color = getAvatarColor(email.from);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Action Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '10px 20px', borderBottom: '1px solid #F0F0F0', flexShrink: 0 }}>
        <ActionBtn icon={<Reply size={16} />} label="Reply" onClick={onReply} />
        <ActionBtn icon={<ReplyAll size={16} />} label="Reply All" onClick={onReplyAll} />
        <ActionBtn icon={<Forward size={16} />} label="Forward" onClick={onForward} />
        <div style={{ width: 1, height: 20, background: '#E0E0E0', margin: '0 8px' }} />
        <ActionBtn icon={<Trash2 size={16} />} label="Delete" onClick={onDelete} color="#D83B01" />
        <ActionBtn icon={<Archive size={16} />} label="Archive" onClick={() => {}} />
        <div style={{ flex: 1 }} />
        <ActionBtn icon={email.isStarred ? <Star size={16} fill="#FFB900" color="#FFB900" /> : <Star size={16} />} label="Star" onClick={onStar} />
      </div>

      {/* Email Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
        {/* Subject */}
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#1A1A2E', margin: '0 0 20px' }}>{email.subject}</h2>

        {/* Sender Row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%', background: color,
            color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 600, flexShrink: 0,
          }}>
            {getInitials(email.from)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#242424' }}>{email.from}</span>
              <span style={{ fontSize: 12, color: '#8B8CA7' }}>&lt;{email.fromEmail}&gt;</span>
            </div>
            <div style={{ fontSize: 12, color: '#8B8CA7', marginTop: 2 }}>
              To: {(email.to || []).join(', ')}
              {email.cc?.length > 0 && <span> | Cc: {email.cc.join(', ')}</span>}
            </div>
          </div>
          <span style={{ fontSize: 12, color: '#8B8CA7', flexShrink: 0 }}>
            {new Date(email.date).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' })}
          </span>
        </div>

        {/* Attachments with download */}
        {email.attachments?.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {email.attachments.map((att: any, i: number) => {
              const handleDownload = async () => {
                try {
                  const url = att.source === 'imap'
                    ? `/email/imap-attachment/${att.uid}/${att.index}`
                    : att.id ? `/email/attachment/${att.id}?name=${encodeURIComponent(att.name)}` : null;
                  if (!url) return;
                  const response = await api.get(url, { responseType: 'blob' });
                  const blob = new Blob([response.data]);
                  const link = document.createElement('a');
                  link.href = URL.createObjectURL(blob);
                  link.download = att.name || 'attachment';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  URL.revokeObjectURL(link.href);
                } catch (err) {
                  console.error('Download failed:', err);
                  alert('Failed to download attachment');
                }
              };
              return (
                <div
                  key={i}
                  onClick={handleDownload}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                    background: '#F5F5F5', borderRadius: 8, border: '1px solid #E8E8E8',
                    cursor: 'pointer', transition: 'background 0.12s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#EBF5FF'; e.currentTarget.style.borderColor = '#0078D4'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = '#F5F5F5'; e.currentTarget.style.borderColor = '#E8E8E8'; }}
                >
                  <Paperclip size={14} color="#0078D4" />
                  <span style={{ fontSize: 12, fontWeight: 500, color: '#0078D4' }}>{att.name}</span>
                  <span style={{ fontSize: 10, color: '#8B8CA7' }}>({formatFileSize(att.size)})</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Body */}
        <div
          style={{ fontSize: 14, lineHeight: 1.7, color: '#333', fontFamily: 'Segoe UI, sans-serif' }}
          dangerouslySetInnerHTML={{ __html: email.body }}
        />
      </div>
    </div>
  );
}

function ActionBtn({ icon, label, onClick, color }: { icon: React.ReactNode; label: string; onClick: () => void; color?: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={label}
      style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
        border: 'none', background: hovered ? '#F0F0F0' : 'transparent', cursor: 'pointer',
        fontSize: 12, fontWeight: 500, color: color || '#424242', transition: 'all 0.12s',
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ===================================================================
   CONTACT AUTOCOMPLETE INPUT — Outlook-style
   =================================================================== */
interface Contact {
  id: string;
  display_name: string;
  email: string;
  department?: string;
  designation?: string;
}

function RecipientField({
  label, chips, inputValue, onInputChange, onAddChip, onRemoveChip, onKeyDown,
  showBccToggle, onToggleBcc, contacts, focusField, onFocusField, fieldKey,
}: {
  label: string;
  chips: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onAddChip: (email: string) => void;
  onRemoveChip: (i: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  showBccToggle?: boolean;
  onToggleBcc?: () => void;
  contacts: Contact[];
  focusField: string | null;
  onFocusField: (key: string | null) => void;
  fieldKey: string;
}) {
  const isOpen = focusField === fieldKey && inputValue.trim().length >= 1;
  const query = inputValue.trim().toLowerCase();
  const suggestions = isOpen
    ? contacts.filter(c =>
        (c.display_name.toLowerCase().includes(query) || c.email.toLowerCase().includes(query)) &&
        !chips.includes(c.email)
      ).slice(0, 8)
    : [];

  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset highlight when suggestions change
  useEffect(() => { setHighlightIdx(-1); }, [suggestions.length, inputValue]);

  const handleSelect = (contact: Contact) => {
    onAddChip(contact.email);
    onInputChange('');
    onFocusField(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx(i => Math.max(i - 1, -1));
        return;
      }
      if (e.key === 'Enter' && highlightIdx >= 0) {
        e.preventDefault();
        handleSelect(suggestions[highlightIdx]);
        return;
      }
      if (e.key === 'Escape') {
        onFocusField(null);
        return;
      }
    }
    onKeyDown(e);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', padding: '6px 20px',
        borderBottom: '1px solid #F0F0F0', fontSize: 13, flexWrap: 'wrap', gap: 4,
        minHeight: 38,
      }}>
        <span style={{ width: 50, color: '#8B8CA7', fontWeight: 500, flexShrink: 0 }}>{label}:</span>
        {chips.map((email, i) => (
          <EmailChip key={i} email={email} onRemove={() => onRemoveChip(i)} />
        ))}
        <input
          ref={inputRef}
          value={inputValue}
          onChange={e => { onInputChange(e.target.value); onFocusField(fieldKey); }}
          onKeyDown={handleKeyDownInternal}
          onFocus={() => onFocusField(fieldKey)}
          onBlur={() => {
            // Delay so click on suggestion fires first
            setTimeout(() => {
              if (inputValue.trim().includes('@')) {
                onAddChip(inputValue.trim());
              }
              onInputChange('');
              onFocusField(null);
            }, 180);
          }}
          placeholder={chips.length === 0 ? `Add ${label.toLowerCase()} recipients...` : ''}
          style={{ border: 'none', outline: 'none', flex: 1, minWidth: 120, fontSize: 13, padding: '4px 0' }}
          autoComplete="off"
        />
        {showBccToggle && onToggleBcc && (
          <button onClick={onToggleBcc} style={{ border: 'none', background: 'none', color: '#0078D4', fontSize: 12, cursor: 'pointer', padding: '2px 6px', flexShrink: 0 }}>Bcc</button>
        )}
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 70, right: 16, zIndex: 1000,
          background: '#fff', borderRadius: 8, boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          border: '1px solid #E8E8E8', overflow: 'hidden',
        }}>
          <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 600, color: '#8B8CA7', textTransform: 'uppercase', letterSpacing: 0.8, borderBottom: '1px solid #F5F5F5' }}>
            Suggested contacts
          </div>
          {suggestions.map((contact, i) => {
            const color = getAvatarColor(contact.display_name);
            const initials = getInitials(contact.display_name);
            const isHighlighted = i === highlightIdx;
            return (
              <div
                key={contact.id}
                onMouseDown={() => handleSelect(contact)}
                onMouseEnter={() => setHighlightIdx(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
                  cursor: 'pointer', background: isHighlighted ? '#F0F6FF' : '#fff',
                  transition: 'background 0.08s',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: color,
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {initials}
                </div>
                {/* Name + Email */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {contact.display_name}
                  </div>
                  <div style={{ fontSize: 11, color: '#8B8CA7', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {contact.email}
                    {contact.department && <span style={{ marginLeft: 6, color: '#B0B0B0' }}>· {contact.department}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===================================================================
   EMAIL COMPOSE — Outlook-Style
   =================================================================== */
function EmailCompose({ userEmail, userName, replyTo, forwardEmail, editingDraft, onSend, onSaveDraft, onDiscard }: {
  userEmail: string; userName: string; replyTo?: any; forwardEmail?: any; editingDraft?: any;
  onSend: (data: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string; attachments?: File[] }) => void;
  onSaveDraft?: (data: { to: string[]; cc: string[]; bcc: string[]; subject: string; body: string }) => void;
  onDiscard: () => void;
}) {
  // Initialize from draft, reply, or empty
  const draftTo = editingDraft?.to ? (Array.isArray(editingDraft.to) ? editingDraft.to : JSON.parse(editingDraft.to || '[]')) : [];
  const draftCc = editingDraft?.cc ? (Array.isArray(editingDraft.cc) ? editingDraft.cc : JSON.parse(editingDraft.cc || '[]')) : [];
  const draftBcc = editingDraft?.bcc ? (Array.isArray(editingDraft.bcc) ? editingDraft.bcc : JSON.parse(editingDraft.bcc || '[]')) : [];

  const [to, setTo] = useState<string[]>(
    editingDraft ? draftTo :
    replyTo ? (replyTo.replyAll ? [...(replyTo.to || []), replyTo.fromEmail].filter((e: string) => e !== userEmail) : [replyTo.fromEmail]) : []
  );
  const [cc, setCc] = useState<string[]>(
    editingDraft ? draftCc :
    replyTo?.replyAll && replyTo.cc ? replyTo.cc.filter((e: string) => e !== userEmail) : []
  );
  const [bcc, setBcc] = useState<string[]>(editingDraft ? draftBcc : []);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(
    editingDraft ? (editingDraft.subject || '') :
    replyTo ? `Re: ${replyTo.subject.replace(/^(Re|Fwd): /i, '')}` :
    forwardEmail ? `Fwd: ${forwardEmail.subject.replace(/^(Re|Fwd): /i, '')}` : ''
  );
  const [toInput, setToInput] = useState('');
  const [ccInput, setCcInput] = useState('');
  const [bccInput, setBccInput] = useState('');
  const [focusField, setFocusField] = useState<string | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [sending, setSending] = useState(false);

  // Load all contacts once on mount for instant filtering
  useEffect(() => {
    api.get('/email/contacts').then(({ data }) => {
      setContacts(data.contacts || []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (bodyRef.current && editingDraft?.body) {
      bodyRef.current.innerHTML = editingDraft.body;
    } else if (bodyRef.current && forwardEmail) {
      bodyRef.current.innerHTML = `<br/><br/><hr style="border:none;border-top:1px solid #ddd"/><p style="color:#888">---------- Forwarded message ----------<br/>From: ${forwardEmail.from} &lt;${forwardEmail.fromEmail}&gt;<br/>Subject: ${forwardEmail.subject}<br/>Date: ${new Date(forwardEmail.date).toLocaleString()}</p>${forwardEmail.body}`;
    } else if (bodyRef.current && replyTo) {
      bodyRef.current.innerHTML = `<br/><br/><hr style="border:none;border-top:1px solid #ddd"/><p style="color:#888">On ${new Date(replyTo.date).toLocaleString()}, ${replyTo.from} wrote:</p><blockquote style="border-left:3px solid #ddd;padding-left:12px;color:#666">${replyTo.body}</blockquote>`;
    }
  }, []);

  const addEmail = (value: string, list: string[], setter: (v: string[]) => void) => {
    const trimmed = value.trim().replace(/,$/, '');
    if (trimmed && trimmed.includes('@') && !list.includes(trimmed)) {
      setter([...list, trimmed]);
    }
  };

  const makeKeyDownHandler = (value: string, list: string[], setter: (v: string[]) => void, inputSetter: (v: string) => void) =>
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        addEmail(value, list, setter);
        inputSetter('');
      } else if (e.key === 'Backspace' && value === '' && list.length > 0) {
        setter(list.slice(0, -1));
      }
    };

  const execCmd = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    bodyRef.current?.focus();
  };

  const handleSend = () => {
    if (to.length === 0) { alert('Please add at least one recipient'); return; }
    setSending(true);
    onSend({ to, cc, bcc, subject, body: bodyRef.current?.innerHTML || '', attachments: attachments.length > 0 ? attachments : undefined });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 16px', borderBottom: '1px solid #E8E8E8', gap: 8, flexShrink: 0, background: '#FAFAFA' }}>
        <button
          onClick={handleSend}
          disabled={sending || to.length === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderRadius: 6,
            border: 'none', background: to.length > 0 ? '#0078D4' : '#B0B0B0', color: '#fff',
            fontSize: 14, fontWeight: 600, cursor: to.length > 0 ? 'pointer' : 'not-allowed',
            boxShadow: to.length > 0 ? '0 2px 6px rgba(0,120,212,0.3)' : 'none',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (to.length > 0) e.currentTarget.style.background = '#106EBE'; }}
          onMouseLeave={e => { if (to.length > 0) e.currentTarget.style.background = '#0078D4'; }}
        >
          <Send size={15} /> Send
        </button>
        <div style={{ flex: 1 }} />
        {onSaveDraft && (
          <button
            onClick={() => onSaveDraft({ to, cc, bcc, subject, body: bodyRef.current?.innerHTML || '' })}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: '1px solid #E0E0E0', background: '#fff', cursor: 'pointer', color: '#424242', fontSize: 12, fontWeight: 500 }}
          >
            <FileText size={14} /> Save Draft
          </button>
        )}
        <button onClick={onDiscard} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#8B8CA7', fontSize: 12 }}>
          <Trash2 size={14} /> Discard
        </button>
        <button onClick={onDiscard} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', color: '#8B8CA7' }}>
          <X size={18} />
        </button>
      </div>

      {/* From */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', borderBottom: '1px solid #F0F0F0', fontSize: 13 }}>
        <span style={{ width: 50, color: '#8B8CA7', fontWeight: 500, flexShrink: 0 }}>From:</span>
        <span style={{ color: '#242424', fontWeight: 500 }}>{userEmail}</span>
      </div>

      {/* To */}
      <RecipientField
        label="To"
        chips={to}
        inputValue={toInput}
        onInputChange={setToInput}
        onAddChip={email => addEmail(email, to, setTo)}
        onRemoveChip={i => setTo(to.filter((_, j) => j !== i))}
        onKeyDown={makeKeyDownHandler(toInput, to, setTo, setToInput)}
        showBccToggle={!showBcc}
        onToggleBcc={() => setShowBcc(true)}
        contacts={contacts}
        focusField={focusField}
        onFocusField={setFocusField}
        fieldKey="to"
      />

      {/* Cc */}
      <RecipientField
        label="Cc"
        chips={cc}
        inputValue={ccInput}
        onInputChange={setCcInput}
        onAddChip={email => addEmail(email, cc, setCc)}
        onRemoveChip={i => setCc(cc.filter((_, j) => j !== i))}
        onKeyDown={makeKeyDownHandler(ccInput, cc, setCc, setCcInput)}
        contacts={contacts}
        focusField={focusField}
        onFocusField={setFocusField}
        fieldKey="cc"
      />

      {/* Bcc (toggle) */}
      {showBcc && (
        <RecipientField
          label="Bcc"
          chips={bcc}
          inputValue={bccInput}
          onInputChange={setBccInput}
          onAddChip={email => addEmail(email, bcc, setBcc)}
          onRemoveChip={i => setBcc(bcc.filter((_, j) => j !== i))}
          onKeyDown={makeKeyDownHandler(bccInput, bcc, setBcc, setBccInput)}
          contacts={contacts}
          focusField={focusField}
          onFocusField={setFocusField}
          fieldKey="bcc"
        />
      )}

      {/* Subject */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '8px 20px', borderBottom: '1px solid #E0E0E0', fontSize: 13 }}>
        <input
          value={subject}
          onChange={e => setSubject(e.target.value)}
          placeholder="Add a subject"
          style={{ border: 'none', outline: 'none', flex: 1, fontSize: 14, fontWeight: 500, color: '#242424' }}
        />
      </div>

      {/* Formatting Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 20px', borderBottom: '1px solid #F0F0F0', flexShrink: 0, flexWrap: 'wrap' }}>
        <ToolbarBtn icon={<Bold size={15} />} onClick={() => execCmd('bold')} title="Bold" />
        <ToolbarBtn icon={<Italic size={15} />} onClick={() => execCmd('italic')} title="Italic" />
        <ToolbarBtn icon={<Underline size={15} />} onClick={() => execCmd('underline')} title="Underline" />
        <div style={{ width: 1, height: 18, background: '#E0E0E0', margin: '0 6px' }} />
        <ToolbarBtn icon={<Link2 size={15} />} onClick={() => { const url = prompt('Enter URL:'); if (url) execCmd('createLink', url); }} title="Insert Link" />
        <ToolbarBtn icon={<Paperclip size={15} />} onClick={() => fileInputRef.current?.click()} title="Attach File" />
        <ToolbarBtn icon={<Image size={15} />} onClick={() => { fileInputRef.current?.setAttribute('accept', 'image/*'); fileInputRef.current?.click(); setTimeout(() => fileInputRef.current?.removeAttribute('accept'), 100); }} title="Insert Image" />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files || []);
            if (files.length > 0) setAttachments(prev => [...prev, ...files]);
            e.target.value = '';
          }}
        />
        <div style={{ width: 1, height: 18, background: '#E0E0E0', margin: '0 6px' }} />
        <select
          onChange={e => execCmd('fontSize', e.target.value)}
          style={{ border: '1px solid #E0E0E0', borderRadius: 4, padding: '2px 4px', fontSize: 12, color: '#424242', cursor: 'pointer', background: '#fff' }}
          defaultValue="3"
        >
          <option value="1">8</option>
          <option value="2">10</option>
          <option value="3">12</option>
          <option value="4">14</option>
          <option value="5">18</option>
          <option value="6">24</option>
        </select>
      </div>

      {/* Attachments List */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 20px', borderBottom: '1px solid #F0F0F0', background: '#FAFBFC' }}>
          {attachments.map((file, i) => (
            <div key={i} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 8px',
              background: '#fff', border: '1px solid #E0E0E0', borderRadius: 6, fontSize: 11, color: '#424242',
            }}>
              <Paperclip size={12} color="#8B8CA7" />
              <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <span style={{ color: '#B0B0B0', fontSize: 10 }}>({(file.size / 1024).toFixed(0)} KB)</span>
              <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{
                border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#D13438', display: 'flex',
              }}><X size={12} /></button>
            </div>
          ))}
        </div>
      )}

      {/* Body (contentEditable) */}
      <div
        ref={bodyRef}
        contentEditable
        suppressContentEditableWarning
        style={{
          flex: 1, padding: '20px 24px', overflowY: 'auto', outline: 'none',
          fontSize: 14, lineHeight: 1.7, color: '#333', fontFamily: "'Segoe UI', Calibri, sans-serif",
          minHeight: 200,
        }}
        data-placeholder="Type your message here..."
      />

      {/* Signature Preview */}
      <div style={{ padding: '12px 24px', borderTop: '1px solid #F0F0F0', fontSize: 12, color: '#8B8CA7', background: '#FAFAFA', flexShrink: 0 }}>
        <p style={{ margin: 0 }}>Regards,</p>
        <p style={{ margin: '2px 0 0', fontWeight: 600, color: '#424242' }}>{userName}</p>
        <p style={{ margin: '2px 0 0' }}>GET-IT | Balasore Alloys Limited</p>
      </div>
    </div>
  );
}

function EmailChip({ email, onRemove }: { email: string; onRemove: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px 2px 10px',
      background: '#E8F0FE', borderRadius: 12, fontSize: 12, color: '#0078D4', fontWeight: 500,
    }}>
      {email}
      <button onClick={onRemove} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#0078D4' }}>
        <X size={12} />
      </button>
    </span>
  );
}

function ToolbarBtn({ icon, onClick, title }: { icon: React.ReactNode; onClick: () => void; title: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title}
      style={{
        width: 30, height: 30, borderRadius: 4, border: 'none',
        background: hovered ? '#E8E8E8' : 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#424242',
        transition: 'background 0.12s',
      }}
    >
      {icon}
    </button>
  );
}
