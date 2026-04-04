import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageSquare, Eye, EyeOff, Loader2, ArrowRight, Shield, Zap, Users, Lock } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { useWindowSize, BREAKPOINTS } from '@/hooks/useWindowSize';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [hoverSignIn, setHoverSignIn] = useState(false);
  const { width } = useWindowSize();

  const isMobile = width < BREAKPOINTS.mobile;
  const isTablet = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
  const showBrandingPanel = width >= BREAKPOINTS.tablet;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch {
      // error is set in store
    }
  };

  const canSubmit = username.trim() && password.trim() && !isLoading;

  return (
    <div
      style={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif",
      }}
    >
      {/* ====== Left Branding Panel — hidden on mobile/tablet ====== */}
      {showBrandingPanel && (
        <div
          style={{
            width: isTablet ? 380 : 520,
            minWidth: isTablet ? 380 : 520,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: isTablet ? '36px 32px 28px' : '48px 48px 36px',
            background: 'linear-gradient(165deg, #1E1F33 0%, #292A3E 40%, #33345A 100%)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative circles */}
          <div
            style={{
              position: 'absolute', top: -80, right: -80, width: 300, height: 300,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(91,95,199,0.15) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />
          <div
            style={{
              position: 'absolute', bottom: -60, left: -60, width: 250, height: 250,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(91,95,199,0.1) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Top: Logo + Headline */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 48 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: 13,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #5B5FC7, #7B7FE0)',
                  boxShadow: '0 4px 14px rgba(91,95,199,0.4)',
                }}
              >
                <MessageSquare size={22} color="#fff" />
              </div>
              <span style={{ fontSize: 21, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>
                BAL Connect
              </span>
            </div>

            <h1
              style={{
                fontSize: isTablet ? 28 : 34,
                fontWeight: 700, color: '#FFFFFF', lineHeight: 1.25,
                margin: '0 0 14px 0', letterSpacing: '-0.5px',
              }}
            >
              Balasore Alloys<br />
              <span style={{ color: '#A5A7F0' }}>Communication Hub</span>
            </h1>
            <p
              style={{
                fontSize: 14, lineHeight: 1.7, color: '#9496B8',
                margin: '0 0 40px 0', maxWidth: 360,
              }}
            >
              Secure messaging, voice and video calls, file sharing — all in one
              place for BAL team.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <FeatureCard icon={<Zap size={17} color="#A5A7F0" />} title="Real-time Messaging" desc="Channels, DMs, threads & reactions" />
              <FeatureCard icon={<Users size={17} color="#A5A7F0" />} title="HD Voice & Video Calls" desc="Powered by enterprise SIP infrastructure" />
              <FeatureCard icon={<Shield size={17} color="#A5A7F0" />} title="Enterprise Security" desc="Private network, admin compliance tools" />
            </div>
          </div>

          {/* Bottom */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', marginBottom: 18 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: '#5A5C7A' }}>Internal use only — Private network</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Lock size={10} color="#5A5C7A" />
                <span style={{ fontSize: 10, color: '#5A5C7A' }}>TLS Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====== Right / Center Login Form ====== */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: showBrandingPanel
            ? 'linear-gradient(145deg, #F7F7FC 0%, #EEEEF8 50%, #E8E8F4 100%)'
            : 'linear-gradient(165deg, #1E1F33 0%, #292A3E 40%, #33345A 100%)',
          padding: isMobile ? '24px 16px' : '40px',
          position: 'relative',
          overflowY: 'auto',
        }}
      >
        {/* Subtle bg pattern */}
        {showBrandingPanel && (
          <div
            style={{
              position: 'absolute', inset: 0, pointerEvents: 'none',
              backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(98,100,167,0.03) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(98,100,167,0.04) 0%, transparent 50%)',
            }}
          />
        )}

        {/* Decorative circles for mobile dark bg */}
        {!showBrandingPanel && (
          <>
            <div style={{ position: 'absolute', top: -60, right: -60, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,95,199,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -40, left: -40, width: 180, height: 180, borderRadius: '50%', background: 'radial-gradient(circle, rgba(91,95,199,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
          </>
        )}

        <div style={{ width: '100%', maxWidth: isMobile ? 360 : 420, position: 'relative', zIndex: 1 }}>
          {/* Mobile/Tablet Logo — shown when branding panel is hidden */}
          {!showBrandingPanel && (
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: 15,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #5B5FC7, #7B7FE0)',
                  boxShadow: '0 6px 20px rgba(91,95,199,0.4)',
                  marginBottom: 14,
                }}
              >
                <MessageSquare size={24} color="#fff" />
              </div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#FFFFFF', margin: '0 0 4px 0' }}>
                BAL Connect
              </h1>
              <p style={{ fontSize: 13, color: '#9496B8', margin: 0 }}>
                Internal Communication Platform
              </p>
            </div>
          )}

          {/* Card */}
          <div
            style={{
              background: '#FFFFFF',
              borderRadius: isMobile ? 16 : 20,
              padding: isMobile ? '32px 24px 28px' : '44px 40px 36px',
              boxShadow: showBrandingPanel
                ? '0 4px 6px rgba(0,0,0,0.02), 0 12px 28px rgba(98,100,167,0.08), 0 0 0 1px rgba(98,100,167,0.06)'
                : '0 8px 40px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.06)',
            }}
          >
            {/* Header */}
            <div style={{ textAlign: 'center', marginBottom: isMobile ? 24 : 32 }}>
              {showBrandingPanel && (
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 15,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: 'linear-gradient(135deg, #6264A7, #5B5FC7)',
                    boxShadow: '0 6px 20px rgba(98,100,167,0.3)',
                    marginBottom: 18,
                  }}
                >
                  <MessageSquare size={24} color="#fff" />
                </div>
              )}
              <h2
                style={{
                  fontSize: isMobile ? 20 : 24,
                  fontWeight: 700, color: '#1A1A2E',
                  margin: '0 0 6px 0', letterSpacing: '-0.3px',
                }}
              >
                Welcome back
              </h2>
              <p style={{ fontSize: 13, color: '#8B8CA7', margin: 0 }}>
                Sign in to continue to BAL Connect
              </p>
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '11px 14px', borderRadius: 10,
                  background: '#FEF2F2', border: '1px solid #FECACA',
                  marginBottom: 20, fontSize: 13, fontWeight: 500, color: '#DC2626',
                }}
              >
                <div
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: '#FEE2E2',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, flexShrink: 0,
                  }}
                >!</div>
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit}>
              {/* Username */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3D3D56', marginBottom: 7 }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); clearError(); }}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your username"
                  required
                  autoFocus
                  autoComplete="username"
                  style={{
                    width: '100%', padding: isMobile ? '11px 14px' : '12px 16px',
                    fontSize: 14, color: '#1A1A2E',
                    background: focusedField === 'username' ? '#FFFFFF' : '#F8F8FC',
                    border: focusedField === 'username' ? '2px solid #6264A7' : '2px solid #E8E8F0',
                    borderRadius: 10, outline: 'none', transition: 'all 0.2s ease',
                    boxSizing: 'border-box', fontFamily: 'inherit',
                    boxShadow: focusedField === 'username' ? '0 0 0 4px rgba(98,100,167,0.1)' : 'none',
                  }}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: isMobile ? 22 : 26 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#3D3D56', marginBottom: 7 }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); clearError(); }}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    style={{
                      width: '100%', padding: isMobile ? '11px 44px 11px 14px' : '12px 48px 12px 16px',
                      fontSize: 14, color: '#1A1A2E',
                      background: focusedField === 'password' ? '#FFFFFF' : '#F8F8FC',
                      border: focusedField === 'password' ? '2px solid #6264A7' : '2px solid #E8E8F0',
                      borderRadius: 10, outline: 'none', transition: 'all 0.2s ease',
                      boxSizing: 'border-box', fontFamily: 'inherit',
                      boxShadow: focusedField === 'password' ? '0 0 0 4px rgba(98,100,167,0.1)' : 'none',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', color: '#9496B8',
                      padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6, transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#6264A7'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = '#9496B8'; }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <button
                type="submit"
                disabled={!canSubmit}
                onMouseEnter={() => setHoverSignIn(true)}
                onMouseLeave={() => setHoverSignIn(false)}
                style={{
                  width: '100%', padding: isMobile ? '12px 20px' : '13px 24px',
                  fontSize: isMobile ? 14 : 15, fontWeight: 600, fontFamily: 'inherit',
                  color: '#FFFFFF',
                  background: !canSubmit ? '#C4C5DB' : hoverSignIn ? '#4F51A0' : 'linear-gradient(135deg, #6264A7, #5558B2)',
                  border: 'none', borderRadius: 10,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  transition: 'all 0.2s ease',
                  boxShadow: canSubmit ? '0 4px 14px rgba(98,100,167,0.35)' : 'none',
                  letterSpacing: '0.2px',
                }}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: isMobile ? '22px 0 18px' : '26px 0 22px' }}>
              <div style={{ flex: 1, height: 1, background: '#ECECF4' }} />
              <span style={{ fontSize: 12, color: '#A0A1BC', fontWeight: 500 }}>or</span>
              <div style={{ flex: 1, height: 1, background: '#ECECF4' }} />
            </div>

            {/* Create account */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: '#6E6F8A' }}>Don't have an account?{' '}</span>
              <Link
                to="/register"
                style={{ fontSize: 13, fontWeight: 600, color: '#6264A7', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; }}
                onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; }}
              >
                Create account
              </Link>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: 'center', marginTop: isMobile ? 18 : 22, padding: '0 8px' }}>
            <p style={{ fontSize: 11, color: showBrandingPanel ? '#A0A1BC' : '#6E6F8A', margin: 0, letterSpacing: '0.2px' }}>
              BAL Connect v1.0 — Balasore Alloys Communication Hub
            </p>
            {!showBrandingPanel && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8 }}>
                <Lock size={10} color="#5A5C7A" />
                <span style={{ fontSize: 10, color: '#5A5C7A' }}>Secured on private network • TLS Encrypted</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Global styles */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        * { margin: 0; padding: 0; }
        html, body, #root { height: 100%; width: 100%; overflow: hidden; }
        input::placeholder { color: #B0B1C8; }
      `}</style>
    </div>
  );
}

/* ====== Feature Card ====== */
function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 13,
        padding: '13px 15px', borderRadius: 12,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        transition: 'background 0.2s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
    >
      <div
        style={{
          width: 36, height: 36, borderRadius: 9,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(91,95,199,0.15)', flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E0E1F0', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#7E80A4', lineHeight: 1.4 }}>{desc}</div>
      </div>
    </div>
  );
}
