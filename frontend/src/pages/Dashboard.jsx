import { useI18n } from '../contexts/I18nContext.jsx';
import { useEffect, useState } from 'react';
import api from '../api.js';

const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

const CARD_H = 115;

/* ── Tuile simple : titre haut-gauche, chiffre en position absolue bas-droite ── */
function StatCard({ icon, label, sub, value, color }) {
  return (
    <div style={{
      background: 'var(--surf)', border: '1px solid var(--brd)', borderRadius: 'var(--rl)',
      borderTop: `3px solid ${color}`,
      padding: '14px 16px',
      height: CARD_H,
      boxSizing: 'border-box',
      position: 'relative',   /* ← ancrage pour position absolute */
      overflow: 'hidden',
    }}>
      {/* Titre + sous-titre, toujours en haut */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: sub ? 2 : 0 }}>
          <span style={{ color, flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: 14, color: 'var(--txt)', fontWeight: 600 }}>{label}</span>
        </div>
        {sub && <div style={{ fontSize: 13, color: 'var(--muted)', paddingLeft: 22 }}>{sub}</div>}
      </div>
      {/* Chiffre ancré en bas à droite — TOUJOURS à la même hauteur */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 14,
        lineHeight: 1,
      }}>
        {value != null
          ? <span style={{ fontSize: 52, fontWeight: 800, color: 'white', lineHeight: 1 }}>{value}</span>
          : <span className="spinner" style={{ width: 20, height: 20, display: 'inline-block' }} />}
      </div>
    </div>
  );
}

/* ── Tuile TOP3 : titre haut, TOP3 + chiffre ancrés en bas via position absolute ──
   Structure :
   ┌─────────────────────────────────────────┐
   │ icon  Année 2026            (haut)      │
   │       nombre de notes                   │
   │                                         │
   │  TOP 3           │        10  (bas abs) │
   │  1. MAIL  2      │                      │
   │  2. BACKUP 1     │                      │
   │  3. AV  1        │                      │
   └─────────────────────────────────────────┘
*/
function Top3Card({ icon, label, sub, value, color, top3, tags }) {
  const getColor = code => (tags || []).find(tag => tag.code === code)?.color || '#066fd1';
  return (
    <div style={{
      background: 'var(--surf)', border: '1px solid var(--brd)', borderRadius: 'var(--rl)',
      borderTop: `3px solid ${color}`,
      padding: '14px 16px',
      height: CARD_H,
      boxSizing: 'border-box',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Titre + sous-titre en haut */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: sub ? 2 : 0 }}>
          <span style={{ color, flexShrink: 0 }}>{icon}</span>
          <span style={{ fontSize: 14, color: 'var(--txt)', fontWeight: 600 }}>{label}</span>
        </div>
        {sub && <div style={{ fontSize: 13, color: 'var(--muted)', paddingLeft: 22 }}>{sub}</div>}
      </div>

      {/* Séparateur + TOP3 : uniquement si total notes >= 3 */}
      {(() => {
        const total = top3 ? top3.reduce((s, t) => s + t.cnt, 0) : 0;
        if (total < 3 || !top3 || top3.length === 0) return null;
        return (
          <>
            {/* Séparateur vertical */}
            <div style={{
              position: 'absolute', bottom: 10, right: 120,
              width: 1, height: 58,
              background: 'rgba(255,255,255,0.18)',
            }} />
            {/* TOP3 aligné à droite dans sa zone */}
            <div style={{
              position: 'absolute', bottom: 10, left: 16, right: 128,
              textAlign: 'right',
            }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', letterSpacing: '.5px', textTransform: 'uppercase', marginBottom: 3 }}>TOP 3</div>
              {top3.map((t) => (
                <div key={t.tag_code} style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginBottom: 2 }}>
                  <span style={{
                    display: 'inline-block', padding: '1px 5px', borderRadius: 3,
                    fontSize: 9, fontWeight: 700, fontFamily: 'var(--mono)', flexShrink: 0,
                    background: `${getColor(t.tag_code)}22`,
                    color: getColor(t.tag_code),
                    border: `1px solid ${getColor(t.tag_code)}55`,
                  }}>{t.tag_code}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)', flexShrink: 0 }}>{t.cnt}</span>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* Calque absolu bas-droite : chiffre — même position que StatCard */}
      <div style={{
        position: 'absolute',
        bottom: 10,
        right: 14,
        lineHeight: 1,
      }}>
        {value != null
          ? <span style={{ fontSize: 52, fontWeight: 800, color: 'white', lineHeight: 1 }}>{value}</span>
          : <span className="spinner" style={{ width: 20, height: 20, display: 'inline-block' }} />}
      </div>
    </div>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: 28 }}>
      <span style={{ color: 'var(--acc)' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--txt)' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'var(--brd)', marginLeft: 4 }} />
    </div>
  );
}

export default function Dashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState(null);
  const [tags,  setTags]  = useState([]);
  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    api.activityTags().then(d => setTags(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const act      = stats?.activity;
  const curYear  = act?.cur_year  || new Date().getFullYear();
  const prevYear = act?.prev_year || curYear - 1;
  const curMonth = act?.cur_month || new Date().getMonth() + 1;

  const sv = d => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}>{d}</svg>;
  const icons = {
    backup: sv(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>),
    device: sv(<><rect x="2" y="7" width="20" height="10" rx="2"/><circle cx="7" cy="12" r="1" fill="currentColor"/></>),
    site:   sv(<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>),
    model:  sv(<><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>),
    note:   sv(<><path d="M14 2H6a2 2 0 0 0-2 2v16h16V8z"/><polyline points="14 2 14 8 20 8"/></>),
    cal:    sv(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/></>),
    trend:  sv(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>),
    prev:   sv(<><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></>),
  };

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Tableau de bord</div>
          <div className="page-sub">{t('dash.subtitle')}</div>
        </div>
      </div>

      <SectionTitle icon={icons.backup}>{t('dash.backups')}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>
        <StatCard icon={icons.backup} label="Backups total" value={stats?.backups} color="var(--acc)"  />
        <StatCard icon={icons.device} label={t('dash.devices')}   value={stats?.devices} color="#0891b2"     />
        <StatCard icon={icons.site}   label={t('dash.sites')}         value={stats?.sites}   color="var(--ok)"   />
        <StatCard icon={icons.model}  label={t('dash.models')}       value={stats?.models}  color="var(--warn)" />
      </div>

      <SectionTitle icon={icons.backup}>{t('dash.automation')}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 28 }}>

        {/* Tuile 1 — Nombre total de documents */}
        <StatCard icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          label={t('dash.auto_total')} value={stats?.automation?.total ?? '—'} color="#a855f7" />

        {/* Tuile 2 — 3 derniers documents */}
        <div className="stat-card" style={{ height: CARD_H, boxSizing:'border-box', background:'var(--surf)', border:'1px solid var(--brd)', borderTop:'3px solid #a855f7', borderRadius:'var(--rl)', padding:'14px 16px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:14, left:16, right:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <span style={{ color:'#a855f7' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--txt)' }}>{t('dash.auto_recent')}</span>
            </div>
            {stats?.automation?.recent?.length > 0
              ? stats.automation.recent.map((d,i) => (
                  <div key={i} style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', gap:6, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    <span style={{ width:6, height:6, borderRadius:'50%', background:d.cat_color||'#a855f7', flexShrink:0, display:'inline-block' }}/>
                    <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</span>
                  </div>
                ))
              : <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{t('dash.auto_no_docs')}</div>
            }
          </div>
        </div>

        {/* Tuile 3 — Top 3 catégories */}
        <div className="stat-card" style={{ height: CARD_H, boxSizing:'border-box', background:'var(--surf)', border:'1px solid var(--brd)', borderTop:'3px solid #a855f7', borderRadius:'var(--rl)', padding:'14px 16px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:14, left:16, right:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <span style={{ color:'#a855f7' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </span>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--txt)' }}>{t('dash.auto_top_cats')}</span>
            </div>
            {stats?.automation?.top3cats?.length > 0
              ? stats.automation.top3cats.map((c,i) => (
                  <div key={i} style={{ fontSize:11, color:'var(--muted)', display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:2 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, overflow:'hidden' }}>
                      <span style={{ width:6, height:6, borderRadius:'50%', background:c.color||'#a855f7', flexShrink:0, display:'inline-block' }}/>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.name}</span>
                    </div>
                    <span style={{ fontWeight:700, color:c.color||'#a855f7', marginLeft:8, flexShrink:0 }}>{c.doc_count}</span>
                  </div>
                ))
              : <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{t('dash.auto_no_data')}</div>
            }
          </div>
        </div>

        {/* Tuile 4 — Prochaines expirations */}
        <div className="stat-card" style={{ height: CARD_H, boxSizing:'border-box', background:'var(--surf)', border:'1px solid var(--brd)', borderTop:'3px solid #a855f7', borderRadius:'var(--rl)', padding:'14px 16px', position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:14, left:16, right:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
              <span style={{ color: stats?.automation?.expiring?.length > 0 ? 'var(--warn)' : '#a855f7' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></svg>
              </span>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--txt)' }}>{t('dash.auto_expiring')}</span>
            </div>
            {stats?.automation?.expiring?.length > 0
              ? stats.automation.expiring.map((d,i) => {
                  const daysLeft = Math.ceil((new Date(d.valid_until) - new Date()) / 86400000);
                  const color = daysLeft <= 7 ? 'var(--err)' : daysLeft <= 30 ? 'var(--warn)' : 'var(--muted)';
                  return (
                    <div key={i} style={{ fontSize:11, color, display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:2 }}>
                      <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{d.name}</span>
                      <span style={{ fontWeight:600, marginLeft:6, flexShrink:0 }}>{d.valid_until}</span>
                    </div>
                  );
                })
              : <div style={{ fontSize:11, color:'var(--ok)', marginTop:4, fontWeight:600 }}>{t('dash.auto_no_expiry')}</div>
            }
          </div>
        </div>

      </div>

      <SectionTitle icon={icons.cal}>{t('dash.activity')}</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard  icon={icons.note}  label={t('dash.notes_total')}        sub="toutes périodes" value={act?.total           ?? null} color="var(--acc)"  />
        <StatCard  icon={icons.cal}   label={MONTHS_FR[curMonth-1]} sub={t('dash.note_count')} value={act?.month           ?? null} color="var(--ok)"   />
        <Top3Card  icon={icons.trend} label={`Année ${curYear}`}    sub={t('dash.note_count')} value={act?.year            ?? null} color="var(--warn)" top3={act?.top3_cur}  tags={tags} />
        <Top3Card  icon={icons.prev}  label={`Année ${prevYear}`}   sub={t('dash.note_count')} value={act?.prev_year_count ?? null} color="#677489"     top3={act?.top3_prev} tags={tags} />
      </div>
    </main>
  );
}
