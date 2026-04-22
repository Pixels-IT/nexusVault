import { useEffect, useState, useCallback } from 'react';
import api from '../api.js';
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
function EntryModal({ tags, entry, defaultYear, defaultMonth, onClose, onSave }) {
  const isEdit = !!entry;
  const now = new Date();
  const [year,  setYear]    = useState(entry?.year  || defaultYear  || now.getFullYear());
  const [month, setMonth]   = useState(entry?.month || defaultMonth || now.getMonth() + 1);
  const [tagCode, setTagCode] = useState(entry?.tag_code || tags[0]?.code || '');
  const [content, setContent] = useState(entry?.content || '');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);

  async function submit() {
    setError('');
    if (!content.trim()) return setError('Le contenu est requis');
    setLoading(true);
    try {
      if (isEdit) await api.updateEntry(entry.id, { tag_code: tagCode, content });
      else        await api.createEntry({ year, month, tag_code: tagCode, content });
      onSave();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <Modal
      title={isEdit ? 'Modifier la note' : 'Ajouter une note'}
      onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={submit} disabled={loading || !tagCode}>
          {loading ? 'Enregistrement…' : isEdit ? 'Modifier' : 'Ajouter'}
        </button>
      </>}
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          {tags.map(t => (
            <button
              key={t.code}
              onClick={() => setTagCode(t.code)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '5px 12px', borderRadius: 4, cursor: 'pointer',
                border: `2px solid ${tagCode === t.code ? t.color : 'var(--brd)'}`,
                background: tagCode === t.code ? `rgba(${parseInt(t.color.slice(1,3),16)},${parseInt(t.color.slice(3,5),16)},${parseInt(t.color.slice(5,7),16)},0.12)` : 'var(--surf2)',
                fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 700,
                color: tagCode === t.code ? t.color : 'var(--muted)',
                transition: 'all .15s',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
              {t.code}
              <span style={{ fontSize: 10, fontWeight: 400, fontFamily: 'var(--font)', color: 'var(--muted)' }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">Description</label>
        <textarea
          className="form-control"
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          placeholder="Ex: Mise à jour des serveurs Windows vers KB5..."
          style={{ resize: 'vertical', fontFamily: 'var(--font)' }}
          autoFocus
        />
      </div>
    </Modal>
  );
}

// ── LIGNE D'ENTRÉE ────────────────────────────────────────────────────────────
function EntryRow({ entry, tags, onEdit, onDelete, canEdit }) {
  const tag = tags.find(t => t.code === entry.tag_code);
  return (
    <div style={{
      display: 'flex', gap: 10, alignItems: 'flex-start',
      padding: '10px 16px', borderBottom: '1px solid var(--brd)',
      transition: 'background .12s',
    }}
    onMouseEnter={e => e.currentTarget.style.background = 'var(--surf2)'}
    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ paddingTop: 2, flexShrink: 0 }}>
        <TagBadge tag={tag} />
      </div>
      <div style={{ flex: 1, fontSize: 13, color: 'var(--txt)', lineHeight: 1.6 }}>
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

  function toggle() {
    if (!open && !loaded) load();
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

  function handleAdd() { onAdd(year, month, () => { load(); }); }

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
          const displayed = filterTag ? entries.filter(e => e.tag_code === filterTag) : entries;
          return displayed.length > 0
            ? <span style={{ fontSize: 11, color: 'var(--muted)' }}>({displayed.length} note{displayed.length > 1 ? 's' : ''})</span>
            : null;
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
          >+ Note</button>
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
function YearSection({ year, tags, onAdd, userId, filterTag }) {
  const [open, setOpen] = useState(false);
  const [yearCount, setYearCount] = useState(null); // total notes de l'année
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  // Charger le total + dépliage automatique conditionnel selon le filtre
  useEffect(() => {
    const params = { year };
    if (userId) params.user_id = userId;
    api.activityEntries(params).then(data => {
      const filtered = filterTag ? data.filter(e => e.tag_code === filterTag) : data;
      setYearCount(filtered.length);
      // Ne déplier automatiquement que si des entrées correspondent
      if (filterTag && filtered.length > 0) setOpen(true);
      if (filterTag && filtered.length === 0) setOpen(false);
    }).catch(() => {});
  }, [year, userId, filterTag]);

  return (
    <div style={{ marginBottom: 10, border: '1px solid var(--brd)', borderRadius: 'var(--rl)', overflow: 'hidden' }}>
      <div
        onClick={() => setOpen(o => !o)}
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

// ── PAGE PRINCIPALE ───────────────────────────────────────────────────────────
export default function Activity() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { can } = usePerms();
  const [filterTag, setFilterTag]   = useState('');
  const [tags, setTags]         = useState([]);
  const [users, setUsers]       = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // null = soi-même
  const [years, setYears]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [addModal, setAddModal] = useState(null); // { year, month, onSaved }

  const targetUserId = isAdmin && selectedUser ? selectedUser : null;

  const loadYears = useCallback(() => {
    const params = targetUserId ? { user_id: targetUserId } : {};
    setLoading(true);
    api.activityYears(params)
      .then(data => {
        // Toujours inclure l'année courante
        const cur = new Date().getFullYear();
        if (!data.includes(cur)) data.unshift(cur);
        setYears(data.sort((a, b) => b - a));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [targetUserId]);

  useEffect(() => {
    api.activityTags().then(setTags).catch(() => {});
    if (isAdmin) api.users().then(setUsers).catch(() => {});
    loadYears();
  }, [isAdmin, loadYears]);

  function openAdd(year, month, onSaved) {
    setAddModal({ year, month, onSaved });
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Suivi d'activité</div>
          <div className="page-sub">Journal chronologique des actions par période</div>
        </div>
        <div className="page-actions">
          {/* Sélecteur utilisateur (admin) */}
          {isAdmin && users.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14, color: 'var(--muted)', flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
              </svg>
              <select className="form-control" style={{ padding: '5px 8px', fontSize: 12, height: 30, minWidth: 150 }}
                value={selectedUser || ''} onChange={e => setSelectedUser(e.target.value ? parseInt(e.target.value) : null)}>
                <option value="">Mon suivi</option>
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
                <option value="">Tous les tags</option>
                {tags.map(t => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
              </select>
              {filterTag && (
                <button className="btn btn-sm" onClick={() => setFilterTag('')} title="Effacer" style={{ padding: '4px 7px' }}>✕</button>
              )}
            </div>
          )}
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
          <YearSection key={y} year={y} tags={tags} onAdd={openAdd} userId={targetUserId} filterTag={filterTag} />
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
    </main>
  );
}
