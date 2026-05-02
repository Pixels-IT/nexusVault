import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext.jsx';
import { ThemeProvider } from './contexts/ThemeContext.jsx';
import { I18nProvider } from './contexts/I18nContext.jsx';
import { useSessionTimeout } from './hooks/useSessionTimeout.js';
import Navbar from './components/Navbar.jsx';
import Login from './pages/Login.jsx';
import ChangePassword from './pages/ChangePassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Backups from './pages/Backups.jsx';
import Admin from './pages/Admin.jsx';
import Activity from './pages/Activity.jsx';
import Scripts from './pages/Scripts.jsx';
import Personnalisation from './pages/Personnalisation.jsx';
import './index.css';

const APP_VERSION = '2026-05-02_b141.379';

// ── Banner avertissement session ───────────────────────────────────────────────
function SessionWarning({ seconds: initialSeconds, onDismiss, onExpire }) {
  const [countdown, setCountdown] = useState(initialSeconds);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!initialSeconds) return;
    setCountdown(initialSeconds);
    setGone(false);
    const iv = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(iv);
          setGone(true);
          onExpire?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  // eslint-disable-next-line
  }, [initialSeconds]);

  if (!initialSeconds || gone) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 'calc(var(--footer-h) + 12px)', left: '50%',
      transform: 'translateX(-50%)', zIndex: 500,
      background: 'var(--warn)', color: 'white',
      padding: '10px 20px', borderRadius: 'var(--r)',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 4px 20px rgba(0,0,0,.25)', fontSize: 13, fontWeight: 500,
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      Session expirée dans <strong style={{ fontVariantNumeric: 'tabular-nums', minWidth: 24, display: 'inline-block', textAlign: 'center' }}>{countdown}s</strong> — cliquez pour rester connecté
      <button onClick={onDismiss} style={{ background: 'rgba(255,255,255,.25)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontWeight: 600 }}>
        Continuer
      </button>
    </div>
  );
}

// ── Footer ─────────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="footer-bar">
      <span>© 2026 NexusVault — AGPL-3.0 — v{APP_VERSION}</span>
    </footer>
  );
}

// ── Layout protégé ─────────────────────────────────────────────────────────────
function ProtectedLayout({ children }) {
  const [warnSec, setWarnSec] = useState(null);
  const { logout } = useAuth();

  useSessionTimeout({
    onWarn:   (s) => setWarnSec(s),
    onExpire: ()  => setWarnSec(null), // doExpire dans le hook appelle déjà logout('timeout')
  });

  const handleSessionExpire = () => {
    setWarnSec(null);
    logout('timeout'); // countdown du SessionWarning arrive à 0
  };

  return (
    <>
      <Navbar />
      <div style={{ minHeight: 'calc(100vh - var(--nav) - var(--footer-h))', paddingBottom: 16 }}>
        {children}
      </div>
      <Footer />
      <SessionWarning seconds={warnSec} onDismiss={() => setWarnSec(null)} onExpire={handleSessionExpire} />
    </>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}><span className="spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return (
    <Routes>
      <Route path="/login"           element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/reset-password"  element={user ? <Navigate to="/" replace /> : <ResetPassword />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/*" element={
        <ProtectedLayout>
          <Routes>
            <Route path="/"        element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/backups" element={<ProtectedRoute><Backups /></ProtectedRoute>} />
            <Route path="/appareils" element={<Navigate to="/admin?tab=appareils" replace />} />
            <Route path="/admin"   element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="/activity" element={<ProtectedRoute><Activity /></ProtectedRoute>} />
            <Route path="/automatisation" element={<ProtectedRoute><Scripts /></ProtectedRoute>} />
            <Route path="/personnalisation" element={<ProtectedRoute><Personnalisation /></ProtectedRoute>} />
          </Routes>
        </ProtectedLayout>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}
