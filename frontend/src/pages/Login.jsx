import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useI18n } from '../contexts/I18nContext.jsx';
import api from '../api.js';

// Version du logiciel : date de build au format AAAA-MM-JJ
const APP_VERSION = '2026-04-24_b49.143';


// ── MODAL MOT DE PASSE OUBLIÉ ─────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }) {
  const [username,  setUsername]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [step,      setStep]      = useState('form'); // form | sent | error
  const [errMsg,    setErrMsg]    = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim()) return setErrMsg('Identifiant requis');
    setLoading(true); setErrMsg('');
    try {
      await api.forgotPassword(username.trim());
      setStep('sent');
    } catch {
      setErrMsg('Une erreur est survenue. Veuillez réessayer.');
    }
    finally { setLoading(false); }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: 'var(--surf)', border: '1px solid var(--brd)', borderRadius: 'var(--rl)',
        padding: '28px 32px', width: '100%', maxWidth: 400,
        boxShadow: '0 8px 40px rgba(0,0,0,.4)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" style={{ width: 20, height: 20 }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)' }}>Mot de passe oublié</span>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1, padding: '0 4px' }}>
            ✕
          </button>
        </div>

        {step === 'form' && (
          <>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 18, lineHeight: 1.6 }}>
              Entrez votre identifiant. Si un email est configuré sur votre compte et que le serveur SMTP est actif, vous recevrez un lien de réinitialisation valable <strong>10 minutes</strong>.
            </p>
            {errMsg && (
              <div style={{ background: 'var(--err-s)', color: 'var(--err)', border: '1px solid var(--err)', borderRadius: 'var(--r)', padding: '8px 12px', fontSize: 12, marginBottom: 14 }}>
                {errMsg}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">IDENTIFIANT</label>
                <input className="form-control" value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Votre identifiant" autoFocus />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button type="button" className="btn" onClick={onClose} style={{ flex: 1 }}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1, justifyContent: 'center' }}>
                  {loading ? 'Envoi…' : 'Envoyer'}
                </button>
              </div>
            </form>
          </>
        )}

        {step === 'sent' && (
          <div style={{ textAlign: 'center', padding: '8px 0' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2"
              style={{ width: 44, height: 44, margin: '0 auto 14px', display: 'block' }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)', marginBottom: 10 }}>Demande envoyée</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 20 }}>
              Demande traitée. Si un email est configuré sur ce compte, vous recevrez le lien sous peu.
            </div>
            <button className="btn btn-primary" onClick={onClose} style={{ justifyContent: 'center', padding: '9px 28px' }}>
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const passwordChanged = sp.get('changed') === '1';

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.login(username, password);
      const payload = login(res.token);
      if (payload.mustChangePassword) navigate('/change-password');
      else navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      {/* Toggle thème en haut à droite même sur la page login */}
      <button
        className={`theme-toggle ${dark ? 'on' : ''}`}
        onClick={toggle}
        title={dark ? 'Mode clair' : 'Mode sombre'}
        style={{ position: 'fixed', top: 18, right: 20 }}
      />

      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <img
            src="/logo-login.png"
            alt="NexusVault"
            style={{ width: '100%', maxWidth: 440, height: 'auto', objectFit: 'contain' }}
          />
        </div>

        {passwordChanged && (
          <div className="alert alert-ok" style={{ marginBottom: 16 }}>
            ✓ Mot de passe modifié. Veuillez vous reconnecter.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-err" style={{ marginBottom: 16 }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Identifiant</label>
            <input
              className="form-control"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Mot de passe</label>
            <input
              className="form-control"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 14, justifyContent: 'center', padding: '10px 14px', fontSize: 13 }}
            disabled={loading}
          >
            {loading ? t('auth.logging_in') : t('auth.login')}
          </button>
        </form>

        {/* Lien reset mot de passe */}
        <div style={{ textAlign: 'center', marginTop: 14 }}>
          <button onClick={() => setShowForgot(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--muted)', padding: 0 }}
            onMouseEnter={e => e.target.style.color='var(--acc)'}
            onMouseLeave={e => e.target.style.color='var(--muted)'}>
            Mot de passe oublié ?
          </button>
        </div>
        {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

        {/* Version */}
        <div className="login-version">
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
