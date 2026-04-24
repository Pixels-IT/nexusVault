import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { Modal, Alert, ConfirmModal, Spinner } from '../components/UI.jsx';
import PersonnalisationPage from './Personnalisation.jsx';
import { usePerms, invalidatePermsCache } from '../hooks/usePerms.js';

import { ConfigEmbedded } from './Config.jsx';

// ── APPAREILS TAB (encapsule Config.jsx) ─────────────────────────────────────
function AppareilsTab() {
  return <ConfigEmbedded />;
}

// ── PERSONNALISATION ─────────────────────────────────────────────────────────
function PersonnalisationTab() {
  return <PersonnalisationPage embedded />;
}

// ── SCRIPTS ADMIN TAB ────────────────────────────────────────────────────────
function ScriptsAdminTab() {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'60px 20px', gap:14, background:'var(--surf)', border:'2px dashed var(--brd)', borderRadius:'var(--rl)' }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.5" style={{ width:48, height:48 }}>
        <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
      </svg>
      <div style={{ fontWeight:700, fontSize:15, color:'var(--txt)' }}>Gestion des scripts</div>
      <div style={{ fontSize:13, color:'var(--muted)', textAlign:'center', maxWidth:400 }}>
        Cette section permettra de gérer les fichiers de scripts hébergés dans NexusVault.
      </div>
      <span style={{ fontSize:11, fontWeight:700, color:'var(--warn)', background:'var(--warn-s)',
        border:'1px solid var(--warn)', borderRadius:4, padding:'3px 10px', letterSpacing:'.4px' }}>
        BIENTÔT DISPONIBLE
      </span>
    </div>
  );
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
              <label className="form-label">Adresse e-mail</label>
              <input className="form-control" type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="utilisateur@domaine.com" />
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
    username: user.username,
    display_name: user.display_name || '',
    email: user.email || '',
    role: user.role || 'viewer',
    enabled: user.enabled !== 0,
    password: '',
  } : {
    username: '', display_name: '', email: '', role: 'viewer', enabled: true, password: '',
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = k => e => setData(d => ({ ...d, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!data.username.trim()) return setError('Identifiant requis');
    if (!data.email.trim())    return setError('Adresse e-mail obligatoire');
    if (!isNew && data.password && data.password.length < 14)
      return setError('Mot de passe : 14 caractères minimum');
    setLoading(true);
    try {
      if (isNew) {
        // Création sans mot de passe : le backend envoie le lien d'initialisation par email
        await api.createUser({
          username: data.username.trim(),
          display_name: data.display_name.trim() || data.username.trim(),
          email: data.email.trim(),
          role: data.role,
        });
      } else {
        const payload = { ...data };
        if (!payload.password) delete payload.password;
        delete payload.permissions;
        await api.updateUser(user.id, payload);
      }
      onSave();
    } catch (e) { setError(e.message); setLoading(false); }
  }

  return (
    <Modal
      title={isNew ? 'Créer un utilisateur' : "Modifier l'utilisateur"}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? '…' : isNew ? 'Créer' : 'Modifier'}
          </button>
        </>
      }
    >
      {error && <Alert type="err">{error}</Alert>}

      {/* Info création : lien d'init envoyé par email */}
      {isNew && (
        <div className="alert alert-warn" style={{ marginBottom: 14, fontSize: 12, textAlign: 'center', justifyContent: 'center' }}>
          Un lien d'initialisation du mot de passe sera envoyé à l'adresse e-mail renseignée.
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Identifiant *</label>
          <input className="form-control" value={data.username} onChange={set('username')} autoFocus disabled={!isNew} />
        </div>
        <div className="form-group">
          <label className="form-label">Nom affiché</label>
          <input className="form-control" value={data.display_name} onChange={set('display_name')} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Adresse e-mail *</label>
        <input className="form-control" type="email" value={data.email} onChange={set('email')}
          placeholder="utilisateur@domaine.com" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Rôle</label>
          <select className="form-control" value={data.role} onChange={set('role')}>
            <option value="admin">Administrateur</option>
            <option value="operator">Opérateur</option>
            <option value="viewer">Lecteur</option>
          </select>
        </div>
        {/* Mot de passe uniquement en mode édition */}
        {!isNew && (
          <div className="form-group">
            <label className="form-label">Nouveau mot de passe</label>
            <input className="form-control" type="password" value={data.password}
              onChange={set('password')} placeholder="(laisser vide = inchangé)" />
          </div>
        )}
      </div>

      {/* Compte actif : uniquement en mode édition */}
      {!isNew && (
        <div className="form-group">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8,
            cursor: isLastAdmin ? 'not-allowed' : 'pointer' }}>
            <input type="checkbox" checked={data.enabled} disabled={isLastAdmin}
              onChange={e => setData(d => ({ ...d, enabled: e.target.checked }))} />
            Compte actif
            {isLastAdmin && (
              <span style={{ fontSize: 10, color: 'var(--warn)', fontStyle: 'italic' }}>
                Dernier admin — non désactivable
              </span>
            )}
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
              <td>
                {u.locked_until && new Date(u.locked_until.replace(' ','T')) > new Date()
                  ? <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span className="badge badge-err" title={`Verrouillé jusqu'à ${u.locked_until}`}>
                        <span className="dot" style={{ background:'var(--err)' }}/>Verrouillé
                      </span>
                      <button className="btn btn-sm" style={{ borderColor:'var(--warn)', color:'var(--warn)', padding:'1px 6px', fontSize:10 }}
                        onClick={async () => { await api.unlockUser(u.id); load(); }}
                        title="Débloquer le compte">
                        Débloquer
                      </button>
                    </div>
                  : u.enabled
                    ? <span className="badge badge-ok"><span className="dot dot-ok" />Actif</span>
                    : <span className="badge badge-muted"><span className="dot dot-muted" />Désactivé</span>
                }
              </td>
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
      { key: 'backup_read',    label: 'Consulter les backups' },
      { key: 'backup_write',   label: 'Déclencher un nouveau backup SSH' },
      { key: 'backup_import',  label: 'Importer un fichier de backup' },
      { key: 'backup_compare', label: 'Comparer les backups' },
    ],
  },
  {
    section: 'Menu Configuration Appareils',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>,
    perms: [
      { key: 'config_read',  label: 'Consulter (menu Admin → Appareils)' },
      { key: 'config_write', label: 'Configuration : Ajouter / modifier / supprimer' },
    ],
  },
  {
    section: 'Menu Configuration Scripts',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
    perms: [
      { key: 'scripts_admin', label: 'Consulter (menu Admin → Scripts)' },
    ],
  },
  {
    section: 'Scripts',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
    perms: [
      { key: 'scripts_read', label: 'Consulter les scripts' },
      { key: 'scripts_exec', label: 'Exécuter les scripts' },
    ],
  },
  {
    section: "Suivi d'activité",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>,
    perms: [
      { key: 'activity_write', label: 'Ajouter / modifier ses propres notes' },
      { key: 'activity_read',  label: 'Consulter le suivi des autres utilisateurs' },
      { key: 'activity_tags',  label: "Consulter (menu Admin \u2192 Tags d'activit\u00e9)" },
    ],
  },
  {
    section: 'Administration',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    perms: [
      { key: 'audit_access',    label: "Accès au Journal d'audit" },
      { key: 'audit_archive',   label: "Accès aux archives d'audit" },
      { key: 'security_access', label: 'Accès à Sécurité' },
    ],
  },
];

const ROLES = [
  { key: 'admin',    label: 'Administrateur', color: 'var(--err)',  bg: 'var(--err-s)' },
  { key: 'operator', label: 'Opérateur',      color: 'var(--warn)', bg: 'var(--warn-s)' },
  { key: 'viewer',   label: 'Utilisateur',    color: 'var(--acc)',   bg: 'var(--acc-s)' },
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
      setMsg('Droits enregistrés. Rechargement en cours…');
      setTimeout(() => { window.location.href = window.location.pathname + '?tab=security&subtab=rights'; }, 1000);
    } catch (e) { setMsg('Erreur : ' + e.message); setSaving(false); }
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
  const defaultTab = new URLSearchParams(window.location.search).get('subtab') || 'general';
  const [activeTab, setActiveTab] = useState(defaultTab);

  const TABS = [
    { key: 'general',  label: 'Général',           icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg> },
    { key: 'cron',     label: 'Planificateur',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> },
    { key: 'oidc',     label: 'Authentification',   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg> },
    { key: 'notifs',   label: 'Notifications',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
    { key: 'rights',   label: "Droits d'accès",     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  ];

  return (
    <div>
      {/* Tabs horizontaux */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--brd)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === t.key ? '2px solid var(--acc)' : '2px solid transparent',
            color: activeTab === t.key ? 'var(--acc)' : 'var(--muted)',
            fontWeight: activeTab === t.key ? 600 : 500,
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
            marginBottom: -1, transition: 'color .15s, border-color .15s',
          }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {activeTab === 'general'  && <SecurityGeneralTab />}
      {activeTab === 'cron'     && <SecurityCronTab />}
      {activeTab === 'oidc'     && <SecurityOidcTab />}
      {activeTab === 'notifs'   && <SecurityNotifTab />}
      {activeTab === 'rights'   && <RolePermissionsCard />}
    </div>
  );
}

// ── ONGLET GÉNÉRAL : Timeout + Liste d'accès ─────────────────────────────────
function SecurityGeneralTab() {
  const [timeout, setTimeout_] = useState('30');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [rows, setRows]         = useState([]);
  const [form, setForm]         = useState({ value: '', label: '', type: 'ip' });
  const [wlError, setWlError]   = useState('');
  const [confirm, setConfirm]   = useState(null);
  const [appUrl, setAppUrl]       = useState('');
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlMsg, setUrlMsg]       = useState('');

  useEffect(() => {
    api.getSettings().then(s => setTimeout_(s.session_timeout_minutes || '30')).catch(() => {});
    api.smtpConfig().then(s => setAppUrl(s.app_url || '')).catch(() => {});
  }, []);

  const loadWl = () => api.whitelist().then(setRows).catch(() => {});
  useEffect(() => {
    loadWl();
  }, []);






  async function saveAppUrl() {
    setUrlSaving(true); setUrlMsg('');
    try {
      await api.smtpSave({ app_url: appUrl });
      setUrlMsg('Enregistré.');
    } catch { setUrlMsg('Erreur.'); }
    finally { setUrlSaving(false); }
  }

  async function saveTimeout(e) {
    e.preventDefault(); setSaving(true); setMsg('');
    try { await api.updateSettings({ session_timeout_minutes: parseInt(timeout) }); setMsg('Enregistré.'); }
    catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

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
      {/* Grille : Timeout | URL Application */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Timeout */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              Timeout
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Durée d'inactivité avant déconnexion. Alerte 60 s avant expiration.
            </p>
            {msg && <div className={`alert ${msg.startsWith('Erreur') ? 'alert-err' : 'alert-ok'}`} style={{ marginBottom: 10 }}>{msg}</div>}
            <form onSubmit={saveTimeout} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label className="form-label">Durée d'inactivité</label>
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
                {saving ? '…' : 'OK'}
              </button>
            </form>
          </div>
        </div>

        {/* URL de l'application */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              URL de l'application
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              URL publique de l'application.
            </p>
            {urlMsg && <div className="alert alert-ok" style={{ marginBottom: 10, fontSize: 12 }}>{urlMsg}</div>}
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label className="form-label">Adresse URL</label>
                <input className="form-control" value={appUrl}
                  onChange={e => setAppUrl(e.target.value)}
                  placeholder="https://nexusvault.mondomaine.com" />
              </div>
              <button className="btn btn-primary" onClick={saveAppUrl} disabled={urlSaving}>
                {urlSaving ? '…' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Liste d'accès */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Liste d'accès IP / URL
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div className="alert alert-warn" style={{ marginBottom: 14, justifyContent: 'center', textAlign: 'center' }}>
            Liste vide = tous les accès sont autorisés. Dès qu'une règle est active, seules les adresses listées peuvent accéder.
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
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucune règle</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>


      {confirm && <ConfirmModal message={`Supprimer la règle "${confirm.value}" ?`}
        onConfirm={async () => { await api.deleteWhitelist(confirm.id); setConfirm(null); loadWl(); }}
        onCancel={() => setConfirm(null)} />}
    </div>
  );
}



// ── ONGLET NOTIFICATIONS ──────────────────────────────────────────────────────
// Modals de configuration des canaux
function SmtpModal({ onClose, onSaved }) {
  const [s, setS] = useState({ host:'', port:'587', secure:false, user:'', pass:'', from:'' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg]         = useState('');
  const [err, setErr]         = useState('');
  useEffect(() => {
    api.smtpConfig().then(c => setS({ host:c.host||'', port:String(c.port||587), secure:!!c.secure, user:c.user||'', pass:'', from:c.from||'' })).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  const save = async e => { e.preventDefault(); setSaving(true); setMsg(''); setErr('');
    try { await api.smtpSave({ ...s, port:parseInt(s.port)||587 }); onSaved('email'); setMsg('Enregistré.'); } catch(e){setErr(e.message);} finally{setSaving(false);} };
  const test = async () => { setTesting(true); setMsg(''); setErr('');
    try { const r=await api.smtpTest(); setMsg(`Email de test envoyé à ${r.to}`); } catch(e){setErr('Erreur: '+e.message);} finally{setTesting(false);} };
  return (
    <Modal title="Configuration SMTP" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Fermer</button><button className="btn" onClick={test} disabled={testing||!s.host}>{testing?'Envoi…':'Tester'}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'…':'Enregistrer'}</button></>}>
      {loading?<div style={{textAlign:'center',padding:20}}><Spinner/></div>:<>
        {msg&&<div className="alert alert-ok" style={{marginBottom:12,fontSize:12}}>{msg}</div>}
        {err&&<div className="alert alert-err" style={{marginBottom:12,fontSize:12}}>{err}</div>}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div className="form-group" style={{margin:0}}><label className="form-label">Hôte SMTP</label><input className="form-control" value={s.host} onChange={e=>setS(x=>({...x,host:e.target.value}))} placeholder="smtp.gmail.com"/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Port</label><input className="form-control" type="number" value={s.port} onChange={e=>setS(x=>({...x,port:e.target.value}))} placeholder="587"/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Utilisateur</label><input className="form-control" value={s.user} onChange={e=>setS(x=>({...x,user:e.target.value}))} placeholder="user@domaine.com"/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Mot de passe</label><input className="form-control" type="password" value={s.pass} onChange={e=>setS(x=>({...x,pass:e.target.value}))} placeholder="••••••••"/></div>
          <div className="form-group" style={{margin:0,gridColumn:'1/-1'}}><label className="form-label">Expéditeur (From)</label><input className="form-control" value={s.from} onChange={e=>setS(x=>({...x,from:e.target.value}))} placeholder="NexusVault <no-reply@domaine.com>"/></div>
        </div>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginTop:10,cursor:'pointer'}}>
          <input type="checkbox" checked={s.secure} onChange={e=>setS(x=>({...x,secure:e.target.checked}))}/>SSL/TLS (port 465)
        </label>
      </>}
    </Modal>
  );
}

function TelegramModal({ onClose, onSaved }) {
  const [t, setT] = useState({ bot_token:'', chat_id:'' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg]         = useState('');
  const [err, setErr]         = useState('');
  useEffect(() => {
    api.telegramConfig().then(c=>setT({bot_token:c.bot_token||'',chat_id:c.chat_id||''})).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  const save = async () => { setSaving(true); setMsg(''); setErr('');
    try { await api.telegramSave(t); onSaved('telegram'); setMsg('Enregistré.'); } catch(e){setErr(e.message);} finally{setSaving(false);} };
  const test = async () => { setTesting(true); setMsg(''); setErr('');
    try { await api.telegramTest(); setMsg('Message Telegram envoyé !'); } catch(e){setErr('Erreur: '+e.message);} finally{setTesting(false);} };
  return (
    <Modal title="Configuration Telegram" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Fermer</button><button className="btn" onClick={test} disabled={testing||!t.bot_token||!t.chat_id}>{testing?'Envoi…':'Tester'}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'…':'Enregistrer'}</button></>}>
      {loading?<div style={{textAlign:'center',padding:20}}><Spinner/></div>:<>
        {msg&&<div className="alert alert-ok" style={{marginBottom:12,fontSize:12}}>{msg}</div>}
        {err&&<div className="alert alert-err" style={{marginBottom:12,fontSize:12}}>{err}</div>}
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>Créez un bot via <code>@BotFather</code> sur Telegram pour obtenir votre Bot Token. L'ID du chat peut être récupéré via <code>@userinfobot</code>.</p>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="form-group" style={{margin:0}}><label className="form-label">Bot Token</label><input className="form-control" type="password" value={t.bot_token} onChange={e=>setT(x=>({...x,bot_token:e.target.value}))} placeholder="1234567890:ABCDefGhIJK..."/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Chat ID / Canal ID</label><input className="form-control" value={t.chat_id} onChange={e=>setT(x=>({...x,chat_id:e.target.value}))} placeholder="-1001234567890"/></div>
        </div>
      </>}
    </Modal>
  );
}

function SlackModal({ onClose, onSaved }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg]         = useState('');
  const [err, setErr]         = useState('');
  useEffect(() => {
    api.slackConfig().then(c=>setUrl(c.webhook_url||'')).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  const save = async () => { setSaving(true); setMsg(''); setErr('');
    try { await api.slackSave({webhook_url:url}); onSaved('slack'); setMsg('Enregistré.'); } catch(e){setErr(e.message);} finally{setSaving(false);} };
  const test = async () => { setTesting(true); setMsg(''); setErr('');
    try { await api.slackTest(); setMsg('Message Slack envoyé !'); } catch(e){setErr('Erreur: '+e.message);} finally{setTesting(false);} };
  return (
    <Modal title="Configuration Slack" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Fermer</button><button className="btn" onClick={test} disabled={testing||!url||url.startsWith('••••')}>{testing?'Envoi…':'Tester'}</button><button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'…':'Enregistrer'}</button></>}>
      {loading?<div style={{textAlign:'center',padding:20}}><Spinner/></div>:<>
        {msg&&<div className="alert alert-ok" style={{marginBottom:12,fontSize:12}}>{msg}</div>}
        {err&&<div className="alert alert-err" style={{marginBottom:12,fontSize:12}}>{err}</div>}
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>Créez une Incoming Webhook dans votre espace Slack : <br/>Paramètres → Apps → Incoming Webhooks → Ajouter.</p>
        <div className="form-group" style={{margin:0}}><label className="form-label">Webhook URL</label><input className="form-control" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://hooks.slack.com/services/T.../B.../..."/></div>
      </>}
    </Modal>
  );
}

function SecurityNotifTab() {
  const [configs,   setConfigs]   = useState([]);
  const [catalog,   setCatalog]   = useState({ channels: {} });
  const [saving,    setSaving]    = useState({});
  const [modal,     setModal]     = useState(null); // 'smtp'|'telegram'|'slack'
  // Canaux validés (testés avec succès)
  const [validated, setValidated] = useState({ email: false, telegram: false, slack: false });

  const FREQ_OPT = [{v:'daily',l:'Quotidien'},{v:'weekly',l:'Hebdomadaire'},{v:'monthly',l:'Mensuel'}];
  const DAYS_FR  = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];

  useEffect(() => {
    api.notifCatalog().then(d => {
      setCatalog(d);
      // Détecter canaux déjà configurés
      const ch = d.channels || {};
      setValidated(v => ({
        email:    !!(ch.email?.available),
        telegram: !!(ch.telegram?.available),
        slack:    !!(ch.slack?.available),
      }));
    }).catch(() => {});
    api.notifConfig().then(setConfigs).catch(() => {});
  }, []);

  function onChannelSaved(channel) {
    setValidated(v => ({ ...v, [channel]: true }));
    setModal(null);
    // Recharger le catalog pour mettre à jour available
    api.notifCatalog().then(d => setCatalog(d)).catch(() => {});
  }

  async function toggleChannel(cfg, channel) {
    const channels = cfg.channels.includes(channel)
      ? cfg.channels.filter(c => c !== channel)
      : [...cfg.channels, channel];
    await saveCfg(cfg.event_key, { channels });
  }

  async function saveCfg(key, patch) {
    const cfg = configs.find(c => c.event_key === key);
    if (!cfg) return;
    const next = { ...cfg, ...patch };
    setSaving(s => ({ ...s, [key]: true }));
    try {
      await api.notifSave(key, { enabled: next.enabled, channels: next.channels, options: next.options });
      setConfigs(cs => cs.map(c => c.event_key === key ? next : c));
    } catch {}
    finally { setSaving(s => ({ ...s, [key]: false })); }
  }

  // Icônes canaux
  const CHAN_CONFIG = {
    email:    { label: 'SMTP',     color: '#0891b2', bgColor: 'rgba(8,145,178,0.12)' },
    telegram: { label: 'Telegram', color: '#2BA5E0', bgColor: 'rgba(43,165,224,0.12)' },
    slack:    { label: 'Slack',    color: '#E01E5A', bgColor: 'rgba(224,30,90,0.12)' },
  };

  const channelList = Object.keys(CHAN_CONFIG).filter(k => catalog.channels?.[k]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Info + boutons configuration canaux */}
      <div className="card">
        <div style={{ padding: '14px 18px' }}>
          {/* Message style alerte comme OIDC */}
          <div className="alert alert-warn" style={{ marginBottom: 16, fontSize: 12, justifyContent: 'center', textAlign: 'center' }}>
            Les notifications sont envoyées aux administrateurs uniquement !
          </div>
          {/* Boutons canaux */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            {/* SMTP */}
            <button className="btn" onClick={() => setModal('smtp')}
              style={{ display:'flex', alignItems:'center', gap:8, borderColor:'#0891b2', color:'#0891b2', background: validated.email ? 'rgba(8,145,178,0.08)' : undefined }}>
              {validated.email && <span style={{ color:'var(--ok)', fontSize:14 }}>●</span>}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
              </svg>
              SMTP {validated.email && '✓'}
            </button>
            {/* Telegram */}
            <button className="btn" onClick={() => setModal('telegram')}
              style={{ display:'flex', alignItems:'center', gap:8, borderColor:'#2BA5E0', color:'#2BA5E0', background: validated.telegram ? 'rgba(43,165,224,0.08)' : undefined }}>
              {validated.telegram && <span style={{ color:'var(--ok)', fontSize:14 }}>●</span>}
              <svg viewBox="0 0 24 24" fill="currentColor" style={{width:14,height:14}}>
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.248l-2.01 9.474c-.148.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.873.747z"/>
              </svg>
              Telegram {validated.telegram && '✓'}
            </button>
            {/* Slack */}
            <button className="btn" onClick={() => setModal('slack')}
              style={{ display:'flex', alignItems:'center', gap:8, borderColor:'#E01E5A', color:'#E01E5A', background: validated.slack ? 'rgba(224,30,90,0.08)' : undefined }}>
              {validated.slack && <span style={{ color:'var(--ok)', fontSize:14 }}>●</span>}
              <svg viewBox="0 0 24 24" fill="currentColor" style={{width:14,height:14}}>
                <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.122 2.521a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.122a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
              </svg>
              Slack {validated.slack && '✓'}
            </button>
          </div>
        </div>
      </div>

      {/* Liste des notifications */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            Règles de notification
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--brd)' }}>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, width: '100%' }}>Événement</th>
              {channelList.map(ch => (
                <th key={ch} style={{ padding: '8px 8px', textAlign: 'center', width: 56, fontSize: 10, color: CHAN_CONFIG[ch].color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {CHAN_CONFIG[ch].label}
                </th>
              ))}
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, width: 200 }}>Options</th>
            </tr>
          </thead>
          <tbody>
            {configs.map((cfg, idx) => (
              <tr key={cfg.event_key} style={{ borderBottom: '1px solid var(--brd)', background: idx % 2 === 0 ? 'transparent' : 'var(--surf2)' }}>
                {/* Nom de l'événement */}
                <td style={{ padding: '10px 16px' }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)' }}>{cfg.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{cfg.description}</div>
                </td>
                {/* Coches par canal */}
                {channelList.map(ch => {
                  const active = cfg.channels.includes(ch);
                  const available = catalog.channels?.[ch]?.available || validated[ch];
                  return (
                    <td key={ch} style={{ padding: '10px 8px', textAlign: 'center', width: 56 }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', cursor: available ? 'pointer' : 'not-allowed' }}
                        title={!available ? `Configurer ${CHAN_CONFIG[ch].label} d'abord` : ''}>
                        <input type="checkbox" checked={active} disabled={!available}
                          onChange={() => available && toggleChannel(cfg, ch)}
                          style={{ width: 15, height: 15, cursor: available ? 'pointer' : 'not-allowed',
                            accentColor: CHAN_CONFIG[ch].color }} />
                      </label>
                    </td>
                  );
                })}
                {/* Options */}
                <td style={{ padding: '10px 16px' }}>
                  {(cfg.event_key === 'preview_recap' || cfg.event_key === 'preview_overdue') && (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <select className="form-control" style={{ padding: '2px 6px', fontSize: 11, height: 26 }}
                        value={cfg.options?.frequency || 'weekly'}
                        onChange={e => saveCfg(cfg.event_key, { options: { ...cfg.options, frequency: e.target.value } })}>
                        {FREQ_OPT.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                      </select>
                      {cfg.options?.frequency === 'weekly' && (
                        <select className="form-control" style={{ padding: '2px 6px', fontSize: 11, height: 26 }}
                          value={cfg.options?.day_of_week ?? 1}
                          onChange={e => saveCfg(cfg.event_key, { options: { ...cfg.options, day_of_week: parseInt(e.target.value) } })}>
                          {DAYS_FR.map((d, i) => <option key={i} value={i}>{d}</option>)}
                        </select>
                      )}
                      {cfg.options?.frequency === 'monthly' && (
                        <select className="form-control" style={{ padding: '2px 6px', fontSize: 11, height: 26 }}
                          value={cfg.options?.day_of_month ?? 1}
                          onChange={e => saveCfg(cfg.event_key, { options: { ...cfg.options, day_of_month: parseInt(e.target.value) } })}>
                          {Array.from({length:28},(_,i)=><option key={i+1} value={i+1}>Jour {i+1}</option>)}
                        </select>
                      )}
                    </div>
                  )}
                  {cfg.event_key === 'login_failed_threshold' && (
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <input type="number" className="form-control" style={{width:50,padding:'2px 6px',fontSize:11,height:26}}
                          min={1} max={10} value={cfg.options?.threshold ?? 3}
                          onChange={e => saveCfg(cfg.event_key, { options:{...cfg.options, threshold:parseInt(e.target.value)} })}/>
                        <span style={{fontSize:11,color:'var(--muted)'}}>tentatives sur</span>
                        <select className="form-control" style={{padding:'2px 4px',fontSize:11,height:26,width:'auto'}}
                          value={cfg.options?.window_min ?? 10}
                          onChange={e => saveCfg(cfg.event_key, { options:{...cfg.options, window_min:parseInt(e.target.value)} })}>
                          <option value={5}>5 min</option>
                          <option value={10}>10 min</option>
                          <option value={15}>15 min</option>
                        </select>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modals de configuration */}
      {modal === 'smtp'     && <SmtpModal     onClose={() => setModal(null)} onSaved={onChannelSaved} />}
      {modal === 'telegram' && <TelegramModal onClose={() => setModal(null)} onSaved={onChannelSaved} />}
      {modal === 'slack'    && <SlackModal    onClose={() => setModal(null)} onSaved={onChannelSaved} />}
    </div>
  );
}


// ── ONGLET AUTHENTIFICATION OIDC ─────────────────────────────────────────────
function SecurityOidcTab() {
  const [cfg, setCfg] = useState({
    enabled: false,
    provider_name: '',
    issuer_url: '',
    client_id: '',
    client_secret: '',
    redirect_uri: '',
    scopes: 'openid email profile',
    auto_create_users: false,
    default_role: 'viewer',
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');
  const [err, setErr]       = useState('');

  useEffect(() => {
    api.oidcConfig().then(d => { if (d) setCfg(prev => ({ ...prev, ...d })); }).catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault(); setSaving(true); setMsg(''); setErr('');
    try {
      await api.oidcSave(cfg);
      setMsg('Configuration OIDC enregistrée.');
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const field = (key, label, type = 'text', placeholder = '') => (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label">{label}</label>
      <input className="form-control" type={type} value={cfg[key] || ''}
        onChange={e => setCfg(c => ({ ...c, [key]: e.target.value }))}
        placeholder={placeholder} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/>
            </svg>
            Authentification OIDC / OAuth2
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={cfg.enabled}
              onChange={e => setCfg(c => ({ ...c, enabled: e.target.checked }))} />
            <span style={{ fontWeight: 600, color: cfg.enabled ? 'var(--ok)' : 'var(--muted)' }}>
              {cfg.enabled ? 'Activé' : 'Désactivé'}
            </span>
          </label>
        </div>
        <div style={{ padding: 20 }}>
          {msg && <div className="alert alert-ok" style={{ marginBottom: 14 }}>{msg}</div>}
          {err && <div className="alert alert-err" style={{ marginBottom: 14 }}>{err}</div>}

          {/* Info */}
          <div className="alert alert-warn" style={{ marginBottom: 16, fontSize: 12, justifyContent: 'center', textAlign: 'center' }}>
            L'authentification OIDC est complémentaire à l'authentification locale. Les comptes locaux restent accessibles même si OIDC est activé.
          </div>

          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {field('provider_name', 'Nom du fournisseur', 'text', 'Ex: Keycloak, Authentik, Azure AD')}
              {field('issuer_url', 'URL Issuer (Discovery)', 'text', 'https://auth.example.com/realms/nexusvault')}
              {field('client_id', 'Client ID', 'text', 'nexusvault')}
              {field('client_secret', 'Client Secret', 'password', '••••••••')}
              {field('redirect_uri', 'URI de redirection', 'text', 'https://nexusvault.example.com/auth/callback')}
              {field('scopes', 'Scopes', 'text', 'openid email profile')}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--txt)', cursor: 'pointer' }}>
                <input type="checkbox" checked={cfg.auto_create_users}
                  onChange={e => setCfg(c => ({ ...c, auto_create_users: e.target.checked }))} />
                Créer automatiquement les utilisateurs OIDC inconnus
              </label>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Rôle par défaut (nouveaux utilisateurs)</label>
                <select className="form-control" value={cfg.default_role}
                  onChange={e => setCfg(c => ({ ...c, default_role: e.target.value }))}>
                  <option value="viewer">Utilisateur (lecture seule)</option>
                  <option value="operator">Opérateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>
            </div>

            {/* Endpoints calculés */}
            {cfg.issuer_url && (
              <div style={{ background: 'var(--surf2)', border: '1px solid var(--brd)', borderRadius: 'var(--r)', padding: 12, marginBottom: 14, fontSize: 11 }}>
                <div style={{ fontWeight: 600, color: 'var(--muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '.4px' }}>Endpoints OIDC (calculés automatiquement)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Authorization', `${cfg.issuer_url}/protocol/openid-connect/auth`],
                    ['Token',         `${cfg.issuer_url}/protocol/openid-connect/token`],
                    ['UserInfo',      `${cfg.issuer_url}/protocol/openid-connect/userinfo`],
                    ['Discovery',     `${cfg.issuer_url}/.well-known/openid-configuration`],
                  ].map(([label, url]) => (
                    <div key={label} style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--muted)', minWidth: 90 }}>{label} :</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--acc)', fontSize: 10 }}>{url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Bouton de connexion OIDC (aperçu) */}
      {cfg.enabled && cfg.provider_name && (
        <div className="card">
          <div className="card-header"><div className="card-title">Aperçu du bouton de connexion</div></div>
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
              Ce bouton apparaîtra sur la page de connexion sous le formulaire habituel.
            </p>
            <button className="btn" style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--brd)', background: 'var(--surf2)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/>
              </svg>
              Se connecter avec {cfg.provider_name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ONGLET PLANIFICATEUR ──────────────────────────────────────────────────────
function SecurityCronTab() {
  const [cronHour,   setCronHour]   = useState('0');
  const [cronMinute, setCronMinute] = useState('5');
  const [cronStatus, setCronStatus] = useState(null);
  const [cronSaving, setCronSaving] = useState(false);
  const [cronMsg,    setCronMsg]    = useState('');
  useEffect(() => {
    api.cronStatus()
      .then(s => {
        setCronStatus(s);
        setCronHour(String(s.hour).padStart(2,'0'));
        setCronMinute(String(s.minute).padStart(2,'0'));
      })
      .catch(() => {});
  }, []);

  async function saveCron(e) {
    e.preventDefault(); setCronSaving(true); setCronMsg('');
    try {
      const r = await api.cronConfig({ hour: parseInt(cronHour), minute: parseInt(cronMinute) });
      setCronMsg('Configuration enregistrée.');
      setCronStatus(prev => ({ ...prev, hour: parseInt(cronHour), minute: parseInt(cronMinute), next_run: r.next_run }));
    } catch (e) { setCronMsg('Erreur : ' + e.message); }
    finally { setCronSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/>
              <line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
              <polyline points="12 14 12 18 15 18"/>
            </svg>
            Archivage automatique du journal d'audit
          </div>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: cronStatus ? 'var(--ok)' : 'var(--muted)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: cronStatus ? 'var(--ok)' : 'var(--muted)', boxShadow: cronStatus ? '0 0 6px var(--ok)' : 'none' }} />
            {cronStatus ? 'Cron actif' : 'Chargement…'}
          </span>
        </div>
        <div style={{ padding: 20 }}>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 16 }}>
            Le 1er de chaque mois à l'heure configurée, le journal d'audit du mois précédent est automatiquement archivé et supprimé du journal actif.
          </p>
          {cronMsg && <div className={`alert ${cronMsg.startsWith('Erreur') ? 'alert-err' : 'alert-ok'}`} style={{ marginBottom: 14 }}>{cronMsg}</div>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Configuration */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Configuration</div>
              <form onSubmit={saveCron} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Heure (1er du mois)</label>
                  <select className="form-control" value={cronHour} onChange={e => setCronHour(e.target.value)}>
                    {Array.from({ length: 24 }, (_, i) => String(i).padStart(2,'0')).map(h => (
                      <option key={h} value={h}>{h}h</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Minute</label>
                  <select className="form-control" value={cronMinute} onChange={e => setCronMinute(e.target.value)}>
                    {['00','05','10','15','20','25','30','35','40','45','50','55'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <button className="btn btn-primary" type="submit" disabled={cronSaving}>
                  {cronSaving ? '…' : 'Enregistrer'}
                </button>
              </form>
            </div>

            {/* Statut */}
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Statut</div>
              {cronStatus ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--muted)', minWidth: 100 }}>Prochain run :</span>
                    <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--acc)' }}>{cronStatus.next_run || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--muted)', minWidth: 100 }}>Dernier run :</span>
                    <span style={{ fontFamily: 'var(--mono)' }}>{cronStatus.last_run || 'Jamais'}</span>
                  </div>
                  {cronStatus.last_result && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: 'var(--muted)', minWidth: 100 }}>Résultat :</span>
                      <span style={{ color: 'var(--ok)', fontWeight: 600 }}>{cronStatus.last_result}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: 'var(--muted)', minWidth: 100 }}>Planifié :</span>
                    <span>Le 1er du mois à {String(cronStatus.hour).padStart(2,'0')}h{String(cronStatus.minute).padStart(2,'0')}</span>
                  </div>
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Chargement…</div>
              )}
            </div>
          </div>


        </div>
      </div>

    </div>
  );
}

// ── MODAL LISTE DES ARCHIVES ──────────────────────────────────────────────────
const MONTHS_AUDIT = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function ArchiveListModal({ onClose }) {
  const [archives, setArchives]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [viewArchive, setViewArchive] = useState(null);

  useEffect(() => {
    api.auditArchives()
      .then(data => setArchives(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (viewArchive) {
    return <ArchiveViewModal archive={viewArchive} onClose={() => setViewArchive(null)} onBack={() => setViewArchive(null)} />;
  }

  return (
    <Modal title="Archives du journal d'audit" onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
      ) : archives.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: .3 }}>
            <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/>
          </svg>
          <div>Aucune archive disponible</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>L'archivage automatique s'effectue le 1er de chaque mois</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {archives.map(a => (
            <button key={a.id} onClick={() => setViewArchive(a)} style={{
              padding: '14px 16px', borderRadius: 'var(--r)', cursor: 'pointer', textAlign: 'left',
              border: '1px solid var(--brd)', background: 'var(--surf2)',
              display: 'flex', flexDirection: 'column', gap: 4, transition: 'border-color .15s, background .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--acc)'; e.currentTarget.style.background = 'var(--acc-s)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--brd)'; e.currentTarget.style.background = 'var(--surf2)'; }}
            >
              <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>
                {MONTHS_AUDIT[(a.month || 1) - 1]}
              </div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{a.year}</div>
              <div style={{ fontSize: 11, color: 'var(--ok)', fontWeight: 600 }}>
                {a.entry_count} note{a.entry_count > 1 ? 's' : ''}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)' }}>
                {a.archived_by === 'cron' ? '⚙ Auto' : '👤 Manuel'}
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}



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
          <thead>
            <tr>
              <th style={{ width: 80 }}>Aperçu</th>
              <th style={{ width: 80 }}>Code</th>
              <th>Libellé</th>
              <th style={{ width: 60 }}>Couleur</th>
              <th style={{ width: 110 }}></th>
            </tr>
          </thead>
          <tbody>
            {tags.map(t => (
              <tr key={t.id}>
                {/* Aperçu — badge coloré compact */}
                <td style={{ width: 80 }}>
                  <span style={{
                    display: 'inline-block',
                    background: `rgba(${parseInt(t.color.slice(1,3),16)},${parseInt(t.color.slice(3,5),16)},${parseInt(t.color.slice(5,7),16)},0.12)`,
                    color: t.color, border: `1px solid ${t.color}`,
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, fontFamily: 'var(--mono)'
                  }}>{t.code}</span>
                </td>
                {/* Code — monospace compact */}
                <td style={{ width: 80, fontFamily: 'var(--mono)', fontSize: 12, fontWeight: 600 }}>{t.code}</td>
                {/* Libellé — largeur maximale */}
                <td style={{ fontSize: 12 }}>
                  {editTag?.id === t.id
                    ? <input className="form-control" style={{ padding: '4px 8px', fontSize: 12 }} value={editTag.label} onChange={e => setEditTag(x => ({ ...x, label: e.target.value }))} />
                    : t.label}
                </td>
                {/* Couleur */}
                <td style={{ width: 60 }}>
                  {editTag?.id === t.id
                    ? <input type="color" value={editTag.color} onChange={e => setEditTag(x => ({ ...x, color: e.target.value }))}
                        style={{ width: 36, height: 28, padding: 2, border: '1px solid var(--brd)', borderRadius: 4, cursor: 'pointer' }} />
                    : <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: '50%', background: t.color, verticalAlign: 'middle' }} />}
                </td>
                {/* Actions — tout à droite */}
                <td style={{ width: 110 }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
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


// ── ARCHIVE MODAL ─────────────────────────────────────────────────────────────
const MONTHS_FR_AUDIT = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ── VISUALISATION ARCHIVE ─────────────────────────────────────────────────────

function ArchiveViewModal({ archive, onClose }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSuccess, setFilterSuccess] = useState('');

  useEffect(() => {
    api.auditArchiveGet(archive.id)
      .then(data => setEntries(data.entries || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [archive.id]);

  const filtered = filterSuccess === '' ? entries
    : entries.filter(e => String(e.success) === filterSuccess);

  return (
    <Modal title={`Archive — ${MONTHS_AUDIT[archive.month - 1]} ${archive.year}`} onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{archive.entry_count} entrée{archive.entry_count > 1 ? 's' : ''} · archivé le {archive.archived_at?.slice(0, 16)} par {archive.archived_by}</span>
        <div style={{ marginLeft: 'auto' }}>
          <select className="form-control" style={{ padding: '4px 8px', fontSize: 12, height: 28 }}
            value={filterSuccess} onChange={e => setFilterSuccess(e.target.value)}>
            <option value="">Tous résultats</option>
            <option value="1">OK uniquement</option>
            <option value="0">Échecs uniquement</option>
          </select>
        </div>
      </div>
      {loading ? <div style={{ textAlign: 'center', padding: 32 }}><span className="spinner" /></div> : (
        <div style={{ maxHeight: 420, overflowY: 'auto', border: '1px solid var(--brd)', borderRadius: 'var(--r)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: 'var(--surf2)', position: 'sticky', top: 0 }}>
                <th style={{ padding: '5px 8px', textAlign: 'left', width: 130 }}>Date</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', width: 90 }}>Sévérité</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Action</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', width: 100 }}>Utilisateur</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Détail</th>
                <th style={{ padding: '5px 8px', textAlign: 'center', width: 60 }}>Résultat</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid var(--brd)', background: e.success ? 'transparent' : 'var(--err-s)' }}>
                  <td style={{ padding: '3px 8px', fontFamily: 'var(--mono)', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{e.created_at?.slice(0, 16)}</td>
                  <td style={{ padding: '3px 8px' }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: e.severity === 'warn' ? 'var(--warn)' : e.severity === 'error' ? 'var(--err)' : 'var(--acc)' }}>{e.severity}</span>
                  </td>
                  <td style={{ padding: '3px 8px', fontWeight: 600 }}>{e.action}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--muted)' }}>{e.username || '—'}</td>
                  <td style={{ padding: '3px 8px', color: 'var(--muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={e.detail}>{e.detail}</td>
                  <td style={{ padding: '3px 8px', textAlign: 'center' }}>
                    {e.success
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--err)" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>Aucune entrée</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

// ── AUDIT TAB ─────────────────────────────────────────────────────────────────
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
  const { can } = usePerms();
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({ category: '', severity: '', success: '', limit: '200' });
  const [showArchiveList, setShowArchiveList] = useState(false);


  const load = () => {
    setLoading(true);
    const p = {};
    if (filters.category) p.category = filters.category;
    if (filters.severity) p.severity = filters.severity;
    if (filters.success !== '') p.success = filters.success;
    if (filters.limit) p.limit = filters.limit;
    api.audit(p).then(setLogs).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filters]);

  const sf = k => e => setFilters(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
    <div className="card">
      <div className="card-header" style={{ flexWrap: 'nowrap', gap: 8, overflow: 'auto' }}>
        <div className="card-title" style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Journal d'audit
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', marginLeft: 'auto' }}>
          {can('audit_archive') && (
            <button className="btn" style={{ borderColor: 'var(--ok)', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
              onClick={() => setShowArchiveList(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              Archive
            </button>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'nowrap' }}>
            {/* Résultat */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <select className="form-control" style={{ padding: '4px 6px', fontSize: 12, height: 28, minWidth: 100 }}
                value={filters.success} onChange={sf('success')}>
                <option value="">Résultat</option>
                <option value="1">✓ OK</option>
                <option value="0">✗ Échec</option>
              </select>
              {filters.success && (
                <button onClick={() => setFilters(f => ({ ...f, success: '' }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 3px', fontSize: 13, lineHeight: 1 }}>✕</button>
              )}
            </div>
            {/* Sévérité */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <select className="form-control" style={{ padding: '4px 6px', fontSize: 12, height: 28, minWidth: 110 }}
                value={filters.severity} onChange={sf('severity')}>
                <option value="">Sévérité</option>
                <option value="info">Info</option>
                <option value="warn">Alerte</option>
                <option value="error">Erreur</option>
              </select>
              {filters.severity && (
                <button onClick={() => setFilters(f => ({ ...f, severity: '' }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 3px', fontSize: 13, lineHeight: 1 }}>✕</button>
              )}
            </div>
            {/* Catégorie */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <select className="form-control" style={{ padding: '4px 6px', fontSize: 12, height: 28, minWidth: 120 }}
                value={filters.category} onChange={sf('category')}>
                <option value="">Catégorie</option>
                <option value="auth">Authentification</option>
                <option value="admin">Administration</option>
                <option value="backup">Backups</option>
                <option value="config">Configuration</option>
                <option value="suivi">Suivi</option>
              </select>
              {filters.category && (
                <button onClick={() => setFilters(f => ({ ...f, category: '' }))}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: '0 3px', fontSize: 13, lineHeight: 1 }}>✕</button>
              )}
            </div>
            {/* Limite */}
            <select className="form-control" style={{ padding: '4px 6px', fontSize: 12, height: 28, minWidth: 100 }}
              value={filters.limit} onChange={sf('limit')}>
              <option value="50">50 entrées</option>
              <option value="200">200 entrées</option>
              <option value="500">500 entrées</option>
            </select>
          </div>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th style={{ width: 140 }}>Date</th>
              <th style={{ width: 90 }}>Sévérité</th>
              <th style={{ width: 100 }}>Catégorie</th>
              <th style={{ width: 150 }}>Action</th>
              <th style={{ width: 90 }}>Utilisateur</th>
              <th>Détail</th>
              <th style={{ width: 70 }}>Résultat</th>
            </tr>
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
                  <td style={{ fontSize: 12, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.username || '—'}</td>
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

    {showArchiveList && <ArchiveListModal onClose={() => setShowArchiveList(false)} />}
    </>
  );
}

// ── PAGE ADMIN ────────────────────────────────────────────────────────────────
// sep = séparateur visuel dans le menu
const TABS = [
  { key: 'account',       label: 'Mon compte',       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
  { key: 'personnalisation', label: 'Personnalisation', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
  { key: '__sep1__',      sep: true },
  { key: 'appareils',     label: 'Appareils',         icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg> },
  { key: 'scripts_admin', label: 'Scripts',          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> },
  { key: 'activity_tags', label: "Tags d'activité", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> },
  { key: '__sep2__',      sep: true },
  { key: 'users',         label: 'Utilisateurs',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
  { key: 'security',      label: "Sécurité",           icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
  { key: 'audit',         label: "Journal d'audit",   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
];

export default function Admin() {
  const { user, logout: doLogout } = useAuth();
  const [sp, setSp] = useSearchParams();
  const active = sp.get('tab') || 'account';
  const isAdmin = user?.role === 'admin';

  const { can } = usePerms();
  const visibleTabs = TABS.filter(t => {
    if (t.sep) return true; // séparateurs toujours inclus (masqués si voisins cachés)
    if (t.key === 'account') return true;
    if (t.key === 'personnalisation') return true;
    if (t.key === 'logout') return true;
    if (t.key === 'appareils') return isAdmin || can('config_read');
    if (t.key === 'scripts_admin') return isAdmin || can('scripts_admin');
    if (t.key === 'activity_tags') return isAdmin || can('activity_tags');
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
          <div className="page-sub">Configuration, Gestion des accès utilisateurs et Sécurité</div>
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
          {active === 'personnalisation' && <PersonnalisationTab />}
          {active === 'appareils' && <AppareilsTab />}
          {active === 'users' && isAdmin && <UsersTab />}
          {active === 'security' && (isAdmin || can('security_access')) && <SecurityTab />}
          {active === 'scripts_admin' && (isAdmin || can('scripts_admin')) && <ScriptsAdminTab />}
          {active === 'activity_tags' && (isAdmin || can('activity_tags')) && <ActivityTagsTab />}
          {active === 'audit' && (isAdmin || can('audit_access')) && <AuditTab />}
        </div>
      </div>
    </main>
  );
}
