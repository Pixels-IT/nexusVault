import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useI18n } from '../contexts/I18nContext.jsx';
import { Modal, Alert, ConfirmModal } from '../components/UI.jsx';
import { usePerms } from '../hooks/usePerms.js';

// ── SITES ────────────────────────────────────────────────────────────────────

function SiteModal({ site, onClose, onSave, countries = [], allSites = [] }) {
  const { t } = useI18n();
  const [data, setData] = useState({
    name: '', location: '', contact: '', description: '',
    country_id: null, parent_id: null,
    ...(site || {})
  });
  const [error, setError] = useState('');
  const set = k => e => setData(d => ({ ...d, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!data.name) return setError('Le nom est requis');
    try {
      if (site) {
        await api.updateSite(site.id, data);
        if (data.country_id) await api.setSiteCountry(site.id, data.country_id);
        else await api.setSiteCountry(site.id, null);
      } else {
        const cr = await api.createSite(data);
        if (cr && cr.id && data.country_id) await api.setSiteCountry(cr.id, data.country_id);
      }
      onSave();
    } catch (e) { setError(e.message); }
  }

  // Exclure le site lui-même et ses enfants comme parents possibles
  // Build parent options with depth indentation
  const getOptionDepth = (s, visited = new Set()) => {
    if (!s.parent_id || visited.has(s.id)) return 0;
    visited.add(s.id);
    const par = allSites.find(p => p.id === s.parent_id);
    return par ? 1 + getOptionDepth(par, visited) : 0;
  };
  const parentOptions = allSites
    .filter(s => s.id !== site?.id)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

  // Build ordered parent option list (tree order)
  const buildParentList = (parentId = null, depth = 0) =>
    allSites
      .filter(s => (s.parent_id || null) === parentId && s.id !== site?.id)
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap(s => [{ ...s, depth }, ...buildParentList(s.id, depth + 1)]);

  return (
    <Modal title={site ? t('config.site_edit') : t('config.site_add')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t('config.cancel')}</button><button className="btn btn-primary" onClick={submit}>{t('config.save')}</button></>}>
      {error && <Alert type="err">{error}</Alert>}
      <div className="form-group"><label className="form-label">{t('config.name')} du site *</label>
        <input className="form-control" value={data.name} onChange={set('name')} placeholder="Paris HQ" /></div>
      <div className="form-group"><label className="form-label">{t('config.location')}</label>
        <input className="form-control" value={data.location || ''} onChange={set('location')} placeholder="Paris, France" /></div>
      <div className="form-group"><label className="form-label">{t('config.contact')} IT</label>
        <input className="form-control" value={data.contact || ''} onChange={set('contact')} placeholder="it@company.fr" /></div>
      <div className="form-group"><label className="form-label">Description</label>
        <input className="form-control" value={data.description || ''} onChange={set('description')} /></div>
      {parentOptions.length > 0 && (
        <div className="form-group">
          <label className="form-label">{t('config.site_parent')} <span style={{ fontSize: 11, color: 'var(--muted)' }}>{t('config.site_hierarchy')}</span></label>
          <select className="form-control" value={data.parent_id || ''} onChange={e => setData(d => ({ ...d, parent_id: e.target.value ? parseInt(e.target.value) : null }))}>
            <option value="">{t('config.site_root')}</option>
            {buildParentList().map(s => (
              <option key={s.id} value={s.id}>
                {'　'.repeat(s.depth)}{s.depth > 0 ? '└ ' : ''}{s.name}
              </option>
            ))}
          </select>
        </div>
      )}
      {countries.length > 0 && (
        <div className="form-group"><label className="form-label">Pays</label>
          <select className="form-control" value={data.country_id || ''} onChange={e => setData(d => ({ ...d, country_id: e.target.value ? parseInt(e.target.value) : null }))}>
            <option value="">— Aucun —</option>
            {countries.map(ctry => <option key={ctry.id} value={ctry.id}>{ctry.name}</option>)}
          </select>
        </div>
      )}
    </Modal>
  );
}

function SitesTab({ countries = [] }) {
  const { t } = useI18n();
  const { can } = usePerms();
  const [sites, setSites] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.sites().then(d => setSites([...d].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"})))).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
          Sites réseau
        </div>
        {can('config_write') && <button className="btn btn-sm" onClick={() => setModal({})}
          style={{ display:'flex', alignItems:'center', gap:5, borderColor:'var(--ok)', color:'var(--ok)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter
        </button>}
      </div>
      <table>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.name')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.location')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.contact')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.devices_tab')}</th>
            <th style={{ padding:'7px 8px', background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}></th>
          </tr>
        </thead>
        <tbody>
          {(() => {
            // Build ordered flat list: roots first, then children by depth
            const getDepth = (site, visited = new Set()) => {
              if (!site.parent_id || visited.has(site.id)) return 0;
              visited.add(site.id);
              const par = sites.find(p => p.id === site.parent_id);
              return par ? 1 + getDepth(par, visited) : 0;
            };
            const renderSites = (parentId, depth) => {
              return sites
                .filter(s => (s.parent_id || null) === parentId)
                .sort((a,b) => a.name.localeCompare(b.name))
                .flatMap(s => [
                  <tr key={s.id}>
                    <td>
                      <div className="cell-name" style={{ paddingLeft: depth * 18, display: 'flex', alignItems: 'center', gap: 6 }}>
                        {depth > 0 && <span style={{ color: 'var(--acc)', fontSize: 11, flexShrink: 0, fontFamily: 'var(--mono)' }}>{"└" + "─".repeat(depth)}</span>}
                        {s.name}
                      </div>
                    </td>
                    <td className="cell-sub">{s.location}</td>
                    <td className="cell-sub">{s.contact}</td>
                    <td><span className="badge badge-info">{s.device_count} équip.</span></td>
                    <td style={{ textAlign:'right', whiteSpace:'nowrap', padding:'9px 8px' }}>
                      {can('config_write') && <button className="btn btn-sm" style={{ marginRight:4 }} onClick={() => setModal(s)}>✎</button>}
                      {can('config_write') && <button className="btn btn-sm btn-danger" onClick={() => setConfirm(s)}>✕</button>}
                    </td>
                  </tr>,
                  ...renderSites(s.id, depth + 1)
                ]);
            };
            return renderSites(null, 0);
          })()}
          {sites.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('config.no_sites')}</td></tr>}
        </tbody>
      </table>
      {modal !== null && <SiteModal site={modal.id ? modal : null} countries={countries} allSites={sites} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {confirm && <ConfirmModal message={`Supprimer le site "${confirm.name}" ?`} onConfirm={async () => { await api.deleteSite(confirm.id); setConfirm(null); load(); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ── MODELS ───────────────────────────────────────────────────────────────────

function ModelModal({model, onClose, onSave }) {
  const { t } = useI18n();
  const [data, setData] = useState(model || { vendor: '', model: '', device_type: 'Access', backup_method: 'SSH', backup_command: 'show running-config' });
  const [error, setError] = useState('');
  const set = k => e => setData(d => ({ ...d, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!data.vendor || !data.model) return setError(`${t('config.manufacturer')} et modèle requis`);
    try {
      if (model) await api.updateModel(model.id, data);
      else await api.createModel(data);
      onSave();
    } catch (e) { setError(e.message); }
  }

  return (
    <Modal title={model ? t('config.model_edit') : t('config.model_add')} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>{t('config.cancel')}</button><button className="btn btn-primary" onClick={submit}>{t('config.save')}</button></>}>
      {error && <Alert type="err">{error}</Alert>}
      <div className="form-row">
        <div className="form-group"><label className="form-label">{t('config.manufacturer')} *</label><input className="form-control" value={data.vendor} onChange={set('vendor')} placeholder="Cisco, HP…" autoFocus /></div>
        <div className="form-group"><label className="form-label">{t('config.model')} + ' *'</label><input className="form-control" value={data.model} onChange={set('model')} placeholder="Catalyst 9300" /></div>
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
        <div className="form-group"><label className="form-label">{t('config.method')} backup</label>
          <select className="form-control" value={data.backup_method} onChange={set('backup_method')}>
            <option>SSH</option><option>TFTP</option><option>SCP</option><option>API</option>
          </select>
        </div>
      </div>
      <div className="form-group"><label className="form-label">{t('config.command')} backup</label><input className="form-control" value={data.backup_command} onChange={set('backup_command')} placeholder="show running-config" /></div>
    </Modal>
  );
}

function ModelsTab() {
  const { t } = useI18n();
  const { can } = usePerms();
  const [models, setModels] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.models().then(d => setModels([...d].sort((a,b)=>(a.vendor+" "+a.model).localeCompare(b.vendor+" "+b.model,undefined,{sensitivity:"base"})))).catch(() => {});
  useEffect(() => { load(); }, []);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
          t('config.model')s d'équipements
        </div>
        {can('config_write') && (
          <button className="btn btn-sm" onClick={() => setModal({})}
            style={{ display:'flex', alignItems:'center', gap:5, borderColor:'var(--ok)', color:'var(--ok)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter
          </button>
        )}
      </div>
      <table>
                <thead>
          <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.model')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.manufacturer')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>Type</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.method')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.command')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>Équip.</th>
            <th style={{ padding:'7px 8px', background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}></th>
          </tr>
        </thead>
        <tbody>
          {models.map(m => (
            <tr key={m.id}>
              <td className="cell-name">{m.model}</td>
              <td>{m.vendor}</td>
              <td><span className="badge badge-muted">{m.device_type}</span></td>
              <td><span className="badge badge-info">{m.backup_method}</span></td>
              <td><span className="cell-mono">{m.backup_command}</span></td>
              <td>{m.device_count}</td>
              <td style={{ textAlign:'right', whiteSpace:'nowrap', padding:'9px 8px' }}>
                <button className="btn btn-sm" style={{marginRight:4}} onClick={() => setModal(m)}>{t('config.edit')}</button>
                <button className="btn btn-sm btn-danger" onClick={() => setConfirm(m)}>Suppr.</button>
              </td>
            </tr>
          ))}
          {models.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('config.no_models')}</td></tr>}
        </tbody>
      </table>
      {modal !== null && <ModelModal model={modal.id ? modal : null} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {confirm && <ConfirmModal message={`Supprimer le modèle "${confirm.model}" ?`} onConfirm={async () => { await api.deleteModel(confirm.id); setConfirm(null); load(); }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

// ── DEVICES ──────────────────────────────────────────────────────────────────

function DeviceModal({device, sites, models, onClose, onSave }) {
  const { t } = useI18n();
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
      footer={<><button className="btn" onClick={onClose}>{t('config.cancel')}</button><button className="btn btn-primary" onClick={submit}>{t('config.save')}</button></>}>
      {error && <Alert type="err">{error}</Alert>}
      <div className="form-group"><label className="form-label">{t('config.name')} *</label><input className="form-control" value={data.name} onChange={set('name')} placeholder="sw-paris-core-01" autoFocus /></div>
      <div className="form-row">
        <div className="form-group"><label className="form-label">Site *</label>
          <select className="form-control" value={data.site_id} onChange={set('site_id')}>
            {(() => {
              const buildTree = (parentId = null, depth = 0) =>
                sites.filter(s => (s.parent_id || null) === parentId)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .flatMap(s => [{ ...s, depth }, ...buildTree(s.id, depth + 1)]);
              return buildTree().map(s => (
                <option key={s.id} value={s.id}>
                  {'　'.repeat(s.depth)}{s.depth > 0 ? '└ ' : ''}{s.name}
                </option>
              ));
            })()}
          </select>
        </div>
        <div className="form-group"><label className="form-label">{t('config.model')} + ' *'</label>
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
  const { t } = useI18n();
  const { can } = usePerms();
  const [devices, setDevices] = useState([]);
  const [sites, setSites] = useState([]);
  const [models, setModels] = useState([]);
  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);

  const load = () => api.devices().then(d => setDevices([...d].sort((a,b)=>a.name.localeCompare(b.name,undefined,{sensitivity:"base"})))).catch(() => {});
  useEffect(() => {
    load();
    api.sites().then(d => setSites([...d].sort((a,b) => a.name.localeCompare(b.name, undefined, {sensitivity:'base'})))).catch(() => {});
    api.models().then(d => setModels([...d].sort((a,b) => (a.vendor+' '+a.model).localeCompare(b.vendor+' '+b.model, undefined, {sensitivity:'base'})))).catch(() => {});
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
          <button className="btn btn-sm" onClick={() => setModal({})}
            style={{ display:'flex', alignItems:'center', gap:5, borderColor:'var(--ok)', color:'var(--ok)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter
          </button>
        )}
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.name')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.model')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>Site</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>IP</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}>{t('config.last_backup')}</th>
            <th style={{ padding:'7px 8px', background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}></th>
          </tr>
        </thead>
        <tbody>
          {devices.map(d => (
            <tr key={d.id}>
              <td className="cell-name">{d.name}</td>
              <td><div>{d.vendor} {d.model_name}</div></td>
              <td><span className="badge badge-info">{d.site_name}</span></td>
              <td><span className="cell-mono">{d.ip}</span></td>
              <td>{d.last_backup ? <span className="cell-sub">v{d.last_backup.version} — {d.last_backup.created_at?.slice(0, 10)}</span> : <span className="badge badge-muted">Aucun</span>}</td>
              <td style={{ textAlign:'right', whiteSpace:'nowrap', padding:'9px 8px' }}>
                <button className="btn btn-sm" style={{marginRight:4}} onClick={() => setModal(d)}>{t('config.edit')}</button>
                <button className="btn btn-sm" style={{marginRight:4}} title={t('config.duplicate')} onClick={() => duplicateDevice(d)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  t('config.duplicate')
                </button>
                <button className="btn btn-sm btn-danger" onClick={() => setConfirm(d)}>Suppr.</button>
              </td>
            </tr>
          ))}
          {devices.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('config.no_devices')}</td></tr>}
        </tbody>
      </table>
      {modal !== null && <DeviceModal device={modal.id ? modal : null} sites={sites} models={models} onClose={() => setModal(null)} onSave={() => { setModal(null); load(); }} />}
      {confirm && <ConfirmModal message={`Supprimer l'équipement "${confirm.name}" ?`} onConfirm={async () => {
        try {
          await api.deleteDevice(confirm.id); setConfirm(null); load();
        } catch(e) {
          setConfirm(null);
          alert(e.message || 'Erreur lors de la suppression');
        }
      }} onCancel={() => setConfirm(null)} />}
    </div>
  );
}


// OPTIONS
function OptionsTab({ onFlagsChange }) {
  const { t } = useI18n();
  const { can } = usePerms();
  const cw = can('config_write');
  const [flags, setFlags] = useState(null);
  const [msg, setMsg] = useState('');
  const [countries, setCountries] = useState([]);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState(null);
  const [drag, setDrag] = useState(null);
  const [over, setOver] = useState(null);
  const [sites, setSites] = useState([]);
  const loadC = () => { api.getCountries().then(setCountries).catch(()=>{}); api.sites().then(setSites).catch(()=>{}); };
  useEffect(() => { api.getFeatureFlags().then(f=>{setFlags(f);if(f.countries)loadC();}).catch(()=>setFlags({})); }, []);
  const toggle = async key => {
    const nf={...flags,[key]:!flags[key]}; setFlags(nf);
    await api.setFeatureFlags(nf).catch(()=>{});
    setMsg('Sauvegarde.'); setTimeout(()=>setMsg(''),2000);
    if(nf.countries)loadC(); onFlagsChange&&onFlagsChange(nf);
  };
  const addC = async()=>{if(!newName.trim())return;await api.addCountry(newName.trim()).catch(()=>{});setNewName('');setAdding(false);loadC();};
  const saveC = async()=>{if(!editing)return;await api.updateCountry(editing.id,{name:editing.name}).catch(()=>{});setEditing(null);loadC();};
  const delC = async id=>{if(!window.confirm('Supprimer ce pays ?'))return;await api.deleteCountry(id).catch(()=>{});loadC();};
  const dropC = async tid=>{ if(!drag||drag===tid){setDrag(null);setOver(null);return;} const list=[...countries];const fi=list.findIndex(x=>x.id===drag);const ti=list.findIndex(x=>x.id===tid);const [it]=list.splice(fi,1);list.splice(ti,0,it);setCountries(list);setDrag(null);setOver(null);await api.reorderCountries(list.map(x=>x.id)).catch(()=>{});loadC(); };
  const cnt=cid=>sites.filter(s=>s.country_id===cid).length;
  const una=sites.filter(s=>!s.country_id);
  if(!flags)return <div style={{padding:24,color:'var(--muted)'}}>Chargement...</div>;
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div className="card">
        <div className="card-header"><div className="card-title">{t('config.options_tab')}</div></div>
        <div style={{padding:'14px 18px',display:'flex',flexDirection:'column',gap:10}}>
          <label style={{display:'flex',alignItems:'flex-start',gap:12,cursor:'pointer',padding:'12px 14px',borderRadius:'var(--r)',background:flags.countries?'var(--acc-s)':'var(--surf2)',border:`1px solid ${flags.countries?'var(--acc)':'var(--brd)'}`,transition:'all .15s'}}>
            <input type="checkbox" checked={!!flags.countries} onChange={()=>toggle('countries')} style={{marginTop:2,accentColor:'var(--acc)',width:16,height:16}}/>
            <div><div style={{fontWeight:600,fontSize:13}}>Activer l'option Pays</div><div style={{fontSize:12,color:'var(--muted)',marginTop:2}}>Regroupe les sites par pays dans Appareils et Backups.</div></div>
          </label>
          {msg&&<div className="alert alert-ok" style={{fontSize:12}}>{msg}</div>}
        </div>
      </div>
      {flags.countries&&(
        <div className="card">
          <div className="card-header">
            <div className="card-title">Pays</div>
            {cw&&!adding&&<button className="btn btn-primary" onClick={()=>setAdding(true)} style={{marginLeft:'auto',fontSize:12}}>+ Ajouter un pays</button>}
          </div>
          <div style={{padding:'10px 18px 16px'}}>
            <p style={{fontSize:12,color:'var(--muted)',marginBottom:10}}>Glissez pour reordonner.</p>
            {adding&&<div style={{display:'flex',gap:8,marginBottom:12,alignItems:'center'}}><input className="form-control" autoFocus value={newName} placeholder={`${t('config.name')} du pays`} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')addC();if(e.key==='Escape'){setAdding(false);setNewName('');}}} style={{maxWidth:280}}/><button className="btn btn-primary" onClick={addC}>{t('config.add')}</button><button className="btn" onClick={()=>{setAdding(false);setNewName('');}}>{t('config.cancel')}</button></div>}
            {countries.length===0&&!adding?<div style={{textAlign:'center',color:'var(--muted)',fontSize:13,padding:'16px 0'}}>Aucun pays configure.</div>:
            <div style={{display:'flex',flexDirection:'column',gap:4}}>
              {countries.map(ct=>(
                <div key={ct.id} draggable={cw} onDragStart={()=>setDrag(ct.id)} onDragOver={e=>{e.preventDefault();setOver(ct.id);}} onDrop={()=>dropC(ct.id)} onDragEnd={()=>{setDrag(null);setOver(null);}}
                  style={{display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:'var(--r)',cursor:cw?'grab':'default',background:over===ct.id?'var(--acc-s)':'var(--surf2)',border:`1px solid ${over===ct.id?'var(--acc)':'var(--brd)'}`}}>
                  {cw&&<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13,color:'var(--muted)'}}><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>}
                  {editing&&editing.id===ct.id?<input className="form-control" autoFocus value={editing.name} onChange={e=>setEditing(ed=>({...ed,name:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter')saveC();if(e.key==='Escape')setEditing(null);}} style={{flex:1,maxWidth:250,height:28,padding:'3px 8px'}}/>:<span style={{flex:1,fontWeight:600,fontSize:13}}>{ct.name}</span>}
                  <span style={{fontSize:11,color:'var(--muted)'}}>{cnt(ct.id)} site{cnt(ct.id)!==1?'s':''}</span>
                  {cw&&<div style={{display:'flex',gap:4}}>{editing&&editing.id===ct.id?<><button className="btn btn-sm btn-primary" onClick={saveC}>&#10003;</button><button className="btn btn-sm" onClick={()=>setEditing(null)}>&#10005;</button></>:<><button className="btn btn-sm" onClick={()=>setEditing({id:ct.id,name:ct.name})}>{t('config.edit')}</button><button className="btn btn-sm btn-danger" onClick={()=>delC(ct.id)}>Suppr.</button></>}</div>}
                </div>
              ))}
            </div>}
            {una.length>0&&<div style={{marginTop:14,padding:'10px 14px',background:'var(--warn-s)',border:'1px solid var(--warn)',borderRadius:'var(--r)'}}><div style={{fontSize:12,fontWeight:700,color:'var(--warn)',marginBottom:6}}>{una.length} site{una.length>1?'s':''} sans pays</div>{una.map(s=>(<div key={s.id} style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginBottom:4}}><span style={{color:'var(--muted)'}}>&#8226; {s.name}</span>{cw&&<select className="form-control" style={{fontSize:11,height:24,padding:'0 4px',width:'auto'}} onChange={async e=>{if(e.target.value){await api.setSiteCountry(s.id,parseInt(e.target.value)).catch(()=>{});loadC();setSites(p=>p.map(x=>x.id===s.id?{...x,country_id:parseInt(e.target.value)}:x));}}}><option value="">Assigner...</option>{countries.map(ct=><option key={ct.id} value={ct.id}>{ct.name}</option>)}</select>}</div>))}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

const TABS = [
  { key: 'sites',   label: 'Sites',        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /></svg> },
  { key: 'models',  label: 'Models',      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M12 2L2 7l10 5 10-5-10-5z" /></svg> },
  { key: 'devices', label: 'Équipements',  icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><rect x="2" y="7" width="20" height="14" rx="2" /></svg> },
  { key: 'options', label: 'Options', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg> },
];

// Version embedded : tabs horizontaux + state local (pas de useSearchParams)
export function ConfigEmbedded() {
  const [active, setActive] = useState('sites');
  const [flags, setFlags] = useState({});
  const [countries, setCountries] = useState([]);
  const { can, isAdmin } = usePerms();
  const reload = () => api.getCountries().then(setCountries).catch(()=>{});
  useEffect(() => { api.getFeatureFlags().then(f=>{setFlags(f);if(f.countries)reload();}).catch(()=>{}); }, []);
  const tabs = TABS.filter(tab => tab.key !== 'options' || isAdmin || can('config_options'));
  return (
    <div>
      <div style={{display:'flex',gap:2,marginBottom:16,borderBottom:'1px solid var(--brd)'}}>
        {tabs.map(tab =><button key={tab.key} onClick={()=>setActive(tab.key)} style={{display:'flex',alignItems:'center',gap:6,padding:'9px 16px',background:'none',border:'none',borderBottom:active===tab.key?'2px solid var(--acc)':'2px solid transparent',color:active===tab.key?'var(--acc)':'var(--muted)',fontWeight:active===tab.key?600:500,fontSize:13,cursor:'pointer',fontFamily:'var(--font)',marginBottom:-1,transition:'color .15s'}}>{tab.icon}{tab.label}</button>)}
      </div>
      <div>
        {active==='sites'&&<SitesTab countries={flags.countries?countries:[]}/>}
        {active==='models'&&<ModelsTab/>}
        {active==='devices'&&<DevicesTab/>}
        {active==='options'&&(isAdmin||can('config_options'))&&<OptionsTab onFlagsChange={f=>{setFlags(f);if(f.countries)reload();}}/>}
      </div>
    </div>
  );
}
export default function Config() {
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();
  const active = sp.get('tab')||'sites';
  const setTab = tabKey=>setSp({tab:tabKey});
  const [flags, setFlags] = useState({});
  const [countries, setCountries] = useState([]);
  const reload = ()=>api.getCountries().then(setCountries).catch(()=>{});
  useEffect(()=>{api.getFeatureFlags().then(f=>{setFlags(f);if(f.countries)reload();}).catch(()=>{});}, []);
  const { can, isAdmin } = usePerms();
  const tabs = TABS.filter(tab => tab.key !== 'options' || isAdmin || can('config_options'));
  return (
    <main>
      <div className="page-header"><div><div className="page-title">Appareils</div><div className="page-sub">Gestion des equipements, sites et modeles</div></div></div>
      <div className="config-layout">
        <div className="side-menu">
          {tabs.map(tab =><div key={tab.key} className={`side-item ${active===tab.key?'active':''}`} onClick={()=>setTab(tab.key)}>{tab.icon}{tab.label}</div>)}
        </div>
        <div>
          {active==='sites'&&<SitesTab countries={flags.countries?countries:[]}/>}
          {active==='models'&&<ModelsTab/>}
          {active==='devices'&&<DevicesTab/>}
          {active==='options'&&<OptionsTab onFlagsChange={f=>{setFlags(f);if(f.countries)reload();}}/>}
        </div>
      </div>
    </main>
  );
}
