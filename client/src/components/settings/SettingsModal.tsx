import { useState, useEffect } from 'react';
import {
  X, User, Bell, Save, Loader2,
  Circle, Clock, MinusCircle, EyeOff, CheckCircle,
} from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/services/api';
import { getSocket } from '@/services/socket';
import { useWindowSize, BREAKPOINTS } from '@/hooks/useWindowSize';

type SettingsTab = 'profile' | 'status' | 'notifications';

interface SettingsModalProps {
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'online', label: 'Online', color: '#6BB700', icon: Circle },
  { value: 'away', label: 'Away', color: '#FFAA44', icon: Clock },
  { value: 'busy', label: 'Busy', color: '#D13438', icon: MinusCircle },
  { value: 'dnd', label: 'Do Not Disturb', color: '#D13438', icon: EyeOff },
] as const;

export default function SettingsModal({ onClose }: SettingsModalProps) {
  const { user, updateUser } = useAuthStore();
  const { width } = useWindowSize();
  const isMobile = width < BREAKPOINTS.tablet;

  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile form
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [designation, setDesignation] = useState(user?.designation || '');
  const [statusMessage, setStatusMessage] = useState(user?.status_message || '');

  // Status
  const [selectedStatus, setSelectedStatus] = useState(user?.status || 'online');

  // Notifications
  const [notifSound, setNotifSound] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(true);
  const [notifPreview, setNotifPreview] = useState(true);

  // Load notification prefs from localStorage
  useEffect(() => {
    const prefs = localStorage.getItem('notificationPrefs');
    if (prefs) {
      try {
        const p = JSON.parse(prefs);
        setNotifSound(p.sound ?? true);
        setNotifDesktop(p.desktop ?? true);
        setNotifPreview(p.preview ?? true);
      } catch { /* ignore */ }
    }
  }, []);

  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoverTab, setHoverTab] = useState<string | null>(null);
  const [hoverStatus, setHoverStatus] = useState<string | null>(null);
  const [hoverSave, setHoverSave] = useState(false);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      const { data } = await api.put(`/users/${user.id}`, {
        displayName: displayName || undefined,
        department: department || undefined,
        designation: designation || undefined,
        statusMessage: statusMessage || undefined,
      });
      updateUser({
        display_name: data.display_name || displayName,
        department: data.department || department,
        designation: data.designation || designation,
        status_message: data.status_message ?? statusMessage,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save profile:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = (status: string) => {
    setSelectedStatus(status as any);
    const socket = getSocket();
    if (socket) {
      socket.emit('presence:update', { status });
    }
    updateUser({ status: status as any });
  };

  const handleSaveNotifications = () => {
    const prefs = { sound: notifSound, desktop: notifDesktop, preview: notifPreview };
    localStorage.setItem('notificationPrefs', JSON.stringify(prefs));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);

    // Request desktop notification permission
    if (notifDesktop && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  };

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: '10px 14px',
    fontSize: 13,
    color: '#1A1A2E',
    background: focusedField === field ? '#FFFFFF' : '#F8F8FC',
    border: focusedField === field ? '2px solid #6264A7' : '2px solid #E8E8F0',
    borderRadius: 10,
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(98,100,167,0.1)' : 'none',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#3D3D56', marginBottom: 6,
  };

  const tabs: { key: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { key: 'profile', label: 'Profile', icon: <User size={16} /> },
    { key: 'status', label: 'Status', icon: <Circle size={16} /> },
    { key: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
  ];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: isMobile ? 16 : 40,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: isMobile ? 16 : 20,
          width: '100%',
          maxWidth: 560,
          maxHeight: isMobile ? '95vh' : '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: isMobile ? '16px 18px' : '20px 24px',
            borderBottom: '1px solid #E8E8F0',
            flexShrink: 0,
          }}
        >
          <h2 style={{ fontSize: isMobile ? 17 : 19, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Settings</h2>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
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

        {/* Tab Bar */}
        <div
          style={{
            display: 'flex', gap: 2,
            padding: '0 24px',
            borderBottom: '1px solid #E8E8F0',
            flexShrink: 0,
            overflowX: 'auto',
          }}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const isHovered = hoverTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                onMouseEnter={() => setHoverTab(tab.key)}
                onMouseLeave={() => setHoverTab(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 16px',
                  fontSize: 13, fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#6264A7' : isHovered ? '#3D3D56' : '#8B8CA7',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2px solid #6264A7' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: isMobile ? '20px 18px' : '24px 24px',
          }}
        >
          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Avatar + info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
                <div
                  style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6264A7, #5B5FC7)',
                    color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, fontWeight: 700, flexShrink: 0,
                  }}
                >
                  {user?.display_name?.[0]?.toUpperCase() || 'U'}
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1A2E', margin: '0 0 2px 0' }}>
                    {user?.display_name || user?.username}
                  </p>
                  <p style={{ fontSize: 12, color: '#8B8CA7', margin: '0 0 2px 0' }}>@{user?.username}</p>
                  <p style={{ fontSize: 12, color: '#A0A1BC', margin: 0 }}>{user?.email}</p>
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label style={labelStyle}>Display Name</label>
                <input
                  type="text" value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  onFocus={() => setFocusedField('displayName')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Your display name"
                  style={inputStyle('displayName')}
                />
              </div>

              {/* Department + Designation row */}
              <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 18 : 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Department</label>
                  <input
                    type="text" value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    onFocus={() => setFocusedField('department')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g. Engineering"
                    style={inputStyle('department')}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Job Title</label>
                  <input
                    type="text" value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                    onFocus={() => setFocusedField('designation')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="e.g. Senior Developer"
                    style={inputStyle('designation')}
                  />
                </div>
              </div>

              {/* Status Message */}
              <div>
                <label style={labelStyle}>Status Message</label>
                <input
                  type="text" value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  onFocus={() => setFocusedField('statusMessage')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="What's on your mind?"
                  style={inputStyle('statusMessage')}
                />
                <p style={{ fontSize: 11, color: '#A0A1BC', margin: '6px 0 0 0' }}>
                  Visible to other users in your organization
                </p>
              </div>

              {/* Calling info */}
              <div
                style={{
                  padding: '12px 14px',
                  background: '#F0FFF0',
                  borderRadius: 10,
                  border: '1px solid #D4EDD4',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#6BB700',
                    flexShrink: 0,
                  }}
                />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#3D3D56', margin: '0 0 2px 0' }}>
                    Calling
                  </p>
                  <p style={{ fontSize: 13, color: '#498205', fontWeight: 500, margin: 0 }}>
                    Peer-to-peer (Ready)
                  </p>
                </div>
              </div>

              {/* Save Button */}
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                onMouseEnter={() => setHoverSave(true)}
                onMouseLeave={() => setHoverSave(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 24px',
                  fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                  color: '#FFFFFF',
                  background: saving ? '#8B8CA7' : hoverSave ? '#4F51A0' : 'linear-gradient(135deg, #6264A7, #5558B2)',
                  border: 'none', borderRadius: 10,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 14px rgba(98,100,167,0.3)',
                  marginTop: 4,
                }}
              >
                {saving ? (
                  <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Saving...</>
                ) : saved ? (
                  <><CheckCircle size={16} /> Saved!</>
                ) : (
                  <><Save size={16} /> Save Changes</>
                )}
              </button>
            </div>
          )}

          {/* STATUS TAB */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: '#8B8CA7', margin: '0 0 12px 0' }}>
                Set your availability status. Others will see this in the sidebar.
              </p>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = selectedStatus === opt.value;
                const isHovered = hoverStatus === opt.value;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.value}
                    onClick={() => handleStatusChange(opt.value)}
                    onMouseEnter={() => setHoverStatus(opt.value)}
                    onMouseLeave={() => setHoverStatus(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px',
                      background: isSelected ? '#F4F4FC' : isHovered ? '#FAFAFC' : '#FFFFFF',
                      border: isSelected ? '2px solid #6264A7' : '2px solid #E8E8F0',
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      width: '100%',
                    }}
                  >
                    <div
                      style={{
                        width: 36, height: 36, borderRadius: '50%',
                        background: `${opt.color}18`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={18} color={opt.color} fill={opt.value === 'online' ? opt.color : 'none'} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', margin: 0 }}>{opt.label}</p>
                      <p style={{ fontSize: 12, color: '#8B8CA7', margin: '2px 0 0 0' }}>
                        {opt.value === 'online' && 'You are active and available'}
                        {opt.value === 'away' && 'You appear as away to others'}
                        {opt.value === 'busy' && 'You are busy but can receive calls'}
                        {opt.value === 'dnd' && 'Mute all notifications'}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle size={20} color="#6264A7" style={{ flexShrink: 0 }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === 'notifications' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <p style={{ fontSize: 13, color: '#8B8CA7', margin: '0 0 16px 0' }}>
                Control how you receive notifications.
              </p>

              <ToggleRow
                label="Notification Sounds"
                description="Play a sound when a new message arrives"
                checked={notifSound}
                onChange={setNotifSound}
              />
              <ToggleRow
                label="Desktop Notifications"
                description="Show browser notifications for new messages"
                checked={notifDesktop}
                onChange={setNotifDesktop}
              />
              <ToggleRow
                label="Message Preview"
                description="Show message content in desktop notifications"
                checked={notifPreview}
                onChange={setNotifPreview}
              />

              {/* Save Button */}
              <button
                onClick={handleSaveNotifications}
                onMouseEnter={() => setHoverSave(true)}
                onMouseLeave={() => setHoverSave(false)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '11px 24px',
                  fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                  color: '#FFFFFF',
                  background: hoverSave ? '#4F51A0' : 'linear-gradient(135deg, #6264A7, #5558B2)',
                  border: 'none', borderRadius: 10,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: '0 4px 14px rgba(98,100,167,0.3)',
                  marginTop: 16,
                }}
              >
                {saved ? (
                  <><CheckCircle size={16} /> Saved!</>
                ) : (
                  <><Save size={16} /> Save Preferences</>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* Toggle Row Component */
function ToggleRow({
  label, description, checked, onChange,
}: {
  label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onChange(!checked)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: hovered ? '#FAFAFC' : '#FFFFFF',
        borderRadius: 10,
        cursor: 'pointer',
        transition: 'background 0.15s',
        gap: 16,
      }}
    >
      <div>
        <p style={{ fontSize: 14, fontWeight: 500, color: '#1A1A2E', margin: '0 0 2px 0' }}>{label}</p>
        <p style={{ fontSize: 12, color: '#8B8CA7', margin: 0 }}>{description}</p>
      </div>
      <div
        style={{
          width: 44, height: 24,
          borderRadius: 12,
          background: checked ? '#6264A7' : '#D0D0D8',
          position: 'relative',
          transition: 'background 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 18, height: 18,
            borderRadius: '50%',
            background: '#FFFFFF',
            position: 'absolute',
            top: 3,
            left: checked ? 23 : 3,
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
        />
      </div>
    </div>
  );
}
