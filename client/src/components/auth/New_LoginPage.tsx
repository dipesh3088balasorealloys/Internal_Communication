import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye, EyeOff, Loader2, ArrowRight,
  Shield, Zap, Users, Lock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/authStore';
import { useWindowSize, BREAKPOINTS } from '@/hooks/useWindowSize';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, previewLogin, isLoading, error, clearError } = useAuthStore();
  const [username, setUsername]         = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const { width } = useWindowSize();

  const isMobile          = width < BREAKPOINTS.mobile;
  const isTablet          = width >= BREAKPOINTS.mobile && width < BREAKPOINTS.tablet;
  const showBrandingPanel = width >= BREAKPOINTS.tablet;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await login(username, password); navigate('/'); }
    catch { /* error set in store */ }
  };

  const handlePreview = () => { previewLogin(); navigate('/'); };
  const canSubmit = username.trim() && password.trim() && !isLoading;

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%',
    padding: isMobile ? '11px 14px' : '13px 16px',
    fontSize: 14,
    color: '#fff',
    background: focusedField === field
      ? 'rgba(255,255,255,0.18)'
      : 'rgba(255,255,255,0.10)',
    border: focusedField === field
      ? '1.5px solid rgba(255,255,255,0.55)'
      : '1.5px solid rgba(255,255,255,0.20)',
    borderRadius: 10,
    outline: 'none',
    transition: 'all 0.2s ease',
    boxSizing: 'border-box' as const,
    fontFamily: 'inherit',
    boxShadow: focusedField === field
      ? '0 0 0 3px rgba(255,255,255,0.08)'
      : 'none',
  });

  return (
    <div style={{
      height: '100vh',
      width: '100vw',
      overflow: 'hidden',
      position: 'relative',
      fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', sans-serif",
    }}>

      {/* ── Background image ── */}
      <img
        src="/BALASORE-BACKGROUND.PNG"
        alt=""
        draggable={false}
        style={{
          position: 'absolute', top: 0, left: 0,
          width: '100%', height: '100%',
          objectFit: 'fill',
          zIndex: 0,
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* ── Dark overlay ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'rgba(0,0,0,0.42)',
        pointerEvents: 'none',
      }} />

      {/* ── Center wrapper ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '16px' : '24px',
      }}>

        {/* ══ Single Glass Container ══ */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'column' : 'row',
            width: '100%',
            maxWidth: isMobile ? 420 : isTablet ? 720 : 940,
            minHeight: isMobile ? 'auto' : 560,
            borderRadius: 24,
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.26)',
            boxShadow: '0 24px 64px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.22)',
            overflow: 'hidden',
          }}
        >

          {/* ══ LEFT — Branding ══ */}
          {showBrandingPanel && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: isTablet ? '40px 32px' : '48px 44px',
                borderRight: '1px solid rgba(255,255,255,0.16)',
                textAlign: 'center',
                background: 'rgba(255,255,255,0.05)',
              }}
            >
              {/* Logo */}
              <div style={{ width: 210, height: 210, marginBottom: 28, flexShrink: 0 }}>
                <img
                  src="/BAL-CONNECT-LOGO.PNG"
                  alt="BAL Connect"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {/* Brand title */}
              <h1 style={{
                fontSize: isTablet ? 24 : 28,
                fontWeight: 800, color: '#fff',
                lineHeight: 1.2, margin: '0 0 10px',
                letterSpacing: '-0.5px',
                textShadow: '0 2px 12px rgba(0,0,0,0.35)',
              }}>
                Balasore Alloys<br />
                <span style={{
                  background: 'linear-gradient(90deg, #FF8C00, #FFB347)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}>
                  Internal Communication
                </span>
              </h1>

              <p style={{
                fontSize: 13, color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.7, margin: '0 0 32px',
                maxWidth: 280,
              }}>
                Secure messaging, HD voice & video calls, and file sharing — built for the BAL team.
              </p>

              {/* Feature cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 300 }}>
                <FeatureCard emoji="⚡" icon={<Zap size={15} color="#FF8C00" />} title="Real-time Messaging"    desc="Channels, DMs, threads & reactions" />
                <FeatureCard emoji="📹" icon={<Users size={15} color="#FF8C00" />} title="HD Voice & Video Calls" desc="Powered by enterprise SIP infrastructure" />
                <FeatureCard emoji="🛡️" icon={<Shield size={15} color="#FF8C00" />} title="Enterprise Security"    desc="Private network, admin compliance tools" />
              </div>

              {/* Footer */}
              <div style={{
                marginTop: 32,
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 11, color: 'rgba(255,255,255,0.35)',
              }}>
                <Lock size={10} color="rgba(255,255,255,0.35)" />
                Internal use only — Private network &nbsp;|&nbsp; TLS Encrypted
              </div>
            </motion.div>
          )}

          {/* ══ RIGHT — Login Form ══ */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            style={{
              width: isMobile ? '100%' : isTablet ? 320 : 400,
              flexShrink: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isMobile ? '36px 28px' : isTablet ? '40px 32px' : '48px 44px',
            }}
          >
            {/* Mobile logo */}
            {!showBrandingPanel && (
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{ width: 100, height: 100, margin: '0 auto 12px' }}>
                  <img src="/BAL-CONNECT-LOGO.PNG" alt="BAL Connect" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>BAL Connect</h1>
              </div>
            )}


            {/* Form title */}
            <h2 style={{
              fontSize: isMobile ? 22 : 25,
              fontWeight: 700, color: '#fff',
              margin: '0 0 6px', letterSpacing: '-0.4px',
              textAlign: 'center',
              textShadow: '0 2px 10px rgba(0,0,0,0.25)',
            }}>
              Welcome back
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.52)', margin: '0 0 26px', textAlign: 'center' }}>
              Sign in to continue to BAL Connect
            </p>

            {/* Error banner */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  style={{
                    width: '100%',
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', borderRadius: 10,
                    background: 'rgba(220,38,38,0.20)',
                    border: '1px solid rgba(220,38,38,0.40)',
                    marginBottom: 18, fontSize: 13, fontWeight: 500, color: '#FCA5A5',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: 'rgba(220,38,38,0.30)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, flexShrink: 0, color: '#FCA5A5',
                  }}>!</div>
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ width: '100%' }}>
              {/* Username */}
              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.60)', marginBottom: 7,
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                }}>
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); clearError(); }}
                  onFocus={() => setFocusedField('username')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter your username"
                  required autoFocus autoComplete="username"
                  style={inputStyle('username')}
                />
              </div>

              {/* Password */}
              <div style={{ marginBottom: isMobile ? 22 : 26 }}>
                <label style={{
                  display: 'block', fontSize: 11, fontWeight: 600,
                  color: 'rgba(255,255,255,0.60)', marginBottom: 7,
                  letterSpacing: '0.5px', textTransform: 'uppercase',
                }}>
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
                    required autoComplete="current-password"
                    style={{ ...inputStyle('password'), paddingRight: 48 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: 12, top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.40)',
                      padding: 6, display: 'flex', alignItems: 'center', borderRadius: 6,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.80)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; }}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {/* Sign In Button */}
              <motion.button
                type="submit"
                disabled={!canSubmit}
                whileHover={canSubmit ? { scale: 1.015 } : {}}
                whileTap={canSubmit ? { scale: 0.975 } : {}}
                style={{
                  width: '100%',
                  padding: isMobile ? '13px 20px' : '14px 24px',
                  fontSize: 15, fontWeight: 700, fontFamily: 'inherit',
                  color: !canSubmit ? 'rgba(255,255,255,0.35)' : '#fff',
                  background: !canSubmit
                    ? 'rgba(255,255,255,0.10)'
                    : 'linear-gradient(135deg, #6264A7 0%, #5558C8 100%)',
                  border: !canSubmit ? '1px solid rgba(255,255,255,0.15)' : 'none',
                  borderRadius: 10,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  boxShadow: canSubmit ? '0 6px 22px rgba(98,100,167,0.50)' : 'none',
                  transition: 'box-shadow 0.2s, background 0.2s',
                  marginBottom: 20,
                }}
              >
                {isLoading ? (
                  <><Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> Signing in...</>
                ) : (
                  <><span>Sign In</span><ArrowRight size={16} /></>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', marginBottom: 16 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 600, letterSpacing: '0.5px' }}>OR</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.15)' }} />
            </div>

            {/* Preview Demo Button */}
            <motion.button
              type="button"
              onClick={handlePreview}
              whileHover={{ scale: 1.012 }}
              whileTap={{ scale: 0.985 }}
              style={{
                width: '100%',
                padding: isMobile ? '12px 20px' : '13px 24px',
                fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                color: '#FFB347',
                background: 'rgba(255,140,0,0.12)',
                border: '1.5px solid rgba(255,140,0,0.30)',
                borderRadius: 10,
                cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginBottom: 20,
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,140,0,0.20)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,140,0,0.12)'; }}
            >
              <Eye size={15} />
              Preview Demo (No Backend)
            </motion.button>

            {/* Register link */}
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)' }}>Don't have an account? </span>
              <Link
                to="/register"
                style={{ fontSize: 13, fontWeight: 600, color: '#A5A7F0', textDecoration: 'none' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#A5A7F0'; }}
              >
                Create account
              </Link>
            </div>
          </motion.div>

        </motion.div>
      </div>

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 14, left: 0, right: 0,
        textAlign: 'center', zIndex: 3,
        fontSize: 11, color: 'rgba(255,255,255,0.30)',
        letterSpacing: '0.3px',
      }}>
        BAL Connect v1.0 — Balasore Alloys Internal Communication
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input::placeholder { color: rgba(255,255,255,0.32) !important; }
        input:-webkit-autofill,
        input:-webkit-autofill:hover,
        input:-webkit-autofill:focus {
          -webkit-text-fill-color: #fff !important;
          -webkit-box-shadow: 0 0 0px 1000px rgba(50,50,100,0.60) inset !important;
          transition: background-color 5000s ease-in-out 0s;
        }
      `}</style>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Feature Card
═══════════════════════════════════════════════════════ */
function FeatureCard({ icon: _icon, emoji, title, desc }: {
  icon: React.ReactNode; emoji: string; title: string; desc: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.35, ease: 'easeOut' }}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '11px 14px', borderRadius: 12,
        background: 'rgba(255,255,255,0.09)',
        border: '1px solid rgba(255,255,255,0.14)',
        cursor: 'default', textAlign: 'left',
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,140,30,0.18)',
        border: '1px solid rgba(255,140,30,0.30)',
        fontSize: 16, flexShrink: 0,
      }}>
        {emoji}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', lineHeight: 1.4 }}>{desc}</div>
      </div>
    </motion.div>
  );
}
