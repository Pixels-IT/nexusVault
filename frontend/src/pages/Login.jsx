import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import { useI18n } from '../contexts/I18nContext.jsx';
import LangSwitcher from '../components/LangSwitcher.jsx';
import api from '../api.js';
import { APP_VERSION } from '../version.js';

// ── MODAL MOT DE PASSE OUBLIÉ ─────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }) {
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [loading, setLoading]   = useState(false);
  const [sent, setSent]         = useState(false);
  const [error, setError]       = useState('');

  async function send(e) {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true); setError('');
    try {
      await api.forgotPassword(username.trim());
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      position:'fixed', inset:0, background:'rgba(0,0,0,.6)',
      display:'flex', alignItems:'center', justifyContent:'center', zIndex:999,
    }} onClick={onClose}>
      <div style={{
        background:'var(--surf)', borderRadius:'var(--rl)', padding:'28px 32px',
        width:'100%', maxWidth:420, boxShadow:'0 8px 40px rgba(0,0,0,.4)',
      }} onClick={e => e.stopPropagation()}>
        {sent ? (
          <>
            <div style={{fontSize:16, fontWeight:700, marginBottom:8}}>{t('auth.forgot_sent_title')}</div>
            <p style={{fontSize:13, color:'var(--muted)', marginBottom:20}}>{t('auth.forgot_sent_desc')}</p>
            <button className="btn btn-primary" onClick={onClose} style={{width:'100%', justifyContent:'center'}}>
              {t('auth.forgot_close')}
            </button>
          </>
        ) : (
          <form onSubmit={send}>
            <div style={{fontSize:16, fontWeight:700, marginBottom:6}}>{t('auth.forgot_title')}</div>
            <p style={{fontSize:12, color:'var(--muted)', marginBottom:18}}>{t('auth.forgot_desc')}</p>
            {error && <div className="alert alert-err" style={{fontSize:12, marginBottom:12}}>{error}</div>}
            <div className="form-group">
              <label className="form-label">{t('auth.forgot_username')}</label>
              <input className="form-control" autoFocus value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('auth.forgot_placeholder')} />
            </div>
            <div style={{display:'flex', gap:8, marginTop:16}}>
              <button type="button" className="btn" onClick={onClose} style={{flex:1}}>
                {t('auth.forgot_cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{flex:1, justifyContent:'center'}}>
                {loading ? t('auth.forgot_sending') : t('auth.forgot_send')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── PAGE LOGIN ─────────────────────────────────────────────────────────────────
export default function Login() {
  const { login }       = useAuth();
  const { dark, toggle } = useTheme();
  const { t }           = useI18n();
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const passwordChanged = searchParams.get('changed') === '1';

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true); setError('');
    try {
      const res = await api.login(username.trim(), password);
      const user = login(res.token);
      if (user.must_change_password) navigate('/admin?tab=account&force=1');
      else navigate('/');
    } catch (err) {
      setError(err.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg)', padding:'20px',
    }}>
      {/* Boutons haut droite : LangSwitcher + ThemeToggle */}
      <div style={{position:'fixed', top:14, right:16, display:'flex', alignItems:'center', gap:8}}>
        <LangSwitcher />
        <button
          className={`theme-toggle ${dark ? 'on' : ''}`}
          onClick={toggle}
          title={dark ? 'Mode clair' : 'Mode sombre'}
        />
      </div>

      <div style={{width:'100%', maxWidth:440}}>

        {/* Card avec logo à l'intérieur */}
        <div className="card" style={{padding:'32px 36px'}}>
          {/* Logo */}
          <div style={{textAlign:'center', marginBottom:24}}>
            <img src="/logo-login.png" alt="NexusVault" style={{width:'100%', maxWidth:260, height:'auto'}} />
          </div>
          {passwordChanged && (
            <div className="alert alert-ok" style={{fontSize:12, marginBottom:16}}>
              ✓ {t('auth.password_changed')}
            </div>
          )}
          {error && (
            <div className="alert alert-err" style={{fontSize:12, marginBottom:16}}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">{t('auth.username')}</label>
              <input
                className="form-control"
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoFocus
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('auth.password')}</label>
              <input
                className="form-control"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{display:'block',width:'auto',minWidth:200,margin:'12px auto 0',textAlign:'center'}}
            >
              {loading ? t('auth.logging_in') : t('auth.login')}
            </button>
          </form>

          <div style={{textAlign:'center', marginTop:16}}>
            <button
              type="button"
              style={{background:'none', border:'none', cursor:'pointer', fontSize:12, color:'var(--muted)', padding:0}}
              onMouseEnter={e => e.target.style.color='var(--acc)'}
              onMouseLeave={e => e.target.style.color='var(--muted)'}
              onClick={() => setShowForgot(true)}
            >
              {t('auth.forgot_link')}
            </button>
          </div>
        </div>

        {/* Version */}
        <div style={{textAlign:'center', marginTop:12, fontSize:12, color:'var(--muted)', fontWeight:500, letterSpacing:'.2px'}}>
          {APP_VERSION}
        </div>
      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}
    </div>
  );
}
