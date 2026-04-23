import { useState } from 'react';

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:'1px solid var(--brd)' }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)} style={{
          display:'flex', alignItems:'center', gap:6,
          padding:'9px 16px', background:'none', border:'none',
          borderBottom: active===t.key ? '2px solid var(--acc)' : '2px solid transparent',
          color: active===t.key ? 'var(--acc)' : 'var(--muted)',
          fontWeight: active===t.key ? 600 : 500,
          fontSize:13, cursor:'pointer', fontFamily:'var(--font)',
          marginBottom:-1, transition:'color .15s, border-color .15s',
        }}>
          {t.icon} {t.label}
        </button>
      ))}
    </div>
  );
}

function ComingSoonCard({ title, description }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'60px 20px', gap:14, background:'var(--surf)',
      border:'2px dashed var(--brd)', borderRadius:'var(--rl)',
    }}>
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.5" style={{width:48,height:48}}>
        <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      <div style={{fontWeight:700, fontSize:15, color:'var(--txt)'}}>{title}</div>
      <div style={{fontSize:13, color:'var(--muted)', textAlign:'center', maxWidth:420}}>{description}</div>
      <span style={{
        fontSize:11, fontWeight:700, color:'var(--warn)',
        background:'var(--warn-s)', border:'1px solid var(--warn)',
        borderRadius:4, padding:'3px 10px', letterSpacing:'.4px',
      }}>BIENTÔT DISPONIBLE</span>
    </div>
  );
}

/* ── Onglet Tableau de Bord ── */
function TabDashboard() {
  const [tiles, setTiles] = useState([
    { key:'backups',      label:'Backups total',    enabled:true,  section:'backup' },
    { key:'devices',      label:'Équipements',       enabled:true,  section:'backup' },
    { key:'sites',        label:'Sites',             enabled:true,  section:'backup' },
    { key:'models',       label:'Modèles',           enabled:true,  section:'backup' },
    { key:'notes_total',  label:'Notes totales',     enabled:true,  section:'activity' },
    { key:'month',        label:'Mois en cours',     enabled:true,  section:'activity' },
    { key:'year_current', label:'Année courante',    enabled:true,  section:'activity' },
    { key:'year_prev',    label:'Année précédente',  enabled:true,  section:'activity' },
  ]);

  const toggle = key => setTiles(ts => ts.map(t => t.key===key ? {...t, enabled:!t.enabled} : t));

  const backupTiles   = tiles.filter(t => t.section === 'backup');
  const activityTiles = tiles.filter(t => t.section === 'activity');

  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>
      <div className="alert alert-warn" style={{fontSize:12, justifyContent:'center', textAlign:'center'}}>
        La personnalisation des tuiles sera persistée dans votre profil au prochain déploiement.
      </div>

      {/* Section Backups */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Section Backups de configuration
          </div>
        </div>
        <div style={{padding:'14px 18px', display:'flex', flexDirection:'column', gap:10}}>
          {backupTiles.map(t => (
            <label key={t.key} style={{display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'8px 12px', borderRadius:'var(--r)', background: t.enabled ? 'var(--acc-s)' : 'var(--surf2)', border:`1px solid ${t.enabled ? 'var(--acc)' : 'var(--brd)'}`, transition:'all .15s'}}>
              <input type="checkbox" checked={t.enabled} onChange={() => toggle(t.key)} style={{width:15, height:15, cursor:'pointer', accentColor:'var(--acc)'}}/>
              <span style={{fontSize:13, fontWeight: t.enabled ? 600 : 400, color: t.enabled ? 'var(--txt)' : 'var(--muted)', flex:1}}>{t.label}</span>
              {!t.enabled && <span style={{fontSize:10, color:'var(--muted)', fontStyle:'italic'}}>masquée</span>}
            </label>
          ))}
        </div>
      </div>

      {/* Section Activité */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Section Suivi d'activité
          </div>
        </div>
        <div style={{padding:'14px 18px', display:'flex', flexDirection:'column', gap:10}}>
          {activityTiles.map(t => (
            <label key={t.key} style={{display:'flex', alignItems:'center', gap:12, cursor:'pointer', padding:'8px 12px', borderRadius:'var(--r)', background: t.enabled ? 'var(--acc-s)' : 'var(--surf2)', border:`1px solid ${t.enabled ? 'var(--acc)' : 'var(--brd)'}`, transition:'all .15s'}}>
              <input type="checkbox" checked={t.enabled} onChange={() => toggle(t.key)} style={{width:15, height:15, cursor:'pointer', accentColor:'var(--acc)'}}/>
              <span style={{fontSize:13, fontWeight: t.enabled ? 600 : 400, color: t.enabled ? 'var(--txt)' : 'var(--muted)', flex:1}}>{t.label}</span>
              {!t.enabled && <span style={{fontSize:10, color:'var(--muted)', fontStyle:'italic'}}>masquée</span>}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Onglet Backup ── */
function TabBackup() {
  return (
    <ComingSoonCard
      title="Personnalisation de la page Backup"
      description="Vous pourrez ici configurer les colonnes affichées, le comportement par défaut, les filtres automatiques et l'organisation de la vue hiérarchique."
    />
  );
}

/* ── Onglet Scripts ── */
function TabScripts() {
  return (
    <ComingSoonCard
      title="Personnalisation de la page Scripts"
      description="Vous pourrez ici définir les éditeurs préférés, les types de fichiers acceptés, les répertoires par défaut et les options d'exécution."
    />
  );
}

/* ── Onglet Suivi d'activité ── */
function TabActivity() {
  const [prefs, setPrefs] = useState({
    defaultExpanded: false,
    showPreviewCount: true,
    pdfHeader: true,
    autoLoadMonths: true,
  });

  const toggle = key => setPrefs(p => ({...p, [key]: !p[key]}));

  const options = [
    { key:'defaultExpanded',  label:"Déplier l'année en cours automatiquement",      desc:'Au chargement de la page, l\'année en cours est dépliée par défaut' },
    { key:'showPreviewCount', label:'Afficher le compteur PRV dans les mois',          desc:'Compte les notes preview séparément : "(3 notes + 1 PRV)"' },
    { key:'pdfHeader',        label:'Inclure un en-tête dans les exports PDF',         desc:'Ajoute le logo et la date en haut de chaque export' },
    { key:'autoLoadMonths',   label:'Charger les mois automatiquement à l\'ouverture', desc:'Pré-charge les entrées pour afficher le compteur sans clic' },
  ];

  return (
    <div style={{display:'flex', flexDirection:'column', gap:16}}>
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15}}>
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            Préférences d'affichage
          </div>
        </div>
        <div style={{padding:'14px 18px', display:'flex', flexDirection:'column', gap:10}}>
          {options.map(opt => (
            <label key={opt.key} style={{display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer', padding:'10px 12px', borderRadius:'var(--r)', background: prefs[opt.key] ? 'var(--acc-s)' : 'var(--surf2)', border:`1px solid ${prefs[opt.key] ? 'var(--acc)' : 'var(--brd)'}`, transition:'all .15s'}}>
              <input type="checkbox" checked={prefs[opt.key]} onChange={() => toggle(opt.key)} style={{width:15, height:15, cursor:'pointer', marginTop:2, accentColor:'var(--acc)'}}/>
              <div>
                <div style={{fontSize:13, fontWeight:600, color:'var(--txt)'}}>{opt.label}</div>
                <div style={{fontSize:11, color:'var(--muted)', marginTop:2}}>{opt.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div className="alert alert-warn" style={{fontSize:12}}>
        Ces préférences seront sauvegardées dans votre profil lors du prochain déploiement.
      </div>
    </div>
  );
}

/* ── Composant principal ── */
export default function Personnalisation({ embedded = false }) {
  const [activeTab, setActiveTab] = useState('dashboard');

  const sv = d => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}>{d}</svg>;
  const TABS = [
    { key:'dashboard', label:'Tableau de bord', icon: sv(<><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>) },
    { key:'backup',    label:'Backup',          icon: sv(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>) },
    { key:'scripts',   label:'Scripts',         icon: sv(<><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>) },
    { key:'activity',  label:"Suivi d'activité", icon: sv(<><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/></>) },
  ];

  const inner = (
    <>
      {!embedded && (
        <div className="page-header">
          <div>
            <div className="page-title">Personnalisation</div>
            <div className="page-sub">Configurez l'affichage et le comportement de chaque section</div>
          </div>
        </div>
      )}
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      {activeTab === 'dashboard' && <TabDashboard />}
      {activeTab === 'backup'    && <TabBackup />}
      {activeTab === 'scripts'   && <TabScripts />}
      {activeTab === 'activity'  && <TabActivity />}
    </>
  );

  if (embedded) return <div>{inner}</div>;

  return <main>{inner}</main>;
}
