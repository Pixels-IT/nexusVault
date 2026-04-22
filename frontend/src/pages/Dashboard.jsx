import { useEffect, useState } from 'react';
import api from '../api.js';

function StatCard({ icon, value, label, colorClass }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${colorClass}`}>{icon}</div>
      <div>
        <div className="stat-value">{value ?? '—'}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [backups, setBackups] = useState([]);
  const [devices, setDevices] = useState([]);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
    api.backups().then(setBackups).catch(() => {});
    api.devices().then(setDevices).catch(() => {});
  }, []);

  const statusBadge = (s) => {
    if (s === 'ok') return <span className="badge badge-ok"><span className="dot dot-ok" />OK</span>;
    if (s === 'warn') return <span className="badge badge-warn"><span className="dot dot-warn" />Modifié</span>;
    return <span className="badge badge-err"><span className="dot dot-err" />Écart</span>;
  };

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Tableau de bord</div>
          <div className="page-sub">Vue d'ensemble de votre environnement réseau</div>
        </div>
      </div>

      <div className="stats-grid">
        <StatCard colorClass="ic-b" value={stats?.backups} label="Backups total"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>} />
        <StatCard colorClass="ic-g" value={stats?.devices} label="Équipements"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>} />
        <StatCard colorClass="ic-o" value={stats?.sites} label="Sites"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>} />
        <StatCard colorClass="ic-r" value={stats?.models} label="Modèles"
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></svg>
              Équipements
            </div>
          </div>
          <table>
            <thead><tr><th>Nom</th><th>Site</th><th>Dernier backup</th></tr></thead>
            <tbody>
              {devices.slice(0, 6).map(d => (
                <tr key={d.id}>
                  <td><div className="cell-name">{d.name}</div><div className="cell-sub">{d.vendor} {d.model_name}</div></td>
                  <td><span className="badge badge-info">{d.site_name}</span></td>
                  <td>{d.last_backup ? <span className="cell-sub">v{d.last_backup.version} — {d.last_backup.created_at?.slice(0, 10)}</span> : <span className="badge badge-muted">Aucun</span>}</td>
                </tr>
              ))}
              {devices.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucun équipement</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              Derniers backups
            </div>
          </div>
          <table>
            <thead><tr><th>Équipement</th><th>Version</th><th>Statut</th><th>Date</th></tr></thead>
            <tbody>
              {backups.slice(0, 6).map(b => (
                <tr key={b.id}>
                  <td className="cell-name">{b.device_name}</td>
                  <td><span className="cell-mono">v{b.version}</span></td>
                  <td>{statusBadge(b.status)}</td>
                  <td className="cell-sub">{b.created_at?.slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
              {backups.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: 24 }}>Aucun backup</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
