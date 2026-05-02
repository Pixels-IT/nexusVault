import { useEffect, useState, useCallback } from 'react';
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
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api.activityEntryHistory(entryId)
      .then(d => setHistory(Array.isArray(d) ? d : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [entryId]);

  const EVT_LABELS = { created: 'Création', updated: 'Modification', tag_changed: 'Tag modifié', preview_changed: 'Preview' };

  return (
    <Modal title="Historique de la note" onClose={onClose}
      footer={<button className="btn" onClick={onClose}>Fermer</button>}>
      {loading ? <div style={{ textAlign:'center', padding:24 }}><span className="spinner"/></div> : (
        history.length === 0 ? (
          <div style={{ textAlign:'center', color:'var(--muted)', padding:24, fontSize:12 }}>Aucun historique disponible</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
            {history.map((h, i) => (
              <div key={h.id} style={{
                display:'flex', gap:12, padding:'10px 4px',
                borderBottom: i < history.length-1 ? '1px solid var(--brd)' : 'none',
              }}>
                <div style={{ flexShrink:0, display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
                  <div style={{ width:8, height:8, borderRadius:'50%', background: h.event_type==='created' ? 'var(--ok)' : 'var(--acc)', marginTop:4 }}/>
                  {i < history.length-1 && <div style={{ width:1, flex:1, background:'var(--brd)' }}/>}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:2 }}>
                    <span style={{ fontSize:11, fontWeight:700, color: h.event_type==='created' ? 'var(--ok)' : 'var(--acc)' }}>
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

function EntryModal({ tags, entry, defaultYear, defaultMonth, onClose, onSave }) {
  const { t } = useI18n();
  const isEdit = !!entry;
  const now = new Date();
  const [year,      setYear]     = useState(entry?.year  || defaultYear  || now.getFullYear());
  const [month,     setMonth]    = useState(entry?.month || defaultMonth || now.getMonth() + 1);
  const [tagCode,   setTagCode]  = useState(entry?.tag_code || '');  // pas de pré-sélection
  const [content,   setContent]  = useState(entry?.content || '');
  const [isPreview, setIsPreview] = useState(entry?.is_preview ? true : false);
  const [tagError,  setTagError]  = useState(false);
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  // Auto-preview si mois futur
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
      if (isEdit) await api.updateEntry(entry.id, { tag_code: tagCode, content, is_preview: preview });
      else        await api.createEntry({ year, month, tag_code: tagCode, content, is_preview: preview });
      onSave();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <>
    <Modal
      title={<div style={{display:'flex',alignItems:'center',gap:10,width:'100%'}}>
        <span>{isEdit ? 'Modifier la note' : 'Ajouter une note'}</span>
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
      footer={
        <div style={{ display:'flex', justifyContent:'flex-end', gap:8, width:'100%' }}>
          <button className="btn" onClick={onClose}>{t('activity.cancel')}</button>
          <button className="btn btn-primary" onClick={submit} disabled={loading || !tagCode}>
            {loading ? 'Enregistrement…' : isEdit ? 'Modifier' : 'Ajouter'}
          </button>
        </div>
      }
    >
      {error && <Alert type="err">{error}</Alert>}
      {!isEdit && (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Année</label>
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
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:6 }}>
          {tags.map(t => (
            <button key={t.code} onClick={() => { setTagCode(t.code); setTagError(false); }} style={{
              display:'inline-flex', alignItems:'center', gap:6,
              padding:'5px 12px', borderRadius:4, cursor:'pointer',
              border: `2px solid ${tagCode===t.code ? t.color : 'var(--brd)'}`,
              background: tagCode===t.code ? `rgba(${parseInt(t.color.slice(1,3),16)},${parseInt(t.color.slice(3,5),16)},${parseInt(t.color.slice(5,7),16)},0.12)` : 'var(--surf2)',
              fontFamily:'var(--mono)', fontSize:11, fontWeight:700,
              color: tagCode===t.code ? t.color : 'var(--muted)',
            }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:t.color, flexShrink:0 }}/>
              {t.code}
              <span style={{ fontSize:10, fontWeight:400, fontFamily:'var(--font)', color:'var(--muted)' }}>{t.label}</span>
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
        <label className="form-label">Description</label>
        <textarea className="form-control" value={content} onChange={e => setContent(e.target.value)}
          rows={4} placeholder="Ex: Mise à jour des serveurs Windows vers KB5..."
          style={{ resize:'vertical', fontFamily:'var(--font)' }} autoFocus />
      </div>
      {/* Checkbox preview — visible seulement si pas auto-futur */}
      {!isFutureMonth() && (
        <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4, padding:'8px 0', borderTop:'1px solid var(--brd)' }}>
          <input type="checkbox" id="preview-check" checked={isPreview}
            onChange={e => setIsPreview(e.target.checked)}
            style={{ width:14, height:14, cursor:'pointer' }} />
          <label htmlFor="preview-check" style={{ fontSize:12, color:'var(--muted)', cursor:'pointer', userSelect:'none' }}>
            Note en avant-première (preview) — ne compte pas dans les statistiques
          </label>
        </div>
      )}
      {isFutureMonth() && (
        <div style={{ fontSize:11, color:'var(--warn)', marginTop:6, display:'flex', alignItems:'center', gap:6 }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width:12, height:12 }}>
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Mois futur — marqué automatiquement en preview
        </div>
      )}
    </Modal>
    {showHistory && isEdit && <HistoryModal entryId={entry.id} onClose={() => setShowHistory(false)} />}
    </>
  );
}

// ── LIGNE D'ENTRÉE ────────────────────────────────────────────────────────────
function EntryRow({ entry, tags, onEdit, onDelete, canEdit }) {
  const tag = tags.find(t => t.code === entry.tag_code);
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
          {entry.created_at && (
            <span style={{ fontSize:11, color:'rgba(247,103,7,0.7)', whiteSpace:'nowrap' }}>
              {(entry.created_at||'').slice(8,10)}/{(entry.created_at||'').slice(5,7)}
            </span>
          )}
          <span style={{ color:'rgba(247,103,7,0.5)', fontSize:11 }}>—</span>
        </div>
        <div style={{ flex: 1, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, fontStyle: 'italic', alignSelf:'center' }}>
          {entry.content}
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 4, flexShrink: 0, marginTop: 2 }}>
            <button className="btn btn-sm" onClick={() => onEdit(entry)}>Édit.</button>
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
        {entry.created_at && (
          <span style={{ fontSize:11, color:'var(--muted)', whiteSpace:'nowrap' }}>
            {(entry.created_at||'').slice(8,10)}/{(entry.created_at||'').slice(5,7)}
          </span>
        )}
        <span style={{ color:'var(--muted)', fontSize:11 }}>—</span>
      </div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--txt)', lineHeight: 1.6, alignSelf:'center' }}>
        {entry.content}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          <button className="btn btn-sm" onClick={() => onEdit(entry)}>Édit.</button>
          <button className="btn btn-sm btn-danger" onClick={() => onDelete(entry)}>✕</button>
        </div>
      )}
    </div>
  );
}

// ── MOIS SECTION ──────────────────────────────────────────────────────────────
function MonthSection({ year, month, tags, onAdd, userId, filterTag }) {
    const { t } = useI18n();
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [loaded, setLoaded]     = useState(false);
  const [open, setOpen]         = useState(false);
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
    setOpen(o => !o);
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
              const t = tags.find(x => x.code === code);
              return t ? <TagBadge key={code} tag={t} size="small" /> : null;
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
        <EntryModal tags={tags} entry={editEntry} onClose={() => setEditEntry(null)}
          onSave={() => { setEditEntry(null); load(); }} />
      )}
      {delEntry && (
        <ConfirmModal
          message={`Supprimer cette note [${delEntry.tag_code}] ?`}
          onConfirm={handleDelete}
          onCancel={() => setDelEntry(null)}
        />
      )}
    </div>
  );
}

// ── ANNÉE SECTION ─────────────────────────────────────────────────────────────
function YearSection({ year, tags, onAdd, userId, filterTag, isOpenDefault, onToggle }) {
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

      {open && (
        <div>
          {months.map(m => (
            <MonthSection key={m} year={year} month={m} tags={tags} onAdd={onAdd} userId={userId} filterTag={filterTag} />
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

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  async function doExport() {
    setLoading(true); setError('');
    try {
      const params = {};
      if (userId) params.user_id = userId;
      if (mode === 'month' || mode === 'year') params.year = year;
      if (mode === 'month') params.month = month;

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
      tags.forEach(t => { tagColors[t.code] = t.color; });

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
      const modeLabel = mode === 'month' ? `${MONTHS[month-1]} ${year}` : mode === 'year' ? `Année ${year}` : `Tag ${filterTag || 'tous'}`;
      const exportDate = new Date().toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric', hour:'2-digit', minute:'2-digit' });

      // Lignes du tableau
      let rows = '';
      Object.keys(grouped).sort((a,b)=>b-a).forEach(yr => {
        rows += `<tr class="yr-row"><td colspan="2">${yr}</td></tr>`;
        Object.keys(grouped[yr]).sort().forEach(mo => {
          rows += `<tr class="mo-row"><td colspan="2">${MONTHS[parseInt(mo)-1]}</td></tr>`;
          grouped[yr][mo].forEach(e => {
            const col = tagColors[e.tag_code] || '#066fd1';
            const r = parseInt(col.slice(1,3),16), g=parseInt(col.slice(3,5),16), b=parseInt(col.slice(5,7),16);
            rows += `<tr>
              <td style="width:80px;padding:5px 8px;vertical-align:top;">
                <span style="display:inline-block;background:rgba(${r},${g},${b},0.1);color:${col};border:1px solid ${col};padding:2px 6px;border-radius:4px;font-size:9px;font-weight:700;font-family:monospace">${e.tag_code}</span>
              </td>
              <td style="padding:5px 8px;font-size:11px;line-height:1.6;color:#1e293b">${e.content.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</td>
            </tr>`;
          });
        });
      });

      // Camembert (seulement si mode = mois ou année)
      let chartSection = '';
      if ((mode === 'month' || mode === 'year') && tagEntries.length > 0) {
        const { svgPie, svgLegend } = buildPieChart(tagEntries, tagColors);
        chartSection = `
          <div class="chart-block">
            <h3 class="chart-title">Répartition par TAG</h3>
            <div class="chart-inner">
              <div class="pie-wrap">${svgPie}</div>
              <div class="legend-wrap">${svgLegend}</div>
            </div>
            <div class="stat-pills">
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
      }

      const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>NexusVault — Suivi ${who} — ${modeLabel}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;font-size:12px;color:#1e293b;background:#fff}
.header{background:linear-gradient(135deg,#0d47a1 0%,#1976d2 50%,#26c6da 100%);padding:28px 32px;display:flex;justify-content:space-between;align-items:center}
.header-logo{color:white;font-size:22px;font-weight:800;letter-spacing:1px}
.header-logo span{opacity:.7}
.header-right{text-align:right;color:rgba(255,255,255,.85);font-size:11px}
.header-right .scope{font-size:15px;font-weight:700;color:white;margin-bottom:4px}
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
  <div class="header-logo">NEXUS<span>VAULT</span></div>
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
        <div style={{ display: 'flex', gap: 8 }}>
          {[{ k:'month', l:'Par mois' },{ k:'year', l:'Par année' },{ k:'tag', l:'Par tag' }].map(({ k, l }) => (
            <button key={k} onClick={() => setMode(k)} style={{
              flex:1, padding:'7px 12px', fontSize:12, fontWeight: mode===k ? 700 : 500,
              border: `2px solid ${mode===k ? 'var(--acc)' : 'var(--brd)'}`,
              borderRadius:'var(--r)',
              background: mode===k ? 'var(--acc-s)' : 'var(--surf)',
              color: mode===k ? 'var(--acc)' : 'var(--muted)', cursor:'pointer',
            }}>{l}</button>
          ))}
        </div>
      </div>

      {(mode === 'month' || mode === 'year') && (
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Année</label>
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
            {tags.map(t => {
              const hex = t.color; const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16);
              const sel = filterTag === t.code;
              return (
                <button key={t.code} onClick={() => setFilterTag(sel ? '' : t.code)} style={{
                  padding:'4px 12px', borderRadius:4, cursor:'pointer', fontFamily:'var(--mono)', fontSize:11, fontWeight:700,
                  border: `2px solid ${sel ? hex : 'var(--brd)'}`,
                  background: sel ? `rgba(${r},${g},${b},0.12)` : 'var(--surf2)',
                  color: sel ? hex : 'var(--muted)',
                }}>{t.code}</button>
              );
            })}
          </div>
          {!filterTag && <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>Aucun tag = tous les tags</div>}
        </div>
      )}

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
          Un graphique de répartition par TAG sera inclus dans le PDF
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
  const [selectedUser, setSelectedUser] = useState(null); // null = soi-même
  const [years, setYears]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [addModal, setAddModal] = useState(null); // { year, month, onSaved }
  const [showExport, setShowExport] = useState(false);
  // Persister l'état ouvert/fermé des années (clé = year)
  const [openYears, setOpenYears] = useState({});

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
                {tags.map(t => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
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
        const t = tags.find(x => x.code === filterTag);
        const hex = t?.color || '#066fd1';
        const rgb = `${parseInt(hex.slice(1,3),16)},${parseInt(hex.slice(3,5),16)},${parseInt(hex.slice(5,7),16)}`;
        return (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: `rgba(${rgb},.1)`, border: `1px solid ${hex}`, borderRadius: 'var(--r)', padding: '5px 14px', fontSize: 12, color: hex, fontWeight: 600 }}>
              <span style={{ fontFamily: 'var(--mono)' }}>{filterTag}</span>
              {t && <span style={{ fontWeight: 400, color: 'var(--muted)', fontFamily: 'var(--font)' }}>{t.label}</span>}
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
      ) : (
        years.map(y => (
          <YearSection key={y} year={y} tags={tags} onAdd={openAdd} userId={targetUserId} filterTag={filterTag}
            isOpenDefault={!!openYears[y]}
            onToggle={isOpen => setOpenYears(prev => ({ ...prev, [y]: isOpen }))}
          />
        ))
      )}

      {addModal && (
        <EntryModal
          tags={tags}
          defaultYear={addModal.year}
          defaultMonth={addModal.month}
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
