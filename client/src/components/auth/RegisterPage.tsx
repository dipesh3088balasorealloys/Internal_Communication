import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Eye, EyeOff, Loader2, UserPlus, ArrowLeft, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useWindowSize, BREAKPOINTS } from '@/hooks/useWindowSize';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [form, setForm] = useState({
    username: '', email: '', password: '', confirmPassword: '',
    display_name: '', department: '', title: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoverSubmit, setHoverSubmit] = useState(false);
  const { width } = useWindowSize();

  const isMobile = width < BREAKPOINTS.mobile;
  const showBrandingBg = width < BREAKPOINTS.tablet;

  const updateField = (field: string, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    clearError();
    setLocalError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) { setLocalError('Passwords do not match'); return; }
    if (form.password.length < 6) { setLocalError('Password must be at least 6 characters'); return; }
    try {
      await register({
        username: form.username, email: form.email, password: form.password,
        display_name: form.display_name || form.username,
        department: form.department || undefined, title: form.title || undefined,
      });
      navigate('/');
    } catch { /* error in store */ }
  };

  const displayError = localError || error;
  const canSubmit = form.username && form.email && form.password && form.confirmPassword && !isLoading;

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: isMobile ? '10px 12px' : '11px 14px',
    fontSize: 13, color: '#1A1A2E',
    background: focusedField === field ? '#FFFFFF' : '#F8F8FC',
    border: focusedField === field ? '2px solid #6264A7' : '2px solid #E8E8F0',
    borderRadius: 10, outline: 'none', transition: 'all 0.2s ease',
    boxSizing: 'border-box', fontFamily: 'inherit',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(98,100,167,0.1)' : 'none',
  });

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600, color: '#3D3D56', marginBottom: 6,
  };

  return (
    <div
      style={{
        height: '100vh', width: '100vw',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: showBrandingBg
          ? 'linear-gradient(165deg, #1E1F33 0%, #292A3E 40%, #33345A 100%)'
          : 'linear-gradient(145deg, #F7F7FC 0%, #EEEEF8 50%, #E8E8F4 100%)',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif",
        overflowY: 'auto', padding: isMobile ? '24px 14px' : '32px 20px',
        position: 'relative',
      }}
    >
      {/* Decorative circles */}
      {showBrandingBg && (
        <>
          <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,95,199,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,95,199,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
        </>
      )}
      {!showBrandingBg && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle at 20% 30%, rgba(98,100,167,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 70%, rgba(98,100,167,0.03) 0%, transparent 50%)' }} />
      )}

      <div style={{ width: '100%', maxWidth: isMobile ? 380 : 480, position: 'relative', zIndex: 1 }}>
        {/* Mobile Logo */}
        {showBrandingBg && (
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div
              style={{
                width: 48, height: 48, borderRadius: 14,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(135deg, #5B5FC7, #7B7FE0)',
                boxShadow: '0 6px 20px rgba(91,95,199,0.4)', marginBottom: 12,
              }}
            >
              <MessageSquare size={22} color="#fff" />
            </div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#FFFFFF', margin: '0 0 3px 0' }}>BAL Connect</h1>
            <p style={{ fontSize: 12, color: '#9496B8', margin: 0 }}>Balasore Alloys Communication Hub</p>
          </div>
        )}

        {/* Card */}
        <div
          style={{
            background: '#FFFFFF',
            borderRadius: isMobile ? 16 : 20,
            padding: isMobile ? '28px 20px 24px' : '36px 36px 30px',
            boxShadow: showBrandingBg
              ? '0 8px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)'
              : '0 4px 6px rgba(0,0,0,0.02), 0 12px 28px rgba(98,100,167,0.08), 0 0 0 1px rgba(98,100,167,0.06)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: isMobile ? 20 : 26 }}>
            {!showBrandingBg && (
              <div
                style={{
                  width: 48, height: 48, borderRadius: 14,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #6264A7, #5B5FC7)',
                  boxShadow: '0 6px 20px rgba(98,100,167,0.3)', marginBottom: 16,
                }}
              >
                <UserPlus size={22} color="#fff" />
              </div>
            )}
            <h2 style={{ fontSize: isMobile ? 19 : 22, fontWeight: 700, color: '#1A1A2E', margin: '0 0 5px 0', letterSpacing: '-0.3px' }}>
              Create your account
            </h2>
            <p style={{ fontSize: 13, color: '#8B8CA7', margin: 0 }}>Join BAL Connect to start collaborating</p>
          </div>

          {/* Error */}
          {displayError && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 9, padding: '10px 13px',
                borderRadius: 10, background: '#FEF2F2', border: '1px solid #FECACA',
                marginBottom: 18, fontSize: 13, fontWeight: 500, color: '#DC2626',
              }}
            >
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>!</div>
              {displayError}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {/* Row: Username + Display Name — stack on mobile */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Username *</label>
                <input type="text" value={form.username} onChange={(e) => updateField('username', e.target.value)}
                  onFocus={() => setFocusedField('username')} onBlur={() => setFocusedField(null)}
                  placeholder="johndoe" required autoFocus style={inputStyle('username')} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Display Name</label>
                <input type="text" value={form.display_name} onChange={(e) => updateField('display_name', e.target.value)}
                  onFocus={() => setFocusedField('display_name')} onBlur={() => setFocusedField(null)}
                  placeholder="John Doe" style={inputStyle('display_name')} />
              </div>
            </div>

            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Email *</label>
              <input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)}
                onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                placeholder="john@company.com" required style={inputStyle('email')} />
            </div>

            {/* Row: Department + Job Title — stack on mobile */}
            <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 14 : 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Department</label>
                <input type="text" value={form.department} onChange={(e) => updateField('department', e.target.value)}
                  onFocus={() => setFocusedField('department')} onBlur={() => setFocusedField(null)}
                  placeholder="Engineering" style={inputStyle('department')} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Job Title</label>
                <input type="text" value={form.title} onChange={(e) => updateField('title', e.target.value)}
                  onFocus={() => setFocusedField('title')} onBlur={() => setFocusedField(null)}
                  placeholder="Developer" style={inputStyle('title')} />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Password *</label>
              <div style={{ position: 'relative' }}>
                <input type={showPassword ? 'text' : 'password'} value={form.password}
                  onChange={(e) => updateField('password', e.target.value)}
                  onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                  placeholder="Min 6 characters" required minLength={6}
                  style={{ ...inputStyle('password'), paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#9496B8',
                    padding: 5, display: 'flex', borderRadius: 6,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#6264A7'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = '#9496B8'; }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: isMobile ? 20 : 24 }}>
              <label style={labelStyle}>Confirm Password *</label>
              <input type="password" value={form.confirmPassword}
                onChange={(e) => updateField('confirmPassword', e.target.value)}
                onFocus={() => setFocusedField('confirmPassword')} onBlur={() => setFocusedField(null)}
                placeholder="Repeat your password" required style={inputStyle('confirmPassword')} />
            </div>

            {/* Submit */}
            <button type="submit" disabled={!canSubmit}
              onMouseEnter={() => setHoverSubmit(true)} onMouseLeave={() => setHoverSubmit(false)}
              style={{
                width: '100%', padding: isMobile ? '11px 20px' : '12px 24px',
                fontSize: 14, fontWeight: 600, fontFamily: 'inherit', color: '#FFFFFF',
                background: !canSubmit ? '#C4C5DB' : hoverSubmit ? '#4F51A0' : 'linear-gradient(135deg, #6264A7, #5558B2)',
                border: 'none', borderRadius: 10, cursor: canSubmit ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s ease',
                boxShadow: canSubmit ? '0 4px 14px rgba(98,100,167,0.35)' : 'none',
              }}
            >
              {isLoading ? (
                <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Creating account...</>
              ) : 'Create Account'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: isMobile ? '20px 0 16px' : '22px 0 18px' }}>
            <div style={{ flex: 1, height: 1, background: '#ECECF4' }} />
            <span style={{ fontSize: 12, color: '#A0A1BC', fontWeight: 500 }}>or</span>
            <div style={{ flex: 1, height: 1, background: '#ECECF4' }} />
          </div>

          {/* Back to login */}
          <Link to="/login"
            style={{
              width: '100%', padding: isMobile ? '10px 20px' : '11px 24px',
              fontSize: 13, fontWeight: 600, color: '#6264A7', background: '#F4F4FC',
              border: '2px solid #E8E8F0', borderRadius: 10, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              textDecoration: 'none', transition: 'all 0.15s', boxSizing: 'border-box', fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#EAEAF8'; e.currentTarget.style.borderColor = '#D0D0E8'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#F4F4FC'; e.currentTarget.style.borderColor = '#E8E8F0'; }}
          >
            <ArrowLeft size={15} />
            Back to Sign In
          </Link>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: isMobile ? 16 : 20 }}>
          <p style={{ fontSize: 11, color: showBrandingBg ? '#6E6F8A' : '#A0A1BC', margin: 0 }}>
            BAL Connect v1.0 — Balasore Alloys Communication Hub
          </p>
          {showBrandingBg && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 7 }}>
              <Lock size={10} color="#5A5C7A" />
              <span style={{ fontSize: 10, color: '#5A5C7A' }}>Secured on private network • TLS Encrypted</span>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: #B0B1C8; }
      `}</style>
    </div>
  );
}
