import { useEffect, useState, useRef } from 'react';
import { usePerms } from '../hooks/usePerms.js';
import { useI18n } from '../contexts/I18nContext.jsx';
import { Modal, ConfirmModal } from '../components/UI.jsx';
import AccessDenied from '../components/AccessDenied.jsx';
import api from '../api.js';

const CARD_H = 115;

export default function Scripts() {
  const { can, isAdmin } = usePerms();
  const { t } = useI18n();
  const [cats, setCats]   = useState([]);
  const [path, setPath]   = useState([]);
  const [docs, setDocs]   = useState([]);
  const [docCounts, setDocCounts] = useState({});  // catId -> count
  const [loadingDocs, setLoadingDocs] = useState(false);
  // Mémoriser les documents dont le mot de passe a déjà été vérifié dans cette session
  const unlockedDocs = useRef(new Set());
  const [detailDoc, setDetailDoc]     = useState(null);   // document détaillé ouvert
  const [confirmDel, setConfirmDel]   = useState(null);   // doc à supprimer

  const canWrite = isAdmin || can('automatisation_write');

  useEffect(() => {
    api.automationCategories().then(d => {
      if (!Array.isArray(d)) return;
      setCats(d);
      // Précharger le nb de documents pour les catégories feuilles
      const leaves = d.filter(c => !d.some(x => x.parent_id === c.id));
      leaves.forEach(leaf =>
        api.automationDocuments(leaf.id)
          .then(docs => setDocCounts(prev => ({...prev, [leaf.id]: Array.isArray(docs)?docs.length:0})))
          .catch(()=>{})
      );
    }).catch(()=>{});
  }, []);

  const currentParentId = path.length > 0 ? path[path.length-1].id : null;
  const leafCat = path.length > 0 ? path[path.length-1] : null;
  const visibleCats = cats.filter(c => (c.parent_id||null) === currentParentId)
    .sort((a,b) => a.name.localeCompare(b.name));
  const hasChildren = id => cats.some(c => c.parent_id === id);
  const isLeaf = path.length > 0 && !hasChildren(path[path.length-1].id);

  function handleTileClick(cat) {
    setPath(p => [...p, cat]);
    setDocs([]);
    if (!hasChildren(cat.id)) loadDocs(cat.id);
  }

  function loadDocs(catId) {
    setLoadingDocs(true);
    api.automationDocuments(catId)
      .then(d => {
        const arr = Array.isArray(d)?d:[];
        setDocs(arr);
        setDocCounts(prev => ({...prev, [catId]: arr.length}));
      })
      .catch(()=>setDocs([]))
      .finally(()=>setLoadingDocs(false));
  }

  function goBack(idx) {
    const newPath = path.slice(0, idx);
    setPath(newPath);
    setDocs([]);
    if (newPath.length > 0) {
      const last = newPath[newPath.length-1];
      if (!hasChildren(last.id)) loadDocs(last.id);
    }
  }

  if (!can('automatisation_read')) return <AccessDenied page={t('automatisation.title')} />;

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Automatisation</div>
          <div className="page-sub">{t('automatisation.subtitle')}</div>
        </div>
      </div>

      {/* Fil d'Ariane — toujours visible */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:16, fontSize:13, flexWrap:'wrap' }}>
        <button onClick={()=>goBack(0)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--acc)', fontWeight:600, padding:0 }}>
          Accueil
        </button>
        {path.map((cat, idx) => (
          <span key={cat.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
            <span style={{ color:'var(--muted)' }}>›</span>
            {idx < path.length-1
              ? <button onClick={()=>goBack(idx+1)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--acc)', fontWeight:600, padding:0 }}>{cat.name}</button>
              : <span style={{ fontWeight:700, color:'var(--txt)' }}>{cat.name}</span>
            }
          </span>
        ))}
      </div>

      {/* Tuiles catégories */}
      {visibleCats.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
          {visibleCats.map((cat) => {
            const color = cat.color || 'var(--acc)';
            const childCount = cats.filter(c=>c.parent_id===cat.id).length;
            const TYPE_LABEL = {generic:t('auto_cat.type_generic'),temporary:t('auto_cat.type_temporary'),procedure:t('auto_cat.type_procedure'),script:t('auto_cat.type_script'),secured:t('auto_cat.type_secured')};
            return (
              <div key={cat.id} role="button" tabIndex={0}
                onClick={()=>handleTileClick(cat)}
                onKeyDown={e=>e.key==='Enter'&&handleTileClick(cat)}
                style={{
                  background:'var(--surf)', border:'1px solid var(--brd)',
                  borderTop:`3px solid ${color}`, borderRadius:'var(--rl)',
                  padding:'14px 16px', cursor:'pointer', height:CARD_H,
                  boxSizing:'border-box', position:'relative', overflow:'hidden',
                  transition:'box-shadow .12s', fontFamily:'var(--font)', userSelect:'none',
                }}>
                <div style={{ position:'absolute', top:14, left:16, right:60 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                    <span style={{ color, flexShrink:0 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </span>
                    <span style={{ fontSize:14, color:'var(--txt)', fontWeight:600 }}>{cat.name}</span>
                  </div>
                  <div style={{ fontSize:12, color:'var(--muted)', paddingLeft:20 }}>
                    {cat.description || (childCount > 0
                    ? `${childCount} sous-catégorie(s)`
                    : docCounts[cat.id] !== undefined
                      ? `${docCounts[cat.id]} document${docCounts[cat.id]!==1?'s':''}`
                      : '…'
                  )}
                  </div>
                </div>
                <div style={{ position:'absolute', bottom:12, right:14 }}>
                  <span style={{ fontSize:10, color, background:`${color}22`, border:`1px solid ${color}44`, borderRadius:4, padding:'2px 6px', fontWeight:600 }}>
                    {TYPE_LABEL[cat.type]||cat.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Aucune catégorie */}
      {visibleCats.length === 0 && !isLeaf && (
        <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted)', background:'var(--surf)', border:'2px dashed var(--brd)', borderRadius:'var(--rl)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.5" style={{width:48,height:48,marginBottom:12}}>
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
          </svg>
          <div style={{ fontWeight:600, fontSize:15, marginBottom:8 }}>{t('automatisation.no_cats')}</div>
          <div style={{ fontSize:13 }}>{t('automatisation.no_cats_desc').split(' in ')[0]} <strong>{t('automatisation.admin_path') || 'Admin → Automation → Categories'}</strong></div>
        </div>
      )}

      {/* Documents (catégorie feuille) */}
      {isLeaf && (
        <div className="card" style={{ borderTop:`3px solid ${leafCat?.color || 'var(--acc)'}` }}>
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              </svg>
              {t('automatisation.docs_title')} — {leafCat?.name} ({docs.length})
            </div>
            {canWrite && (
              <button className="btn btn-sm" onClick={()=>setDetailDoc('create')}
                style={{ display:'flex', alignItems:'center', gap:5, borderColor:'var(--ok)', color:'var(--ok)' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Nouveau document
              </button>
            )}
          </div>
          {loadingDocs ? (
            <div style={{ padding:24, textAlign:'center', color:'var(--muted)' }}>Chargement…</div>
          ) : docs.length === 0 ? (
            <div style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:13 }}>
              Aucun document — {canWrite ? 'cliquez sur "Nouveau document" pour en créer un.' : "aucun document dans cette catégorie."}
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
                  <th style={{ padding:'7px 14px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('automatisation.col_name')}</th>
                  <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600, width:'45%' }}>{t('automatisation.col_note')}</th>
                  <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('automatisation.col_files')}</th>
                  <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('automatisation.col_date')}</th>
                  <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('automatisation.col_by')}</th>
                  {leafCat?.type === 'temporary' && <th style={{ padding:'7px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('automatisation.col_validity')}</th>}
                  <th style={{ padding:'7px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                {docs.map(doc => (
                  <tr key={doc.id} style={{ borderBottom:'1px solid var(--brd)', cursor:'pointer' }}
                    onClick={async ()=>{
                      if (leafCat?.type === 'secured' && !unlockedDocs.current.has(doc.id)) {
                        let globalPwd = '';
                        try { const f = await api.getFeatureFlags(); globalPwd = f.automation_secured_password || ''; } catch {}
                        const entered = window.prompt(t('automatisation.secured_pwd_prompt'));
                        if (entered === null) return;
                        if (!globalPwd) {
                          const docData = await api.automationDocument(doc.id);
                          if (docData.doc_password && entered !== docData.doc_password) {
                            api.automationDocAccessDenied(doc.id).catch(()=>{});
                            alert(t('automatisation.secured_wrong_pwd')); return;
                          }
                          unlockedDocs.current.add(doc.id);
                          setDetailDoc(docData);
                        } else {
                          if (entered !== globalPwd) {
                            api.automationDocAccessDenied(doc.id).catch(()=>{});
                            alert('Mot de passe incorrect.'); return;
                          }
                          unlockedDocs.current.add(doc.id);
                          api.automationDocument(doc.id).then(setDetailDoc);
                        }
                      } else {
                        api.automationDocument(doc.id).then(setDetailDoc);
                      }
                    }}>
                    <td style={{ padding:'9px 14px', fontSize:13, fontWeight:600 }}>
                      {doc.name}
                    </td>
                    <td style={{ padding:'9px 8px', textAlign:'left' }}>
                      {doc.note
                        ? <span style={{ fontSize:12, color:'var(--muted)', display:'block', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={doc.note}>{doc.note}</span>
                        : <span style={{ fontSize:11, color:'var(--brd)' }}>—</span>}
                    </td>
                    <td style={{ padding:'9px 8px', textAlign:'center' }}>
                      <span style={{ fontSize:11, background:'var(--acc-s)', color:'var(--acc)', border:'1px solid var(--acc)', borderRadius:12, padding:'2px 8px', fontWeight:600 }}>
                        {doc.file_count} fichier{doc.file_count!==1?'s':''}
                      </span>
                    </td>
                    <td style={{ padding:'9px 8px', textAlign:'center', fontSize:12, color:'var(--muted)', whiteSpace:'nowrap' }}>{doc.created_at?.slice(0,16).replace('T',' ')}</td>
                    <td style={{ padding:'9px 8px', textAlign:'center', fontSize:12, color:'var(--muted)' }}>{doc.created_by_name||'—'}</td>
                    {leafCat?.type === 'temporary' && (
                      <td style={{ padding:'9px 8px', textAlign:'center' }} onClick={e=>e.stopPropagation()}>
                        {doc.valid_until
                          ? <span style={{ fontSize:11, fontWeight:600, color: new Date(doc.valid_until)<new Date() ? 'var(--err)' : 'var(--warn)' }}>
                              {new Date(doc.valid_until)<new Date() ? '⚠ ' : ''}{doc.valid_until}
                            </span>
                          : <span style={{ fontSize:11, color:'var(--muted)' }}>—</span>}
                      </td>
                    )}
                    <td style={{ padding:'9px 8px', textAlign:'right', whiteSpace:'nowrap' }} onClick={e=>e.stopPropagation()}>
                      {canWrite && (
                        <button className="btn btn-sm btn-danger" onClick={()=>setConfirmDel(doc)}>✕</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modal Créer/Éditer document */}
{/* Modal Détail document */}
      {detailDoc && (
        <DocDetailModal
          doc={detailDoc}
          catType={leafCat?.type}
          catColor={leafCat?.color}
          catId={leafCat?.id}
          canWrite={canWrite}
          onClose={()=>setDetailDoc(null)}
          onRefresh={d=>d&&setDetailDoc(d)}
          onDocUpdated={()=>loadDocs(leafCat.id)}
        />
      )}

      {/* Confirmation suppression document */}
      {confirmDel && (
        <ConfirmModal message={`Supprimer le document "${confirmDel.name}" et tous ses fichiers ?`}
          onConfirm={async()=>{ await api.deleteDocument(confirmDel.id); setConfirmDel(null); loadDocs(leafCat.id); }}
          onCancel={()=>setConfirmDel(null)} />
      )}
    </main>
  );
}

// ── MODAL DOCUMENT (création + édition + détail + historique) ────────────────
function DocDetailModal({ doc, catType, catColor, canWrite, catId, onClose, onRefresh, onDocUpdated }) {
  const { t } = useI18n();
  // doc = 'create' → création | object → détail/édition
  const isCreate = doc === 'create';
  const [mode, setMode]           = useState(isCreate ? 'edit' : 'view');
  const [form, setForm]           = useState({
    name:        isCreate ? '' : doc.name,
    note:        isCreate ? '' : (doc.note||''),
    valid_until: isCreate ? '' : (doc.valid_until||''),
    doc_password: '',
  });
  const [securedGlobalPwd, setSecuredGlobalPwd] = useState(null); // null = not loaded yet
  const [detail, setDetail]       = useState(isCreate ? null : doc);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [confirmFile, setConfirmFile] = useState(null);
  const [previewFile, setPreviewFile] = useState(null); // {id, filename, type, content}
  const [history, setHistory]     = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const fileInputRef = useRef(null);

  const color = catColor || 'var(--acc)';

  useEffect(() => {
    if (catType === 'secured') {
      api.getFeatureFlags()
        .then(f => setSecuredGlobalPwd(f.automation_secured_password || ''))
        .catch(() => setSecuredGlobalPwd(''));
    }
  }, [catType]);

  function refreshDetail() {
    if (!isCreate && detail?.id) {
      api.automationDocument(detail.id).then(d => { setDetail(d); if(onRefresh) onRefresh(d); });
    }
  }

  function loadHistory() {
    if (!detail?.id) return;
    setHistLoading(true);
    api.automationDocumentHistory(detail.id)
      .then(d => setHistory(Array.isArray(d)?d:[]))
      .catch(()=>setHistory([]))
      .finally(()=>setHistLoading(false));
  }

  async function submit() {
    setError('');
    if (!form.name.trim()) return setError(t('automatisation.name_required') || 'Name is required.');
    if (catType === 'temporary' && !form.valid_until) return setError(t('automatisation.validity_required') || 'Expiry date is required.');
    if (catType === 'secured' && securedGlobalPwd === '' && !form.doc_password.trim())
      return setError(t('automatisation.pwd_required') || 'A password is required for this secured document.');
    if (catType === 'secured' && form.doc_password && form.doc_password === form._userPassword)
      return setError(t('automatisation.pwd_not_user') || 'Document password cannot be your user password.');
    setSaving(true);
    try {
      let docId = detail?.id;
      if (isCreate) {
        const r = await api.createDocument(catId, form);
        docId = r.id;
      } else {
        await api.updateDocument(detail.id, form);
      }
      for (const f of selectedFiles) await api.addDocumentFile(docId, f);
      setSelectedFiles([]);
      if (isCreate) { onDocUpdated(); onClose(); }
      else { setMode('view'); refreshDetail(); onDocUpdated(); }
    } catch(ex) { setError(ex.message); }
    finally { setSaving(false); }
  }

  async function handleAddFiles(e) {
    const files = Array.from(e.target.files||[]); if (!files.length) return;
    setUploading(true);
    try {
      for (const f of files) await api.addDocumentFile(detail.id, f);
      refreshDetail(); onDocUpdated();
    } catch(ex) { setError(ex.message); }
    finally { setUploading(false); if(fileInputRef.current) fileInputRef.current.value=''; }
  }

  const EVT_LABELS = {
    'DOC_CRÉÉ':          { label:'Création', color:'var(--ok)' },
    'DOC_MODIFIÉ':       { label:'Modification', color:'var(--acc)' },
    'DOC_CONSULTÉ':      { label:'Consultation', color:'var(--muted)' },
    'DOC_SUPPRIMÉ':      { label:'Suppression', color:'var(--err)' },
    'FICHIER_AJOUTÉ':    { label:'Fichier ajouté', color:'#16a34a' },
    'FICHIER_SUPPRIMÉ':  { label:'Fichier supprimé', color:'var(--err)' },
    'FICHIER_TÉLÉCHARGÉ':{ label:'Fichier téléchargé', color:'var(--acc)' },
  };

  const isExpired = detail?.valid_until && new Date(detail.valid_until) < new Date();

  // Title with history button (edit mode only)
  const titleEl = (
    <div style={{ display:'flex', alignItems:'center', gap:10, width:'100%' }}>
      <span>{isCreate ? t('automatisation.new_doc') : (mode === 'edit' ? `${t('automatisation.modify')} "${detail?.name}"` : detail?.name)}</span>
      {!isCreate && mode !== 'history' && (
        <button className="btn btn-sm" onClick={()=>{ setMode('history'); loadHistory(); }}
          style={{ marginLeft:'auto', marginRight:6, display:'flex', alignItems:'center', gap:4, fontSize:11,
            borderColor:'var(--ok)', color:'var(--ok)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
          </svg>
          Historique
        </button>
      )}
      {mode === 'history' && (
        <button className="btn btn-sm" onClick={()=>setMode('view')}
          style={{ marginLeft:'auto', marginRight:6, fontSize:11 }}>← {t('common.back').replace('← ','')}</button>
      )}
    </div>
  );

  return (
    <Modal title={titleEl} onClose={onClose} hideClose={mode !== 'view'} width="750px"
      footer={
        mode === 'edit' || isCreate ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
            {/* Gauche : Importer */}
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <button className="btn" onClick={()=>fileInputRef.current?.click()}
                style={{ borderColor:'var(--ok)', color:'var(--ok)', display:'flex', alignItems:'center', gap:6 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/>
                  <line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                Importer
                {selectedFiles.length > 0 && (
                  <span style={{ background:'var(--acc)', color:'white', borderRadius:10, padding:'1px 7px', fontSize:11, fontWeight:700 }}>
                    {selectedFiles.length}
                  </span>
                )}
              </button>
              <input ref={fileInputRef} type="file" multiple style={{display:'none'}}
                onChange={e=>setSelectedFiles(Array.from(e.target.files||[]))} />
            </div>
            {/* Droite */}
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn" onClick={()=>{ isCreate ? onClose() : setMode('view'); setError(''); }}>{t('automatisation.cancel')}</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? t('auth.saving') : (isCreate ? t('automatisation.create') : t('automatisation.save'))}
              </button>
            </div>
          </div>
        ) : mode === 'history' ? (
          <button className="btn" onClick={()=>setMode('view')}>{t('automatisation.close')}</button>
        ) : (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {canWrite && (
                <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600,
                  color:'var(--ok)', border:'1px solid var(--ok)', borderRadius:'var(--r)', padding:'3px 10px', cursor:'pointer' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                  Ajouter fichier(s)
                  <input type="file" multiple onChange={handleAddFiles} disabled={uploading} style={{display:'none'}} />
                </label>
              )}
            </div>
            <div style={{ display:'flex', gap:8 }}>
          {canWrite && <button className="btn" onClick={()=>{
            setForm({name:detail.name,note:detail.note||'',valid_until:detail.valid_until||'',doc_password:''}); setMode('edit');
          }}>Modifier</button>}
              <button className="btn btn-primary" onClick={onClose}>Fermer</button>
            </div>
          </div>
        )
      }>

      {/* Liseré */}
      <div style={{ height:3, background:color, borderRadius:2, marginBottom:16, marginTop:-4 }} />

      {/* ── MODE EDIT / CREATE ── */}
      {(mode === 'edit' || isCreate) && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">{t('automatisation.doc_name')}</label>
            <input className="form-control" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} required placeholder={t('automatisation.doc_name_ph') || 'Ex: SSL wildcard certificate'} />
          </div>
          {catType === 'temporary' && (
            <div className="form-group" style={{margin:0}}>
              <label className="form-label">{t('automatisation.doc_validity')}</label>
              <input type="date" className="form-control" value={form.valid_until} required
                onChange={e=>setForm(f=>({...f,valid_until:e.target.value}))} style={{ maxWidth:'33%' }} />
            </div>
          )}
          <div className="form-group" style={{margin:0}}>
            <label className="form-label">Note <span style={{fontWeight:400,color:'var(--muted)'}}>— optionnel</span></label>
            <textarea className="form-control" value={form.note} rows={3}
              onChange={e=>setForm(f=>({...f,note:e.target.value}))}
              placeholder={t('automatisation.doc_note_ph') || 'Free notes about this document…'} style={{ resize:'vertical', fontFamily:'var(--font)' }} />
          </div>
          {/* Mot de passe pour catégorie sécurisée */}
          {catType === 'secured' && securedGlobalPwd !== null && (
            <div style={{ background: securedGlobalPwd ? 'var(--surf2)' : 'var(--warn-s)', border: `1px solid ${securedGlobalPwd ? 'var(--brd)' : 'var(--warn)'}`, borderRadius:'var(--r)', padding:'12px 14px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14,color:'var(--err)'}}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span style={{ fontSize:12, fontWeight:700, color: securedGlobalPwd ? 'var(--muted)' : 'var(--warn)' }}>
                  {t('automatisation.secured_label')}
                </span>
              </div>
              {securedGlobalPwd ? (
                <div style={{ fontSize:12, color:'var(--muted)' }}>
                  {t('automatisation.pwd_global_hint') || 'A global password is configured in Admin → Automation → Options. It will be applied automatically.'}
                  <span style={{ display:'block', marginTop:4, color:'var(--ok)', fontWeight:600 }}>{t('automatisation.pwd_global_active')}</span>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize:12, color:'var(--warn)', marginBottom:8 }}>
                    {t('automatisation.pwd_none_set')}
                  </div>
                  <div className="form-group" style={{margin:0}}>
                    <label className="form-label">{t('automatisation.pwd_doc_label')}</label>
                    <input type="password" className="form-control" value={form.doc_password||''}
                      onChange={e=>setForm(f=>({...f,doc_password:e.target.value}))}
                      placeholder="Ne peut pas être votre mot de passe utilisateur" required />
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>
                      {t('automatisation.pwd_hint') || 'This password will be required when viewing the document.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          {selectedFiles.length > 0 && (
            <div style={{ background:'var(--surf2)', border:'1px solid var(--brd)', borderRadius:'var(--r)', padding:'8px 12px', fontSize:12 }}>
              <div style={{ fontWeight:600, color:'var(--muted)', marginBottom:4 }}>{selectedFiles.length} fichier(s) à joindre :</div>
              {selectedFiles.map((f,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                  <span style={{ color:'var(--ok)' }}>✓</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:11 }}>{f.name}</span>
                  <button type="button" onClick={()=>setSelectedFiles(prev=>prev.filter((_,j)=>j!==i))}
                    style={{ background:'none', border:'none', color:'var(--err)', cursor:'pointer', padding:0, fontSize:13, lineHeight:1 }}>✕</button>
                </div>
              ))}
            </div>
          )}
          {error && <div className="alert alert-err" style={{fontSize:12}}>{error}</div>}
        </div>
      )}

      {/* ── MODE VIEW ── */}
      {mode === 'view' && detail && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {/* 1 ligne 3 colonnes : Créé le | Par | Validité */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, fontSize:12, borderBottom:'1px solid var(--brd)', paddingBottom:12 }}>
            <div>
              <span style={{ color:'var(--muted)', fontWeight:600, display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{t('automatisation.created_on')}</span>
              <span>{detail.created_at?.slice(0,16).replace('T',' ')}</span>
            </div>
            <div>
              <span style={{ color:'var(--muted)', fontWeight:600, display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{t('automatisation.created_by')}</span>
              <span>{detail.created_by_name||'—'}</span>
            </div>
            {catType === 'temporary' && (
              <div>
                <span style={{ color:'var(--muted)', fontWeight:600, display:'block', fontSize:10, textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{t('automatisation.validity_label')}</span>
                <span style={{ color: isExpired ? 'var(--err)' : detail.valid_until ? 'var(--warn)' : 'var(--muted)', fontWeight: detail.valid_until ? 600 : 400 }}>
                  {isExpired ? '⚠ EXPIRÉ — ' : ''}{detail.valid_until || '—'}
                </span>
              </div>
            )}
          </div>
          {/* Note */}
          {detail.note && (
            <div style={{ background:'var(--surf2)', border:'1px solid var(--brd)', borderRadius:'var(--r)', padding:'10px 12px', fontSize:13, whiteSpace:'pre-wrap', lineHeight:1.6 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.06em' }}>{t('automatisation.note_label')}</div>
              {detail.note}
            </div>
          )}
          {uploading && <div style={{ fontSize:12, color:'var(--muted)' }}>Upload en cours…</div>}
          {error && <div className="alert alert-err" style={{fontSize:12}}>{error}</div>}
          {/* Fichiers */}
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
              {t('automatisation.files_label', {n: detail.files?.length||0})}
            </div>
            {(!detail.files || detail.files.length === 0) ? (
              <div style={{ fontSize:13, color:'var(--muted)', padding:'12px 0', textAlign:'center' }}>{t('automatisation.no_files')}</div>
            ) : (
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
                    <th style={{ padding:'5px 8px', textAlign:'left', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('automatisation.col_name')}</th>
                    <th style={{ padding:'5px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>Taille</th>
                    <th style={{ padding:'5px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>{t('automatisation.col_date')}</th>
                    <th style={{ padding:'5px 8px', textAlign:'center', fontSize:11, color:'var(--muted)', fontWeight:600 }}>Par</th>
                    <th style={{ padding:'5px 8px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {detail.files.map(f => (
                    <tr key={f.id} style={{ borderBottom:'1px solid var(--brd)' }}>
                      <td style={{ padding:'7px 8px', fontFamily:'var(--mono)', fontSize:12 }}>{f.filename}</td>
                      <td style={{ padding:'7px 8px', textAlign:'center', color:'var(--muted)' }}>
                        {f.size_bytes ? `${Math.round(f.size_bytes/1024)} Ko` : '—'}
                      </td>
                      <td style={{ padding:'7px 8px', textAlign:'center', color:'var(--muted)', whiteSpace:'nowrap' }}>
                        {f.uploaded_at?.slice(0,16).replace('T',' ')}
                      </td>
                      <td style={{ padding:'7px 8px', textAlign:'center', color:'var(--muted)' }}>{f.uploaded_by_name||'—'}</td>
                      <td style={{ padding:'7px 8px', textAlign:'right', whiteSpace:'nowrap' }}>
                        {(() => {
                          const fn = f.filename.toLowerCase();
                          const canPreview = (catType === 'procedure' || catType === 'script') && (
                            fn.endsWith('.pdf') || fn.endsWith('.txt') || fn.endsWith('.docx') || fn.endsWith('.doc') ||
                            fn.endsWith('.md') || fn.endsWith('.yaml') || fn.endsWith('.yml') || fn.endsWith('.json') ||
                            fn.endsWith('.xml') || fn.endsWith('.sh') || fn.endsWith('.py') || fn.endsWith('.js') ||
                            fn.endsWith('.ts') || fn.endsWith('.sql') || fn.endsWith('.ini') || fn.endsWith('.conf') ||
                            fn.endsWith('.log') || fn.endsWith('.csv') || fn.endsWith('.html') || fn.endsWith('.css') ||
                            (f.mimetype||'').startsWith('text/')
                          );
                          return (
                            <>
                              {canPreview && (
                                <button className="btn btn-sm" style={{marginRight:4, color:'var(--acc)', borderColor:'var(--acc)'}}
                                  onClick={async()=>{
                                    const data = await api.previewAutomationFile(f.id);
                                    setPreviewFile({...data, id:f.id});
                                  }}>
                                  Voir
                                </button>
                              )}
                              <button className="btn btn-sm" style={{marginRight: canWrite?4:0}}
                                onClick={()=>api.downloadAutomationFile(f.id, f.filename)}>↓</button>
                              {canWrite && (
                                <button className="btn btn-sm btn-danger" onClick={()=>setConfirmFile(f)}>✕</button>
                              )}
                            </>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── MODE HISTORY ── */}
      {mode === 'history' && (
        <div>
          {histLoading ? (
            <div style={{ textAlign:'center', padding:24 }}><span className="spinner"/></div>
          ) : history.length === 0 ? (
            <div style={{ textAlign:'center', color:'var(--muted)', padding:24, fontSize:12 }}>{t('automatisation.history_none')}</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:0, maxHeight:400, overflowY:'auto' }}>
              {history.map((h, i) => {
                const evt = EVT_LABELS[h.action] || { label: h.action, color:'var(--muted)' };
                return (
                  <div key={i} style={{ display:'flex', gap:12, padding:'10px 4px',
                    borderBottom: i < history.length-1 ? '1px solid var(--brd)' : 'none' }}>
                    <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                      <div style={{ width:8, height:8, borderRadius:'50%', background:evt.color, marginTop:4 }}/>
                      {i < history.length-1 && <div style={{ width:1, flex:1, background:'var(--brd)' }}/>}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:2 }}>
                        <span style={{ fontSize:11, fontWeight:700, color:evt.color }}>{evt.label}</span>
                        <span style={{ fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)' }}>{h.created_at?.slice(0,16)}</span>
                        {h.username && <span style={{ fontSize:10, color:'var(--muted)' }}>par {h.username}</span>}
                      </div>
                      {h.detail && <div style={{ fontSize:11, color:'var(--txt)', opacity:.8 }}>{h.detail}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {confirmFile && (
        <ConfirmModal message={`{t('automatisation.delete_file', {name: ''}).split(' {name}')[0]} "${confirmFile.filename}" ?`}
          onConfirm={async()=>{ await api.deleteAutomationFile(confirmFile.id); setConfirmFile(null); refreshDetail(); onDocUpdated(); }}
          onCancel={()=>setConfirmFile(null)} />
      )}
      {previewFile && (
        <FilePreviewModal file={previewFile} catType={catType} onClose={()=>setPreviewFile(null)} />
      )}
    </Modal>
  );
}

// ── APERÇU FICHIER ────────────────────────────────────────────────────────────
function FilePreviewModal({ file, catType, onClose }) {
  const { t } = useI18n();
  const [hlReady, setHlReady]   = useState(false);
  const [wordHtml, setWordHtml] = useState('');
  const [copied, setCopied]     = useState(false);
  const codeRef = useRef(null);

  function detectLang(filename) {
    const ext = filename.toLowerCase().split('.').pop();
    const map = {
      yaml:'yaml', yml:'yaml', json:'json', xml:'xml', html:'html', htm:'html',
      css:'css', js:'javascript', ts:'typescript', py:'python', sh:'bash',
      sql:'sql', md:'markdown', ini:'ini', conf:'ini', cfg:'ini', log:'plaintext',
      txt:'plaintext', csv:'plaintext', rb:'ruby', go:'go', java:'java',
      c:'c', cpp:'cpp', h:'c', rs:'rust', php:'php',
    };
    return map[ext] || 'plaintext';
  }

  const wordContainerRef = useRef(null);

  // Rendu Word avec mammoth — chargé depuis cdnjs (réseau autorisé)
  useEffect(() => {
    if (file.type !== 'office') return;
    const fn = file.filename.toLowerCase();
    if (!fn.match(/\.docx?$/)) { setWordHtml('__odt__'); return; }

    function doConvert() {
      try {
        const binary = atob(file.content);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        window.mammoth.convertToHtml({ arrayBuffer: bytes.buffer })
          .then(result => setWordHtml(result.value || '<p>Document vide.</p>'))
          .catch(() => setWordHtml('__error__'));
      } catch { setWordHtml('__error__'); }
    }

    if (window.mammoth) { doConvert(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    script.onload = doConvert;
    script.onerror = () => setWordHtml('__error__');
    document.head.appendChild(script);
  }, [file]);

  // CSS mammoth injecté pour améliorer la fidélité visuelle
  useEffect(() => {
    if (wordHtml && wordHtml !== '__error__' && wordHtml !== '__odt__' && !document.getElementById('mammoth-css')) {
      const style = document.createElement('style');
      style.id = 'mammoth-css';
      style.textContent = `
        .mammoth-doc { font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 11pt; line-height: 1.15; color: #000; }
        .mammoth-doc h1 { font-size: 16pt; font-weight: bold; margin: 12pt 0 6pt; }
        .mammoth-doc h2 { font-size: 13pt; font-weight: bold; margin: 10pt 0 4pt; }
        .mammoth-doc h3 { font-size: 11pt; font-weight: bold; margin: 8pt 0 4pt; }
        .mammoth-doc p  { margin: 0 0 8pt; }
        .mammoth-doc table { border-collapse: collapse; width: 100%; margin: 8pt 0; }
        .mammoth-doc td, .mammoth-doc th { border: 1px solid #d0d0d0; padding: 4pt 6pt; vertical-align: top; }
        .mammoth-doc img { max-width: 100%; height: auto; }
        .mammoth-doc ul, .mammoth-doc ol { margin: 4pt 0 8pt 24pt; padding: 0; }
        .mammoth-doc li { margin: 2pt 0; }
        .mammoth-doc [style*="text-align:center"], .mammoth-doc [style*="text-align: center"] { text-align: center !important; }
        .mammoth-doc [style*="text-align:right"], .mammoth-doc [style*="text-align: right"]   { text-align: right !important; }
        .mammoth-doc strong { font-weight: bold; }
        .mammoth-doc em     { font-style: italic; }
        .mammoth-doc u      { text-decoration: underline; }
      `;
      document.head.appendChild(style);
    }
  }, [wordHtml]);

  // Charger highlight.js pour scripts
  useEffect(() => {
    if (file.type !== 'text' || catType !== 'script') { setHlReady(true); return; }
    if (window.hljs) { setHlReady(true); return; }
    if (!document.getElementById('hljs-css')) {
      const link = document.createElement('link');
      link.id = 'hljs-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css';
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
    script.onload = () => setHlReady(true);
    document.head.appendChild(script);
  }, [file.type, catType]);

  useEffect(() => {
    if (!hlReady || !codeRef.current || file.type !== 'text') return;
    if (window.hljs) window.hljs.highlightElement(codeRef.current);
  }, [hlReady, file]);

  function handleCopy() {
    navigator.clipboard.writeText(file.content || '').then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Audit via API
      api.automationDocAccessDenied && fetch(`/api/automation/files/${file.id}/copy-audit`, {
        method:'POST', headers:{ 'Content-Type':'application/json',
          'Authorization':`Bearer ${localStorage.getItem('dp_token')}` }, body:'{}',
      }).catch(()=>{});
    });
  }

  const lang = detectLang(file.filename);
  const isScript = catType === 'script';

  return (
    <Modal title={
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>{t('automatisation.preview_title', {name: file.filename})}</span>
        {isScript && file.type === 'text' && (
          <span style={{ fontSize:10, background:'var(--ok-s)', color:'var(--ok)', border:'1px solid var(--ok)', borderRadius:4, padding:'1px 6px', fontWeight:700 }}>
            {lang.toUpperCase()}
          </span>
        )}
      </div>
    } onClose={onClose} width="860px"
      headerActions={isScript && file.type === 'text' ? (
        <button className="btn btn-sm" onClick={handleCopy}
          style={{ display:'flex', alignItems:'center', gap:5,
            borderColor: copied ? 'var(--ok)' : 'var(--acc)',
            color: copied ? 'var(--ok)' : 'var(--acc)',
            transition:'color .15s, border-color .15s' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
            {copied
              ? <polyline points="20 6 9 17 4 12"/>
              : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>}
          </svg>
          {copied ? t('automatisation.copied') : t('automatisation.copy')}
        </button>
      ) : undefined}
      footer={<button className="btn btn-primary" onClick={onClose}>Fermer</button>}>

      {file.type === 'text' && (
        <div style={{ position:'relative' }}>
          {isScript ? (
            <pre style={{ margin:0, borderRadius:'var(--r)', overflow:'auto', maxHeight:520, fontSize:12 }}>
              <code ref={codeRef} className={`language-${lang}`} style={{ fontFamily:'var(--mono)' }}>
                {file.content}
              </code>
            </pre>
          ) : (
            <pre style={{
              margin:0, padding:'16px', background:'var(--surf2)', borderRadius:'var(--r)',
              overflow:'auto', maxHeight:520, fontSize:12, fontFamily:'var(--font)',
              lineHeight:1.7, color:'var(--txt)', whiteSpace:'pre-wrap', wordBreak:'break-word'
            }}>
              {file.content}
            </pre>
          )}
        </div>
      )}

      {file.type === 'pdf' && (
        <iframe
          src={`data:application/pdf;base64,${file.content}`}
          style={{ width:'100%', height:560, border:'none', borderRadius:'var(--r)' }}
          title={file.filename}
        />
      )}

      {file.type === 'office' && (
        <>
          {wordHtml === '__error__' && (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>
              {t('automatisation.word_error')}
            </div>
          )}
          {wordHtml === '__odt__' && (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)', fontSize:13 }}>
              {t('automatisation.odt_unsupported')}
            </div>
          )}
          {wordHtml && wordHtml !== '__error__' && wordHtml !== '__odt__' && (
            <div className="mammoth-doc" style={{
              padding:'32px 48px', background:'white', borderRadius:'var(--r)',
              maxHeight:560, overflowY:'auto', fontSize:'11pt',
              boxShadow:'inset 0 0 0 1px #e0e0e0',
            }} dangerouslySetInnerHTML={{ __html: wordHtml }} />
          )}
          {!wordHtml && (
            <div style={{ textAlign:'center', padding:40, color:'var(--muted)' }}>
              <span className="spinner"/>
              <div style={{ marginTop:12, fontSize:13 }}>{t('automatisation.preview_loading')}</div>
            </div>
          )}
        </>
      )}

      {file.type === 'unsupported' && (
        <div style={{ textAlign:'center', padding:'40px 20px', color:'var(--muted)', fontSize:13 }}>
          {t('automatisation.preview_unsupported')}
        </div>
      )}
    </Modal>
  );
}
