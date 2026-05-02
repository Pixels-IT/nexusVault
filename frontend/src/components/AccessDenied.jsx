// Composant page "Accès non autorisé" — style cohérent avec Scripts.jsx placeholder

export default function AccessDenied({ page = '' }) {
  return (
    <main>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '80px 20px', gap: 16,
        background: 'var(--surf)', border: '2px dashed var(--brd)',
        borderRadius: 'var(--rl)', marginTop: 8,
      }}>
        {/* Icône cadenas */}
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--warn)" strokeWidth="1.5"
          style={{ width: 56, height: 56 }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>

        {/* Titre */}
        <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--txt)' }}>
          {page ? `Module ${page}` : 'Module'}
        </div>

        {/* Description */}
        <div style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
          Vous n'avez pas accès à cette section.<br/>
          Contactez votre administrateur pour obtenir les droits nécessaires.
        </div>

        {/* Badge ACCÈS NON AUTORISÉ — style identique au badge BIENTÔT DISPONIBLE */}
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--warn)',
          background: 'var(--warn-s)', border: '1px solid var(--warn)',
          borderRadius: 4, padding: '3px 10px', letterSpacing: '.4px',
        }}>
          ACCÈS NON AUTORISÉ
        </span>
      </div>
    </main>
  );
}
