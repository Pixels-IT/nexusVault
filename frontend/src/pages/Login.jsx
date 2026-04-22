import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useTheme } from '../contexts/ThemeContext.jsx';
import api from '../api.js';

// Version du logiciel : date de build au format AAAA-MM-JJ
const APP_VERSION = '2026-04-22_b3.8';

export default function Login() {
  const { login } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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
            alt="VaultNexus"
            style={{ width: '100%', maxWidth: 320, height: 'auto', objectFit: 'contain' }}
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
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        {/* Version */}
        <div className="login-version">
          v{APP_VERSION}
        </div>
      </div>
    </div>
  );
}
