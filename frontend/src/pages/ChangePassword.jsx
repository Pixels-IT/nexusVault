import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (nw.length < 14) return setError('Le mot de passe doit contenir au moins 14 caractères');
    if (nw !== confirm) return setError('Les mots de passe ne correspondent pas');
    setLoading(true);
    try {
      await api.changePassword(cur, nw);
      logout();
      navigate('/login?changed=1');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card" style={{ width: 420 }}>
        <div className="login-logo" style={{ marginBottom: 20 }}>
          <img src="/logo-login.png" alt="VaultNexus" style={{ width: '100%', maxWidth: 240, height: 'auto', objectFit: 'contain' }} />
        </div>
        <div className="alert alert-warn" style={{ marginBottom: 16 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>Vous devez changer votre mot de passe par défaut avant de continuer.</span>
        </div>
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-err" style={{ marginBottom: 12 }}>{error}</div>}
          <div className="form-group">
            <label className="form-label">Mot de passe actuel</label>
            <input className="form-control" type="password" value={cur} onChange={e => setCur(e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Nouveau mot de passe <span style={{ color: 'var(--err)' }}>— 14 car. min.</span></label>
            <input className="form-control" type="password" value={nw} onChange={e => setNw(e.target.value)} />
            {nw.length > 0 && (
              <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                {[
                  { ok: nw.length >= 14, label: '14+ car.' },
                  { ok: /[A-Z]/.test(nw), label: 'Majuscule' },
                  { ok: /[0-9]/.test(nw), label: 'Chiffre' },
                  { ok: /[^A-Za-z0-9]/.test(nw), label: 'Symbole' },
                ].map(({ ok, label }) => (
                  <span key={label} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: ok ? 'var(--ok-s)' : 'var(--surf2)', color: ok ? 'var(--ok)' : 'var(--muted)' }}>{label}</span>
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Confirmer</label>
            <input className="form-control" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }} disabled={loading}>
            {loading ? 'Enregistrement…' : 'Enregistrer le mot de passe'}
          </button>
        </form>
      </div>
    </div>
  );
}
