import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Modal, Alert, ConfirmModal } from '../components/UI.jsx';
import { usePerms, invalidatePermsCache } from '../hooks/usePerms.js';

import { ConfigEmbedded } from './Config.jsx';

// ── APPAREILS TAB (encapsule Config.jsx) ─────────────────────────────────────
function AppareilsTab() {
  return <ConfigEmbedded />;
}

// ── MON COMPTE ────────────────────────────────────────────────────────────────
function AccountTab() {
  const { user } = useAuth();
  const [data, setData] = useState({ username: '', display_name: '', email: '' });
  const [pwData, setPwData] = useState({ cur: '', nw: '', confirm: '' });
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  useEffect(() => {
    api.getAccount().then(a => setData({ username: a.username, display_name: a.display_name || '', email: a.email || '' }));
  }, []);

  async function saveProfile(e) {
    e.preventDefault(); setErr(''); setMsg('');
    try { await api.updateAccount(data); setMsg('Profil mis à jour.'); } catch (e) { setErr(e.message); }
  }

  async function savePassword(e) {
    e.preventDefault(); setPwErr(''); setPwMsg('');
    if (pwData.nw.length < 14) return setPwErr('14 caractères minimum');
    if (pwData.nw !== pwData.confirm) return setPwErr('Les mots de passe ne correspondent pas');
    try {
      await api.changePassword(pwData.cur, pwData.nw);
      setPwMsg('Mot de passe modifié. Il vous sera demandé à la prochaine connexion.');
      setPwData({ cur: '', nw: '', confirm: '' });
    } catch (e) { setPwErr(e.message); }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div className="card">
        <div className="card-header"><div className="card-title">Informations du compte</div></div>
        <div style={{ padding: 20 }}>
          {msg && <Alert type="ok">{msg}</Alert>}
          {err && <Alert type="err">{err}</Alert>}
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label className="form-label">Nom affiché</label>
              <input className="form-control" value={data.display_name} onChange={e => setData(d => ({ ...d, display_name: e.target.value }))} placeholder="Votre nom complet" />
            </div>
            <div className="form-group">
              <label className="form-label">Identifiant de connexion</label>
              <input className="form-control" value={data.username} onChange={e => setData(d => ({ ...d, username: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Rôle</label>
              <input className="form-control" value={user?.role || ''} disabled style={{ opacity: .6 }} />
            </div>
            <button className="btn btn-primary" type="submit">Enregistrer</button>
          </form>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Changer le mot de passe</div></div>
        <div style={{ padding: 20 }}>
          {pwMsg && <Alert type="ok">{pwMsg}</Alert>}
          {pwErr && <Alert type="err">{pwErr}</Alert>}
          <form onSubmit={savePassword}>
            <div className="form-group">
              <label className="form-label">Mot de passe actuel</label>
              <input className="form-control" type="password" value={pwData.cur} onChange={e => setPwData(d => ({ ...d, cur: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nouveau mot de passe <span style={{ color: 'var(--err)' }}>— 14 car. min.</span></label>
              <input className="form-control" type="password" value={pwData.nw} onChange={e => setPwData(d => ({ ...d, nw: e.target.value }))} />
              {pwData.nw.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                  {[{ ok: pwData.nw.length >= 14, l: '14+' }, { ok: /[A-Z]/.test(pwData.nw), l: 'MAJ' }, { ok: /[0-9]/.test(pwData.nw), l: '123' }, { ok: /[^A-Za-z0-9]/.test(pwData.nw), l: '!@#' }].map(({ ok, l }) => (
                    <span key={l} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 600, background: ok ? 'var(--ok-s)' : 'var(--surf2)', color: ok ? 'var(--ok)' : 'var(--muted)' }}>{l}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="form-group">
              <label className="form-label">Confirmer</label>
              <input className="form-control" type="password" value={pwData.confirm} onChange={e => setPwData(d => ({ ...d, confirm: e.target.value }))} />
            </div>
            <button className="btn btn-primary" type="submit">Modifier le mot de passe</button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── UTILISATEURS ──────────────────────────────────────────────────────────────
const PERMISSIONS = [
  { key: 'backup_read', label: 'Backups — lecture' },
  { key: 'backup_write', label: 'Backups — écriture' },
  { key: 'config_read', label: 'Configuration — lecture' },
  { key: 'config_write', label: 'Configuration — écriture' },
];

function UserModal({ user, onClose, onSave, isLastAdmin = false }) {
  const isNew = !user?.id;
  const [data, setData] = useState(user ? {
    username: user.username, display_name: user.display_name || '',
    email: user.email || '',
    role: user.role || 'viewer', enabled: user.enabled !== 0,
    permissions: (() => { try { return JSON.parse(user.permissions || '{}'); } catch { return {}; } })(),
    password: ''
  } : { username: '', display_name: '', email: '', role: 'viewer', enabled: true, permissions: {}, password: '' });
  const [error, setError] = useState('');

  const set = k => e => setData(d => ({ ...d, [k]: e.target.value }));
  const togglePerm = k => setData(d => ({ ...d, permissions: { ...d.permissions, [k]: !d.permissions[k] } }));

  async function submit() {
    setError('');
    if (!data.username) return setError('Identifiant requis');
    if (isNew && data.password.length < 14) return setError('Mot de passe: 14 caractères minimum');
    try {
      const payload = { ...data };
      if (!payload.password) delete payload.password;
      if (isNew) await api.createUser(payload);
      else await api.updateUser(user.id, payload);
      onSave();
    } catch (e) { setError(e.message); }
  }

  return (
    <Modal title={isNew ? 'Créer un utilisateur' : 'Modifier l\'utilisateur'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={submit}>Enregistrer</button></>}>
      {error && <Alert type="err">{error}</Alert>}
      <div className="form-row">
        <div className="form-group"><label className="form-label">Identifiant *</label><input className="form-control" value={data.username} onChange={set('username')} autoFocus /></div>
        <div className="form-group"><label className="form-label">Nom affiché</label><input className="form-control" value={data.display_name} onChange={set('display_name')} /></div>
      </div>
      <div className="form-group"><label className="form-label">Adresse e-mail</label><input className="form-control" type="email" value={data.email} onChange={set('email')} placeholder="utilisateur@domaine.com" /></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Rôle</label>
          <select className="form-control" value={data.role} onChange={set('role')}>
            <option value="admin">Administrateur</option>
            <option value="operator">Opérateur</option>
            <option value="viewer">Lecteur</option>
          </select>
        </div>
        <div className="form-group"><label className="form-label">{isNew ? 'Mot de passe *' : 'Nouveau mot de passe'}</label>
          <input className="form-control" type="password" value={data.password} onChange={set('password')} placeholder={isNew ? '14 car. minimum' : 'Laisser vide = inchangé'} />
        </div>
      </div>
      {data.role !== 'admin' && (
        <div className="form-group">
          <label className="form-label">Permissions spécifiques</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6 }}>
            {PERMISSIONS.map(p => (
              <label key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                <input type="checkbox" checked={!!data.permissions[p.key]} onChange={() => togglePerm(p.key)} />
                {p.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {!isNew && (
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isLastAdmin ? 'not-allowed' : 'pointer', fontSize: 12, opacity: isLastAdmin ? .45 : 1 }} title={isLastAdmin ? 'Impossible de désactiver le seul administrateur' : ''}>
            <input type="checkbox" checked={data.enabled} disabled={isLastAdmin} onChange={e => !isLastAdmin && setData(d => ({ ...d, enabled: e.target.checked }))} />
            Compte actif
            {isLastAdmin && <span style={{ fontSize: 10, color: 'var(--warn)', fontStyle: 'italic' }}>(seul admin)</span>}
          </label>
        </div>
      )}
    </Modal>
  );
}

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [adminCount, setAdminCount] = useState(2); // nb admins actifs
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const load = () => {
    api.users().then(setUsers).catch(() => {});
    api.adminCount().then(r => setAdminCount(r.count)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const roleBadge = r => {
    if (r === 'admin') return <span className="badge badge-err">Admin</span>;
    if (r === 'operator') return <span className="badge badge-warn">Opérateur</span>;
    return <span className="badge badge-muted">Lecteur</span>;
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
          Utilisateurs
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Ajouter
        </button>
      </div>
      <table>
        <thead><tr><th>Identifiant</th><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Statut</th><th>Dernière connexion</th><th>Créé le</th><th></th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td className="cell-name">{u.username}</td>
              <td>{u.display_name}</td>
              <td className="cell-sub">{u.email || <span style={{color:'var(--muted)'}}>—</span>}</td>
              <td>{roleBadge(u.role)}</td>
              <td>{u.enabled ? <span className="badge badge-ok"><span className="dot dot-ok" />Actif</span> : <span className="badge badge-muted"><span className="dot dot-muted" />Désactivé</span>}</td>
              <td>
                {u.last_login_at
                  ? <span style={{ fontSize: 12 }}>{u.last_login_at.slice(0, 16).replace('T', ' ')}</span>
                  : <span className="badge badge-muted">Jamais</span>}
              </td>
              <td className="cell-sub">{u.created_at?.slice(0, 10)}</td>
              <td><div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm" onClick={() => setModal(u)}>Modifier</button>
                {!(u.role === 'admin' && adminCount <= 1) && (
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirm(u)}>Suppr.</button>
                )}
              </div></td>
            </tr>
          ))}
          {users.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Aucun utilisateur</td></tr>}
        </tbody>
      </table>
      {modal !== null && <UserModal user={modal.id ? modal : null} isLastAdmin={modal?.role === 'admin' && adminCount <= 1} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {confirm && <ConfirmModal message={`Supprimer l'utilisateur "${confirm.username}" ?`} onConfirm={async () => { await api.deleteUser(confirm.id); setConfirm(null); load(); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ── WHITELIST ─────────────────────────────────────────────────────────────────



// ── DROITS D'ACCÈS PAR RÔLE ───────────────────────────────────────────────────
const PERM_DEFS = [
  {
    section: 'Backups',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
    perms: [
      { key: 'backup_read',   label: 'Consulter les backups' },
      { key: 'backup_write',  label: 'Déclencher un nouveau backup SSH' },
      { key: 'backup_import', label: 'Importer un fichier de backup' },
    ],
  },
  {
    section: 'Appareils',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>,
    perms: [
      { key: 'config_read',  label: 'Consulter sites / modèles / équipements' },
      { key: 'config_write', label: 'Ajouter / modifier / supprimer' },
    ],
  },
  {
    section: "Suivi d'activité",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>,
    perms: [
      { key: 'activity_read',  label: 'Consulter le suivi' },
      { key: 'activity_write', label: 'Ajouter / modifier des notes' },
      { key: 'activity_tags',  label: 'Gérer les tags (créer / supprimer)' },
    ],
  },
  {
    section: 'Administration',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    perms: [
      { key: 'audit_access',    label: "Accès au Journal d'audit" },
      { key: 'security_access', label: 'Accès à Sécurité' },
    ],
  },
];

const ROLES = [
  { key: 'admin',    label: 'Administrateur', color: 'var(--err)',  bg: 'var(--err-s)' },
  { key: 'operator', label: 'Opérateur',      color: 'var(--warn)', bg: 'var(--warn-s)' },
  { key: 'viewer',   label: 'Utilisateur',    color: 'var(--muted)', bg: 'var(--surf2)' },
];

function RolePermissionsCard() {
  const [perms, setPerms] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.getRolePerms().then(data => setPerms(data)).catch(() => {});
  }, []);

  function toggle(role, perm) {
    if (role === 'admin') return; // admin a toujours tout
    setPerms(p => ({
      ...p,
      [role]: { ...p[role], [perm]: !p[role]?.[perm] },
    }));
  }

  async function save() {
    setSaving(true); setMsg('');
    try {
      await api.saveRolePerms(perms);
      invalidatePermsCache();
      setMsg('Droits enregistrés. Les changements prennent effet à la prochaine connexion.');
    } catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  if (!perms) return <div style={{ padding: 16, textAlign: 'center' }}><span className="spinner" /></div>;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          Droits d'accès par rôle
        </div>
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
      </div>

      {msg && (
        <div style={{ padding: '8px 18px', fontSize: 12, color: msg.startsWith('Erreur') ? 'var(--err)' : 'var(--ok)', borderBottom: '1px solid var(--brd)', background: msg.startsWith('Erreur') ? 'var(--err-s)' : 'var(--ok-s)' }}>
          {msg}
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--surf2)' }}>
              <th style={{ padding: '10px 18px', textAlign: 'left', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--muted)', borderBottom: '1px solid var(--brd)', width: '40%' }}>Permission</th>
              {ROLES.map(r => (
                <th key={r.key} style={{ padding: '10px 16px', textAlign: 'center', borderBottom: '1px solid var(--brd)' }}>
                  <span style={{ display: 'inline-block', background: r.bg, color: r.color, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>{r.label}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERM_DEFS.map((section, si) => (
              <>
                {/* En-tête de section */}
                <tr key={`sec-${si}`} style={{ background: 'var(--surf2)' }}>
                  <td colSpan={ROLES.length + 1} style={{ padding: '7px 18px', fontSize: 11, fontWeight: 700, color: 'var(--txt)', borderTop: si > 0 ? '2px solid var(--brd)' : 'none', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {section.icon}
                    {section.section}
                  </td>
                </tr>
                {section.perms.map(perm => (
                  <tr key={perm.key} style={{ borderBottom: '1px solid var(--brd)' }}>
                    <td style={{ padding: '9px 18px 9px 32px', fontSize: 12, color: 'var(--txt)' }}>{perm.label}</td>
                    {ROLES.map(r => {
                      const isAdmin = r.key === 'admin';
                      const checked = isAdmin ? true : !!(perms[r.key]?.[perm.key]);
                      return (
                        <td key={r.key} style={{ textAlign: 'center', padding: '9px 16px' }}>
                          <label style={{ cursor: isAdmin ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isAdmin}
                              onChange={() => toggle(r.key, perm.key)}
                              style={{ width: 16, height: 16, cursor: isAdmin ? 'not-allowed' : 'pointer' }}
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 18px', fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--brd)' }}>
        Les droits de l'administrateur sont permanents et ne peuvent pas être modifiés. Les changements prennent effet à la prochaine connexion des utilisateurs concernés.
      </div>
    </div>
  );
}

// ── SÉCURITÉ (timeout + liste accès) ────────────────────────────────────────
function SecurityTab() {
  // ── Timeout de session ──
  const [timeout, setTimeout_] = useState('30');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.getSettings().then(s => setTimeout_(s.session_timeout_minutes || '30')).catch(() => {});
  }, []);

  async function saveTimeout(e) {
    e.preventDefault(); setSaving(true); setMsg('');
    try {
      await api.updateSettings({ session_timeout_minutes: parseInt(timeout) });
      setMsg('Paramètres enregistrés.');
    } catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  // ── Liste accès ──
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ value: '', label: '', type: 'ip' });
  const [wlError, setWlError] = useState('');
  const [confirm, setConfirm] = useState(null);

  const loadWl = () => api.whitelist().then(setRows).catch(() => {});
  useEffect(() => { loadWl(); }, []);

  async function addRule(e) {
    e.preventDefault(); setWlError('');
    if (!form.value) return setWlError('Valeur requise');
    try { await api.createWhitelist(form); setForm({ value: '', label: '', type: 'ip' }); loadWl(); }
    catch (e) { setWlError(e.message); }
  }

  async function toggleRule(r) {
    await api.updateWhitelist(r.id, { ...r, enabled: !r.enabled });
    loadWl();
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Timeout de session ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            Timeout de session
          </div>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Durée d’inactivité avant déconnexion automatique. Une alerte s’affiche 60 s avant l’expiration.
          </p>
          {msg && <div className={`alert ${msg.startsWith('Erreur') ? 'alert-err' : 'alert-ok'}`} style={{ marginBottom: 12 }}>{msg}</div>}
          <form onSubmit={saveTimeout} style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Durée d’inactivité (minutes)</label>
              <select className="form-control" value={timeout} onChange={e => setTimeout_(e.target.value)}>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 heure</option>
                <option value="120">2 heures</option>
                <option value="240">4 heures</option>
                <option value="480">8 heures</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </form>
        </div>
      </div>

      {/* ── Liste d'accès ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Liste d’accès IP / URL
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="alert alert-warn" style={{ marginBottom: 14 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>Liste vide = tous les accès sont autorisés. Dès qu'une règle est active, seules les adresses listées peuvent accéder.</span>
          </div>
          {wlError && <div className="alert alert-err">{wlError}</div>}
          <form onSubmit={addRule} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <select className="form-control" style={{ width: 90 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="ip">IP</option>
              <option value="url">URL</option>
            </select>
            <input className="form-control" style={{ flex: 1, minWidth: 160 }} value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder={form.type === 'ip' ? '192.168.1.0' : 'https://mon-domaine.com'} />
            <input className="form-control" style={{ flex: 1, minWidth: 120 }} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Description (optionnel)" />
            <button className="btn btn-primary" type="submit">Ajouter</button>
          </form>
          <table>
            <thead><tr><th>Type</th><th>Valeur</th><th>Label</th><th>Statut</th><th>Ajouté le</th><th></th></tr></thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td><span className={`badge ${r.type === 'ip' ? 'badge-info' : 'badge-warn'}`}>{r.type.toUpperCase()}</span></td>
                  <td><span className="cell-mono">{r.value}</span></td>
                  <td className="cell-sub">{r.label}</td>
                  <td>
                    <button onClick={() => toggleRule(r)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      {r.enabled
                        ? <span className="badge badge-ok"><span className="dot dot-ok"/>Actif</span>
                        : <span className="badge badge-muted"><span className="dot dot-muted"/>Inactif</span>}
                    </button>
                  </td>
                  <td className="cell-sub">{r.created_at?.slice(0, 10)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => setConfirm(r)}>Suppr.</button></td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucune règle — tous les accès sont autorisés</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {/* ── Droits d'accès par rôle ── */}
      <RolePermissionsCard />

      {confirm && <ConfirmModal message={`Supprimer la règle "${confirm.value}" ?`}
        onConfirm={async () => { await api.deleteWhitelist(confirm.id); setConfirm(null); loadWl(); }}
        onCancel={() => setConfirm(null)} />}
    </div>
  );
}


// ── TAGS SUIVI D'ACTIVITÉ ──────────────────────────────────────────────────────
const TAG_PRESETS = ['#d63939','#066fd1','#2fb344','#f76707','#7c3aed','#0f9e73','#e91e8c','#c2410c','#677489','#0891b2','#ca8a04'];

function ActivityTagsTab() {
  const [tags, setTags]       = useState([]);
  const [form, setForm]       = useState({ code: '', label: '', color: '#066fd1' });
  const [editTag, setEditTag] = useState(null);
  const [error, setError]     = useState('');
  const [confirm, setConfirm] = useState(null);

  const load = () => api.activityTags().then(setTags).catch(() => {});
  useEffect(() => { load(); }, []);

  async function addTag(e) {
    e.preventDefault(); setError('');
    if (!form.code || !form.label) return setError('Code et libellé requis');
    try { await api.createTag(form); setForm({ code: '', label: '', color: '#066fd1' }); load(); }
    catch (e) { setError(e.message); }
  }

  async function saveEdit() {
    await api.updateTag(editTag.id, { label: editTag.label, color: editTag.color });
    setEditTag(null); load();
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          Tags de suivi
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 14 }}>
          Les tags permettent de catégoriser les notes d'activité. Le code doit être court et en majuscules.
        </p>
        {error && <div className="alert alert-err" style={{ marginBottom: 12 }}>{error}</div>}
        <form onSubmit={addTag} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Code</label>
            <input className="form-control" style={{ width: 90 }} value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'') }))}
              placeholder="SECU" maxLength={10} />
          </div>
          <div className="form-group" style={{ margin: 0, flex: 1 }}>
            <label className="form-label">Libellé</label>
            <input className="form-control" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Sécurité" />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Couleur</label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                style={{ width: 36, height: 32, padding: 2, border: '1px solid var(--brd)', borderRadius: 4, cursor: 'pointer', background: 'none' }} />
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', maxWidth: 120 }}>
                {TAG_PRESETS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    style={{ width: 16, height: 16, borderRadius: '50%', background: c, border: form.color === c ? '2px solid var(--txt)' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                ))}
              </div>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" style={{ marginBottom: 0 }}>Ajouter</button>
        </form>

        <table>
          <thead><tr><th>Aperçu</th><th>Code</th><th>Libellé</th><th>Couleur</th><th></th></tr></thead>
          <tbody>
            {tags.map(t => (
              <tr key={t.id}>
                <td>
                  <span style={{
                    display: 'inline-block', background: `rgba(${parseInt(t.color.slice(1,3),16)},${parseInt(t.color.slice(3,5),16)},${parseInt(t.color.slice(5,7),16)},0.12)`,
                    color: t.color, border: `1px solid ${t.color}`,
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)'
                  }}>{t.code}</span>
                </td>
                <td style={{ fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{t.code}</td>
                <td style={{ fontSize: 12 }}>
                  {editTag?.id === t.id
                    ? <input className="form-control" style={{ padding: '4px 8px', fontSize: 12 }} value={editTag.label} onChange={e => setEditTag(x => ({ ...x, label: e.target.value }))} />
                    : t.label}
                </td>
                <td>
                  {editTag?.id === t.id
                    ? <input type="color" value={editTag.color} onChange={e => setEditTag(x => ({ ...x, color: e.target.value }))}
                        style={{ width: 36, height: 28, padding: 2, border: '1px solid var(--brd)', borderRadius: 4, cursor: 'pointer' }} />
                    : <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: t.color, verticalAlign: 'middle' }} />}
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {editTag?.id === t.id
                      ? <><button className="btn btn-sm btn-primary" onClick={saveEdit}>OK</button><button className="btn btn-sm" onClick={() => setEditTag(null)}>Annuler</button></>
                      : <><button className="btn btn-sm" onClick={() => setEditTag({ ...t })}>Édit.</button><button className="btn btn-sm btn-danger" onClick={() => setConfirm(t)}>Suppr.</button></>
                    }
                  </div>
                </td>
              </tr>
            ))}
            {tags.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucun tag</td></tr>}
          </tbody>
        </table>
      </div>
      {confirm && <ConfirmModal message={`Supprimer le tag "${confirm.code}" ?`}
        onConfirm={async () => { await api.deleteTag(confirm.id); setConfirm(null); load(); }}
        onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ── AUDIT ─────────────────────────────────────────────────────────────────────
const SEV = {
  info:  { label: 'Info',    bg: 'var(--acc-s)',  color: 'var(--acc)',  dot: '#4c9fe6' },
  warn:  { label: 'Alerte',  bg: 'var(--warn-s)', color: 'var(--warn)', dot: '#f76707' },
  error: { label: 'Erreur',  bg: 'var(--err-s)',  color: 'var(--err)',  dot: '#d63939' },
};
const CAT_COLORS = {
  auth:     { bg: '#f0e6ff', color: '#7c3aed' },
  admin:    { bg: 'var(--warn-s)', color: 'var(--warn)' },
  backup:   { bg: 'var(--acc-s)', color: 'var(--acc)' },
  config:   { bg: 'var(--ok-s)', color: 'var(--ok)' },
  sécurité: { bg: 'var(--err-s)', color: 'var(--err)' },
};

function AuditTab() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ category: '', severity: '', limit: '200' });

  const load = () => {
    setLoading(true);
    const p = {};
    if (filters.category) p.category = filters.category;
    if (filters.severity) p.severity = filters.severity;
    if (filters.limit) p.limit = filters.limit;
    api.audit(p).then(setLogs).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const sf = k => e => setFilters(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
          Journal d'audit
        </div>
        <div className="filters">
          <select value={filters.severity} onChange={sf('severity')}>
            <option value="">Toutes sévérités</option>
            <option value="info">Info</option>
            <option value="warn">Alerte</option>
            <option value="error">Erreur</option>
          </select>
          <select value={filters.category} onChange={sf('category')}>
            <option value="">Toutes catégories</option>
            <option value="auth">Authentification</option>
            <option value="admin">Administration</option>
            <option value="backup">Backups</option>
            <option value="config">Configuration</option>
            <option value="sécurité">Sécurité</option>
          </select>
          <select value={filters.limit} onChange={sf('limit')}>
            <option value="50">50 entrées</option>
            <option value="200">200 entrées</option>
            <option value="500">500 entrées</option>
          </select>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th style={{ width: 140 }}>Date</th><th style={{ width: 90 }}>Sévérité</th><th style={{ width: 110 }}>Catégorie</th><th>Action</th><th>Utilisateur</th><th>Détail</th><th style={{ width: 80 }}>Résultat</th></tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}><span className="spinner" /></td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Aucune entrée</td></tr>}
            {logs.map(l => {
              const sev = SEV[l.severity] || SEV.info;
              const cat = CAT_COLORS[l.category] || { bg: 'var(--surf2)', color: 'var(--muted)' };
              return (
                <tr key={l.id} style={{ borderLeft: `3px solid ${sev.dot}` }}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                    {l.created_at?.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: sev.bg, color: sev.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sev.dot, flexShrink: 0 }} />
                      {sev.label}
                    </span>
                  </td>
                  <td>
                    <span style={{ display: 'inline-block', background: cat.bg, color: cat.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {l.category}
                    </span>
                  </td>
                  <td style={{ fontWeight: 600, fontSize: 12 }}>{l.action}</td>
                  <td style={{ fontSize: 12 }}>{l.username || '—'}</td>
                  <td style={{ fontSize: 11, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.detail}>
                    <span style={{ color: l.success === 0 && l.detail?.includes('Identifiant tenté') ? 'var(--err)' : 'var(--muted)' }}>
                      {l.detail}
                    </span>
                  </td>
                  <td>
                    {l.success ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--ok)', fontSize: 11, fontWeight: 600 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg> OK
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--err)', fontSize: 11, fontWeight: 600 }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> Échec
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── PAGE ADMIN ────────────────────────────────────────────────────────────────
// sep = séparateur visuel dans le menu
const TABS = [
  { key: 'account',       label: 'Mon compte',       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { key: '__sep1__',      sep: true },
  { key: 'appareils',     label: 'Appareils',         icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg> },
  { key: 'activity_tags', label: "Suivi d'activité", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> },
  { key: '__sep2__',      sep: true },
  { key: 'users',         label: 'Utilisateurs',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { key: 'security',      label: "Sécurité",           icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  { key: 'audit',         label: "Journal d'audit",   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
];

export default function Admin() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const active = sp.get('tab') || 'account';
  const isAdmin = user?.role === 'admin';

  const { can } = usePerms();
  const visibleTabs = TABS.filter(t => {
    if (t.sep) return true; // séparateurs toujours inclus (masqués si voisins cachés)
    if (t.key === 'account') return true;
    if (t.key === 'appareils') return true;
    if (t.key === 'activity_tags') return isAdmin;
    if (t.key === 'users') return isAdmin;
    if (t.key === 'security') return isAdmin || can('security_access');
    if (t.key === 'audit') return isAdmin || can('audit_access');
    return isAdmin;
  });

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Administration</div>
          <div className="page-sub">Gestion des accès, utilisateurs et audit</div>
        </div>
      </div>
      <div className="config-layout">
        <div className="side-menu">
          {visibleTabs.map((t, i) => {
            if (t.sep) {
              // Masquer le séparateur s'il est en premier, dernier, ou entouré d'autres séparateurs
              const prev = visibleTabs[i - 1];
              const next = visibleTabs[i + 1];
              if (!prev || !next || prev.sep || next.sep) return null;
              return (
                <div key={t.key} style={{ margin: '6px 14px', borderTop: '1px solid var(--brd)', opacity: .5 }} />
              );
            }
            return (
              <div key={t.key} className={`side-item ${active === t.key ? 'active' : ''}`} onClick={() => setSp({ tab: t.key })}>
                {t.icon}{t.label}
              </div>
            );
          })}
        </div>
        <div>
          {active === 'account' && <AccountTab />}
          {active === 'appareils' && <AppareilsTab />}
          {active === 'users' && isAdmin && <UsersTab />}
          {active === 'security' && (isAdmin || can('security_access')) && <SecurityTab />}
          {active === 'activity_tags' && isAdmin && <ActivityTagsTab />}
          {active === 'audit' && (isAdmin || can('audit_access')) && <AuditTab />}
        </div>
      </div>
    </main>
  );
}
