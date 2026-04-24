import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext.jsx';
import LangSwitcher from './LangSwitcher.jsx';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { usePerms } from '../hooks/usePerms.js';

function UserMenu({ user, logout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  // Fermer si clic en dehors
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayName = user?.displayName || user?.username || '?';
  const initial = displayName[0].toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="user-menu-trigger"
        onClick={() => setOpen(o => !o)}
        title="Mon compte"
      >
        <div className="avatar">{initial}</div>
        <span className="user-menu-name">{displayName}</span>
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ width: 12, height: 12, color: 'var(--muted)', transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="user-dropdown">
          {/* En-tête du dropdown */}
          <div className="user-dropdown-header">
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--txt)' }}>{displayName}</div>
            {user?.email && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{user.email}</div>}
            <div style={{ marginTop: 4 }}>
              <span className={`badge ${user?.role === 'admin' ? 'badge-err' : user?.role === 'operator' ? 'badge-warn' : 'badge-muted'}`} style={{ fontSize: 10 }}>
                {user?.role === 'admin' ? 'Administrateur' : user?.role === 'operator' ? 'Opérateur' : 'Lecteur'}
              </span>
            </div>
          </div>

          <div className="user-dropdown-divider" />

          {/* Mon Profil */}
          <button
            className="user-dropdown-item"
            onClick={() => { setOpen(false); navigate('/admin?tab=account'); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Mon profil
          </button>

          <div className="user-dropdown-divider" />

          {/* Déconnexion */}
          <button
            className="user-dropdown-item user-dropdown-item--danger"
            onClick={() => { setOpen(false); logout(); }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const { dark, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const { can } = usePerms();

  return (
    <nav className="navbar">
      <div className="navbar-inner">

        {/* GAUCHE — logo */}
        <div className="nav-brand">
          <img src="/logo-nav.png" alt="NexusVault" />
        </div>

        {/* CENTRE — liens */}
        <div className="nav-items">
          <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
            </svg>
            {t('nav.dashboard')}
          </NavLink>
          <NavLink to="/backups" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {t('nav.backups')}
          </NavLink>

          <NavLink to="/scripts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
            {t('nav.scripts')}
          </NavLink>
          {(can('activity_read') || can('activity_write')) && <NavLink to="/activity" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
              <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
            </svg>
            {t('nav.activity')}
          </NavLink>}
          <NavLink to="/admin" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            {t('nav.admin')}
          </NavLink>
        </div>

        {/* DROITE — toggle thème + menu utilisateur */}
        <div className="nav-right">
          <button
            className={`theme-toggle ${dark ? 'on' : ''}`}
            onClick={toggle}
            title={dark ? 'Mode clair' : 'Mode sombre'}
          />
          <LangSwitcher />
          <UserMenu user={user} logout={logout} />
        </div>

      </div>
    </nav>
  );
}
