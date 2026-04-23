import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { Modal, Alert, ConfirmModal } from '../components/UI.jsx';
import { usePerms } from '../hooks/usePerms.js';

// ── SITES ────────────────────────────────────────────────────────────────────

function SiteModal({ site, onClose, onSave }) {
  const [data, setData] = useState(site || { name: '', location: '', contact: '', description: '' });
  const [error, setError] = useState('');
  const set = k => e => setData(d => ({ ...d, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!data.name) return setError('Le nom est requis');
    try {
      if (site) await api.updateSite(site.id, data);
      else await api.createSite(data);
      onSave();
    } catch (e) { setError(e.message); }
  }

  return (
    <Modal title={site ? 'Modifier le site' : 'Ajouter un site'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={submit}>Enregistrer</button></>}>
      {error && <Alert type="err">{error}</Alert>}
      <div className="form-group"><label className="form-label">Nom du site *</label><input className="form-control" value={data.name} onChange={set('name')} placeholder="ex : Paris HQ" autoFocus /></div>
      <div className="form-group"><label className="form-label">Localisation</label><input className="form-control" value={data.location} onChange={set('location')} placeholder="Ville, Pays" /></div>
      <div className="form-group"><label className="form-label">Contact IT</label><input className="form-control" value={data.contact} onChange={set('contact')} placeholder="it@example.com" /></div>
      <div className="form-group"><label className="form-label">Description</label><input className="form-control" value={data.description} onChange={set('description')} placeholder="Optionnel" /></div>
    </Modal>
  );
}

function SitesTab() {
  const { can } = usePerms();
  const [sites, setSites] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.sites().then(setSites).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          Sites réseau
        </div>
        {can('config_write') && <button className="btn btn-primary" onClick={() => setModal({})}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Ajouter
        </button>}
      </div>
      <table>
        <thead><tr><th>Nom</th><th>Localisation</th><th>Contact</th><th>Équipements</th><th></th></tr></thead>
        <tbody>
          {sites.map(s => (
            <tr key={s.id}>
              <td><div className="cell-name">{s.name}</div></td>
              <td className="cell-sub">{s.location}</td>
              <td className="cell-sub">{s.contact}</td>
              <td><span className="badge badge-info">{s.device_count} équip.</span></td>
              <td><div style={{ display: 'flex', gap: 4 }}>
                {can('config_write') && <button className="btn btn-sm" onClick={() => setModal(s)}>Modifier</button>}
                {can('config_write') && <button className="btn btn-sm btn-danger" onClick={() => setConfirm(s)}>Suppr.</button>}
              </div></td>
            </tr>
          ))}
          {sites.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Aucun site — ajoutez-en un</td></tr>}
        </tbody>
      </table>
      {modal !== null && <SiteModal site={modal.id ? modal : null} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {confirm && <ConfirmModal message={`Supprimer le site "${confirm.name}" ?`} onConfirm={async () => { await api.deleteSite(confirm.id); setConfirm(null); load(); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ── MODELS ───────────────────────────────────────────────────────────────────

function ModelModal({ model, onClose, onSave }) {
  const [data, setData] = useState(model || { vendor: '', model: '', device_type: 'Access', backup_method: 'SSH', backup_command: 'show running-config' });
  const [error, setError] = useState('');
  const set = k => e => setData(d => ({ ...d, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!data.vendor || !data.model) return setError('Constructeur et modèle requis');
    try {
      if (model) await api.updateModel(model.id, data);
      else await api.createModel(data);
      onSave();
    } catch (e) { setError(e.message); }
  }

  return (
    <Modal title={model ? 'Modifier le modèle' : 'Ajouter un modèle'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={submit}>Enregistrer</button></>}>
      {error && <Alert type="err">{error}</Alert>}
      <div className="form-row">
        <div className="form-group"><label className="form-label">Constructeur *</label><input className="form-control" value={data.vendor} onChange={set('vendor')} placeholder="Cisco, HP…" autoFocus /></div>
        <div className="form-group"><label className="form-label">Modèle *</label><input className="form-control" value={data.model} onChange={set('model')} placeholder="Catalyst 9300" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Type</label>
          <input
            className="form-control"
            list="device-type-options"
            value={data.device_type}
            onChange={set('device_type')}
            placeholder="Core, Access, Firewall…"
            autoComplete="off"
          />
          <datalist id="device-type-options">
            <option value="Switch" />
            <option value="Core" />
            <option value="Distribution" />
            <option value="Access" />
            <option value="Pare-Feu" />
            <option value="Firewall" />
            <option value="Routeur" />
            <option value="AP WiFi" />
            <option value="NAS" />
          </datalist>
        </div>
        <div className="form-group"><label className="form-label">Méthode backup</label>
          <select className="form-control" value={data.backup_method} onChange={set('backup_method')}>
            <option>SSH</option><option>TFTP</option><option>SCP</option><option>API</option>
          </select>
        </div>
      </div>
      <div className="form-group"><label className="form-label">Commande backup</label><input className="form-control" value={data.backup_command} onChange={set('backup_command')} placeholder="show running-config" /></div>
    </Modal>
  );
}

function ModelsTab() {
  const { can } = usePerms();
  const [models, setModels] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.models().then(setModels).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
          Modèles d'équipements
        </div>
        {can('config_write') && (
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Ajouter
          </button>
        )}
      </div>
      <table>
        <thead><tr><th>Modèle</th><th>Constructeur</th><th>Type</th><th>Méthode</th><th>Commande</th><th>Équip.</th><th></th></tr></thead>
        <tbody>
          {models.map(m => (
            <tr key={m.id}>
              <td className="cell-name">{m.model}</td>
              <td>{m.vendor}</td>
              <td><span className="badge badge-muted">{m.device_type}</span></td>
              <td><span className="badge badge-info">{m.backup_method}</span></td>
              <td><span className="cell-mono">{m.backup_command}</span></td>
              <td>{m.device_count}</td>
              <td><div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm" onClick={() => setModal(m)}>Modifier</button>
                <button className="btn btn-sm btn-danger" onClick={() => setConfirm(m)}>Suppr.</button>
              </div></td>
            </tr>
          ))}
          {models.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Aucun modèle</td></tr>}
        </tbody>
      </table>
      {modal !== null && <ModelModal model={modal.id ? modal : null} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {confirm && <ConfirmModal message={`Supprimer le modèle "${confirm.model}" ?`} onConfirm={async () => { await api.deleteModel(confirm.id); setConfirm(null); load(); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ── DEVICES ──────────────────────────────────────────────────────────────────

function DeviceModal({ device, sites, models, onClose, onSave }) {
  const [data, setData] = useState(device || { name: '', site_id: sites[0]?.id || '', model_id: models[0]?.id || '', ip: '', ssh_port: '22', ssh_user: 'admin', ssh_password: '' });
  const [error, setError] = useState('');
  const set = k => e => setData(d => ({ ...d, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!data.name || !data.site_id || !data.model_id || !data.ip) return setError('Champs obligatoires manquants');
    // Vérifier format IP basique
    const ipRe = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRe.test(data.ip.trim())) return setError("Format d'adresse IP invalide (ex : 192.168.1.1)");
    try {
      if (device && device.id) await api.updateDevice(device.id, data);
      else await api.createDevice(data);
      onSave();
    } catch (e) { setError(e.message); }
  }

  return (
    <Modal title={device ? 'Modifier l\'équipement' : 'Ajouter un équipement'} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={submit}>Enregistrer</button></>}>
      {error && <Alert type="err">{error}</Alert>}
      <div className="form-group"><label className="form-label">Nom *</label><input className="form-control" value={data.name} onChange={set('name')} placeholder="sw-paris-core-01" autoFocus /></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Site *</label>
          <select className="form-control" value={data.site_id} onChange={set('site_id')}>
            {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className="form-group"><label className="form-label">Modèle *</label>
          <select className="form-control" value={data.model_id} onChange={set('model_id')}>
            {models.map(m => <option key={m.id} value={m.id}>{m.vendor} {m.model}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Adresse IP *</label><input className="form-control" value={data.ip} onChange={set('ip')} placeholder="10.0.0.1" /></div>
        <div className="form-group"><label className="form-label">Port SSH</label><input className="form-control" value={data.ssh_port} onChange={set('ssh_port')} placeholder="22" /></div>
      </div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Utilisateur SSH</label><input className="form-control" value={data.ssh_user} onChange={set('ssh_user')} placeholder="admin" /></div>
        <div className="form-group"><label className="form-label">Mot de passe SSH</label><input className="form-control" type="password" value={data.ssh_password} onChange={set('ssh_password')} placeholder="••••••••" /></div>
      </div>
    </Modal>
  );
}

function DevicesTab() {
  const { can } = usePerms();
  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);
  const [models, setModels] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.devices().then(setDevices).catch(() => {});
  useEffect(() => {
    load();
    api.sites().then(setSites).catch(() => {});
    api.models().then(setModels).catch(() => {});
  }, []);

  async function duplicateDevice(device) {
    // Crée une copie avec IP vidée et nom suffixé "-copy" — ouvre le modal pour édition
    const copy = {
      name: device.name + '-copy',
      site_id: device.site_id,
      model_id: device.model_id,
      ip: '',          // IP intentionnellement vide : l'utilisateur doit en saisir une nouvelle
      ssh_port: device.ssh_port || '22',
      ssh_user: device.ssh_user || '',
      ssh_password: '', // on ne copie pas le mot de passe
      enabled: 1,
    };
    setModal(copy); // ouvre le modal d'édition pré-rempli
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
          Équipements réseau
        </div>
        {can('config_write') && (
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Ajouter
          </button>
        )}
      </div>
      <table>
        <thead><tr><th>Nom</th><th>Modèle</th><th>Site</th><th>IP</th><th>Dernier backup</th><th></th></tr></thead>
        <tbody>
          {devices.map(d => (
            <tr key={d.id}>
              <td className="cell-name">{d.name}</td>
              <td><div>{d.vendor} {d.model_name}</div></td>
              <td><span className="badge badge-info">{d.site_name}</span></td>
              <td><span className="cell-mono">{d.ip}</span></td>
              <td>{d.last_backup ? <span className="cell-sub">v{d.last_backup.version} — {d.last_backup.created_at?.slice(0, 10)}</span> : <span className="badge badge-muted">Aucun</span>}</td>
              <td><div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-sm" onClick={() => setModal(d)}>Modifier</button>
                <button className="btn btn-sm" title="Dupliquer" onClick={() => duplicateDevice(d)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  Dupliquer
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => setConfirm(d)}>Suppr.</button>
              </div></td>
            </tr>
          ))}
          {devices.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>Aucun équipement</td></tr>}
        </tbody>
      </table>
      {modal !== null && <DeviceModal device={modal.id ? modal : null} sites={sites} models={models} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {confirm && <ConfirmModal message={`Supprimer l'équipement "${confirm.name}" ?`} onConfirm={async () => { await api.deleteDevice(confirm.id); setConfirm(null); load(); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ── CONFIG PAGE ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'sites',   label: 'Sites',        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg> },
  { key: 'models',  label: 'Modèles',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg> },
  { key: 'devices', label: 'Équipements',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><rect x="2" y="7" width="20" height="14" rx="2" /></svg> },
];

// Version embedded : tabs horizontaux + state local (pas de useSearchParams)
export function ConfigEmbedded() {
  const [active, setActive] = useState('sites');
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--brd)' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActive(t.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px',
            background: 'none', border: 'none',
            borderBottom: active === t.key ? '2px solid var(--acc)' : '2px solid transparent',
            color: active === t.key ? 'var(--acc)' : 'var(--muted)',
            fontWeight: active === t.key ? 600 : 500,
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
            marginBottom: -1, transition: 'color .15s, border-color .15s',
          }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div>
        {active === 'sites'   && <SitesTab />}
        {active === 'models'  && <ModelsTab />}
        {active === 'devices' && <DevicesTab />}
      </div>
    </div>
  );
}

// Version standalone : sidebar à gauche + URL params
export default function Config() {
  const [sp, setSp] = useSearchParams();
  const active = sp.get('tab') || 'sites';
  const setTab = t => setSp({ tab: t });

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Appareils</div>
          <div className="page-sub">Gestion des équipements, sites et modèles</div>
        </div>
      </div>
      <div className="config-layout">
        <div className="side-menu">
          {TABS.map(t => (
            <div key={t.key} className={`side-item ${active === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              {t.icon}{t.label}
            </div>
          ))}
        </div>
        <div>
          {active === 'sites'   && <SitesTab />}
          {active === 'models'  && <ModelsTab />}
          {active === 'devices' && <DevicesTab />}
        </div>
      </div>
    </main>
  );
}
