import { useEffect, useState } from 'react';
import { usePerms } from '../hooks/usePerms.js';
import { useI18n } from '../contexts/I18nContext.jsx';
import AccessDenied from '../components/AccessDenied.jsx';

export default function Scripts() {
  const { can } = usePerms();
  const { t } = useI18n();

  if (!can('automatisation_read')) return <AccessDenied page={t('automatisation.title')} />;

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
          {t('automatisation.desc')}<br/>
          
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
