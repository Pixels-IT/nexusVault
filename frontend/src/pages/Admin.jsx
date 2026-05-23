import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useI18n } from '../contexts/I18nContext.jsx';
import { APP_VERSION } from '../version.js';
import { usePasswordMin, invalidatePasswordMin } from '../hooks/usePasswordMin.js';
import { Modal, Alert, ConfirmModal, Spinner } from '../components/UI.jsx';
import PersonnalisationPage from './Personnalisation.jsx';
import { usePerms, invalidatePermsCache } from '../hooks/usePerms.js';

import { ConfigEmbedded } from './Config.jsx';

// ── APPAREILS TAB (encapsule Config.jsx) ─────────────────────────────────────
// ── Map des actions d'audit → traductions ────────────────────────────────────
const AUDIT_ACTION_LABELS = {
  // Auth
  'LOGIN_OK':         { en: 'Login success',        fr: 'Connexion réussie' },
  'LOGIN_FAIL':       { en: 'Login failed',          fr: 'Connexion échouée' },
  'LOGIN_LOCKED':     { en: 'Account locked',        fr: 'Compte verrouillé' },
  'LOGOUT':           { en: 'Logout',                fr: 'Déconnexion' },
  'PWD_CHANGED':      { en: 'Password changed',      fr: 'Mot de passe modifié' },
  'TOTP_SETUP':       { en: 'TOTP configured',       fr: 'TOTP configuré' },
  // Backups
  'BACKUP_IMPORTED':  { en: 'Backup imported',       fr: 'Backup importé' },
  'BACKUP_DELETED':   { en: 'Backup deleted',        fr: 'Backup supprimé' },
  'BACKUP_TRIGGER':   { en: 'Backup triggered',      fr: 'Backup déclenché' },
  // Automation
  'DOC_CRÉÉ':         { en: 'Document created',      fr: 'Document créé' },
  'DOC_MODIFIÉ':      { en: 'Document modified',     fr: 'Document modifié' },
  'DOC_SUPPRIMÉ':     { en: 'Document deleted',      fr: 'Document supprimé' },
  'DOC_CONSULTÉ':     { en: 'Document viewed',       fr: 'Document consulté' },
  'DOC_ACCÈS_REFUSÉ': { en: 'Access denied',         fr: 'Accès refusé' },
  'FICHIER_AJOUTÉ':   { en: 'File added',            fr: 'Fichier ajouté' },
  'FICHIER_SUPPRIMÉ': { en: 'File deleted',          fr: 'Fichier supprimé' },
  'FICHIER_TÉLÉCHARGÉ':{ en: 'File downloaded',      fr: 'Fichier téléchargé' },
  'FICHIER_PRÉVISUALISÉ':{ en: 'File previewed',     fr: 'Fichier prévisualisé' },
  'FICHIER_COPIÉ':    { en: 'File copied',           fr: 'Fichier copié' },
  // Categories
  'CAT_CRÉÉE':        { en: 'Category created',      fr: 'Catégorie créée' },
  'CAT_MODIFIÉE':     { en: 'Category modified',     fr: 'Catégorie modifiée' },
  'CAT_SUPPRIMÉE':    { en: 'Category deleted',      fr: 'Catégorie supprimée' },
  // Admin
  'USER_CREATED':     { en: 'User created',          fr: 'Utilisateur créé' },
  'USER_UPDATED':     { en: 'User updated',          fr: 'Utilisateur modifié' },
  'USER_DELETED':     { en: 'User deleted',          fr: 'Utilisateur supprimé' },
  'USER_UNLOCKED':    { en: 'User unlocked',         fr: 'Utilisateur débloqué' },
  'SETTINGS_UPDATED': { en: 'Settings updated',      fr: 'Paramètres modifiés' },
};

function auditActionLabel(action, lang) {
  const entry = AUDIT_ACTION_LABELS[action];
  if (!entry) return action;
  return (lang === 'fr' ? entry.fr : entry.en) || action;
}


function AppareilsTab() {
  return <ConfigEmbedded />;
}

// ── PERSONNALISATION ─────────────────────────────────────────────────────────
function PersonnalisationTab() {
  return <PersonnalisationPage embedded />;
}

// ── SCRIPTS ADMIN TAB ────────────────────────────────────────────────────────
// ── TYPES DE CATÉGORIES ────────────────────────────────────────────────────────
const CAT_TYPES = [
  { value: 'generic',   tKey: 'auto_cat.type_generic',   label: 'Generic' },
  { value: 'temporary', tKey: 'auto_cat.type_temporary', label: 'Temporary' },
  { value: 'procedure', tKey: 'auto_cat.type_procedure', label: 'Procedure' },
  { value: 'script',    tKey: 'auto_cat.type_script',    label: 'Script' },
  { value: 'secured',   tKey: 'auto_cat.type_secured',   label: 'Secured' },
];

function ScriptsAdminTab() {
  const [innerTab, setInnerTab] = useState('categories');
  const { can, isAdmin } = usePerms();

  const INNER = [
    { key:'categories', label:'Catégories', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> },
    ...(isAdmin || can('automatisation_options') ? [{ key:'options', label:'Options', icon:<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M19.07 19.07l-1.41-1.41M5.34 5.34L3.93 3.93M22 12h-2M4 12H2M12 22v-2M12 4V2"/></svg> }] : []),
  ];

  return (
    <div>
      <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:'1px solid var(--brd)' }}>
        {INNER.map(tab => (
          <button key={tab.key} onClick={() => setInnerTab(tab.key)} style={{
            display:'flex', alignItems:'center', gap:6,
            padding:'9px 16px', background:'none', border:'none',
            borderBottom: innerTab===tab.key ? '2px solid var(--acc)' : '2px solid transparent',
            color: innerTab===tab.key ? 'var(--acc)' : 'var(--muted)',
            fontWeight: innerTab===tab.key ? 600 : 500,
            fontSize:13, cursor:'pointer', fontFamily:'var(--font)', marginBottom:-1,
          }}>{tab.icon} {tab.label}</button>
        ))}
      </div>
      {innerTab === 'categories' && <AutomationCategoriesTab />}
      {innerTab === 'options'    && <AutomationOptionsTab />}
    </div>
  );
}

// ── CATÉGORIES ─────────────────────────────────────────────────────────────────
function AutomationCategoriesTab() {
  const { t } = useI18n();
  const [cats, setCats]         = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editCat, setEditCat]   = useState(null);   // null = création, object = édition
  const [confirm, setConfirm]   = useState(null);
  const [colorMode, setColorMode] = useState('same');

  const EMPTY_FORM = { name:'', description:'', type:'generic', color:'#066fd1', parent_id:'', valid_until:'' };
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [msg,   setMsg]   = useState('');

  const load = () => api.automationCategories().then(d => setCats(Array.isArray(d)?d:[])).catch(()=>{});
  useEffect(() => {
    load();
    api.getFeatureFlags().then(f => setColorMode(f.automation_cat_color_mode || 'same')).catch(()=>{});
  }, []);

  const TYPE_COLORS = { generic:'#64748b', temporary:'var(--warn)', procedure:'#0891b2', script:'#16a34a', secured:'var(--err)' };
  const TYPE_LABEL  = Object.fromEntries(CAT_TYPES.map(ct=>[ct.value, ct.label]));

  // Calculer la couleur héritée (teinte différente = rotation hue de 30°)
  function computeChildColor(parentColor) {
    if (colorMode === 'same') return parentColor;
    // Décaler la teinte de 30 degrés en HSL
    const hex = parentColor.replace('#','');
    const r=parseInt(hex.slice(0,2),16)/255, g=parseInt(hex.slice(2,4),16)/255, b=parseInt(hex.slice(4,6),16)/255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b), l=(max+min)/2;
    const d=max-min;
    let h=0, s=d===0?0:d/(1-Math.abs(2*l-1));
    if(d!==0){ if(max===r)h=((g-b)/d)%6; else if(max===g)h=(b-r)/d+2; else h=(r-g)/d+4; h=h*60; if(h<0)h+=360; }
    h=(h+30)%360;
    const c2=(1-Math.abs(2*l-1))*s, x=c2*(1-Math.abs((h/60)%2-1)), m=l-c2/2;
    let r2=0,g2=0,b2=0;
    if(h<60){r2=c2;g2=x;}else if(h<120){r2=x;g2=c2;}else if(h<180){g2=c2;b2=x;}else if(h<240){g2=x;b2=c2;}else if(h<300){r2=x;b2=c2;}else{r2=c2;b2=x;}
    const toHex=v=>Math.round((v+m)*255).toString(16).padStart(2,'0');
    return '#'+toHex(r2)+toHex(g2)+toHex(b2);
  }

  // Quand parent_id change, forcer la couleur héritée
  function handleParentChange(pid) {
    if (!pid) { setForm(f=>({...f, parent_id:''})); return; }
    const parent = cats.find(c=>String(c.id)===String(pid));
    if (parent) {
      const inherited = computeChildColor(parent.color);
      setForm(f=>({...f, parent_id:pid, color:inherited}));
    } else {
      setForm(f=>({...f, parent_id:pid}));
    }
  }

  const hasParent = !!form.parent_id;
  const colorLocked = hasParent; // la couleur est toujours gérée par héritage si parent

  async function submit(e) {
    e.preventDefault(); setError('');
    const data = { ...form, parent_id:form.parent_id||null, valid_until:form.type==='temporary'?form.valid_until||null:null };
    try {
      if (editCat) { await api.updateCategory(editCat.id, data); setMsg('Catégorie modifiée.'); }
      else         { await api.createCategory(data);              setMsg('Catégorie créée.'); }
      setShowModal(false); setEditCat(null); setForm(EMPTY_FORM);
      load(); setTimeout(()=>setMsg(''),3000);
    } catch(ex) { setError(ex.message); }
  }

  function openCreate() { setEditCat(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); }
  function openEdit(cat) {
    setEditCat(cat);
    setForm({ name:cat.name, description:cat.description||'', type:cat.type, color:cat.color, parent_id:cat.parent_id||'', valid_until:cat.valid_until||'' });
    setError(''); setShowModal(true);
  }
  function closeModal() { setShowModal(false); setEditCat(null); setForm(EMPTY_FORM); setError(''); }

  const roots    = cats.filter(c => !c.parent_id);
  const children = id => cats.filter(c => c.parent_id === id);
  const parentOptions = cats.filter(c => !editCat || c.id !== editCat.id);

  function CatRow({ cat, depth=0 }) {
    const tc = TYPE_COLORS[cat.type] || 'var(--muted)';
    return (
      <>
        <tr style={{ borderBottom:'1px solid var(--brd)' }}>
          {/* Nom — prioritaire, largeur doublée, centré */}
          <td style={{ padding:'9px 14px', paddingLeft: 14+depth*22, whiteSpace:'nowrap', textAlign:'center' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ width:10, height:10, borderRadius:'50%', background:cat.color, flexShrink:0, display:'inline-block' }}/>
              <span style={{ fontWeight:600, fontSize:13 }}>{cat.name}</span>
            </div>
          </td>
          {/* Type — fixe, centré */}
          <td style={{ padding:'9px 8px', whiteSpace:'nowrap', width:100, textAlign:'center' }}>
            <span style={{ fontSize:11, fontWeight:600, color:tc, background:`${tc}22`, borderRadius:4, padding:'2px 7px' }}>
              {TYPE_LABEL[cat.type]||cat.type}
            </span>
          </td>
          {/* Description — largeur restante */}
          <td style={{ padding:'9px 8px', fontSize:12, color:'var(--muted)', width:'100%' }}>
            {cat.description || <span style={{ fontStyle:'italic', opacity:.5 }}>—</span>}
          </td>
          {/* Actions */}
          <td style={{ padding:'9px 8px', whiteSpace:'nowrap', textAlign:'right' }}>
            <button className="btn btn-sm" onClick={()=>openEdit(cat)} style={{ marginRight:6 }}>Éditer</button>
            <button className="btn btn-sm" onClick={()=>setConfirm(cat)} style={{ color:'var(--err)', borderColor:'var(--err)' }}>✕</button>
          </td>
        </tr>
        {children(cat.id).sort((a,b)=>a.name.localeCompare(b.name)).map(ch => <CatRow key={ch.id} cat={ch} depth={depth+1}/>)}
      </>
    );
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Message de succès */}
      {msg && <div className="alert alert-ok" style={{fontSize:12}}>{msg}</div>}

      {/* Liste avec bouton dans le header */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Catégories ({cats.length})
          </div>
          <button className="btn btn-sm" onClick={openCreate}
            style={{ display:'flex', alignItems:'center', gap:5, borderColor:'var(--ok)', color:'var(--ok)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Ajouter
          </button>
        </div>
        {cats.length === 0 ? (
          <div style={{ padding:'30px 20px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
            Aucune catégorie. Cliquez sur "Créer une catégorie" pour commencer.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', tableLayout:'fixed' }}>
            <colgroup>
              <col style={{ width:240 }}/>
              <col style={{ width:100 }}/>
              <col/>
              <col style={{ width:100 }}/>
            </colgroup>
            <thead>
              <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
                <th style={{ padding:'7px 14px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('auto_cat.col_name')}</th>
                <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('auto_cat.col_type')}</th>
                <th style={{ padding:'7px 8px', textAlign:'left', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('auto_cat.col_desc')}</th>
                <th style={{ padding:'7px 8px' }}></th>
              </tr>
            </thead>
            <tbody>
              {roots.sort((a,b)=>a.name.localeCompare(b.name)).map(c => <CatRow key={c.id} cat={c} />)}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal création / édition */}
      {showModal && (() => {
        // Construire options parentes triées : parents puis leurs enfants indentés
        const buildOptions = () => {
          const result = [];
          const allRoots = parentOptions.filter(c=>!c.parent_id).sort((a,b)=>a.name.localeCompare(b.name));
          allRoots.forEach(root => {
            result.push({ id: root.id, label: root.name, depth: 0 });
            parentOptions.filter(c=>c.parent_id===root.id).sort((a,b)=>a.name.localeCompare(b.name))
              .forEach(ch => result.push({ id:ch.id, label:ch.name, depth:1 }));
          });
          return result;
        };
        return (
          <Modal title={editCat ? `Modifier "${editCat.name}"` : t('auto_cat.new_title')} onClose={closeModal}
            footer={
              <div style={{ display:'flex', gap:8 }}>
                <button type="button" className="btn" onClick={closeModal}>{t('auto_cat.cancel')}</button>
                <button type="button" onClick={()=>document.getElementById('cat-form').requestSubmit()} className="btn btn-primary">
                  {editCat ? 'Enregistrer' : 'Créer'}
                </button>
              </div>
            }>
            <form id="cat-form" onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label">{t('auto_cat.name_label')}</label>
                  <input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required />
                </div>
                <div className="form-group" style={{margin:0}}>
                  <label className="form-label">Type</label>
                  <select className="form-control" value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                    {CAT_TYPES.map(ct => <option key={ct.value} value={ct.value}>{t(ct.tKey)}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{margin:0, gridColumn:'1/-1'}}>
                  <label className="form-label">Description <span style={{fontWeight:400,color:'var(--muted)'}}>{t('auto_cat.desc_opt')}</span></label>
                  <input className="form-control" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Description de la catégorie" />
                </div>
                {/* Ligne pleine largeur 75/25 : parent + couleur */}
                <div style={{ gridColumn:'1/-1', display:'grid', gridTemplateColumns:'3fr 1fr', gap:10 }}>
                  <div className="form-group" style={{margin:0}}>
                    <label className="form-label">{t('auto_cat.parent_label')}</label>
                    <select className="form-control" value={form.parent_id} onChange={e=>handleParentChange(e.target.value)}
                      style={{ color:'var(--txt)', background:'var(--surf2)' }}>
                      <option value="">{t('auto_cat.no_parent')}</option>
                      {buildOptions().map(opt => (
                        <option key={opt.id} value={opt.id} style={{ paddingLeft: opt.depth > 0 ? 16 : 0 }}>
                          {opt.depth > 0 ? '    ↳ ' : ''}{opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label className="form-label" style={{ display:'flex', alignItems:'center', gap:4 }}>
                      Couleur
                      {colorLocked && <span style={{ fontSize:9, color:'var(--muted)', background:'var(--surf2)', border:'1px solid var(--brd)', borderRadius:3, padding:'1px 4px' }}>auto</span>}
                    </label>
                    <div style={{ display:'flex', alignItems:'center', gap:6, opacity: colorLocked ? 0.5 : 1 }}>
                      <input type="color" value={form.color} disabled={colorLocked}
                        onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                        style={{ width:36, height:32, padding:2, border:'1px solid var(--brd)', borderRadius:'var(--r)', cursor: colorLocked?'not-allowed':'pointer', background:'var(--surf2)', flexShrink:0 }} />
                      <input className="form-control" value={form.color} disabled={colorLocked}
                        onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                        style={{ fontFamily:'var(--mono)', fontSize:11 }} />
                    </div>
                  </div>
                </div>
                {/* La date de fin de validité est gérée au niveau du document, pas de la catégorie */}
              </div>
              {error && <div className="alert alert-err" style={{fontSize:12}}>{error}</div>}
            </form>
          </Modal>
        );
      })()}

      {confirm && <ConfirmModal message={`Supprimer la catégorie "${confirm.name}" ?`}
        onConfirm={async()=>{ try { await api.deleteCategory(confirm.id); setConfirm(null); load(); } catch(e){ alert(e.message); setConfirm(null); } }}
        onCancel={()=>setConfirm(null)} />}
    </div>
  );
}

// ── OPTIONS AUTOMATISATION ─────────────────────────────────────────────────────

// ── OPTIONS AUTOMATISATION ─────────────────────────────────────────────────────
function AutomationOptionsTab() {
  const { t } = useI18n();
  const [colorMode, setColorMode] = useState('same');
  const [securedPwd, setSecuredPwd] = useState('');
  const [showTimeline, setShowTimeline] = useState(true);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');

  useEffect(() => {
    api.getFeatureFlags().then(f => {
      setColorMode(f.automation_cat_color_mode || 'same');
      setSecuredPwd(f.automation_secured_password || '');
      setShowTimeline(f.show_expiry_timeline !== false); // true par défaut
    }).catch(()=>{});
  }, []);

  async function saveColorMode(mode) {
    setSaving(true); setMsg('');
    try {
      await api.setFeatureFlags({ automation_cat_color_mode: mode });
      setColorMode(mode);
      setMsg(t('security.saved')); setTimeout(()=>setMsg(''),3000);
    } catch(e) { setMsg('Erreur : '+e.message); }
    finally { setSaving(false); }
  }

  async function saveTimeline(val) {
    setShowTimeline(val);
    try { await api.setFeatureFlags({ show_expiry_timeline: val }); }
    catch(e) { setMsg('Erreur : '+e.message); }
  }

  async function saveSecuredPwd() {
    setSaving(true); setMsg('');
    try {
      await api.setFeatureFlags({ automation_secured_password: securedPwd });
      setMsg(securedPwd ? t('auto_opts.pwd_saved') : t('auto_opts.pwd_empty_saved'));
      setTimeout(()=>setMsg(''),3000);
    } catch(e) { setMsg('Erreur : '+e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      {/* Ligne 50/50 : couleurs + mot de passe sécurisé */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Card couleur des catégories */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                <circle cx="13.5" cy="6.5" r="2.5"/><circle cx="19" cy="13" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="10" cy="19.5" r="2.5"/>
              </svg>
              {t('auto_opts.color_title') || 'Category colors'}
            </div>
          </div>
          <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { value:'same',  label:t('auto_opts.color_same') },
              { value:'shade', label:t('auto_opts.color_shade') },
            ].map(opt => (
              <label key={opt.value} style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer',
                padding:'10px 12px', borderRadius:'var(--r)',
                background: colorMode===opt.value ? 'var(--acc-s)' : 'var(--surf2)',
                border: `1px solid ${colorMode===opt.value ? 'var(--acc)' : 'var(--brd)'}`,
                transition:'all .12s' }}>
                <input type="radio" name="colorMode" value={opt.value} checked={colorMode===opt.value}
                  onChange={()=>saveColorMode(opt.value)} disabled={saving}
                  style={{ marginTop:2, accentColor:'var(--acc)' }} />
                <span style={{ fontSize:12 }}>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Card mot de passe sécurisé */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              {t('auto_opts.pwd_title') || 'Secured document password'}
            </div>
          </div>
          <div style={{ padding:'14px 18px', display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>
              Le mot de passe indiqué sera utilisé pour sécuriser l'accès à tous les documents dont la catégorie est "Sécurisé".
              <strong> Si vide</strong>, il faudra indiquer un mot de passe à chaque document.
              <span style={{ color:'var(--warn)' }}> {t('auto_opts.at_your_risk') || 'At your own risk.'}</span>
            </div>
            <div style={{ display:'flex', gap:8, alignItems:'flex-end' }}>
              <div className="form-group" style={{ margin:0, flex:1 }}>
                <label className="form-label">{t('auto_opts.pwd_global_label')}</label>
                <input type="password" className="form-control" value={securedPwd}
                  onChange={e=>setSecuredPwd(e.target.value)}
                  placeholder={t('auto_opts.pwd_global_ph')} />
              </div>
              <button className="btn btn-primary" onClick={saveSecuredPwd} disabled={saving}>
                Enregistrer
              </button>
            </div>
            {msg && <div className={`alert ${msg.startsWith('Erreur')?'alert-err':'alert-ok'}`} style={{fontSize:12,marginTop:8}}>{msg}</div>}
          </div>
        </div>
      </div>

      {/* Card types de catégories + Card Timeline — 2 colonnes */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
        {/* Card types */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              {t('auto_opts.types_title') || 'Category types'}
            </div>
          </div>
          <div style={{ padding:'14px 18px' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--brd)' }}>
                  <th style={{ padding:'6px 10px', textAlign:'left', color:'var(--muted)', fontSize:11 }}>{t('auto_cat.col_type')}</th>
                  <th style={{ padding:'6px 10px', textAlign:'left', color:'var(--muted)', fontSize:11 }}>{t('auto_cat.col_desc')}</th>
                </tr>
              </thead>
              <tbody>
                {CAT_TYPES.map((ct, i) => (
                  <tr key={ct.value} style={{ borderBottom:'1px solid var(--brd)', background: i%2?'var(--surf2)':'transparent' }}>
                    <td style={{ padding:'10px 10px', whiteSpace:'nowrap' }}>
                      <span style={{ fontWeight:600, color:({generic:'#64748b',temporary:'var(--warn)',procedure:'#0891b2',script:'#16a34a',secured:'var(--err)'})[ct.value] || 'var(--muted)' }}>
                        {ct.label}
                      </span>
                    </td>
                    <td style={{ padding:'10px 10px', color:'var(--muted)', fontSize:12 }}>
                      {ct.value === 'generic'   && t('auto_opts.type_generic')}
                      {ct.value === 'temporary' && t('auto_opts.type_temporary')}
                      {ct.value === 'procedure' && t('auto_opts.type_procedure')}
                      {ct.value === 'script'    && t('auto_opts.type_script')}
                      {ct.value === 'secured'   && t('auto_opts.type_secured')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Card Timeline */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                <line x1="2" y1="12" x2="22" y2="12"/><polyline points="18 8 22 12 18 16"/>
              </svg>
              {t('auto_opts.timeline_title') || 'Timeline'}
            </div>
          </div>
          <div style={{ padding:'16px 18px', display:'flex', flexDirection:'column', gap:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer', fontSize:13 }}>
              <input type="checkbox" checked={showTimeline} onChange={e => saveTimeline(e.target.checked)}
                style={{ width:15, height:15, cursor:'pointer' }} />
              <span>{t('auto_opts.timeline_show') || 'Afficher la timeline d\'expiration dans la catégorie Temporaire'}</span>
            </label>
            <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>
              {t('auto_opts.timeline_desc') || 'Quand activée, une timeline horizontale affiche les dates d\'expiration des documents sous le fil d\'Ariane.'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── MON COMPTE ────────────────────────────────────────────────────────────────
function AccountTab({ forcePasswordChange }) {
  const { t } = useI18n();
  const { user, logout } = useAuth();
  const passwordMin = usePasswordMin();
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
    if (pwData.nw.length < passwordMin) return setPwErr(`${passwordMin} ${t('security.pwd_min_chars') || 'caractères minimum'}`);
    if (pwData.nw !== pwData.confirm) return setPwErr('Les mots de passe ne correspondent pas');
    try {
      await api.changePassword(pwData.cur, pwData.nw);
      setPwMsg('Mot de passe modifié.');
      setPwData({ cur: '', nw: '', confirm: '' });
      // If forced change, reload page to get fresh token without must_change_password
      if (forcePasswordChange) setTimeout(() => logout('pwd_changed'), 1200);
    } catch (e) { setPwErr(e.message); }
  }

  return (
    <div>
    {forcePasswordChange && (
      <div style={{ background:'var(--warn-bg,rgba(234,179,8,.15))', border:'1px solid var(--warn)', borderRadius:'var(--r)', padding:'12px 18px', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="2" style={{width:20,height:20,flexShrink:0}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <strong>{t('auth.must_change_pwd') || 'You must change your default password before continuing.'}</strong>
      </div>
    )}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <div className="card">
        <div className="card-header"><div className="card-title">Informations du compte</div></div>
        <div style={{ padding: 20 }}>
          {msg && <Alert type="ok">{msg}</Alert>}
          {err && <Alert type="err">{err}</Alert>}
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label className="form-label">{t('users.display_name')}</label>
              <input className="form-control" value={data.display_name} onChange={e => setData(d => ({ ...d, display_name: e.target.value }))} placeholder="Votre nom complet" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('auth.username')} de connexion</label>
              <input className="form-control" value={data.username} onChange={e => setData(d => ({ ...d, username: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('account.email')}</label>
              <input className="form-control" type="email" value={data.email} onChange={e => setData(d => ({ ...d, email: e.target.value }))} placeholder="utilisateur@domaine.com" />
            </div>
            <div className="form-group">
              <label className="form-label">{t('users.role')}</label>
              <input className="form-control" value={user?.role || ''} disabled style={{ opacity: .6 }} />
            </div>
            <button className="btn btn-primary" type="submit">{t('auto_cat.save')}</button>
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
              <label className="form-label">Nouveau mot de passe <span style={{ color: 'var(--err)' }}>— {passwordMin} {t('security.pwd_min_chars') || 'car. min.'}</span></label>
              <input className="form-control" type="password" value={pwData.nw} onChange={e => setPwData(d => ({ ...d, nw: e.target.value }))} />
              {pwData.nw.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                  {[{ ok: pwData.nw.length >= passwordMin, l: `${passwordMin}+` }, { ok: /[A-Z]/.test(pwData.nw), l: 'MAJ' }, { ok: /[0-9]/.test(pwData.nw), l: '123' }, { ok: /[^A-Za-z0-9]/.test(pwData.nw), l: '!@#' }].map(({ ok, l }) => (
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
  const { t } = useI18n();
  const ROLES = useRoles();
  const isNew = !user?.id;
  const isLocked = !!(user?.locked_until && new Date(user.locked_until.replace(' ','T')) > new Date());
  const [data, setData] = useState(user ? {
    username: user.username,
    display_name: user.display_name || '',
    email: user.email || '',
    role: user.role || 'viewer',
    enabled: user.enabled !== 0,
    password: '',
    unlock: false,
    reset_totp: false,
  } : {
    username: '', display_name: '', email: '', role: 'viewer', enabled: true, password: '', reset_totp: false,
  });
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const set = k => e => setData(d => ({ ...d, [k]: e.target.value }));

  async function submit() {
    setError('');
    if (!data.username.trim()) return setError(`${t('auth.username')} requis`);
    if (!data.email.trim()) return setError(`${t('account.email')} obligatoire`);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email.trim())) return setError('Email invalide (ex: nom@domaine.com)');
    if (!isNew && data.password && data.password.length < passwordMin)
      return setError(`Mot de passe : ${passwordMin} ${t('security.pwd_min_chars') || 'caractères minimum'}`);
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
        delete payload.unlock;
        await api.updateUser(user.id, payload);
        if (data.unlock) await api.unlockUser(user.id);
      }
      onSave();
    } catch (e) { setError(e.message); setLoading(false); }
  }

  return (
    <Modal
      title={isNew ? t('users.create_title') : t('users.edit_title')}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>{t('auto_cat.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading}>
            {loading ? '…' : isNew ? t('users.save') : t('users.update')}
          </button>
        </>
      }
    >
      {error && <Alert type="err">{error}</Alert>}

      {/* Info création : lien d'init envoyé par email */}
      {isNew && (
        <div className="alert alert-warn" style={{ marginBottom: 14, fontSize: 12, textAlign: 'center', justifyContent: 'center' }}>
          {t('users.init_link_info')}
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('users.username')} *</label>
          <input className="form-control" value={data.username} onChange={set('username')} autoFocus disabled={!isNew} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('users.display_name')}</label>
          <input className="form-control" value={data.display_name} onChange={set('display_name')} />
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">{t('users.email')} *</label>
        <input className="form-control" type="email" value={data.email} pattern="[^\s@]+@[^\s@]+\.[^\s@]+" onChange={set('email')}
          placeholder="utilisateur@domaine.com" />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">{t('users.role')}</label>
          <select className="form-control" value={data.role} onChange={set('role')}>
            <option value="admin">{t('users.role_admin')}</option>
            <option value="operator">{t('users.role_operator')}</option>
            <option value="viewer">{t('users.role_viewer')}</option>
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

      {/* Déverrouillage — uniquement si le compte est verrouillé */}
      {!isNew && isLocked && (
        <div className="alert alert-warn" style={{ margin: '8px 0 0 0', fontSize: 12 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}>
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>Compte verrouillé jusqu'au {user.locked_until?.slice(0,16).replace('T',' ')}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={data.unlock}
              onChange={e => setData(d => ({ ...d, unlock: e.target.checked }))} />
            Déverrouiller
          </label>
        </div>
      )}

      {/* Reset TOTP — uniquement si l'utilisateur a le TOTP activé */}
      {!isNew && !!user?.totp_enabled && (
        <div className="alert alert-ok" style={{ margin: '8px 0 0 0', fontSize: 12, background: 'var(--acc-s)', borderColor: 'var(--acc)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}>
            <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>
          </svg>
          <span style={{ color: 'var(--acc)', fontWeight: 600 }}>{t('security.totp_active') || '2FA enabled'}</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', cursor: 'pointer', fontSize: 11 }}>
            <input type="checkbox" checked={data.reset_totp}
              onChange={e => setData(d => ({ ...d, reset_totp: e.target.checked }))}
              style={{ accentColor: 'var(--warn)' }} />
            <span style={{ color: 'var(--warn)', fontWeight: 600 }}>{t('security.totp_reset') || 'Reset 2FA'}</span>
          </label>
        </div>
      )}
      {!isNew && !user?.totp_enabled && (
        <div style={{ margin: '8px 0 0 0', fontSize: 11, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
            <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
          </svg>
          TOTP non configuré
        </div>
      )}
    </Modal>
  );
}

function UsersTab() {
  const { t } = useI18n();
  const passwordMin = usePasswordMin();
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
    if (r === 'operator') return <span className="badge badge-warn">{t('users.role_operator')}</span>;
    return <span className="badge badge-muted">{t('users.role_viewer')}</span>;
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
        <thead>
          <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, width:'70px' }}>{t('users.auth_type') || 'Type'}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('users.username')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('auto_cat.col_name')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>E-mail</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('users.role')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>Statut</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('users.last_login')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('automatisation.created_on')}</th>
            <th style={{ padding:'7px 8px', background:'var(--surf2)', borderBottom:'1px solid var(--brd)' }}></th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={{ padding:'9px 4px', textAlign:'center' }}>
                {u.auth_type === 'oidc'
                  ? <span className="badge" style={{ background:'#dbeafe', color:'#1d4ed8', fontSize:10 }}>{t('users.auth_oidc')||'OIDC'}</span>
                  : u.auth_type === 'ldap'
                  ? <span className="badge" style={{ background:'#fef3c7', color:'#92400e', fontSize:10 }}>{t('users.auth_ldap')||'LDAP'}</span>
                  : <span className="badge" style={{ background:'var(--surf2)', color:'var(--muted)', fontSize:10 }}>{t('users.auth_local')||'Local'}</span>
                }
              </td>
              <td style={{ padding:'9px 8px', textAlign:'center', fontWeight:600, fontSize:13 }}>{u.username}</td>
              <td style={{ padding:'9px 8px', textAlign:'center', fontSize:12 }}>{u.display_name}</td>
              <td style={{ padding:'9px 8px', textAlign:'center', fontSize:12 }}>{u.email || <span style={{color:'var(--muted)'}}>—</span>}</td>
              <td style={{ padding:'9px 8px', textAlign:'center' }}>{roleBadge(u.role)}</td>
              <td style={{ padding:'9px 8px', textAlign:'center' }}>
                {u.locked_until && new Date(u.locked_until.replace(' ','T')) > new Date()
                  ? <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center' }}>
                      <span className="badge badge-err" title={`t('users.locked') jusqu'à ${u.locked_until}`}>
                        <span className="dot" style={{ background:'var(--err)' }}/>t('users.locked')
                      </span>
                      <button className="btn btn-sm" style={{ borderColor:'var(--warn)', color:'var(--warn)', padding:'1px 6px', fontSize:10 }}
                        onClick={async () => { await api.unlockUser(u.id); load(); }}
                        title={`${t('users.unlock')} le compte`}>
                        t('users.unlock')
                      </button>
                    </div>
                  : u.enabled
                    ? <span className="badge badge-ok"><span className="dot dot-ok" />{t('users.enabled')}</span>
                    : <span className="badge badge-muted"><span className="dot dot-muted" />{t('common.disabled')}</span>
                }
              </td>
              <td style={{ padding:'9px 8px', textAlign:'center', fontSize:12 }}>
                {u.last_login_at
                  ? <span>{u.last_login_at.slice(0, 16).replace('T', ' ')}</span>
                  : <span className="badge badge-muted">{t('users.never')}</span>}
              </td>
              <td style={{ padding:'9px 8px', textAlign:'center', fontSize:12 }}>{u.created_at?.slice(0, 10)}</td>
              <td style={{ padding:'9px 8px', textAlign:'right', whiteSpace:'nowrap' }}>
                <button className="btn btn-sm" onClick={() => setModal(u)} style={{ marginRight:4 }}>{t('common.edit')}</button>
                {!(u.role === 'admin' && adminCount <= 1) && (
                  <button className="btn btn-sm btn-danger" onClick={() => setConfirm(u)}>Suppr.</button>
                )}
              </td>
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
    section: 'Documents',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
    perms: [
      { key: 'automatisation_read',  label: 'Consulter les scripts' },
      { key: 'automatisation_write', label: 'Ajouter, modifier, supprimer des documents et fichiers' },
    ],
  },
  {
    section: "Suivi d'activité",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>,
    perms: [
      { key: 'activity_write', label: 'Ajouter / modifier ses propres notes' },
      { key: 'activity_read',  label: 'Consulter le suivi des autres utilisateurs' },
    ],
  },
  {
    section: 'Menu Configuration Appareils',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg>,
    perms: [
      { key: 'config_read',    label: "Consulter (menu Admin → Appareils)" },
      { key: 'config_write',   label: "Configuration : Ajouter / modifier / supprimer" },
      { key: 'config_options', label: "Accès à l'onglet Options" },
    ],
  },
  {
    section: 'Menu Configuration Scripts',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>,
    perms: [
      { key: 'document',               label: "Consulter (menu Admin → Documents)" },
      { key: 'automatisation_options', label: "Accès à l'onglet Options" },
    ],
  },
  {
    section: "Menu Configuration Activité",
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>,
    perms: [
      { key: 'activity',         label: "Consulter (menu Admin → Tags d'activité)" },
      { key: 'activity_options', label: "Accès à l'onglet Options" },
    ],
  },
  {
    section: 'Administration',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
    perms: [
      { key: 'audit_access',      label: "Accès au journal d'audit" },
      { key: 'audit_archive',     label: "Accès aux archives d'audit" },
      { key: 'security_access',   label: "Accès à Sécurité" },
      { key: 'pwd_min_access',    label: "Gérer la longueur minimale des mots de passe" },
      { key: 'retention_access',  label: "Accès à la rétention" },
      { key: 'site_backup_access', label: "Accès au backup du site" },
    ],
  },
];

// ROLES est généré dynamiquement dans chaque composant via useRoles()
const ROLES_KEYS = ['admin', 'operator', 'viewer'];


// Hook pour générer les labels de rôles traduits dynamiquement
function useRoles() {
  const { t } = useI18n();
  return [
    { key: 'admin',    label: t('users.role_admin'),    color: 'var(--err)',  bg: 'var(--err-s)' },
    { key: 'operator', label: t('users.role_operator'), color: 'var(--warn)', bg: 'var(--warn-s)' },
    { key: 'viewer',   label: t('users.role_viewer'),   color: 'var(--acc)',  bg: 'var(--acc-s)' },
  ];
}

function RolePermissionsCard() {
  const { t } = useI18n();
  const ROLES = useRoles();
  const [perms, setPerms] = useState(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [mergeActivity, setMergeActivity] = useState(false);

  useEffect(() => {
    api.getRolePerms().then(data => setPerms(data)).catch(() => {});
    api.getFeatureFlags().then(f => setMergeActivity(!!f.merge_activity)).catch(() => {});
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
      setMsg('Droits enregistrés avec succès.');
      setTimeout(() => setMsg(''), 3000);
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
          {t('security.rights')} par rôle
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

      <div className="alert alert-warn" style={{ margin: '0 0 14px 0', fontSize: 12, justifyContent: 'center', textAlign: 'center' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        Les droits de l'administrateur sont permanents et ne peuvent pas être modifiés.
      </div>
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
                      const isMergeForced = mergeActivity && (perm.key === 'activity_write' || perm.key === 'activity_read');
                      const checked = isAdmin || isMergeForced ? true : !!(perms[r.key]?.[perm.key]);
                      const isDisabled = isAdmin || isMergeForced;
                      return (
                        <td key={r.key} style={{ textAlign: 'center', padding: '9px 16px' }}>
                          <label style={{ cursor: isDisabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center' }}
                            title={isMergeForced ? 'Requis par la fusion des suivis' : undefined}>
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isDisabled}
                              onChange={() => toggle(r.key, perm.key)}
                              style={{ width: 16, height: 16, cursor: isDisabled ? 'not-allowed' : 'pointer', accentColor: isMergeForced ? 'var(--ok)' : 'var(--acc)' }}
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

    </div>
  );
}

// ── ONGLET SYSTÈME ─────────────────────────────────────────────────────────────
// ── DOCKER HUB UPDATE CARD ────────────────────────────────────────────────────
function DockerUpdateCard({ currentVersion }) {
  const [status, setStatus]   = useState('loading'); // loading | uptodate | outdated | error
  const [latestTag, setLatest] = useState('');
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true); setStatus('loading');
    try {
      // Proxy backend — évite les erreurs CORS (Docker Hub bloque les appels directs du navigateur)
      const token = localStorage.getItem('dp_token');
      const res = await fetch('/api/docker-hub/tags', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error(`Docker Hub HTTP ${res.status}`);
      const data = await res.json();
      // Filtrer les tags de version (format YYYY-MM-DD-bNNN), exclure "latest"
      const versionTags = (data.results || [])
        .map(t => t.name)
        .filter(n => /^\d{4}-\d{2}-\d{2}-b\d+$/.test(n))
        .sort((a, b) => {
          // Trier par numéro de build (bNNN)
          const ba = parseInt(a.match(/b(\d+)$/)?.[1] || 0);
          const bb = parseInt(b.match(/b(\d+)$/)?.[1] || 0);
          return bb - ba;
        });
      if (!versionTags.length) throw new Error('Aucun tag de version trouvé');
      const latest = versionTags[0];
      setLatest(latest);
      // Comparer par numéro de build
      const currentBuild = parseInt(currentVersion.match(/b(\d+)$/)?.[1] || 0);
      const latestBuild  = parseInt(latest.match(/b(\d+)$/)?.[1] || 0);
      setStatus(currentBuild >= latestBuild ? 'uptodate' : 'outdated');
    } catch (e) {
      setStatus('error');
    } finally {
      setChecking(false);
    }
  }

  useEffect(() => { check(); }, []);

  const colors = {
    loading:  { bg: 'var(--surf2)', border: 'var(--brd)',  text: 'var(--muted)', label: 'Vérification…' },
    uptodate: { bg: '#14532d22',   border: 'var(--ok)',    text: 'var(--ok)',    label: '✓ À jour' },
    outdated: { bg: '#7f1d1d22',   border: 'var(--err)',   text: 'var(--err)',   label: '↑ Mise à jour disponible' },
    error:    { bg: 'var(--surf2)', border: 'var(--muted)', text: 'var(--muted)', label: 'Impossible de vérifier' },
  };
  const s = colors[status] || colors.loading;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}>
            <path d="M21 2H3v16h5v4l4-4h5l4-4V2zM11 11V7M16 11V7M6 11V7"/>
          </svg>
          Mise à jour de NexusVault
        </div>
      </div>
      <div style={{padding:16, display:'flex', flexDirection:'column', gap:10, alignItems:'center'}}>
        <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center' }}>
          Version actuelle : <span style={{ fontFamily:'var(--mono)', fontWeight:600 }}>{currentVersion}</span>
        </div>
        {status !== 'loading' && latestTag && (
          <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center' }}>
            Dernière version : <span style={{ fontFamily:'var(--mono)', fontWeight:600 }}>{latestTag}</span>
          </div>
        )}
        <button onClick={check} disabled={checking}
          style={{
            padding:'8px 18px', borderRadius:'var(--r)', border:`1.5px solid ${s.border}`,
            background: s.bg, color: s.text, fontWeight:700, fontSize:13, cursor: checking ? 'wait' : 'pointer',
            display:'flex', alignItems:'center', gap:6, transition:'all .2s',
          }}>
          {checking
            ? <><span style={{display:'inline-block',animation:'spin 1s linear infinite'}}>⟳</span> Vérification…</>
            : s.label
          }
        </button>
        {status === 'outdated' && (
          <a href="https://hub.docker.com/r/pixelsia/nexusvault-frontend/tags"
            target="_blank" rel="noopener noreferrer"
            style={{ fontSize:11, color:'var(--acc)', textDecoration:'none' }}>
            Voir sur Docker Hub →
          </a>
        )}
      </div>
    </div>
  );
}

function SecuritySystemTab() {
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    api.systemHealth()
      .then(d => { setData(d); setError(''); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <div style={{padding:40,textAlign:'center',color:'var(--muted)'}}>Chargement…</div>;
  if (error)   return <div className="alert alert-err" style={{margin:16}}>{error}</div>;
  if (!data)   return null;

  const fmt = (val, suffix='') => val != null ? val + suffix : '—';
  const pill = (label, value, color='var(--acc)') => (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'10px 14px',background:'var(--surf2)',borderRadius:'var(--r)',minWidth:90,border:'1px solid var(--brd)'}}>
      <span style={{fontSize:18,fontWeight:800,color}}>{value}</span>
      <span style={{fontSize:10,color:'var(--muted)',textAlign:'center',lineHeight:1.3}}>{label}</span>
    </div>
  );

  const tableRows = data.database?.tables || {};
  const TABLE_LABELS = {
    backups: t('sys.tbl_backups'), activity_entries: t('sys.tbl_activity'), activity_files: t('sys.tbl_act_files'),
    automation_documents: t('sys.tbl_docs'), automation_document_files: t('sys.tbl_doc_files'),
    retention_bin: t('sys.tbl_retention'), audit_log: t('sys.tbl_audit'), notification_log: t('sys.tbl_notifs'),
    users: t('sys.tbl_users'), devices: t('sys.tbl_devices'), sites: t('sys.tbl_sites'),
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* Uptime + Mémoire */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Processus Node.js
          </div>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:11,color:'var(--muted)'}}>{t('sys.updated_at')} {data.timestamp}</span>
            <button className="btn btn-sm" onClick={load}>{t('sys.refresh')}</button>
          </div>
        </div>
        <div style={{padding:16}}>
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14,justifyContent:'center'}}>
            {pill(t('sys.uptime'), data.uptime?.formatted, 'var(--ok)')}
            {pill(t('sys.mem_rss'), data.memory?.rss, 'var(--acc)')}
            {pill(t('sys.heap_used'), data.memory?.heap_used, 'var(--acc)')}
            {pill(t('sys.heap_total'), data.memory?.heap_total, 'var(--muted)')}
            {pill('Node.js', data.runtime?.node, 'var(--muted)')}
            {pill('Plateforme', data.runtime?.platform, 'var(--muted)')}
          </div>
        </div>
      </div>

      {/* Base de données */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            Base de données SQLite
          </div>
          <span style={{fontSize:12,fontWeight:600,color:'var(--acc)'}}>{data.database?.size}</span>
        </div>
        <div style={{padding:16}}>
          {/* Blobs */}
          <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:14,justifyContent:'center'}}>
            {pill(t('sys.blobs_backup'), data.database?.blobs?.backups, 'var(--ok)')}
            {pill(t('sys.blobs_doc_files'), data.database?.blobs?.doc_files, 'var(--acc)')}
            {pill(t('sys.blobs_act_files'), data.database?.blobs?.activity_files, 'var(--acc)')}
          </div>
          {/* Table counts */}
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--brd)'}}>
                <th style={{padding:'6px 8px',textAlign:'left',color:'var(--muted)',fontWeight:600}}>{t('sys.table_col')}</th>
                <th style={{padding:'6px 8px',textAlign:'right',color:'var(--muted)',fontWeight:600}}>{t('sys.rows_col')}</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(tableRows).map(([t, count]) => (
                <tr key={t} style={{borderBottom:'1px solid var(--brd)'}}>
                  <td style={{padding:'5px 8px',fontFamily:'var(--mono)',fontSize:11}}>{TABLE_LABELS[t] || t}</td>
                  <td style={{padding:'5px 8px',textAlign:'right',fontWeight:600,
                    color: t==='retention_bin' && count > 0 ? 'var(--warn)' : t==='audit_log' ? 'var(--muted)' : 'var(--txt)'}}>
                    {count != null ? count.toLocaleString('fr-FR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rétention */}
      {data.retention && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>
              Corbeille de rétention
            </div>
            {data.retention.total > 0 && (
              <span style={{fontSize:12,fontWeight:700,color: data.retention.expiring_soon > 0 ? 'var(--warn)' : 'var(--ok)'}}>
                {data.retention.total} élément{data.retention.total > 1 ? 's' : ''}
                {data.retention.expiring_soon > 0 && ` · ${data.retention.expiring_soon} expirent dans < 3 j`}
              </span>
            )}
          </div>
          <div style={{padding:16}}>
            {data.retention.total === 0
              ? <div style={{color:'var(--muted)',fontSize:13}}>{t('ret.no_retention')}</div>
              : <div style={{display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
                  {[['backup', t('sys.ret_backup')],['document', t('sys.ret_document')],['doc_file', t('sys.ret_doc_file')],['activity', t('sys.ret_activity')]].map(([k,l]) =>
                    data.retention.by_type[k] > 0 && pill(l, data.retention.by_type[k], k==='backup'?'var(--acc)':'var(--muted)')
                  )}
                </div>
            }
          </div>
        </div>
      )}

      {/* Activité 24h */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Activité des dernières 24h
          </div>
        </div>
        <div style={{padding:16,display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
          {pill(t('sys.audit_events'), data.activity_24h?.audit_events, 'var(--acc)')}
          {pill(t('sys.logins'), data.activity_24h?.logins, 'var(--ok)')}
          {pill(t('sys.failed_logins'), data.activity_24h?.failed_logins,
            (data.activity_24h?.failed_logins || 0) > 5 ? 'var(--err)' : 'var(--muted)')}
        </div>
      </div>

      {/* Cron + Whitelist + Mise à jour */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16}}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              Planifications cron
            </div>
          </div>
          <div style={{padding:16,display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
            {pill(t('sys.cron_total'), data.cron?.total, 'var(--muted)')}
            {pill(t('sys.cron_enabled'), data.cron?.enabled, 'var(--ok)')}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              Whitelist IP
            </div>
          </div>
          <div style={{padding:16,display:'flex',gap:10,flexWrap:'wrap',justifyContent:'center'}}>
            {pill(t('sys.whitelist_rules'), data.whitelist?.active_rules,
              (data.whitelist?.active_rules || 0) === 0 ? 'var(--warn)' : 'var(--ok)')}
            {(data.whitelist?.active_rules || 0) === 0 &&
              <span style={{fontSize:11,color:'var(--warn)',alignSelf:'center'}}>{t('sys.whitelist_open')}</span>}
          </div>
        </div>
        <DockerUpdateCard currentVersion={APP_VERSION} />
      </div>

    </div>
  );
}

// ── SÉCURITÉ (timeout + liste accès) ────────────────────────────────────────
function SecurityTab() {
  const { t } = useI18n();
  const defaultTab = new URLSearchParams(window.location.search).get('subtab') || 'general';
  const TABS = [
      { key: 'general',  label: t('security.general'),           icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="3"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg> },
      { key: 'rights',   label: t('security.rights'),     icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
      { key: 'oidc',     label: t('security.auth_tab') || 'Authentication', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg> },
      { key: 'notifs',   label: t('security.notifs'),      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg> },
      { key: 'cron',     label: t('security.cron'),      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> },
      { key: 'system', label: 'Système', icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> },
    ];

  const [activeTab, setActiveTab] = useState(defaultTab);

  

  return (
    <div>
      {/* Tabs horizontaux */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 16, borderBottom: '1px solid var(--brd)' }}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === tab.key ? '2px solid var(--acc)' : '2px solid transparent',
            color: activeTab === tab.key ? 'var(--acc)' : 'var(--muted)',
            fontWeight: activeTab === tab.key ? 600 : 500,
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)',
            marginBottom: -1, transition: 'color .15s, border-color .15s',
          }}>
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'general'  && <SecurityGeneralTab />}
      {activeTab === 'cron'     && <SecurityCronTab />}
      {activeTab === 'oidc'     && <SecurityOidcTab />}
      {activeTab === 'notifs'   && <SecurityNotifTab />}
      {activeTab === 'rights'   && <RolePermissionsCard />}
      {activeTab === 'system'   && <SecuritySystemTab />}
    </div>
  );
}

// ── ONGLET GÉNÉRAL : Timeout + Liste d'accès ─────────────────────────────────
function SecurityGeneralTab() {
  const { t } = useI18n();
  const [timeout, setTimeout_] = useState('30');
  const [saving, setSaving]     = useState(false);
  const [msg, setMsg]           = useState('');
  const [appUrl, setAppUrl]       = useState('');
  const [urlSaving, setUrlSaving] = useState(false);
  const [urlMsg, setUrlMsg]       = useState('');
  const [bruteMax, setBruteMax]   = useState('5');
  const [bruteWin, setBruteWin]   = useState('10');
  const [bruteSaving, setBruteSaving] = useState(false);
  const [bruteMsg, setBruteMsg]   = useState('');

  useEffect(() => {
    api.getSettings().then(s => setTimeout_(s.session_timeout_minutes || '30')).catch(() => {});
    api.smtpConfig().then(s => setAppUrl(s.app_url || '')).catch(() => {});
    api.bruteConfig().then(cfg => { setBruteMax(String(cfg.max || 5)); setBruteWin(String(Math.round((cfg.window||600)/60))); }).catch(() => {});
  }, []);






  async function saveAppUrl() {
    setUrlSaving(true); setUrlMsg('');
    try {
      await api.smtpSave({ app_url: appUrl });
      setUrlMsg(t('security.saved') || 'Saved.');
    } catch { setUrlMsg('Erreur.'); }
    finally { setUrlSaving(false); }
  }

  async function saveBrute() {
    setBruteSaving(true); setBruteMsg('');
    try {
      await api.saveBruteConfig({ max: parseInt(bruteMax), window: parseInt(bruteWin) * 60 });
      setBruteMsg('Enregistré.');
    } catch { setBruteMsg('Erreur.'); }
    finally { setBruteSaving(false); }
  }

  async function saveTimeout(e) {
    e.preventDefault(); setSaving(true); setMsg('');
    try { await api.updateSettings({ session_timeout_minutes: parseInt(timeout) }); setMsg('Enregistré.'); }
    catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Grille : Timeout | URL Application | Brute-force */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
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
              {t('security.timeout_desc') || 'Inactivity duration before logout. Alert 60s before expiry.'}
            </p>
            {msg && <div className={`alert ${msg.startsWith('Erreur') ? 'alert-err' : 'alert-ok'}`} style={{ marginBottom: 10 }}>{msg}</div>}
            <form onSubmit={saveTimeout} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <label className="form-label">{t('security.timeout') || 'Session timeout'}</label>
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

        {/* Brute-force */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Blocage brute-force
            </div>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Tentatives avant verrouillage</label>
              <select className="form-control" value={bruteMax} onChange={e => setBruteMax(e.target.value)}>
                {[3,4,5,6,7,8,10].map(n => <option key={n} value={n}>{n} tentatives</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('security.lock_duration') || 'Lock duration'}</label>
              <select className="form-control" value={bruteWin} onChange={e => setBruteWin(e.target.value)}>
                {[5,10,15,20,30,60].map(m => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </div>
            {bruteMsg && <div className="alert alert-ok" style={{ fontSize: 11, padding: '4px 10px' }}>{bruteMsg}</div>}
            <button className="btn btn-primary" onClick={saveBrute} disabled={bruteSaving} style={{ alignSelf: 'flex-end' }}>
              {bruteSaving ? '…' : 'Enregistrer'}
            </button>
          </div>
        </div>

      </div>

      {/* Rétention 50% + Liste d'accès IP 50% — même ligne */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <RetentionCard />
        <WhitelistCard />
      </div>

      {/* Card longueur minimale des mots de passe */}
      <PwdMinCard />

      {/* Sauvegarde des données */}
      <DbBackupCard />

    </div>
  );
}


// ── CARD LONGUEUR MINIMALE MDP ─────────────────────────────────────────────────
function PwdMinCard() {
  const { t } = useI18n();
  const { can, isAdmin } = usePerms();
  const currentMin = usePasswordMin(); // hook avant tout early return
  if (!isAdmin && !can('pwd_min_access')) return null;
  const [value, setValue]   = useState(String(currentMin));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');

  useEffect(() => { setValue(String(currentMin)); }, [currentMin]);

  async function save() {
    setSaving(true); setMsg('');
    try {
      await api.updateSettings({ password_min_length: parseInt(value) });
      invalidatePasswordMin();
      setMsg(t('security.pwd_min_saved') || 'Longueur minimale enregistrée.');
    } catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  const n = parseInt(value) || 8;
  // Niveau de sécurité visuel
  const level = n >= 16 ? { label: 'Élevé', color: 'var(--ok)' }
    : n >= 12 ? { label: 'Bon', color: '#22c55e' }
    : n >= 10 ? { label: 'Moyen', color: 'var(--warn)' }
    : { label: 'Faible', color: 'var(--err)' };

  const recs = [
    { org: 'CNIL',          icon: '📋', color: '#3b82f6', min: 12, note: '≥ 12 avec complexité' },
    { org: 'ANSSI',         icon: '🛡️', color: '#6366f1', min: 12, note: '≥ 12 (complexe) ou ≥ 14 (simple)' },
    { org: 'NIS2',          icon: '🌐', color: '#0891b2', min: 12, note: '≥ 12, recommande ≥ 16 critiques' },
    { org: 'NIST SP 800-63B', icon: '🔐', color: '#64748b', min: 8, note: '≥ 8, privilégier la longueur' },
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:15, height:15 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {t('security.pwd_min_title') || 'Longueur minimale des mots de passe'}
        </div>
      </div>
      <div style={{ padding:'16px 20px' }}>
        {msg && <div className={`alert alert-${msg.startsWith('Err') ? 'err' : 'ok'}`} style={{ marginBottom:14, fontSize:12 }}>{msg}</div>}

        {/* Contrôle principal */}
        <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:18 }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6 }}>
              <label style={{ fontSize:12, color:'var(--muted)', fontWeight:600 }}>
                {t('security.pwd_min_label') || 'Nombre minimum de caractères'}
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:28, fontWeight:900, color:level.color, lineHeight:1, fontVariantNumeric:'tabular-nums' }}>
                  {n}
                </span>
                <span style={{ fontSize:11, color:'var(--muted)' }}>car.</span>
                <span style={{ fontSize:10, fontWeight:700, color:level.color,
                  background:`${level.color}22`, border:`1px solid ${level.color}44`,
                  borderRadius:4, padding:'1px 6px' }}>
                  {level.label}
                </span>
              </div>
            </div>
            {/* Slider */}
            <input type="range" min="8" max="20" step="1" value={value}
              onChange={e => setValue(e.target.value)}
              style={{ width:'100%', accentColor:level.color, cursor:'pointer', height:4 }} />
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--muted)', marginTop:2 }}>
              <span>8</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span><span>20</span>
            </div>
          </div>
          <button className="btn btn-primary" onClick={save} disabled={saving}
            style={{ flexShrink:0, minWidth:100 }}>
            {saving ? '…' : t('auto_cat.save') || 'Enregistrer'}
          </button>
        </div>

        {/* Recommandations en grille */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {recs.map(r => {
            const active = n >= r.min;
            return (
              <div key={r.org} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'8px 12px', borderRadius:'var(--r)',
                background: active ? `${r.color}12` : 'var(--surf2)',
                border: `1px solid ${active ? r.color + '44' : 'var(--brd)'}`,
                transition:'all .2s',
              }}>
                <span style={{ fontSize:18, flexShrink:0 }}>{r.icon}</span>
                <div style={{ minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, color: active ? r.color : 'var(--muted)' }}>
                    {r.org}
                    {active && <span style={{ marginLeft:5, fontSize:10 }}>✓</span>}
                  </div>
                  <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.4, marginTop:1 }}>{r.note}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ fontSize:10, color:'var(--muted)', marginTop:10, lineHeight:1.5 }}>
          {t('security.pwd_min_hint') || 'S\'applique aux comptes locaux, documents sécurisés et sauvegardes chiffrées.'}
        </div>
      </div>
    </div>
  );
}

// ── WHITELIST CARD (extraite pour layout 50/50) ──────────────────────────────
function WhitelistCard() {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ type: 'ip', value: '', label: '' });
  const [confirm, setConfirm] = useState(null);
  const [wlError, setWlError] = useState('');
  const loadWl = () => api.whitelist().then(setRows).catch(() => {});
  useEffect(() => { loadWl(); }, []);

  async function addRule(e) {
    e.preventDefault(); setWlError('');
    if (!form.value.trim()) { setWlError('Valeur requise'); return; }
    try { await api.addWhitelist(form); setForm({ type: 'ip', value: '', label: '' }); loadWl(); }
    catch (ex) { setWlError(ex.message || 'Erreur'); }
  }
  async function toggleRule(r) {
    await api.updateWhitelist(r.id, { ...r, enabled: r.enabled ? 0 : 1 }); loadWl();
  }

  return (
    <div className="card" style={{ height: '100%' }}>
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          {t('security.whitelist') || "Liste d'accès IP / URL"}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div className="alert alert-warn" style={{ marginBottom: 14, justifyContent: 'center', textAlign: 'center', fontSize: 12 }}>
          {t('security.whitelist_desc') || "Liste vide = tout accès autorisé à l'application. Dès qu'une règle est active, seules les adresses listées peuvent accéder à l'application."}
        </div>
        {wlError && <div className="alert alert-err">{wlError}</div>}
        <form onSubmit={addRule} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <select className="form-control" style={{ width: 90 }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="ip">IP</option>
            <option value="url">URL</option>
          </select>
          <input className="form-control" style={{ flex: 1, minWidth: 120 }} value={form.value}
            onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
            placeholder={form.type === 'ip' ? '192.168.1.0' : 'https://mon-domaine.com'} />
          <input className="form-control" style={{ flex: 1, minWidth: 100 }} value={form.label}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Description (opt.)" />
          <button className="btn btn-primary" type="submit">{t('auto_cat.add')}</button>
        </form>
        <table>
          <thead><tr><th>{t('auto_cat.col_type')}</th><th>Valeur</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td><span className={`badge ${r.type === 'ip' ? 'badge-info' : 'badge-warn'}`}>{r.type.toUpperCase()}</span></td>
                <td><span className="cell-mono" style={{ fontSize: 11 }}>{r.value}</span></td>
                <td>
                  <button onClick={() => toggleRule(r)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    {r.enabled
                      ? <span className="badge badge-ok"><span className="dot dot-ok"/>{t('users.enabled')}</span>
                      : <span className="badge badge-muted"><span className="dot dot-muted"/>Inactif</span>}
                  </button>
                </td>
                <td><button className="btn btn-sm btn-danger" onClick={() => setConfirm(r)}>Suppr.</button></td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>{t('security.no_rules') || 'Aucune règle'}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {confirm && <ConfirmModal message={`Supprimer la règle "${confirm.value}" ?`}
        onConfirm={async () => { await api.deleteWhitelist(confirm.id); setConfirm(null); loadWl(); }}
        onCancel={() => setConfirm(null)} />}
    </div>
  );
}




// ── DB BACKUP CARD ───────────────────────────────────────────────────────────
const DB_BACKUP_RETENTION_OPTIONS = [1,2,3,5,7,10,14,21,30];
const DB_BACKUP_HOURS = Array.from({length:24},(_,i)=>i);
const DB_BACKUP_MINUTES = [0,5,10,15,20,25,30,35,40,45,50,55];

function DbBackupCard() {
  const { t } = useI18n();
  const { can } = usePerms();
  const passwordMin = usePasswordMin();
  // États — tous les hooks avant le return conditionnel
  const [files, setFiles]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [triggering, setTriggering]   = useState(false);
  const [triggerMsg, setTriggerMsg]   = useState('');
  const [downloading, setDownloading] = useState(null);
  const [deleting, setDeleting]       = useState(null);
  const [confirmDel, setConfirmDel]   = useState(null);
  const [restoring, setRestoring]     = useState(false);
  const [restoreMsg, setRestoreMsg]   = useState('');
  const [restoreModal, setRestoreModal] = useState(null); // { file, isEnc } — modal de confirmation/mdp
  const [hasPassword, setHasPassword]           = useState(false); // la config a un mdp de chiffrement
  const [showTriggerPwd, setShowTriggerPwd]     = useState(false); // modal mdp avant sauvegarde manuelle
  const [triggerPwdInput, setTriggerPwdInput]   = useState('');
  const [totalSize, setTotalSize] = useState(0);
  const fileInputRef = useRef(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.dbBackups().catch(() => ({ files: [], total_size: 0 })),
      api.dbBackupConfig().catch(() => ({})),
    ]).then(([res, cfg]) => {
      setFiles(Array.isArray(res) ? res : (res.files || []));
      setTotalSize(Array.isArray(res) ? 0 : (res.total_size || 0));
      setHasPassword(!!cfg.has_password);
    }).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  async function triggerNow(pwdOverride) {
    if (hasPassword && !pwdOverride) {
      // Demander le mot de passe avant de chiffrer
      setShowTriggerPwd(true); setTriggerPwdInput('');
      return;
    }
    setShowTriggerPwd(false);
    setTriggering(true); setTriggerMsg('');
    try {
      await api.dbBackupTrigger(pwdOverride ? { password: pwdOverride } : {});
      setTriggerMsg('Sauvegarde effectuée.'); setTriggerPwdInput(''); load();
    }
    catch (e) { setTriggerMsg('Erreur : ' + e.message); }
    finally { setTriggering(false); }
  }

  async function download(filename) {
    setDownloading(filename);
    try {
      // Le fichier est téléchargé tel quel (brut) — chiffré si chiffré sur le serveur.
      const blob = await api.dbBackupDownload(filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename; // vrai nom conservé (.sqlite ou .sqlite.enc)
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { alert('Erreur téléchargement : ' + e.message); }
    finally { setDownloading(null); }
  }

  async function deleteBackup(filename) {
    setDeleting(filename); setConfirmDel(null);
    try { await api.dbBackupDelete(filename); load(); }
    catch (e) { alert('Erreur suppression : ' + e.message); }
    finally { setDeleting(null); }
  }

  function openRestore() { fileInputRef.current?.click(); }

  function handleRestoreFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.endsWith('.sqlite') && !file.name.endsWith('.sqlite.enc')) {
      setRestoreMsg("Fichier invalide — sélectionnez un .sqlite ou .sqlite.enc"); return;
    }
    // Ouvrir le modal custom (mot de passe masqué + confirmation)
    setRestoreModal({ file, isEnc: file.name.endsWith('.enc') });
  }

  async function doRestore(file, password) {
    setRestoreModal(null);
    setRestoring(true); setRestoreMsg('');
    try {
      const base64 = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result.split(',')[1]);
        r.onerror = () => rej(new Error('Lecture échouée'));
        r.readAsDataURL(file);
      });
      await api.dbBackupRestore({ data: base64, filename: file.name, password: password || undefined });
      setRestoreMsg('Base restaurée. Rechargement…');
      setTimeout(() => window.location.reload(), 1500);
    } catch (e) { setRestoreMsg('Erreur : ' + e.message); }
    finally { setRestoring(false); }
  }

  const fmtSize = b => b >= 1048576 ? (b/1048576).toFixed(1)+' Mo' : b >= 1024 ? (b/1024).toFixed(0)+' Ko' : b+' o';

  if (!can('site_backup_access')) return null;

  return (
    <div className="card">
      <input ref={fileInputRef} type="file" accept=".sqlite,.sqlite.enc" style={{ display:'none' }} onChange={handleRestoreFile} />
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:15, height:15 }}>
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          Sauvegarde des données
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <button className="btn" onClick={openRestore} disabled={restoring}
            style={{ display:'flex', alignItems:'center', gap:6, borderColor:'var(--err)', color:'var(--err)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14 }}>
              <path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
            </svg>
            {restoring ? 'Restauration…' : 'Restaurer'}
          </button>
          <button className="btn" onClick={() => triggerNow()} disabled={triggering}
            style={{ display:'flex', alignItems:'center', gap:6, borderColor:'#f97316', color:'#f97316' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:14, height:14 }}>
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
            </svg>
            {triggering ? 'Sauvegarde…' : 'Sauvegarder'}
          </button>

        </div>
      </div>
      <div style={{ padding:16 }}>
        {(triggerMsg || restoreMsg) && (
          <div className={`alert alert-${(triggerMsg||restoreMsg).startsWith('Err') ? 'err' : 'ok'}`}
            style={{ marginBottom:12, fontSize:12 }}>
            {triggerMsg || restoreMsg}
          </div>
        )}
        {loading
          ? <div style={{ textAlign:'center', padding:32, color:'var(--muted)' }}>Chargement…</div>
          : files.length === 0
            ? <div style={{ textAlign:'center', padding:32, color:'var(--muted)', fontSize:13 }}>Aucune sauvegarde disponible.</div>
            : (
              <table style={{ width:'100%' }}>
                <thead><tr><th>Fichier</th><th>Date</th><th>Taille</th><th></th></tr></thead>
                <tbody>
                  {files.map(f => (
                    <tr key={f.filename}>
                      <td>
                        <span className="cell-mono" style={{ fontSize:11 }}>{f.filename}</span>
                        {f.encrypted && (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                            style={{ width:11, height:11, marginLeft:5, color:'var(--ok)', verticalAlign:'middle' }}
                            title="Chiffré AES-256-GCM">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                          </svg>
                        )}
                      </td>
                      <td className="cell-sub">{f.created_at}</td>
                      <td className="cell-sub">{fmtSize(f.size)}</td>
                      <td style={{ textAlign:'right', whiteSpace:'nowrap', display:'flex', gap:6, justifyContent:'flex-end' }}>
                        <button className="btn btn-sm" onClick={() => download(f.filename)}
                          disabled={downloading === f.filename}
                          style={{ borderColor:'var(--ok)', color:'var(--ok)', display:'inline-flex', alignItems:'center', gap:4 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:12, height:12 }}>
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                          </svg>
                          {downloading === f.filename ? '…' : 'Télécharger'}
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(f.filename)}
                          disabled={deleting === f.filename}>
                          {deleting === f.filename ? '…' : '✕'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
        }
      </div>

      {/* Mini-modal mot de passe avant sauvegarde manuelle */}
      {showTriggerPwd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1300 }}
          onClick={() => setShowTriggerPwd(false)}>
          <div style={{ background:'var(--surf)', borderRadius:'var(--rl)', padding:24, width:380, boxShadow:'0 8px 40px rgba(0,0,0,.5)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:700, marginBottom:8, display:'flex', alignItems:'center', gap:8 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:16, height:16, color:'#f97316' }}>
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Mot de passe de chiffrement
            </div>
            <p style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>
              Entrez le mot de passe pour chiffrer cette sauvegarde.
            </p>
            <input className="form-control" type="password" autoFocus
              placeholder={`Mot de passe (min. ${passwordMin} caractères)`}
              value={triggerPwdInput}
              onChange={e => setTriggerPwdInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && triggerPwdInput.length >= passwordMin && triggerNow(triggerPwdInput)}
              style={{ marginBottom:12 }} />
            {triggerPwdInput.length > 0 && triggerPwdInput.length < passwordMin && (
              <div style={{ fontSize:11, color:'var(--err)', marginBottom:8 }}>
                {t('security.pwd_min_chars')||'Minimum'} {passwordMin} ({triggerPwdInput.length}/{passwordMin})
              </div>
            )}
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button className="btn btn-primary" disabled={triggerPwdInput.length < passwordMin || triggering}
                onClick={() => triggerNow(triggerPwdInput)}>
                {triggering ? 'Sauvegarde…' : 'Sauvegarder'}
              </button>
              <button className="btn" onClick={() => setShowTriggerPwd(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}
      {/* Modal de restauration — mot de passe masqué + confirmation */}
      {restoreModal && (
        <RestoreModal
          file={restoreModal.file}
          isEnc={restoreModal.isEnc}
          onConfirm={(pwd) => doRestore(restoreModal.file, pwd)}
          onCancel={() => setRestoreModal(null)} />
      )}
            {confirmDel && (
        <ConfirmModal
          message={`Supprimer la sauvegarde "${confirmDel}" ?\nCette action est irréversible.`}
          onConfirm={() => deleteBackup(confirmDel)}
          onCancel={() => setConfirmDel(null)} />
      )}
    </div>
  );
}

// ── RESTORE MODAL ────────────────────────────────────────────────────────────
function RestoreModal({ file, isEnc, onConfirm, onCancel }) {
  const [pwd, setPwd]         = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const passwordMin = usePasswordMin();
  const isValid = !isEnc || pwd.length >= passwordMin;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1300 }}
      onClick={onCancel}>
      <div style={{ background:'var(--surf)', borderRadius:'var(--rl)', padding:24, width:460, maxWidth:'calc(100vw - 32px)', boxShadow:'0 8px 40px rgba(0,0,0,.5)' }}
        onClick={e => e.stopPropagation()}>

        {/* Titre */}
        <div style={{ fontWeight:700, fontSize:15, marginBottom:16, display:'flex', alignItems:'center', gap:8 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:18, height:18, color:'var(--err)', flexShrink:0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Restaurer la base de données
        </div>

        {/* Avertissement structuré */}
        <div style={{ background:'rgba(var(--err-rgb,220,53,69),0.1)', border:'1px solid var(--err)', borderRadius:'var(--r)', padding:'12px 14px', marginBottom:16, fontSize:13 }}>
          <div style={{ fontWeight:700, color:'var(--err)', marginBottom:6 }}>⚠ Action irréversible</div>
          <div style={{ color:'var(--fg)', lineHeight:1.6 }}>
            La base de données actuelle sera remplacée par&nbsp;:
          </div>
          <div style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--acc)', wordBreak:'break-all',
            background:'var(--surf2)', padding:'4px 8px', borderRadius:4, marginTop:6 }}>
            {file.name}
          </div>
          <div style={{ color:'var(--muted)', fontSize:12, marginTop:8, lineHeight:1.5 }}>
            Une sauvegarde de sécurité de l'état actuel sera créée automatiquement avant l'écrasement.
          </div>
        </div>

        {/* Mot de passe — uniquement si fichier chiffré */}
        {isEnc && (
          <div className="form-group" style={{ margin:'0 0 16px' }}>
            <label className="form-label">Mot de passe de déchiffrement</label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <input className="form-control" type={showPwd ? 'text' : 'password'}
                autoFocus
                placeholder={`Mot de passe (min. ${passwordMin} caractères)`}
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && isValid && onConfirm(pwd)}
                style={{ paddingRight:36 }} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position:'absolute', right:8, background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:0 }}>
                {showPwd
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {pwd.length > 0 && pwd.length < passwordMin && (
              <div style={{ fontSize:11, color:'var(--err)', marginTop:4 }}>
                {t('security.pwd_min_chars')||'Minimum'} {passwordMin} ({pwd.length}/{passwordMin})
              </div>
            )}
          </div>
        )}

        {/* Boutons */}
        <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
          <button className="btn" onClick={onCancel}>Annuler</button>
          <button className="btn" style={{ background:'var(--err)', color:'#fff', borderColor:'var(--err)', fontWeight:600 }}
            disabled={!isValid}
            onClick={() => onConfirm(isEnc ? pwd : undefined)}>
            Restaurer
          </button>
        </div>
      </div>
    </div>
  );
}

function DbBackupScheduleModal({ onClose }) {
  const [cfg, setCfg]         = useState({ frequency:'daily', hour:'2', minute:'0', retention_count:'7' });
  const passwordMin = usePasswordMin();
  const [hasPassword, setHasPassword] = useState(false); // un mdp est configuré côté serveur
  const [newPassword, setNewPassword] = useState('');    // nouveau mdp saisi (vide = garder l'ancien)
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');
  const [showPwd, setShowPwd] = useState(false);

  useEffect(() => {
    api.dbBackupConfig().then(d => {
      setCfg({ frequency: d.frequency||'daily', hour: d.hour||'2', minute: d.minute||'0', retention_count: d.retention_count||'7' });
      setHasPassword(!!d.has_password);
    }).catch(() => {});
    api.dbBackups().then(res => {
      const ts = Array.isArray(res) ? res.reduce((s,f) => s+f.size, 0) : (res.total_size || 0);
      setTotalSize(ts);
    }).catch(() => {});
  }, []);

  async function save() {
    // Mot de passe : si l'utilisateur a saisi quelque chose, on valide et on l'envoie
    // Sinon on envoie undefined pour que le backend garde l'ancien
    if (newPassword && newPassword.length < passwordMin) {
      setMsg(`Erreur : le mot de passe doit faire au moins ${passwordMin} caractères.`);
      return;
    }
    setSaving(true); setMsg('');
    try {
      const payload = { ...cfg };
      if (newPassword) payload.backup_password = newPassword;
      // Si l'utilisateur efface tout (newPassword vide) et qu'il y avait un mdp,
      // on considère qu'il veut le garder — pour le supprimer il doit saisir explicitement.
      await api.dbBackupSaveConfig(payload);
      if (newPassword) {
        setHasPassword(true);
        setNewPassword('');
      }
      setMsg('Planification enregistrée.');
    }
    catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  async function removePassword() {
    if (!window.confirm('Supprimer le mot de passe de chiffrement ?\nLes prochaines sauvegardes ne seront plus chiffrées.')) return;
    setSaving(true); setMsg('');
    try {
      await api.dbBackupSaveConfig({ ...cfg, backup_password: '' });
      setHasPassword(false); setNewPassword('');
      setMsg('Mot de passe supprimé. Les prochaines sauvegardes ne seront plus chiffrées.');
    }
    catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1200 }}
      onClick={onClose}>
      <div style={{ background:'var(--surf)', borderRadius:'var(--rl)', width:'100%', maxWidth:480, boxShadow:'0 8px 40px rgba(0,0,0,.5)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--brd)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontWeight:700, fontSize:15, display:'flex', alignItems:'center', gap:8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:16, height:16 }}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>
            </svg>
            {t('cron.db_backup_sqlite_title') || 'Planification des sauvegardes automatiques SQLite'}
          </div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding:20, display:'flex', flexDirection:'column', gap:16 }}>
          {msg && <div className={`alert alert-${msg.startsWith('Err') ? 'err' : 'ok'}`} style={{ fontSize:12 }}>{msg}</div>}

          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">Fréquence</label>
            <select className="form-control" value={cfg.frequency} onChange={e => setCfg(c => ({...c, frequency: e.target.value}))}>
              <option value="daily">Quotidien</option>
              <option value="weekly">Hebdomadaire</option>
              <option value="monthly">Mensuel</option>
            </select>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label">Heure</label>
              <select className="form-control" value={cfg.hour} onChange={e => setCfg(c => ({...c, hour: e.target.value}))}>
                {DB_BACKUP_HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}h</option>)}
              </select>
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label">Minutes</label>
              <select className="form-control" value={cfg.minute} onChange={e => setCfg(c => ({...c, minute: e.target.value}))}>
                {DB_BACKUP_MINUTES.map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label">Nombre de sauvegardes à conserver</label>
            <select className="form-control" value={cfg.retention_count} onChange={e => setCfg(c => ({...c, retention_count: e.target.value}))}>
              {DB_BACKUP_RETENTION_OPTIONS.map(n => <option key={n} value={n}>{n} sauvegarde{n>1?'s':''}</option>)}
            </select>
          </div>

          {/* Mot de passe de chiffrement */}
          <div className="form-group" style={{ margin:0 }}>
            <label className="form-label" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                Mot de passe de chiffrement
                {hasPassword && (
                  <span style={{ fontSize:11, color:'var(--ok)', fontWeight:600 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:11, height:11, verticalAlign:'middle', marginRight:3 }}>
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    Actif
                  </span>
                )}
              </span>
              {hasPassword && (
                <button type="button" className="btn btn-sm" onClick={removePassword}
                  style={{ fontSize:11, color:'var(--err)', borderColor:'var(--err)', padding:'1px 8px' }}>
                  Supprimer
                </button>
              )}
            </label>
            <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
              <input className="form-control" type={showPwd ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder={hasPassword ? '••••••••••••••  (laisser vide pour conserver)' : `Laisser vide = pas de chiffrement (min. ${passwordMin} car.)`}
                style={{ paddingRight:36 }} />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position:'absolute', right:8, background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:0 }}>
                {showPwd
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {newPassword.length > 0 && newPassword.length < passwordMin && (
              <div style={{ fontSize:11, color:'var(--err)', marginTop:4 }}>
                {passwordMin} {t('security.pwd_min_chars')||'caractères'} ({newPassword.length}/{passwordMin})
              </div>
            )}
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:4, lineHeight:1.5 }}>
              {hasPassword
                ? 'Un mot de passe est actif. Laissez le champ vide pour le conserver, ou saisissez-en un nouveau pour le remplacer.'
                : 'Si renseigné, les fichiers de backup seront chiffrés en AES-256-GCM. Conservez ce mot de passe en lieu sûr.'}
            </div>
          </div>

          <div style={{ fontSize:11, color:'var(--muted)', background:'var(--surf2)', padding:'8px 12px', borderRadius:'var(--r)' }}>
            {t('cron.vacuum_into_hint') || 'Le backup utilise'} <code>VACUUM INTO</code> — {t('cron.vacuum_into_simple') || 'cohérent sans interruption de service.'}
          </div>
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--brd)', display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

// ── RETENTION CARD ──────────────────────────────────────────────────────────
const RETENTION_DAYS = [0, 7, 15, 30, 60];

function RetentionCard() {
  const { t } = useI18n();
  const { can } = usePerms();

  // Cacher toute la card si l'utilisateur n'a pas accès à la rétention
  if (!can('retention_access')) return null;
  const [settings, setSettings] = useState({ backup_days: 0, document_days: 0, doc_file_days: 0, activity_days: 0 });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [retentionCount, setRetentionCount] = useState(0);

  useEffect(() => {
    api.retentionSettings().then(setSettings).catch(() => {});
    if (can('retention_access')) {
      api.retentionCount().then(r => setRetentionCount(r.count || 0)).catch(() => {});
    }
  }, []);

  async function save() {
    setSaving(true); setMsg('');
    try { await api.retentionSave(settings); setMsg('Enregistré.'); } catch (e) { setMsg('Erreur: ' + e.message); }
    finally { setSaving(false); }
  }

  const dayLabel = d => d === 0 ? t('ret.day_label_none') : `${d} jours`;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>
          </svg>
          {t('ret.title')}
        </div>
        <button className="btn" onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, borderColor: 'var(--ok)', color: 'var(--ok)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
            <path d="M3 12h4l3-9 4 18 3-9h4"/>
          </svg>
          {t('ret.btn')}
          {retentionCount > 0 && (
            <span style={{ background: 'var(--ok)', color: '#fff', borderRadius: 10, padding: '0 6px', fontSize: 10, fontWeight: 700 }}>
              {retentionCount}
            </span>
          )}
        </button>
      </div>
      <div style={{ padding: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          {t('ret.desc')}
        </p>
        {msg && <div className={`alert alert-${msg.startsWith('Err') ? 'err' : 'ok'}`} style={{ marginBottom: 12, fontSize: 12 }}>{msg}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {[
            { key: 'backup_days',   label: t('ret.backup_days') },
            { key: 'document_days', label: t('ret.document_days') },
            { key: 'doc_file_days', label: t('ret.doc_file_days') },
            { key: 'activity_days', label: t('ret.activity_days') },
          ].map(({ key, label }) => (
            <div className="form-group" key={key} style={{ margin: 0 }}>
              <label className="form-label">{label}</label>
              <select className="form-control" value={settings[key] || 0}
                onChange={e => setSettings(s => ({ ...s, [key]: parseInt(e.target.value) }))}>
                {RETENTION_DAYS.map(d => <option key={d} value={d}>{dayLabel(d)}</option>)}
              </select>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? t('common.saving') : t('common.save') || 'Enregistrer'}</button>
        </div>
      </div>
      {showModal && <RetentionModal onClose={() => { setShowModal(false); api.retentionCount().then(r => setRetentionCount(r.count || 0)).catch(() => {}); }} />}
    </div>
  );
}

function RetentionModal({ onClose }) {
  const { t } = useI18n();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('backup');
  const [confirmDel, setConfirmDel] = useState(null);

  const load = () => {
    setLoading(true);
    api.retentionBin().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const filtered = items.filter(item =>
    activeTab === 'backup'     ? item.item_type === 'backup' :
    activeTab === 'automation' ? item.item_type === 'document' || item.item_type === 'doc_file' :
    activeTab === 'activity'   ? item.item_type === 'activity' : false
  );

  const counts = {
    backup:     items.filter(i => i.item_type === 'backup').length,
    automation: items.filter(i => i.item_type === 'document' || i.item_type === 'doc_file').length,
    activity:   items.filter(i => i.item_type === 'activity').length,
  };

  async function restore(id) {
    await api.retentionRestore(id);
    load();
  }

  async function deleteDef(id) {
    await api.retentionDelete(id);
    setConfirmDel(null);
    load();
  }

  const TABS = [
    { key: 'backup',     label: t('ret.tab_backup'),      count: counts.backup },
    { key: 'automation', label: t('ret.tab_automation'),  count: counts.automation },
    { key: 'activity',   label: t('ret.tab_activity'),   count: counts.activity },
  ];

  const fmtDate = d => d ? d.slice(0, 16) : '—';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200 }}
      onClick={onClose}>
      <div style={{ background: 'var(--surf)', borderRadius: 'var(--rl)', width: '100%', maxWidth: 'calc(76vw - 400px)', height: 600, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,.5)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{t('ret.modal_title')} ({items.length} élément{items.length !== 1 ? 's' : ''})</div>
          <button className="btn btn-sm" onClick={onClose}>✕</button>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--brd)', padding: '0 20px' }}>
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              style={{ padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13,
                color: activeTab === tab.key ? 'var(--acc)' : 'var(--muted)',
                borderBottom: activeTab === tab.key ? '2px solid var(--acc)' : '2px solid transparent',
                fontWeight: activeTab === tab.key ? 700 : 400, display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab.label}
              {tab.count > 0 && <span style={{ background: 'var(--acc)', color: '#fff', borderRadius: 10, padding: '1px 6px', fontSize: 10 }}>{tab.count}</span>}
            </button>
          ))}
        </div>
        {/* Content */}
        <div className="modal-device-list" style={{ flex: 1, overflowY: 'auto', padding: '12px 20px',
          scrollbarWidth: 'thin', scrollbarColor: 'var(--brd) var(--surf2)' }}>
          {loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>Chargement…</div>
           : filtered.length === 0 ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 13 }}>{t('ret.empty')}</div>
           : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--brd)' }}>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, width: '40%' }}>{t('ret.col_item')}</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, width: '15%' }}>{t('ret.col_deleted_by')}</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, width: '18%' }}>{t('ret.col_deleted_at')}</th>
                  <th style={{ padding: '8px 6px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, width: '18%' }}>{t('ret.col_expires_at')}</th>
                  <th style={{ padding: '8px 6px', width: '9%' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--brd)' }}>
                    <td style={{ padding: '8px 6px' }}>
                      <div style={{ fontWeight: 600 }}>{item.meta?.label || item.item_data?.name || item.item_data?.filename || `#${item.item_id}`}</div>
                      {item.meta?.doc_name && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{item.meta.doc_name}</div>}
                      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>{item.item_type}</div>
                    </td>
                    <td style={{ padding: '8px 6px', color: 'var(--muted)' }}>{item.deleted_by_name}</td>
                    <td style={{ padding: '8px 6px', color: 'var(--muted)', fontFamily: 'var(--mono)' }}>{fmtDate(item.deleted_at)}</td>
                    <td style={{ padding: '8px 6px' }}>
                      {item.expires_at
                        ? <span style={{ color: new Date(item.expires_at) < new Date(Date.now() + 3*86400000) ? 'var(--warn)' : 'var(--muted)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                            {fmtDate(item.expires_at)}
                          </span>
                        : <span style={{ color: 'var(--muted)' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px 6px', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                        <button className="btn btn-sm" onClick={() => restore(item.id)}
                          style={{ borderColor: 'var(--ok)', color: 'var(--ok)', fontSize: 11 }}>{t('ret.restore')}</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(item)} style={{ fontSize: 11 }}>✕</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {confirmDel && (
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: 'var(--surf)', borderRadius: 'var(--rl)', padding: 24, maxWidth: 360, boxShadow: '0 4px 20px rgba(0,0,0,.4)' }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>{t('ret.confirm_del_title')}</div>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>{t('ret.confirm_del_msg')}</p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn" onClick={() => setConfirmDel(null)}>Annuler</button>
                <button className="btn btn-danger" onClick={() => deleteDef(confirmDel.id)}>{t('ret.delete_def')}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}



// ── ONGLET NOTIFICATIONS ──────────────────────────────────────────────────────
// Modals de configuration des canaux
// ── RECIPIENTS MODAL ─────────────────────────────────────────────────────────
function RecipientsModal({ onClose }) {
  const { t } = useI18n();
  const [mode, setMode]       = useState('admins_only'); // admins_only | admins_and_extra | extra_only
  const [emails, setEmails]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState('');

  useEffect(() => {
    api.getSettings().then(s => {
      setMode(s.notif_recipients_mode || 'admins_only');
      setEmails(s.notif_extra_emails || '');
    }).catch(() => {});
  }, []);

  async function save() {
    setSaving(true); setMsg('');
    try {
      await api.updateSettings({ notif_recipients_mode: mode, notif_extra_emails: emails });
      setMsg('Destinataires enregistrés.');
    } catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <Modal title="Destinataires des notifications" onClose={onClose}
      footer={
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? '…' : 'Enregistrer'}</button>
          <button className="btn" onClick={onClose}>Fermer</button>
        </div>
      }>
      {msg && <div className={`alert alert-${msg.startsWith('Err') ? 'err' : 'ok'}`} style={{ marginBottom:12, fontSize:12 }}>{msg}</div>}

      <div className="form-group" style={{ marginBottom:14 }}>
        <label className="form-label">Mode d'envoi</label>
        {[
          { val:'admins_only',      label:'Administrateurs uniquement', desc:'Les notifications sont envoyées aux admins ayant un email configuré.' },
          { val:'admins_and_extra', label:'Administrateurs + destinataires supplémentaires', desc:'Les admins ET les adresses ci-dessous reçoivent les notifications.' },
          { val:'extra_only',       label:'Destinataires supplémentaires uniquement', desc:'Seules les adresses ci-dessous reçoivent les notifications.' },
        ].map(opt => (
          <label key={opt.val} style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', marginBottom:10 }}>
            <input type="radio" name="recip_mode" value={opt.val} checked={mode === opt.val}
              onChange={() => setMode(opt.val)} style={{ marginTop:2, flexShrink:0 }} />
            <div>
              <div style={{ fontWeight:600, fontSize:13 }}>{opt.label}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:2 }}>{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>

      {mode !== 'admins_only' && (
        <div className="form-group" style={{ margin:0 }}>
          <label className="form-label">Adresses email supplémentaires</label>
          <textarea className="form-control" rows={4}
            value={emails}
            onChange={e => setEmails(e.target.value)}
            placeholder={"contact@example.com\nautredestinataire@example.com"}
            style={{ fontFamily:'var(--mono)', fontSize:12, resize:'vertical' }} />
          <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>
            Une adresse par ligne (ou séparées par des virgules).
          </div>
        </div>
      )}
    </Modal>
  );
}

function SmtpModal({ onClose, onSaved, onValidated, onReset, onOpenRecipients }) {
  const { t } = useI18n();
  const [s, setS] = useState({ host:'', port:'587', secure:false, user:'', pass:'', from:'' });
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [testing, setTesting]     = useState(false);
  const [msg, setMsg]             = useState('');
  const [err, setErr]             = useState('');
  const [hasExistingPass, setHasExistingPass] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [awaitCode, setAwaitCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [validated, setValidated] = useState(false);
  useEffect(() => {
    api.smtpConfig().then(c => {
      setS({ host:c.host||'', port:String(c.port||587), secure:!!c.secure,
             user:c.user||'', pass:'', from:c.from||'' });
      setHasExistingPass(!!(c.pass));
    }).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  const save = async e => {
    e.preventDefault(); setSaving(true); setMsg(''); setErr('');
    try {
      const payload = { ...s, port:parseInt(s.port)||587 };
      if (!payload.pass) delete payload.pass;
      await api.smtpSave(payload);
      if (s.pass) setHasExistingPass(true);
      onSaved('email');
      setMsg(t('notif.saved_msg'));
    } catch(e){setErr(e.message);} finally{setSaving(false);} };
  const reset = async () => { setConfirmReset(false); try { await api.smtpSave({ host:'', port:587, secure:false, user:'', pass:'', from:'', app_url:'' }); setS({ host:'', port:'587', secure:false, user:'', pass:'', from:'' }); setValidated(false); setAwaitCode(false); setMsg(''); setHasExistingPass(false); onReset?.(); } catch(e){setErr(e.message);} };
  const test = async () => { setTesting(true); setMsg(''); setErr(''); setAwaitCode(false); setCodeInput(''); setValidated(false);
    try { const r=await api.smtpTest(); setMsg(`Code envoyé à ${r.to} — entrez-le pour valider.`); setAwaitCode(true); } catch(e){setErr('Erreur: '+e.message);} finally{setTesting(false);} };
  const validate = async () => { setErr('');
    try { await api.smtpValidate(codeInput); setValidated(true); setAwaitCode(false); setMsg(t('notif.validated_smtp')); onValidated?.(); } catch(e){setErr(e.message);} };
  return (
    <Modal title="Configuration SMTP" onClose={onClose}
      footer={
        <div style={{display:'flex',justifyContent:'space-between',width:'100%',alignItems:'center'}}>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button className="btn" onClick={() => setConfirmReset(true)}
              style={{color:'var(--err)',borderColor:'var(--err)',fontSize:12}}>⊘ Reset</button>
            <button className="btn" onClick={onOpenRecipients}
              style={{color:'var(--ok)',borderColor:'var(--ok)',fontSize:12,display:'flex',alignItems:'center',gap:5}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              Destinataires
            </button>
          </div>
          <div style={{display:'flex',gap:8}}>
            {awaitCode
              ? <button className="btn btn-primary" onClick={validate} disabled={codeInput.length < 4}>Valider le code</button>
              : <button className="btn" onClick={test} disabled={testing||!s.host} style={validated?{borderColor:'var(--ok)',color:'var(--ok)'}:{}}>{testing?'Envoi…':'Tester'}{validated?' ✓':''}</button>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'…':'Enregistrer'}</button>
          </div>
        </div>
      }>
      {loading?<div style={{textAlign:'center',padding:20}}><Spinner/></div>:<>
        {msg&&<div className="alert alert-ok" style={{marginBottom:12,fontSize:12}}>{msg}</div>}
        {err&&<div className="alert alert-err" style={{marginBottom:12,fontSize:12}}>{err}</div>}
        {confirmReset && (
        <div style={{background:'rgba(0,0,0,.5)',position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'var(--rl)',zIndex:10}}>
          <div style={{background:'var(--surf)',padding:24,borderRadius:'var(--r)',maxWidth:320,boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}>
            <div style={{fontWeight:700,marginBottom:8}}>Réinitialiser la configuration SMTP ?</div>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:16}}>La configuration sera effacée et la validation annulée.</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={()=>setConfirmReset(false)}>Annuler</button>
              <button className="btn" style={{color:'var(--err)',borderColor:'var(--err)'}} onClick={reset}>Réinitialiser</button>
            </div>
          </div>
        </div>
      )}
            {awaitCode && (
          <div style={{marginBottom:12,display:'flex',gap:8,alignItems:'center'}}>
            <input className="form-control" placeholder={t('notif.code_placeholder')} value={codeInput}
              onChange={e=>setCodeInput(e.target.value.replace(/\D/g,'').slice(0,6))}
              style={{letterSpacing:6,fontFamily:'var(--mono)',fontSize:18,textAlign:'center',maxWidth:160}}
              autoFocus />
            <span style={{fontSize:12,color:'var(--muted)'}}>{t('notif.code_hint')}</span>
          </div>
        )}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          <div className="form-group" style={{margin:0}}><label className="form-label">{t('security.smtp_host') || 'SMTP host'}</label><input className="form-control" value={s.host} onChange={e=>setS(x=>({...x,host:e.target.value}))} placeholder="smtp.gmail.com"/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">Port</label><input className="form-control" type="number" value={s.port} onChange={e=>setS(x=>({...x,port:e.target.value}))} placeholder="587"/></div>
          <div className="form-group" style={{margin:0}}><label className="form-label">{t('audit.user')}</label><input className="form-control" value={s.user} onChange={e=>setS(x=>({...x,user:e.target.value}))} placeholder="user@domaine.com"/></div>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">{t('security.smtp_password') || 'Password'}{hasExistingPass && !s.pass && <span style={{fontSize:10,color:'var(--ok)',marginLeft:6,fontWeight:600}}>✓ configuré</span>}</label>
            <input className="form-control" type="password" value={s.pass} onChange={e=>setS(x=>({...x,pass:e.target.value}))} placeholder={hasExistingPass ? '••••••• (laisser vide pour conserver)' : '••••••••'}/>
          </div>
          <div className="form-group" style={{margin:0,gridColumn:'1/-1'}}><label className="form-label">{t('security.smtp_from') || 'Sender (From)'}</label><input className="form-control" value={s.from} onChange={e=>setS(x=>({...x,from:e.target.value}))} placeholder="NexusVault <no-reply@domaine.com>"/></div>
        </div>
        <label style={{display:'flex',alignItems:'center',gap:8,fontSize:12,marginTop:10,cursor:'pointer'}}>
          <input type="checkbox" checked={s.secure} onChange={e=>setS(x=>({...x,secure:e.target.checked}))}/>SSL/TLS (port 465)
        </label>
      </>}
    </Modal>
  );
}

function TelegramModal({ onClose, onSaved, onValidated, onReset }) {
  const { t } = useI18n();
  const [awaitCode, setAwaitCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [validated, setValidated] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [tg, setTg] = useState({ bot_token:'', chat_id:'' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg]         = useState('');
  const [err, setErr]         = useState('');
  useEffect(() => {
    api.telegramConfig().then(c=>setTg({bot_token:c.bot_token||'',chat_id:c.chat_id||''})).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  const save = async () => { setSaving(true); setMsg(''); setErr('');
    try { await api.telegramSave(tg); onSaved('telegram'); setMsg(t('notif.saved_msg')); } catch(e){setErr(e.message);} finally{setSaving(false);} };
  const test = async () => { setTesting(true); setMsg(''); setErr('');
    try { const r=await api.telegramTest(); setMsg(t('notif.code_sent') || 'Code envoyé — entrez-le pour valider.'); setAwaitCode(true); } catch(e){setErr('Erreur: '+e.message); setAwaitCode(false);} finally{setTesting(false);} };
  const validate = async () => { setErr(''); try { await api.telegramValidate(codeInput); setValidated(true); setAwaitCode(false); setMsg(t('notif.validated_tg')); onValidated?.(); } catch(e){setErr(e.message);} };
  const reset = async () => { setConfirmReset(false); try { await api.telegramSave({ bot_token:'', chat_id:'' }); setTg({ bot_token:'', chat_id:'' }); setValidated(false); setAwaitCode(false); setMsg(''); onReset?.(); } catch(e){setErr(e.message);} };
  return (
    <Modal title={t('notif.telegram_config') || 'Configuration Telegram'} onClose={onClose}
      footer={
        <div style={{display:'flex',justifyContent:'space-between',width:'100%',alignItems:'center'}}>
          <button className="btn" onClick={() => setConfirmReset(true)}
            style={{color:'var(--err)',borderColor:'var(--err)',fontSize:12}}>⊘ Reset</button>
          <div style={{display:'flex',gap:8}}>
            {awaitCode
              ? <button className="btn btn-primary" onClick={validate} disabled={codeInput.length<4}>{t('notif.validate_code') || 'Valider le code'}</button>
              : <button className="btn" onClick={test} disabled={testing||!tg.bot_token||!tg.chat_id} style={validated?{borderColor:'var(--ok)',color:'var(--ok)'}:{}}>{testing?'Envoi…':'Tester'}{validated?' ✓':''}</button>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'…':t('auto_cat.save')||'Enregistrer'}</button>
          </div>
        </div>
      }>
      {loading?<div style={{textAlign:'center',padding:20}}><Spinner/></div>:<>
        {msg&&<div className="alert alert-ok" style={{marginBottom:12,fontSize:12}}>{msg}</div>}
        {err&&<div className="alert alert-err" style={{marginBottom:12,fontSize:12}}>{err}</div>}
        {confirmReset && (
        <div style={{background:'rgba(0,0,0,.5)',position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'var(--rl)',zIndex:10}}>
          <div style={{background:'var(--surf)',padding:24,borderRadius:'var(--r)',maxWidth:320,boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}>
            <div style={{fontWeight:700,marginBottom:8}}>{t('notif.reset_telegram_title') || 'Réinitialiser la configuration Telegram ?'}</div>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:16}}>{t('notif.reset_desc') || 'La configuration sera effacée et la validation annulée.'}</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={()=>setConfirmReset(false)}>Annuler</button>
              <button className="btn" style={{color:'var(--err)',borderColor:'var(--err)'}} onClick={reset}>Réinitialiser</button>
            </div>
          </div>
        </div>
      )}
            {awaitCode && (
          <div style={{marginBottom:12,display:'flex',gap:8,alignItems:'center'}}>
            <input className="form-control" placeholder={t('notif.code_placeholder')} value={codeInput}
              onChange={e=>setCodeInput(e.target.value.replace(/\D/g,'').slice(0,6))}
              style={{letterSpacing:6,fontFamily:'var(--mono)',fontSize:18,textAlign:'center',maxWidth:160}}
              autoFocus />
            <span style={{fontSize:12,color:'var(--muted)'}}>{t('notif.code_hint')}</span>
          </div>
        )}
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>{t('security.slack_bot_hint') || 'Create a bot via'} <code>@BotFather</code> sur Telegram pour obtenir votre Bot Token. L'ID du chat peut être récupéré via <code>@userinfobot</code>.</p>
        <div style={{display:'flex',flexDirection:'column',gap:12}}>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">Bot Token</label>
            <div style={{position:'relative',display:'flex',alignItems:'center'}}>
              <input className="form-control" type={showToken ? 'text' : 'password'} value={tg.bot_token}
                onChange={e=>setTg(x=>({...x, bot_token:e.target.value}))}
                placeholder="123456789:ABCdef..." style={{paddingRight:36}} />
              <button type="button" onClick={()=>setShowToken(v=>!v)}
                style={{position:'absolute',right:8,background:'none',border:'none',cursor:'pointer',color:'var(--muted)',padding:0,lineHeight:1}}
                title={showToken ? 'Masquer' : 'Afficher'}>
                {showToken
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">Chat ID / Canal ID</label>
            <input className="form-control" value={tg.chat_id} onChange={e=>setTg(x=>({...x,chat_id:e.target.value}))} placeholder="-1001234567890"/>
            <div style={{fontSize:11,color:'var(--muted)',marginTop:4}}>
              💡 Votre Chat ID personnel (pas l'ID du bot). Obtenez-le via <code>@userinfobot</code> sur Telegram. Pour un canal : ajoutez le bot en admin et utilisez l'ID du canal (ex: <code>-100xxxxxxxxxx</code>).
            </div>
          </div>
        </div>
      </>}
    </Modal>
  );
}

function SlackModal({ onClose, onSaved, onValidated, onReset }) {
  const { t } = useI18n();
  const [awaitCode, setAwaitCode] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [validated, setValidated] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
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
    try { await api.slackTest(); setMsg(t('notif.code_sent') || 'Code envoyé — entrez-le pour valider.'); setAwaitCode(true); } catch(e){setErr('Erreur: '+e.message);} finally{setTesting(false);} };
  const validate = async () => { setErr(''); try { await api.slackValidate(codeInput); setValidated(true); setAwaitCode(false); setMsg(t('notif.validated_slack')); onValidated?.(); } catch(e){setErr(e.message);} };
  const reset = async () => { setConfirmReset(false); try { await api.slackSave({ webhook_url:'' }); setUrl(''); setValidated(false); setAwaitCode(false); setMsg(''); onReset?.(); } catch(e){setErr(e.message);} };
  return (
    <Modal title={t('notif.slack_config') || 'Configuration Slack'} onClose={onClose}
      footer={
        <div style={{display:'flex',justifyContent:'space-between',width:'100%',alignItems:'center'}}>
          <button className="btn" onClick={() => setConfirmReset(true)}
            style={{color:'var(--err)',borderColor:'var(--err)',fontSize:12}}>⊘ Reset</button>
          <div style={{display:'flex',gap:8}}>
            {awaitCode
              ? <button className="btn btn-primary" onClick={validate} disabled={codeInput.length<4}>{t('notif.validate_code') || 'Valider le code'}</button>
              : <button className="btn" onClick={test} disabled={testing||!url||url.startsWith('••••')} style={validated?{borderColor:'var(--ok)',color:'var(--ok)'}:{}}>{testing?'Envoi…':'Tester'}{validated?' ✓':''}</button>}
            <button className="btn btn-primary" onClick={save} disabled={saving}>{saving?'…':t('auto_cat.save')||'Enregistrer'}</button>
          </div>
        </div>
      }>
      {loading?<div style={{textAlign:'center',padding:20}}><Spinner/></div>:<>
        {msg&&<div className="alert alert-ok" style={{marginBottom:12,fontSize:12}}>{msg}</div>}
        {err&&<div className="alert alert-err" style={{marginBottom:12,fontSize:12}}>{err}</div>}
        {confirmReset && (
        <div style={{background:'rgba(0,0,0,.5)',position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',borderRadius:'var(--rl)',zIndex:10}}>
          <div style={{background:'var(--surf)',padding:24,borderRadius:'var(--r)',maxWidth:320,boxShadow:'0 4px 20px rgba(0,0,0,.4)'}}>
            <div style={{fontWeight:700,marginBottom:8}}>{t('notif.reset_slack_title') || 'Réinitialiser la configuration Slack ?'}</div>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:16}}>{t('notif.reset_desc') || 'La configuration sera effacée et la validation annulée.'}</p>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button className="btn" onClick={()=>setConfirmReset(false)}>Annuler</button>
              <button className="btn" style={{color:'var(--err)',borderColor:'var(--err)'}} onClick={reset}>Réinitialiser</button>
            </div>
          </div>
        </div>
      )}
            {awaitCode && (
          <div style={{marginBottom:12,display:'flex',gap:8,alignItems:'center'}}>
            <input className="form-control" placeholder={t('notif.code_placeholder')} value={codeInput}
              onChange={e=>setCodeInput(e.target.value.replace(/\D/g,'').slice(0,6))}
              style={{letterSpacing:6,fontFamily:'var(--mono)',fontSize:18,textAlign:'center',maxWidth:160}}
              autoFocus />
            <span style={{fontSize:12,color:'var(--muted)'}}>{t('notif.code_hint')}</span>
          </div>
        )}
        <p style={{fontSize:12,color:'var(--muted)',marginBottom:14}}>{t('security.slack_webhook_hint') || 'Create an Incoming Webhook in your Slack workspace:'} <br/>{t('security.slack_steps') || 'Settings → Apps → Incoming Webhooks → Add.'}</p>
        <div className="form-group" style={{margin:0}}><label className="form-label">Webhook URL</label><input className="form-control" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://hooks.slack.com/services/T.../B.../..."/></div>
      </>}
    </Modal>
  );
}

function SecurityNotifTab() {
  const { t } = useI18n();
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
    // Enregistrement seul → pas de validation, pas de fermeture
    // La validation se fait après le test (code reçu + entré)
    api.notifCatalog().then(d => setCatalog(d)).catch(() => {});
  }

  function onChannelValidated(channel) {
    // Code validé → on marque le canal comme disponible
    setValidated(v => ({ ...v, [channel]: true }));
    api.notifCatalog().then(d => setCatalog(d)).catch(() => {});
  }

  async function onChannelReset(channel) {
    // Reset canal : retirer le canal de toutes les lignes cochées,
    // désactiver les lignes qui n'ont plus aucun canal, griser le canal.
    setValidated(v => ({ ...v, [channel]: false }));
    // Mettre à jour chaque config qui contient ce canal
    const toUpdate = configs.filter(cfg => cfg.channels.includes(channel));
    await Promise.all(toUpdate.map(cfg => {
      const newChannels = cfg.channels.filter(c => c !== channel);
      const newEnabled  = newChannels.length > 0 ? cfg.enabled : false;
      return saveCfg(cfg.event_key, { channels: newChannels, enabled: newEnabled });
    }));
    api.notifCatalog().then(d => setCatalog(d)).catch(() => {});
  }

  async function toggleChannel(cfg, channel) {
    const channels = cfg.channels.includes(channel)
      ? cfg.channels.filter(c => c !== channel)
      : [...cfg.channels, channel];
    // Auto-enable si au moins un canal, auto-disable si aucun canal
    const enabled = channels.length > 0 ? true : cfg.enabled;
    await saveCfg(cfg.event_key, { channels, enabled });
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
    email:    { label: 'SMTP',     color: '#ca8a04', bgColor: 'rgba(202,138,4,0.12)' },
    telegram: { label: 'Telegram', color: '#2BA5E0', bgColor: 'rgba(43,165,224,0.12)' },
    slack:    { label: 'Slack',    color: '#E01E5A', bgColor: 'rgba(224,30,90,0.12)' },
  };

  const channelList = Object.keys(CHAN_CONFIG).filter(k => catalog.channels?.[k]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Info + boutons configuration canaux */}
      <div className="card">
        <div style={{ padding: '14px 18px' }}>
          {/* Boutons canaux — centrés */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            {/* SMTP */}
            <button className="btn" onClick={() => setModal('smtp')}
              style={{ display:'flex', alignItems:'center', gap:8, borderColor:'#ca8a04', color:'#ca8a04' }}>
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
            {t('security.notif_rules') || 'Notification rules'}
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--brd)' }}>
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, width: '100%' }}>{t('security.event') || 'Event'}</th>
              {channelList.map(ch => (
                <th key={ch} style={{ padding: '8px 8px', textAlign: 'center', width: 56, fontSize: 10, color: CHAN_CONFIG[ch].color, fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {CHAN_CONFIG[ch].label}
                </th>
              ))}
              <th style={{ padding: '8px 16px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 600, minWidth: 240 }}>Options</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              const GROUPS = [
                { label: 'Sécurité',        icon: '🔐', keys: ['login_failed_threshold','account_locked','db_backup_created','db_backup_deleted','db_backup_downloaded','db_backup_restored','db_backup_sqlite_alert'] },
                { label: 'Équipements',     icon: '🖧',  keys: ['backup_download','backup_deleted','backup_schedule_result'] },
                { label: 'Documents',       icon: '📄', keys: ['expiration_document','document_deleted','file_deleted','retention_recap'] },
                { label: "Suivi d'activité", icon: '📝', keys: ['preview_overdue','preview_recap','activity_deleted','activity_file_deleted'] },
              ];
              const grouped = {}; GROUPS.forEach(g => { grouped[g.label] = []; }); grouped['__other__'] = [];
              configs.forEach(cfg => { const g = GROUPS.find(g => g.keys.includes(cfg.event_key)); if (g) grouped[g.label].push(cfg); else grouped['__other__'].push(cfg); });

              const ICONS = {
                'Sécurité':         <svg viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" style={{width:12,height:12,verticalAlign:'middle',marginRight:4}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
                'Équipements':      <svg viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" style={{width:12,height:12,verticalAlign:'middle',marginRight:4}}><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>,
                'Documents':        <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" style={{width:12,height:12,verticalAlign:'middle',marginRight:4}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
                "Suivi d'activité": <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" style={{width:12,height:12,verticalAlign:'middle',marginRight:4}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
              };
              const LABEL_COLORS = { 'Sécurité':'#6366f1', 'Équipements':'#0891b2', 'Documents':'#16a34a', "Suivi d'activité":'#d97706' };
              const sep = (label, icon) => (
                <tr key={`sep-${label}`}>
                  <td colSpan={channelList.length + 2} style={{ padding: '5px 16px', background:'var(--surf2)', borderTop:'1px solid var(--brd)', borderBottom:'1px solid var(--brd)' }}>
                    <span style={{ fontSize:10, fontWeight:700, color: LABEL_COLORS[label] || 'var(--muted)', textTransform:'uppercase', letterSpacing:'0.08em', display:'inline-flex', alignItems:'center' }}>
                      {ICONS[label] || <span style={{marginRight:4}}>{icon}</span>}{label}
                    </span>
                  </td>
                </tr>
              );

              const row = (cfg, idx) => (
                <tr key={cfg.event_key} style={{ borderBottom:'1px solid var(--brd)', background: idx%2===0?'transparent':'var(--surf2)' }}>
                  <td style={{ padding:'10px 16px' }}>
                    <div style={{ fontSize:13, fontWeight:500, color:'var(--txt)' }}>{cfg.label}</div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{cfg.description}</div>
                  </td>
                  {channelList.map(ch => {
                    const active = cfg.channels.includes(ch); const available = validated[ch];
                    return (
                      <td key={ch} style={{ padding:'10px 8px', textAlign:'center', width:56 }}>
                        <label style={{ display:'inline-flex', alignItems:'center', cursor:available?'pointer':'not-allowed' }}
                          title={!available?`Configurer ${CHAN_CONFIG[ch].label} d'abord`:''}>
                          <input type="checkbox" checked={active} disabled={!available} onChange={() => available && toggleChannel(cfg, ch)}
                            style={{ width:15, height:15, cursor:available?'pointer':'not-allowed', accentColor:CHAN_CONFIG[ch].color }} />
                        </label>
                      </td>
                    );
                  })}
                  <td style={{ padding:'10px 16px' }}>
                    {(cfg.event_key==='preview_recap'||cfg.event_key==='preview_overdue'||cfg.event_key==='retention_recap') && (
                      <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                        <select className="form-control" style={{ padding:'2px 6px', fontSize:11, height:26 }} value={cfg.options?.frequency||'weekly'}
                          onChange={e => saveCfg(cfg.event_key, { options:{...cfg.options, frequency:e.target.value} })}>
                          {FREQ_OPT.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                        </select>
                        {cfg.options?.frequency==='weekly' && (
                          <select className="form-control" style={{ padding:'2px 6px', fontSize:11, height:26 }} value={cfg.options?.day_of_week??1}
                            onChange={e => saveCfg(cfg.event_key, { options:{...cfg.options, day_of_week:parseInt(e.target.value)} })}>
                            {DAYS_FR.map((d,i) => <option key={i} value={i}>{d}</option>)}
                          </select>
                        )}
                        {cfg.options?.frequency==='monthly' && (
                          <select className="form-control" style={{ padding:'2px 6px', fontSize:11, height:26 }} value={cfg.options?.day_of_month??1}
                            onChange={e => saveCfg(cfg.event_key, { options:{...cfg.options, day_of_month:parseInt(e.target.value)} })}>
                            {Array.from({length:28},(_,i) => <option key={i+1} value={i+1}>Jour {i+1}</option>)}
                          </select>
                        )}
                      </div>
                    )}
                    {cfg.event_key==='expiration_document' && (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <select className="form-control" style={{ padding:'2px 6px', fontSize:11, height:26 }} value={cfg.options?.days_before??30}
                          onChange={e => saveCfg(cfg.event_key, { options:{...cfg.options, days_before:parseInt(e.target.value)} })}>
                          {[1,2,3,5,7,10,14,21,30,60,90].map(d => <option key={d} value={d}>{d} j avant</option>)}
                        </select>
                      </div>
                    )}
                  </td>
                </tr>
              );

              const result = []; let idx = 0;
              GROUPS.forEach(g => {
                const items = grouped[g.label]; if (!items.length) return;
                result.push(sep(g.label, g.icon));
                items.forEach(cfg => result.push(row(cfg, idx++)));
              });
              return result;
            })()}
          </tbody>
        </table>
      </div>

      {/* Modals de configuration */}
      {modal === 'recipients' && <RecipientsModal onClose={() => setModal(null)} />}
      {modal === 'smtp'     && <SmtpModal     onClose={() => setModal(null)} onSaved={onChannelSaved} onValidated={() => onChannelValidated('email')}    onReset={() => onChannelReset('email')} onOpenRecipients={() => setModal('recipients')} />}
      {modal === 'telegram' && <TelegramModal onClose={() => setModal(null)} onSaved={onChannelSaved} onValidated={() => onChannelValidated('telegram')} onReset={() => onChannelReset('telegram')} />}
      {modal === 'slack'    && <SlackModal    onClose={() => setModal(null)} onSaved={onChannelSaved} onValidated={() => onChannelValidated('slack')}    onReset={() => onChannelReset('slack')} />}
    </div>
  );
}


// ── ONGLET AUTHENTIFICATION OIDC ─────────────────────────────────────────────

// ── CARTE LDAP ────────────────────────────────────────────────────────────────
function LdapCard() {
  const { t } = useI18n();
  const [ldap, setLdap] = useState({
    enabled: false, url: '', base_dn: '', bind_dn: '', bind_password: '',
    user_attr: 'sAMAccountName', group_filter: '', required_group: '', tls: false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');
  const [err, setErr]       = useState('');

  useEffect(() => {
    api.ldapConfig().then(d => { if (d) setLdap(prev => ({ ...prev, ...d })); }).catch(() => {});
  }, []);

  async function save(e) {
    e.preventDefault(); setSaving(true); setMsg(''); setErr('');
    try { await api.ldapSave(ldap); setMsg('Configuration LDAP enregistrée.'); }
    catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  }

  const f = (key, label, type = 'text', ph = '') => (
    <div className="form-group" style={{ margin: 0 }}>
      <label className="form-label">{label}</label>
      <input className="form-control" type={type} value={ldap[key] || ''}
        onChange={e => setLdap(l => ({ ...l, [key]: e.target.value }))} placeholder={ph} />
    </div>
  );

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          LDAP / LDAPS
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}
          onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={ldap.enabled}
            onChange={e => setLdap(l => ({ ...l, enabled: e.target.checked }))} />
          <span style={{ fontWeight: 600, color: ldap.enabled ? 'var(--ok)' : 'var(--muted)' }}>
            {ldap.enabled ? (t('common.enabled') || 'Enabled') : (t('common.disabled') || 'Disabled')}
          </span>
        </label>
      </div>
      <div style={{ padding: 20 }}>
        {msg && <div className="alert alert-ok" style={{ marginBottom: 14 }}>{msg}</div>}
        {err && <div className="alert alert-err" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="alert alert-warn" style={{ marginBottom: 16, fontSize: 12, justifyContent: 'center', textAlign: 'center' }}>
          LDAP est complémentaire à l’authentification locale. Les comptes locaux restent accessibles même si LDAP est activé.
        </div>
        <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {f('url',  'URL LDAP/LDAPS', 'text', 'ldap://192.168.1.10 ou ldaps://…')}
              {f('base_dn', 'Base DN', 'text', 'dc=company,dc=fr')}
              {f('bind_dn', 'Bind DN (compte de liaison)', 'text', 'cn=svc-nexus,dc=company,dc=fr')}
              {f('bind_password', 'Mot de passe', 'password', '••••••••')}
              {f('user_attr', 'Attribut identifiant', 'text', 'sAMAccountName')}
              {f('group_filter', 'Filtre groupe (optionnel)', 'text', '(memberOf=cn=IT,dc=company,dc=fr)')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              {f('required_group', 'Groupe requis (optionnel)', 'text', 'cn=nexus-users,dc=…')}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={ldap.tls}
                  onChange={e => setLdap(l => ({ ...l, tls: e.target.checked }))} />
                Utiliser STARTTLS
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Enregistrement…' : (t('auto_cat.save') || 'Enregistrer')}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}

function SecurityOidcTab() {
  const { t } = useI18n();
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
    allow_local_login: true,
    authorization_endpoint: '',
    token_endpoint: '',
    userinfo_endpoint: '',
    jwks_uri: '',
    tls_insecure: false,
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg]       = useState('');
  const [err, setErr]       = useState('');

  // ── TOTP ─────────────────────────────────────────────────────────────────────
  const [totpRequired, setTotpRequired] = useState(false);
  const [totpSaving, setTotpSaving]     = useState(false);
  const [totpMsg, setTotpMsg]           = useState('');

  useEffect(() => {
    api.getFeatureFlags().then(f => setTotpRequired(!!f.totp_required)).catch(() => {});
  }, []);

  async function toggleTotp() {
    const newVal = !totpRequired;
    setTotpSaving(true); setTotpMsg('');
    try {
      await api.setFeatureFlags({ totp_required: newVal });
      setTotpRequired(newVal);
      setTotpMsg(newVal ? 'TOTP obligatoire activé.' : 'TOTP désactivé.');
      setTimeout(() => setTotpMsg(''), 3000);
    } catch (e) { setTotpMsg('Erreur : ' + e.message); }
    finally { setTotpSaving(false); }
  }

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

      {/* ── TOTP ── */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
              <rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><line x1="12" y1="15" x2="12" y2="17"/>
            </svg>
            {t('security.totp_title') || '2FA (TOTP)'}
          </div>
        </div>
        <div style={{padding:'14px 18px', display:'flex', flexDirection:'column', gap:10}}>
          <label style={{display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer', padding:'12px 14px', borderRadius:'var(--r)',
            background: totpRequired ? 'var(--acc-s)' : 'var(--surf2)',
            border: `1px solid ${totpRequired ? 'var(--acc)' : 'var(--brd)'}`, transition:'all .15s'}}>
            <input type="checkbox" checked={totpRequired} onChange={toggleTotp} disabled={totpSaving}
              style={{marginTop:2, accentColor:'var(--acc)', width:16, height:16}} />
            <div>
              <div style={{fontWeight:600, fontSize:13}}>{t('security.totp_mandatory') || 'Require TOTP for all users'}</div>
              <div style={{fontSize:12, color:'var(--muted)', marginTop:2}}>
                {t('security.totp_required_desc') || 'When this option is enabled, all users must configure an authenticator app.'}lication d'authentification (Google Authenticator, Authy…) lors de leur prochaine connexion.
              </div>
            </div>
          </label>
          {totpMsg && <div className={`alert ${totpRequired || totpMsg.startsWith('Erreur') ? (totpMsg.startsWith('Erreur') ? 'alert-err' : 'alert-ok') : 'alert-warn'}`} style={{fontSize:12}}>{totpMsg}</div>}
          {totpRequired && (
            <div className="alert alert-warn" style={{fontSize:12}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13,flexShrink:0}}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {t('security.totp_mandatory_desc') || "Users without TOTP configured will be prompted to scan a QR code at login."} leur prochaine connexion. Pour réinitialiser le TOTP d'un utilisateur, rendez-vous dans <strong>Utilisateurs</strong> → modifier le compte → <em>{t('security.totp_reset') || 'Reset 2FA'}</em>.
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
              <circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/>
            </svg>
            {t('security.oidc_title') || 'OIDC / OAuth2'}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
            <input type="checkbox" checked={cfg.enabled}
              onChange={e => setCfg(c => ({ ...c, enabled: e.target.checked }))} />
            <span style={{ fontWeight: 600, color: cfg.enabled ? 'var(--ok)' : 'var(--muted)' }}>
              {cfg.enabled ? (t('common.enabled') || 'Enabled') : (t('common.disabled') || 'Disabled')}
            </span>
          </label>
        </div>
        <div style={{ padding: 20 }}>
          {msg && <div className="alert alert-ok" style={{ marginBottom: 14 }}>{msg}</div>}
          {err && <div className="alert alert-err" style={{ marginBottom: 14 }}>{err}</div>}

          {/* Info */}
          <div className="alert alert-warn" style={{ marginBottom: 16, fontSize: 12, justifyContent: 'center', textAlign: 'center' }}>
            {t('security.oidc_desc') || 'OIDC authentication complements local authentication. Local accounts remain active.'}tes locaux restent accessibles même si OIDC est activé.
          </div>

          <form onSubmit={save}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {field('provider_name', t('security.oidc_provider') || 'Nom du fournisseur', 'text', 'Keycloak, Authentik, Azure…')}
              {field('issuer_url', 'Issuer URL', 'text', 'https://auth.example.com/realm/nexus')}
              {field('client_id', 'Client ID', 'text', 'nexusvault')}
              {field('client_secret', 'Client Secret', 'password', '••••••••')}
              {field('redirect_uri', t('security.oidc_redirect_uri') || 'Redirect URI', 'text', 'https://nexusvault.example.com/oidc-callback')}
              {field('scopes', 'Scopes', 'text', 'openid email profile')}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                {t('security.oidc_endpoints') || 'Custom endpoints (optional — overrides issuer discovery)'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                {field('authorization_endpoint', 'Authorization endpoint', 'text', 'Auto')}
                {field('token_endpoint', 'Token endpoint', 'text', 'Auto')}
                {field('userinfo_endpoint', 'UserInfo endpoint', 'text', 'Auto')}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: 'var(--muted)' }}>
                {t('security.oidc_endpoints_hint') || 'Leave empty to auto-detect from Issuer URL'}
              </div>
            </div>

            {/* Sécurité avancée */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                Sécurité avancée
              </div>
              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  JWKS URI
                  <span style={{ fontWeight: 400, color: 'var(--ok)', fontSize: 11 }}>— recommandé</span>
                </label>
                <input className="form-control" type="text"
                  placeholder="https://idp.example.com/.well-known/jwks.json"
                  value={cfg.jwks_uri || ''}
                  onChange={e => setCfg(c => ({ ...c, jwks_uri: e.target.value }))} />
                <div style={{ marginTop: 5, fontSize: 11, color: 'var(--muted)', lineHeight: 1.5 }}>
                  Permet la vérification cryptographique de la signature des tokens OIDC. Trouvez cette URL dans la documentation de votre IdP ou dans son document de découverte
                  {' '}<span style={{ fontFamily: 'var(--mono)', fontSize: 10 }}>/.well-known/openid-configuration</span>.
                  Sans ce champ, seules l'expiration et l'audience sont vérifiées.
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={!!cfg.tls_insecure}
                  onChange={e => setCfg(c => ({ ...c, tls_insecure: e.target.checked }))} />
                <span>Désactiver la vérification TLS du fournisseur d'identité</span>
                <span style={{ fontSize: 11, color: 'var(--warn)' }}>⚠ IdP interne auto-signé uniquement</span>
              </label>
            </div>

            {/* 3 options sur la même ligne en 3 colonnes égales */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--r)', background: cfg.auto_create_users ? 'var(--acc-s)' : 'var(--surf2)', border: `1px solid ${cfg.auto_create_users ? 'var(--acc)' : 'var(--brd)'}` }}>
                <input type="checkbox" checked={cfg.auto_create_users} style={{ marginTop: 2, accentColor: 'var(--acc)' }}
                  onChange={e => setCfg(c => ({ ...c, auto_create_users: e.target.checked }))} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t('security.oidc_auto_create') || 'Auto-create OIDC users'}</div>
                </div>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, cursor: 'pointer', padding: '8px 10px', borderRadius: 'var(--r)', background: cfg.allow_local_login !== false ? 'var(--acc-s)' : 'var(--surf2)', border: `1px solid ${cfg.allow_local_login !== false ? 'var(--acc)' : 'var(--brd)'}` }}>
                <input type="checkbox" checked={cfg.allow_local_login !== false} style={{ marginTop: 2, accentColor: 'var(--acc)' }}
                  onChange={e => setCfg(c => ({ ...c, allow_local_login: e.target.checked }))} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{t('security.oidc_allow_local') || 'Keep local login'}</div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{t('security.oidc_allow_local_desc') || 'Users can still log in with local credentials'}</div>
                </div>
              </label>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('security.default_role') || 'Default role'} ({t('security.oidc_new_users') || 'nouveaux utilisateurs'})</label>
                <select className="form-control" value={cfg.default_role}
                  onChange={e => setCfg(c => ({ ...c, default_role: e.target.value }))}>
                  <option value="viewer">{t('users.role_viewer') || 'Lecteur'}</option>
                  <option value="operator">{t('users.role_operator')}</option>
                  <option value="admin">{t('users.role_admin')}</option>
                </select>
              </div>
            </div>

            {cfg.enabled && cfg.allow_local_login === false && (
              <div className="alert alert-warn" style={{ marginBottom: 14, fontSize: 12 }}>
                {t('security.oidc_no_local_warn') || 'Local login disabled: login page will redirect to SSO automatically.'}
              </div>
            )}
                        {/* Aperçu du bouton OIDC — centré, dans la card */}
            {cfg.enabled && cfg.provider_name && (
              <div style={{ borderTop:'1px solid var(--brd)', padding:'14px 0 4px', textAlign:'center', marginBottom:10 }}>
                <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10 }}>
                  {t('perso.login_btn_preview')||'Aperçu'} — {t('security.oidc_btn_desc')||'Ce bouton apparaîtra sur la page de connexion.'}
                </div>
                <div style={{ display:'flex', justifyContent:'center' }}>
                  <button type="button" className="btn" style={{ display:'flex', alignItems:'center', gap:8, border:'1px solid var(--brd)', background:'var(--surf2)', pointerEvents:'none' }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:16, height:16 }}><circle cx="12" cy="12" r="10"/><path d="M8 12l2 2 4-4"/></svg>
                    {t('security.oidc_sso_prefix')||'Se connecter avec'} {cfg.provider_name}
                  </button>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? (t('common.saving') || 'Saving…') : (t('auto_cat.save') || 'Save')}
              </button>
            </div>
          </form>
        </div>
      </div>


      <LdapCard />
    </div>
  );
}

// ── ONGLET PLANIFICATEUR ──────────────────────────────────────────────────────
function SecurityCronTab() {
  const { t } = useI18n();
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
      const r = await api.cronConfig({ hour: parseInt(cronHour), minute: parseInt(cronMinute), day: 1 });
      setCronMsg('Configuration enregistrée.');
      setCronStatus(prev => ({ ...prev, hour: parseInt(cronHour), minute: parseInt(cronMinute), day: 1, next_run: r.next_run }));
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
                  <label className="form-label">Heure</label>
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
                    <span style={{ fontFamily: 'var(--mono)' }}>{cronStatus.last_run || t('users.never')}</span>
                  </div>
                  {cronStatus.last_result && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ color: 'var(--muted)', minWidth: 100 }}>{t('audit.result')}</span>
                      <span style={{ color: 'var(--ok)', fontWeight: 600 }}>{cronStatus.last_result}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: 'var(--muted)', fontSize: 12 }}>Chargement…</div>
              )}
            </div>
          </div>


        </div>
      </div>

      {/* ── Planification sauvegardes SQLite ── */}
      <DbBackupSQLiteCard />

      {/* ── Planification sauvegardes automatiques ── */}
      <BackupScheduleCard />

    </div>
  );
}

// ── CARD PLANIFICATION SAUVEGARDES SQLite ─────────────────────────────────────
function DbBackupSQLiteCard() {
  const { t } = useI18n();
  const { can } = usePerms();
  const passwordMin = usePasswordMin();
  // TOUS les hooks avant le return conditionnel
  const [totalSize, setTotalSize] = useState(0);
  const [cfg, setCfg]             = useState({ frequency:'daily', hour:'2', minute:'0', retention_count:'7' });
  const [hasPassword, setHasPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [msg, setMsg]             = useState('');
  if (!can('site_backup_access')) return null;

  useEffect(() => {
    api.dbBackupConfig().then(d => {
      setCfg({ frequency: d.frequency||'daily', hour: d.hour||'2', minute: d.minute||'0', retention_count: d.retention_count||'7' });
      setHasPassword(!!d.has_password);
    }).catch(() => {});
    api.dbBackups().then(res => {
      const ts = Array.isArray(res) ? res.reduce((s,f) => s+f.size, 0) : (res.total_size || 0);
      setTotalSize(ts);
    }).catch(() => {});
  }, []);

  async function save() {
    if (newPassword && newPassword.length < passwordMin) { setMsg(`Erreur : le mot de passe doit faire au moins ${passwordMin} caractères.`); return; }
    setSaving(true); setMsg('');
    try {
      const payload = { ...cfg };
      if (newPassword) { payload.backup_password = newPassword; }
      await api.dbBackupSaveConfig(payload);
      if (newPassword) { setHasPassword(true); setNewPassword(''); }
      setMsg('Planification enregistrée.');
    } catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  async function removePassword() {
    if (!window.confirm('Supprimer le mot de passe de chiffrement ?\nLes prochaines sauvegardes ne seront plus chiffrées.')) return;
    setSaving(true); setMsg('');
    try {
      await api.dbBackupSaveConfig({ ...cfg, backup_password: '' });
      setHasPassword(false); setNewPassword('');
      setMsg('Mot de passe supprimé. Les prochaines sauvegardes ne seront plus chiffrées.');
    } catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:16, height:16 }}>
            <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
          </svg>
          {t('cron.db_backup_sqlite_title') || 'Planification des sauvegardes automatiques SQLite'}
        </div>
      </div>
      <div style={{ padding:20 }}>
        {msg && <div className={`alert alert-${msg.startsWith('Err') ? 'err' : 'ok'}`} style={{ marginBottom:14, fontSize:12 }}>{msg}</div>}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
          {/* Colonne gauche : fréquence + horaire + rétention */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label">Fréquence</label>
              <select className="form-control" value={cfg.frequency} onChange={e => setCfg(c => ({...c, frequency: e.target.value}))}>
                <option value="daily">Quotidien</option>
                <option value="weekly">Hebdomadaire</option>
                <option value="monthly">Mensuel</option>
              </select>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Heure</label>
                <select className="form-control" value={cfg.hour} onChange={e => setCfg(c => ({...c, hour: e.target.value}))}>
                  {Array.from({length:24},(_,i)=>i).map(h => <option key={h} value={h}>{String(h).padStart(2,'0')}h</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label className="form-label">Minutes</label>
                <select className="form-control" value={cfg.minute} onChange={e => setCfg(c => ({...c, minute: e.target.value}))}>
                  {[0,5,10,15,20,25,30,35,40,45,50,55].map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label">Nombre de sauvegardes à conserver</label>
              <select className="form-control" value={cfg.retention_count} onChange={e => setCfg(c => ({...c, retention_count: e.target.value}))}>
                {[1,2,3,5,7,10,14,21,30].map(n => <option key={n} value={n}>{n} sauvegarde{n>1?'s':''}</option>)}
              </select>
            </div>
          </div>
          {/* Colonne droite : mot de passe */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group" style={{ margin:0 }}>
              <label className="form-label" style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                  Mot de passe de chiffrement
                  {hasPassword && (
                    <span style={{ fontSize:11, color:'var(--ok)', fontWeight:600 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:11, height:11, verticalAlign:'middle', marginRight:3 }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                      Actif
                    </span>
                  )}
                </span>
                {hasPassword && (
                  <button type="button" className="btn btn-sm" onClick={removePassword}
                    style={{ fontSize:11, color:'var(--err)', borderColor:'var(--err)', padding:'1px 8px' }}>
                    Supprimer
                  </button>
                )}
              </label>
              <div style={{ position:'relative', display:'flex', alignItems:'center' }}>
                <input className="form-control" type={showPwd ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={hasPassword ? '••••••••••••••  (laisser vide pour conserver)' : `Laisser vide = pas de chiffrement (min. ${passwordMin} car.)`}
                  style={{ paddingRight:36 }} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  style={{ position:'absolute', right:8, background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:0 }}>
                  {showPwd
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
              {newPassword.length > 0 && newPassword.length < passwordMin && (
                <div style={{ fontSize:11, color:'var(--err)', marginTop:4 }}>{passwordMin} {t('security.pwd_min_chars')||'caractères'} ({newPassword.length}/{passwordMin})</div>
              )}
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:4, lineHeight:1.5 }}>
                {hasPassword
                  ? 'Un mot de passe est actif. Laissez vide pour le conserver, saisissez-en un nouveau pour le remplacer.'
                  : 'Si renseigné, les fichiers de backup seront chiffrés en AES-256-GCM.'}
              </div>
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', background:'var(--surf2)', padding:'8px 12px', borderRadius:'var(--r)', lineHeight:1.5 }}>
              {t('cron.vacuum_into_hint') || 'Le backup utilise'} <code>VACUUM INTO</code> — {t('cron.vacuum_into_desc') || 'cohérent sans interruption de service. Conservez votre mot de passe en lieu sûr.'}
              {totalSize > 0 && (
                <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:6 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:12, height:12, color:'var(--acc)' }}>
                    <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
                  </svg>
                  <span style={{ fontWeight:600, color:'var(--acc)' }}>
                    {totalSize >= 1048576 ? (totalSize/1048576).toFixed(1)+' Mo' : totalSize >= 1024 ? (totalSize/1024).toFixed(0)+' Ko' : totalSize+' o'}
                  </span>
                  <span style={{ color:'var(--muted)' }}>{t('cron.total_backup_size') || 'utilisés par les sauvegardes'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CARD PLANIFICATION SAUVEGARDES ───────────────────────────────────────────
const DAYS_FR = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
const FREQ_LABELS = { daily: 'Quotidien', weekly: 'Hebdomadaire', monthly: 'Mensuel' };

function BackupScheduleCard() {
  const { t } = useI18n();
  const [schedules, setSchedules] = useState([]);
  const [states,    setStates]    = useState({});
  const [devices,   setDevices]   = useState([]);
  const [sites,     setSites]     = useState([]);
  const [editing,   setEditing]   = useState(null);   // id being edited inline
  const [devModal,  setDevModal]  = useState(null);   // schedule id for device picker
  const [runResult, setRunResult] = useState(null);   // { scheduleId, results }
  const [msg,       setMsg]       = useState('');

  const load = () => {
    api.backupSchedules().then(setSchedules).catch(() => {});
    api.backupScheduleStates().then(setStates).catch(() => {});
  };
  useEffect(() => {
    load();
    api.devices().then(d => setDevices([...d].sort((a,b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })))).catch(() => {});
    api.sites().then(setSites).catch(() => {});
  }, []);

  async function createSchedule() {
    await api.backupScheduleCreate({ label: 'Nouvelle planification', frequency: 'daily', hour: 2, minute: 0 });
    load();
  }

  async function deleteSchedule(id) {
    if (!window.confirm('Supprimer cette planification ?')) return;
    await api.backupScheduleDelete(id);
    load();
  }

  async function saveSchedule(s) {
    await api.backupScheduleUpdate(s.id, { label: s.label, frequency: s.frequency, hour: s.hour, minute: s.minute, day_of_week: s.day_of_week, day_of_month: s.day_of_month, enabled: s.enabled });
    setEditing(null);
    load();
  }

  async function runNow(id) {
    setMsg('');
    try {
      const r = await api.backupScheduleRunNow(id);
      setRunResult({ scheduleId: id, results: r.results });
      load();
    } catch (e) { setMsg('Erreur : ' + e.message); }
  }

  const minutes5 = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          {t('cron.backup_schedules') || 'Planifications de sauvegardes des équipements'}
        </div>
        <button className="btn btn-sm" onClick={createSchedule}
          style={{ display: 'flex', alignItems: 'center', gap: 5, borderColor: 'var(--ok)', color: 'var(--ok)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('cron.add_schedule') || 'Ajouter un cron'}
        </button>
      </div>

      <div style={{ padding: 16 }}>
        {msg && <div className="alert alert-err" style={{ marginBottom: 12 }}>{msg}</div>}
        {schedules.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13, padding: '24px 0' }}>
            {t('cron.no_schedules') || 'Aucune planification. Cliquez sur "Ajouter un cron".'}
          </div>
        )}

        {schedules.map(s => (
          <ScheduleRow key={s.id} s={s} state={states[s.id]}
            editing={editing} setEditing={setEditing}
            onSave={saveSchedule} onDelete={deleteSchedule}
            onRunNow={runNow} onDevices={id => setDevModal(id)}
            runResult={runResult}
            t={t}
          />
        ))}
      </div>

      {/* Device picker modal */}
      {devModal !== null && (
        <DevicePickerModal
          scheduleId={devModal}
          schedules={schedules}
          devices={devices}
          sites={sites}
          onClose={() => setDevModal(null)}
          onSave={async (id, deviceIds) => { await api.backupScheduleDevices(id, { device_ids: deviceIds }); setDevModal(null); load(); }}
        />
      )}
    </div>
  );
}


function ScheduleRow({ s, state, editing, setEditing, onSave, onDelete, onRunNow, onDevices, runResult, t }) {
  const [draft, setDraft] = useState({ ...s });
  const isEditing = editing === s.id;
  const minutes5 = Array.from({ length: 12 }, (_, i) => i * 5);

  return (
    <div style={{ border: '1px solid var(--brd)', borderRadius: 'var(--r)', marginBottom: 12, background: 'var(--surf2)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--brd)', flexWrap: 'wrap' }}>
        <input type="checkbox" checked={!!s.enabled} style={{ accentColor: 'var(--ok)', width: 15, height: 15 }}
          onChange={async e => { await api.backupScheduleUpdate(s.id, { ...s, enabled: e.target.checked }); onSave({ ...s, enabled: e.target.checked }, true); }} />
        {isEditing ? (
          <input className="form-control" value={draft.label} style={{ flex: 1, height: 30, padding: '2px 8px', fontSize: 13, fontWeight: 600, minWidth: 140 }}
            onChange={e => setDraft(d => ({ ...d, label: e.target.value }))} />
        ) : (
          <span style={{ flex: 1, fontWeight: 600, fontSize: 13, color: s.enabled ? 'var(--txt)' : 'var(--muted)' }}>{s.label}</span>
        )}
        {!isEditing && (
          <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surf)', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>
            {FREQ_LABELS[s.frequency] || s.frequency}
            {s.frequency === 'weekly'  ? ` — ${DAYS_FR[s.day_of_week ?? 0]}` : ''}
            {s.frequency === 'monthly' ? ` — J${s.day_of_month ?? 1}` : ''}
            {` ${String(s.hour).padStart(2,'0')}:${String(s.minute).padStart(2,'0')}`}
          </span>
        )}
        {state && !isEditing && (
          <span style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap',
              color: state.lastResult?.some(r => r.status !== 'ok' && r.status !== 'identical') ? 'var(--err)' :
                     state.lastResult?.every(r => r.status === 'identical') ? 'var(--acc)' : 'var(--ok)' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', display: 'inline-block',
              background: state.lastResult?.some(r => r.status !== 'ok' && r.status !== 'identical') ? 'var(--err)' :
                          state.lastResult?.every(r => r.status === 'identical') ? 'var(--acc)' : 'var(--ok)' }}/>
            {state.lastRun?.slice(0, 16)}
          </span>
        )}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {isEditing ? (<>
            <button className="btn btn-sm btn-primary" onClick={() => onSave(draft)} style={{ fontSize: 11 }}>✓</button>
            <button className="btn btn-sm" onClick={() => { setEditing(null); setDraft({ ...s }); }} style={{ fontSize: 11 }}>✕</button>
          </>) : (<>
            <button className="btn btn-sm" onClick={() => onDevices(s.id)}
              style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}>
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 3h-3a1 1 0 0 0-1 1v3M8 3h3a1 1 0 0 1 1 1v3"/>
              </svg>
              {t('cron.devices') || 'Équipements'} ({s.devices?.length ?? 0})
            </button>
            <button className="btn btn-sm" onClick={() => { setEditing(s.id); setDraft({ ...s }); }} style={{ fontSize: 11 }}>✎</button>
            <button className="btn btn-sm" onClick={() => onRunNow(s.id)} title="Exécuter maintenant"
              style={{ fontSize: 11, borderColor: 'var(--acc)', color: 'var(--acc)' }}>▶</button>
            <button className="btn btn-sm" onClick={() => onDelete(s.id)}
              style={{ fontSize: 11, color: 'var(--err)', borderColor: 'var(--err)' }}>✕</button>
          </>)}
        </div>
      </div>

      {/* Edit form */}
      {isEditing && (
        <div style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('cron.frequency') || 'Fréquence'}</label>
            <select className="form-control" value={draft.frequency} onChange={e => setDraft(d => ({ ...d, frequency: e.target.value }))}>
              <option value="daily">{t('cron.daily') || 'Quotidien'}</option>
              <option value="weekly">{t('cron.weekly') || 'Hebdomadaire'}</option>
              <option value="monthly">{t('cron.monthly') || 'Mensuel'}</option>
            </select>
          </div>
          {draft.frequency === 'weekly' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('cron.day_of_week') || 'Jour'}</label>
              <select className="form-control" value={draft.day_of_week ?? 1} onChange={e => setDraft(d => ({ ...d, day_of_week: parseInt(e.target.value) }))}>
                {DAYS_FR.map((day, i) => <option key={i} value={i}>{day}</option>)}
              </select>
            </div>
          )}
          {draft.frequency === 'monthly' && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">{t('cron.day_of_month') || 'Jour du mois'}</label>
              <select className="form-control" value={draft.day_of_month ?? 1} onChange={e => setDraft(d => ({ ...d, day_of_month: parseInt(e.target.value) }))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(day => <option key={day} value={day}>{day}</option>)}
              </select>
            </div>
          )}
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('cron.hour') || 'Heure'}</label>
            <select className="form-control" value={draft.hour} onChange={e => setDraft(d => ({ ...d, hour: parseInt(e.target.value) }))}>
              {Array.from({ length: 24 }, (_, i) => <option key={i} value={i}>{String(i).padStart(2,'0')}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">{t('cron.minute') || 'Minute'}</label>
            <select className="form-control" value={draft.minute} onChange={e => setDraft(d => ({ ...d, minute: parseInt(e.target.value) }))}>
              {minutes5.map(m => <option key={m} value={m}>{String(m).padStart(2,'0')}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Devices chips */}
      {!isEditing && s.devices?.length > 0 && (
        <div style={{ padding: '8px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {s.devices.map(d => (
            <span key={d.id} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--surf)', border: '1px solid var(--brd)' }}>
              {d.name}{d.site_name ? ` (${d.site_name})` : ''}
            </span>
          ))}
        </div>
      )}

      {/* Last run result */}
      {runResult?.scheduleId === s.id && (
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--brd)', fontSize: 12 }}>
          {runResult.results.map(r => (
            <div key={r.deviceId} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%',
                background: r.status === 'ok' ? 'var(--ok)' : r.status === 'identical' ? 'var(--acc)' : 'var(--err)',
                flexShrink: 0, display: 'inline-block' }}/>
              <strong>{r.deviceName}</strong>
              {r.status === 'ok'        && <span style={{ color: 'var(--ok)' }}>✓ v{r.version}</span>}
              {r.status === 'identical' && <span style={{ color: 'var(--acc)' }}>≡ inchangé (v{r.version})</span>}
              {r.status !== 'ok' && r.status !== 'identical' && <span style={{ color: 'var(--err)' }}>✗ {r.errorMsg}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DevicePickerModal({ scheduleId, schedules, devices, sites = [], onClose, onSave }) {
  const { t } = useI18n();
  const schedule = schedules.find(s => s.id === scheduleId);
  const initial = (schedule?.devices || []).map(d => d.id);
  const [selected, setSelected] = useState(initial);
  const [query, setQuery] = useState('');

  const toggle = id => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);

  const q = query.trim().toLowerCase();
  const filteredDevices = q
    ? devices.filter(d => d.name?.toLowerCase().includes(q) || d.site_name?.toLowerCase().includes(q))
    : devices;

  // Build hierarchical site list (recursive)
  const buildSiteTree = (parentId = null, depth = 0) =>
    sites
      .filter(s => (s.parent_id || null) === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
      .flatMap(s => [{ ...s, depth }, ...buildSiteTree(s.id, depth + 1)]);

  const orderedSiteList = buildSiteTree();
  // Dedup in case sites array has duplicates
  const seenSiteIds = new Set();
  const uniqueSiteList = orderedSiteList.filter(s => { if (seenSiteIds.has(s.id)) return false; seenSiteIds.add(s.id); return true; });
  // Devices without site
  const noSiteDevices = filteredDevices.filter(d => !d.site_id);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={e => e.stopPropagation()}>
      <div style={{ background: 'var(--surf)', borderRadius: 'var(--rl)', padding: 24, width: '100%', maxWidth: 520, maxHeight: '82vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 40px rgba(0,0,0,.4)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>
          {t('cron.select_devices') || 'Équipements'} — {schedule?.label}
        </div>

        {/* Search */}
        <div style={{ marginBottom: 12 }}>
          <input
            className="form-control"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher un équipement ou un site…"
            autoComplete="off"
          />
        </div>

        {/* Site → Device tree */}
        <div className="modal-device-list" style={{
          overflowY: 'auto', flex: 1, marginBottom: 16,
          scrollbarWidth: 'thin', scrollbarColor: 'var(--brd) var(--surf2)'
        }}>
          {filteredDevices.length === 0 && (
            <div style={{ color: 'var(--muted)', fontSize: 13, padding: '12px 0' }}>
              {t('backup.no_devices') || 'Aucun équipement.'}
            </div>
          )}
          {/* Sites in hierarchical order */}
          {uniqueSiteList.map(site => {
            const siteDevices = filteredDevices.filter(d => d.site_id === site.id);
            if (siteDevices.length === 0) return null;
            return (
            <div key={site.id} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                color: 'var(--acc)', padding: '4px 8px', marginBottom: 2,
                paddingLeft: site.depth > 0 ? 8 + site.depth * 16 : 8,
                borderBottom: '1px solid var(--brd)', display: 'flex', alignItems: 'center', gap: 4 }}>
                {site.depth > 0 && <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--muted)' }}>{'└' + '─'.repeat(site.depth)}</span>}
                {site.name}
              </div>
              {siteDevices.sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(d => (
                <label key={d.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: `3px 8px 3px ${site.depth > 0 ? 8 + site.depth * 16 + 8 : 8}px`,
                  borderRadius: 'var(--r)', marginBottom: 1,
                  background: selected.includes(d.id) ? 'var(--acc-s)' : 'transparent',
                  borderLeft: `2px solid ${selected.includes(d.id) ? 'var(--acc)' : 'transparent'}`,
                }}>
                  <input type="checkbox" checked={selected.includes(d.id)}
                    onChange={() => toggle(d.id)}
                    style={{ accentColor: 'var(--acc)', width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  {d.ip && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{d.ip}</span>}
                </label>
              ))}
            </div>
            );
          })}
        </div>

          {/* Devices without site */}
          {noSiteDevices.length > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1,
                color: 'var(--muted)', padding: '4px 8px', marginBottom: 2, borderBottom: '1px solid var(--brd)' }}>
                Sans site
              </div>
              {noSiteDevices.map(d => (
                <label key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                  padding: '3px 8px 3px 22px', borderRadius: 'var(--r)', marginBottom: 1,
                  background: selected.includes(d.id) ? 'var(--acc-s)' : 'transparent',
                  borderLeft: `2px solid ${selected.includes(d.id) ? 'var(--acc)' : 'transparent'}` }}>
                  <input type="checkbox" checked={selected.includes(d.id)}
                    onChange={() => toggle(d.id)}
                    style={{ accentColor: 'var(--acc)', width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ fontWeight: 500, fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                  {d.ip && <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--mono)', flexShrink: 0 }}>{d.ip}</span>}
                </label>
              ))}
            </div>
          )}
        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            {selected.length} sélectionné{selected.length > 1 ? 's' : ''}
          </span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={onClose}>{t('common.cancel') || 'Annuler'}</button>
            <button className="btn btn-primary" onClick={() => onSave(scheduleId, selected)}>
              {t('auto_cat.save') || 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MONTHS_AUDIT = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function ArchiveListModal({ onClose }) {
  const { t } = useI18n();
  const [archives, setArchives]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [openYear, setOpenYear]   = useState(null);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    api.auditArchives()
      .then(data => { setArchives(data); if (data.length > 0) setOpenYear(data[0].year); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Construire la liste des années (archives + années futures jusqu'à now+1)
  const now = new Date();
  const archiveMap = {}; // { year: { month: archive } }
  archives.forEach(a => {
    if (!archiveMap[a.year]) archiveMap[a.year] = {};
    archiveMap[a.year][a.month] = a;
  });
  const years = [];
  const minYear = archives.length > 0 ? Math.min(...archives.map(a => a.year)) : now.getFullYear();
  for (let y = now.getFullYear(); y >= minYear; y--) years.push(y);

  const MONTHS = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

  const downloadArchive = (a) => {
    setDownloading(a.id);
    const url = api.auditArchiveDl(a.id);
    const link = document.createElement('a');
    link.href = url;
    link.download = `audit_${a.year}-${String(a.month).padStart(2,'0')}.csv.gz`;
    // Ajouter le token d'auth dans un header via fetch
    fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('dp_token')}` } })
      .then(r => r.blob())
      .then(blob => {
        const burl = URL.createObjectURL(blob);
        link.href = burl;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(burl);
      })
      .catch(() => {})
      .finally(() => setDownloading(null));
  };

  return (
    <Modal title="Archives du journal d'audit" onClose={onClose}
      footer={<button className="btn" onClick={onClose}>{t('common.close')}</button>}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><span className="spinner" /></div>
      ) : years.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--muted)', padding: 40, fontSize: 13 }}>
          <div>Aucune archive disponible</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>L'archivage automatique s'effectue le 1er de chaque mois</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {years.map(year => (
            <div key={year}>
              {/* Bouton année */}
              <button
                onClick={() => setOpenYear(openYear === year ? null : year)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 16px',
                  background: openYear === year ? 'var(--acc-s)' : 'var(--surf2)',
                  border: '1px solid' + (openYear === year ? ' var(--acc)' : ' var(--brd)'),
                  borderRadius: 'var(--r)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontWeight: 700, fontSize: 15, color: openYear === year ? 'var(--acc)' : 'var(--txt)',
                }}
              >
                <span>{year}</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--muted)' }}>
                  {Object.keys(archiveMap[year] || {}).length} archive{Object.keys(archiveMap[year] || {}).length !== 1 ? 's' : ''}
                </span>
              </button>
              {/* Grille des mois */}
              {openYear === year && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, padding: '10px 0 4px 0' }}>
                  {MONTHS.map((mName, mi) => {
                    const month = mi + 1;
                    const arch = archiveMap[year]?.[month];
                    const isFuture = year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth() + 1);
                    return (
                      <button key={month}
                        disabled={!arch || isFuture || downloading === arch?.id}
                        onClick={() => arch && downloadArchive(arch)}
                        title={arch ? `${arch.entry_count} entrée${arch.entry_count > 1 ? 's' : ''} — cliquer pour télécharger` : "Pas d'archive"}
                        style={{
                          padding: '8px 4px', borderRadius: 'var(--r)', fontSize: 12, fontWeight: 600,
                          cursor: arch ? 'pointer' : 'default',
                          border: '1px solid',
                          borderColor: arch ? 'var(--acc)' : 'var(--brd)',
                          background: arch ? 'var(--acc-s)' : 'var(--surf)',
                          color: arch ? 'var(--acc)' : 'var(--muted)',
                          opacity: isFuture ? 0.3 : 1,
                          transition: 'all .15s',
                        }}
                        onMouseEnter={e => { if (arch) e.currentTarget.style.background = 'var(--acc)'; e.currentTarget.style.color = 'white'; }}
                        onMouseLeave={e => { if (arch) { e.currentTarget.style.background = 'var(--acc-s)'; e.currentTarget.style.color = 'var(--acc)'; } }}
                      >
                        {downloading === arch?.id ? '…' : mName}
                        {arch && <div style={{ fontSize: 9, fontWeight: 400, marginTop: 2 }}>{arch.entry_count}</div>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}



const TAG_PRESETS = ['#d63939','#066fd1','#2fb344','#f76707','#7c3aed','#0f9e73','#e91e8c','#c2410c','#677489','#0891b2','#ca8a04'];

// ── SUIVI D'ACTIVITÉ MENU (wrapper avec sous-onglets) ───────────────────────
function ActivityMenuTab() {
  const [activeTab, setActiveTab] = useState('tags');
  const sv = d => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>{d}</svg>;
  const INNER_TABS = [
    { key: 'tags',    label: "Tags d'activité", icon: sv(<><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></>) },
    { key: 'options', label: 'Options',          icon: sv(<><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M5.34 18.66l-1.41 1.41M19.07 19.07l-1.41-1.41M5.34 5.34L3.93 3.93M22 12h-2M4 12H2M12 22v-2M12 4V2"/></>) },
  ];
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 20, borderBottom: '1px solid var(--brd)' }}>
        {INNER_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 16px', background: 'none', border: 'none',
            borderBottom: activeTab === tab.key ? '2px solid var(--acc)' : '2px solid transparent',
            color: activeTab === tab.key ? 'var(--acc)' : 'var(--muted)',
            fontWeight: activeTab === tab.key ? 600 : 500,
            fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font)', marginBottom: -1,
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'tags'    && <ActivityTagsTab />}
      {activeTab === 'options' && <ActivityOptionsTab />}
    </div>
  );
}

function ActivityOptionsTab() {
  const { t } = useI18n();
  const [customDate, setCustomDate] = useState(false);
  const [mergeAct, setMergeAct]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [msg, setMsg]               = useState('');

  // Import CSV
  const [csvFile, setCsvFile]         = useState(null);
  const [importing, setImporting]     = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError]   = useState('');
  const fileInputRef = useRef(null);

  // Logo PDF
  const [logoPreview, setLogoPreview]   = useState(null);
  const [logoSaving, setLogoSaving]     = useState(false);
  const [logoMsg, setLogoMsg]           = useState('');
  const logoInputRef = useRef(null);

  useEffect(() => {
    api.getFeatureFlags().then(f => { setCustomDate(!!f.activity_custom_date); setMergeAct(!!f.merge_activity); }).catch(() => {});
    api.getPdfLogo().then(r => setLogoPreview(r.logo || null)).catch(() => {});
  }, []);

  async function toggle() {
    const newVal = !customDate;
    setSaving(true); setMsg('');
    try {
      await api.setFeatureFlags({ activity_custom_date: newVal });
      setCustomDate(newVal);
      setMsg(newVal ? t('common.option_on') || 'Option activée.' : t('common.option_off') || 'Option désactivée.');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  async function toggleMerge() {
    const newVal = !mergeAct;
    setSaving(true); setMsg('');
    try {
      await api.setFeatureFlags({ merge_activity: newVal });
      setMergeAct(newVal);
      setMsg(newVal ? t('common.option_on') || 'Option activée.' : t('common.option_off') || 'Option désactivée.');
      setTimeout(() => setMsg(''), 3000);
    } catch (e) { setMsg('Erreur : ' + e.message); }
    finally { setSaving(false); }
  }

  async function handleImport() {
    if (!csvFile) return;
    setImporting(true); setImportResult(null); setImportError('');
    try {
      const text = await csvFile.text();
      const result = await api.importActivityCsv(text);
      setImportResult(result);
      setCsvFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) { setImportError(e.message); }
    finally { setImporting(false); }
  }

  function handleLogoFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setLogoMsg('Fichier invalide — image requise.'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        if (img.height > 120) {
          setLogoMsg(`Image trop haute (${img.height}px). Maximum 120px de hauteur.`);
          return;
        }
        setLogoPreview(ev.target.result);
        setLogoMsg('');
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function saveLogo() {
    setLogoSaving(true); setLogoMsg('');
    try {
      await api.setPdfLogo(logoPreview);
      setLogoMsg('Logo sauvegardé.');
      setTimeout(() => setLogoMsg(''), 3000);
    } catch (e) { setLogoMsg('Erreur : ' + e.message); }
    finally { setLogoSaving(false); }
  }

  async function deleteLogo() {
    setLogoSaving(true); setLogoMsg('');
    try {
      await api.setPdfLogo(null);
      setLogoPreview(null);
      setLogoMsg('Logo supprimé.');
      setTimeout(() => setLogoMsg(''), 3000);
    } catch (e) { setLogoMsg('Erreur : ' + e.message); }
    finally { setLogoSaving(false); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Date cosmétique + Fusion — 2 colonnes */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Card date cosmétique */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              {t('activity_opts.custom_date_title') || "Date d'affichage personnalisée"}
            </div>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
              padding: '12px 14px', borderRadius: 'var(--r)',
              background: customDate ? 'var(--acc-s)' : 'var(--surf2)',
              border: `1px solid ${customDate ? 'var(--acc)' : 'var(--brd)'}`, transition: 'all .15s',
            }}>
              <input type="checkbox" checked={customDate} onChange={toggle} disabled={saving}
                style={{ marginTop: 2, accentColor: 'var(--acc)', width: 16, height: 16 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('activity_opts.custom_date_label') || "Permettre la modification de la date d'affichage"}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {t('activity_opts.custom_date_desc') || "Quand activée, un champ date apparaît dans le formulaire d'édition. Cette date est purement cosmétique."}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Card fusion des suivis */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {t('activity_opts.merge_title') || 'Fusion des suivis'}
            </div>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
              padding: '12px 14px', borderRadius: 'var(--r)',
              background: mergeAct ? 'var(--acc-s)' : 'var(--surf2)',
              border: `1px solid ${mergeAct ? 'var(--acc)' : 'var(--brd)'}`, transition: 'all .15s',
            }}>
              <input type="checkbox" checked={mergeAct} onChange={toggleMerge} disabled={saving}
                style={{ marginTop: 2, accentColor: 'var(--acc)', width: 16, height: 16 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{t('activity_opts.merge_label') || "Fusionner les suivis d'activité"}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                  {t('activity_opts.merge_desc') || "Tous les suivis de tous les utilisateurs sont affichés ensemble. La liste déroulante est masquée et le nom de l'auteur apparaît sur chaque note."}
                </div>
              </div>
            </label>
          </div>
        </div>
      </div>
      {msg && <div className={`alert ${msg.startsWith('Erreur') ? 'alert-err' : 'alert-ok'}`} style={{ fontSize: 12 }}>{msg}</div>}

      {/* Cards Logo + CSV sur 2 colonnes */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>

        {/* Card logo PDF */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              Logo pour l'export PDF
            </div>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Ce logo remplace le texte "NEXUSVAULT" dans l'en-tête des exports PDF. <strong>Contrainte :</strong> hauteur max 120px.
            </div>
            <div style={{ background: 'var(--surf2)', borderRadius: 'var(--r)', padding: '12px 16px',
              border: '1px solid var(--brd)', display: 'flex', alignItems: 'center', minHeight: 60 }}>
              {logoPreview
                ? <img src={logoPreview} alt="Logo PDF" style={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain' }} />
                : <span style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>{t('perso.no_logo') || 'No logo — "NEXUSVAULT" text used'}</span>
              }
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" style={{ borderColor: 'var(--ok)', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => logoInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                {logoPreview ? 'Changer' : 'Uploader'}
              </button>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoFile} />
              {logoPreview && <>
                <button className="btn btn-primary" onClick={saveLogo} disabled={logoSaving}>
                  {logoSaving ? 'Sauvegarde…' : 'Sauvegarder'}
                </button>
                <button className="btn" onClick={deleteLogo} disabled={logoSaving}
                  style={{ borderColor: 'var(--err)', color: 'var(--err)' }}>
                  Supprimer
                </button>
              </>}
            </div>
            {logoMsg && <div className={`alert ${logoMsg.startsWith('Erreur') || logoMsg.includes('trop') ? 'alert-err' : 'alert-ok'}`} style={{ fontSize: 12 }}>{logoMsg}</div>}
          </div>
        </div>

        {/* Card import CSV */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import CSV de suivi d'activité
            </div>
          </div>
          <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Importation de suivi d'activité au format CSV avec un séparateur ; (point-virgule) : <span style={{ fontFamily:'var(--mono)', color:'var(--acc)' }}>ANNEE;MOIS;JOUR;TAG;NOTE</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', background: 'var(--surf2)', borderRadius: 'var(--r)', padding: '8px 12px', fontFamily: 'var(--mono)', lineHeight: 1.8 }}>
              <span style={{ fontSize: 11 }}>{t('activity.import_csv_ex') || 'Ex: 2026;01;15;SECU;Firewall update'}</span><br/>
              <span style={{ fontSize: 11 }}>{t('activity.import_tag_hint') || 'Missing TAG → auto-created. Future date → preview.'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {csvFile && (
                <span style={{ fontSize: 12, color: 'var(--txt)', marginRight: 'auto' }}>
                  <strong>{csvFile.name}</strong>
                  <button onClick={() => { setCsvFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', marginLeft: 6, padding: 0, fontSize: 12 }}>✕</button>
                </span>
              )}
              <button className="btn" style={{ borderColor: 'var(--ok)', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => fileInputRef.current?.click()}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Choisir CSV
              </button>
              <input ref={fileInputRef} type="file" accept=".csv,.txt" style={{ display: 'none' }}
                onChange={e => { setCsvFile(e.target.files[0] || null); setImportResult(null); setImportError(''); }} />
              {csvFile && (
                <button className="btn btn-primary" onClick={handleImport} disabled={importing}>
                  {importing ? 'Import…' : "Importer"}
                </button>
              )}
            </div>
            {importResult && (
              <div className="alert alert-ok" style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <strong>✓ {t('activity.import_done') || 'Import complete'}</strong>
                <span>{importResult.imported} importée(s), {importResult.skipped} ignorée(s)</span>
                {importResult.tagsCreated?.length > 0 && <span>{t('activity.import_tags_created') || 'Tags created:'} <strong>{importResult.tagsCreated.join(', ')}</strong></span>}
                {importResult.errors?.length > 0 && (
                  <details><summary style={{ cursor:'pointer', fontSize:11 }}>{importResult.errors.length} ligne(s) ignorée(s)</summary>
                    <div style={{ marginTop:4, fontFamily:'var(--mono)', fontSize:11, lineHeight:1.6 }}>
                      {importResult.errors.map((e,i) => <div key={i}>{e}</div>)}
                    </div>
                  </details>
                )}
              </div>
            )}
            {importError && <div className="alert alert-err" style={{ fontSize: 12 }}>{importError}</div>}
          </div>
        </div>

      </div>
    </div>
  );
}

function ActivityTagsTab() {
  const { t } = useI18n();
  const [tags, setTags]       = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editTag, setEditTag] = useState(null);   // null=création, obj=édition
  const [form, setForm]       = useState({ code: '', label: '', color: '#066fd1' });
  const [error, setError]     = useState('');
  const [confirm, setConfirm] = useState(null);
  const [usageError, setUsageError] = useState(null);

  const load = () => api.activityTags().then(setTags).catch(() => {});
  useEffect(() => { load(); }, []);

  function openCreate() { setEditTag(null); setForm({ code:'', label:'', color:'#066fd1' }); setError(''); setShowModal(true); }
  function openEdit(t)  { setEditTag(t); setForm({ code:t.code, label:t.label, color:t.color }); setError(''); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditTag(null); setError(''); }

  async function submit(e) {
    if (e?.preventDefault) e.preventDefault();
    setError('');
    if (!form.code || !form.label) return setError('Code et libellé requis');
    try {
      if (editTag) { await api.updateTag(editTag.id, { code: form.code, label: form.label, color: form.color }); }
      else         { await api.createTag(form); }
      closeModal(); load();
    } catch(ex) { setError(ex.message); }
  }

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:15, height:15 }}>
            <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/>
            <line x1="7" y1="7" x2="7.01" y2="7"/>
          </svg>
          Tags de suivi ({tags.length})
        </div>
        <button className="btn btn-sm" onClick={openCreate}
          style={{ display:'flex', alignItems:'center', gap:5, borderColor:'var(--ok)', color:'var(--ok)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Ajouter
        </button>
      </div>

      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <colgroup>
          <col style={{ width:160 }}/>
          <col/>
          <col style={{ width:160 }}/>
          <col style={{ width:90 }}/>
        </colgroup>
        <thead>
          <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('activity_tags.preview')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('activity_tags.label')}</th>
            <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('activity_tags.color')}</th>
            <th style={{ padding:'7px 8px' }}></th>
          </tr>
        </thead>
        <tbody>
          {tags.map(tag_item => (
            <tr key={tag_item.id} style={{ borderBottom:'1px solid var(--brd)' }}>
              <td style={{ padding:'9px 8px', textAlign:'center' }}>
                <span style={{
                  display:'inline-block',
                  background:`rgba(${parseInt(tag_item.color.slice(1,3),16)},${parseInt(tag_item.color.slice(3,5),16)},${parseInt(tag_item.color.slice(5,7),16)},0.12)`,
                  color:tag_item.color, border:`1px solid ${tag_item.color}`,
                  padding:'2px 10px', borderRadius:4, fontSize:12, fontWeight:700, fontFamily:'var(--mono)'
                }}>{tag_item.code}</span>
              </td>
              <td style={{ padding:'9px 8px', textAlign:'center', fontSize:12 }}>{tag_item.label}</td>
              <td style={{ padding:'9px 8px', textAlign:'center' }}>
                <div style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:16, height:16, borderRadius:'50%', background:tag_item.color, display:'inline-block', flexShrink:0 }}/>
                  <span style={{ fontSize:11, fontFamily:'var(--mono)', color:'var(--muted)' }}>{tag_item.color}</span>
                </div>
              </td>
              <td style={{ padding:'9px 8px', textAlign:'right', whiteSpace:'nowrap' }}>
                <button className="btn btn-sm" onClick={()=>openEdit(tag_item)} style={{ marginRight:4 }}>Édit.</button>
                <button className="btn btn-sm" onClick={()=>setConfirm(tag_item)} style={{ color:'var(--err)', borderColor:'var(--err)' }}>✕</button>
              </td>
            </tr>
          ))}
          {tags.length === 0 && <tr><td colSpan={5} style={{ textAlign:'center', color:'var(--muted)', padding:24, fontSize:13 }}>{t('activity_tags.none') || 'No tags — click "Add" to create one.'}</td></tr>}
        </tbody>
      </table>

      {/* Modal création / édition */}
      {showModal && (
        <Modal title={editTag ? `Modifier "${editTag.code}"` : t('activity_tags.new')} onClose={closeModal}
          footer={
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn" onClick={closeModal}>{t('auto_cat.cancel')}</button>
              <button className="btn btn-primary" onClick={submit}>
                {editTag ? 'Enregistrer' : 'Créer'}
              </button>
            </div>
          }>
          <form id="tag-form" onSubmit={submit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">Code *</label>
              <input className="form-control" value={form.code} maxLength={10}
                placeholder="Ex: SECU, NET, ADM…"
                onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'')}))}
                style={{ fontFamily:'var(--mono)', fontSize:13, fontWeight:600 }} />
              {editTag && <div style={{ fontSize:11, color:'var(--warn)', marginTop:3 }}>⚠ Modifier le code mettra à jour toutes les entrées d'activité associées.</div>}
              {!editTag && <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{t('activity_tags.code_hint') || 'Uppercase and digits only, max 10 characters.'}</div>}
            </div>
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">{t('activity_tags.label_req') || 'Label *'}</label>
              <input className="form-control" value={form.label} placeholder="Ex: Sécurité, Réseau, Administration…"
                onChange={e=>setForm(f=>({...f,label:e.target.value}))} />
            </div>
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">{t('activity_tags.color')}</label>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <input type="color" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                  style={{ width:38, height:32, padding:2, border:'1px solid var(--brd)', borderRadius:'var(--r)', cursor:'pointer', background:'var(--surf2)', flexShrink:0 }} />
                <input className="form-control" value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}
                  style={{ fontFamily:'var(--mono)', fontSize:12, maxWidth:110 }} />
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {TAG_PRESETS.map(c => (
                    <button key={c} type="button" onClick={()=>setForm(f=>({...f,color:c}))}
                      style={{ width:18, height:18, borderRadius:'50%', background:c, padding:0, cursor:'pointer',
                        border: form.color===c ? '2px solid var(--txt)' : '2px solid transparent' }} />
                  ))}
                </div>
              </div>
              {/* Aperçu */}
              <div style={{ marginTop:8 }}>
                <span style={{
                  display:'inline-block',
                  background:`rgba(${parseInt(form.color.slice(1,3)||'06',16)},${parseInt(form.color.slice(3,5)||'6f',16)},${parseInt(form.color.slice(5,7)||'d1',16)},0.12)`,
                  color:form.color, border:`1px solid ${form.color}`,
                  padding:'2px 10px', borderRadius:4, fontSize:12, fontWeight:700, fontFamily:'var(--mono)'
                }}>{form.code || 'CODE'}</span>
                <span style={{ fontSize:12, color:'var(--muted)', marginLeft:8 }}>{form.label || 'Libellé'}</span>
              </div>
            </div>
            {error && <div className="alert alert-err" style={{fontSize:12}}>{error}</div>}
          </form>
        </Modal>
      )}

      {confirm && <ConfirmModal message={`Supprimer le tag "${confirm.code}" ?`}
        onConfirm={async()=>{
          try { await api.deleteTag(confirm.id); setConfirm(null); load(); }
          catch(e) {
            if (e.status===409||e.usages) { setUsageError({ tagCode:confirm.code, usages:e.usages||[] }); }
            else { setError(e.message); }
            setConfirm(null);
          }
        }}
        onCancel={()=>setConfirm(null)} />}

      {usageError && (
        <Modal title={`Tag [${usageError.tagCode}] — impossible de supprimer`} onClose={()=>setUsageError(null)}
          footer={<button className="btn" onClick={()=>setUsageError(null)}>{t('common.close')}</button>}>
          <div className="alert alert-err" style={{ fontSize:12, marginBottom:12 }}>
            Ce tag est utilisé dans des notes et ne peut pas être supprimé.
          </div>
          <div style={{ fontSize:12, fontWeight:600, marginBottom:8, color:'var(--muted)' }}>
            Notes utilisant ce tag ({usageError.usages.length}{usageError.usages.length>=20?'+':''}) :
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:320, overflowY:'auto' }}>
            {usageError.usages.map((u,i) => (
              <div key={i} style={{ background:'var(--surf2)', borderRadius:'var(--r)', padding:'7px 10px', border:'1px solid var(--brd)', fontSize:12 }}>
                <span style={{ color:'var(--muted)', marginRight:8 }}>{u.date.slice(8,10)}/{u.date.slice(5,7)}/{u.date.slice(0,4)}</span>
                {u.excerpt}{u.excerpt.length>=60?'…':''}
              </div>
            ))}
          </div>
          {usageError.usages.length>=20 && <div style={{ fontSize:11, color:'var(--muted)', marginTop:8 }}>{t('activity.import_preview_hint') || 'Only the first 20 notes are shown.'}</div>}
        </Modal>
      )}
    </div>
  );
}


// ── ARCHIVE MODAL ─────────────────────────────────────────────────────────────
const MONTHS_FR_AUDIT = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ── VISUALISATION ARCHIVE ─────────────────────────────────────────────────────

function ArchiveViewModal({ archive, onClose }) {
  const { t } = useI18n();
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
      footer={<button className="btn" onClick={onClose}>{t('common.close')}</button>}>
      <div style={{ marginBottom: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{archive.entry_count} entrée{archive.entry_count > 1 ? 's' : ''} · archivé le {archive.archived_at?.slice(0, 16)} par {archive.archived_by}</span>
        <div style={{ marginLeft: 'auto' }}>
          <select className="form-control" style={{ padding: '4px 8px', fontSize: 12, height: 28 }}
            value={filterSuccess} onChange={e => setFilterSuccess(e.target.value)}>
            <option value="">{t('audit.all')}</option>
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
                <th style={{ padding: '5px 8px', textAlign: 'left', width: 130 }}>{t('audit.date')}</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', width: 90 }}>{t('audit.severity')}</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>{t('audit.action')}</th>
                <th style={{ padding: '5px 8px', textAlign: 'left', width: 100 }}>{t('audit.user')}</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>{t('audit.detail')}</th>
                <th style={{ padding: '5px 8px', textAlign: 'center', width: 60 }}>{t('audit.result')}</th>
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
              {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--muted)' }}>{t('audit.no_entries')}</td></tr>}
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
  auth:           { bg: '#dbeafe', color: '#1d4ed8' },   // bleu
  admin:          { bg: 'var(--warn-s)', color: 'var(--warn)' }, // orange
  backup:         { bg: 'var(--acc-s)', color: 'var(--acc)' },   // bleu clair
  config:         { bg: 'var(--ok-s)', color: 'var(--ok)' },     // vert
  sécurité:       { bg: 'var(--err-s)', color: 'var(--err)' },   // rouge
  suivi:          { bg: '#e0f7f4', color: '#0e9f8e' },   // teal
  automatisation: { bg: '#fdf4ff', color: '#9333ea' },   // violet (alias legacy)
  automation:     { bg: '#fdf4ff', color: '#9333ea' },   // alias
  document:       { bg: '#fdf4ff', color: '#9333ea' },   // nouveau nom
};

function AuditTab() {
  const { t, lang } = useI18n();
  const { can } = usePerms();
  const [logs, setLogs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filters, setFilters]     = useState({ category: '', severity: '', success: '', limit: '25' });
  const [showArchiveList, setShowArchiveList] = useState(false);
  const [page, setPage]           = useState(1);


  const load = () => {
    setLoading(true);
    const p = { limit: 1000 }; // Charger max depuis l'API, pagination côté frontend
    if (filters.category) p.category = filters.category;
    if (filters.severity) p.severity = filters.severity;
    if (filters.success !== '') p.success = filters.success;
    api.audit(p).then(setLogs).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); setPage(1); }, [filters]);

  const sf = k => e => setFilters(f => ({ ...f, [k]: e.target.value }));

  return (
    <>
    <div className="card">
      <div className="card-header" style={{ gap: 8 }}>
        <div className="card-title" style={{ flexShrink: 0 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          {t('audit.title')}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
          <select className="form-control" style={{ padding: '3px 6px', fontSize: 12, height: 28 }}
            value={filters.success} onChange={sf('success')}>
            <option value="">{t('audit.result')}</option>
            <option value="0">✗ Échec</option>
            <option value="1">✓ OK</option>
          </select>
          <select className="form-control" style={{ padding: '3px 6px', fontSize: 12, height: 28 }}
            value={filters.severity} onChange={sf('severity')}>
            <option value="">{t('audit.severity')}</option>
            <option value="warn">Alerte</option>
            <option value="error">Erreur</option>
            <option value="info">Info</option>
          </select>
          <select className="form-control" style={{ padding: '3px 6px', fontSize: 12, height: 28 }}
            value={filters.category} onChange={sf('category')}>
            <option value="">{t('audit.category')}</option>
            <option value="admin">Admin</option>
            <option value="auth">Auth</option>
            <option value="document">Documents</option>
            <option value="backup">Backup</option>
            <option value="config">Config</option>
            <option value="suivi">Suivi</option>
            <option value="sécurité">{t('admin.security')}</option>
          </select>
          <select className="form-control" style={{ padding: '3px 6px', fontSize: 12, height: 28, width: 60 }}
            value={filters.limit} onChange={sf('limit')}>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
          {can('audit_archive') && (
            <button className="btn" style={{ borderColor: 'var(--ok)', color: 'var(--ok)', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}
              onClick={() => setShowArchiveList(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}>
                <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><line x1="10" y1="12" x2="14" y2="12"/>
              </svg>
              Archive
            </button>
          )}
        </div>
      </div>

      {/* ── Pagination haut ── */}
      {(() => {
        const limit = parseInt(filters.limit) || 25;
        const totalPages = Math.ceil(logs.length / limit);
        if (totalPages <= 1) return null;
        const rangeStart = (page - 1) * limit + 1;
        const rangeEnd = Math.min(page * limit, logs.length);
        const delta = 2;
        const pageBtns = [];
        for (let p = Math.max(1, page - delta); p <= Math.min(totalPages, page + delta); p++) pageBtns.push(p);
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '10px 0 8px', flexWrap: 'wrap', borderBottom: '1px solid var(--brd)' }}>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 8 }}>
              {rangeStart}–{rangeEnd} / {logs.length}
            </span>
            <button className="btn btn-sm" onClick={() => setPage(1)} disabled={page === 1} style={{ padding: '3px 8px', minWidth: 28 }}>«</button>
            <button className="btn btn-sm" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} style={{ padding: '3px 8px', minWidth: 28 }}>‹</button>
            {pageBtns[0] > 1 && <span style={{ fontSize: 12, color: 'var(--muted)', padding: '0 2px' }}>…</span>}
            {pageBtns.map(p => (
              <button key={p} className={`btn btn-sm${p === page ? ' btn-primary' : ''}`}
                onClick={() => setPage(p)}
                style={{ padding: '3px 8px', minWidth: 28, fontWeight: p === page ? 700 : 400 }}>
                {p}
              </button>
            ))}
            {pageBtns[pageBtns.length - 1] < totalPages && <span style={{ fontSize: 12, color: 'var(--muted)', padding: '0 2px' }}>…</span>}
            <button className="btn btn-sm" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} style={{ padding: '3px 8px', minWidth: 28 }}>›</button>
            <button className="btn btn-sm" onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ padding: '3px 8px', minWidth: 28 }}>»</button>
            <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
              Page {page}/{totalPages}
            </span>
          </div>
        );
      })()}
      <div className="table-wrap" style={{ width: '100%', overflow: 'hidden' }}>
        <table className="audit-table">
          <thead>
            <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
              <th style={{ padding:'7px 4px 7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, width:'9%' }}>{t('audit.date')}</th>
              <th style={{ padding:'7px 4px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, width:'7%' }}>{t('audit.level')}</th>
              <th style={{ padding:'7px 4px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, width:'9%' }}>{t('audit.category')}</th>
              <th style={{ padding:'7px 4px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, width:'8%' }}>{t('audit.user')}</th>
              <th style={{ padding:'7px 4px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, width:'15%' }}>{t('audit.action')}</th>
              <th style={{ padding:'7px 4px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('audit.detail')}</th>
              <th style={{ padding:'7px 4px 7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, width:'7%' }}>{t('audit.result')}</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32 }}><span className="spinner" /></td></tr>}
            {!loading && logs.length === 0 && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: 32 }}>{t('audit.no_entries')}</td></tr>}
            {(() => {
                const limit2 = parseInt(filters.limit) || 25;
                const pagedLogs = logs.slice((page-1)*limit2, page*limit2);
                return pagedLogs.map((l, idx) => {
                  const globalIdx = (page-1)*limit2 + idx;
                  const sev = SEV[l.severity] || SEV.info;
                  const cat = CAT_COLORS[l.category] || { bg: 'var(--surf2)', color: 'var(--muted)' };
                  const currDay = (l.created_at || '').slice(0, 10);
                  const prevDay = globalIdx > 0 ? (logs[globalIdx-1].created_at || '').slice(0, 10) : currDay;
                  const newDay  = globalIdx > 0 && currDay !== prevDay;
              return (<>
              {newDay && (
                <tr key={`day-${l.id}`} style={{ pointerEvents: 'none' }}>
                  <td colSpan={7} style={{ padding: 0, border: 'none', background: 'transparent', lineHeight: 0 }}>
                    <div style={{ height: 2, background: 'var(--acc)', opacity: 0.35 }}/>
                  </td>
                </tr>
              )}
              <tr key={l.id} style={{ borderLeft: `3px solid ${sev.dot}` }}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap', padding:'6px 4px 6px 8px', textAlign:'center' }}>
                    {l.created_at?.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td style={{ padding:'6px 4px', textAlign:'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: sev.bg, color: sev.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: sev.dot, flexShrink: 0 }} />
                      {sev.label}
                    </span>
                  </td>
                  <td style={{ padding:'6px 4px', textAlign:'center' }}>
                    <span style={{ display: 'inline-block', background: cat.bg, color: cat.color, padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                      {l.category}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, padding:'6px 4px', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign:'center' }}>{l.username || '—'}</td>
                  <td style={{ fontWeight: 600, fontSize: 12, padding:'6px 4px' }}>{auditActionLabel(l.action, lang)}</td>
                  <td style={{ fontSize: 11, padding:'6px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.detail}>
                    <span style={{ color: l.success === 0 && l.detail?.includes('Identifiant tenté') ? 'var(--err)' : 'var(--muted)' }}>
                      {l.detail}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: 12 }}>
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
                  </>);
                });
              })()}
          </tbody>
        </table>
      </div>
    </div>

    {/* Pagination */}
    {(() => {
      const limit = parseInt(filters.limit) || 25;
      const totalPages = Math.ceil(logs.length / limit);
      if (totalPages <= 1) return null;
      const rangeStart = (page - 1) * limit + 1;
      const rangeEnd = Math.min(page * limit, logs.length);
      // Pages proches : afficher max 5 boutons numérotés autour de la page courante
      const pageBtns = [];
      const delta = 2;
      for (let p = Math.max(1, page - delta); p <= Math.min(totalPages, page + delta); p++) {
        pageBtns.push(p);
      }
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '14px 0', flexWrap: 'wrap' }}>
          {/* Infos */}
          <span style={{ fontSize: 11, color: 'var(--muted)', marginRight: 8 }}>
            {rangeStart}–{rangeEnd} / {logs.length}
          </span>
          {/* Première page */}
          <button className="btn btn-sm" onClick={() => setPage(1)} disabled={page === 1}
            title="Première page" style={{ padding: '3px 8px', minWidth: 28 }}>«</button>
          {/* Page précédente */}
          <button className="btn btn-sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '3px 8px', minWidth: 28 }}>‹</button>
          {/* Ellipse début */}
          {pageBtns[0] > 1 && <span style={{ fontSize: 12, color: 'var(--muted)', padding: '0 2px' }}>…</span>}
          {/* Boutons de pages numérotés */}
          {pageBtns.map(p => (
            <button key={p} className={`btn btn-sm${p === page ? ' btn-primary' : ''}`}
              onClick={() => setPage(p)}
              style={{ padding: '3px 8px', minWidth: 28, fontWeight: p === page ? 700 : 400 }}>
              {p}
            </button>
          ))}
          {/* Ellipse fin */}
          {pageBtns[pageBtns.length - 1] < totalPages && <span style={{ fontSize: 12, color: 'var(--muted)', padding: '0 2px' }}>…</span>}
          {/* Page suivante */}
          <button className="btn btn-sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            style={{ padding: '3px 8px', minWidth: 28 }}>›</button>
          {/* Dernière page */}
          <button className="btn btn-sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}
            title="Dernière page" style={{ padding: '3px 8px', minWidth: 28 }}>»</button>
          {/* Aller à la page */}
          <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8 }}>
            Page {page}/{totalPages}
          </span>
        </div>
      );
    })()}


    {showArchiveList && <ArchiveListModal onClose={() => setShowArchiveList(false)} />}
    </>
  );
}

// ── PAGE ADMIN ────────────────────────────────────────────────────────────────
// sep = séparateur visuel dans le menu


export default function Admin({ forcePasswordChange = false }) {
  const { user, logout: doLogout } = useAuth();
  const { t } = useI18n();
  const [sp, setSp] = useSearchParams();
  const active = sp.get('tab') || 'account';
  const isAdmin = user?.role === 'admin';

  const { can } = usePerms();

  const TABS = [
    { key: '__label_profil__', sectionLabel: t('admin.section_profil') },
    { key: 'account',       label: t('admin.my_account'),       icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> },
    { key: 'personnalisation', label: t('admin.personalisation'), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
    { key: 'logout',        label: t('admin.logout'),        icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> },
    { key: '__sep1__',      sep: true },
    { key: '__label_config__', sectionLabel: t('admin.section_config') },
    { key: 'appareils',     label: t('admin.devices'),         icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M2 12h2M20 12h2M19.07 19.07l-1.41-1.41M4.93 19.07l1.41-1.41"/></svg> },
    { key: 'document', label: t('admin.automatisation_menu'),          icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg> },
    { key: 'activity', label: t('admin.activity_menu'), icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg> },
    { key: '__sep2__',      sep: true },
    { key: '__label_admin__', sectionLabel: t('admin.section_admin') },
    { key: 'users',         label: t('admin.users'),      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { key: 'security',      label: t('admin.security'),           icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> },
    { key: 'audit',         label: t('admin.audit'),   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 15, height: 15 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
  ];
  const visibleTabs = TABS;
  const canAccessTab = (key) => {
    if (['account','personnalisation','logout'].includes(key)) return true;
    if (key === 'appareils') return isAdmin || can('config_read');
    if (key === 'automatisation') return isAdmin || can('automatisation');
    if (key === 'activity') return isAdmin || can('activity');
    if (key === 'users') return isAdmin;
    if (key === 'security') return isAdmin || can('security_access');
    if (key === 'audit') return isAdmin || can('audit_access');
    return isAdmin;
  };

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Administration</div>
          <div className="page-sub">{t('admin.subtitle')}</div>
        </div>
      </div>
      <div className="config-layout">
        <div className="side-menu">
          {(() => {
            // Grouper les tabs par section pour afficher la bande verticale
            const groups = [];
            let cur = { label: null, key: null, items: [] };
            visibleTabs.forEach(tab => {
              if (tab.sectionLabel) {
                groups.push({ ...cur });
                cur = { label: tab.sectionLabel, key: tab.key, items: [] };
              } else {
                cur.items.push(tab);
              }
            });
            groups.push({ ...cur });

            return groups.filter(g => g.items.length > 0 || g.label).map((group, gi) => (
              <div key={group.key || `g${gi}`} style={{ display: 'flex', minHeight: 120 }}>
                {/* Bande verticale label de section */}
                {group.label ? (
                  <div style={{
                    width: 13, flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(255,255,255,0.025)',
                    borderRight: '1px solid var(--brd)',
                    alignSelf: 'stretch',
                  }}>
                    <span style={{
                      writingMode: 'vertical-rl',
                      transform: 'rotate(180deg)',
                      fontSize: 7, fontWeight: 700,
                      color: 'rgba(255,255,255,0.75)', letterSpacing: '2px',
                      textTransform: 'uppercase', userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}>
                      {group.label}
                    </span>
                  </div>
                ) : (
                  <div style={{ width: 0 }} />
                )}
                {/* Items du groupe */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {group.items.map(menu_item => {
                    if (menu_item.sep) {
                      return <div key={menu_item.key} style={{ margin: '4px 10px', borderTop: '1px solid var(--brd)', opacity: .4 }} />;
                    }
                    const accessible = canAccessTab(menu_item.key);
                    return (
                      <div key={menu_item.key}
                        className={`side-item ${active === menu_item.key ? 'active' : ''}`}
                        onClick={() => {
                          if (!accessible) return;
                          if (menu_item.key === 'logout') doLogout();
                          else setSp({ tab: menu_item.key });
                        }}
                        title={!accessible ? 'Acces non autorise' : undefined}
                        style={{
                          fontSize: 12,
                          ...(menu_item.key === 'logout' ? { color: 'var(--err)' } : {}),
                          ...(accessible ? {} : { opacity: 0.35, cursor: 'not-allowed' }),
                        }}>
                        {menu_item.icon}{menu_item.label}
                        {!accessible && <span style={{ marginLeft:'auto', fontSize:9 }}>&#128274;</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
        <div>
          {active === 'account' && <AccountTab forcePasswordChange={forcePasswordChange} />}
          {active === 'personnalisation' && <PersonnalisationTab />}
          {active === 'appareils' && <AppareilsTab />}
          {active === 'users' && isAdmin && <UsersTab />}
          {active === 'security' && (isAdmin || can('security_access')) && <SecurityTab />}
          {(active === 'document' || active === 'automatisation') && (isAdmin || can('automatisation')) && <ScriptsAdminTab />}
          {active === 'activity' && (isAdmin || can('activity')) && <ActivityMenuTab />}
          {active === 'audit' && (isAdmin || can('audit_access')) && <AuditTab />}
        </div>
      </div>
    </main>
  );
}
