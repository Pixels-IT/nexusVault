import { useState, useRef, useEffect } from 'react';
import { useI18n } from '../contexts/I18nContext.jsx';
import { FLAGS } from '../i18n/flags.js';

function FlagImg({ code, size = 20 }) {
  const src = FLAGS[code];
  if (!src) return <span style={{ width: size, height: size * 0.75, display:'inline-block', background:'var(--surf2)', borderRadius:1 }}/>;
  return (
    <img src={src} alt={code} width={size} height={Math.round(size * 0.75)}
      style={{ display:'block', flexShrink:0, borderRadius:1, objectFit:'cover',
        border:'1px solid rgba(255,255,255,0.15)' }} />
  );
}

export default function LangSwitcher() {
  const { lang, changeLang, LANGUAGES } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    const fn = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  function handleChange(code) {
    changeLang(code);
    setOpen(false);
    setTimeout(() => window.location.reload(), 50);
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={() => setOpen(o => !o)} title={`${current.label} — Changer la langue`}
        style={{ background:'none', border:'1px solid var(--brd)', borderRadius:'var(--r)',
          cursor:'pointer', padding:'3px 7px', display:'flex', alignItems:'center',
          gap:5, color:'var(--txt)', transition:'background .15s', height:30 }}
        onMouseEnter={e => e.currentTarget.style.background='var(--surf2)'}
        onMouseLeave={e => e.currentTarget.style.background='none'}>
        <FlagImg code={current.code} size={22} />
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          style={{ width:9, height:9, color:'var(--muted)', flexShrink:0,
            transition:'transform .15s', transform: open ? 'rotate(180deg)':'none' }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', right:0,
          background:'var(--surf)', border:'1px solid var(--brd)', borderRadius:'var(--rl)',
          boxShadow:'0 8px 32px rgba(0,0,0,.4)', minWidth:200, zIndex:2000,
          overflow:'hidden', maxHeight:'80vh', overflowY:'auto' }}>
          <div style={{ padding:'8px 14px', fontSize:10, fontWeight:700, color:'var(--muted)',
            textTransform:'uppercase', letterSpacing:'.6px',
            borderBottom:'1px solid var(--brd)', background:'var(--surf2)' }}>
            Language / Langue
          </div>
          {LANGUAGES.map(l => {
            const isActive = l.code === lang;
            return (
              <button key={l.code} onClick={() => handleChange(l.code)}
                style={{ display:'flex', alignItems:'center', gap:10, width:'100%',
                  padding:'7px 14px', background: isActive ? 'var(--acc-s)' : 'transparent',
                  border:'none', borderLeft: isActive ? '3px solid var(--acc)':'3px solid transparent',
                  cursor:'pointer', textAlign:'left', transition:'background .1s' }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background='var(--surf2)'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background='transparent'; }}>
                <FlagImg code={l.code} size={22} />
                <span style={{ fontSize:13, fontWeight: isActive ? 600:400,
                  color: isActive ? 'var(--acc)':'var(--txt)', flex:1 }}>
                  {l.label}
                </span>
                {isActive && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                    style={{ width:12, height:12, color:'var(--acc)', flexShrink:0 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            );
          })}
          <div style={{ padding:'7px 14px', fontSize:10, color:'var(--muted)',
            borderTop:'1px solid var(--brd)', background:'var(--surf2)' }}>
            💬 Contribuer → <code style={{ fontSize:9 }}>src/i18n/locales/</code>
          </div>
        </div>
      )}
    </div>
  );
}
