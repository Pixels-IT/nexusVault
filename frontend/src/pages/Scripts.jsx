import { useEffect, useState } from 'react';
import { usePerms } from '../hooks/usePerms.js';

export default function Scripts() {
  const { can } = usePerms();

  if (!can('scripts_read')) {
    return (
      <main>
        <div className="page-header">
          <div>
            <div className="page-title">Scripts</div>
            <div className="page-sub">Gestion des scripts</div>
          </div>
        </div>
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
            style={{ width: 48, height: 48, margin: '0 auto 16px', display: 'block', opacity: .4 }}>
            <rect x="3" y="11" width="18" height="11" rx="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <div style={{ fontSize: 14, fontWeight: 600 }}>Accès non autorisé</div>
          <div style={{ fontSize: 12, marginTop: 6 }}>Vous n'avez pas la permission de consulter les scripts.</div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="page-header">
        <div>
          <div className="page-title">Scripts</div>
          <div className="page-sub">Gestion des scripts</div>
        </div>
      </div>

      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 20px', gap: 16,
        background: 'var(--surf)', border: '2px dashed var(--brd)',
        borderRadius: 'var(--rl)', marginTop: 8,
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.5"
          style={{ width: 56, height: 56 }}>
          <polyline points="4 17 10 11 4 5"/>
          <line x1="12" y1="19" x2="20" y2="19"/>
        </svg>
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--txt)' }}>
          Module Scripts
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 400 }}>
          Cette fonctionnalité est en cours de développement.<br/>
          Elle permettra de gérer les fichiers de vos scripts dans un lieu sécurisé.
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--warn)',
          background: 'var(--warn-s)', border: '1px solid var(--warn)',
          borderRadius: 4, padding: '3px 10px', letterSpacing: '.4px',
        }}>
          BIENTÔT DISPONIBLE
        </span>
      </div>
    </main>
  );
}
