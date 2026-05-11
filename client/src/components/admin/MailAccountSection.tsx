import React, { useEffect, useState, useCallback } from 'react';
import { Mail, RefreshCw, Power, PowerOff, Plus, Edit3, AlertCircle, CheckCircle, Copy, Loader } from 'lucide-react';
import api from '@/services/api';

export interface MailAccountStatus {
  userId: string;
  username: string;
  mailEmail: string;
  status: 'none' | 'active' | 'disabled' | 'error';
  hasCredential: boolean;
  assignedAt: string | null;
  assignedBy: string | null;
  assignedByName: string | null;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
}

interface Props {
  user: { id: string; username: string; display_name: string };
  onChanged?: (newStatus: 'none' | 'active' | 'disabled' | 'error') => void;
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string; dot: string }> = {
  none:     { label: 'Not Configured', bg: '#F5F5F5', fg: '#6E6F8A', dot: '#C0C1D4' },
  active:   { label: 'Active',          bg: '#F0FDF4', fg: '#16A34A', dot: '#16A34A' },
  disabled: { label: 'Disabled',        bg: '#FFFBEB', fg: '#D97706', dot: '#D97706' },
  error:    { label: 'Error',           bg: '#FEF2F2', fg: '#DC2626', dot: '#DC2626' },
};

export function MailStatusBadge({ status }: { status: 'none' | 'active' | 'disabled' | 'error' | undefined }) {
  const meta = STATUS_META[status || 'none'];
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 12, background: meta.bg, color: meta.fg }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: meta.dot, flexShrink: 0 }} />
      {meta.label}
    </span>
  );
}

export default function MailAccountSection({ user, onChanged }: Props) {
  const [info, setInfo] = useState<MailAccountStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedPassword, setGeneratedPassword] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [copied, setCopied] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/admin/users/${user.id}/mail-account`);
      setInfo(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load mail account info');
    } finally {
      setLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    reload();
    setGeneratedPassword('');
    setError('');
  }, [user.id, reload]);

  const handleCreate = async () => {
    setShowCreateConfirm(false);
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/admin/users/${user.id}/mail-account`, { mode: 'auto' });
      if (data.password) setGeneratedPassword(data.password);
      await reload();
      onChanged?.('active');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create mail account');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!confirm('Reset mail password? The user will need the new password to log in.')) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.put(`/admin/users/${user.id}/mail-account/reset-password`);
      if (data.password) setGeneratedPassword(data.password);
      await reload();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async () => {
    if (!info) return;
    const enabling = info.status !== 'active';
    if (!confirm(enabling ? 'Re-enable mail access?' : 'Disable mail access? User will not be able to log in.')) return;
    setLoading(true);
    setError('');
    try {
      await api.put(`/admin/users/${user.id}/mail-account/toggle`, { enable: enabling });
      await reload();
      onChanged?.(enabling ? 'active' : 'disabled');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to toggle mail access');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/admin/users/${user.id}/mail-account/test`);
      await reload();
      if (!data.ok) setError('Test failed: ' + (data.error || 'unknown'));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Test failed');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* noop */ }
  };

  const dismissPassword = () => {
    if (!confirm('Did you save the password? It will not be shown again.')) return;
    setGeneratedPassword('');
  };

  return (
    <div style={{ marginTop: 18, marginBottom: 14, padding: '14px 14px', background: '#FAFAFF', borderRadius: 10, border: '1px solid #E8E8F0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={14} color="#6264A7" />
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1A1A2E', margin: 0 }}>Mail Account</p>
        </div>
        <MailStatusBadge status={info?.status} />
      </div>

      {error && (
        <div style={{ padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 11, color: '#DC2626', marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <AlertCircle size={12} style={{ flexShrink: 0, marginTop: 1 }} />
          <span style={{ wordBreak: 'break-word' }}>{error}</span>
        </div>
      )}

      {generatedPassword && (
        <div style={{ padding: '10px 12px', background: '#F0FDF4', borderRadius: 8, border: '1px solid #BBF7D0', marginBottom: 10 }}>
          <p style={{ fontSize: 11, color: '#16A34A', margin: '0 0 4px 0', fontWeight: 600 }}>Generated Password (shown ONCE):</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <p style={{ flex: 1, fontSize: 13, fontFamily: 'monospace', fontWeight: 700, color: '#1A1A2E', margin: 0, letterSpacing: '1px', wordBreak: 'break-all' }}>{generatedPassword}</p>
            <button onClick={copyPassword} title="Copy"
              style={{ padding: '4px 8px', background: copied ? '#16A34A' : '#fff', color: copied ? '#fff' : '#6264A7', border: '1px solid #BBF7D0', borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
              {copied ? <CheckCircle size={11} /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <button onClick={dismissPassword}
            style={{ marginTop: 6, fontSize: 10, color: '#16A34A', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            I saved it — dismiss
          </button>
        </div>
      )}

      {info && info.status !== 'none' && (
        <div style={{ marginBottom: 10, fontSize: 11.5, color: '#6E6F8A', lineHeight: 1.6 }}>
          <div><span style={{ color: '#A0A1BC' }}>Email:</span>{' '}<code style={{ fontFamily: 'monospace', color: '#1A1A2E', background: '#F0F0F5', padding: '1px 5px', borderRadius: 4 }}>{info.mailEmail}</code></div>
          {info.assignedAt && (
            <div><span style={{ color: '#A0A1BC' }}>Assigned:</span> {new Date(info.assignedAt).toLocaleString()}{info.assignedByName ? ` by ${info.assignedByName}` : ''}</div>
          )}
          {info.lastTestAt && (
            <div>
              <span style={{ color: '#A0A1BC' }}>Last test:</span> {new Date(info.lastTestAt).toLocaleString()}{' '}
              <span style={{ color: info.lastTestOk ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                ({info.lastTestOk ? 'OK' : 'FAILED'})
              </span>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {info && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {info.status === 'none' ? (
            <>
              <button onClick={() => setShowCreateConfirm(true)} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: '#6264A7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit' }}>
                {loading ? <Loader size={12} className="spin" /> : <Plus size={12} />} Create Mail Account
              </button>
              <button onClick={() => setShowAssignModal(true)} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: '#fff', color: '#6264A7', border: '1px solid #C0C1E0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                <Edit3 size={12} /> Assign Existing
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={handleResetPassword} disabled={loading}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px', background: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit' }}>
                  <RefreshCw size={11} /> Reset
                </button>
                <button onClick={handleTest} disabled={loading}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '8px', background: '#fff', color: '#0078D4', border: '1px solid #BAE6FD', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit' }}>
                  <CheckCircle size={11} /> Test
                </button>
              </div>
              <button onClick={handleToggle} disabled={loading}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px', background: info.status === 'active' ? '#FEF2F2' : '#F0FDF4', color: info.status === 'active' ? '#DC2626' : '#16A34A', border: `1px solid ${info.status === 'active' ? '#FECACA' : '#BBF7D0'}`, borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1, fontFamily: 'inherit' }}>
                {info.status === 'active' ? <><PowerOff size={11} /> Disable Mail Access</> : <><Power size={11} /> Re-enable Mail Access</>}
              </button>
            </>
          )}
        </div>
      )}

      {/* Confirm-Create modal */}
      {showCreateConfirm && info && (
        <ModalShell onClose={() => setShowCreateConfirm(false)}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: '0 0 10px 0' }}>Create mail account?</h3>
          <p style={{ fontSize: 12, color: '#6E6F8A', lineHeight: 1.5, margin: '0 0 16px 0' }}>
            This will create a new mail account in Stalwart for{' '}
            <strong style={{ color: '#1A1A2E' }}>{user.display_name}</strong> with email{' '}
            <code style={{ fontFamily: 'monospace', background: '#F0F0F5', padding: '1px 6px', borderRadius: 4 }}>{info.mailEmail}</code>.
            A secure password will be generated and shown to you ONCE.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setShowCreateConfirm(false)}
              style={{ padding: '8px 16px', background: '#fff', color: '#6E6F8A', border: '1px solid #E8E8F0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
            <button onClick={handleCreate}
              style={{ padding: '8px 16px', background: '#6264A7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              Create
            </button>
          </div>
        </ModalShell>
      )}

      {/* Manual Assign modal */}
      {showAssignModal && info && (
        <AssignExistingModal
          user={user}
          defaultEmail={info.mailEmail}
          onClose={() => setShowAssignModal(false)}
          onSuccess={async () => {
            setShowAssignModal(false);
            await reload();
            onChanged?.('active');
          }}
        />
      )}
    </div>
  );
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ background: '#fff', borderRadius: 14, padding: 22, maxWidth: 460, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        {children}
      </div>
    </div>
  );
}

function AssignExistingModal({
  user, defaultEmail, onClose, onSuccess,
}: {
  user: { id: string; username: string; display_name: string };
  defaultEmail: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [customEmail, setCustomEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!password.trim()) { setErr('Password required'); return; }
    setBusy(true); setErr('');
    try {
      await api.post(`/admin/users/${user.id}/mail-account`, {
        mode: 'manual',
        password,
        customEmail: customEmail.trim() || undefined,
      });
      onSuccess();
    } catch (e: any) {
      setErr(e.response?.data?.error || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', margin: '0 0 6px 0' }}>Assign existing mail account</h3>
      <p style={{ fontSize: 11, color: '#A0A1BC', margin: '0 0 14px 0' }}>
        Use this when the Stalwart account already exists. Credentials will be tested before saving.
      </p>

      <label style={{ display: 'block', fontSize: 11, color: '#6E6F8A', fontWeight: 600, margin: '0 0 4px 0' }}>Mail email</label>
      <input type="email" value={customEmail} onChange={(e) => setCustomEmail(e.target.value)}
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E8E8F0', borderRadius: 8, fontSize: 13, marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />

      <label style={{ display: 'block', fontSize: 11, color: '#6E6F8A', fontWeight: 600, margin: '0 0 4px 0' }}>Mail password (Stalwart)</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        placeholder="Existing Stalwart password"
        style={{ width: '100%', padding: '8px 10px', border: '1px solid #E8E8F0', borderRadius: 8, fontSize: 13, marginBottom: 12, fontFamily: 'inherit', boxSizing: 'border-box' }} />

      {err && (
        <div style={{ padding: '8px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 6, fontSize: 11, color: '#DC2626', marginBottom: 10 }}>
          {err}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} disabled={busy}
          style={{ padding: '8px 16px', background: '#fff', color: '#6E6F8A', border: '1px solid #E8E8F0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
          Cancel
        </button>
        <button onClick={submit} disabled={busy}
          style={{ padding: '8px 16px', background: '#6264A7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? 0.6 : 1, fontFamily: 'inherit' }}>
          {busy ? 'Testing & Saving…' : 'Test & Save'}
        </button>
      </div>
    </ModalShell>
  );
}
