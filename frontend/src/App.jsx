import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { I18nProvider } from './contexts/I18nContext.jsx';
import { useSessionTimeout } from './hooks/useSessionTimeout.js';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Login from './pages/Login.jsx';
import Config from './pages/Config.jsx';
import Backups from './pages/Backups.jsx';
import Activity from './pages/Activity.jsx';
import Admin from './pages/Admin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Scripts from './pages/Scripts.jsx';

// ── SESSION WARNING ────────────────────────────────────────────────────────────
function SessionWarning({ seconds: initialSeconds, onDismiss, onExpire }) {
  const [countdown, setCountdown] = useState(initialSeconds);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!initialSeconds) return;
    setCountdown(initialSeconds);
    setGone(false);
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(iv); setGone(true); onExpire?.(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line
  }, [initialSeconds]);

  if (!initialSeconds || gone) return null;
  return (
    <div style={{
      position:'fixed', bottom:'calc(var(--footer-h) + 12px)', left:'50%',
      transform:'translateX(-50%)', zIndex:500,
      background:'var(--warn)', color:'white',
      padding:'10px 20px', borderRadius:'var(--r)',
      display:'flex', alignItems:'center', gap:12,
      boxShadow:'0 4px 20px rgba(0,0,0,.25)', fontSize:13, fontWeight:500,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Session expirée dans{' '}
      <strong style={{fontVariantNumeric:'tabular-nums', minWidth:24, display:'inline-block', textAlign:'center'}}>
        {countdown}s
      </strong>{' '}
      — cliquez pour rester connecté
      <button onClick={() => { onDismiss?.(); window.__sessionTimeoutDismiss?.(); }} style={{
        background:'rgba(255,255,255,.25)', border:'none', color:'white',
        padding:'4px 10px', borderRadius:4, cursor:'pointer', fontWeight:600,
      }}>Continuer</button>
    </div>
  );
}

// ── APP INNER ──────────────────────────────────────────────────────────────────
function AppInner({ children }) {
  const [warnSec, setWarnSec] = useState(null);
  const { logout } = useAuth();

  const handleWarn          = useCallback((s) => setWarnSec(s), []);
  const handleExpireTimer   = useCallback(() => setWarnSec(null), []);
  const handleSessionExpire = useCallback(() => {
    setWarnSec(null);
    logout('timeout');
  }, [logout]);

  useSessionTimeout({
    onWarn:   handleWarn,
    onExpire: handleSessionExpire,
  });

  return (
    <>
      <Navbar />
      <div style={{ minHeight:'calc(100vh - var(--nav) - var(--footer-h))', paddingBottom:16 }}>
        {children}
      </div>
      <Footer />
      <SessionWarning seconds={warnSec} onDismiss={() => setWarnSec(null)} onExpire={handleSessionExpire} />
    </>
  );
}

// ── ROUTES PROTÉGÉES ───────────────────────────────────────────────────────────
function ProtectedRoutes() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  // Force password change — géré dans Login.jsx via modal
  // Ne pas bloquer les routes ici pour permettre au modal de rester sur /login

  return (
    <AppInner>
      <Routes>
        <Route path="/"               element={<Dashboard />} />
        <Route path="/backups"        element={<Backups />} />
        <Route path="/activite"       element={<Activity />} />
        <Route path="/appareils"      element={<Config />} />
        <Route path="/documents" element={<Scripts />} />
        <Route path="/admin"          element={<Admin />} />
        <Route path="*"               element={<Navigate to="/" replace />} />
      </Routes>
    </AppInner>
  );
}

function AppRoot() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*"     element={<ProtectedRoutes />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <AppRoot />
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
