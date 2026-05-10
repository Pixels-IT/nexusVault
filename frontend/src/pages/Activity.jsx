import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../api.js';
import { useI18n } from '../contexts/I18nContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { usePerms } from '../hooks/usePerms.js';
import { Modal, Alert, Spinner, ConfirmModal } from '../components/UI.jsx';

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

// ── TAG BADGE ─────────────────────────────────────────────────────────────────
function TagBadge({ tag, size = 'normal' }) {
  if (!tag) return null;
  const fs  = size === 'small' ? 10 : 11;
  const pad = size === 'small' ? '2px 6px' : '3px 8px';
  // Générer bg clair à partir de la couleur hex
  const hex = tag.color || '#066fd1';
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  const bg = `rgba(${r},${g},${b},0.12)`;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg, color: hex,
      border: `1px solid ${hex}`,
      padding: pad, borderRadius: 4,
      fontSize: fs, fontWeight: 700, letterSpacing: '.5px',
      fontFamily: 'var(--mono)', whiteSpace: 'nowrap',
    }}>
      {tag.code}
    </span>
  );
}

// ── MODAL AJOUT / EDITION ─────────────────────────────────────────────────────
function HistoryModal({ entryId, onClose }) {
  const { t } = useI18n();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.activityEntryHistory(entryId)
      .then(d => setHistory(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entryId]);

  const EVT_LABELS = {
    created:       'Création',
    updated:       'Modification',
    tag_changed:   'Tag modifié',
    preview_changed:'Preview',
    file_added:    '📎 Fichier ajouté',
    file_deleted:  '🗑 Fichier supprimé',
    file_locked:   '🔒 Fichier verrouillé/déverrouillé',
  };

  const evtColor = (type) => {
    if (type === 'created')      return 'var(--ok)';
    if (type === 'file_added')   return '#16a34a';
    if (type === 'file_deleted') return 'var(--err)';
    if (type === 'file_locked')  return 'var(--warn)';
    return 'var(--acc)';
  };

  return (
    <Modal title="Historique de la note" onClose={onClose}
      footer={<button className="btn" onClick={onClose}>{t('activity.close')}</button>}>
      {loading ? <div style={{ textAlign:'center', padding:24 }}><span className="spinner"/></div> : (
        history.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--muted)', padding:24, fontSize:12 }}>Aucun historique disponible</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:0, maxHeight:400, overflowY:'auto' }}>
            {history.map((h, i) => (
              <div key={h.id} style={{
                display:'flex', gap:12, padding:'10px 4px',
                borderBottom: i < history.length-1 ? '1px solid var(--brd)' : 'none',
              }}>
                <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: evtColor(h.event_type), marginTop:4 }}/>
                  {i < history.length-1 && <div style={{ width:1, flex:1, background:'var(--brd)' }}/>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:2 }}>
                    <span style={{ fontSize:11, fontWeight:700, color: evtColor(h.event_type) }}>
                      {EVT_LABELS[h.event_type] || h.event_type}
                    </span>
                    <span style={{ fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)' }}>
                      {h.changed_at?.slice(0,16)}
                    </span>
                    {h.username && <span style={{ fontSize:10, color:'var(--muted)' }}>par {h.username}</span>}
                  </div>
                  {h.detail && <div style={{ fontSize:11, color:'var(--txt)', opacity:.8 }}>{h.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </Modal>
  );
}

function EntryModal({ tags, entry, defaultYear, defaultMonth, onClose, onSave, customDateEnabled }) {
  const { t } = useI18n();
  const isEdit = !!entry;
  const now = new Date();
  const [year,      setYear]     = useState(entry?.year  || defaultYear  || now.getFullYear());
  const [month,     setMonth]    = useState(entry?.month || defaultMonth || now.getMonth() + 1);
  const [tagCode,   setTagCode]  = useState(entry?.tag_code || '');
  const [content,   setContent]  = useState(entry?.content || '');
  const [isPreview, setIsPreview] = useState(entry?.is_preview ? true : false);
  const [displayDate, setDisplayDate] = useState(entry?.display_date || '');
  const [tagError,  setTagError]  = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const dateInputRef = useRef(null);

  // Fichiers joints
  const [files,      setFiles]      = useState([]);
  const [filesLoaded, setFilesLoaded] = useState(false);
  const [fileError,  setFileError]  = useState('');
  const fileInputRef = useRef(null);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // Charger les fichiers existants si édition
  useEffect(() => {
    if (!isEdit || filesLoaded) return;
    api.getEntryFiles(entry.id)
      .then(f => { setFiles(f); setFilesLoaded(true); })
      .catch(() => setFilesLoaded(true));
  }, [isEdit, entry, filesLoaded]);

  const isFutureMonth = () => {
    const cy = now.getFullYear(), cm = now.getMonth() + 1;
    return year > cy || (year === cy && month > cm);
  };

  async function submit() {
    setError(''); setTagError(false);
    if (!tagCode) { setTagError(true); return; }
    if (!content.trim()) return setError('Le contenu est requis');
    setLoading(true);
    try {
      const preview = isFutureMonth() ? true : isPreview;
      let entryId = entry?.id;
      if (isEdit) await api.updateEntry(entry.id, { tag_code: tagCode, content, is_preview: preview, display_date: customDateEnabled ? (displayDate || null) : undefined });
      else {
        const r = await api.createEntry({ year, month, tag_code: tagCode, content, is_preview: preview });
        entryId = r.id;
      }
      // Uploader les fichiers en attente
      for (const f of files.filter(f => f._pending)) {
        await api.uploadEntryFile(entryId, { filename: f.filename, mimetype: f.mimetype, data: f.data });
      }
      onSave();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files);
    setFileError('');
    selected.forEach(file => {
      if (file.size > 10 * 1024 * 1024) { setFileError(`${file.name} dépasse 10 Mo`); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const b64 = ev.target.result.split(',')[1];
        setFiles(prev => [...prev, {
          _pending: true,
          _tempId: Date.now() + Math.random(),
          filename: file.name,
          mimetype: file.type || 'application/octet-stream',
          size_bytes: file.size,
          data: b64,
          locked: 0,
          uploaded_at: new Date().toISOString(),
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  }

  async function toggleLock(f) {
    if (f._pending) {
      setFiles(prev => prev.map(x => x._tempId === f._tempId ? { ...x, locked: x.locked ? 0 : 1 } : x));
      return;
    }
    try {
      const r = await api.lockEntryFile(f.id);
      setFiles(prev => prev.map(x => x.id === f.id ? { ...x, locked: r.locked } : x));
    } catch {}
  }

  async function deleteFile(f) {
    if (f.locked) { setFileError('Déverrouillez le fichier avant de le supprimer.'); return; }
    if (f._pending) {
      setFiles(prev => prev.filter(x => x._tempId !== f._tempId));
      return;
    }
    try {
      await api.deleteEntryFile(f.id);
      setFiles(prev => prev.filter(x => x.id !== f.id));
    } catch (e) { setFileError(e.message); }
  }

  function downloadFile(f) {
    if (f._pending) {
      const a = document.createElement('a');
      a.href = 'data:' + f.mimetype + ';base64,' + f.data;
      a.download = f.filename; a.click();
      return;
    }
    const token = localStorage.getItem('dp_token');
    const a = document.createElement('a');
    a.href = `/api/activity/files/${f.id}/download`;
    a.download = f.filename;
    // Fetch avec auth
    fetch(a.href, { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.blob())
      .then(blob => { a.href = URL.createObjectURL(blob); a.click(); })
      .catch(() => {});
  }

  function fmtSize(b) {
    if (b < 1024) return b + ' o';
    if (b < 1024*1024) return (b/1024).toFixed(1) + ' Ko';
    return (b/(1024*1024)).toFixed(1) + ' Mo';
  }

  function fmtDate(s) {
    if (!s) return '';
    const d = new Date(s);
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'});
  }

  const totalFiles = files.length;

  const [showFilesModal, setShowFilesModal] = useState(false);

  return (
    <>
    <Modal
      title={<div style={{display:'flex',alignItems:'center',gap:10,width:'100%'}}>
        <span>{isEdit ? t('activity.modify') : 'Ajouter une note'}</span>
        {isEdit && (
          <button className="btn btn-sm" onClick={() => setShowHistory(true)}
            style={{marginLeft:'auto',marginRight:6,display:'flex',alignItems:'center',gap:4,fontSize:11,
              borderColor:'var(--ok)',color:'var(--ok)'}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}>
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/>
            </svg>
            {t('activity.history')}
          </button>
        )}
      </div>}
      onClose={onClose}
      hideClose={true}
      width="864px"
      footer={
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%' }}>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <button className="btn" onClick={() => fileInputRef.current?.click()}
              style={{borderColor:'var(--ok)',color:'var(--ok)',display:'flex',alignItems:'center',gap:6}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
              </svg>{t('activity.import_btn')}</button>
            <input ref={fileInputRef} type="file" multiple style={{display:'none'}} onChange={handleFileSelect}/>
            <button className="btn" onClick={() => setShowFilesModal(true)}
              style={{display:'flex',alignItems:'center',gap:6}}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
              Fichiers
              {files.length > 0 && <span style={{background:'var(--acc)',color:'white',borderRadius:10,padding:'1px 7px',fontSize:11,fontWeight:700,marginLeft:2}}>{files.length}</span>}
            </button>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="btn" onClick={onClose}>{t('activity.cancel')}</button>
            <button className="btn btn-primary" onClick={submit} disabled={loading || !tagCode}>
              {loading ? 'Enregistrement…' : isEdit ? 'Modifier' : 'Ajouter'}
            </button>
          </div>
        </div>
      }
    >
      {error && <Alert type="err">{error}</Alert>}
      {!isEdit && (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">{t('activity.year_label') || 'Year'}</label>
            <select className="form-control" value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Mois</label>
            <select className="form-control" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
              {MONTHS.map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
            </select>
          </div>
        </div>
      )}
      <div className="form-group">
        <label className="form-label">Tag</label>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6, justifyContent:'center' }}>
          {tags.map(tag => (
            <button key={tag.code} onClick={() => { setTagCode(tag.code); setTagError(false); }} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'5px 12px', borderRadius:4, cursor:'pointer',
              border: `2px solid ${tagCode===tag.code ? tag.color : 'var(--brd)'}`,
              background: tagCode===tag.code ? `rgba(${parseInt(tag.color.slice(1,3),16)},${parseInt(tag.color.slice(3,5),16)},${parseInt(tag.color.slice(5,7),16)},0.12)` : 'var(--surf2)',
              color: tagCode===tag.code ? tag.color : 'var(--muted)',
            }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:tag.color, flexShrink:0 }}/>
              <strong style={{ fontFamily:'var(--mono)', fontWeight:700, fontSize:12 }}>{tag.code}</strong>
              <span style={{ fontSize:11, fontWeight:400, fontFamily:'var(--font)', color:'var(--muted)', lineHeight:1 }}>{tag.label}</span>
            </button>
          ))}
        </div>
        {tagError && (
          <div className="alert alert-warn" style={{ marginTop: 8, fontSize: 12 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {t('activity.tag_required')}
          </div>
        )}
      </div>
      <div className="form-group">
        <label className="form-label" style={{ marginBottom:4 }}>Description</label>
        <textarea id="entry-textarea" className="form-control" value={content} onChange={e => setContent(e.target.value)}
          rows={12} placeholder="Ex: Mise à jour des serveurs Windows vers KB5..."
          style={{ resize:'none', fontFamily:'var(--font)', overflowY:'auto',
            scrollbarWidth:'auto', scrollbarColor:'var(--brd) var(--surf2)' }} autoFocus />
      </div>
      {/* ── OPTIONS ── */}
      <div style={{ marginTop:8, borderTop:'1px solid var(--brd)', paddingTop:10 }}>
        <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', letterSpacing:'.06em', textTransform:'uppercase', marginBottom:8 }}>
          Options
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>

          {/* Mode Secret */}
          {(() => {
            const hasSecret = /\[secret\][\s\S]*?\[\/secret\]/i.test(content);
            return (
              <div style={{ padding:'8px 10px', borderRadius:'var(--r)',
                background: hasSecret ? 'rgba(217,119,6,0.08)' : 'var(--surf2)',
                border: `1px solid ${hasSecret ? '#d97706' : 'var(--brd)'}`,
                display:'flex', alignItems:'center', gap:12, transition:'all .12s' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:'var(--txt)', marginBottom:2 }}>{t('activity.mode_secret')}</div>
                  <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.45 }}>
                    Pour masquer des données sensibles (mots de passe, clés…) par <span style={{ fontFamily:'var(--mono)' }}>●●●●●</span>, sélectionnez le texte puis cliquez sur le bouton. Les données restent en clair uniquement en mode édition.
                  </div>
                </div>
                <button type="button" onClick={() => {
                    const ta = document.getElementById('entry-textarea');
                    if (!ta) return;
                    const start = ta.selectionStart, end = ta.selectionEnd;
                    const selected = content.slice(start, end);
                    const before = content.slice(0, start), after = content.slice(end);
                    const newContent = selected ? `${before}[secret]${selected}[/secret]${after}` : `${before}[secret][/secret]${after}`;
                    setContent(newContent);
                    setTimeout(() => { ta.focus(); ta.setSelectionRange(selected ? start+8+selected.length+9 : start+8, selected ? start+8+selected.length+9 : start+8); }, 10);
                  }}
                  style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5,
                    background: hasSecret ? '#d97706' : 'var(--surf)',
                    color: hasSecret ? 'white' : '#d97706',
                    border:'1.5px solid #d97706',
                    borderRadius:'var(--r)', padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap', transition:'all .12s' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  {hasSecret ? '✓ Activé' : 'Mode Secret'}
                </button>
              </div>
            );
          })()}

          {/* Mode Brouillon */}
          {!isFutureMonth() ? (
            <div style={{ padding:'8px 10px', borderRadius:'var(--r)',
              background: isPreview ? 'rgba(99,102,241,0.08)' : 'var(--surf2)',
              border: `1px solid ${isPreview ? '#6366f1' : 'var(--brd)'}`,
              display:'flex', alignItems:'center', gap:12, transition:'all .12s' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--txt)', marginBottom:2 }}>{t('activity.mode_draft')}</div>
                <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.45 }}>
                  t('activity.draft_desc')
                </div>
              </div>
              <button type="button" onClick={() => setIsPreview(p => !p)}
                style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5,
                  background: isPreview ? '#6366f1' : 'var(--surf)',
                  color: isPreview ? 'white' : '#6366f1',
                  border: `1.5px solid #6366f1`,
                  borderRadius:'var(--r)', padding:'6px 12px', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap', transition:'all .12s' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                {isPreview ? '✓ Activé' : 'Mode Brouillon'}
              </button>
            </div>
          ) : (
            <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', borderRadius:'var(--r)', background:'var(--warn-s)', border:'1px solid var(--warn)', fontSize:12, color:'var(--warn)' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:13, height:13, flexShrink:0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Mois futur — marqué automatiquement en mode brouillon
            </div>
          )}

          {/* Mode Affichage */}
          {customDateEnabled && (
            <div style={{ padding:'8px 10px', borderRadius:'var(--r)',
              background: displayDate ? 'rgba(20,184,166,0.08)' : 'var(--surf2)',
              border: `1px solid ${displayDate ? '#14b8a6' : 'var(--brd)'}`,
              display:'flex', alignItems:'center', gap:12, transition:'all .12s' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--txt)', marginBottom:2 }}>{t('activity.mode_display')}</div>
                <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.45 }}>
                  t('activity.display_desc')
                  {displayDate && (
                    <span style={{ marginLeft:6, color:'#14b8a6', fontWeight:600 }}>
                      → {new Date(displayDate+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}
                      {entry?.created_at && <span style={{ color:'var(--muted)', fontWeight:400 }}> (réel : {entry.created_at.slice(8,10)}/{entry.created_at.slice(5,7)})</span>}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ flexShrink:0, display:'flex', alignItems:'center', gap:6 }}>
                {displayDate && (
                  <button type="button" onClick={() => setDisplayDate('')}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:11, color:'var(--muted)', padding:'2px 4px' }}
                    title="Réinitialiser">✕</button>
                )}
                <button type="button" onClick={() => dateInputRef.current?.showPicker?.() || dateInputRef.current?.click()}
                  style={{ flexShrink:0, display:'flex', alignItems:'center', gap:5,
                    background: displayDate ? '#14b8a6' : 'var(--surf)',
                    color: displayDate ? 'white' : '#14b8a6',
                    border:'1.5px solid #14b8a6',
                    borderRadius:'var(--r)', padding:'6px 10px', cursor:'pointer', fontSize:12, fontWeight:600, whiteSpace:'nowrap', transition:'all .12s' }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:13,height:13}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                  {displayDate ? '✓ Activé' : 'Mode Affichage'}
                </button>
                <input ref={dateInputRef} type="date" value={displayDate} onChange={e => setDisplayDate(e.target.value)}
                  style={{ position:'absolute', opacity:0, width:0, height:0, pointerEvents:'none' }} />
              </div>
            </div>
          )}

        </div>
      </div>

    </Modal>
    {showHistory && isEdit && <HistoryModal entryId={entry.id} onClose={() => setShowHistory(false)} />}
    {showFilesModal && (
      <FilesModal
        entryId={isEdit ? entry.id : null}
        files={files}
        setFiles={setFiles}
        fileError={fileError}
        setFileError={setFileError}
        onClose={() => setShowFilesModal(false)}
        fmtSize={fmtSize}
        fmtDate={fmtDate}
        toggleLock={toggleLock}
        deleteFile={deleteFile}
        downloadFile={downloadFile}
      />
    )}
    </>
  );
}

// ── LIGNE D'ENTRÉE ────────────────────────────────────────────────────────────

// Masque le contenu entre balises [secret]...[/secret] par des ●●●●●
function renderMasked(text) {
  if (!text || !text.includes('[secret]')) return text;
  const parts = [];
  const regex = /\[secret\]([\s\S]*?)\[\/secret\]/gi;
  let last = 0, match, key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) parts.push(<span key={key++}>{text.slice(last, match.index)}</span>);
    parts.push(
      <span key={key++} title="Contenu masqué — visible en édition"
        style={{ fontFamily:'var(--mono)', letterSpacing:2, color:'var(--muted)', cursor:'default',
          background:'var(--surf2)', borderRadius:4, padding:'1px 5px', fontSize:'0.85em',
          border:'1px solid var(--brd)' }}>
        ●●●●●
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(<span key={key++}>{text.slice(last)}</span>);
  return parts.length > 0 ? parts : text;
}
// ── MODAL FICHIERS JOINTS ─────────────────────────────────────────────────────
function FilesModal({ entryId, files, setFiles, fileError, setFileError, onClose, fmtSize, fmtDate, toggleLock, deleteFile, downloadFile }) {
  const { t } = useI18n();
  return (
    <Modal
      title={
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
          </svg>
          Fichiers joints
          {files.length > 0 && (
            <span style={{background:'var(--acc)',color:'white',borderRadius:10,padding:'1px 8px',fontSize:11,fontWeight:700}}>
              {files.length}
            </span>
          )}
        </div>
      }
      onClose={onClose}
      footer={<button className="btn" onClick={onClose}>{t('activity.close')}</button>}
    >
      {fileError && <div className="alert alert-err" style={{fontSize:11,marginBottom:10}}>{fileError}</div>}
      {files.length === 0 ? (
        <div style={{textAlign:'center',padding:'28px 0',color:'var(--muted)',fontSize:13}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{width:36,height:36,marginBottom:8,opacity:.4}}>
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
          </svg>
          <div>Aucun fichier joint</div>
          <div style={{fontSize:11,marginTop:4}}>Utilisez le bouton "Importer" pour ajouter des fichiers.</div>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          {files.map((f, i) => (
            <div key={f.id || f._tempId || i} style={{
              display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
              background:'var(--surf2)',borderRadius:'var(--r)',
              border:'1px solid var(--brd)',fontSize:12,
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{width:16,height:16,color:'var(--muted)',flexShrink:0}}>
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
              </svg>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{f.filename}</div>
                <div style={{fontSize:10,color:'var(--muted)'}}>
                  {fmtSize(f.size_bytes)} · {fmtDate(f.uploaded_at)}
                  {f._pending && <span style={{color:'var(--warn)',marginLeft:4}}>• en attente d'enregistrement</span>}
                </div>
              </div>
              {!!f.locked && (
                <span style={{fontSize:10,background:'var(--warn-s)',color:'var(--warn)',padding:'2px 8px',borderRadius:8,fontWeight:600,flexShrink:0}}>
                  Verrouillé
                </span>
              )}
              <div style={{display:'flex',gap:4,flexShrink:0}}>
                <button title="Télécharger" onClick={() => downloadFile(f)}
                  style={{background:'none',border:'none',cursor:'pointer',padding:4,color:'var(--muted)',display:'flex',borderRadius:4}}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--acc)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--muted)'}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                </button>
                <button title={f.locked ? 'Déverrouiller' : 'Verrouiller'} onClick={() => toggleLock(f)}
                  style={{background:'none',border:'none',cursor:'pointer',padding:4,
                    color:f.locked?'var(--warn)':'var(--muted)',display:'flex',borderRadius:4}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                    {f.locked
                      ? <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>
                      : <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></>
                    }
                  </svg>
                </button>
                <button title={f.locked ? 'Déverrouillez avant de supprimer' : 'Supprimer'}
                  onClick={() => { deleteFile(f).then ? deleteFile(f).then(()=>{if(fileError)setFileError('');}) : deleteFile(f); }}
                  disabled={!!f.locked}
                  style={{background:'none',border:'none',cursor:f.locked?'not-allowed':'pointer',padding:4,
                    color:f.locked?'var(--brd)':'var(--err)',display:'flex',borderRadius:4}}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
                    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function EntryRow({ entry, tags, onEdit, onDelete, canEdit }) {
  const tag = tags.find(tag => tag.code === entry.tag_code);
  const isPreview = !!entry.is_preview;

  if (isPreview) {
    return (
      <div style={{
        display: 'flex', gap: 8, alignItems: 'flex-start',
        padding: '9px 16px', borderBottom: '1px solid var(--brd)',
        borderLeft: '3px solid #f76707',
        background: 'repeating-linear-gradient(135deg, transparent, transparent 5px, rgba(247,103,7,0.08) 5px, rgba(247,103,7,0.08) 10px)',
        opacity: 0.9,
      }}>
        {/* Badge PREVIEW à gauche, devant le TAG */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, paddingTop: 2 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            background: 'rgba(247,103,7,0.18)', border: '1px solid #f76707',
            borderRadius: 4, padding: '1px 6px',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#f76707" strokeWidth="2.5" style={{ width:9, height:9 }}>
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ fontSize: 8, fontWeight: 800, color: '#f76707', fontFamily: 'var(--mono)', letterSpacing: '.5px' }}>PRV</span>
          </div>
          <TagBadge tag={tag} />
          {(entry.display_date || entry.created_at) && (
            <span style={{ fontSize:11, color:'rgba(247,103,7,0.7)', whiteSpace:'nowrap', fontStyle: 'normal' }} title={entry.display_date ? 'Date cosmétique (réelle: '+(entry.created_at||'').slice(8,10)+'/'+(entry.created_at||'').slice(5,7)+')' : ''}>
              {entry.display_date ? (entry.display_date.slice(8,10)+'/'+entry.display_date.slice(5,7)) : ((entry.created_at||'').slice(8,10)+'/'+(entry.created_at||'').slice(5,7))}
            </span>
          )}
          <span style={{ color:'rgba(247,103,7,0.5)', fontSize:11 }}>—</span>
        </div>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, fontStyle: 'italic', alignSelf:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {renderMasked((entry.content||'').replace(/\r/g,'').split('\n')[0])}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 2 }}>
            <button className="btn btn-sm" onClick={() => { api.auditEditEntry(entry.id).catch(()=>{}); onEdit(entry); }}>Édit.</button>
            <button className="btn btn-sm btn-danger" onClick={() => onDelete(entry)}>✕</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 16px', borderBottom: '1px solid var(--brd)',
      transition: 'background .12s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--surf2)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0, alignSelf:'center' }}>
        <TagBadge tag={tag} />
        {(entry.display_date || entry.created_at) && (
          <span style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap', fontStyle: 'normal' }} title={entry.display_date ? 'Date cosmétique (réelle: '+(entry.created_at||'').slice(8,10)+'/'+(entry.created_at||'').slice(5,7)+')' : ''}>
            {entry.display_date ? (entry.display_date.slice(8,10)+'/'+entry.display_date.slice(5,7)) : ((entry.created_at||'').slice(8,10)+'/'+(entry.created_at||'').slice(5,7))}
          </span>
        )}
        <span style={{ color:'var(--muted)', fontSize:11 }}>—</span>
      </div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--txt)', lineHeight: 1.6, alignSelf:'center' }}>
        {renderMasked(entry.content)}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-sm" onClick={() => { api.auditEditEntry(entry.id).catch(()=>{}); onEdit(entry); }}>Édit.</button>
          <button className="btn btn-sm btn-danger" onClick={() => onDelete(entry)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── MOIS SECTION ──────────────────────────────────────────────────────────────
function MonthSection({ year, month, tags, onAdd, userId, filterTag, customDateEnabled, isOpenDefault, onToggle }) {
    const { t } = useI18n();
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [open, setOpen]         = useState(isOpenDefault || false);
  const [editEntry, setEditEntry] = useState(null);
  const [delEntry, setDelEntry]   = useState(null);
  const { user } = useAuth();
  const { can } = usePerms();
  // Admin peut voir les notes des autres mais ne peut pas les modifier/supprimer
  const isOwnEntries = !userId || userId === user?.id;
  const canEdit = isOwnEntries && can('activity_write');

  const load = useCallback(() => {
    setLoading(true);
    const params = { year, month };
    if (userId) params.user_id = userId;
    api.activityEntries(params)
      .then(data => { setEntries(data); setLoaded(true); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [year, month, userId]);

  // Chargement automatique au montage pour afficher le compteur sans cliquer
  useEffect(() => {
    if (!loaded) load();
  }, []); // eslint-disable-line

  function toggle() {
    setOpen(o => {
      const next = !o;
      onToggle && onToggle(next);
      return next;
    });
  }

  // Dépliage automatique conditionnel : charger si besoin, ouvrir seulement si correspondance
  useEffect(() => {
    if (!filterTag) return;
    const params = { year, month };
    if (userId) params.user_id = userId;
    if (!loaded) setLoading(true);
    api.activityEntries(params)
      .then(data => {
        setEntries(data);
        setLoaded(true);
        const hasMatch = data.some(e => e.tag_code === filterTag);
        setOpen(hasMatch);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterTag]); // eslint-disable-line

  function handleAdd() {
    onAdd(year, month, () => { load(); });
  }

  async function handleDelete() {
    await api.deleteEntry(delEntry.id);
    setDelEntry(null);
    load();
  }

  return (
    <div style={{ marginBottom: 2 }}>
      <div
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 16px',
          background: open ? 'var(--acc-s)' : 'var(--surf2)',
          borderLeft: `3px solid ${open ? 'var(--acc)' : 'var(--brd)'}`,
          cursor: 'pointer', borderBottom: '1px solid var(--brd)',
          userSelect: 'none', transition: 'background .15s',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ width: 13, height: 13, color: 'var(--muted)', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{MONTHS[month - 1]}</span>
        {loaded && (() => {
          const allEntries = filterTag ? entries.filter(e => e.tag_code === filterTag) : entries;
          const realEntries = allEntries.filter(e => !e.is_preview);
          const previewCount = allEntries.filter(e => e.is_preview).length;
          return (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              {realEntries.length > 0
                ? `(${realEntries.length} note${realEntries.length > 1 ? 's' : ''}${previewCount > 0 ? ` + ${previewCount} PRV` : ''})`
                : previewCount > 0 ? `(${previewCount} PRV)` : '(aucune note)'}
            </span>
          );
        })()}
        {/* Tags présents dans ce mois */}
        {loaded && (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 4 }}>
            {[...new Set(entries.map(e => e.tag_code))].map(code => {
              const found = tags.find(x => x.code === code);
              return found ? <TagBadge key={code} tag={found} size="small" /> : null;
            })}
          </div>
        )}
        {canEdit && can('activity_write') && (
          <button
            className="btn btn-sm"
            style={{ marginLeft: 'auto', fontSize: 11 }}
            onClick={e => { e.stopPropagation(); handleAdd(); }}
          >{t('activity.add')}</button>
        )}
      </div>

      {open && (
        <div style={{ background: 'var(--surf)', borderBottom: '1px solid var(--brd)' }}>
          {loading && <div style={{ padding: 16, textAlign: 'center' }}><Spinner /></div>}
          {!loading && entries.length === 0 && (
            <div style={{ padding: '14px 20px', fontSize: 12, color: 'var(--muted)', fontStyle: 'italic' }}>
              Aucune note pour ce mois.
            </div>
          )}
          {(filterTag ? entries.filter(e => e.tag_code === filterTag) : entries).map(e => (
            <EntryRow key={e.id} entry={e} tags={tags} canEdit={canEdit}
              onEdit={entry => setEditEntry(entry)}
              onDelete={entry => setDelEntry(entry)}
            />
          ))}
        </div>
      )}

      {editEntry && (
        <EntryModal tags={tags} entry={editEntry} customDateEnabled={customDateEnabled} onClose={() => setEditEntry(null)}
          onSave={() => { setEditEntry(null); load(); }} />
      )}
      {delEntry && (() => {
        const hasSecret = /\[secret\][\s\S]*?\[\/secret\]/i.test(delEntry.content || '');
        const excerpt = (delEntry.content || '').replace(/\[secret\][\s\S]*?\[\/secret\]/gi, '●●●●●').slice(0, 80);
        return (
          <ConfirmModal
            message={
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <div style={{ fontSize:13 }}>
                  Supprimer la note <strong style={{ fontFamily:'var(--mono)' }}>[{delEntry.tag_code}]</strong> ?
                </div>
                <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', background:'var(--surf2)',
                  padding:'8px 10px', borderRadius:'var(--r)', borderLeft:'3px solid var(--brd)', lineHeight:1.5 }}>
                  {excerpt}{(delEntry.content || '').length > 80 ? '…' : ''}
                </div>
                {hasSecret && (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
                    background:'rgba(217,119,6,0.1)', border:'1px solid #d97706',
                    borderRadius:'var(--r)', fontSize:12, color:'#d97706', fontWeight:600 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15,flexShrink:0}}>
                      <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    ⚠ Cette note contient des données en Mode Secret. La suppression est définitive.
                  </div>
                )}
              </div>
            }
            onConfirm={handleDelete}
            onCancel={() => setDelEntry(null)}
          />
        );
      })()}
    </div>
  );
}

// ── t('activity.year_label') || 'YEAR' SECTION ─────────────────────────────────────────────────────────────
function YearSection({ year, tags, onAdd, userId, filterTag, isOpenDefault, onToggle, customDateEnabled, openMonths, onToggleMonth, hideHeader }) {
    const { t } = useI18n();
  const [open, setOpen] = useState(isOpenDefault || false);
  const [yearCount, setYearCount] = useState(null);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    onToggle && onToggle(next);
  }

  // Charger le total + dépliage automatique conditionnel selon le filtre
  useEffect(() => {
    const params = { year };
    if (userId) params.user_id = userId;
    api.activityEntries(params).then(data => {
      const filtered = filterTag ? data.filter(e => e.tag_code === filterTag) : data;
      // Compter hors preview
      const realCount = data.filter(e => !e.is_preview).length;
      setYearCount(realCount);
      if (filterTag && filtered.length > 0) { setOpen(true); onToggle && onToggle(true); }
      if (filterTag && filtered.length === 0) { setOpen(false); onToggle && onToggle(false); }
    }).catch(() => {});
  }, [year, userId, filterTag]); // eslint-disable-line

  return (
    <div style={{ marginBottom: 10, border: '1px solid var(--brd)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
      {!hideHeader && (
      <div
        onClick={toggleOpen}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '13px 18px', background: 'var(--surf)',
          cursor: 'pointer', borderBottom: open ? '1px solid var(--brd)' : 'none',
          userSelect: 'none',
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ width: 15, height: 15, color: 'var(--muted)', transition: 'transform .2s', transform: open ? 'rotate(90deg)' : 'none', flexShrink: 0 }}>
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ width: 17, height: 17, color: 'var(--acc)', flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span style={{ fontWeight: 700, fontSize: 16 }}>{year}</span>
        {yearCount !== null && (
          <span style={{ fontSize: 12, color: 'var(--muted)', fontWeight: 400 }}>
            — {yearCount} note{yearCount > 1 ? 's' : ''}
          </span>
        )}
      </div>
      )}

      {(open || hideHeader) && (
        <div>
          {months.map(m => (
            <MonthSection key={m} year={year} month={m} tags={tags} onAdd={onAdd} userId={userId} filterTag={filterTag} customDateEnabled={customDateEnabled}
              isOpenDefault={!!(openMonths && openMonths[`${year}-${m}`])}
              onToggle={isOpen => onToggleMonth && onToggleMonth(m, isOpen)}
            />
          ))}
        </div>
      )}
    </div>
  );
}


// ── EXPORT PDF ────────────────────────────────────────────────────────────────
function ExportModal({ tags, userId, targetUserName, onClose }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const now = new Date();
  const [mode,      setMode]      = useState('month');
  const [year,      setYear]      = useState(now.getFullYear());
  const [month,     setMonth]     = useState(now.getMonth() + 1);
  const [filterTag, setFilterTag] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [showChart, setShowChart] = useState(true);
  const [chartType, setChartType] = useState('pie'); // pie | bar-h | bar-v | donut

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  const CHART_TYPES = [
    { value:'pie',   label:t('activity.chart_pie') },
    { value:'donut', label:t('activity.chart_donut') },
    { value:'bar-h', label:t('activity.chart_barh') },
    { value:'bar-v', label:t('activity.chart_barv') },
  ];

  async function doExport() {
    setLoading(true); setError('');
    try {
      const params = {};
      if (userId) params.user_id = userId;
      if (mode === 'month' || mode === 'year') params.year = year;
      if (mode === 'month') params.month = month;
      // mode 'all' = pas de filtre année

      const entries = await api.activityEntries(params);
      // Exclure les notes en preview de l'export PDF
      const allFiltered = filterTag ? entries.filter(e => e.tag_code === filterTag) : entries;
      const filtered = allFiltered.filter(e => !e.is_preview);

      if (filtered.length === 0) { setError('Aucune note (hors preview) pour cette sélection.'); setLoading(false); return; }

      // Audit
      try {
        await fetch('/api/activity/export-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('dp_token')}` },
          body: JSON.stringify({ mode, year, month, filterTag, count: filtered.length, target_user: userId || user?.id }),
        });
      } catch { /* audit optionnel */ }

      const tagColors = {};
      tags.forEach(tag => { tagColors[tag.code] = tag.color; });

      // Charger le logo PDF si défini
      let pdfLogo = null;
      try { const lr = await api.getPdfLogo(); pdfLogo = lr.logo || null; } catch {}

      // Grouper par année > mois
      const grouped = {};
      filtered.forEach(e => {
        const k = String(e.year);
        if (!grouped[k]) grouped[k] = {};
        const mk = String(e.month).padStart(2,'0');
        if (!grouped[k][mk]) grouped[k][mk] = [];
        grouped[k][mk].push(e);
      });

      // Stats par TAG pour le camembert
      const tagStats = {};
      filtered.forEach(e => { tagStats[e.tag_code] = (tagStats[e.tag_code] || 0) + 1; });
      const tagEntries = Object.entries(tagStats).sort((a,b) => b[1]-a[1]);
      const total = filtered.length;

      // Générer le SVG camembert
      function buildPieChart(data, colors) {
        const size = 160;
        const cx = size/2, cy = size/2, r = 68;
        let startAngle = -Math.PI/2;
        let slices = '';
        let legend = '';
        const tot = data.reduce((s,[,v]) => s+v, 0);
        data.forEach(([code, count], i) => {
          const angle = (count / tot) * 2 * Math.PI;
          const endAngle = startAngle + angle;
          const x1 = cx + r * Math.cos(startAngle);
          const y1 = cy + r * Math.sin(startAngle);
          const x2 = cx + r * Math.cos(endAngle);
          const y2 = cy + r * Math.sin(endAngle);
          const large = angle > Math.PI ? 1 : 0;
          const col = colors[code] || '#066fd1';
          slices += `<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r},${r} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${col}" stroke="white" stroke-width="1.5"/>`;
          const midAngle = startAngle + angle/2;
          if (angle > 0.25) {
            const tx = cx + r*0.65 * Math.cos(midAngle);
            const ty = cy + r*0.65 * Math.sin(midAngle);
            const pct = Math.round(count/tot*100);
            slices += `<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="9" font-weight="700" font-family="monospace">${pct}%</text>`;
          }
          const ly = 14 + i * 17;
          legend += `<rect x="0" y="${ly-8}" width="10" height="10" rx="2" fill="${col}"/>`;
          legend += `<text x="14" y="${ly+1}" font-size="9" fill="#444" font-family="Arial">${code} (${count})</text>`;
          startAngle = endAngle;
        });
        return { svgPie: `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${slices}</svg>`, svgLegend: `<svg width="120" height="${14 + data.length*17}" viewBox="0 0 120 ${14+data.length*17}">${legend}</svg>` };
      }

      const who = targetUserName || user?.displayName || user?.username || '';
      const modeLabel = mode === 'month' ? `${MONTHS[month-1]} ${year}` : mode === 'year' ? `Année ${year}` : mode === 'all' ? t('activity.all_years') : `Tag ${filterTag || 'tous'}`;
      const exportDate = new Date().toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });

      // Lignes du tableau
      let rows = '';
      Object.keys(grouped).sort((a,b)=>b-a).forEach(yr => {
        rows += `<tr class="yr-row"><td colspan="3">${yr}</td></tr>`;
        Object.keys(grouped[yr]).sort().forEach(mo => {
          rows += `<tr class="mo-row"><td colspan="3">${MONTHS[parseInt(mo)-1]}</td></tr>`;
          grouped[yr][mo].forEach(e => {
            const col = tagColors[e.tag_code] || '#066fd1';
            const r = parseInt(col.slice(1,3),16), g=parseInt(col.slice(3,5),16), b=parseInt(col.slice(5,7),16);
            const dispDate = e.display_date || e.created_at || '';
            const dateStr = dispDate ? `${dispDate.slice(8,10)}/${dispDate.slice(5,7)}/${dispDate.slice(0,4)}` : '';
            const safeContent = e.content
              .replace(/</g,'&lt;').replace(/>/g,'&gt;')
              .replace(/\n/g,'<br>')
              .replace(/\[secret\][\s\S]*?\[\/secret\]/gi, '<span style="background:#f1f5f9;color:#64748b;font-family:monospace;padding:1px 4px;border-radius:3px;font-size:10px;border:1px solid #cbd5e1">●●●●●</span>');
            rows += `<tr>
              <td style="width:70px;padding:6px 8px;vertical-align:top;white-space:nowrap;font-size:10px;color:#64748b">${dateStr}</td>
              <td style="width:70px;padding:6px 8px;vertical-align:top;text-align:center;">
                <span style="display:inline-block;background:rgba(${r},${g},${b},0.1);color:${col};border:1px solid ${col};padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;font-family:monospace">${e.tag_code}</span>
              </td>
              <td style="padding:6px 8px;font-size:11px;line-height:1.7;color:#1e293b">${safeContent}</td>
            </tr>`;
          });
        });
      });

      // ── Graphique ─────────────────────────────────────────────────────────────
      let chartSection = '';
      if (showChart && tagEntries.length > 0) {
        const tot2 = tagEntries.reduce((s,[,v])=>s+v,0);

        if (chartType === 'pie' || chartType === 'donut') {
          const size=160, cx=size/2, cy=size/2, r2=chartType==='donut'?68:68, hole=chartType==='donut'?32:0;
          let startAngle=-Math.PI/2, slices='', legend='';
          tagEntries.forEach(([code,count],i) => {
            const angle=(count/tot2)*2*Math.PI, endAngle=startAngle+angle;
            const x1=cx+r2*Math.cos(startAngle), y1=cy+r2*Math.sin(startAngle);
            const x2=cx+r2*Math.cos(endAngle),   y2=cy+r2*Math.sin(endAngle);
            const large=angle>Math.PI?1:0;
            const col=tagColors[code]||'#066fd1';
            if(chartType==='donut'){
              const ix1=cx+hole*Math.cos(endAngle), iy1=cy+hole*Math.sin(endAngle);
              const ix2=cx+hole*Math.cos(startAngle), iy2=cy+hole*Math.sin(startAngle);
              slices+=`<path d="M${x1.toFixed(1)},${y1.toFixed(1)} A${r2},${r2} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} L${ix1.toFixed(1)},${iy1.toFixed(1)} A${hole},${hole} 0 ${large},0 ${ix2.toFixed(1)},${iy2.toFixed(1)} Z" fill="${col}" stroke="white" stroke-width="1.5"/>`;
            } else {
              slices+=`<path d="M${cx},${cy} L${x1.toFixed(1)},${y1.toFixed(1)} A${r2},${r2} 0 ${large},1 ${x2.toFixed(1)},${y2.toFixed(1)} Z" fill="${col}" stroke="white" stroke-width="1.5"/>`;
            }
            const mid=startAngle+angle/2;
            if(angle>0.25){const tx=cx+(chartType==='donut'?50:r2*0.65)*Math.cos(mid), ty=cy+(chartType==='donut'?50:r2*0.65)*Math.sin(mid); slices+=`<text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="9" font-weight="700" font-family="monospace">${Math.round(count/tot2*100)}%</text>`;}
            const ly=14+i*17; legend+=`<rect x="0" y="${ly-8}" width="10" height="10" rx="2" fill="${col}"/><text x="14" y="${ly+1}" font-size="9" fill="#444" font-family="Arial">${code} (${count})</text>`;
            startAngle=endAngle;
          });
          const svgPie=`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${slices}</svg>`;
          const svgLegend=`<svg width="120" height="${14+tagEntries.length*17}">${legend}</svg>`;
          chartSection=`<div class="chart-block"><h3 class="chart-title">{t('activity.chart_tag_dist') || 'TAG distribution'}</h3><div class="chart-inner"><div class="pie-wrap">${svgPie}</div><div class="legend-wrap">${svgLegend}</div></div>`;

        } else if (chartType === 'bar-h') {
          const bw=300, bh=20, gap=6, maxVal=tagEntries[0]?.[1]||1;
          let bars='';
          tagEntries.forEach(([code,count],i) => {
            const col=tagColors[code]||'#066fd1';
            const w=Math.max(4,Math.round((count/maxVal)*bw));
            const y=i*(bh+gap);
            bars+=`<g transform="translate(0,${y})"><rect x="0" y="0" width="${w}" height="${bh}" rx="3" fill="${col}"/><text x="${w+6}" y="${bh/2+4}" font-size="9" fill="#444" font-family="Arial" dominant-baseline="middle">${code} (${count})</text></g>`;
          });
          const svgH=`<svg width="450" height="${tagEntries.length*(bh+gap)}" font-family="Arial">${bars}</svg>`;
          chartSection=`<div class="chart-block"><h3 class="chart-title">{t('activity.chart_tag_dist') || 'TAG distribution'}</h3><div class="chart-inner">${svgH}</div>`;

        } else if (chartType === 'bar-v') {
          const barW=36, gap2=10, maxVal2=tagEntries[0]?.[1]||1, chartH=120;
          const totalW=tagEntries.length*(barW+gap2);
          let bars2='';
          tagEntries.forEach(([code,count],i) => {
            const col=tagColors[code]||'#066fd1'; const h=Math.max(4,Math.round((count/maxVal2)*chartH));
            const x=i*(barW+gap2);
            bars2+=`<g transform="translate(${x},0)"><rect x="0" y="${chartH-h}" width="${barW}" height="${h}" rx="3" fill="${col}"/><text x="${barW/2}" y="${chartH+12}" text-anchor="middle" font-size="8" fill="#444" font-family="monospace">${code}</text><text x="${barW/2}" y="${chartH-h-4}" text-anchor="middle" font-size="8" fill="#444">${count}</text></g>`;
          });
          const svgV=`<svg width="${totalW}" height="${chartH+24}" font-family="Arial">${bars2}</svg>`;
          chartSection=`<div class="chart-block"><h3 class="chart-title">{t('activity.chart_tag_dist') || 'TAG distribution'}</h3><div class="chart-inner">${svgV}</div>`;
        }
        if(chartSection) chartSection += `</div>`;
      }

      const statPillsHtml = `<div class="stat-pills">
              ${tagEntries.map(([code,cnt]) => {
                const col = tagColors[code] || '#066fd1';
                const r=parseInt(col.slice(1,3),16),g=parseInt(col.slice(3,5),16),b=parseInt(col.slice(5,7),16);
                const pct = Math.round(cnt/total*100);
                return `<div class="pill" style="background:rgba(${r},${g},${b},0.08);border:1px solid ${col}">
                  <span class="pill-tag" style="color:${col}">${code}</span>
                  <span class="pill-val">${cnt} note${cnt>1?'s':''}</span>
                  <span class="pill-pct" style="color:${col}">${pct}%</span>
                </div>`;
              }).join('')}
            </div>
          </div>`;

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>NexusVault — Suivi ${who} — ${modeLabel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff}
.header{background:#f8fafc;border-bottom:2px solid #e2e8f0;padding:20px 32px;display:flex;justify-content:space-between;align-items:center}
.header-logo{font-size:22px;font-weight:800;letter-spacing:1px;color:#1e293b}
.header-logo span{color:#2196f3}
.header-logo img{max-height:60px;max-width:220px;object-fit:contain;display:block}
.header-right{text-align:right;color:#64748b;font-size:11px}
.header-right .scope{font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px}
.meta-bar{background:#f8fafc;border-bottom:1px solid #e2e8f0;padding:10px 32px;display:flex;gap:24px;font-size:11px;color:#64748b}
.meta-item{display:flex;align-items:center;gap:5px}
.meta-dot{width:6px;height:6px;border-radius:50%;background:#2196f3;display:inline-block}
.chart-block{padding:24px 32px;border-bottom:1px solid #e2e8f0;background:#fafcff}
.chart-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.chart-title::before{content:"";display:inline-block;width:4px;height:16px;background:#2196f3;border-radius:2px}
.chart-inner{display:flex;align-items:center;gap:24px}
.pie-wrap{flex-shrink:0}
.legend-wrap{flex-shrink:0}
.stat-pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
.pill{display:flex;align-items:center;gap:8px;padding:5px 12px;border-radius:20px;font-size:10px}
.pill-tag{font-weight:700;font-family:monospace}
.pill-val{color:#475569}
.pill-pct{font-weight:700}
.table-section{padding:16px 32px}
.table-title{font-size:13px;font-weight:700;color:#1e293b;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.table-title::before{content:"";display:inline-block;width:4px;height:16px;background:#10b981;border-radius:2px}
table{width:100%;border-collapse:collapse}
tr.yr-row td{background:#1e293b;color:white;font-size:13px;font-weight:700;padding:9px 16px;letter-spacing:.3px}
tr.mo-row td{background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;padding:6px 16px;text-transform:uppercase;letter-spacing:.5px;border-top:1px solid #dbeafe}
tr:not(.yr-row):not(.mo-row){border-bottom:1px solid #f1f5f9}
tr:not(.yr-row):not(.mo-row):nth-child(even){background:#fafafa}
.footer{background:#f8fafc;border-top:1px solid #e2e8f0;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94a3b8}
@media print{
  body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @page{margin:10mm}
  .no-print{display:none}
}
</style>
</head>
<body>
<div class="header">
  <div class="header-logo">${pdfLogo ? `<img src="${pdfLogo}" alt="Logo"/>` : 'NEXUS<span>VAULT</span>'}</div>
  <div class="header-right">
    <div class="scope">Suivi d'activité — ${who}</div>
    <div>${modeLabel}</div>
  </div>
</div>
<div class="meta-bar">
  <div class="meta-item"><span class="meta-dot"></span>${filtered.length} note${filtered.length>1?'s':''}</div>
  <div class="meta-item"><span class="meta-dot" style="background:#10b981"></span>${tagEntries.length} tag${tagEntries.length>1?'s':''} utilisés</div>
  <div class="meta-item">Exporté le ${exportDate}</div>
</div>
${chartSection}
${statPillsHtml}
<div class="table-section">
  <div class="table-title">Journal des notes</div>
  <table><tbody>${rows}</tbody></table>
</div>
<div class="footer">
  <span>NexusVault — Document confidentiel</span>
  <span>${filtered.length} note${filtered.length>1?'s':''} • ${modeLabel}</span>
</div>
<script>window.onload=()=>{window.print()}<\/script>
</body></html>`;

      const blob = new Blob([html], { type: 'text/html' });
      const url  = URL.createObjectURL(blob);
      const win  = window.open(url, '_blank');
      if (!win) setError('Popup bloquée. Autorisez les popups pour ce site.');
      else { setTimeout(() => URL.revokeObjectURL(url), 30000); onClose(); }
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal title="Exporter en PDF" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>{t('activity.cancel')}</button>
        <button className="btn btn-primary" onClick={doExport} disabled={loading}>
          {loading ? 'Génération…' : 'Exporter PDF'}
        </button>
      </>}>
      {error && <Alert type="err">{error}</Alert>}

      <div className="form-group">
        <label className="form-label">Périmètre de l'export</label>
        <div style={{ display: 'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap: 8 }}>
          {[{ k:'month', l:t('activity.month') },{ k:'year', l:t('activity.year_mode') },{ k:'all', l:t('activity.all_years') },{ k:'tag', l:t('activity.by_tag') }].map(({ k, l }) => (
            <button key={k} onClick={() => setMode(k)} style={{
              padding:'7px 8px', fontSize:12, fontWeight: mode===k ? 700 : 500,
              border: `2px solid ${mode===k ? 'var(--acc)' : 'var(--brd)'}`,
              borderRadius:'var(--r)',
              background: mode===k ? 'var(--acc-s)' : 'var(--surf)',
              color: mode===k ? 'var(--acc)' : 'var(--muted)', cursor:'pointer',
              whiteSpace:'nowrap',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {(mode === 'month' || mode === 'year') && (
        <div className="form-row" style={{ marginBottom: mode === 'year' ? 16 : 0 }}>
          <div className="form-group">
            <label className="form-label">{t('activity.year_label') || 'Year'}</label>
            <select className="form-control" value={year} onChange={e => setYear(parseInt(e.target.value))}>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          {mode === 'month' && (
            <div className="form-group">
              <label className="form-label">Mois</label>
              <select className="form-control" value={month} onChange={e => setMonth(parseInt(e.target.value))}>
                {MONTHS.map((m,i) => <option key={i+1} value={i+1}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {mode === 'tag' && (
        <div className="form-group">
          <label className="form-label">Tag</label>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {tags.map(tag => {
              const hex = tag.color; const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
              const sel = filterTag === tag.code;
              return (
                <button key={tag.code} onClick={() => setFilterTag(sel ? '' : tag.code)} style={{
                  padding:'4px 12px', borderRadius:4, cursor:'pointer', fontFamily:'var(--mono)', fontSize:11, fontWeight:700,
                  border: `2px solid ${sel ? hex : 'var(--brd)'}`,
                  background: sel ? `rgba(${r},${g},${b},0.12)` : 'var(--surf2)',
                  color: sel ? hex : 'var(--muted)',
                }}>{tag.code}</button>
              );
            })}
          </div>
          {!filterTag && <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>Aucun tag = tous les tags</div>}
        </div>
      )}

      {/* Options graphique */}
      <div className="form-group" style={{ background:'var(--surf2)', borderRadius:'var(--r)', padding:'10px 12px' }}>
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom: showChart ? 10 : 0 }}>
          <input type="checkbox" checked={showChart} onChange={e=>setShowChart(e.target.checked)}
            style={{ accentColor:'var(--acc)', width:14, height:14 }} />
          <span style={{ fontSize:12, fontWeight:600 }}>{t('activity.include_chart')}</span>
        </label>
        {showChart && (
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {CHART_TYPES.map(ct => (
              <button key={ct.value} onClick={()=>setChartType(ct.value)} style={{
                padding:'4px 10px', fontSize:11, borderRadius:4, cursor:'pointer',
                border: `1.5px solid ${chartType===ct.value ? 'var(--acc)' : 'var(--brd)'}`,
                background: chartType===ct.value ? 'var(--acc-s)' : 'var(--surf)',
                color: chartType===ct.value ? 'var(--acc)' : 'var(--muted)',
                fontWeight: chartType===ct.value ? 600 : 400,
              }}>{ct.label}</button>
            ))}
          </div>
        )}
      </div>

      {targetUserName && (
        <div style={{ fontSize:12, color:'var(--muted)', marginTop:8, padding:'8px 12px', background:'var(--surf2)', borderRadius:'var(--r)' }}>
          Suivi de : <strong>{targetUserName}</strong>
        </div>
      )}
      {(mode === 'month' || mode === 'year') && (
        <div style={{ fontSize:11, color:'var(--muted)', marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:12, height:12 }}>
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          t('activity.chart_included') || 'A TAG distribution chart will be included in the PDF'
        </div>
      )}
    </Modal>
  );
}



// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export default function Activity() {
  const { user } = useAuth();
  const { t } = useI18n();
  const isAdmin = user?.role === 'admin';
  const { can } = usePerms();
  const [filterTag, setFilterTag]   = useState('');
  const [tags, setTags]         = useState([]);
  const [users, setUsers]       = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [years, setYears]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [addModal, setAddModal] = useState(null);
  const [showExport, setShowExport] = useState(false);
  const [customDateEnabled, setCustomDateEnabled] = useState(false);
  // Mémoriser les années ET les mois dépliés pour ne pas perdre l'état après rechargement
  const [openYears,  setOpenYears]  = useState({});
  const [openMonths, setOpenMonths] = useState({}); // clé: "year-month"

  const [activeTile,  setActiveTile]  = useState(null);
  const [olderModal,  setOlderModal]  = useState(false);
  const [yearCounts,  setYearCounts]  = useState({});

  useEffect(() => {
    api.getFeatureFlags().then(f => setCustomDateEnabled(!!f.activity_custom_date)).catch(() => {});
  }, []);

  const canViewAll = isAdmin || can('activity_read');
  const targetUserId = canViewAll && selectedUser ? selectedUser : null;

  const loadYears = useCallback(() => {
    const params = targetUserId ? { user_id: targetUserId } : {};
    setLoading(true);
    api.activityYears(params)
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        const cur = new Date().getFullYear();
        if (!arr.includes(cur)) arr.unshift(cur);
        setYears(arr.sort((a, b) => b - a));
      })
      .catch(() => { setYears([new Date().getFullYear()]); })
      .finally(() => setLoading(false));
  }, [targetUserId]);

  useEffect(() => {
    api.activityTags().then(data => setTags(Array.isArray(data) ? data : [])).catch(() => {});
    if (canViewAll) {
      api.usersForActivity()
        .then(data => setUsers(Array.isArray(data) ? data : []))
        .catch(() => {});
    }
    loadYears();
  }, [isAdmin, canViewAll, loadYears]); // eslint-disable-line

  // Charger le nombre de notes par année
  useEffect(() => {
    if (!years.length) return;
    const params = targetUserId ? { user_id: targetUserId } : {};
    const counts = {};
    Promise.all(years.map(y =>
      api.activityEntries({ ...params, year: y })
        .then(entries => { counts[y] = Array.isArray(entries) ? entries.length : 0; })
        .catch(() => { counts[y] = 0; })
    )).then(() => setYearCounts({...counts}));
  }, [years.join(','), targetUserId]); // eslint-disable-line

  function openAdd(year, month, onSaved) {
    setAddModal({ year, month, onSaved });
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">{t('activity.title')}</div>
          <div className="page-sub">{t('activity.subtitle')}</div>
        </div>
        <div className="page-actions">
          {/* Sélecteur utilisateur (admin) */}
          {canViewAll && users.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, color: 'var(--muted)', flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <select className="form-control" style={{ padding: '5px 8px', fontSize: 12, height: 30, minWidth: 150 }}
                value={selectedUser || ''} onChange={e => setSelectedUser(e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">{t('activity.my_activity')}</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.display_name || u.username}</option>)}
              </select>
            </div>
          )}
          {/* Filtre par tag */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, color: 'var(--muted)', flexShrink: 0 }}>
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
              </svg>
              <select className="form-control" style={{ padding: '5px 8px', fontSize: 12, height: 30, minWidth: 120 }}
                value={filterTag} onChange={e => setFilterTag(e.target.value)}>
                <option value="">{t('activity.all_tags')}</option>
                {tags.map(tag => <option key={tag.code} value={tag.code}>{tag.code} — {tag.label}</option>)}
              </select>
              {filterTag && (
                <button className="btn btn-sm" onClick={() => setFilterTag('')} title="Effacer" style={{ padding: '4px 7px' }}>✕</button>
              )}
            </div>
          )}
          {/* Bouton export PDF */}
          <button className="btn" style={{ borderColor: 'var(--err)', color: 'var(--err)' }} onClick={() => setShowExport(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 18 15 15"/>
            </svg>
            Export PDF
          </button>
          {/* Bouton nouvelle note */}
          {can('activity_write') && (
            <button className="btn" style={{ borderColor: 'var(--acc)', color: 'var(--acc)' }}
              onClick={() => { const now = new Date(); openAdd(now.getFullYear(), now.getMonth() + 1, loadYears); }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Nouvelle note
            </button>
          )}
        </div>
      </div>

      {filterTag && (() => {
        const foundTag = tags.find(x => x.code === filterTag);
        const hex = foundTag?.color || '#066fd1';
        const rgb = `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
        return (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `rgba(${rgb},.1)`, border: `1px solid ${hex}`, borderRadius: 'var(--r)', padding: '5px 14px', fontSize: 12, color: hex, fontWeight: 600 }}>
              <span style={{ fontFamily: 'var(--mono)' }}>{filterTag}</span>
              {foundTag && <span style={{ fontWeight: 400, color: 'var(--muted)', fontFamily: 'var(--font)' }}>{foundTag.label}</span>}
              <button onClick={() => setFilterTag('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: hex, fontSize: 13, lineHeight: 1, padding: '0 2px' }}>✕</button>
            </div>
          </div>
        );
      })()}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spinner /></div>
      ) : years.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--muted)' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ marginBottom: 12, opacity: .3 }}>
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Aucune note pour l'instant</div>
          <div style={{ fontSize: 12 }}>Cliquez sur "Nouvelle note" pour commencer</div>
        </div>
      ) : (() => {
        const curYear = new Date().getFullYear();
        const tileYears = [curYear, curYear-1, curYear-2];
        const olderYears = years.filter(y => y < curYear-2).sort((a,b) => b-a);
        const TILE_COLORS = ['var(--acc)', '#0891b2', 'var(--ok)', 'var(--warn)'];
        const CARD_H = 115;

        return (
          <>
            {/* Grille de tuiles */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
              {tileYears.map((y, idx) => {
                const isActive = activeTile === y;
                const color = TILE_COLORS[idx];
                const subtitles = [t('activity.year_current'), t('activity.year_n1'), 'N-2'];
                return (
                  <div key={y} role="button" tabIndex={0}
                    onClick={() => { if (activeTile !== y) setOpenMonths({}); setActiveTile(isActive ? null : y); }}
                    onKeyDown={e => e.key==='Enter' && (activeTile !== y ? setOpenMonths({}) : null, setActiveTile(isActive ? null : y))}
                    style={{
                      background:'var(--surf)',
                      border: isActive ? `2px solid ${color}` : '1px solid var(--brd)',
                      borderTop: isActive ? `2px solid ${color}` : `3px solid ${color}`,
                      borderRadius:'var(--rl)',
                      padding:'14px 16px',
                      cursor:'pointer', textAlign:'left',
                      height: CARD_H, boxSizing:'border-box',
                      position:'relative', overflow:'hidden',
                      transition:'border .12s',
                      fontFamily:'var(--font)',
                      userSelect:'none',
                    }}>
                    {/* Label ancré en haut à gauche — position absolute comme StatCard */}
                    <div style={{ position:'absolute', top:14, left:16, right:60 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                        <span style={{ color, flexShrink:0 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                          </svg>
                        </span>
                        <span style={{ fontSize:14, color:'var(--txt)', fontWeight:600 }}>{y}</span>
                      </div>
                      <div style={{ fontSize:13, color:'var(--muted)', paddingLeft:20 }}>{subtitles[idx]}</div>
                    </div>
                    {/* Chiffre ancré en bas à droite — identique StatCard Dashboard */}
                    <div style={{ position:'absolute', bottom:10, right:14, lineHeight:1 }}>
                      {yearCounts[y] !== undefined
                        ? <span style={{ fontSize:52, fontWeight:800, color:'white', lineHeight:1 }}>{yearCounts[y]}</span>
                        : <span className="spinner" style={{ width:20, height:20, display:'inline-block' }} />}
                    </div>
                  </div>
                );
              })}

              {/* Tuile t('activity.archives') */}
              {(() => {
                const isArchiveActive = !!(activeTile && !tileYears.includes(activeTile));
                const color = TILE_COLORS[3];
                return (
                  <div role="button" tabIndex={0} onClick={() => olderYears.length > 0 && setOlderModal(true)}
                    style={{
                      background:'var(--surf)',
                      border: isArchiveActive ? `2px solid ${color}` : '1px solid var(--brd)',
                      borderTop: isArchiveActive ? `2px solid ${color}` : `3px solid ${color}`,
                      borderRadius:'var(--rl)',
                      padding:'14px 16px',
                      cursor: olderYears.length > 0 ? 'pointer' : 'default',
                      textAlign:'left', height: CARD_H, boxSizing:'border-box',
                      position:'relative', overflow:'hidden',
                      opacity: olderYears.length === 0 ? 0.5 : 1,
                      transition:'border .12s',
                    }}>
                    <div style={{ position:'absolute', top:14, left:16, right:60 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
                        <span style={{ color, flexShrink:0 }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>
                            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                          </svg>
                        </span>
                        <span style={{ fontSize:14, color:'var(--txt)', fontWeight:600 }}>
                          {isArchiveActive ? activeTile : t('activity.archives')}
                        </span>
                      </div>
                      <div style={{ fontSize:13, color:'var(--muted)', paddingLeft:20 }}>
                        {isArchiveActive ? 'Année archivée' : olderYears.length > 0 ? `${olderYears.length} année(s) disponible(s)` : t('activity.no_archive')}
                      </div>
                    </div>
                    <div style={{ position:'absolute', bottom:10, right:14, lineHeight:1 }}>
                      {olderYears.length > 0
                        ? <span style={{ fontSize:52, fontWeight:800, color:'white', lineHeight:1 }}>
                            {isArchiveActive && yearCounts[activeTile] !== undefined ? yearCounts[activeTile] : olderYears.length}
                          </span>
                        : <span style={{ fontSize:14, color:'var(--muted)' }}>—</span>}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Contenu de la tuile active — key force le remontage au changement d'année */}
            {activeTile && (
              <div style={{ marginBottom: 20 }}>
                <YearSection key={activeTile} year={activeTile} tags={tags} onAdd={openAdd} userId={targetUserId} filterTag={filterTag}
                  isOpenDefault={true}
                  onToggle={() => {}}
                  openMonths={openMonths}
                  onToggleMonth={(mo, isOpen) => setOpenMonths(prev => ({ ...prev, [`${activeTile}-${mo}`]: isOpen }))}
                  customDateEnabled={customDateEnabled}
                  hideHeader={true}
                />
              </div>
            )}

            {/* Modal archives */}
            {olderModal && (
              <Modal title={`${t('activity.archives')} — années précédentes`} onClose={() => setOlderModal(false)}>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {olderYears.length === 0 ? (
                    <div style={{ color:'var(--muted)', fontSize:13 }}>{t('activity.no_archive')}</div>
                  ) : olderYears.map(y => (
                    <button key={y} onClick={() => { setOpenMonths({}); setActiveTile(y); setOlderModal(false); }}
                      style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
                        background:'var(--surf2)', border:'1px solid var(--brd)', borderRadius:'var(--r)',
                        padding:'10px 14px', cursor:'pointer', fontSize:13, color:'var(--txt)', fontWeight:600 }}>
                      <span>{y}</span>
                      <span style={{ fontSize:11, color:'var(--muted)' }}>{yearCounts[y] !== undefined ? `${yearCounts[y]} note(s)` : '→ afficher'}</span>
                    </button>
                  ))}
                </div>
              </Modal>
            )}
          </>
        );
      })()}

      {addModal && (
        <EntryModal
          tags={tags}
          defaultYear={addModal.year}
          defaultMonth={addModal.month}
          customDateEnabled={customDateEnabled}
          onClose={() => setAddModal(null)}
          onSave={() => {
            addModal.onSaved?.();
            setAddModal(null);
          }}
        />
      )}
      {showExport && (
        <ExportModal
          tags={tags}
          userId={targetUserId}
          targetUserName={selectedUser ? users.find(u => u.id === selectedUser)?.display_name || users.find(u => u.id === selectedUser)?.username : null}
          onClose={() => setShowExport(false)}
        />
      )}
    </main>
  );
}
