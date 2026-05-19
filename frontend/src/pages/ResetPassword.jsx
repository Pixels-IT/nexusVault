import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useI18n } from '../contexts/I18nContext.jsx';
import { APP_VERSION } from '../version.js';

export default function ResetPassword() {
  const { t } = useI18n();
  const [params]    = useSearchParams();
  const token       = params.get('token');

  // Étape 1 : demande (pas de token)
  // Étape 2 : saisie nouveau mot de passe (token présent + valide)
  const [step,        setStep]        = useState(token ? 'check' : 'request');
  const [tokenValid,  setTokenValid]  = useState(false);
  const [username,    setUsername]    = useState('');
  const [password,    setPassword]    = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [loading,     setLoading]     = useState(false);
  const [msg,         setMsg]         = useState('');
  const [err,         setErr]         = useState('');

  // Vérifier la validité du token au chargement
  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api.checkResetToken(token)
      .then(r => {
        setTokenValid(r.valid);
        setStep(r.valid ? 'reset' : 'invalid');
      })
      .catch(() => setStep('invalid'))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleRequest(e) {
    e.preventDefault();
    if (!username.trim()) return setErr('Identifiant requis');
    setLoading(true); setErr(''); setMsg('');
    try {
      await api.forgotPassword(username.trim());
      setMsg('Si un compte avec cet identifiant existe et qu\'une adresse email est configurée, un lien de réinitialisation vous a été envoyé.');
      setStep('sent');
    } catch {
      setMsg('Une erreur est survenue. Veuillez réessayer.');
    }
    finally { setLoading(false); }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (password.length < 14) return setErr('Le mot de passe doit faire au moins 14 caractères');
    if (password !== confirm) return setErr('Les mots de passe ne correspondent pas');
    setLoading(true); setErr(''); setMsg('');
    try {
      await api.resetPassword(token, password);
      setMsg('Mot de passe modifié avec succès !');
      setStep('done');
    } catch(e) { setErr(e.message || t('auth.invalid_token')); }
    finally { setLoading(false); }
  }

  const pwChecks = [
    { ok: password.length >= 14,          l: '14+' },
    { ok: /[A-Z]/.test(password),         l: 'MAJ' },
    { ok: /[0-9]/.test(password),         l: '123' },
    { ok: /[^A-Za-z0-9]/.test(password),  l: '!@#' },
  ];

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Logo */}
        <div className="login-logo">
          <img src="/logo-login.png" alt="NexusVault"
            style={{ width: '100%', maxWidth: 440, height: 'auto', objectFit: 'contain' }} />
        </div>

        {/* Contenu selon l'étape */}
        {step === 'check' && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--muted)', fontSize: 13 }}>
            t('auth.checking')
          </div>
        )}

        {step === 'request' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>{t('auth.forgot_title')}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('auth.forgot_desc')}</div>
            </div>
            {err && <div className="alert alert-err" style={{ marginBottom: 14 }}>{err}</div>}
            <form onSubmit={handleRequest}>
              <div className="form-group">
                <label className="form-label">IDENTIFIANT</label>
                <input className="form-control" value={username} onChange={e => setUsername(e.target.value)}
                  placeholder="Votre identifiant" autoFocus />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', marginTop: 14, justifyContent: 'center', padding: '10px 14px', fontSize: 13 }}>
                {loading ? t('auth.sending') : 'Envoyer le lien'}
              </button>
            </form>
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <a href="/login" style={{ fontSize: 12, color: 'var(--muted)', textDecoration: 'none' }}
                onMouseEnter={e => e.target.style.color='var(--acc)'}
                onMouseLeave={e => e.target.style.color='var(--muted)'}>
                t('auth.back_login')
              </a>
            </div>
          </>
        )}

        {step === 'sent' && (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2"
              style={{ width: 40, height: 40, margin: '0 auto 12px', display: 'block' }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)', marginBottom: 10 }}>{t('auth.sent_title')}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>{msg}</div>
            <a href="/login" className="btn btn-primary"
              style={{ display: 'inline-flex', marginTop: 20, padding: '9px 24px', textDecoration: 'none', justifyContent: 'center' }}>
              Retour à la connexion
            </a>
          </div>
        )}

        {step === 'invalid' && (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--err)" strokeWidth="2"
              style={{ width: 40, height: 40, margin: '0 auto 12px', display: 'block' }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--err)', marginBottom: 10 }}>{t('auth.invalid_token')}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{t('auth.invalid_desc')}</div>
            <a href="/reset-password"
              style={{ fontSize: 13, color: 'var(--acc)', textDecoration: 'none', fontWeight: 600 }}>
              t('auth.new_request')
            </a>
          </div>
        )}

        {step === 'reset' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--txt)', marginBottom: 6 }}>{t('auth.new_pwd')}</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('auth.new_pwd_desc')}</div>
            </div>
            {err && <div className="alert alert-err" style={{ marginBottom: 14 }}>{err}</div>}
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label className="form-label">NOUVEAU MOT DE PASSE</label>
                <input className="form-control" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} autoFocus />
                {password.length > 0 && (
                  <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                    {pwChecks.map(({ ok, l }) => (
                      <span key={l} style={{
                        fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                        background: ok ? 'var(--ok-s)' : 'var(--surf2)',
                        color: ok ? 'var(--ok)' : 'var(--muted)',
                      }}>{l}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label">CONFIRMER</label>
                <input className="form-control" type="password" value={confirm}
                  onChange={e => setConfirm(e.target.value)} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', marginTop: 14, justifyContent: 'center', padding: '10px 14px', fontSize: 13 }}>
                {loading ? t('auth.saving') : t('auth.save_pwd')}
              </button>
            </form>
          </>
        )}

        {step === 'done' && (
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2"
              style={{ width: 40, height: 40, margin: '0 auto 12px', display: 'block' }}>
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--txt)', marginBottom: 10 }}>{t('auth.success_title')}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>{t('auth.success_desc')}</div>
            <a href="/login" className="btn btn-primary"
              style={{ display: 'inline-flex', padding: '9px 24px', textDecoration: 'none', justifyContent: 'center' }}>
              t('auth.go_login')
            </a>
          </div>
        )}

        <div className="login-version">v{APP_VERSION}</div>
      </div>
    </div>
  );
}
