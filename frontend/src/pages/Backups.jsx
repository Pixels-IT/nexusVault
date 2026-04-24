import { useEffect, useState, useCallback, useRef } from 'react';
import { usePerms } from '../hooks/usePerms.js';
import AccessDenied from '../components/AccessDenied.jsx';
import api from '../api.js';
import { Modal, Alert, Spinner } from '../components/UI.jsx';

// ── HELPERS ────────────────────────────────────────────────────────────────────
function statusBadge(s) {
  if (s === 'ok')    return <span className="badge badge-ok"><span className="dot dot-ok"/>OK</span>;
  if (s === 'warn')  return <span className="badge badge-warn"><span className="dot dot-warn"/>Modifié</span>;
  if (s === 'error') return <span className="badge badge-err"><span className="dot dot-err"/>Erreur</span>;
  return <span className="badge badge-muted">{s}</span>;
}
function fmtDate(dt) { return dt ? dt.slice(0,10) + ' ' + dt.slice(11,16) : '—'; }
function fmtSize(b) {
  if (!b) return '—';
  return b < 1024 ? `${b} o` : `${(b/1024).toFixed(1)} Ko`;
}

// ── VUE CONTENU ───────────────────────────────────────────────────────────────
function ContentView({ backup, onClose }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    api.backupContent(backup.id)
      .then(r => setContent(r.content))
      .catch(() => setContent('Erreur de chargement'))
      .finally(() => setLoading(false));
  }, [backup.id]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width:'80vw', maxWidth:1100, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div className="modal-header" style={{ flexShrink:0 }}>
          <div>
            <div className="modal-title">{backup.device_name} — v{backup.version}</div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:3, display:'flex', gap:12 }}>
              <span>{fmtDate(backup.created_at)}</span>
              <span>{fmtSize(backup.size_bytes)}</span>
              {backup.note && <span>📝 {backup.note}</span>}
            </div>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-sm" onClick={() => navigator.clipboard?.writeText(content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })} disabled={loading}>
              {copied ? '✓ Copié' : 'Copier'}
            </button>
            <button className="btn btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>
          {loading ? <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1 }}><Spinner /></div> : (
            <div style={{ flex:1, overflow:'auto', background:'var(--surf2)', borderTop:'1px solid var(--brd)' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'var(--mono)', fontSize:12, lineHeight:1.7 }}>
                <tbody>
                  {content.split('\n').map((line, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--brd)' }}>
                      <td style={{ width:48, textAlign:'right', padding:'0 10px', color:'var(--muted)', fontSize:11, userSelect:'none', background:'var(--surf)', borderRight:'1px solid var(--brd)', verticalAlign:'top' }}>{i+1}</td>
                      <td style={{ padding:'0 16px', whiteSpace:'pre', color: line.startsWith('!')||line.startsWith('#') ? 'var(--muted)' : 'var(--txt)', fontStyle: line.startsWith('!')||line.startsWith('#') ? 'italic' : 'normal', fontWeight: /^(hostname|interface|vlan|router|spanning-tree mode)/i.test(line.trim()) ? 600 : 'normal' }}>{line||' '}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ flexShrink:0 }}>
          <span style={{ fontSize:11, color:'var(--muted)' }}>{content.split('\n').length} lignes · {fmtSize(backup.size_bytes)}</span>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ── DIFF ──────────────────────────────────────────────────────────────────────
function DiffView({ idA, idB, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [showCtx, setShowCtx] = useState(true);

  useEffect(() => { api.diff(idA, idB).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false)); }, [idA, idB]);

  function buildHunks(diff) {
    if (!diff) return [];
    const CTX = 3; const changed = new Set();
    diff.forEach((l, i) => { if (l.type !== 'ctx') changed.add(i); });
    const visible = new Set();
    changed.forEach(i => { for (let k=Math.max(0,i-CTX); k<=Math.min(diff.length-1,i+CTX); k++) visible.add(k); });
    const hunks = []; let cur = null;
    diff.forEach((line, i) => {
      if (!showCtx && line.type==='ctx' && !visible.has(i)) { if (cur) { hunks.push(cur); cur=null; } return; }
      if (!cur) cur = { start:i, lines:[] };
      cur.lines.push({ ...line, idx:i });
    });
    if (cur) hunks.push(cur);
    return hunks;
  }

  const hunks = data ? buildHunks(data.diff) : [];
  return (
    <div className="modal-overlay" onClick={e => e.target===e.currentTarget && onClose()}>
      <div className="modal" style={{ width:'85vw', maxWidth:1200, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div className="modal-header" style={{ flexShrink:0 }}>
          <span className="modal-title">Comparaison de versions</span>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, cursor:'pointer', color:'var(--muted)' }}>
              <input type="checkbox" checked={showCtx} onChange={e => setShowCtx(e.target.checked)} /> Contexte
            </label>
            <button className="btn btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>
        <div style={{ flex:1, overflow:'auto', minHeight:0 }}>
          {loading && <div style={{ textAlign:'center', padding:40 }}><Spinner /></div>}
          {error && <div style={{ padding:20 }}><Alert type="err">{error}</Alert></div>}
          {data && <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', borderBottom:'1px solid var(--brd)', flexShrink:0 }}>
              {[data.version_a, data.version_b].map((v, i) => (
                <div key={i} style={{ padding:'12px 20px', background: i===0 ? 'var(--err-s)' : 'var(--ok-s)', borderRight: i===0 ? '1px solid var(--brd)' : 'none', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.4px', color: i===0 ? 'var(--err)' : 'var(--ok)', marginBottom:2 }}>{i===0 ? '← Version A (ancienne)' : 'Version B (actuelle) →'}</div>
                    <div style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:16 }}>v{v.version}</div>
                    <div style={{ fontSize:11, color:'var(--muted)' }}>{fmtDate(v.created_at)}</div>
                  </div>
                  <span style={{ fontSize:28, fontWeight:700, opacity:.12 }}>{i===0 ? '−' : '+'}</span>
                </div>
              ))}
            </div>
            <div style={{ padding:'8px 20px', borderBottom:'1px solid var(--brd)', display:'flex', gap:12, alignItems:'center', background:'var(--surf2)', flexShrink:0 }}>
              <span style={{ fontSize:12, color:'var(--muted)' }}>Résumé :</span>
              <span className="badge badge-ok" style={{ fontWeight:700 }}>+{data.added} ajout{data.added>1?'s':''}</span>
              <span className="badge badge-err" style={{ fontWeight:700 }}>−{data.removed} suppression{data.removed>1?'s':''}</span>
              <span style={{ marginLeft:'auto', fontSize:11, color:'var(--muted)' }}>{data.diff.length} lignes</span>
            </div>
            {hunks.length === 0
              ? <div style={{ padding:32, textAlign:'center', color:'var(--muted)' }}>Aucune différence</div>
              : <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:'var(--mono)', fontSize:12 }}>
                  <thead>
                    <tr style={{ background:'var(--surf2)', borderBottom:'2px solid var(--brd)' }}>
                      <th style={{ width:44, textAlign:'right', padding:'5px 10px', fontSize:11, color:'var(--muted)', fontWeight:600, borderRight:'1px solid var(--brd)' }}>A</th>
                      <th style={{ width:44, textAlign:'right', padding:'5px 10px', fontSize:11, color:'var(--muted)', fontWeight:600, borderRight:'1px solid var(--brd)' }}>B</th>
                      <th style={{ width:28, textAlign:'center', padding:'5px 6px', fontSize:11, borderRight:'1px solid var(--brd)' }}></th>
                      <th style={{ padding:'5px 16px', fontSize:11, color:'var(--muted)', fontWeight:600, textAlign:'left' }}>Contenu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hunks.map((hunk, hi) => (
                      <>
                        {hi>0 && !showCtx && (
                          <tr key={`sep-${hi}`} style={{ background:'var(--acc-s)' }}>
                            <td colSpan={4} style={{ padding:'3px 16px', fontSize:11, color:'var(--acc)', fontWeight:600 }}>↕ lignes masquées</td>
                          </tr>
                        )}
                        {hunk.lines.map((line, li) => {
                          const isAdd=line.type==='add', isRem=line.type==='rem';
                          return (
                            <tr key={`${hi}-${li}`} style={{ background: isAdd?'var(--ok-s)': isRem?'var(--err-s)':'transparent', borderBottom:'1px solid var(--brd)' }}>
                              <td style={{ width:44, textAlign:'right', padding:'1px 8px', background: isAdd?'#c3efcc': isRem?'#f5c6c6':'var(--surf)', borderRight:'1px solid var(--brd)', color:'var(--muted)', fontSize:11, userSelect:'none', lineHeight:1.8 }}>{isRem||line.type==='ctx' ? (line.lineA||'') : ''}</td>
                              <td style={{ width:44, textAlign:'right', padding:'1px 8px', background: isAdd?'#c3efcc': isRem?'#f5c6c6':'var(--surf)', borderRight:'1px solid var(--brd)', color:'var(--muted)', fontSize:11, userSelect:'none', lineHeight:1.8 }}>{isAdd||line.type==='ctx' ? (line.lineB||'') : ''}</td>
                              <td style={{ width:28, textAlign:'center', padding:'1px 4px', background: isAdd?'#c3efcc': isRem?'#f5c6c6':'var(--surf)', borderRight:'1px solid var(--brd)', color: isAdd?'var(--ok)': isRem?'var(--err)':'var(--muted)', fontWeight:700, userSelect:'none', lineHeight:1.8 }}>{isAdd?'+': isRem?'−':' '}</td>
                              <td style={{ padding:'1px 16px', whiteSpace:'pre', color: isAdd?'#155724': isRem?'#721c24':'var(--txt)', lineHeight:1.8, overflow:'hidden', textOverflow:'ellipsis', maxWidth:0 }}>{line.line}</td>
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
            }
          </>}
        </div>
        <div className="modal-footer" style={{ flexShrink:0 }}>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ── UPLOAD MODAL ──────────────────────────────────────────────────────────────
function UploadModal({ devices, onClose, onDone }) {
  const [deviceId, setDeviceId] = useState(String(devices[0]?.id || ''));
  const [content, setContent]   = useState('');
  const [note, setNote]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const fileRef = useRef(null);

  const selected = devices.find(d => String(d.id) === String(deviceId));

  function readFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setContent(ev.target.result);
    reader.readAsText(file, 'utf-8');
  }

  async function submit() {
    setError(''); setLoading(true);
    try {
      await api.uploadBackup(deviceId, content, note);
      onDone();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Importer un backup" onClose={loading ? undefined : onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={loading}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading || !content.trim() || !deviceId}>
          {loading ? 'Import…' : 'Importer'}
        </button>
      </>}>
      {error && <Alert type="err">{error}</Alert>}
      <div className="form-group">
        <label className="form-label">Équipement cible</label>
        <select className="form-control" value={deviceId} onChange={e => setDeviceId(e.target.value)}>
          {devices.map(d => <option key={d.id} value={d.id}>{d.name} — {d.site_name}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Fichier de configuration (.txt, .cfg, .conf…)</label>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <input type="file" ref={fileRef} accept=".txt,.cfg,.conf,.log" onChange={readFile} style={{ display:'none' }} />
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Choisir un fichier
          </button>
          {content && <span style={{ fontSize:12, color:'var(--ok)', fontWeight:600 }}>✓ {content.split('\n').length} lignes chargées</span>}
        </div>
      </div>
      {content && (
        <div style={{ marginBottom:14 }}>
          <label className="form-label">Aperçu (5 premières lignes)</label>
          <pre style={{ fontFamily:'var(--mono)', fontSize:11, background:'var(--surf2)', border:'1px solid var(--brd)', padding:'8px 12px', borderRadius:'var(--r)', color:'var(--txt)', maxHeight:100, overflow:'auto', whiteSpace:'pre-wrap' }}>
            {content.split('\n').slice(0,5).join('\n')}…
          </pre>
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Note</label>
        <input className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="ex : Config exportée manuellement" />
      </div>
    </Modal>
  );
}

// ── TRIGGER (SSH) MODAL ───────────────────────────────────────────────────────
function TriggerModal({ devices, onClose, onDone }) {
  const [query, setQuery]       = useState('');
  const [deviceId, setDeviceId] = useState(String(devices[0]?.id || ''));
  const [note, setNote]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [sshLog, setSshLog]     = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const selectedDevice = devices.find(d => String(d.id) === String(deviceId));

  // Autocomplétion : filtre par nom d'équipement ou de site
  const suggestions = query.trim().length > 0
    ? devices.filter(d => {
        const q = query.toLowerCase();
        return d.name?.toLowerCase().includes(q) || d.site_name?.toLowerCase().includes(q);
      }).slice(0, 8)
    : [];

  function pickDevice(d) {
    setDeviceId(String(d.id));
    setQuery(`${d.name} — ${d.site_name}`);
    setShowSuggestions(false);
  }

  async function submit() {
    setError(''); setSshLog(''); setLoading(true);
    setSshLog(`Connexion SSH à ${selectedDevice?.ip||'?'}:${selectedDevice?.ssh_port||22}…\nCommande : ${selectedDevice?.backup_command||'show running-config'}\n`);
    try {
      const result = await api.triggerBackup(deviceId, note);
      setSshLog(prev => prev + `\n✓ Backup v${result.version} créé avec succès.`);
      setTimeout(onDone, 900);
    } catch (e) {
      setError(e.message);
      setSshLog(prev => prev + `\n✗ Erreur : ${e.message}`);
    } finally { setLoading(false); }
  }

  return (
    <Modal title="Nouveau backup SSH" onClose={loading ? undefined : onClose}
      footer={<>
        <button className="btn" onClick={onClose} disabled={loading}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading || !deviceId}>
          {loading ? <><span className="spinner" style={{ width:13, height:13, borderWidth:2 }} /> Connexion SSH…</> : 'Lancer le backup'}
        </button>
      </>}>
      {error && <Alert type="err">{error}</Alert>}

      {/* Champ avec autocomplétion */}
      <div className="form-group" style={{ position:'relative' }}>
        <label className="form-label">Rechercher un équipement</label>
        <input
          className="form-control"
          value={query}
          onChange={e => { setQuery(e.target.value); setShowSuggestions(true); if (!e.target.value) setDeviceId(''); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
          placeholder="Tapez le nom ou le site…"
          disabled={loading}
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300, background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:'var(--r)', boxShadow:'0 6px 20px rgba(0,0,0,.15)', maxHeight:220, overflowY:'auto', marginTop:2 }}>
            {suggestions.map(d => (
              <div key={d.id}
                onMouseDown={() => pickDevice(d)}
                style={{ padding:'9px 14px', cursor:'pointer', borderBottom:'1px solid var(--brd)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{d.name}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>{d.vendor} {d.model_name}</div>
                </div>
                <span className="badge badge-info">{d.site_name}</span>
              </div>
            ))}
          </div>
        )}
        {query && !suggestions.length && showSuggestions && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:300, background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:'var(--r)', padding:'10px 14px', fontSize:12, color:'var(--muted)', marginTop:2 }}>
            Aucun équipement correspondant
          </div>
        )}
      </div>

      {selectedDevice && (
        <div style={{ background:'var(--surf2)', border:'1px solid var(--brd)', borderRadius:'var(--r)', padding:'10px 12px', marginBottom:14, fontSize:12 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px' }}>
            <div><span style={{ color:'var(--muted)', fontSize:11 }}>IP</span><br/><span style={{ fontFamily:'var(--mono)', fontWeight:600 }}>{selectedDevice.ip||'—'}</span></div>
            <div><span style={{ color:'var(--muted)', fontSize:11 }}>Port SSH</span><br/><span style={{ fontFamily:'var(--mono)', fontWeight:600 }}>{selectedDevice.ssh_port||'22'}</span></div>
            <div style={{ marginTop:6 }}><span style={{ color:'var(--muted)', fontSize:11 }}>Utilisateur</span><br/><span style={{ fontFamily:'var(--mono)', fontWeight:600 }}>{selectedDevice.ssh_user||'—'}</span></div>
            <div style={{ marginTop:6 }}><span style={{ color:'var(--muted)', fontSize:11 }}>Méthode</span><br/><span className="badge badge-info" style={{ marginTop:2 }}>{selectedDevice.backup_method||'SSH'}</span></div>
          </div>
          <div style={{ marginTop:8, paddingTop:8, borderTop:'1px solid var(--brd)' }}>
            <span style={{ color:'var(--muted)', fontSize:11 }}>Commande</span><br/>
            <code style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--acc)', fontWeight:600 }}>{selectedDevice.backup_command||'show running-config'}</code>
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">Note (optionnel)</label>
        <input className="form-control" value={note} onChange={e => setNote(e.target.value)} placeholder="ex : Ajout VLAN 40" disabled={loading} />
      </div>
      {sshLog && (
        <div style={{ marginTop:8 }}>
          <label className="form-label">Journal SSH</label>
          <pre style={{ fontFamily:'var(--mono)', fontSize:11, lineHeight:1.7, background:'var(--surf2)', border:'1px solid var(--brd)', padding:'10px 12px', borderRadius:'var(--r)', color:'var(--txt)', maxHeight:120, overflowY:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>{sshLog}</pre>
        </div>
      )}
    </Modal>
  );
}

// ── VERSION ROW ───────────────────────────────────────────────────────────────
function VersionRow({ backup, onView, onSelectCompare, compareMode, selected, onPin, onDelete }) {
  const isSelected = selected.includes(backup.id);
  const isPinned   = !!backup.pinned;
  return (
    <tr style={{ background: isSelected ? 'var(--acc-s)' : isPinned ? 'rgba(247,103,7,0.06)' : undefined, borderLeft: `3px solid ${isPinned ? 'var(--warn)' : 'transparent'}` }}>
      {compareMode && <td style={{ width:36, paddingLeft:12 }}><input type="checkbox" checked={isSelected} onChange={() => onSelectCompare(backup.id)} /></td>}
      <td style={{ width:90 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span className="cell-mono" style={{ fontSize:12 }}>v{backup.version}</span>
          {isPinned && <span style={{ fontSize:9, fontWeight:700, background:'var(--warn-s)', color:'var(--warn)', padding:'1px 4px', borderRadius:3, lineHeight:1.5 }}>📌</span>}
        </div>
      </td>
      <td style={{ width:140, whiteSpace:'nowrap', fontSize:12 }}>{fmtDate(backup.created_at)}</td>
      <td className="cell-sub" style={{ width:72 }}>{fmtSize(backup.size_bytes)}</td>
      <td style={{ width:90 }}>{statusBadge(backup.status)}</td>
      <td style={{ fontSize:12, color: backup.note ? 'var(--txt)' : 'var(--muted)' }}>{backup.note||'—'}</td>
      <td className="cell-sub" style={{ width:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{backup.triggered_by}</td>
      <td>
        <div style={{ display:'flex', gap:4 }}>
          <button className="btn btn-sm" onClick={() => onView(backup)}>Voir</button>
          <button className="btn btn-sm" title={isPinned ? 'Désépingler' : 'Épingler'} onClick={() => onPin(backup)}
            style={{ color: isPinned ? 'var(--warn)' : 'var(--muted)', borderColor: isPinned ? 'var(--warn)' : undefined }}>
            <svg viewBox="0 0 24 24" fill={isPinned ? 'var(--warn)' : 'none'} stroke={isPinned ? 'var(--warn)' : 'var(--muted)'} strokeWidth="2" style={{ width:13, height:13 }}>
              <line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/>
            </svg>
          </button>
          {!isPinned && (
            <button className="btn btn-sm btn-danger" title="Supprimer" onClick={() => onDelete(backup)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:12, height:12 }}>
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
              </svg>
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}


// ── ICONE PAR TYPE D'ÉQUIPEMENT ───────────────────────────────────────────────
function DeviceTypeIcon({ type }) {
  const t = (type || '').toLowerCase();
  const style = { width: 15, height: 15, flexShrink: 0 };

  if (t.includes('core') || t.includes('routeur') || t.includes('router'))
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} title={type}>
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12"/>
      </svg>
    );

  if (t.includes('distrib') || t.includes('aggreg'))
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} title={type}>
        <rect x="2" y="7" width="20" height="10" rx="2"/>
        <circle cx="6" cy="12" r="1" fill="currentColor"/>
        <circle cx="10" cy="12" r="1" fill="currentColor"/>
        <circle cx="14" cy="12" r="1" fill="currentColor"/>
        <circle cx="18" cy="12" r="1" fill="currentColor"/>
      </svg>
    );

  if (t.includes('firewall') || t.includes('pare-feu') || t.includes('pare') || t.includes('fortigate') || t.includes('forti'))
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} title={type}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    );

  if (t.includes('wifi') || t.includes('ap ') || t.includes('wireless') || t.includes('access point'))
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} title={type}>
        <path d="M1.42 9a16 16 0 0 1 21.16 0M5 12.55a11 11 0 0 1 14.08 0M10.54 16.1a6 6 0 0 1 2.92 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>
      </svg>
    );

  if (t.includes('nas') || t.includes('storage') || t.includes('san'))
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} title={type}>
        <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    );

  if (t.includes('switch'))
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} title={type}>
        <rect x="2" y="7" width="20" height="10" rx="2"/>
        <circle cx="7" cy="12" r="1" fill="currentColor"/>
        <circle cx="11" cy="12" r="1" fill="currentColor"/>
        <circle cx="15" cy="12" r="1" fill="currentColor"/>
      </svg>
    );

  // Access / default
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={style} title={type || 'Access'}>
      <rect x="2" y="7" width="20" height="10" rx="2"/>
      <circle cx="7" cy="12" r="1" fill="currentColor"/>
      <circle cx="11" cy="12" r="1" fill="currentColor"/>
    </svg>
  );
}

// Types distincts extraits des équipements
function getDistinctTypes(devices) {
  const types = [...new Set(devices.map(d => d.device_type || d.model_type || '').filter(Boolean))];
  return types.sort();
}

// ── DEVICE SECTION ────────────────────────────────────────────────────────────
function DeviceSection({ device, compareMode, selected, onSelectCompare, onView, onDelete, defaultOpen }) {
  const [open, setOpen]       = useState(false);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded]   = useState(false);

  function toggle() {
    if (!open && !loaded) {
      setLoading(true);
      api.backups({ device_id: device.id })
        .then(data => { setBackups(data); setLoaded(true); })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    setOpen(o => !o);
  }

  async function handlePinLocal(backup) {
    try {
      const result = await api.pinBackup(backup.id);
      setBackups(prev => prev.map(b => b.id === backup.id ? { ...b, pinned: result.pinned } : b));
    } catch (e) { alert('Erreur : ' + e.message); }
  }

  return (
    <div style={{ marginBottom:2 }}>
      <div onClick={toggle} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 16px', background: open ? 'var(--acc-s)' : 'var(--surf2)', borderLeft:`3px solid ${open ? 'var(--acc)' : 'var(--brd)'}`, cursor:'pointer', borderBottom:'1px solid var(--brd)', transition:'background .15s', userSelect:'none' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width:14, height:14, color:'var(--muted)', transition:'transform .2s', transform: open ? 'rotate(90deg)' : 'none', flexShrink:0 }}><polyline points="9 18 15 12 9 6"/></svg>
        <span style={{ color: open ? 'var(--acc)' : 'var(--muted)' }}>
          <DeviceTypeIcon type={device.device_type} />
        </span>
        <div style={{ flex:1, minWidth:0 }}>
          <span style={{ fontWeight:600, fontSize:13 }}>{device.name}</span>
          <span style={{ fontSize:11, color:'var(--muted)', marginLeft:10 }}>{device.vendor} {device.model_name}</span>
          <span className="cell-mono" style={{ marginLeft:10, fontSize:11 }}>{device.ip}</span>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
          {device.last_backup
            ? <>{statusBadge(device.last_backup.status)}<span className="cell-sub">v{device.last_backup.version} · {device.last_backup.created_at?.slice(0,10)}</span></>
            : <span className="badge badge-muted">Aucun backup</span>}
        </div>
      </div>
      {open && (
        <div style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf)' }}>
          {loading ? <div style={{ padding:16, textAlign:'center' }}><Spinner /></div>
          : backups.length === 0 ? <div style={{ padding:16, textAlign:'center', color:'var(--muted)', fontSize:12 }}>Aucun backup</div>
          : <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ background:'var(--surf2)' }}>
                  {compareMode && <th style={{ width:36 }}></th>}
                  <th style={{ width:90, paddingLeft:48 }}>Ver.</th>
                  <th style={{ width:140, whiteSpace:'nowrap' }}>Date</th>
                  <th style={{ width:72 }}>Taille</th>
                  <th style={{ width:90 }}>Statut</th>
                  <th>Note</th>
                  <th style={{ width:110 }}>Déclenché</th>
                  <th style={{ width:100 }}></th>
                </tr>
              </thead>
              <tbody>
                {backups.map(b => (
                  <VersionRow key={b.id} backup={b}
                    onView={onView} compareMode={compareMode} selected={selected}
                    onSelectCompare={onSelectCompare}
                    onPin={handlePinLocal} onDelete={onDelete} />
                ))}
              </tbody>
            </table>}
        </div>
      )}
    </div>
  );
}

// ── SITE SECTION (draggable) ──────────────────────────────────────────────────
function SiteSection({ site, devices, compareMode, selected, onSelectCompare, onView, onDelete, dragHandleProps, forceOpen }) {
  const [open, setOpen] = useState(false);

  // Dépliage automatique quand forceOpen change
  useEffect(() => {
    if (forceOpen) setOpen(true);
    else if (forceOpen === false) setOpen(false);
  }, [forceOpen]);
  const siteDevices = [...devices.filter(d => d.site_id === site.id)]
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const withBackup = siteDevices.filter(d => d.last_backup).length;

  return (
    <div style={{ marginBottom:12, border:'1px solid var(--brd)', borderRadius:'var(--rl)', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', background:'var(--surf)', cursor:'pointer', borderBottom: open ? '1px solid var(--brd)' : 'none', userSelect:'none' }}>
        {/* Poignée de glissement */}
        <div {...dragHandleProps} title="Glisser pour réordonner" style={{ cursor:'grab', padding:'2px 4px', color:'var(--muted)', flexShrink:0 }} onClick={e => e.stopPropagation()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14 }}>
            <line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/>
          </svg>
        </div>
        <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', gap:10, flex:1 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ width:15, height:15, color:'var(--muted)', transition:'transform .2s', transform: open ? 'rotate(90deg)' : 'none', flexShrink:0 }}><polyline points="9 18 15 12 9 6"/></svg>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:18, height:18, color:'var(--acc)', flexShrink:0 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          <div style={{ flex:1 }}>
            <span style={{ fontWeight:700, fontSize:14 }}>{site.name}</span>
            {site.location && <span style={{ fontSize:12, color:'var(--muted)', marginLeft:10 }}>{site.location}</span>}
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
            <span className="badge badge-info">{siteDevices.length} équipement{siteDevices.length>1?'s':''}</span>
            <span className="badge badge-ok">{withBackup} avec backup</span>
          </div>
        </div>
      </div>
      {open && (
        <div>
          {siteDevices.length === 0
            ? <div style={{ padding:16, textAlign:'center', color:'var(--muted)', fontSize:12 }}>Aucun équipement</div>
            : siteDevices.map(d => (
                <DeviceSection key={d.id} device={d}
                  compareMode={compareMode} selected={selected}
                  onSelectCompare={onSelectCompare} onView={onView} onDelete={onDelete} />
              ))
          }
        </div>
      )}
    </div>
  );
}

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
const PREF_KEY = 'site_order';

export default function Backups() {
  const [sites, setSites]           = useState([]);
  const [devices, setDevices]       = useState([]);
  const [orderedSites, setOrderedSites] = useState([]); // sites dans l'ordre de l'utilisateur
  const [loading, setLoading]       = useState(true);
  const [viewBackup, setViewBackup] = useState(null);
  const [diff, setDiff]             = useState(null);
  const [showTrigger, setShowTrigger] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selected, setSelected]     = useState([]);
  const { can } = usePerms();
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [filterType, setFilterType]       = useState(''); // filtre par type d'équipement
  const dragItemRef  = useRef(null);
  const dragOverRef  = useRef(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.sites(), api.devices(), api.getPrefs()])
      .then(([s, d, prefs]) => {
        setSites(s);
        setDevices(d);
        // Appliquer l'ordre sauvegardé, sinon tri alphabétique
        const savedOrder = prefs[PREF_KEY];
        if (savedOrder && Array.isArray(savedOrder)) {
          const ordered = [];
          savedOrder.forEach(id => { const found = s.find(x => x.id === id); if (found) ordered.push(found); });
          s.forEach(x => { if (!ordered.find(o => o.id === x.id)) ordered.push(x); });
          setOrderedSites(ordered);
        } else {
          setOrderedSites([...s].sort((a, b) => a.name.localeCompare(b.name)));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Drag & Drop sites ──
  function onDragStart(index) { dragItemRef.current = index; }
  function onDragEnter(index) { dragOverRef.current = index; }
  function onDragEnd() {
    const from = dragItemRef.current;
    const to   = dragOverRef.current;
    if (from === null || to === null || from === to) return;
    const newOrder = [...orderedSites];
    const [moved] = newOrder.splice(from, 1);
    newOrder.splice(to, 0, moved);
    setOrderedSites(newOrder);
    dragItemRef.current = null;
    dragOverRef.current = null;
    // Sauvegarder
    api.savePrefs({ [PREF_KEY]: newOrder.map(s => s.id) }).catch(() => {});
  }

  function toggleSelect(id) {
    setSelected(s => s.includes(id) ? s.filter(x => x !== id) : s.length < 2 ? [...s, id] : [s[1], id]);
  }

  async function handleDelete(backup) { setConfirmDelete(backup); }
  async function confirmDeleteBackup() {
    if (!confirmDelete) return;
    try { await api.deleteBackup(confirmDelete.id); setConfirmDelete(null); load(); }
    catch (e) { alert('Erreur : ' + e.message); setConfirmDelete(null); }
  }

  const orphanDevices = devices.filter(d => !sites.find(s => s.id === d.site_id));
  const allTypes = [...new Set(devices.map(d => d.device_type).filter(Boolean))].sort();

  // Filtrer les devices selon le type sélectionné
  const filteredDevices = filterType
    ? devices.filter(d => (d.device_type || '') === filterType)
    : devices;
  const filteredOrphan = orphanDevices.filter(d => !filterType || (d.device_type || '') === filterType);

  if (!can('backup_read')) return <AccessDenied page="Backups" />;
  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Backups de configuration</div>
          <div className="page-sub">Versionning des fichiers des équipements</div>
        </div>
        <div className="page-actions">
          {compareMode ? (
            <>
              <span style={{ fontSize:12, color:'var(--muted)', alignSelf:'center' }}>{selected.length}/2 sélectionné{selected.length>1?'s':''}</span>
              <button className="btn btn-primary" disabled={selected.length!==2} onClick={() => setDiff({ a:selected[0], b:selected[1] })}>Comparer</button>
              <button className="btn" onClick={() => { setCompareMode(false); setSelected([]); }}>Annuler</button>
            </>
          ) : (
            <>
              {/* Filtre par type d'équipement */}
              {allTypes.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, color: 'var(--muted)', flexShrink: 0 }}>
                    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
                  </svg>
                  <select
                    className="form-control"
                    style={{ padding: '5px 8px', fontSize: 12, height: 30, minWidth: 130 }}
                    value={filterType}
                    onChange={e => setFilterType(e.target.value)}
                    title="Filtrer par type d'équipement"
                  >
                    <option value="">Tous les types</option>
                    {allTypes.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {filterType && (
                    <button className="btn btn-sm" onClick={() => setFilterType('')} title="Effacer le filtre" style={{ padding: '4px 7px' }}>✕</button>
                  )}
                </div>
              )}
              {can('backup_compare') && <button className="btn" style={{ borderColor:'var(--acc)', color:'var(--acc)' }} onClick={() => setCompareMode(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>
                Comparer
              </button>}
              {/* Bouton Import — couleur verte pour le distinguer */}
              {can('backup_import') && <button className="btn" style={{ borderColor:'var(--ok)', color:'var(--ok)' }} onClick={() => setShowUpload(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Importer
              </button>}
              {can('backup_write') && <button className="btn" style={{ borderColor:'var(--warn)', color:'var(--warn)' }} onClick={() => setShowTrigger(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Sauvegarde
              </button>}
              <button className="btn" onClick={load}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
                Actualiser
              </button>
            </>
          )}
        </div>
      </div>

      {filterType && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'var(--warn-s)', border: '1px solid var(--warn)', borderRadius: 'var(--r)', padding: '5px 14px', fontSize: 12, color: 'var(--warn)', fontWeight: 600 }}>
            <DeviceTypeIcon type={filterType} />
            {filterType}
            <span style={{ fontWeight: 400, color: 'var(--muted)' }}>({filteredDevices.length} équipement{filteredDevices.length > 1 ? 's' : ''})</span>
            <button onClick={() => setFilterType('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--warn)', padding: '0 2px', fontSize: 13, lineHeight: 1 }}>✕</button>
          </div>
        </div>
      )}

      {compareMode && (
        <div className="alert alert-warn" style={{ marginBottom:14 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Sélectionnez exactement 2 versions dans les tableaux ci-dessous pour les comparer.
        </div>
      )}

      {loading ? (
        <div style={{ textAlign:'center', padding:60 }}><Spinner /></div>
      ) : orderedSites.length===0 && devices.length===0 ? (
        <div style={{ textAlign:'center', padding:60, color:'var(--muted)' }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom:12, opacity:.3 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <div style={{ fontWeight:600, marginBottom:6 }}>Aucun équipement configuré</div>
          <div style={{ fontSize:12 }}>Ajoutez des sites et équipements dans Appareils</div>
        </div>
      ) : (
        <>
          {orderedSites.map((site, index) => (
            <div key={site.id}
              draggable
              onDragStart={() => onDragStart(index)}
              onDragEnter={() => onDragEnter(index)}
              onDragEnd={onDragEnd}
              onDragOver={e => e.preventDefault()}
              style={{ opacity: dragItemRef.current === index ? .5 : 1, transition:'opacity .15s' }}>
              <SiteSection
                site={site} devices={filteredDevices}
                forceOpen={filterType ? filteredDevices.some(d => d.site_id === site.id) : undefined}
                compareMode={compareMode} selected={selected}
                onSelectCompare={toggleSelect} onView={setViewBackup}
                onDelete={handleDelete}
                dragHandleProps={{
                  onMouseDown: e => e.stopPropagation(),
                  draggable: false,
                }}
              />
            </div>
          ))}
          {orphanDevices.length > 0 && (
            <SiteSection site={{ id:-1, name:'Sans site', location:'' }} devices={filteredOrphan}
              compareMode={compareMode} selected={selected}
              onSelectCompare={toggleSelect} onView={setViewBackup} onDelete={handleDelete}
              dragHandleProps={{}} />
          )}
        </>
      )}

      {viewBackup && <ContentView backup={viewBackup} onClose={() => setViewBackup(null)} />}
      {diff && <DiffView idA={diff.a} idB={diff.b} onClose={() => setDiff(null)} />}
      {showTrigger && <TriggerModal devices={devices} onClose={() => setShowTrigger(false)} onDone={() => { setShowTrigger(false); load(); }} />}
      {showUpload && <UploadModal devices={devices} onClose={() => setShowUpload(false)} onDone={() => { setShowUpload(false); load(); }} />}
      {confirmDelete && (
        <Modal title="Supprimer ce backup" onClose={() => setConfirmDelete(null)}
          footer={<><button className="btn" onClick={() => setConfirmDelete(null)}>Annuler</button><button className="btn btn-danger" onClick={confirmDeleteBackup}>Supprimer</button></>}>
          <p style={{ fontSize:13 }}>Supprimer le backup <strong>v{confirmDelete.version}</strong> de <strong>{confirmDelete.device_name}</strong> ?</p>
          <p style={{ fontSize:12, color:'var(--muted)', marginTop:8 }}>Cette action est irréversible. Les backups épinglés ne peuvent pas être supprimés.</p>
        </Modal>
      )}
    </main>
  );
}
