import { useI18n } from '../contexts/I18nContext.jsx';

export default function Personnalisation() {
  const { t } = useI18n();
  return (
    <main className="page-main">
      <div className="page-header">
        <h1 className="page-title">{t('admin.personalisation') || 'Customization'}</h1>
      </div>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: 320, gap: 16,
        background: 'var(--surf)', borderRadius: 'var(--rl)',
        border: '1px solid var(--brd)', padding: 40,
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--acc)" strokeWidth="1.5"
          style={{ width: 56, height: 56, opacity: 0.7 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 17l10 5 10-5"/>
          <path d="M2 12l10 5 10-5"/>
        </svg>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>
          🚧 {t('common.coming_soon') || 'Coming soon'}
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 400 }}>
          {t('common.under_construction') || 'This feature is currently under development.'}
        </div>
      </div>
    </main>
  );
}
