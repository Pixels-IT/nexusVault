import { useState, useEffect } from 'react';
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
              <button type="button" className="btn" onClick={onClose}
                style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center'}}>
                {t('auth.forgot_cancel')}
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{flex:1, display:'flex', alignItems:'center', justifyContent:'center'}}>
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
  const { login }        = useAuth();
  const { dark, toggle } = useTheme();
  const { t }            = useI18n();
  const navigate         = useNavigate();
  const [searchParams]   = useSearchParams();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  // TOTP states
  const [step, setStep]             = useState('credentials');
  const [totpCode, setTotpCode]     = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [qrData, setQrData]         = useState(null);
  const [totpLoading, setTotpLoading] = useState(false);
  const [totpError, setTotpError]   = useState('');

  // OIDC public config
  const [oidc, setOidc] = useState(null);

  const [mustChangePwd, setMustChangePwd] = useState(false);
  const [changePwdToken, setChangePwdToken] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [newPwd2, setNewPwd2] = useState('');
  const [changePwdErr, setChangePwdErr] = useState('');
  const [changePwdLoading, setChangePwdLoading] = useState(false);

  const passwordChanged = searchParams.get('changed') === '1';

  useEffect(() => {
    api.oidcPublic().then(cfg => {
      setOidc(cfg);
      if (cfg.enabled && !cfg.allow_local_login) redirectToOidc(cfg);
    }).catch(() => setOidc({ enabled: false, allow_local_login: true }));
  }, []);

  // Gérer le retour OIDC avec ?code=
  useEffect(() => {
    const code  = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code) return;
    // Vérifier le state anti-CSRF
    const savedState = sessionStorage.getItem('oidc_state');
    if (state && savedState && state !== savedState) {
      setError('Erreur de sécurité OIDC (state mismatch). Réessayez.');
      setSearchParams({});
      return;
    }
    sessionStorage.removeItem('oidc_state');
    setLoading(true); setError('');
    const redirectUri = window.location.origin + '/login';
    api.oidcExchange({ code, redirect_uri: redirectUri })
      .then(res => {
        const payload = JSON.parse(atob(res.token.split('.')[1]));
        if (payload.mustChangePassword) {
          setChangePwdToken(res.token);
          setMustChangePwd(true);
        } else {
          login(res.token);
          navigate('/');
        }
      })
      .catch(err => {
        setError(err.message || 'Authentification OIDC échouée');
        setSearchParams({});
      })
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  function redirectToOidc(cfg) {
    const authEndpoint = cfg.authorization_endpoint || '';
    if (!authEndpoint || !cfg.client_id) return;
    const redirectUri = window.location.origin + '/login';
    const state = btoa(Math.random().toString(36).slice(2));
    sessionStorage.setItem('oidc_state', state);
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: cfg.client_id,
      redirect_uri: redirectUri,
      scope: cfg.scopes || 'openid email profile',
      state,
    });
    window.location.href = authEndpoint + '?' + params.toString();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true); setError('');
    try {
      const res = await api.login(username.trim(), password);
      if (res.totp_required) {
        setSetupToken(res.setup_token || '');
        if (res.totp_setup) {
          // Charger le QR code
          setStep('totp-setup');
          const qr = await api.totpSetupQr(res.setup_token);
          setQrData(qr);
        } else {
          setStep('totp');
        }
        return;
      }
      // Décoder le token sans l'enregistrer pour vérifier mustChangePassword
      const payload = JSON.parse(atob(res.token.split('.')[1]));
      if (payload.mustChangePassword) {
        // Ne pas connecter l'utilisateur — afficher le modal de changement obligatoire
        setChangePwdToken(res.token);
        setMustChangePwd(true);
      } else {
        login(res.token);
        navigate('/');
      }
    } catch (err) {
      setError(err.message || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e) {
    e.preventDefault();
    if (totpCode.length !== 6) return;
    setTotpLoading(true); setTotpError('');
    try {
      // Appeler login avec le code TOTP
      const res = await api.login(username.trim(), password, totpCode);
      // Décoder le token sans l'enregistrer pour vérifier mustChangePassword
      const payload = JSON.parse(atob(res.token.split('.')[1]));
      if (payload.mustChangePassword) {
        // Ne pas connecter l'utilisateur — afficher le modal de changement obligatoire
        setChangePwdToken(res.token);
        setMustChangePwd(true);
      } else {
        login(res.token);
        navigate('/');
      }
    } catch (err) {
      setTotpError(err.message || 'Code invalide');
    } finally {
      setTotpLoading(false);
    }
  }

  async function handleSetupVerify(e) {
    e.preventDefault();
    if (totpCode.length !== 6) return;
    setTotpLoading(true); setTotpError('');
    try {
      const res = await api.totpSetupVerify(setupToken, totpCode);
      // Décoder le token sans l'enregistrer pour vérifier mustChangePassword
      const payload = JSON.parse(atob(res.token.split('.')[1]));
      if (payload.mustChangePassword) {
        // Ne pas connecter l'utilisateur — afficher le modal de changement obligatoire
        setChangePwdToken(res.token);
        setMustChangePwd(true);
      } else {
        login(res.token);
        navigate('/');
      }
    } catch (err) {
      setTotpError(err.message || 'Code invalide');
    } finally {
      setTotpLoading(false);
    }
  }

  return (
    <div style={{
      minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center',
      background:'var(--bg)', padding:'20px',
    }}>
      {/* Boutons haut droite */}
      <div style={{position:'fixed', top:14, right:16, display:'flex', alignItems:'center', gap:8}}>
        <LangSwitcher />
        <button className={`theme-toggle ${dark ? 'on' : ''}`} onClick={toggle} title={dark ? 'Mode clair' : 'Mode sombre'} />
      </div>

      <div style={{width:'100%', maxWidth: step === 'totp-setup' ? 500 : 440}}>

        {/* ── ÉTAPE 1 : IDENTIFIANTS ── */}
        {step === 'credentials' && (
          <div className="card" style={{padding:'32px 36px 16px 36px'}}>
            <div style={{textAlign:'center', marginBottom:24}}>
              <img src="/logo-login.png" alt="NexusVault" style={{width:'100%', height:'auto'}} />
            </div>
            {passwordChanged && <div className="alert alert-ok" style={{fontSize:12, marginBottom:16}}>✓ {t('auth.password_changed')}</div>}
            {error && <div className="alert alert-err" style={{fontSize:12, marginBottom:16}}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('auth.username')}</label>
                <input className="form-control" type="text" value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username" />
              </div>
              <div className="form-group">
                <label className="form-label">{t('auth.password')}</label>
                <input className="form-control" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
              </div>
              <button type="submit" className="btn btn-primary" disabled={loading}
                style={{display:'block',width:'auto',minWidth:200,margin:'12px auto 0',textAlign:'center'}}>
                {loading ? t('auth.logging_in') : t('auth.login')}
              </button>
            </form>
            <div style={{textAlign:'center', marginTop:16}}>
              <button type="button" style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--muted)',padding:0}}
                onMouseEnter={e=>e.target.style.color='var(--acc)'} onMouseLeave={e=>e.target.style.color='var(--muted)'}
                onClick={() => setShowForgot(true)}>{t('auth.forgot_link')}</button>
            </div>
            {/* Version */}
            <div style={{textAlign:'center', marginTop:24, fontSize:12, color:'var(--muted)', fontWeight:500, letterSpacing:'.2px', marginBottom:0}}>
            {/* OIDC button */}
            {oidc?.enabled && (
              <div style={{marginTop:16, textAlign:'center'}}>
                <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:12}}>
                  <div style={{flex:1, height:1, background:'var(--brd)'}}/>
                  <span style={{fontSize:11, color:'var(--muted)', whiteSpace:'nowrap'}}>
                    {t('auth.or_sso') || 'ou SSO'}
                  </span>
                  <div style={{flex:1, height:1, background:'var(--brd)'}}/>
                </div>
                <button type="button" className="btn btn-primary" onClick={() => redirectToOidc(oidc)}
                  style={{width:'100%', justifyContent:'center', gap:8, display:'flex', alignItems:'center'}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}>
                    <circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                  </svg>
                  {oidc.provider_name || t('auth.sso_login') || 'SSO / OIDC'}
                </button>
              </div>
            )}
              {APP_VERSION}
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2a : CODE TOTP ── */}
        {step === 'totp' && (
          <div className="card" style={{padding:'32px 36px'}}>
            <div style={{textAlign:'center', marginBottom:24}}>
              <img src="/logo-login.png" alt="NexusVault" style={{width:'100%', height:'auto'}} />
            </div>
            <div style={{textAlign:'center', marginBottom:20}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" style={{width:40,height:40,marginBottom:8}}>
                <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                <line x1="12" y1="15" x2="12" y2="17"/>
              </svg>
              <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>{t('auth.totp_title')}</div>
              <div style={{fontSize:12,color:'var(--muted)'}}>Saisissez le code à 6 chiffres de votre application d'authentification</div>
            </div>
            {totpError && <div className="alert alert-err" style={{fontSize:12, marginBottom:12}}>{totpError}</div>}
            <form onSubmit={handleTotpSubmit}>
              <div className="form-group">
                <label className="form-label" style={{textAlign:'center',display:'block'}}>Code TOTP</label>
                <input className="form-control" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                  value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,''))}
                  autoFocus placeholder="000000"
                  style={{textAlign:'center', fontSize:24, letterSpacing:8, fontFamily:'var(--mono)'}} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={totpLoading || totpCode.length !== 6}
                style={{display:'block',width:'auto',minWidth:200,margin:'12px auto 0',textAlign:'center'}}>
                {totpLoading ? 'Vérification…' : 'Vérifier'}
              </button>
            </form>
            <div style={{textAlign:'center', marginTop:12}}>
              <button type="button" onClick={() => { setStep('credentials'); setTotpCode(''); setTotpError(''); }}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--muted)',padding:0}}>
                ← Retour
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 2b : SETUP TOTP (premier scan QR) ── */}
        {step === 'totp-setup' && (
          <div className="card" style={{padding:'32px 36px'}}>
            <div style={{textAlign:'center', marginBottom:20}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" style={{width:36,height:36,marginBottom:8}}>
                <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
              </svg>
              <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Configuration du TOTP</div>
              <div style={{fontSize:12,color:'var(--muted)'}}>Scannez ce QR code avec Google Authenticator, Authy ou une application similaire.</div>
            </div>
            {!qrData ? (
              <div style={{textAlign:'center',padding:24,color:'var(--muted)'}}>{t('auth.totp_qr_loading') || 'Generating QR code…'}</div>
            ) : (
              <>
                <div style={{textAlign:'center',marginBottom:16}}>
                  <img src={qrData.qr} alt="QR TOTP" style={{width:200,height:200,imageRendering:'pixelated',borderRadius:8,border:'4px solid var(--surf2)'}} />
                </div>
                <div style={{background:'var(--surf2)',borderRadius:'var(--r)',padding:'10px 14px',marginBottom:16,fontSize:11,fontFamily:'var(--mono)',textAlign:'center',wordBreak:'break-all',color:'var(--muted)'}}>
                  Clé manuelle : <strong>{qrData.secret}</strong>
                </div>
                {totpError && <div className="alert alert-err" style={{fontSize:12,marginBottom:12}}>{totpError}</div>}
                <form onSubmit={handleSetupVerify}>
                  <div className="form-group">
                    <label className="form-label" style={{textAlign:'center',display:'block'}}>{t('auth.totp_code')}</label>
                    <input className="form-control" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6}
                      value={totpCode} onChange={e => setTotpCode(e.target.value.replace(/\D/g,''))}
                      autoFocus placeholder="000000"
                      style={{textAlign:'center',fontSize:24,letterSpacing:8,fontFamily:'var(--mono)'}} />
                  </div>
                  <button type="submit" className="btn btn-primary" disabled={totpLoading || totpCode.length !== 6}
                    style={{display:'block',width:'auto',minWidth:220,margin:'12px auto 0',textAlign:'center'}}>
                    {totpLoading ? 'Activation…' : 'Activer et se connecter'}
                  </button>
                </form>
              </>
            )}
            <div style={{textAlign:'center',marginTop:12}}>
              <button type="button" onClick={() => { setStep('credentials'); setTotpCode(''); setTotpError(''); setQrData(null); }}
                style={{background:'none',border:'none',cursor:'pointer',fontSize:12,color:'var(--muted)',padding:0}}>
                ← Retour
              </button>
            </div>
          </div>
        )}

      </div>

      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

      {/* Modal changement de mot de passe obligatoire */}
      {mustChangePwd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
          <div style={{ background:'var(--surf)', borderRadius:'var(--rl)', padding:32, width:'100%', maxWidth:400, boxShadow:'0 8px 40px rgba(0,0,0,.5)' }}>
            <div style={{ fontWeight:800, fontSize:18, marginBottom:8 }}>{t('login.change_required')}</div>
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:20 }}>
              {t('login.change_reason')}
            </div>
            {changePwdErr && <div className="alert alert-err" style={{ marginBottom:12, fontSize:12 }}>{changePwdErr}</div>}
            <div className="form-group">
              <label className="form-label">{t('auth.new_pwd_label')} <span style={{ color:'var(--muted)', fontSize:11 }}>{t('login.new_pwd_min')}</span></label>
              <input className="form-control" type="password" value={newPwd}
                onChange={e => setNewPwd(e.target.value)} placeholder="••••••••••••••" autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">{t('login.confirm_pwd')}</label>
              <input className="form-control" type="password" value={newPwd2}
                onChange={e => setNewPwd2(e.target.value)} placeholder="••••••••••••••" />
            </div>
            <button className="btn btn-primary" style={{ width:'100%', marginTop:8 }}
              disabled={changePwdLoading || newPwd.length < 14 || newPwd !== newPwd2}
              onClick={async () => {
                setChangePwdErr('');
                if (newPwd.length < 14) return setChangePwdErr(t('auth.new_pwd_label') ? '14 caractères minimum' : '14 characters minimum');
                if (newPwd !== newPwd2) return setChangePwdErr('Les mots de passe ne correspondent pas.');
                setChangePwdLoading(true);
                try {
                  const r = await fetch('/api/auth/force-change-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${changePwdToken}` },
                    body: JSON.stringify({ new_password: newPwd }),
                  });
                  if (!r.ok) { const d = await r.json(); throw new Error(d.error || 'Erreur'); }
                  login(changePwdToken);
                  setMustChangePwd(false);
                  navigate('/');
                } catch (e2) { setChangePwdErr(e2.message); } finally { setChangePwdLoading(false); }
              }}>
              {changePwdLoading ? t('common.saving') : t('login.set_pwd')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
